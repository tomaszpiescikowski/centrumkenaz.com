import calendar
import enum
import json
from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Path
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from database import get_db
from models.event import Event
from models.payment import Payment, PaymentStatus as DBPaymentStatus, Currency
from models.registration import Registration, RegistrationStatus
from models.registration_refund_task import RegistrationRefundTask
from models.subscription_purchase import SubscriptionPurchase, SubscriptionPurchaseStatus
from models.user import AccountStatus, User, UserRole
from models.subscription import Subscription
from models.approval_request import ApprovalRequest
from security.guards import get_admin_user_dependency
from adapters.fake_payment_adapter import get_shared_fake_payment_adapter
from services.payment_service import PaymentService
from services.registration_service import RegistrationService, RegistrationError
from utils.legacy_ids import legacy_id_eq, optional_str_id

router = APIRouter(prefix="/admin", tags=["admin"])


class RefundRecommendationCode(str, enum.Enum):
    """Enumerated refund recommendation codes with clear semantics."""

    REFUND_CANCELLED_BEFORE_CUTOFF = "REFUND_CANCELLED_BEFORE_CUTOFF"
    NO_REFUND_CANCELLED_AFTER_CUTOFF = "NO_REFUND_CANCELLED_AFTER_CUTOFF"
    NO_REFUND_NO_PAYMENT = "NO_REFUND_NO_PAYMENT"
    REFUND_ADMIN_OVERRIDE = "REFUND_ADMIN_OVERRIDE"
    NO_REFUND_ADMIN_OVERRIDE = "NO_REFUND_ADMIN_OVERRIDE"
    REFUND_COMPLETED = "REFUND_COMPLETED"


def _compute_recommendation_code(
    task: RegistrationRefundTask,
) -> str:
    """Derive a recommendation code from refund task state."""
    if task.refund_marked_paid:
        return RefundRecommendationCode.REFUND_COMPLETED.value
    if task.reviewed_by_admin_id:
        if task.should_refund != task.recommended_should_refund:
            if task.should_refund:
                return RefundRecommendationCode.REFUND_ADMIN_OVERRIDE.value
            return RefundRecommendationCode.NO_REFUND_ADMIN_OVERRIDE.value
    if not task.refund_eligible and not task.recommended_should_refund:
        if task.should_refund:
            return RefundRecommendationCode.REFUND_ADMIN_OVERRIDE.value
        return RefundRecommendationCode.NO_REFUND_CANCELLED_AFTER_CUTOFF.value
    if task.refund_eligible and not task.recommended_should_refund:
        return RefundRecommendationCode.NO_REFUND_NO_PAYMENT.value
    if task.refund_eligible and task.recommended_should_refund:
        return RefundRecommendationCode.REFUND_CANCELLED_BEFORE_CUTOFF.value
    return RefundRecommendationCode.NO_REFUND_NO_PAYMENT.value


class EventStatsResponse(BaseModel):
    """
    Summarize event performance metrics for admin dashboards.

    This response aggregates registrations and revenue for an event within a
    selected time window.
    """

    event_id: str = Field(description="Event identifier.")
    title: str = Field(description="Event title.")
    start_date: str = Field(description="Event start date in YYYY-MM-DD.")
    event_type: str = Field(description="Event category tag.")
    city: str = Field(description="Event city.")
    price_guest: str = Field(description="Guest price formatted with currency.")
    price_member: str = Field(description="Member price formatted with currency.")
    requires_subscription: bool = Field(description="Whether subscription is required.")
    confirmed_count: int = Field(description="Count of confirmed registrations.")
    max_participants: int | None = Field(
        default=None,
        description="Maximum participants limit if set.",
    )
    fill_percent: str | None = Field(
        default=None,
        description="Percentage of capacity filled.",
    )
    total_paid: str = Field(description="Total completed payments for the event.")


class UserStatsResponse(BaseModel):
    """
    Summarize user activity and revenue contribution.

    This response aggregates paid totals, attendance counts, and subscription
    status to support admin reporting and sorting.
    """

    user_id: str = Field(description="User identifier.")
    full_name: str | None = Field(default=None, description="User full name.")
    email: str = Field(description="User email address.")
    event_count: int = Field(description="Number of confirmed event registrations.")
    total_paid: str = Field(description="Total completed payments for the user.")
    points: int = Field(description="Current loyalty points balance.")
    role: str = Field(description="Authorization role of the user.")
    account_status: str = Field(description="Approval status of the account.")
    subscription_end_date: str | None = Field(
        default=None,
        description="Subscription end date if active.",
    )
    last_payment_at: str | None = Field(
        default=None,
        description="Timestamp of the last completed payment.",
    )


class PaymentStatusStats(BaseModel):
    """
    Aggregate payment totals by status.

    This response summarizes volume and amount for a given payment status.
    """

    status: str = Field(description="Payment status value.")
    count: int = Field(description="Number of payments in this status.")
    total_amount: str = Field(description="Total amount formatted with currency.")


class PaymentTypeStats(BaseModel):
    """
    Aggregate payment totals by payment type.

    This response summarizes volume and amount for event vs subscription payments.
    """

    payment_type: str = Field(description="Payment type value.")
    count: int = Field(description="Number of payments of this type.")
    total_amount: str = Field(description="Total amount formatted with currency.")


class PaymentStatsResponse(BaseModel):
    """
    Summarize payment metrics for a period.

    This response aggregates totals across payment statuses and types for admin
    dashboards and financial review.
    """

    total_count: int = Field(description="Total number of payments.")
    total_amount: str = Field(description="Total amount for all payments.")
    completed_count: int = Field(description="Count of completed payments.")
    completed_amount: str = Field(description="Sum of completed payment amounts.")
    refunded_count: int = Field(description="Count of refunded payments.")
    refunded_amount: str = Field(description="Sum of refunded payment amounts.")
    average_amount: str = Field(description="Average payment amount.")
    by_status: list[PaymentStatusStats] = Field(description="Breakdown by status.")
    by_type: list[PaymentTypeStats] = Field(description="Breakdown by payment type.")


class RegistrationStatusStats(BaseModel):
    """
    Aggregate registration totals by status.

    This response summarizes how many registrations are in each status.
    """

    status: str = Field(description="Registration status value.")
    count: int = Field(description="Number of registrations with this status.")


class RegistrationTopEvent(BaseModel):
    """
    Describe a top event by registration volume.

    This response is used in admin dashboards showing highest attendance events.
    """

    event_id: str = Field(description="Event identifier.")
    title: str = Field(description="Event title.")
    city: str = Field(description="Event city.")
    confirmed_count: int = Field(description="Confirmed registration count.")
    max_participants: int | None = Field(
        default=None,
        description="Capacity limit if configured.",
    )
    fill_percent: str | None = Field(
        default=None,
        description="Percentage of capacity filled.",
    )


class RegistrationStatsResponse(BaseModel):
    """
    Summarize registration metrics for a period.

    This response aggregates counts and top events for admin reporting.
    """

    total_count: int = Field(description="Total number of registrations.")
    confirmed_count: int = Field(description="Count of confirmed registrations.")
    pending_count: int = Field(description="Count of pending registrations.")
    cancelled_count: int = Field(description="Count of cancelled registrations.")
    refunded_count: int = Field(description="Count of refunded registrations.")
    unique_users: int = Field(description="Number of distinct users registered.")
    unique_events: int = Field(description="Number of distinct events registered.")
    by_status: list[RegistrationStatusStats] = Field(description="Breakdown by status.")
    top_events: list[RegistrationTopEvent] = Field(description="Top events by confirmed count.")


