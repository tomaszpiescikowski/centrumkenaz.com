from fastapi import APIRouter, Depends, HTTPException, Query, Path
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import AnyHttpUrl, BaseModel, ConfigDict, Field
from typing import Literal
from datetime import datetime, timedelta, date
from decimal import Decimal

from database import get_db
from models.event import Event
from models.user import User
from models.registration import Registration, RegistrationStatus
from services.registration_service import (
    RegistrationService,
    RegistrationError,
    EventFullError,
    AlreadyRegisteredError,
    EventNotFoundError,
    AccountNotApprovedError,
)
from services.payment_service import PaymentService
from adapters.fake_payment_adapter import get_shared_fake_payment_adapter
from security.guards import get_active_user_dependency, get_admin_user_dependency
from utils.legacy_ids import legacy_id_eq

router = APIRouter(prefix="/events", tags=["events"])
MAX_EVENTS_PER_DAY = 4
DEFAULT_MANUAL_PAYMENT_URL = "https://payments.example/manual-transfer"


class EventResponse(BaseModel):
    """
    Represent a single event with pricing and policy details.

    This response mirrors the event model with display-ready fields for the
    frontend, including pricing tiers and cancellation settings.
    """
    model_config = ConfigDict(from_attributes=True, coerce_numbers_to_str=True)

    id: str = Field(description="Event identifier.")
    title: str = Field(description="Event title.")
    description: str | None = Field(default=None, description="Event description.")
    event_type: str = Field(description="Event category tag.")
    start_date: datetime = Field(description="Start datetime.")
    end_date: datetime | None = Field(default=None, description="End datetime if provided.")
    time_info: str | None = Field(default=None, description="Free-form time label.")

    city: str = Field(description="City name.")
    location: str | None = Field(default=None, description="Optional venue/location string.")
    show_map: bool = Field(default=True, description="Whether to show map in UI.")
    price_guest: Decimal = Field(description="Price for non-subscribers.")
    price_member: Decimal = Field(description="Price for subscribers.")
    manual_payment_verification: bool = Field(
        default=True,
        description="Whether manual payment verification is enabled.",
    )
    manual_payment_url: str | None = Field(
        default=None,
        description="Transfer instructions URL for manual payments.",
    )
    manual_payment_due_hours: int = Field(description="Hours allowed to confirm manual payment.")
    max_participants: int | None = Field(default=None, description="Capacity limit if configured.")
    requires_subscription: bool = Field(description="Whether subscription is required to register.")
    cancel_cutoff_hours: int = Field(description="Cancellation cutoff in hours.")
    points_value: int = Field(description="Points awarded for attendance.")

class EventAvailabilityResponse(BaseModel):
    """
    Describe availability for a specific event occurrence.

    This response reports capacity, confirmed counts, and whether a user can
    still register for the occurrence.
    """
    model_config = ConfigDict(coerce_numbers_to_str=True)

    event_id: str = Field(description="Event identifier.")
    occurrence_date: str = Field(description="Occurrence date in YYYY-MM-DD.")
    max_participants: int | None = Field(default=None, description="Capacity limit if configured.")
    confirmed_count: int = Field(description="Number of confirmed registrations.")
    waitlist_count: int = Field(description="Number of waitlisted registrations.")
    available_spots: int | None = Field(default=None, description="Remaining spots if limited.")
    is_available: bool = Field(description="Whether registration is currently available.")


class ParticipantResponse(BaseModel):
    """
    Describe a participant shown in event participant lists.

    This response exposes participant names and membership status for admins
    or event attendees.
    """
    model_config = ConfigDict(coerce_numbers_to_str=True)

    id: str = Field(description="Registration identifier.")
    user_id: str = Field(description="User identifier.")
    full_name: str = Field(description="User display name.")
    registered_at: str = Field(description="Registration timestamp.")
    is_member: bool = Field(description="Whether user has active membership.")
    points: int = Field(description="User points for ordering.")
    is_top_member: bool = Field(description="Whether user is in top points cohort.")
    status: str = Field(default="confirmed", description="Registration status (confirmed, pending, manual_payment_required, manual_payment_verification, waitlist).")


class RegistrationRequest(BaseModel):
    """
    Start registration by providing redirect URLs.

    This payload ensures the payment gateway can return or cancel back to the
    frontend after checkout.
    """

    return_url: AnyHttpUrl = Field(description="Frontend URL for successful return.")
    cancel_url: AnyHttpUrl = Field(description="Frontend URL for cancellation return.")


