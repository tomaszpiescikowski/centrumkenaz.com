from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Request, Query, Path
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, ConfigDict, ValidationError, Field, AnyHttpUrl
from typing import Optional, Literal

from database import get_db
from config import get_settings
from models.user import User, UserRole
from models.payment import PaymentType
from models.subscription_purchase import SubscriptionPurchaseStatus
from services.payment_service import PaymentService, SubscriptionPlan
from services.registration_service import RegistrationService
from adapters.fake_payment_adapter import get_shared_fake_payment_adapter
from ports.payment_gateway import PaymentStatus
from security.guards import get_active_user_dependency
from security.rate_limit import build_public_rate_limit_dependency

router = APIRouter(prefix="/payments", tags=["payments"])
settings = get_settings()

webhook_rate_limit = build_public_rate_limit_dependency(
    scope="payments:webhook",
    per_minute_resolver=lambda: settings.rate_limit_webhook_per_minute,
)
fake_page_rate_limit = build_public_rate_limit_dependency(
    scope="payments:fake-page",
    per_minute_resolver=lambda: settings.rate_limit_public_per_minute,
)
fake_mutation_rate_limit = build_public_rate_limit_dependency(
    scope="payments:fake-mutation",
    per_minute_resolver=lambda: settings.rate_limit_public_per_minute,
)


class PaymentStatusResponse(BaseModel):
    """
    Report the current status of a payment.

    This response is returned after verifying payment status with the gateway.
    """

    payment_id: str = Field(description="External payment identifier.")
    status: str = Field(description="Current payment status.")
    amount: str | None = Field(default=None, description="Payment amount if available.")


class WebhookResponse(BaseModel):
    """
    Acknowledge receipt of a payment webhook.

    This response communicates processing outcome to the gateway.
    """

    success: bool = Field(description="Whether the webhook was processed successfully.")
    message: str = Field(description="Human-readable processing message.")


class WebhookPayload(BaseModel):
    """
    Payload sent by the payment gateway webhook.

    This payload contains the external payment identifier and its new status.
    """

    payment_id: str = Field(min_length=1, description="External payment identifier.")
    status: Literal["pending", "processing", "completed", "failed", "refunded", "cancelled"] = Field(
        description="Payment status reported by the gateway."
    )


class SubscriptionPlanResponse(BaseModel):
    """
    Describe a subscription plan offered to users.

    This response is used by the frontend to render plan cards and pricing.
    """

    code: Literal["free", "monthly", "yearly"] = Field(description="Plan code identifier.")
    amount: str = Field(description="Plan price formatted as string.")
    currency: Literal["PLN"] = Field(description="Currency code for the plan.")
    duration_days: int = Field(ge=0, description="Number of days the plan grants.")
    is_default: bool = Field(description="Whether this is the default plan.")
    is_purchasable: bool = Field(description="Whether the plan can be purchased.")


class SubscriptionCheckoutRequest(BaseModel):
    """
    Start checkout for a paid subscription plan.

    This payload provides the selected plan and frontend redirect URLs.
    """

    plan_code: Literal["monthly", "yearly"] = Field(description="Selected paid plan code.")
    return_url: AnyHttpUrl = Field(description="Frontend URL to return on success.")
    cancel_url: AnyHttpUrl = Field(description="Frontend URL to return on cancellation.")


class SubscriptionCheckoutResponse(BaseModel):
    """
    Describe the created subscription checkout session.

    This response includes payment metadata and a redirect URL to the gateway.
    """

    payment_id: str = Field(description="External payment identifier.")
    status: str = Field(description="Current payment status.")
    redirect_url: str | None = Field(default=None, description="Gateway redirect URL.")
    amount: str = Field(description="Payment amount.")
    currency: str = Field(description="Currency code.")
    plan_code: Literal["monthly", "yearly"] = Field(description="Selected plan code.")


class FreePlanSwitchResponse(BaseModel):
    """
    Confirm switching to the free subscription plan.

    This response is returned after downgrading the user's plan.
    """

    status: Literal["ok"] = Field(description="Operation status.")
    plan_code: Literal["free"] = Field(description="Resulting plan code.")


class SubscriptionManualCheckoutRequest(BaseModel):
    """
    Start a manual-payment subscription purchase.

    The user selects a paid plan and the number of billing periods.
    """

    plan_code: Literal["monthly", "yearly"] = Field(description="Selected paid plan code.")
    periods: int = Field(ge=1, le=6, description="Number of billing periods to purchase.")