class PendingUserResponse(BaseModel):
    """
    Describe a user awaiting admin approval.

    This response supports the admin pending user queue.
    """

    user_id: str = Field(description="User identifier.")
    full_name: str | None = Field(default=None, description="User full name.")
    email: str = Field(description="User email address.")
    picture_url: str | None = Field(default=None, description="Avatar image URL.")
    about_me: str | None = Field(default=None, description="User bio from profile.")
    interest_tags: list[str] = Field(default_factory=list, description="Interest tags.")
    phone_country_code: str | None = Field(default=None, description="Phone country prefix.")
    phone_number: str | None = Field(default=None, description="Phone number.")
    admin_message: str | None = Field(default=None, description="Optional message from user.")
    created_at: str | None = Field(default=None, description="Account creation timestamp.")
    account_status: str = Field(description="Current account status.")



class ManualPaymentPendingResponse(BaseModel):
    """
    Describe a manual payment waiting for admin verification.

    This response supports the admin queue for confirming manual transfers.
    """

    registration_id: str = Field(description="Registration identifier.")
    event_id: str = Field(description="Event identifier.")
    event_title: str = Field(description="Event title.")
    occurrence_date: str = Field(description="Occurrence date for the registration.")
    user_id: str = Field(description="User identifier.")
    user_name: str | None = Field(default=None, description="User full name.")
    user_email: str = Field(description="User email address.")
    amount: str = Field(description="Payment amount.")
    currency: str = Field(description="Currency code.")
    status: str = Field(description="Registration status.")
    transfer_reference: str = Field(description="Transfer reference for manual payment.")
    manual_payment_confirmed_at: str | None = Field(
        default=None,
        description="Timestamp of user manual payment confirmation.",
    )
    promoted_from_waitlist: bool = Field(description="Whether user was promoted from waitlist.")
    payment_deadline: str | None = Field(
        default=None,
        description="Deadline for confirming manual payment.",
    )
    payment_id: str | None = Field(
        default=None,
        description="External payment identifier if available.",
    )


class SubscriptionPurchasePendingResponse(BaseModel):
    """
    Describe a subscription purchase awaiting admin verification.

    This response supports the admin queue for confirming manual subscription
    transfers alongside event manual payments.
    """

    purchase_id: str = Field(description="Purchase identifier.")
    plan_code: str = Field(description="Plan code for the purchase.")
    plan_label: str = Field(description="Human-readable plan label.")
    periods: int = Field(description="Number of billing periods purchased.")
    total_amount: str = Field(description="Total amount due.")
    currency: str = Field(description="Currency code.")
    status: str = Field(description="Current purchase status.")
    user_id: str = Field(description="User identifier.")
    user_name: str | None = Field(default=None, description="User full name.")
    user_email: str = Field(description="User email address.")
    manual_payment_confirmed_at: str | None = Field(
        default=None,
        description="Timestamp of user manual payment confirmation.",
    )
    created_at: str | None = Field(default=None, description="Purchase creation timestamp.")
    payment_id: str | None = Field(default=None, description="Linked payment external ID.")


class RefundTaskResponse(BaseModel):
    """
    Describe a refund task awaiting admin decision or payout.

    This response captures eligibility, recommendations, and review metadata
    for manual refund processing.
    """

    task_id: str = Field(description="Refund task identifier.")
    registration_id: str = Field(description="Registration identifier.")
    event_id: str = Field(description="Event identifier.")
    event_title: str = Field(description="Event title.")
    occurrence_date: str = Field(description="Occurrence date for the registration.")
    user_id: str = Field(description="User identifier.")
    user_name: str | None = Field(default=None, description="User full name.")
    user_email: str = Field(description="User email address.")
    refund_eligible: bool = Field(description="Whether refund is eligible per policy.")
    recommended_should_refund: bool = Field(description="System recommendation for refund.")
    recommendation_code: str = Field(description="Enum code describing the refund recommendation reason.")
    should_refund: bool = Field(description="Admin decision to refund.")
    refund_marked_paid: bool = Field(description="Whether refund was paid.")
    is_resolved: bool = Field(description="Whether the task has been finally resolved by admin.")
    override_reason: str | None = Field(default=None, description="Reason for overriding recommendation.")
    reviewed_at: str | None = Field(default=None, description="Timestamp when reviewed.")
    reviewed_by_admin_id: str | None = Field(default=None, description="Admin who reviewed the task.")
    payment_id: str | None = Field(default=None, description="External payment identifier if available.")


class RefundTaskUpdateRequest(BaseModel):
    """
    Update refund task decisions or payout status.

    This payload allows admins to mark refunds and document overrides.
    """

    should_refund: bool | None = Field(
        default=None,
        description="Admin decision to issue refund.",
    )
    refund_marked_paid: bool | None = Field(
        default=None,
        description="Whether the refund has been paid out.",
    )
    override_reason: str | None = Field(
        default=None,
        max_length=500,
        description="Explanation when overriding the recommended decision.",
    )


class WaitlistPromotionResponse(BaseModel):
    """
    Describe a waitlist promotion awaiting notification or payment.

    This response helps admins track users promoted from waitlists.
    """

    registration_id: str = Field(description="Registration identifier.")
    event_id: str = Field(description="Event identifier.")
    event_title: str = Field(description="Event title.")
    occurrence_date: str = Field(description="Occurrence date for the registration.")
    user_id: str = Field(description="User identifier.")
    user_name: str | None = Field(default=None, description="User full name.")
    user_email: str = Field(description="User email address.")
    promoted_from_waitlist_at: str = Field(description="Timestamp of waitlist promotion.")
    payment_deadline: str | None = Field(
        default=None,
        description="Manual payment deadline if applicable.",
    )
    status: str = Field(description="Current registration status.")
    waitlist_notification_sent: bool = Field(description="Whether notification was sent.")
    waitlist_notified_at: str | None = Field(
        default=None,
        description="Timestamp when notification was sent.",
    )


class WaitlistPromotionUpdateRequest(BaseModel):
    """
    Update waitlist promotion notification status.

    This payload marks whether a waitlist notification has been sent.
    """

    waitlist_notification_sent: bool = Field(description="Whether notification was sent to the user.")



def _extract_transfer_reference(payment: Payment | None, event_id: str) -> str:
    if payment and payment.extra_data:
        try:
            payload = json.loads(payment.extra_data)
        except (TypeError, json.JSONDecodeError):
            payload = None
        if isinstance(payload, dict):
            ref = str(payload.get("manual_payment_reference") or "").strip()
            if ref:
                return ref
    return event_id