class EventCreateRequest(BaseModel):
    """
    Create a new event with pricing and policy settings.

    This payload defines the event schedule, pricing tiers, and cancellation
    policy used by registration and payment flows.
    """

    title: str = Field(min_length=1, max_length=255, description="Event title.")
    description: str | None = Field(default=None, description="Event description.")
    event_type: Literal["karate", "mors", "planszowki", "ognisko", "spacer", "joga", "wyjazd", "inne"] = Field(
        description="Event category tag."
    )
    start_date: datetime = Field(description="Start datetime.")
    end_date: datetime | None = Field(default=None, description="End datetime if provided.")
    time_info: str | None = Field(default=None, max_length=100, description="Free-form time label.")
    city: str = Field(min_length=1, max_length=100, description="City name.")
    location: str | None = Field(default=None, max_length=255, description="Venue or location string.")
    show_map: bool = Field(default=True, description="Whether to show map in UI.")
    price_guest: Decimal = Field(default=Decimal("0"), ge=0, description="Guest price.")
    price_member: Decimal = Field(default=Decimal("0"), ge=0, description="Member price.")
    manual_payment_verification: bool = Field(
        default=True,
        description="Whether manual payment verification is enabled.",
    )
    manual_payment_url: AnyHttpUrl | None = Field(default=None, description="Manual transfer instructions URL.")
    manual_payment_due_hours: int = Field(
        default=24,
        ge=1,
        le=168,
        description="Hours allowed to confirm manual payment.",
    )
    max_participants: int | None = Field(default=None, ge=1, description="Capacity limit if set.")
    requires_subscription: bool = Field(default=False, description="Whether subscription is required.")
    cancel_cutoff_hours: int = Field(default=24, ge=0, description="Cancellation cutoff in hours.")
    points_value: int = Field(default=1, ge=0, description="Points awarded for attendance.")


class RegistrationResponse(BaseModel):
    """
    Describe the result of a registration attempt.

    This response indicates status, payment details, and whether manual payment
    or waitlist handling is required.
    """
    model_config = ConfigDict(coerce_numbers_to_str=True)

    registration_id: str = Field(description="Registration identifier.")
    status: str = Field(description="Registration status after the attempt.")
    is_waitlisted: bool = Field(default=False, description="Whether user was waitlisted.")
    is_free: bool = Field(description="Whether the registration is free.")
    redirect_url: str | None = Field(default=None, description="Gateway redirect URL if payment required.")
    payment_id: str | None = Field(default=None, description="External payment identifier.")
    amount: str | None = Field(default=None, description="Payment amount if applicable.")
    occurrence_date: str | None = Field(default=None, description="Occurrence date for the registration.")
    manual_payment_required: bool = Field(default=False, description="Whether manual payment flow is required.")
    manual_payment_url: str | None = Field(default=None, description="Manual payment instructions URL.")
    transfer_reference: str | None = Field(default=None, description="Transfer reference for manual payment.")
    payment_deadline: str | None = Field(default=None, description="Manual payment deadline.")
    was_promoted_from_waitlist: bool = Field(default=False, description="Whether user was promoted from waitlist.")


class EventUpdateRequest(BaseModel):
    """
    Update an existing event with partial fields.

    This payload allows admins to change schedules, pricing, and policy values
    while keeping omitted fields unchanged.
    """

    title: str | None = Field(default=None, min_length=1, max_length=255, description="Event title.")
    description: str | None = Field(default=None, description="Event description.")
    event_type: Literal["karate", "mors", "planszowki", "ognisko", "spacer", "joga", "wyjazd", "inne"] | None = Field(
        default=None,
        description="Event category tag.",
    )
    start_date: datetime | None = Field(default=None, description="Start datetime.")
    end_date: datetime | None = Field(default=None, description="End datetime if provided.")
    time_info: str | None = Field(default=None, max_length=100, description="Free-form time label.")
    city: str | None = Field(default=None, min_length=1, max_length=100, description="City name.")
    location: str | None = Field(default=None, max_length=255, description="Venue or location string.")
    show_map: bool | None = Field(default=None, description="Whether to show map in UI.")
    price_guest: Decimal | None = Field(default=None, ge=0, description="Guest price.")
    price_member: Decimal | None = Field(default=None, ge=0, description="Member price.")
    manual_payment_verification: bool | None = Field(
        default=None,
        description="Whether manual payment verification is enabled.",
    )
    manual_payment_url: AnyHttpUrl | None = Field(default=None, description="Manual transfer instructions URL.")
    manual_payment_due_hours: int | None = Field(
        default=None,
        ge=1,
        le=168,
        description="Hours allowed to confirm manual payment.",
    )
    max_participants: int | None = Field(default=None, ge=1, description="Capacity limit if set.")
    requires_subscription: bool | None = Field(default=None, description="Whether subscription is required.")
    cancel_cutoff_hours: int | None = Field(default=None, ge=0, description="Cancellation cutoff in hours.")
    points_value: int | None = Field(default=None, ge=0, description="Points awarded for attendance.")


