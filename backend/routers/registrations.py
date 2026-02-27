from fastapi import APIRouter, Depends, Path, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.user import User
from services.log_service import log_action, _get_request_ip, user_email_from
from services.payment_service import PaymentService
from services.registration_service import RegistrationService, RegistrationError
from adapters.fake_payment_adapter import get_shared_fake_payment_adapter
from security.guards import get_active_user_dependency

router = APIRouter(prefix="/registrations", tags=["registrations"])


class ManualPaymentDetailsResponse(BaseModel):
    """
    Describe manual payment details for a registration.

    This response exposes transfer instructions, deadlines, and confirmation
    status so users can complete manual payments.
    """
    model_config = ConfigDict(coerce_numbers_to_str=True)

    registration_id: str = Field(description="Registration identifier.")
    event_id: str = Field(description="Event identifier.")
    event_title: str = Field(description="Event title.")
    occurrence_date: str = Field(description="Occurrence date for the registration.")
    status: str = Field(description="Current registration status.")
    amount: str = Field(description="Amount due for manual payment.")
    currency: str = Field(description="Currency code.")
    manual_payment_url: str | None = Field(default=None, description="Manual transfer instructions URL.")
    transfer_reference: str = Field(description="Transfer reference string.")
    payment_deadline: str | None = Field(default=None, description="Deadline for manual payment confirmation.")
    promoted_from_waitlist: bool = Field(description="Whether user was promoted from waitlist.")
    manual_payment_confirmed_at: str | None = Field(default=None, description="Timestamp of manual payment confirmation.")
    can_confirm: bool = Field(description="Whether user can confirm manual payment now.")


def get_payment_gateway():
    """
    Return the configured payment gateway adapter.

    This helper keeps gateway selection consistent across registration actions.
    """
    return get_shared_fake_payment_adapter()


@router.post("/{registration_id}/cancel")
async def cancel_registration(
    request: Request,
    registration_id: str = Path(..., min_length=1),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_active_user_dependency),
) -> dict[str, object]:
    """
    Cancel a registration for the authenticated user.

    The endpoint delegates to the registration service, requesting refund
    handling as part of cancellation.
    """
    payment_gateway = get_payment_gateway()
    payment_service = PaymentService(db, payment_gateway)
    registration_service = RegistrationService(db, payment_service)

    result = await registration_service.cancel_registration(
        registration_id=registration_id,
        user_id=user.id,
        request_refund=True,
    )
    await log_action(
        "REGISTRATION_CANCELLED",
        user_email=user_email_from(user),
        ip=_get_request_ip(request),
        registration_id=registration_id,
    )
    return result


@router.get("/{registration_id}/manual-payment", response_model=ManualPaymentDetailsResponse)
async def get_manual_payment_details(
    registration_id: str = Path(..., min_length=1),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_active_user_dependency),
) -> ManualPaymentDetailsResponse:
    """
    Return manual payment details for a registration.

    The handler validates ownership and status via the registration service and
    maps domain errors to HTTP responses for the UI.
    """
    payment_gateway = get_payment_gateway()
    payment_service = PaymentService(db, payment_gateway)
    registration_service = RegistrationService(db, payment_service)
    try:
        details = await registration_service.get_manual_payment_details_for_user(
            registration_id=registration_id,
            user_id=user.id,
        )
    except RegistrationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if details is None:
        raise HTTPException(status_code=404, detail="Registration not found")
    await log_action(
        "REGISTRATION_MANUAL_PAYMENT_CONFIRMED_BY_USER",
        user_email=user_email_from(user),
        ip=_get_request_ip(request),
        registration_id=registration_id,
        event_id=details.get("event_id"),
        event_title=details.get("event_title"),
        amount=details.get("amount"),
    )
    return ManualPaymentDetailsResponse(**details)

@router.post("/{registration_id}/manual-payment/confirm", response_model=ManualPaymentDetailsResponse)
async def confirm_manual_payment(
    request: Request,
    registration_id: str = Path(..., min_length=1),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_active_user_dependency),
) -> ManualPaymentDetailsResponse:
    """
    Confirm that the user completed a manual payment.

    The endpoint updates the registration state through the service layer and
    returns refreshed manual payment details or appropriate error responses.
    """
    payment_gateway = get_payment_gateway()
    payment_service = PaymentService(db, payment_gateway)
    registration_service = RegistrationService(db, payment_service)
    try:
        details = await registration_service.confirm_manual_payment_for_user(
            registration_id=registration_id,
            user_id=user.id,
        )
    except RegistrationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if details is None:
        raise HTTPException(status_code=404, detail="Registration not found")
    return ManualPaymentDetailsResponse(**details)