@router.get("/stats/events", response_model=list[EventStatsResponse])
async def get_event_stats(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user_dependency),
    month: str | None = Query(default=None, description="Month in YYYY-MM format"),
) -> list[EventStatsResponse]:
    """
    Return aggregated stats for events within a month or the upcoming window.

    When a month is provided, the input is validated as YYYY-MM and the query is
    constrained to that calendar range. Otherwise, only future events are included,
    with confirmed registrations and completed payment totals summarized for each event.
    """

    if month:
        try:
            parsed = datetime.strptime(month, "%Y-%m")
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid month format") from exc

        month_start = datetime(parsed.year, parsed.month, 1)
        last_day = calendar.monthrange(parsed.year, parsed.month)[1]
        month_end = datetime(parsed.year, parsed.month, last_day, 23, 59, 59, 999999)

        events_result = await db.execute(
            select(Event)
            .where(Event.start_date >= month_start, Event.start_date <= month_end)
            .order_by(Event.start_date)
        )
    else:
        now = datetime.utcnow()
        events_result = await db.execute(
            select(Event)
            .where(Event.start_date >= now)
            .order_by(Event.start_date)
        )
    events = list(events_result.scalars().all())

    if not events:
        return []

    event_ids = [e.id for e in events]

    reg_counts_result = await db.execute(
        select(Registration.event_id, func.count(Registration.id))
        .where(
            Registration.event_id.in_(event_ids),
            Registration.status == RegistrationStatus.CONFIRMED.value,
        )
        .group_by(Registration.event_id)
    )
    reg_counts = {row[0]: row[1] for row in reg_counts_result.all()}

    payment_sums_result = await db.execute(
        select(
            Registration.event_id,
            func.coalesce(func.sum(Payment.amount), 0),
        )
        .join(Payment, Payment.external_id == Registration.payment_id)
        .where(
            Registration.event_id.in_(event_ids),
            Payment.status == DBPaymentStatus.COMPLETED.value,
        )
        .group_by(Registration.event_id)
    )
    payment_sums = {row[0]: Decimal(str(row[1])) for row in payment_sums_result.all()}

    response: list[EventStatsResponse] = []
    for event in events:
        confirmed = int(reg_counts.get(event.id, 0))
        total_paid = payment_sums.get(event.id, Decimal("0"))
        fill_percent = None
        if event.max_participants:
            fill = (confirmed / event.max_participants) * 100
            fill_percent = f"{fill:.0f}%"

        response.append(
            EventStatsResponse(
                event_id=str(event.id),
                title=event.title,
                start_date=event.start_date.strftime("%Y-%m-%d"),
                event_type=event.event_type or "",
                city=event.city or "",
                price_guest=f"{Decimal(str(event.price_guest or 0)):.2f} PLN",
                price_member=f"{Decimal(str(event.price_member or 0)):.2f} PLN",
                requires_subscription=bool(event.requires_subscription),
                confirmed_count=confirmed,
                max_participants=event.max_participants,
                fill_percent=fill_percent,
                total_paid=f"{total_paid:.2f} PLN",
            )
        )

    return response


@router.get("/stats/users", response_model=list[UserStatsResponse])
async def get_user_stats(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user_dependency),
) -> list[UserStatsResponse]:
    """
    Return aggregated user stats ordered by paid totals and activity.

    This endpoint combines completed payment totals, confirmed registration counts,
    and subscription details, then sorts the results for admin reporting dashboards.
    """

    users_result = await db.execute(
        select(User, Subscription).outerjoin(Subscription, Subscription.user_id == User.id)
    )
    rows = users_result.all()
    if not rows:
        return []

    users = [row[0] for row in rows]
    subscriptions_by_user = {row[0].id: row[1] for row in rows}
    user_ids = [u.id for u in users]

    payment_totals_result = await db.execute(
        select(Payment.user_id, func.coalesce(func.sum(Payment.amount), 0))
        .where(
            Payment.user_id.in_(user_ids),
            Payment.status == DBPaymentStatus.COMPLETED.value,
        )
        .group_by(Payment.user_id)
    )
    payment_totals = {row[0]: Decimal(row[1]) for row in payment_totals_result.all()}

    last_payment_result = await db.execute(
        select(
            Payment.user_id,
            func.max(Payment.completed_at),
        )
        .where(
            Payment.user_id.in_(user_ids),
            Payment.status == DBPaymentStatus.COMPLETED.value,
        )
        .group_by(Payment.user_id)
    )
    last_payments = {row[0]: row[1] for row in last_payment_result.all()}

    event_counts_result = await db.execute(
        select(Registration.user_id, func.count(Registration.id))
        .where(
            Registration.user_id.in_(user_ids),
            Registration.status == RegistrationStatus.CONFIRMED.value,
        )
        .group_by(Registration.user_id)
    )
    event_counts = {row[0]: row[1] for row in event_counts_result.all()}

    stats: list[UserStatsResponse] = []
    for u in users:
        total_paid = payment_totals.get(u.id, Decimal("0"))
        subscription = subscriptions_by_user.get(u.id)
        points = int(subscription.points or 0) if subscription else 0
        subscription_end_date = subscription.end_date if subscription else None
        stats.append(
            UserStatsResponse(
                user_id=str(u.id),
                full_name=u.full_name,
                email=u.email,
                event_count=int(event_counts.get(u.id, 0)),
                total_paid=f"{total_paid:.2f} PLN",
                points=points,
                role=str(u.role.value if hasattr(u.role, "value") else u.role),
                account_status=str(
                    u.account_status.value if hasattr(u.account_status, "value") else u.account_status
                ),
                subscription_end_date=subscription_end_date.isoformat() if subscription_end_date else None,
                last_payment_at=last_payments.get(u.id).isoformat() if last_payments.get(u.id) else None,
            )
        )

    stats.sort(
        key=lambda item: (
            Decimal(item.total_paid.split(" ")[0]),
            item.event_count,
            item.points,
        ),
        reverse=True,
    )

    return stats


@router.get("/stats/payments", response_model=PaymentStatsResponse)
async def get_payment_stats(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user_dependency),
    month: str | None = Query(default=None, description="Month in YYYY-MM format"),
) -> PaymentStatsResponse:
    """
    Return payment totals and breakdowns for a selected time window.

    If a month is provided, it is validated as YYYY-MM and used to filter by
    creation date; otherwise the summary covers all payments. Totals are grouped
    by status and type for admin reporting.
    """
    if month:
        try:
            parsed = datetime.strptime(month, "%Y-%m")
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid month format") from exc

        month_start = datetime(parsed.year, parsed.month, 1)
        last_day = calendar.monthrange(parsed.year, parsed.month)[1]
        month_end = datetime(parsed.year, parsed.month, last_day, 23, 59, 59, 999999)
        time_filter = (Payment.created_at >= month_start, Payment.created_at <= month_end)
    else:
        time_filter = ()

    totals_result = await db.execute(
        select(
            func.count(Payment.id),
            func.coalesce(func.sum(Payment.amount), 0),
        ).where(*time_filter)
    )
    total_count, total_amount = totals_result.one()
    total_count = int(total_count or 0)
    total_amount = Decimal(total_amount or 0)

    completed_result = await db.execute(
        select(
            func.count(Payment.id),
            func.coalesce(func.sum(Payment.amount), 0),
        )
        .where(
            *time_filter,
            Payment.status == DBPaymentStatus.COMPLETED.value,
        )
    )
    completed_count, completed_amount = completed_result.one()
    completed_count = int(completed_count or 0)
    completed_amount = Decimal(completed_amount or 0)

    refunded_result = await db.execute(
        select(
            func.count(Payment.id),
            func.coalesce(func.sum(Payment.amount), 0),
        )
        .where(
            *time_filter,
            Payment.status == DBPaymentStatus.REFUNDED.value,
        )
    )
    refunded_count, refunded_amount = refunded_result.one()
    refunded_count = int(refunded_count or 0)
    refunded_amount = Decimal(refunded_amount or 0)

    by_status_result = await db.execute(
        select(
            Payment.status,
            func.count(Payment.id),
            func.coalesce(func.sum(Payment.amount), 0),
        )
        .where(*time_filter)
        .group_by(Payment.status)
    )
    by_status = [
        PaymentStatusStats(
            status=str(row[0]),
            count=int(row[1]),
            total_amount=f"{Decimal(row[2]):.2f} PLN",
        )
        for row in by_status_result.all()
    ]

    by_type_result = await db.execute(
        select(
            Payment.payment_type,
            func.count(Payment.id),
            func.coalesce(func.sum(Payment.amount), 0),
        )
        .where(*time_filter)
        .group_by(Payment.payment_type)
    )
    by_type = [
        PaymentTypeStats(
            payment_type=str(row[0]),
            count=int(row[1]),
            total_amount=f"{Decimal(row[2]):.2f} PLN",
        )
        for row in by_type_result.all()
    ]

    average_amount = Decimal("0")
    if total_count:
        average_amount = total_amount / Decimal(total_count)

    return PaymentStatsResponse(
        total_count=total_count,
        total_amount=f"{total_amount:.2f} PLN",
        completed_count=completed_count,
        completed_amount=f"{completed_amount:.2f} PLN",
        refunded_count=refunded_count,
        refunded_amount=f"{refunded_amount:.2f} PLN",
        average_amount=f"{average_amount:.2f} PLN",
        by_status=by_status,
        by_type=by_type,
    )