def get_payment_gateway():
    """Get payment gateway instance."""
    return get_shared_fake_payment_adapter()



def _manual_payment_link_required(
    *,
    requires_subscription: bool,
    price_guest: Decimal,
    price_member: Decimal,
) -> bool:
    guest_price = Decimal("0") if requires_subscription else Decimal(str(price_guest or 0))
    member_price = Decimal(str(price_member or 0))
    return guest_price > 0 or member_price > 0


def _validate_manual_payment_config(
    *,
    manual_payment_verification: bool,
    manual_payment_url: str | None,
    requires_subscription: bool,
    price_guest: Decimal,
    price_member: Decimal,
) -> None:
    if not manual_payment_verification:
        return
    if _manual_payment_link_required(
        requires_subscription=requires_subscription,
        price_guest=price_guest,
        price_member=price_member,
    ) and not manual_payment_url:
        raise HTTPException(
            status_code=422,
            detail="manual_payment_url is required when manual payment verification is enabled for paid events",
        )


async def _count_events_for_day(
    db: AsyncSession,
    *,
    city: str,
    day_start: datetime,
    exclude_event_id: str | None = None,
) -> int:
    day_end = day_start + timedelta(days=1)
    stmt = (
        select(func.count(Event.id))
        .where(
            Event.city == city,
            Event.start_date >= day_start,
            Event.start_date < day_end,
        )
    )
    if exclude_event_id is not None:
        stmt = stmt.where(~legacy_id_eq(Event.id, exclude_event_id))
    result = await db.execute(stmt)
    return int(result.scalar_one() or 0)


async def _ensure_daily_event_limit(
    db: AsyncSession,
    *,
    city: str,
    starts: list[datetime],
    exclude_event_id: str | None = None,
) -> None:
    planned_by_day: dict[date, int] = {}
    for occurrence_start in starts:
        day_key = occurrence_start.date()
        planned_by_day[day_key] = planned_by_day.get(day_key, 0) + 1

    for day_key, planned_count in planned_by_day.items():
        day_start = datetime(day_key.year, day_key.month, day_key.day)
        existing_count = await _count_events_for_day(
            db,
            city=city,
            day_start=day_start,
            exclude_event_id=exclude_event_id,
        )
        if existing_count + planned_count > MAX_EVENTS_PER_DAY:
            raise HTTPException(
                status_code=422,
                detail=f"Maximum {MAX_EVENTS_PER_DAY} events per day exceeded for {day_key.isoformat()}",
            )


@router.get("/", response_model=list[EventResponse])
async def list_events(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    event_type: Literal["karate", "mors", "planszowki", "ognisko", "spacer", "joga", "wyjazd", "inne"] | None = None,
    city: str | None = None,
    month: str | None = Query(None, description="Filter by month in YYYY-MM format"),
    start_from: datetime | None = Query(None),
    start_to: datetime | None = Query(None),
    _user: User = Depends(get_active_user_dependency),
    db: AsyncSession = Depends(get_db),
) -> list[EventResponse]:
    """
    List events with optional filters and pagination.

    The handler enforces exclusive month vs. explicit date filters, validates
    YYYY-MM input, and returns events ordered by start date within the limits.
    """

    if month is not None:
        if start_from is not None or start_to is not None:
            raise HTTPException(status_code=400, detail="Use either month or start_from/start_to")
        try:
            year_str, month_str = month.split("-", 1)
            year = int(year_str)
            month_num = int(month_str)
            if month_num < 1 or month_num > 12:
                raise ValueError
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid month format, expected YYYY-MM")

        # Compute UTC range [month_start, next_month_start)
        month_start = datetime(year, month_num, 1)
        if month_num == 12:
            next_month_start = datetime(year + 1, 1, 1)
        else:
            next_month_start = datetime(year, month_num + 1, 1)
        start_from = month_start
        # inclusive end
        start_to = next_month_start - timedelta(microseconds=1)

    stmt = select(Event)

    if event_type:
        stmt = stmt.where(Event.event_type == event_type)
    if city:
        stmt = stmt.where(Event.city == city)
    if start_from:
        stmt = stmt.where(Event.start_date >= start_from)
    if start_to:
        stmt = stmt.where(Event.start_date <= start_to)

    stmt = stmt.order_by(Event.start_date).offset(skip).limit(limit)

    result = await db.execute(stmt)
    events = result.scalars().all()

    return [EventResponse.model_validate(e) for e in events]


