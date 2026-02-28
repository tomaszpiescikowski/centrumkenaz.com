from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional
import json
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models.payment import Payment, PaymentStatus as DBPaymentStatus, PaymentType, Currency
from models.user import User, UserRole
from models.subscription import Subscription
from models.subscription_purchase import PlanCode, SubscriptionPurchase, SubscriptionPurchaseStatus
from ports.payment_gateway import (
    PaymentGatewayPort,
    PaymentRequest,
    PaymentResult,
    PaymentStatus,
    RefundRequest,
    RefundResult,
)
from utils.legacy_ids import legacy_id_eq


@dataclass(frozen=True)
class SubscriptionPlan:
    """Authoritative subscription plan definition used by checkout and billing."""

    code: str
    amount: Decimal
    currency: str
    duration_days: int
    is_default: bool = False
    is_purchasable: bool = True


SUBSCRIPTION_PLANS: dict[str, SubscriptionPlan] = {
    PlanCode.FREE: SubscriptionPlan(
        code=PlanCode.FREE.value,
        amount=Decimal("0.00"),
        currency=Currency.PLN.value,
        duration_days=0,
        is_default=True,
        is_purchasable=False,
    ),
    PlanCode.MONTHLY: SubscriptionPlan(
        code=PlanCode.MONTHLY.value,
        amount=Decimal("33.00"),
        currency=Currency.PLN.value,
        duration_days=30,
    ),
    PlanCode.YEARLY: SubscriptionPlan(
        code=PlanCode.YEARLY.value,
        amount=Decimal("333.00"),
        currency=Currency.PLN.value,
        duration_days=365,
    ),
}