@router.get("/stats/registrations", response_model=RegistrationStatsResponse)
async def get_registration_stats(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user_dependency),
    month: str | None = Query(default=None, description="Month in YYYY-MM format"),
) -> RegistrationStatsResponse:
    """
    Return registration volume summaries for a selected month or all time.

    When a month is provided, it is validated as YYYY-MM and used to filter by
    occurrence date. The response aggregates counts by status and highlights the
    top events by confirmed registrations.
    """
    if month:
        try:
            parsed = datetime.strptime(month, "%Y-%m")
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid month format") from exc

        month_start = datetime(parsed.year, parsed.month, 1).date()
        last_day = calendar.monthrange(parsed.year, parsed.month)[1]
        month_end = datetime(parsed.year, parsed.month, last_day).date()
        date_filter = (Registration.occurrence_date >= month_start, Registration.occurrence_date <= month_end)
    else:
        date_filter = ()

    totals_result = await db.execute(
        select(
            func.count(Registration.id),
            func.count(func.distinct(Registration.user_id)),
            func.count(func.distinct(Registration.event_id)),
        ).where(*date_filter)
    )
    total_count, unique_users, unique_events = totals_result.one()
    total_count = int(total_count or 0)
    unique_users = int(unique_users or 0)
    unique_events = int(unique_events or 0)

    status_counts_result = await db.execute(
        select(Registration.status, func.count(Registration.id))
        .where(*date_filter)
        .group_by(Registration.status)
    )
    status_counts = {row[0]: int(row[1]) for row in status_counts_result.all()}

    confirmed_count = status_counts.get(RegistrationStatus.CONFIRMED.value, 0)
    pending_count = (
        status_counts.get(RegistrationStatus.PENDING.value, 0)
        + status_counts.get(RegistrationStatus.MANUAL_PAYMENT_REQUIRED.value, 0)
        + status_counts.get(RegistrationStatus.MANUAL_PAYMENT_VERIFICATION.value, 0)
    )
    cancelled_count = status_counts.get(RegistrationStatus.CANCELLED.value, 0)
    refunded_count = status_counts.get(RegistrationStatus.REFUNDED.value, 0)

    by_status = [
        RegistrationStatusStats(status=str(status), count=count)
        for status, count in status_counts.items()
    ]

    top_events_result = await db.execute(
        select(
            Event.id,
            Event.title,
            Event.city,
            Event.max_participants,
            func.count(Registration.id),
        )
        .join(Registration, Registration.event_id == Event.id)
        .where(
            *date_filter,
            Registration.status == RegistrationStatus.CONFIRMED.value,
        )
        .group_by(Event.id, Event.title, Event.city, Event.max_participants)
        .order_by(func.count(Registration.id).desc())
        .limit(5)
    )

    top_events = []
    for row in top_events_result.all():
        event_id, title, city, max_participants, confirmed = row
        fill_percent = None
        if max_participants:
            fill = (confirmed / max_participants) * 100
            fill_percent = f"{fill:.0f}%"
        top_events.append(
            RegistrationTopEvent(
                event_id=str(event_id),
                title=title,
                city=city,
                confirmed_count=int(confirmed),
                max_participants=max_participants,
                fill_percent=fill_percent,
            )
        )

    return RegistrationStatsResponse(
        total_count=total_count,
        confirmed_count=confirmed_count,
        pending_count=pending_count,
        cancelled_count=cancelled_count,
        refunded_count=refunded_count,
        unique_users=unique_users,
        unique_events=unique_events,
        by_status=by_status,
        top_events=top_events,
    )


@router.get("/users/pending", response_model=list[PendingUserResponse])
async def get_pending_users(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user_dependency),
) -> list[PendingUserResponse]:
    """
    Return the list of users awaiting approval.

    The query pulls users in pending status who have submitted approval requests
    and orders them by creation date for the admin review queue.
    """

    from models.user_profile import UserProfile
    users_result = await db.execute(
        select(User)
        .join(ApprovalRequest, ApprovalRequest.user_id == User.id)
        .outerjoin(UserProfile, UserProfile.user_id == User.id)
        .options(
            joinedload(User.approval_request),
            joinedload(User.profile),
        )
        .where(
            User.account_status == AccountStatus.PENDING.value,
        )
        .order_by(User.created_at.desc())
    )
    users = list(users_result.unique().scalars().all())

    def _parse_tags(raw: str | None) -> list[str]:
        if not raw:
            return []
        import json as _json
        try:
            parsed = _json.loads(raw)
        except Exception:
            return []
        return [str(t) for t in parsed] if isinstance(parsed, list) else []

    return [
        PendingUserResponse(
            user_id=str(u.id),
            full_name=u.full_name,
            email=u.email,
            picture_url=u.picture_url,
            about_me=u.profile.about_me if u.profile else None,
            interest_tags=_parse_tags(u.profile.interest_tags if u.profile else None),
            phone_country_code=u.approval_request.phone_country_code if u.approval_request else None,
            phone_number=u.approval_request.phone_number if u.approval_request else None,
            admin_message=u.approval_request.admin_message if u.approval_request else None,
            created_at=u.created_at.isoformat() if u.created_at else None,
            account_status=u.account_status.value,
        )
        for u in users
    ]


@router.post("/users/{user_id}/approve", response_model=PendingUserResponse)
async def approve_user(
    user_id: str = Path(..., min_length=1),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user_dependency),
) -> PendingUserResponse:
    """
    Approve a pending user account after validation checks.

    The handler verifies the user exists, ensures a join request is present when
    required, and transitions the account status to active before returning the
    updated approval payload.
    """

    result = await db.execute(
        select(User)
        .options(joinedload(User.profile), joinedload(User.approval_request))
        .where(legacy_id_eq(User.id, user_id))
    )
    target = result.unique().scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.account_status == AccountStatus.PENDING:
        if target.approval_request is None:
            raise HTTPException(status_code=409, detail="User has not submitted join request")

    if target.account_status != AccountStatus.ACTIVE:
        target.account_status = AccountStatus.ACTIVE
        db.add(target)
        await db.commit()
        # Re-fetch with eager loads – refresh alone won't restore relationships.
        result = await db.execute(
            select(User)
            .options(joinedload(User.profile), joinedload(User.approval_request))
            .where(User.id == target.id)
        )
        target = result.unique().scalar_one_or_none()

    import json as _json
    def _tags(raw):
        if not raw:
            return []
        try:
            parsed = _json.loads(raw)
        except Exception:
            return []
        return [str(t) for t in parsed] if isinstance(parsed, list) else []

    return PendingUserResponse(
        user_id=str(target.id),
        full_name=target.full_name,
        email=target.email,
        picture_url=target.picture_url,
        about_me=target.profile.about_me if target.profile else None,
        interest_tags=_tags(target.profile.interest_tags if target.profile else None),
        phone_country_code=target.approval_request.phone_country_code if target.approval_request else None,
        phone_number=target.approval_request.phone_number if target.approval_request else None,
        admin_message=target.approval_request.admin_message if target.approval_request else None,
        created_at=target.created_at.isoformat() if target.created_at else None,
        account_status=target.account_status.value,
    )