class SubscriptionPurchaseResponse(BaseModel):
    """
    Describe a subscription purchase for manual payment.

    This response mirrors the event manual payment details structure
    for consistent frontend consumption.
    """
    model_config = ConfigDict(coerce_numbers_to_str=True)

    purchase_id: str = Field(description="Purchase identifier.")
    plan_code: str = Field(description="Plan code for the purchase.")
    plan_label: str = Field(description="Human-readable plan label.")
    periods: int = Field(description="Number of billing periods purchased.")
    total_amount: str = Field(description="Total amount due.")
    currency: str = Field(description="Currency code.")
    status: str = Field(description="Current purchase status.")
    manual_payment_url: str | None = Field(default=None, description="Manual transfer instructions URL.")
    transfer_reference: str = Field(description="Transfer reference for manual payment.")
    manual_payment_confirmed_at: str | None = Field(default=None, description="Timestamp of confirmation.")
    can_confirm: bool = Field(description="Whether the user can confirm payment now.")
    created_at: str | None = Field(default=None, description="Purchase creation timestamp.")


def get_payment_gateway():
    """
    Return the configured payment gateway adapter.

    This helper centralizes gateway selection so endpoints and services use the
    same adapter instance in development and production.
    """
    return get_shared_fake_payment_adapter()


def ensure_payment_owner_or_admin(payment, user: User) -> None:
    """
    Enforce that a payment belongs to the current user unless the user is admin.

    The check hides foreign payment existence by returning a 404 for non-admins
    who attempt to access another user's payment.
    """
    if user.role == UserRole.ADMIN:
        return
    if payment.user_id != user.id:
        # Do not leak existence of foreign payments
        raise HTTPException(status_code=404, detail="Payment not found")


def ensure_fake_endpoints_enabled() -> None:
    """
    Reject fake payment endpoints when debug mode is disabled.

    This guard prevents dev-only endpoints from being exposed in production.
    """
    if not settings.debug:
        raise HTTPException(status_code=404, detail="Not found")


def ensure_frontend_redirect_url(raw_url: str) -> None:
    """
    Allow only redirect URLs that match the configured frontend origin.

    The check validates scheme and host to prevent open redirects to untrusted
    destinations during checkout flows.
    """
    frontend_origin = urlparse(settings.frontend_url or "")
    parsed = urlparse(raw_url)

    if parsed.scheme not in {"http", "https"}:
        raise HTTPException(status_code=400, detail="Invalid redirect URL scheme")
    if frontend_origin.netloc and parsed.netloc != frontend_origin.netloc:
        raise HTTPException(status_code=400, detail="Invalid redirect URL host")


def serialize_plan(plan: SubscriptionPlan) -> SubscriptionPlanResponse:
    """
    Convert a subscription plan to the public response schema.

    This helper keeps response formatting consistent across plan listing and
    checkout endpoints.
    """
    return SubscriptionPlanResponse(
        code=plan.code,
        amount=str(plan.amount),
        currency=plan.currency,
        duration_days=plan.duration_days,
        is_default=plan.is_default,
        is_purchasable=plan.is_purchasable,
    )


@router.get("/subscription/plans", response_model=list[SubscriptionPlanResponse])
async def list_subscription_plans(
    _user: User = Depends(get_active_user_dependency),
) -> list[SubscriptionPlanResponse]:
    """
    Return the list of available subscription plans.

    Only authenticated active users can access plans, and each plan is normalized
    into a frontend-friendly response payload.
    """
    plans = PaymentService.list_subscription_plans()
    return [serialize_plan(plan) for plan in plans]


@router.post("/subscription/checkout", response_model=SubscriptionCheckoutResponse)
async def start_subscription_checkout(
    payload: SubscriptionCheckoutRequest,
    user: User = Depends(get_active_user_dependency),
    db: AsyncSession = Depends(get_db),
) -> SubscriptionCheckoutResponse:
    """
    Start checkout for a paid subscription plan.

    The handler validates frontend redirect URLs, ensures the plan is purchasable,
    and returns payment metadata plus the gateway redirect URL.
    """
    ensure_frontend_redirect_url(str(payload.return_url))
    ensure_frontend_redirect_url(str(payload.cancel_url))

    plan = PaymentService.get_subscription_plan(payload.plan_code)
    if not plan or not plan.is_purchasable:
        raise HTTPException(status_code=422, detail="Unsupported subscription plan")

    payment_gateway = get_payment_gateway()
    payment_service = PaymentService(db, payment_gateway)
    payment, payment_result = await payment_service.create_subscription_payment(
        user=user,
        plan=plan,
        return_url=str(payload.return_url),
        cancel_url=str(payload.cancel_url),
    )

    return SubscriptionCheckoutResponse(
        payment_id=payment.external_id,
        status=payment.status,
        redirect_url=payment_result.redirect_url,
        amount=str(payment.amount),
        currency=payment.currency,
        plan_code=plan.code,
    )