@router.post("/", response_model=EventResponse)
async def create_event(
    payload: EventCreateRequest,
    _admin: User = Depends(get_admin_user_dependency),
    db: AsyncSession = Depends(get_db),
) -> EventResponse:
    """
    Create a new event with pricing and policy configuration.

    This endpoint enforces manual payment configuration rules, applies daily
    event limits per city, and normalizes pricing for subscription-only events.
    """
    manual_payment_url = str(payload.manual_payment_url) if payload.manual_payment_url else None
    if _manual_payment_link_required(
        requires_subscription=payload.requires_subscription,
        price_guest=payload.price_guest,
        price_member=payload.price_member,
    ):
        manual_payment_url = manual_payment_url or DEFAULT_MANUAL_PAYMENT_URL
    _validate_manual_payment_config(
        # Manual verification is temporarily enforced while online gateways are disabled.
        manual_payment_verification=True,
        manual_payment_url=manual_payment_url,
        requires_subscription=payload.requires_subscription,
        price_guest=payload.price_guest,
        price_member=payload.price_member,
    )

    starts = [payload.start_date]
    await _ensure_daily_event_limit(
        db,
        city=payload.city,
        starts=starts,
    )
    event = Event(
        title=payload.title,
        description=payload.description,
        event_type=payload.event_type,
        start_date=payload.start_date,
        end_date=payload.end_date,
        time_info=payload.time_info,
        city=payload.city,
        location=payload.location,
        # Guest price is not applicable for subscription-only events.
        price_guest=Decimal("0") if payload.requires_subscription else payload.price_guest,
        price_member=payload.price_member,
        manual_payment_verification=True,
        manual_payment_url=manual_payment_url,
        manual_payment_due_hours=payload.manual_payment_due_hours,
        max_participants=payload.max_participants,
        requires_subscription=payload.requires_subscription,
        cancel_cutoff_hours=payload.cancel_cutoff_hours,
        points_value=payload.points_value,
    )
    db.add(event)

    await db.commit()
    await db.refresh(event)
    return EventResponse.model_validate(event)


@router.put("/{event_id}", response_model=EventResponse)
async def update_event(
    payload: EventUpdateRequest,
    event_id: str = Path(..., min_length=1),
    _admin: User = Depends(get_admin_user_dependency),
    db: AsyncSession = Depends(get_db),
) -> EventResponse:
    """
    Update an existing event with partial fields.

    The handler validates date changes, enforces daily limits, normalizes manual
    payment requirements, and preserves business rules for subscription pricing.
    """
    result = await db.execute(select(Event).where(legacy_id_eq(Event.id, event_id)))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    updates = payload.model_dump(exclude_unset=True)

    if "manual_payment_verification" in updates:
        # Manual verification is temporarily enforced while online gateways are disabled.
        updates.pop("manual_payment_verification")
    if "manual_payment_due_hours" in updates and updates["manual_payment_due_hours"] is None:
        raise HTTPException(status_code=422, detail="manual_payment_due_hours cannot be null")

    if "start_date" in updates and updates["start_date"] is not None:
        candidate_start = updates["start_date"]
        now = datetime.now(candidate_start.tzinfo) if candidate_start.tzinfo else datetime.utcnow()
        if candidate_start < now:
            raise HTTPException(status_code=422, detail="Cannot move event to a past date")

    if "start_date" in updates or "city" in updates:
        await _ensure_daily_event_limit(
            db,
            city=updates.get("city", event.city),
            starts=[updates.get("start_date", event.start_date)],
            exclude_event_id=event.id,
        )

    if "manual_payment_url" in updates and updates["manual_payment_url"] is not None:
        updates["manual_payment_url"] = str(updates["manual_payment_url"])

    candidate_requires_subscription = updates.get("requires_subscription", event.requires_subscription)
    candidate_price_guest = Decimal(str(updates.get("price_guest", event.price_guest or 0)))
    if candidate_requires_subscription:
        candidate_price_guest = Decimal("0")
    candidate_price_member = Decimal(str(updates.get("price_member", event.price_member or 0)))
    candidate_manual_payment_verification = True
    candidate_manual_payment_url = updates.get("manual_payment_url", event.manual_payment_url)
    if _manual_payment_link_required(
        requires_subscription=bool(candidate_requires_subscription),
        price_guest=candidate_price_guest,
        price_member=candidate_price_member,
    ):
        candidate_manual_payment_url = candidate_manual_payment_url or DEFAULT_MANUAL_PAYMENT_URL
        updates["manual_payment_url"] = candidate_manual_payment_url

    _validate_manual_payment_config(
        manual_payment_verification=candidate_manual_payment_verification,
        manual_payment_url=candidate_manual_payment_url,
        requires_subscription=bool(candidate_requires_subscription),
        price_guest=candidate_price_guest,
        price_member=candidate_price_member,
    )

    updates["manual_payment_verification"] = True

    for key, value in updates.items():
        setattr(event, key, value)

    if event.requires_subscription:
        event.price_guest = Decimal("0")

    db.add(event)
    await db.commit()
    await db.refresh(event)
    return EventResponse.model_validate(event)