def _serialize_manual_pending_row(
    registration: Registration,
    user: User,
    event: Event,
    payment: Payment | None,
) -> ManualPaymentPendingResponse:
    amount = Decimal(payment.amount) if payment and payment.amount is not None else Decimal("0")
    return ManualPaymentPendingResponse(
        registration_id=str(registration.id),
        event_id=str(event.id),
        event_title=event.title,
        occurrence_date=registration.occurrence_date.isoformat(),
        user_id=str(user.id),
        user_name=user.full_name,
        user_email=user.email,
        amount=f"{amount:.2f}",
        currency=payment.currency if payment else Currency.PLN.value,
        status=registration.status,
        transfer_reference=_extract_transfer_reference(payment, str(event.id)),
        manual_payment_confirmed_at=(
            registration.manual_payment_confirmed_at.isoformat()
            if registration.manual_payment_confirmed_at
            else None
        ),
        promoted_from_waitlist=bool(registration.promoted_from_waitlist_at),
        payment_deadline=(
            registration.manual_payment_due_at.isoformat()
            if registration.manual_payment_due_at
            else None
        ),
        payment_id=optional_str_id(registration.payment_id),
    )


def _serialize_refund_task_row(
    task: RegistrationRefundTask,
    registration: Registration,
    user: User,
    event: Event,
) -> RefundTaskResponse:
    return RefundTaskResponse(
        task_id=str(task.id),
        registration_id=str(registration.id),
        event_id=str(event.id),
        event_title=event.title,
        occurrence_date=registration.occurrence_date.isoformat(),
        user_id=str(user.id),
        user_name=user.full_name,
        user_email=user.email,
        refund_eligible=bool(task.refund_eligible),
        recommended_should_refund=bool(task.recommended_should_refund),
        recommendation_code=_compute_recommendation_code(task),
        should_refund=bool(task.should_refund),
        refund_marked_paid=bool(task.refund_marked_paid),
        is_resolved=bool(task.refund_marked_paid) or (bool(task.reviewed_by_admin_id) and not bool(task.should_refund)),
        override_reason=task.override_reason,
        reviewed_at=task.reviewed_at.isoformat() if task.reviewed_at else None,
        reviewed_by_admin_id=optional_str_id(task.reviewed_by_admin_id),
        payment_id=optional_str_id(registration.payment_id),
    )


def _serialize_waitlist_promotion_row(
    registration: Registration,
    user: User,
    event: Event,
) -> WaitlistPromotionResponse:
    return WaitlistPromotionResponse(
        registration_id=str(registration.id),
        event_id=str(event.id),
        event_title=event.title,
        occurrence_date=registration.occurrence_date.isoformat(),
        user_id=str(user.id),
        user_name=user.full_name,
        user_email=user.email,
        promoted_from_waitlist_at=registration.promoted_from_waitlist_at.isoformat(),
        payment_deadline=(
            registration.manual_payment_due_at.isoformat()
            if registration.manual_payment_due_at
            else None
        ),
        status=registration.status,
        waitlist_notification_sent=bool(registration.waitlist_notification_sent),
        waitlist_notified_at=(
            registration.waitlist_notified_at.isoformat()
            if registration.waitlist_notified_at
            else None
        ),
    )


@router.get("/manual-payments/pending", response_model=list[ManualPaymentPendingResponse])
async def list_pending_manual_payments(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user_dependency),
) -> list[ManualPaymentPendingResponse]:
    """
    Return registrations awaiting manual payment verification.

    The query joins registrations, users, events, and payments to present the
    admin queue in chronological order of manual payment confirmations.
    """
    rows = await db.execute(
        select(Registration, User, Event, Payment)
        .join(User, Registration.user_id == User.id)
        .join(Event, Registration.event_id == Event.id)
        .outerjoin(Payment, Payment.external_id == Registration.payment_id)
        .where(Registration.status == RegistrationStatus.MANUAL_PAYMENT_VERIFICATION.value)
        .order_by(
            Registration.manual_payment_confirmed_at.asc(),
            Registration.created_at.asc(),
        )
    )
    return [
        _serialize_manual_pending_row(registration, user, event, payment)
        for registration, user, event, payment in rows.all()
    ]


@router.post(
    "/manual-payments/{registration_id}/approve",
    response_model=ManualPaymentPendingResponse,
)
async def approve_pending_manual_payment(
    registration_id: str = Path(..., min_length=1),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user_dependency),
) -> ManualPaymentPendingResponse:
    """
    Approve a pending manual payment and confirm the registration.

    This delegates to the registration service, maps domain errors to HTTP codes,
    and returns the refreshed manual payment row for the admin queue.
    """
    payment_service = PaymentService(db, get_shared_fake_payment_adapter())
    registration_service = RegistrationService(db, payment_service)
    try:
        approved = await registration_service.approve_manual_payment(registration_id)
    except RegistrationError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    if not approved:
        raise HTTPException(status_code=404, detail="Registration not found")

    row = await db.execute(
        select(Registration, User, Event, Payment)
        .join(User, Registration.user_id == User.id)
        .join(Event, Registration.event_id == Event.id)
        .outerjoin(Payment, Payment.external_id == Registration.payment_id)
        .where(legacy_id_eq(Registration.id, approved.id))
        .limit(1)
    )
    result = row.first()
    if not result:
        raise HTTPException(status_code=404, detail="Registration not found")
    registration, user, event, payment = result
    return _serialize_manual_pending_row(registration, user, event, payment)


@router.get("/manual-payments/refunds", response_model=list[RefundTaskResponse])
async def list_refund_tasks(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user_dependency),
) -> list[RefundTaskResponse]:
    """
    Return refund tasks awaiting admin decision or payout confirmation.

    Tasks are ordered by creation time so the most recent refund requests appear
    first in the admin workflow.
    """
    rows = await db.execute(
        select(RegistrationRefundTask, Registration, User, Event)
        .join(Registration, RegistrationRefundTask.registration_id == Registration.id)
        .join(User, Registration.user_id == User.id)
        .join(Event, Registration.event_id == Event.id)
        .order_by(RegistrationRefundTask.created_at.desc(), RegistrationRefundTask.id.desc())
    )
    return [
        _serialize_refund_task_row(task, registration, user, event)
        for task, registration, user, event in rows.all()
    ]