@router.post("/subscription/free", response_model=FreePlanSwitchResponse)
async def switch_to_free_plan(
    user: User = Depends(get_active_user_dependency),
    db: AsyncSession = Depends(get_db),
) -> FreePlanSwitchResponse:
    """
    Switch the authenticated user's subscription to the free plan.

    The handler clears subscription end dates, downgrades membership role if
    needed, and returns a confirmation payload.
    """
    subscription = user.subscription
    if subscription:
        subscription.end_date = None
        db.add(subscription)
    if user.role == UserRole.MEMBER:
        user.role = UserRole.GUEST
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return FreePlanSwitchResponse(status="ok", plan_code="free")


@router.post("/subscription/manual-checkout", response_model=SubscriptionPurchaseResponse)
async def start_subscription_manual_checkout(
    payload: SubscriptionManualCheckoutRequest,
    user: User = Depends(get_active_user_dependency),
    db: AsyncSession = Depends(get_db),
) -> SubscriptionPurchaseResponse:
    """
    Start a manual-payment subscription purchase.

    The handler validates plan and period limits, creates a SubscriptionPurchase
    row, and returns payment details so the user can complete a bank transfer.
    """
    payment_gateway = get_payment_gateway()
    payment_service = PaymentService(db, payment_gateway)

    try:
        purchase = await payment_service.initiate_subscription_purchase(
            user=user,
            plan_code=payload.plan_code,
            periods=payload.periods,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    details = await payment_service.get_subscription_purchase_details(
        purchase_id=str(purchase.id),
        user_id=str(user.id),
    )
    if not details:
        raise HTTPException(status_code=500, detail="Failed to load purchase details")
    return SubscriptionPurchaseResponse(**details)


@router.get(
    "/subscription/purchases/pending",
    response_model=SubscriptionPurchaseResponse | None,
)
async def get_pending_subscription_purchase(
    user: User = Depends(get_active_user_dependency),
    db: AsyncSession = Depends(get_db),
) -> SubscriptionPurchaseResponse | None:
    """
    Return the user's pending subscription purchase, if any.

    This endpoint lets the frontend check whether the user has an active
    manual payment flow and redirect accordingly.
    """
    payment_gateway = get_payment_gateway()
    payment_service = PaymentService(db, payment_gateway)

    purchase = await payment_service.get_user_pending_subscription_purchase(str(user.id))
    if not purchase:
        return None

    details = await payment_service.get_subscription_purchase_details(
        purchase_id=str(purchase.id),
        user_id=str(user.id),
    )
    if not details:
        return None
    return SubscriptionPurchaseResponse(**details)


@router.get(
    "/subscription/purchases/{purchase_id}/manual-payment",
    response_model=SubscriptionPurchaseResponse,
)
async def get_subscription_purchase_details(
    purchase_id: str = Path(..., min_length=1),
    user: User = Depends(get_active_user_dependency),
    db: AsyncSession = Depends(get_db),
) -> SubscriptionPurchaseResponse:
    """
    Return manual payment details for a subscription purchase.

    The endpoint validates ownership and returns transfer instructions,
    amount, and confirmation status for the UI.
    """
    payment_gateway = get_payment_gateway()
    payment_service = PaymentService(db, payment_gateway)

    details = await payment_service.get_subscription_purchase_details(
        purchase_id=purchase_id,
        user_id=str(user.id),
    )
    if not details:
        raise HTTPException(status_code=404, detail="Purchase not found")
    return SubscriptionPurchaseResponse(**details)


@router.post(
    "/subscription/purchases/{purchase_id}/manual-payment/confirm",
    response_model=SubscriptionPurchaseResponse,
)
async def confirm_subscription_manual_payment(
    purchase_id: str = Path(..., min_length=1),
    user: User = Depends(get_active_user_dependency),
    db: AsyncSession = Depends(get_db),
) -> SubscriptionPurchaseResponse:
    """
    Confirm manual payment for a subscription purchase.

    The user declares they completed the bank transfer, moving the purchase
    to verification status for admin approval.
    """
    payment_gateway = get_payment_gateway()
    payment_service = PaymentService(db, payment_gateway)

    try:
        details = await payment_service.confirm_subscription_manual_payment(
            purchase_id=purchase_id,
            user_id=str(user.id),
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    if not details:
        raise HTTPException(status_code=404, detail="Purchase not found")
    return SubscriptionPurchaseResponse(**details)


@router.get("/{payment_id}/status", response_model=PaymentStatusResponse)
async def get_payment_status(
    payment_id: str = Path(..., min_length=1),
    user: User = Depends(get_active_user_dependency),
    db: AsyncSession = Depends(get_db),
) -> PaymentStatusResponse:
    """
    Return the latest status for a payment.

    The handler verifies the payment with the gateway, enforces ownership rules,
    and applies subscription effects for completed subscription payments.
    """
    payment_gateway = get_payment_gateway()
    payment_service = PaymentService(db, payment_gateway)

    payment = await payment_service.verify_payment(payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    ensure_payment_owner_or_admin(payment, user)
    if payment.payment_type == PaymentType.SUBSCRIPTION.value and payment.status == PaymentStatus.COMPLETED.value:
        await payment_service.apply_subscription_for_payment(payment)
        await db.refresh(payment)

    return PaymentStatusResponse(
        payment_id=payment.external_id,
        status=payment.status,
        amount=str(payment.amount),
    )


@router.post(
    "/webhook",
    response_model=WebhookResponse,
    dependencies=[Depends(webhook_rate_limit)],
)
async def handle_payment_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> WebhookResponse:
    """
    Process a payment webhook from the gateway.

    The endpoint validates the payload, updates payment status, and triggers
    domain side-effects such as confirming registrations or activating plans.
    """
    try:
        raw_payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
    try:
        payload = WebhookPayload.model_validate(raw_payload)
    except ValidationError:
        raise HTTPException(status_code=422, detail="Invalid webhook payload")

    # Get signature from headers (for real gateway)
    signature = request.headers.get("X-Signature")

    payment_gateway = get_payment_gateway()
    payment_service = PaymentService(db, payment_gateway)
    registration_service = RegistrationService(db, payment_service)

    # Process webhook
    payment = await payment_service.process_webhook(payload.model_dump(), signature)

    if not payment:
        return WebhookResponse(
            success=False,
            message="Payment not found",
        )

    # If payment completed, run domain-specific post-payment handlers
    if payment.status == PaymentStatus.COMPLETED.value:
        if payment.payment_type == PaymentType.EVENT.value:
            await registration_service.confirm_registration(payment.external_id)
        elif payment.payment_type == PaymentType.SUBSCRIPTION.value:
            await payment_service.apply_subscription_for_payment(payment)

    return WebhookResponse(
        success=True,
        message=f"Payment {payment.external_id} updated to {payment.status}",
    )


@router.get(
    "/fake/{payment_id}",
    response_class=HTMLResponse,
    dependencies=[Depends(fake_page_rate_limit)],
)
async def fake_payment_page(
    payment_id: str = Path(..., min_length=1),
    token: str = Query(..., min_length=8),
    db: AsyncSession = Depends(get_db),
) -> str:
    """
    Render a fake payment page for development testing.

    The endpoint validates the dev token, returns a minimal HTML page, and lets
    testers simulate payment success or failure before redirecting to the UI.
    """
    ensure_fake_endpoints_enabled()
    payment_gateway = get_payment_gateway()
    payment = getattr(payment_gateway, "get_payment", lambda _pid: None)(payment_id)
    if not payment or getattr(payment, "dev_token", None) != token:
        raise HTTPException(status_code=404, detail="Payment not found")

    return_url = getattr(payment, "return_url", "") if payment else ""
    cancel_url = getattr(payment, "cancel_url", "") if payment else ""
    return f"""<!doctype html>
<html lang=\"en\">
    <head>
        <meta charset=\"utf-8\" />
        <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
        <title>Fake payment</title>
        <style>
            body {{ font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding: 24px; max-width: 720px; margin: 0 auto; }}
            .card {{ border: 1px solid #ddd; border-radius: 12px; padding: 16px; }}
            .row {{ display: flex; gap: 12px; flex-wrap: wrap; margin-top: 16px; }}
            button {{ padding: 12px 16px; border-radius: 10px; border: 0; cursor: pointer; font-weight: 700; }}
            .ok {{ background: #1a1a4e; color: white; }}
            .bad {{ background: #e53935; color: white; }}
            .muted {{ color: #666; font-size: 14px; }}
            code {{ background: #f6f6f6; padding: 2px 6px; border-radius: 6px; }}
        </style>
    </head>
    <body>
        <h1>Fake payment gateway</h1>
        <div class=\"card\">
            <div class=\"muted\">Payment id: <code>{payment_id}</code></div>
            <div class=\"row\">
                <button class=\"ok\" id=\"pay\">Simulate success</button>
                <button class=\"bad\" id=\"cancel\">Simulate failure</button>
            </div>
            <p class=\"muted\">This is a dev-only UI. It calls backend endpoints and then redirects to the provided return/cancel URL.</p>
        </div>
        <script>
            const returnUrl = {return_url!r};
            const cancelUrl = {cancel_url!r};
            const paymentId = {payment_id!r};
            const paymentToken = {token!r};

            async function call(path) {{
                const res = await fetch(path, {{ method: 'POST' }});
                // Ignore body; backend updates DB and registration.
                return res.ok;
            }}

            document.getElementById('pay').addEventListener('click', async () => {{
                await call(`/payments/fake/${{paymentId}}/complete?token=${{encodeURIComponent(paymentToken)}}`);
                if (returnUrl) window.location.href = returnUrl;
            }});

            document.getElementById('cancel').addEventListener('click', async () => {{
                await call(`/payments/fake/${{paymentId}}/fail?token=${{encodeURIComponent(paymentToken)}}`);
                if (cancelUrl) window.location.href = cancelUrl;
            }});
        </script>
    </body>
</html>"""


@router.post(
    "/fake/{payment_id}/complete",
    dependencies=[Depends(fake_mutation_rate_limit)],
)
async def complete_fake_payment(
    payment_id: str = Path(..., min_length=1),
    token: str = Query(..., min_length=8),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    """
    Mark a fake payment as completed in development mode.

    The handler validates the dev token, updates the fake gateway state, and
    processes the payment as if a webhook completed it.
    """
    ensure_fake_endpoints_enabled()
    payment_gateway = get_payment_gateway()
    payment = getattr(payment_gateway, "get_payment", lambda _pid: None)(payment_id)
    if not payment or getattr(payment, "dev_token", None) != token:
        raise HTTPException(status_code=404, detail="Payment not found")

    payment_service = PaymentService(db, payment_gateway)
    registration_service = RegistrationService(db, payment_service)

    # Complete payment in fake gateway
    if hasattr(payment_gateway, 'complete_payment'):
        payment_gateway.complete_payment(payment_id)

    # Process as webhook
    payment = await payment_service.process_webhook({
        "payment_id": payment_id,
        "status": PaymentStatus.COMPLETED.value,
    })

    if payment:
        if payment.payment_type == PaymentType.EVENT.value:
            await registration_service.confirm_registration(payment_id)
        elif payment.payment_type == PaymentType.SUBSCRIPTION.value:
            await payment_service.apply_subscription_for_payment(payment)
        return {
            "success": True,
            "message": "Payment completed",
            "payment_id": payment_id,
        }

    return {
        "success": False,
        "message": "Payment not found",
        "payment_id": payment_id,
    }


@router.post(
    "/fake/{payment_id}/fail",
    dependencies=[Depends(fake_mutation_rate_limit)],
)
async def fail_fake_payment(
    payment_id: str = Path(..., min_length=1),
    token: str = Query(..., min_length=8),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    """
    Mark a fake payment as failed in development mode.

    The handler validates the dev token, updates the fake gateway state, and
    processes the failed payment through the webhook handler logic.
    """
    ensure_fake_endpoints_enabled()
    payment_gateway = get_payment_gateway()
    payment = getattr(payment_gateway, "get_payment", lambda _pid: None)(payment_id)
    if not payment or getattr(payment, "dev_token", None) != token:
        raise HTTPException(status_code=404, detail="Payment not found")

    payment_service = PaymentService(db, payment_gateway)

    # Fail payment in fake gateway
    if hasattr(payment_gateway, 'fail_payment'):
        payment_gateway.fail_payment(payment_id)

    # Process as webhook
    payment = await payment_service.process_webhook({
        "payment_id": payment_id,
        "status": PaymentStatus.FAILED.value,
    })

    if payment:
        return {
            "success": True,
            "message": "Payment marked as failed",
            "payment_id": payment_id,
        }

    return {
        "success": False,
        "message": "Payment not found",
        "payment_id": payment_id,
    }