class PaymentService:
    """Service for payment operations."""

    def __init__(self, db: AsyncSession, payment_gateway: PaymentGatewayPort):
        """
        Initialize the payment service with database and gateway adapters.

        The service coordinates persistence and gateway calls for both event
        and subscription payments.
        """
        self.db = db
        self.gateway = payment_gateway

    @staticmethod
    def _build_manual_external_id() -> str:
        """
        Build a unique external ID for manual payment declarations.

        The ID is namespaced for manual flows to differentiate from gateway IDs.
        """
        return f"MANUAL_{uuid.uuid4().hex[:24].upper()}"

    @staticmethod
    def list_subscription_plans() -> list[SubscriptionPlan]:
        """
        Return available subscription plans in deterministic display order.

        The order is fixed so the frontend can render plans consistently.
        """
        return [
            SUBSCRIPTION_PLANS[PlanCode.FREE],
            SUBSCRIPTION_PLANS[PlanCode.MONTHLY],
            SUBSCRIPTION_PLANS[PlanCode.YEARLY],
        ]

    @staticmethod
    def get_subscription_plan(plan_code: str) -> SubscriptionPlan | None:
        """
        Return a subscription plan definition by code.

        The lookup normalizes the plan code and returns None when unknown.
        """
        if not isinstance(plan_code, str):
            return None
        return SUBSCRIPTION_PLANS.get(plan_code.lower().strip())

    @staticmethod
    def _parse_extra_data(payment: Payment) -> dict:
        """
        Decode the payment extra_data JSON into a dictionary.

        The method guards against invalid JSON and non-dict payloads by
        returning an empty dict.
        """
        if not payment.extra_data:
            return {}
        try:
            payload = json.loads(payment.extra_data)
        except (TypeError, json.JSONDecodeError):
            return {}
        return payload if isinstance(payload, dict) else {}

    @staticmethod
    def _add_days_from_effective_start(
        current_end: datetime | None,
        duration_days: int,
    ) -> datetime:
        """
        Extend a subscription from the effective start date.

        The method extends from the current end date if it is in the future,
        otherwise it starts from now and preserves timezone consistency.
        """
        now = datetime.utcnow()

        if current_end and current_end.tzinfo is not None and now.tzinfo is None:
            now = now.replace(tzinfo=current_end.tzinfo)
        elif current_end and current_end.tzinfo is None and now.tzinfo is not None:
            current_end = current_end.replace(tzinfo=now.tzinfo)

        base_start = current_end if current_end and current_end > now else now
        return base_start + timedelta(days=duration_days)

    async def create_event_payment(
        self,
        user: User,
        event_id: str,
        amount: Decimal,
        description: str,
        return_url: str,
        cancel_url: str,
    ) -> tuple[Payment, PaymentResult]:
        """
        Create a payment for event registration.

        The method creates a gateway payment, persists a Payment record, and
        returns both the database record and gateway result.
        """
        request = PaymentRequest(
            amount=amount,
            currency=Currency.PLN.value,
            description=description,
            user_id=user.id,
            user_email=user.email,
            user_name=user.full_name,
            return_url=return_url,
            cancel_url=cancel_url,
            metadata={"event_id": event_id, "type": "event"},
        )

        result = await self.gateway.create_payment(request)

        payment = Payment(
            user_id=user.id,
            external_id=result.payment_id,
            amount=amount,
            currency=Currency.PLN.value,
            payment_type=PaymentType.EVENT.value,
            status=result.status.value,
            description=description,
            extra_data=json.dumps({"event_id": event_id}),
            gateway_response=json.dumps(result.raw_response) if result.raw_response else None,
        )
        self.db.add(payment)
        await self.db.commit()
        await self.db.refresh(payment)

        return payment, result

    async def create_manual_event_payment(
        self,
        user: User,
        event_id: str,
        registration_id: str,
        amount: Decimal,
        description: str,
        transfer_reference: str,
        declared_at: datetime | None = None,
    ) -> Payment:
        """
        Persist a manual event payment declaration.

        This path skips the gateway, stores the user's transfer declaration,
        and leaves the payment in a processing state for admin verification.
        """
        payload = {
            "event_id": event_id,
            "registration_id": registration_id,
            "manual_payment_reference": transfer_reference,
            "declared_at": (declared_at or datetime.utcnow()).isoformat(),
        }
        payment = Payment(
            user_id=user.id,
            external_id=self._build_manual_external_id(),
            amount=amount,
            currency=Currency.PLN.value,
            payment_type=PaymentType.EVENT.value,
            status=DBPaymentStatus.PROCESSING.value,
            description=description,
            extra_data=json.dumps(payload),
        )
        self.db.add(payment)
        await self.db.commit()
        await self.db.refresh(payment)
        return payment

    async def mark_manual_event_payment_completed(self, payment_external_id: str) -> Payment | None:
        """
        Mark a manual event payment as completed after admin verification.

        The method updates status and completion timestamp when a matching
        payment is found, otherwise returns None.
        """
        result = await self.db.execute(select(Payment).where(Payment.external_id == payment_external_id))
        payment = result.scalar_one_or_none()
        if not payment:
            return None
        if payment.status == DBPaymentStatus.COMPLETED.value:
            return payment
        payment.status = DBPaymentStatus.COMPLETED.value
        payment.completed_at = datetime.utcnow()
        self.db.add(payment)
        await self.db.commit()
        await self.db.refresh(payment)
        return payment

    async def mark_manual_event_payment_refunded(self, payment_external_id: str) -> Payment | None:
        """
        Mark a manual event payment as refunded after offline transfer.

        The method updates the status when the payment exists and returns the
        updated record, otherwise returns None.
        """
        result = await self.db.execute(select(Payment).where(Payment.external_id == payment_external_id))
        payment = result.scalar_one_or_none()
        if not payment:
            return None
        payment.status = DBPaymentStatus.REFUNDED.value
        self.db.add(payment)
        await self.db.commit()
        await self.db.refresh(payment)
        return payment

    async def create_subscription_payment(
        self,
        user: User,
        plan: SubscriptionPlan,
        return_url: str,
        cancel_url: str,
    ) -> tuple[Payment, PaymentResult]:
        """
        Create a payment for a subscription purchase.

        The method creates a gateway payment, persists the payment record, and
        applies subscription benefits immediately when the payment is completed.
        """
        request = PaymentRequest(
            amount=plan.amount,
            currency=plan.currency,
            description=f"Subscription plan: {plan.code}",
            user_id=user.id,
            user_email=user.email,
            user_name=user.full_name,
            return_url=return_url,
            cancel_url=cancel_url,
            metadata={
                "type": "subscription",
                "plan_code": plan.code,
                "duration_days": plan.duration_days,
            },
        )

        result = await self.gateway.create_payment(request)

        extra_payload = {
            "type": "subscription",
            "plan_code": plan.code,
            "duration_days": plan.duration_days,
        }
        payment = Payment(
            user_id=user.id,
            external_id=result.payment_id,
            amount=plan.amount,
            currency=plan.currency,
            payment_type=PaymentType.SUBSCRIPTION.value,
            status=result.status.value,
            description=f"Subscription {plan.code}",
            extra_data=json.dumps(extra_payload),
            gateway_response=json.dumps(result.raw_response) if result.raw_response else None,
            completed_at=datetime.utcnow() if result.status == PaymentStatus.COMPLETED else None,
        )
        self.db.add(payment)
        await self.db.commit()
        await self.db.refresh(payment)

        if result.status == PaymentStatus.COMPLETED:
            await self.apply_subscription_for_payment(payment)

        return payment, result

    async def verify_payment(self, payment_id: str) -> Payment | None:
        """
        Verify a payment with the gateway and update the database.

        The method returns the updated Payment record or None when the payment
        does not exist in the database.
        """
        stmt = select(Payment).where(Payment.external_id == payment_id)
        result = await self.db.execute(stmt)
        payment = result.scalar_one_or_none()

        if not payment:
            return None

        verification = await self.gateway.verify_payment(payment_id)

        payment.status = verification.status.value
        if verification.raw_response:
            payment.gateway_response = json.dumps(verification.raw_response)
        if verification.paid_at:
            payment.completed_at = verification.paid_at

        await self.db.commit()
        await self.db.refresh(payment)

        return payment

    async def process_webhook(self, payload: dict, signature: str | None = None) -> Payment | None:
        """
        Process a payment webhook notification from the gateway.

        The method updates the payment status, records completion timestamps,
        and applies subscription benefits when a subscription is completed.
        """
        verification = await self.gateway.process_webhook(payload=payload, signature=signature)

        if not verification.payment_id:
            return None

        stmt = select(Payment).where(Payment.external_id == verification.payment_id)
        result = await self.db.execute(stmt)
        payment = result.scalar_one_or_none()

        if payment:
            payment.status = verification.status.value
            if verification.paid_at:
                payment.completed_at = verification.paid_at

            await self.db.commit()
            await self.db.refresh(payment)

            if payment.payment_type == PaymentType.SUBSCRIPTION.value and payment.status == DBPaymentStatus.COMPLETED.value:
                await self.apply_subscription_for_payment(payment)

        return payment

    async def apply_subscription_for_payment(self, payment: Payment) -> bool:
        """
        Grant subscription benefits for a completed subscription payment.

        The operation is idempotent: repeated calls for the same payment do not
        extend subscription more than once.
        """
        if payment.payment_type != PaymentType.SUBSCRIPTION.value:
            return False
        if payment.status != DBPaymentStatus.COMPLETED.value:
            return False

        extra_data = self._parse_extra_data(payment)
        if extra_data.get("subscription_applied_at"):
            return False

        plan_code = str(extra_data.get("plan_code", "")).strip().lower()
        plan = self.get_subscription_plan(plan_code)
        if not plan or not plan.is_purchasable:
            return False

        result = await self.db.execute(select(User).where(legacy_id_eq(User.id, payment.user_id)))
        user = result.scalar_one_or_none()
        if not user:
            return False

        subscription_result = await self.db.execute(
            select(Subscription).where(legacy_id_eq(Subscription.user_id, user.id))
        )
        subscription = subscription_result.scalar_one_or_none()
        if not subscription:
            subscription = Subscription(user_id=user.id, points=0)

        subscription.end_date = self._add_days_from_effective_start(
            current_end=subscription.end_date,
            duration_days=plan.duration_days,
        )
        if user.role == UserRole.GUEST:
            user.role = UserRole.MEMBER

        if payment.completed_at is None:
            payment.completed_at = datetime.utcnow()

        extra_data["plan_code"] = plan.code
        extra_data["duration_days"] = plan.duration_days
        extra_data["subscription_applied_at"] = datetime.utcnow().isoformat()
        payment.extra_data = json.dumps(extra_data)

        self.db.add(user)
        self.db.add(subscription)
        self.db.add(payment)
        await self.db.commit()
        await self.db.refresh(payment)
        return True

    async def refund_payment(self, payment_id: str, reason: str | None = None) -> RefundResult:
        """
        Refund a completed payment through the gateway.

        The method validates payment existence and status before requesting a
        refund, and updates the local status when the refund succeeds.
        """
        stmt = select(Payment).where(Payment.external_id == payment_id)
        result = await self.db.execute(stmt)
        payment = result.scalar_one_or_none()

        if not payment:
            return RefundResult(
                success=False,
                error_message=f"Payment {payment_id} not found",
            )

        if payment.status != DBPaymentStatus.COMPLETED.value:
            return RefundResult(
                success=False,
                error_message=f"Cannot refund payment with status {payment.status}",
            )

        refund_request = RefundRequest(
            payment_id=payment_id,
            reason=reason,
        )
        refund_result = await self.gateway.refund(refund_request)

        if refund_result.success:
            payment.status = DBPaymentStatus.REFUNDED.value
            await self.db.commit()

        return refund_result

    async def get_payment_by_external_id(self, external_id: str) -> Payment | None:
        """
        Get a payment by its external gateway ID.

        The lookup returns None when the payment does not exist.
        """
        stmt = select(Payment).where(Payment.external_id == external_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_user_payments(self, user_id: str) -> list[Payment]:
        """
        Return all payments for a user ordered by creation date.

        The query orders by most recent payments first to support history views.
        """
        stmt = (
            select(Payment)
            .where(legacy_id_eq(Payment.user_id, user_id))
            .order_by(Payment.created_at.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    # ── Subscription manual-payment purchase flow ──────────────────────────

    @staticmethod
    def max_periods_for_plan(plan_code: str) -> int:
        """
        Return the maximum number of billing periods a user may purchase at once.

        Monthly allows up to 6 months; yearly (annual) allows up to 2 years.
        """
        if plan_code == PlanCode.YEARLY.value:
            return 2
        return 6  # monthly or any other

    async def initiate_subscription_purchase(
        self,
        user: User,
        plan_code: str,
        periods: int = 1,
    ) -> SubscriptionPurchase:
        """
        Create a subscription purchase order for manual payment.

        The method validates the plan, enforces period limits, prevents
        duplicate purchases during an active subscription, and returns the
        new SubscriptionPurchase row.
        """
        plan = self.get_subscription_plan(plan_code)
        if not plan or not plan.is_purchasable:
            raise ValueError("Unsupported subscription plan")

        max_p = self.max_periods_for_plan(plan_code)
        if periods < 1 or periods > max_p:
            raise ValueError(f"periods must be between 1 and {max_p}")

        pending_result = await self.db.execute(
            select(SubscriptionPurchase).where(
                legacy_id_eq(SubscriptionPurchase.user_id, user.id),
                SubscriptionPurchase.status.in_([
                    SubscriptionPurchaseStatus.MANUAL_PAYMENT_REQUIRED.value,
                    SubscriptionPurchaseStatus.MANUAL_PAYMENT_VERIFICATION.value,
                ]),
            )
        )
        existing = pending_result.scalar_one_or_none()
        if existing:
            raise ValueError("You already have a pending subscription purchase")

        total = plan.amount * periods
        purchase = SubscriptionPurchase(
            user_id=user.id,
            plan_code=plan.code,
            periods=periods,
            total_amount=total,
            currency=plan.currency,
            status=SubscriptionPurchaseStatus.MANUAL_PAYMENT_REQUIRED.value,
        )
        self.db.add(purchase)
        await self.db.commit()
        await self.db.refresh(purchase)
        return purchase

    async def get_subscription_purchase_details(
        self,
        purchase_id: str,
        user_id: str,
    ) -> dict | None:
        """
        Return manual payment details for a subscription purchase.

        The response dict mirrors the event manual payment details structure
        for consistent frontend consumption.
        """
        from config import get_settings

        stmt = select(SubscriptionPurchase).where(
            legacy_id_eq(SubscriptionPurchase.id, purchase_id),
            legacy_id_eq(SubscriptionPurchase.user_id, user_id),
        )
        result = await self.db.execute(stmt)
        purchase = result.scalar_one_or_none()
        if not purchase:
            return None

        plan = self.get_subscription_plan(purchase.plan_code)
        plan_label = plan.code if plan else purchase.plan_code
        settings = get_settings()

        return {
            "purchase_id": str(purchase.id),
            "plan_code": purchase.plan_code,
            "plan_label": plan_label,
            "periods": purchase.periods,
            "total_amount": str(purchase.total_amount),
            "currency": purchase.currency,
            "status": purchase.status,
            "manual_payment_url": getattr(settings, "default_payment_url", "") or "",
            "transfer_reference": str(purchase.id),
            "manual_payment_confirmed_at": (
                purchase.manual_payment_confirmed_at.isoformat()
                if purchase.manual_payment_confirmed_at
                else None
            ),
            "can_confirm": purchase.status == SubscriptionPurchaseStatus.MANUAL_PAYMENT_REQUIRED.value,
            "created_at": purchase.created_at.isoformat() if purchase.created_at else None,
        }

    async def confirm_subscription_manual_payment(
        self,
        purchase_id: str,
        user_id: str,
    ) -> dict | None:
        """
        Confirm that the user completed a manual subscription payment.

        Creates a Payment record and sets the purchase to MANUAL_PAYMENT_VERIFICATION.
        """
        stmt = select(SubscriptionPurchase).where(
            legacy_id_eq(SubscriptionPurchase.id, purchase_id),
            legacy_id_eq(SubscriptionPurchase.user_id, user_id),
        )
        result = await self.db.execute(stmt)
        purchase = result.scalar_one_or_none()
        if not purchase:
            return None

        if purchase.status == SubscriptionPurchaseStatus.MANUAL_PAYMENT_VERIFICATION.value:
            return await self.get_subscription_purchase_details(purchase_id, user_id)
        if purchase.status == SubscriptionPurchaseStatus.CONFIRMED.value:
            return await self.get_subscription_purchase_details(purchase_id, user_id)
        if purchase.status != SubscriptionPurchaseStatus.MANUAL_PAYMENT_REQUIRED.value:
            raise ValueError("Manual payment confirmation is not available for this purchase")

        now = datetime.utcnow()

        if not purchase.payment_id:
            plan = self.get_subscription_plan(purchase.plan_code)
            plan_label = plan.code if plan else purchase.plan_code
            payload = {
                "type": "subscription",
                "plan_code": purchase.plan_code,
                "periods": purchase.periods,
                "duration_days": (plan.duration_days * purchase.periods) if plan else 0,
                "purchase_id": str(purchase.id),
                "manual_payment_reference": str(purchase.id),
                "declared_at": now.isoformat(),
            }
            payment = Payment(
                user_id=purchase.user_id,
                external_id=self._build_manual_external_id(),
                amount=purchase.total_amount,
                currency=purchase.currency,
                payment_type=PaymentType.SUBSCRIPTION.value,
                status=DBPaymentStatus.PROCESSING.value,
                description=f"Subskrypcja {plan_label} x{purchase.periods}",
                extra_data=json.dumps(payload),
            )
            self.db.add(payment)
            await self.db.flush()
            purchase.payment_id = payment.external_id

        purchase.status = SubscriptionPurchaseStatus.MANUAL_PAYMENT_VERIFICATION.value
        purchase.manual_payment_confirmed_at = now
        self.db.add(purchase)
        await self.db.commit()
        await self.db.refresh(purchase)
        return await self.get_subscription_purchase_details(purchase_id, user_id)

    async def approve_subscription_manual_payment(
        self,
        purchase_id: str,
    ) -> SubscriptionPurchase | None:
        """
        Approve a manual subscription payment and activate the subscription.

        Marks the payment completed, calculates total duration from plan *
        periods, applies subscription via existing helper, and sets purchase
        status to CONFIRMED.
        """
        stmt = select(SubscriptionPurchase).where(
            legacy_id_eq(SubscriptionPurchase.id, purchase_id),
        )
        result = await self.db.execute(stmt)
        purchase = result.scalar_one_or_none()
        if not purchase:
            return None
        if purchase.status != SubscriptionPurchaseStatus.MANUAL_PAYMENT_VERIFICATION.value:
            raise ValueError("Purchase is not awaiting manual payment verification")

        if not purchase.payment_id:
            raise ValueError("No payment record linked to this purchase")

        await self.mark_manual_event_payment_completed(purchase.payment_id)

        pay_result = await self.db.execute(
            select(Payment).where(Payment.external_id == purchase.payment_id)
        )
        payment = pay_result.scalar_one_or_none()
        if not payment:
            raise ValueError("Payment record not found")

        plan = self.get_subscription_plan(purchase.plan_code)
        if not plan:
            raise ValueError("Plan not found")
        total_days = plan.duration_days * purchase.periods

        user_result = await self.db.execute(
            select(User).where(legacy_id_eq(User.id, purchase.user_id))
        )
        user = user_result.scalar_one_or_none()
        if not user:
            raise ValueError("User not found")

        sub_result = await self.db.execute(
            select(Subscription).where(legacy_id_eq(Subscription.user_id, user.id))
        )
        subscription = sub_result.scalar_one_or_none()
        if not subscription:
            subscription = Subscription(
                user_id=user.id, points=0
            )

        subscription.end_date = self._add_days_from_effective_start(
            current_end=subscription.end_date,
            duration_days=total_days,
        )
        if user.role == UserRole.GUEST:
            user.role = UserRole.MEMBER

        extra_data = self._parse_extra_data(payment)
        extra_data["plan_code"] = plan.code
        extra_data["duration_days"] = total_days
        extra_data["subscription_applied_at"] = datetime.utcnow().isoformat()
        payment.extra_data = json.dumps(extra_data)

        purchase.status = SubscriptionPurchaseStatus.CONFIRMED.value

        self.db.add(user)
        self.db.add(subscription)
        self.db.add(payment)
        self.db.add(purchase)
        await self.db.commit()
        await self.db.refresh(purchase)
        return purchase

    async def get_user_pending_subscription_purchase(
        self,
        user_id: str,
    ) -> SubscriptionPurchase | None:
        """
        Return the pending subscription purchase for a user, if any.

        Returns the most recent purchase in MANUAL_PAYMENT_REQUIRED or
        MANUAL_PAYMENT_VERIFICATION status.
        """
        stmt = (
            select(SubscriptionPurchase)
            .where(
                legacy_id_eq(SubscriptionPurchase.user_id, user_id),
                SubscriptionPurchase.status.in_([
                    SubscriptionPurchaseStatus.MANUAL_PAYMENT_REQUIRED.value,
                    SubscriptionPurchaseStatus.MANUAL_PAYMENT_VERIFICATION.value,
                ]),
            )
            .order_by(SubscriptionPurchase.created_at.desc())
            .limit(1)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