@router.patch("/manual-payments/refunds/{task_id}", response_model=RefundTaskResponse)
async def update_refund_task(
    payload: RefundTaskUpdateRequest,
    task_id: str = Path(..., min_length=1),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user_dependency),
) -> RefundTaskResponse:
    """
    Update refund decision fields and optionally mark payout completion.

    The handler enforces override justification when deviating from the system
    recommendation, applies manual payment refunds when required, and records
    the admin review metadata before returning the updated task.
    """
    row = await db.execute(
        select(RegistrationRefundTask, Registration, User, Event)
        .join(Registration, RegistrationRefundTask.registration_id == Registration.id)
        .join(User, Registration.user_id == User.id)
        .join(Event, Registration.event_id == Event.id)
        .where(RegistrationRefundTask.id == task_id)
        .limit(1)
    )
    result = row.first()
    if not result:
        raise HTTPException(status_code=404, detail="Refund task not found")
    task, registration, user, event = result

    next_should_refund = task.should_refund if payload.should_refund is None else payload.should_refund
    override_reason = (payload.override_reason or "").strip() if payload.override_reason is not None else None
    if payload.should_refund is not None and payload.should_refund != task.recommended_should_refund:
        if not override_reason or len(override_reason) < 8:
            raise HTTPException(
                status_code=422,
                detail="override_reason (min 8 chars) is required when overriding refund recommendation",
            )
        task.override_reason = override_reason
    elif payload.override_reason is not None:
        task.override_reason = override_reason or None

    task.should_refund = next_should_refund

    if payload.refund_marked_paid is not None:
        if payload.refund_marked_paid and not task.should_refund:
            raise HTTPException(status_code=422, detail="Cannot mark refund as paid when should_refund is false")
        task.refund_marked_paid = payload.refund_marked_paid
        if payload.refund_marked_paid and registration.payment_id:
            payment_service = PaymentService(db, get_shared_fake_payment_adapter())
            await payment_service.mark_manual_event_payment_refunded(registration.payment_id)
            if registration.status == RegistrationStatus.CANCELLED.value:
                registration.status = RegistrationStatus.REFUNDED.value
                db.add(registration)

    task.reviewed_at = datetime.utcnow()
    task.reviewed_by_admin_id = admin.id

    db.add(task)
    await db.commit()
    await db.refresh(task)
    await db.refresh(registration)
    return _serialize_refund_task_row(task, registration, user, event)


@router.get("/manual-payments/promotions", response_model=list[WaitlistPromotionResponse])
async def list_waitlist_promotions(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user_dependency),
) -> list[WaitlistPromotionResponse]:
    """
    Return waitlist promotions that require notification tracking.

    The response includes promoted registrations tied to manual payment events
    so admins can monitor messaging and confirmation deadlines.
    """
    rows = await db.execute(
        select(Registration, User, Event)
        .join(User, Registration.user_id == User.id)
        .join(Event, Registration.event_id == Event.id)
        .where(
            Registration.promoted_from_waitlist_at.is_not(None),
            Event.manual_payment_verification.is_(True),
        )
        .order_by(Registration.promoted_from_waitlist_at.desc(), Registration.id.desc())
    )
    return [
        _serialize_waitlist_promotion_row(registration, user, event)
        for registration, user, event in rows.all()
    ]


@router.patch(
    "/manual-payments/promotions/{registration_id}",
    response_model=WaitlistPromotionResponse,
)
async def update_waitlist_promotion_status(
    payload: WaitlistPromotionUpdateRequest,
    registration_id: str = Path(..., min_length=1),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user_dependency),
) -> WaitlistPromotionResponse:
    """
    Update notification status for a waitlist promotion entry.

    This endpoint validates the promotion exists, toggles notification fields,
    and returns the refreshed promotion row for the admin dashboard.
    """
    row = await db.execute(
        select(Registration, User, Event)
        .join(User, Registration.user_id == User.id)
        .join(Event, Registration.event_id == Event.id)
        .where(
            legacy_id_eq(Registration.id, registration_id),
            Registration.promoted_from_waitlist_at.is_not(None),
            Event.manual_payment_verification.is_(True),
        )
        .limit(1)
    )
    result = row.first()
    if not result:
        raise HTTPException(status_code=404, detail="Promotion entry not found")
    registration, user, event = result

    registration.waitlist_notification_sent = payload.waitlist_notification_sent
    registration.waitlist_notified_at = datetime.utcnow() if payload.waitlist_notification_sent else None
    db.add(registration)
    await db.commit()
    await db.refresh(registration)
    return _serialize_waitlist_promotion_row(registration, user, event)


# ── Admin subscription purchase management ────────────────────────────

def _serialize_subscription_purchase_pending_row(
    purchase: SubscriptionPurchase,
    user: User,
) -> SubscriptionPurchasePendingResponse:
    """
    Map a subscription purchase and its owner to the admin response schema.

    The serializer mirrors the event manual payment row formatter for UI
    consistency across admin tabs.
    """
    plan = PaymentService.get_subscription_plan(purchase.plan_code)
    plan_label = plan.code if plan else purchase.plan_code
    return SubscriptionPurchasePendingResponse(
        purchase_id=str(purchase.id),
        plan_code=purchase.plan_code,
        plan_label=plan_label,
        periods=purchase.periods,
        total_amount=f"{Decimal(purchase.total_amount):.2f}",
        currency=purchase.currency,
        status=purchase.status,
        user_id=str(user.id),
        user_name=user.full_name,
        user_email=user.email,
        manual_payment_confirmed_at=(
            purchase.manual_payment_confirmed_at.isoformat()
            if purchase.manual_payment_confirmed_at
            else None
        ),
        created_at=(
            purchase.created_at.isoformat()
            if purchase.created_at
            else None
        ),
        payment_id=purchase.payment_id,
    )


@router.get(
    "/subscription-purchases/pending",
    response_model=list[SubscriptionPurchasePendingResponse],
)
async def list_pending_subscription_purchases(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user_dependency),
) -> list[SubscriptionPurchasePendingResponse]:
    """
    Return subscription purchases awaiting manual payment verification.

    The query joins purchases with users and returns rows ordered by
    confirmation timestamp for the admin approval queue.
    """
    rows = await db.execute(
        select(SubscriptionPurchase, User)
        .join(User, SubscriptionPurchase.user_id == User.id)
        .where(
            SubscriptionPurchase.status == SubscriptionPurchaseStatus.MANUAL_PAYMENT_VERIFICATION.value
        )
        .order_by(
            SubscriptionPurchase.manual_payment_confirmed_at.asc(),
            SubscriptionPurchase.created_at.asc(),
        )
    )
    return [
        _serialize_subscription_purchase_pending_row(purchase, user)
        for purchase, user in rows.all()
    ]


@router.post(
    "/subscription-purchases/{purchase_id}/approve",
    response_model=SubscriptionPurchasePendingResponse,
)
async def approve_subscription_purchase(
    purchase_id: str = Path(..., min_length=1),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user_dependency),
) -> SubscriptionPurchasePendingResponse:
    """
    Approve a pending subscription purchase and activate the subscription.

    This delegates to the payment service, maps domain errors to HTTP codes,
    and returns the refreshed purchase row for the admin queue.
    """
    payment_service = PaymentService(db, get_shared_fake_payment_adapter())
    try:
        purchase = await payment_service.approve_subscription_manual_payment(purchase_id)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found")

    row = await db.execute(
        select(SubscriptionPurchase, User)
        .join(User, SubscriptionPurchase.user_id == User.id)
        .where(legacy_id_eq(SubscriptionPurchase.id, purchase.id))
        .limit(1)
    )
    result = row.first()
    if not result:
        raise HTTPException(status_code=404, detail="Purchase not found")
    return _serialize_subscription_purchase_pending_row(*result)


# ---------------------------------------------------------------------------
# Balance / Financial Statement
# ---------------------------------------------------------------------------


class BalanceMonthRow(BaseModel):
    """Monthly breakdown used in the balance sheet."""

    month: str = Field(description="Month in YYYY-MM format.")
    income_event: str = Field(description="Completed event payment revenue.")
    income_subscription: str = Field(description="Completed subscription payment revenue.")
    income_total: str = Field(description="Total income (events + subscriptions).")
    refunds: str = Field(description="Total refunded amount (positive value).")
    net: str = Field(description="Net = income_total − refunds.")
    tx_count: int = Field(description="Number of completed transactions.")
    refund_count: int = Field(description="Number of refunded transactions.")