@router.delete("/{event_id}")
async def delete_event(
    event_id: str = Path(..., min_length=1),
    _admin: User = Depends(get_admin_user_dependency),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """
    Delete an event when it has no active registrations.

    The endpoint blocks deletion if confirmed, pending, manual-payment, or
    waitlist registrations exist and returns a simple deletion status on success.
    """
    result = await db.execute(select(Event).where(legacy_id_eq(Event.id, event_id)))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    registration_result = await db.execute(
        select(Registration.id).where(
            legacy_id_eq(Registration.event_id, event_id),
            Registration.status.in_(
                [
                    RegistrationStatus.PENDING.value,
                    RegistrationStatus.CONFIRMED.value,
                    RegistrationStatus.MANUAL_PAYMENT_REQUIRED.value,
                    RegistrationStatus.MANUAL_PAYMENT_VERIFICATION.value,
                    RegistrationStatus.WAITLIST.value,
                ]
            ),
        ).limit(1)
    )
    if registration_result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=409,
            detail="Event has registrations and cannot be deleted",
        )

    await db.delete(event)
    await db.commit()
    return {"status": "deleted"}


@router.get("/registered", response_model=list[str])
async def list_registered_event_ids(
    user: User = Depends(get_active_user_dependency),
    db: AsyncSession = Depends(get_db),
) -> list[str]:
    """
    Return event IDs for the current user's active registrations.

    The query includes confirmed, pending, manual payment, and waitlist statuses
    and returns a distinct list of event identifiers.
    """
    stmt = (
        select(Registration.event_id)
        .where(
            legacy_id_eq(Registration.user_id, user.id),
            Registration.status.in_(
                [
                    RegistrationStatus.CONFIRMED.value,
                    RegistrationStatus.PENDING.value,
                    RegistrationStatus.MANUAL_PAYMENT_REQUIRED.value,
                    RegistrationStatus.MANUAL_PAYMENT_VERIFICATION.value,
                    RegistrationStatus.WAITLIST.value,
                ]
            ),
        )
        .distinct()
    )
    result = await db.execute(stmt)
    return [str(row[0]) for row in result.all()]


@router.get("/{event_id}", response_model=EventResponse)
async def get_event(
    event_id: str = Path(..., min_length=1),
    _user: User = Depends(get_active_user_dependency),
    db: AsyncSession = Depends(get_db),
) -> EventResponse:
    """
    Return a single event by its identifier.

    The endpoint validates the event exists and returns a 404 when it is missing.
    """
    stmt = select(Event).where(legacy_id_eq(Event.id, event_id))
    result = await db.execute(stmt)
    event = result.scalar_one_or_none()

    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    return EventResponse.model_validate(event)