class BalanceEventRow(BaseModel):
    """Per-event revenue in the selected period."""

    event_id: str = Field(description="Event identifier.")
    title: str = Field(description="Event title.")
    start_date: str = Field(description="Event start date YYYY-MM-DD.")
    city: str = Field(description="City.")
    income: str = Field(description="Completed revenue for this event.")
    refunds: str = Field(description="Refunded amount for this event.")
    net: str = Field(description="Net revenue.")
    tx_count: int = Field(description="Completed transaction count.")
    refund_count: int = Field(description="Refunded transaction count.")


class BalanceSubscriptionRow(BaseModel):
    """Per-plan subscription revenue in the selected period."""

    plan_code: str = Field(description="Subscription plan code.")
    income: str = Field(description="Completed subscription revenue.")
    refunds: str = Field(description="Refunded subscription amount.")
    net: str = Field(description="Net subscription revenue.")
    tx_count: int = Field(description="Completed transaction count.")
    refund_count: int = Field(description="Refunded transaction count.")


class BalancePendingRow(BaseModel):
    """Summary of still-pending amounts."""

    pending_event: str = Field(description="Pending event payment amounts.")
    pending_subscription: str = Field(description="Pending subscription payment amounts.")
    pending_total: str = Field(description="Total pending amounts.")
    pending_event_count: int = Field(description="Pending event payment count.")
    pending_subscription_count: int = Field(description="Pending subscription payment count.")


class BalanceResponse(BaseModel):
    """
    Comprehensive financial balance sheet for admin reporting.

    Aggregates income, refunds, and net across months, events, and subscription
    plans for the selected period.
    """

    period_label: str = Field(description="Human-readable period label.")
    date_from: str = Field(description="Period start date YYYY-MM-DD.")
    date_to: str = Field(description="Period end date YYYY-MM-DD.")

    total_income: str = Field(description="Total completed revenue.")
    total_income_event: str = Field(description="Revenue from events.")
    total_income_subscription: str = Field(description="Revenue from subscriptions.")
    total_refunds: str = Field(description="Total refunded amount.")
    total_net: str = Field(description="Net = total_income − total_refunds.")
    total_tx_count: int = Field(description="Total completed transaction count.")
    total_refund_count: int = Field(description="Total refund count.")

    months: list[BalanceMonthRow] = Field(description="Monthly breakdown rows.")
    events: list[BalanceEventRow] = Field(description="Per-event breakdown rows.")
    subscriptions: list[BalanceSubscriptionRow] = Field(description="Per-plan breakdown rows.")
    pending: BalancePendingRow = Field(description="Pending payment summary.")


def _fmt(amount: Decimal) -> str:
    """Format a Decimal amount as 'X.XX PLN'."""
    return f"{amount:.2f} PLN"


def _parse_period(period: str) -> tuple[datetime, datetime, str]:
    """
    Parse a period string and return (start, end, label).

    Supported formats:
      - YYYY-MM       → single month
      - YYYY-QN       → quarter (N = 1..4)
      - YYYY          → full year
    """
    import re

    m_month = re.match(r"^(\d{4})-(\d{2})$", period)
    if m_month:
        year, month = int(m_month.group(1)), int(m_month.group(2))
        if month < 1 or month > 12:
            raise ValueError("Invalid month")
        last_day = calendar.monthrange(year, month)[1]
        start = datetime(year, month, 1)
        end = datetime(year, month, last_day, 23, 59, 59, 999999)
        label = f"{year}-{month:02d}"
        return start, end, label

    m_quarter = re.match(r"^(\d{4})-Q(\d)$", period, re.IGNORECASE)
    if m_quarter:
        year, q = int(m_quarter.group(1)), int(m_quarter.group(2))
        if q < 1 or q > 4:
            raise ValueError("Invalid quarter")
        q_start_month = (q - 1) * 3 + 1
        q_end_month = q_start_month + 2
        last_day = calendar.monthrange(year, q_end_month)[1]
        start = datetime(year, q_start_month, 1)
        end = datetime(year, q_end_month, last_day, 23, 59, 59, 999999)
        label = f"{year} Q{q}"
        return start, end, label

    m_year = re.match(r"^(\d{4})$", period)
    if m_year:
        year = int(m_year.group(1))
        start = datetime(year, 1, 1)
        end = datetime(year, 12, 31, 23, 59, 59, 999999)
        label = str(year)
        return start, end, label

    raise ValueError("Invalid period format. Use YYYY-MM, YYYY-QN, or YYYY.")


@router.get("/balance", response_model=BalanceResponse)
async def get_balance(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user_dependency),
    period: str | None = Query(
        default=None,
        description="Period: YYYY-MM (month), YYYY-QN (quarter), or YYYY (year). Defaults to current month.",
    ),
) -> BalanceResponse:
    """
    Return a comprehensive financial balance sheet for admin reporting.

    Aggregates completed payments (income), refunds, and net amounts with
    monthly, per-event, and per-subscription-plan breakdowns for the selected
    period.
    """
    import re as _re  # noqa: F811 - local import to avoid top-level clash

    now = datetime.utcnow()
    if not period:
        period = f"{now.year}-{now.month:02d}"

    try:
        date_from, date_to, period_label = _parse_period(period)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    time_filter = (Payment.created_at >= date_from, Payment.created_at <= date_to)

    # ---- Aggregate totals ----
    totals_q = await db.execute(
        select(
            Payment.payment_type,
            Payment.status,
            func.count(Payment.id),
            func.coalesce(func.sum(Payment.amount), 0),
        )
        .where(*time_filter)
        .group_by(Payment.payment_type, Payment.status)
    )
    income_event = Decimal("0")
    income_sub = Decimal("0")
    refund_event = Decimal("0")
    refund_sub = Decimal("0")
    tx_count = 0
    refund_count = 0
    for ptype, status, cnt, total in totals_q.all():
        cnt = int(cnt)
        total = Decimal(str(total))
        if status == DBPaymentStatus.COMPLETED.value:
            if ptype == "event":
                income_event += total
            else:
                income_sub += total
            tx_count += cnt
        elif status == DBPaymentStatus.REFUNDED.value:
            if ptype == "event":
                refund_event += total
            else:
                refund_sub += total
            refund_count += cnt

    total_income = income_event + income_sub
    total_refunds = refund_event + refund_sub
    total_net = total_income - total_refunds

    # ---- Monthly breakdown ----
    month_q = await db.execute(
        select(
            func.to_char(Payment.created_at, "YYYY-MM").label("month"),
            Payment.payment_type,
            Payment.status,
            func.count(Payment.id),
            func.coalesce(func.sum(Payment.amount), 0),
        )
        .where(*time_filter)
        .group_by("month", Payment.payment_type, Payment.status)
        .order_by("month")
    )
    month_data: dict[str, dict] = {}
    for month_str, ptype, status, cnt, total in month_q.all():
        if month_str not in month_data:
            month_data[month_str] = {
                "income_event": Decimal("0"),
                "income_sub": Decimal("0"),
                "refunds": Decimal("0"),
                "tx_count": 0,
                "refund_count": 0,
            }
        d = month_data[month_str]
        cnt = int(cnt)
        total = Decimal(str(total))
        if status == DBPaymentStatus.COMPLETED.value:
            if ptype == "event":
                d["income_event"] += total
            else:
                d["income_sub"] += total
            d["tx_count"] += cnt
        elif status == DBPaymentStatus.REFUNDED.value:
            d["refunds"] += total
            d["refund_count"] += cnt

    months = []
    for m, d in sorted(month_data.items()):
        inc_total = d["income_event"] + d["income_sub"]
        months.append(
            BalanceMonthRow(
                month=m,
                income_event=_fmt(d["income_event"]),
                income_subscription=_fmt(d["income_sub"]),
                income_total=_fmt(inc_total),
                refunds=_fmt(d["refunds"]),
                net=_fmt(inc_total - d["refunds"]),
                tx_count=d["tx_count"],
                refund_count=d["refund_count"],
            )
        )

    # ---- Per-event breakdown ----
    event_q = await db.execute(
        select(
            Registration.event_id,
            Event.title,
            Event.start_date,
            Event.city,
            Payment.status,
            func.count(Payment.id),
            func.coalesce(func.sum(Payment.amount), 0),
        )
        .join(Registration, Payment.external_id == Registration.payment_id)
        .join(Event, Registration.event_id == Event.id)
        .where(
            *time_filter,
            Payment.payment_type == "event",
        )
        .group_by(
            Registration.event_id,
            Event.title,
            Event.start_date,
            Event.city,
            Payment.status,
        )
    )
    event_data: dict[str, dict] = {}
    for eid, title, start_date, city, status, cnt, total in event_q.all():
        if eid not in event_data:
            event_data[eid] = {
                "title": title,
                "start_date": start_date,
                "city": city or "",
                "income": Decimal("0"),
                "refunds": Decimal("0"),
                "tx_count": 0,
                "refund_count": 0,
            }
        d = event_data[eid]
        cnt = int(cnt)
        total = Decimal(str(total))
        if status == DBPaymentStatus.COMPLETED.value:
            d["income"] += total
            d["tx_count"] += cnt
        elif status == DBPaymentStatus.REFUNDED.value:
            d["refunds"] += total
            d["refund_count"] += cnt

    events = sorted(
        [
            BalanceEventRow(
                event_id=eid,
                title=d["title"],
                start_date=d["start_date"].strftime("%Y-%m-%d") if d["start_date"] else "",
                city=d["city"],
                income=_fmt(d["income"]),
                refunds=_fmt(d["refunds"]),
                net=_fmt(d["income"] - d["refunds"]),
                tx_count=d["tx_count"],
                refund_count=d["refund_count"],
            )
            for eid, d in event_data.items()
        ],
        key=lambda r: Decimal(r.income.split(" ")[0]),
        reverse=True,
    )

    # ---- Per-subscription-plan breakdown ----
    sub_q = await db.execute(
        select(
            Payment.description,
            Payment.extra_data,
            Payment.status,
            func.count(Payment.id),
            func.coalesce(func.sum(Payment.amount), 0),
        )
        .where(
            *time_filter,
            Payment.payment_type == "subscription",
        )
        .group_by(Payment.description, Payment.extra_data, Payment.status)
    )
    sub_data: dict[str, dict] = {}
    for desc, extra, status, cnt, total in sub_q.all():
        plan_code = "unknown"
        if extra:
            try:
                parsed = json.loads(extra)
                if isinstance(parsed, dict):
                    plan_code = str(parsed.get("plan_code", "unknown"))
            except (TypeError, json.JSONDecodeError):
                pass
        if plan_code not in sub_data:
            sub_data[plan_code] = {
                "income": Decimal("0"),
                "refunds": Decimal("0"),
                "tx_count": 0,
                "refund_count": 0,
            }
        d = sub_data[plan_code]
        cnt = int(cnt)
        total = Decimal(str(total))
        if status == DBPaymentStatus.COMPLETED.value:
            d["income"] += total
            d["tx_count"] += cnt
        elif status == DBPaymentStatus.REFUNDED.value:
            d["refunds"] += total
            d["refund_count"] += cnt

    subscriptions = [
        BalanceSubscriptionRow(
            plan_code=pc,
            income=_fmt(d["income"]),
            refunds=_fmt(d["refunds"]),
            net=_fmt(d["income"] - d["refunds"]),
            tx_count=d["tx_count"],
            refund_count=d["refund_count"],
        )
        for pc, d in sorted(sub_data.items())
    ]

    # ---- Pending payments ----
    pending_q = await db.execute(
        select(
            Payment.payment_type,
            func.count(Payment.id),
            func.coalesce(func.sum(Payment.amount), 0),
        )
        .where(
            *time_filter,
            Payment.status.in_([
                DBPaymentStatus.PENDING.value,
                DBPaymentStatus.PROCESSING.value,
            ]),
        )
        .group_by(Payment.payment_type)
    )
    pending_event = Decimal("0")
    pending_sub = Decimal("0")
    pending_event_count = 0
    pending_sub_count = 0
    for ptype, cnt, total in pending_q.all():
        cnt = int(cnt)
        total = Decimal(str(total))
        if ptype == "event":
            pending_event += total
            pending_event_count += cnt
        else:
            pending_sub += total
            pending_sub_count += cnt

    pending = BalancePendingRow(
        pending_event=_fmt(pending_event),
        pending_subscription=_fmt(pending_sub),
        pending_total=_fmt(pending_event + pending_sub),
        pending_event_count=pending_event_count,
        pending_subscription_count=pending_sub_count,
    )

    return BalanceResponse(
        period_label=period_label,
        date_from=date_from.strftime("%Y-%m-%d"),
        date_to=date_to.strftime("%Y-%m-%d"),
        total_income=_fmt(total_income),
        total_income_event=_fmt(income_event),
        total_income_subscription=_fmt(income_sub),
        total_refunds=_fmt(total_refunds),
        total_net=_fmt(total_net),
        total_tx_count=tx_count,
        total_refund_count=refund_count,
        months=months,
        events=events,
        subscriptions=subscriptions,
        pending=pending,
    )


# ---------------------------------------------------------------------------
# Admin promotion
# ---------------------------------------------------------------------------

class PromoteToAdminRequest(BaseModel):
    email: str = Field(..., description="Email of the user to promote to admin.")


class PromoteToAdminResponse(BaseModel):
    id: str
    email: str
    full_name: str | None
    role: str
    message: str


@router.post(
    "/promote-admin",
    response_model=PromoteToAdminResponse,
    summary="Promote an existing user to admin role",
)
async def promote_user_to_admin(
    body: PromoteToAdminRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user_dependency),
):
    """
    Promote an existing active user to admin by email.

    Only authenticated admins can call this endpoint. The target user must
    already exist and have an active account. Users who are already admins
    are rejected to prevent confusion.
    """
    normalized_email = body.email.strip().lower()
    if not normalized_email:
        raise HTTPException(status_code=400, detail="Email is required.")

    result = await db.execute(
        select(User).where(func.lower(User.email) == normalized_email)
    )
    target_user = result.scalars().first()

    if not target_user:
        raise HTTPException(
            status_code=404,
            detail="Nie znaleziono użytkownika o podanym adresie email.",
        )

    if target_user.account_status != AccountStatus.ACTIVE:
        raise HTTPException(
            status_code=400,
            detail="Użytkownik musi mieć aktywne konto, aby zostać adminem.",
        )

    if target_user.role == UserRole.ADMIN:
        raise HTTPException(
            status_code=400,
            detail="Ten użytkownik jest już adminem.",
        )

    target_user.role = UserRole.ADMIN
    await db.commit()
    await db.refresh(target_user)

    return PromoteToAdminResponse(
        id=target_user.id,
        email=target_user.email,
        full_name=target_user.full_name,
        role=target_user.role.value,
        message=f"Użytkownik {target_user.email} został adminem.",
    )