@router.get("/{event_id}/availability", response_model=EventAvailabilityResponse)
async def check_event_availability(
    event_id: str = Path(..., min_length=1),
    _user: User = Depends(get_active_user_dependency),
    db: AsyncSession = Depends(get_db),
) -> EventAvailabilityResponse:
    """
    Return availability details for a specific event occurrence.

    The handler delegates to the registration service and maps a missing event
    to a 404 response.
    """
    payment_gateway = get_payment_gateway()
    payment_service = PaymentService(db, payment_gateway)
    registration_service = RegistrationService(db, payment_service)

    try:
        availability = await registration_service.check_availability(
            event_id=event_id,
        )
        return EventAvailabilityResponse(**availability)
    except EventNotFoundError:
        raise HTTPException(status_code=404, detail="Event not found")


@router.get("/{event_id}/participants", response_model=list[ParticipantResponse])
async def get_event_participants(
    event_id: str = Path(..., min_length=1),
    _user: User = Depends(get_active_user_dependency),
    db: AsyncSession = Depends(get_db),
) -> list[ParticipantResponse]:
    """
    Return all spot-occupying participants for an event.

    The registration service provides participants with confirmed, pending,
    and manual-payment statuses. A missing event is mapped to a 404 response.
    """
    payment_gateway = get_payment_gateway()
    payment_service = PaymentService(db, payment_gateway)
    registration_service = RegistrationService(db, payment_service)

    try:
        participants = await registration_service.get_spot_occupying_participants(
            event_id=event_id,
        )
        return [ParticipantResponse(**p) for p in participants]
    except EventNotFoundError:
        raise HTTPException(status_code=404, detail="Event not found")


@router.get("/{event_id}/waitlist", response_model=list[ParticipantResponse])
async def get_event_waitlist(
    event_id: str = Path(..., min_length=1),
    _user: User = Depends(get_active_user_dependency),
    db: AsyncSession = Depends(get_db),
) -> list[ParticipantResponse]:
    """
    Return waitlisted participants for an event.

    The registration service provides the waitlist and a missing event is mapped
    to a 404 response.
    """
    payment_gateway = get_payment_gateway()
    payment_service = PaymentService(db, payment_gateway)
    registration_service = RegistrationService(db, payment_service)

    try:
        participants = await registration_service.get_waitlist_participants(
            event_id=event_id,
        )
        return [ParticipantResponse(**p) for p in participants]
    except EventNotFoundError:
        raise HTTPException(status_code=404, detail="Event not found")


@router.post("/{event_id}/register", response_model=RegistrationResponse)
async def register_for_event(
    request: RegistrationRequest,
    event_id: str = Path(..., min_length=1),
    user: User = Depends(get_active_user_dependency),
    db: AsyncSession = Depends(get_db),
) -> RegistrationResponse:
    """
    Register the authenticated user for an event.

    The registration service handles capacity checks, waitlisting, and payment
    initiation. Errors are mapped to HTTP status codes for full, duplicate, or
    unapproved accounts.
    """
    payment_gateway = get_payment_gateway()
    payment_service = PaymentService(db, payment_gateway)
    registration_service = RegistrationService(db, payment_service)
    try:
        result = await registration_service.initiate_registration(
            user=user,
            event_id=event_id,
            return_url=str(request.return_url),
            cancel_url=str(request.cancel_url),
        )
        return RegistrationResponse(**result)

    except EventNotFoundError:
        raise HTTPException(status_code=404, detail="Event not found")
    except EventFullError:
        raise HTTPException(status_code=409, detail="Event is full")
    except AlreadyRegisteredError:
        raise HTTPException(status_code=409, detail="Already registered for this event")
    except AccountNotApprovedError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except RegistrationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{event_id}/register")
async def cancel_registration(
    event_id: str = Path(..., min_length=1),
    user: User = Depends(get_active_user_dependency),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    """
    Cancel the current user's registration for an event.

    The handler resolves the user's registration and delegates cancellation and
    refund handling to the registration service.
    """
    payment_gateway = get_payment_gateway()
    payment_service = PaymentService(db, payment_gateway)
    registration_service = RegistrationService(db, payment_service)

    # Find registration
    registrations = await registration_service.get_user_registrations(user.id)
    registration = next(
        (
            r
            for r in registrations
            if str(r.event_id) == str(event_id)
        ),
        None
    )

    if not registration:
        raise HTTPException(status_code=404, detail="Registration not found")

    result = await registration_service.cancel_registration(
        registration_id=registration.id,
        user_id=user.id,
        request_refund=True,
    )

    return result
