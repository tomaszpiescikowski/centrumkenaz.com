from decimal import Decimal
from typing import Optional
from datetime import datetime, timedelta, date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import joinedload

from models.user import User, UserRole, AccountStatus
from models.subscription import Subscription
from models.event import Event
from models.registration import Registration, RegistrationStatus
from models.registration_refund_task import RegistrationRefundTask
from models.payment import Currency
from services.payment_service import PaymentService
from ports.payment_gateway import PaymentStatus as GatewayPaymentStatus
from services.google_calendar_service import GoogleCalendarService
from utils.legacy_ids import legacy_id_eq


class RegistrationError(Exception):
    """Base exception for registration errors."""
    pass


class EventFullError(RegistrationError):
    """Event has no available spots."""
    pass


class AlreadyRegisteredError(RegistrationError):
    """User is already registered for this event."""
    pass


class EventNotFoundError(RegistrationError):
    """Event not found."""
    pass


class ConcurrencyError(RegistrationError):
    """Concurrent modification detected."""
    pass


class AccountNotApprovedError(RegistrationError):
    """User account is not approved for registrations."""
    pass


class RegistrationService:
    """
    Service for event registration with concurrency-safe operations.

    Uses optimistic locking with version field to prevent race conditions
    when multiple users try to register for limited spots simultaneously.
    """

    def __init__(self, db: AsyncSession, payment_service: PaymentService):
        """
        Initialize the registration service with database and payment helpers.

        The service coordinates registration state, payments, and policy checks
        using the provided async database session and payment service.
        """
        self.db = db
        self.payment_service = payment_service

    def _occupies_spot(self, status: str) -> bool:
        """
        Determine whether a registration status consumes event capacity.

        The method returns True for confirmed, pending, and manual-payment
        states that should count toward capacity.
        """
        return status in {
            RegistrationStatus.CONFIRMED.value,
            RegistrationStatus.PENDING.value,
            RegistrationStatus.MANUAL_PAYMENT_REQUIRED.value,
            RegistrationStatus.MANUAL_PAYMENT_VERIFICATION.value,
        }

    def _requires_manual_payment_for_registration(self, event: Event, price: Decimal) -> bool:
        """
        Determine whether manual payment is required for a registration.

        Manual payment is required when the event is configured for verification
        and the computed price is greater than zero.
        """
        return bool(event.manual_payment_verification) and price > 0

    def _transfer_reference_for_event(self, event: Event) -> str:
        """
        Build the transfer reference string for a manual payment.

        The business requirement uses the event UUID as the transfer reference.
        """
        # Business requirement: transfer "message" should contain the event UUID.
        return str(event.id)

    def _manual_payment_due_at(self, event: Event, now: datetime) -> datetime:
        """
        Calculate the deadline for manual payment confirmation.

        The deadline is computed from the event configuration with a minimum
        of one hour to ensure a valid window.
        """
        due_hours = max(int(event.manual_payment_due_hours or 24), 1)
        return now + timedelta(hours=due_hours)

    async def _get_subscription_for_user(self, user: User) -> Subscription | None:
        """
        Load a user's subscription record if available.

        The method uses a preloaded relationship when present, otherwise it
        queries the database to avoid async lazy-loading issues.
        """
        if hasattr(user, "__dict__") and "subscription" in user.__dict__:
            return user.subscription
        result = await self.db.execute(
            select(Subscription).where(legacy_id_eq(Subscription.user_id, user.id))
        )
        return result.scalar_one_or_none()

    async def _is_active_subscriber(self, user: User, now: datetime) -> bool:
        """
        Check whether a user has an active subscription at the given time.

        Admins are treated as active, while members require a valid end date
        that has not expired.
        """
        if user.role == UserRole.ADMIN:
            return True
        if user.role != UserRole.MEMBER:
            return False
        if user.account_status != AccountStatus.ACTIVE:
            return False
        subscription = await self._get_subscription_for_user(user)
        if not subscription or not subscription.end_date:
            return False
        subscription_end = subscription.end_date
        if subscription_end.tzinfo is None and now.tzinfo is not None:
            subscription_end = subscription_end.replace(tzinfo=now.tzinfo)
        elif subscription_end.tzinfo is not None and now.tzinfo is None:
            now = now.replace(tzinfo=subscription_end.tzinfo)
        return subscription_end >= now

    def _is_valid_occurrence_date(self, event: Event, occurrence_date: date) -> bool:
        """
        Validate that an occurrence date matches the event schedule.

        Current business rules only allow occurrences matching the event start date.
        """
        base_date = event.start_date.date()
        return occurrence_date == base_date

    def _resolve_occurrence_date(self, event: Event, occurrence_date: date | None) -> date:
        """
        Resolve the occurrence date and validate it against event rules.

        When a date is not provided, the event start date is used; invalid dates
        raise a RegistrationError.
        """
        base_date = event.start_date.date()
        resolved = occurrence_date or base_date
        if not self._is_valid_occurrence_date(event, resolved):
            raise RegistrationError("Invalid occurrence date for this event")
        return resolved

    def get_occurrence_datetimes(self, event: Event, occurrence_date: date | None = None) -> tuple[datetime, datetime | None]:
        """
        Compute start and end datetimes for a specific occurrence.

        The method preserves the event's timezone information and applies the
        event duration when an end date exists.  Unlike ``_resolve_occurrence_date``
        this intentionally skips validation so it can compute datetimes for
        historical registrations whose occurrence_date may no longer match the
        current event start_date (e.g. after an admin reschedule).
        """
        resolved_date = occurrence_date or event.start_date.date()
        base_start = event.start_date
        start_dt = datetime.combine(resolved_date, base_start.timetz() if base_start.tzinfo else base_start.time())
        if base_start.tzinfo:
            start_dt = start_dt.replace(tzinfo=base_start.tzinfo)

        if not event.end_date:
            return start_dt, None

        duration = event.end_date - event.start_date
        return start_dt, start_dt + duration

    async def _resolve_price_for_user(self, user: User, event: Event, now: datetime) -> Decimal:
        """
        Resolve the registration price for a user and event.

        Active subscribers pay the member price, while others pay the guest price.
        """
        if await self._is_active_subscriber(user, now):
            return Decimal(str(event.price_member))
        return Decimal(str(event.price_guest))

    async def get_cancellation_info(
        self,
        user: User,
        event: Event,
        now: datetime,
        occurrence_start: datetime | None = None,
    ) -> dict:
        """
        Compute cancellation eligibility for a registration.

        The method evaluates cutoff windows to return UI-friendly cancellation metadata.
        """
        cancel_cutoff_hours = event.cancel_cutoff_hours or 24
        event_start = occurrence_start or event.start_date
        time_until_event = event_start - now
        can_cancel = time_until_event > timedelta(hours=cancel_cutoff_hours)

        return {
            "cancel_cutoff_hours": cancel_cutoff_hours,
            "can_cancel": can_cancel,
        }

    async def get_event_with_registrations(self, event_id: str) -> Event | None:
        """
        Load an event with its registrations and related user data.

        The query uses eager loading to avoid async lazy-loading issues and
        returns None when the event is missing.
        """
        stmt = (
            select(Event)
            .options(joinedload(Event.registrations).joinedload(Registration.user))
            .where(legacy_id_eq(Event.id, event_id))
        )
        result = await self.db.execute(stmt)
        if hasattr(result, "unique"):
            result = result.unique()
        return result.scalar_one_or_none()

    async def _get_participants_by_status(
        self,
        *,
        event_id: str,
        status: str,
        occurrence_date: date | None = None,
    ) -> list[dict]:
        """
        Return participant summaries for a specific registration status.

        The method loads top members for ordering, resolves the occurrence date,
        and returns display-ready participant dictionaries.
        """
        now = datetime.utcnow()
        top_rows = await self.db.execute(
            select(User.id)
            .outerjoin(Subscription, Subscription.user_id == User.id)
            .order_by(func.coalesce(Subscription.points, 0).desc(), User.created_at.asc())
            .limit(3)
        )
        top_ids = {str(row[0]) for row in top_rows.all()}
        event = await self.get_event_with_registrations(event_id)
        if not event:
            raise EventNotFoundError(f"Event {event_id} not found")
        resolved_occurrence_date = self._resolve_occurrence_date(event, occurrence_date)

        stmt = (
            select(Registration)
            .options(joinedload(Registration.user).joinedload(User.subscription))
            .where(
                legacy_id_eq(Registration.event_id, event_id),
                Registration.occurrence_date == resolved_occurrence_date,
                Registration.status == status,
            )
            .order_by(Registration.created_at)
        )
        result = await self.db.execute(stmt)
        registrations = result.scalars().all()

        response: list[dict] = []
        for reg in registrations:
            subscription = reg.user.subscription
            subscription_end = subscription.end_date if subscription else None
            points = int(subscription.points or 0) if subscription else 0
            is_member = (
                reg.user.role == UserRole.MEMBER and
                (
                    subscription_end is None or
                    subscription_end > now
                )
            )
            response.append(
                {
                    "id": str(reg.id),
                    "user_id": str(reg.user_id),
                    "full_name": reg.user.full_name,
                    "registered_at": reg.created_at.isoformat(),
                    "is_member": is_member,
                    "points": points if is_member else 0,
                    "is_top_member": str(reg.user_id) in top_ids,
                    "status": reg.status,
                }
            )
        return response

    async def get_spot_occupying_participants(
        self,
        event_id: str,
        occurrence_date: date | None = None,
    ) -> list[dict]:
        """
        Return all participants that occupy a spot for an event occurrence.

        Includes confirmed, pending, manual_payment_required, and
        manual_payment_verification statuses.
        """
        now = datetime.utcnow()
        top_rows = await self.db.execute(
            select(User.id)
            .outerjoin(Subscription, Subscription.user_id == User.id)
            .order_by(func.coalesce(Subscription.points, 0).desc(), User.created_at.asc())
            .limit(3)
        )
        top_ids = {str(row[0]) for row in top_rows.all()}
        event = await self.get_event_with_registrations(event_id)
        if not event:
            raise EventNotFoundError(f"Event {event_id} not found")
        resolved_occurrence_date = self._resolve_occurrence_date(event, occurrence_date)

        spot_statuses = [
            RegistrationStatus.CONFIRMED.value,
            RegistrationStatus.PENDING.value,
            RegistrationStatus.MANUAL_PAYMENT_REQUIRED.value,
            RegistrationStatus.MANUAL_PAYMENT_VERIFICATION.value,
        ]
        stmt = (
            select(Registration)
            .options(joinedload(Registration.user).joinedload(User.subscription))
            .where(
                legacy_id_eq(Registration.event_id, event_id),
                Registration.occurrence_date == resolved_occurrence_date,
                Registration.status.in_(spot_statuses),
            )
            .order_by(Registration.created_at)
        )
        result = await self.db.execute(stmt)
        registrations = result.scalars().all()

        response: list[dict] = []
        for reg in registrations:
            subscription = reg.user.subscription
            subscription_end = subscription.end_date if subscription else None
            points = int(subscription.points or 0) if subscription else 0
            is_member = (
                reg.user.role == UserRole.MEMBER and
                (
                    subscription_end is None or
                    subscription_end > now
                )
            )
            response.append(
                {
                    "id": str(reg.id),
                    "user_id": str(reg.user_id),
                    "full_name": reg.user.full_name,
                    "registered_at": reg.created_at.isoformat(),
                    "is_member": is_member,
                    "points": points if is_member else 0,
                    "is_top_member": str(reg.user_id) in top_ids,
                    "status": reg.status,
                }
            )
        return response

    async def get_confirmed_participants(
        self,
        event_id: str,
        occurrence_date: date | None = None,
    ) -> list[dict]:
        """
        Return confirmed participants for an event occurrence.

        The response includes display-ready dictionaries for each participant.
        """
        return await self._get_participants_by_status(
            event_id=event_id,
            status=RegistrationStatus.CONFIRMED.value,
            occurrence_date=occurrence_date,
        )

    async def get_waitlist_participants(
        self,
        event_id: str,
        occurrence_date: date | None = None,
    ) -> list[dict]:
        """
        Return waitlisted participants for an event occurrence.

        The response includes display-ready dictionaries for each participant.
        """
        return await self._get_participants_by_status(
            event_id=event_id,
            status=RegistrationStatus.WAITLIST.value,
            occurrence_date=occurrence_date,
        )

    async def check_availability(
        self,
        event_id: str,
        occurrence_date: date | None = None,
    ) -> dict:
        """
        Check availability for an event occurrence.

        The method counts confirmed, waitlisted, and occupied registrations and
        returns capacity details for registration decisions.
        """
        event = await self.get_event_with_registrations(event_id)
        if not event:
            raise EventNotFoundError(f"Event {event_id} not found")

        resolved_occurrence_date = self._resolve_occurrence_date(event, occurrence_date)

        confirmed_count = len([
            r for r in event.registrations
            if r.status == RegistrationStatus.CONFIRMED.value and r.occurrence_date == resolved_occurrence_date
        ])
        occupied_count = len([
            r for r in event.registrations
            if self._occupies_spot(r.status) and r.occurrence_date == resolved_occurrence_date
        ])
        waitlist_count = len([
            r for r in event.registrations
            if r.status == RegistrationStatus.WAITLIST.value and r.occurrence_date == resolved_occurrence_date
        ])

        return {
            "event_id": str(event_id),
            "occurrence_date": resolved_occurrence_date.isoformat(),
            "max_participants": event.max_participants,
            "confirmed_count": confirmed_count,
            "waitlist_count": waitlist_count,
            "available_spots": (
                event.max_participants - occupied_count
                if event.max_participants else None
            ),
            "is_available": (
                event.max_participants is None or
                occupied_count < event.max_participants
            ),
        }

    async def _acquire_spot_with_optimistic_lock(
        self,
        event_id: str,
        expected_version: int
    ) -> bool:
        """
        Try to acquire a spot using optimistic locking.

        The update succeeds only when the event version matches, preventing
        concurrent registrations from overselling capacity.
        """
        stmt = (
            update(Event)
            .where(legacy_id_eq(Event.id, event_id), Event.version == expected_version)
            .values(version=expected_version + 1)
        )
        result = await self.db.execute(stmt)
        return result.rowcount > 0

    async def initiate_registration(
        self,
        user: User,
        event_id: str,
        return_url: str,
        cancel_url: str,
        occurrence_date: date | None = None,
        max_retries: int = 3,
    ) -> dict:
        """
        Initiate event registration with payment handling.

        The method uses optimistic locking with retries to prevent overselling
        capacity, then returns registration details and payment metadata.
        """
        if user.account_status != AccountStatus.ACTIVE:
            raise AccountNotApprovedError("Account pending admin approval")

        for attempt in range(max_retries):
            try:
                return await self._try_register(
                    user=user,
                    event_id=event_id,
                    return_url=return_url,
                    cancel_url=cancel_url,
                    occurrence_date=occurrence_date,
                )
            except ConcurrencyError:
                if attempt == max_retries - 1:
                    raise
                # Retry with fresh data
                await self.db.rollback()
                continue

        raise ConcurrencyError("Failed to register after multiple attempts")

    async def _try_register(
        self,
        user: User,
        event_id: str,
        return_url: str,
        cancel_url: str,
        occurrence_date: date | None = None,
    ) -> dict:
        """
        Perform a single registration attempt with current event data.

        This method handles capacity checks, waitlists, manual payment flows,
        and payment initiation for paid events.
        """
        # Get event with current version
        event = await self.get_event_with_registrations(event_id)
        if not event:
            raise EventNotFoundError(f"Event {event_id} not found")

        resolved_occurrence_date = self._resolve_occurrence_date(event, occurrence_date)
        occurrence_start_dt, _ = self.get_occurrence_datetimes(event, resolved_occurrence_date)

        # Check if user already registered for this specific occurrence.
        existing = next(
            (
                r
                for r in event.registrations
                if str(r.user_id) == str(user.id) and r.occurrence_date == resolved_occurrence_date
            ),
            None
        )
        if existing and existing.status in [
            RegistrationStatus.CONFIRMED.value,
            RegistrationStatus.PENDING.value,
            RegistrationStatus.MANUAL_PAYMENT_VERIFICATION.value,
        ]:
            raise AlreadyRegisteredError(
                f"User {user.id} is already registered for event {event_id}"
            )

        # Block registrations for past events
        now = datetime.now(occurrence_start_dt.tzinfo) if occurrence_start_dt.tzinfo else datetime.now()
        if occurrence_start_dt < now:
            raise RegistrationError("Cannot register for past events")

        # Enforce subscription-only events
        if event.requires_subscription and not await self._is_active_subscriber(user, now):
            raise RegistrationError("Subscription required for this event")

        # Determine price based on user subscription
        price = await self._resolve_price_for_user(user, event, now)
        manual_payment_mode = self._requires_manual_payment_for_registration(event, price)

        if existing and existing.status == RegistrationStatus.MANUAL_PAYMENT_REQUIRED.value:
            if not existing.manual_payment_due_at:
                existing.manual_payment_due_at = self._manual_payment_due_at(event, now)
                self.db.add(existing)
                await self.db.commit()
                await self.db.refresh(existing)
            return {
                "registration_id": str(existing.id),
                "status": RegistrationStatus.MANUAL_PAYMENT_REQUIRED.value,
                "is_waitlisted": False,
                "is_free": False,
                "redirect_url": None,
                "amount": str(price),
                "manual_payment_required": True,
                "manual_payment_url": event.manual_payment_url,
                "transfer_reference": self._transfer_reference_for_event(event),
                "payment_deadline": (
                    existing.manual_payment_due_at.isoformat()
                    if existing.manual_payment_due_at
                    else None
                ),
                "was_promoted_from_waitlist": bool(existing.promoted_from_waitlist_at),
                "occurrence_date": resolved_occurrence_date.isoformat(),
            }

        # Check availability for this occurrence.
        occupied_count = len([
            r for r in event.registrations
            if self._occupies_spot(r.status) and r.occurrence_date == resolved_occurrence_date
        ])

        if event.max_participants and occupied_count >= event.max_participants:
            if existing and existing.status == RegistrationStatus.WAITLIST.value:
                await self.db.refresh(existing)
                return {
                    "registration_id": str(existing.id),
                    "status": RegistrationStatus.WAITLIST.value,
                    "is_waitlisted": True,
                    "is_free": True,
                    "redirect_url": None,
                    "occurrence_date": resolved_occurrence_date.isoformat(),
                }

            if existing and existing.status in [
                RegistrationStatus.CANCELLED.value,
                RegistrationStatus.REFUNDED.value,
            ]:
                registration = existing
                registration.status = RegistrationStatus.WAITLIST.value
                registration.payment_id = None
                registration.manual_payment_confirmed_at = None
                registration.promoted_from_waitlist_at = None
                registration.manual_payment_due_at = None
                registration.waitlist_notification_sent = False
                registration.waitlist_notified_at = None
            else:
                registration = Registration(
                    user=user,
                    event=event,
                    occurrence_date=resolved_occurrence_date,
                    status=RegistrationStatus.WAITLIST.value,
                )
                self.db.add(registration)

            await self.db.commit()
            await self.db.refresh(registration)

            return {
                "registration_id": str(registration.id),
                "status": RegistrationStatus.WAITLIST.value,
                "is_waitlisted": True,
                "is_free": True,
                "redirect_url": None,
                "occurrence_date": resolved_occurrence_date.isoformat(),
            }

        # Try to acquire spot with optimistic lock
        current_version = event.version
        if not await self._acquire_spot_with_optimistic_lock(event_id, current_version):
            raise ConcurrencyError("Concurrent modification detected")

        # Create or reuse registration
        pending_status = (
            RegistrationStatus.MANUAL_PAYMENT_REQUIRED.value
            if manual_payment_mode
            else RegistrationStatus.PENDING.value
        )
        if existing and existing.status in [
            RegistrationStatus.CANCELLED.value,
            RegistrationStatus.REFUNDED.value,
            RegistrationStatus.WAITLIST.value,
        ]:
            registration = existing
            registration.status = pending_status
            registration.payment_id = None
            registration.manual_payment_confirmed_at = None
            registration.waitlist_notification_sent = False
            registration.waitlist_notified_at = None
            if not registration.promoted_from_waitlist_at:
                registration.manual_payment_due_at = None
        else:
            registration = Registration(
                user=user,
                event=event,
                occurrence_date=resolved_occurrence_date,
                status=pending_status,
            )
            self.db.add(registration)
        if manual_payment_mode and not registration.manual_payment_due_at:
            registration.manual_payment_due_at = self._manual_payment_due_at(event, now)

        # Handle free events
        if price == 0:
            registration.status = RegistrationStatus.CONFIRMED.value
            await self.db.commit()
            await self.db.refresh(registration)
            await self._apply_points_for_event(user, event)
            await self._maybe_add_to_google_calendar(registration)

            return {
                "registration_id": str(registration.id),
                "status": "confirmed",
                "is_waitlisted": False,
                "is_free": True,
                "redirect_url": None,
                "occurrence_date": resolved_occurrence_date.isoformat(),
            }

        # Manual payment flow requires explicit user confirmation before admin verification.
        if manual_payment_mode:
            await self.db.commit()
            await self.db.refresh(registration)
            return {
                "registration_id": str(registration.id),
                "status": RegistrationStatus.MANUAL_PAYMENT_REQUIRED.value,
                "is_waitlisted": False,
                "is_free": False,
                "redirect_url": None,
                "amount": str(price),
                "manual_payment_required": True,
                "manual_payment_url": event.manual_payment_url,
                "transfer_reference": self._transfer_reference_for_event(event),
                "payment_deadline": (
                    registration.manual_payment_due_at.isoformat()
                    if registration.manual_payment_due_at
                    else None
                ),
                "was_promoted_from_waitlist": bool(registration.promoted_from_waitlist_at),
                "occurrence_date": resolved_occurrence_date.isoformat(),
            }

        # Create payment for paid gateway events
        payment, payment_result = await self.payment_service.create_event_payment(
            user=user,
            event_id=event_id,
            amount=price,
            description=f"Rejestracja: {event.title}",
            return_url=return_url,
            cancel_url=cancel_url,
        )

        registration.payment_id = payment_result.payment_id
        if payment_result.status == GatewayPaymentStatus.COMPLETED:
            registration.status = RegistrationStatus.CONFIRMED.value
            await self.db.commit()
            await self.db.refresh(registration)
            await self._apply_points_for_event(user, event)
            await self._maybe_add_to_google_calendar(registration)
            return {
                "registration_id": str(registration.id),
                "payment_id": payment_result.payment_id,
                "status": "confirmed",
                "is_waitlisted": False,
                "is_free": False,
                "redirect_url": None,
                "amount": str(price),
                "occurrence_date": resolved_occurrence_date.isoformat(),
            }

        await self.db.commit()
        await self.db.refresh(registration)

        return {
            "registration_id": str(registration.id),
            "payment_id": payment_result.payment_id,
            "status": "pending_payment",
            "is_waitlisted": False,
            "is_free": False,
            "redirect_url": payment_result.redirect_url,
            "amount": str(price),
            "occurrence_date": resolved_occurrence_date.isoformat(),
        }

    async def _promote_next_waitlisted_registration(self, event: Event, occurrence_date: date) -> None:
        """
        Promote the oldest waitlisted registration when a spot opens up.

        The method enforces capacity and payment rules, moving eligible users
        into confirmed or manual-payment-required states as appropriate.
        """
        if not event.max_participants:
            return

        occupied_count_result = await self.db.execute(
            select(func.count(Registration.id)).where(
                legacy_id_eq(Registration.event_id, event.id),
                Registration.occurrence_date == occurrence_date,
                Registration.status.in_(
                    [
                        RegistrationStatus.CONFIRMED.value,
                        RegistrationStatus.PENDING.value,
                        RegistrationStatus.MANUAL_PAYMENT_REQUIRED.value,
                        RegistrationStatus.MANUAL_PAYMENT_VERIFICATION.value,
                    ]
                ),
            )
        )
        occupied_count = int(occupied_count_result.scalar_one() or 0)
        if occupied_count >= event.max_participants:
            return

        waitlist_result = await self.db.execute(
            select(Registration)
            .options(joinedload(Registration.user), joinedload(Registration.event))
            .where(
                legacy_id_eq(Registration.event_id, event.id),
                Registration.occurrence_date == occurrence_date,
                Registration.status == RegistrationStatus.WAITLIST.value,
            )
            .order_by(Registration.created_at.asc(), Registration.id.asc())
            .limit(1)
        )
        next_waitlisted = waitlist_result.scalar_one_or_none()
        if not next_waitlisted or not next_waitlisted.user:
            return

        occurrence_start_dt, _ = self.get_occurrence_datetimes(event, occurrence_date)
        now = datetime.now(occurrence_start_dt.tzinfo) if occurrence_start_dt.tzinfo else datetime.now()
        price = await self._resolve_price_for_user(next_waitlisted.user, event, now)

        if price > 0 and self._requires_manual_payment_for_registration(event, price):
            next_waitlisted.status = RegistrationStatus.MANUAL_PAYMENT_REQUIRED.value
            next_waitlisted.payment_id = None
            next_waitlisted.manual_payment_confirmed_at = None
            next_waitlisted.promoted_from_waitlist_at = now
            next_waitlisted.manual_payment_due_at = self._manual_payment_due_at(event, now)
            next_waitlisted.waitlist_notification_sent = False
            next_waitlisted.waitlist_notified_at = None
            self.db.add(next_waitlisted)
            await self.db.commit()
            return

        # Paid waitlist promotions without manual verification require explicit checkout flow and are not auto-promoted.
        if price > 0:
            return

        next_waitlisted.status = RegistrationStatus.CONFIRMED.value
        next_waitlisted.promoted_from_waitlist_at = now
        next_waitlisted.manual_payment_due_at = None
        next_waitlisted.waitlist_notification_sent = False
        next_waitlisted.waitlist_notified_at = None
        self.db.add(next_waitlisted)
        await self.db.commit()
        await self.db.refresh(next_waitlisted)
        await self._apply_points_for_event(next_waitlisted.user, event)
        await self._maybe_add_to_google_calendar(next_waitlisted)

    async def _load_owned_registration_with_context(
        self,
        registration_id: str,
        user_id: str,
    ) -> Registration | None:
        """
        Load a registration with event and user context for ownership checks.

        The query ensures the registration belongs to the user and includes
        related event and user data for downstream processing.
        """
        stmt = (
            select(Registration)
            .options(joinedload(Registration.event), joinedload(Registration.user))
            .where(
                legacy_id_eq(Registration.id, registration_id),
                legacy_id_eq(Registration.user_id, user_id),
            )
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def _manual_payment_details_from_registration(self, registration: Registration) -> dict:
        """
        Build manual payment details from a registration context.

        The method computes pricing, deadlines, and transfer references and
        returns a dictionary suitable for API responses.
        """
        event = registration.event
        user = registration.user
        if not event or not user:
            raise RegistrationError("Registration context is incomplete")

        occurrence_start_dt, _ = self.get_occurrence_datetimes(event, registration.occurrence_date)
        now = datetime.now(occurrence_start_dt.tzinfo) if occurrence_start_dt.tzinfo else datetime.now()
        amount = await self._resolve_price_for_user(user, event, now)
        transfer_reference = self._transfer_reference_for_event(event)

        return {
            "registration_id": str(registration.id),
            "event_id": str(event.id),
            "event_title": event.title,
            "occurrence_date": registration.occurrence_date.isoformat(),
            "status": registration.status,
            "amount": str(amount),
            "currency": Currency.PLN.value,
            "manual_payment_url": event.manual_payment_url,
            "transfer_reference": transfer_reference,
            "payment_deadline": (
                registration.manual_payment_due_at.isoformat()
                if registration.manual_payment_due_at
                else None
            ),
            "promoted_from_waitlist": bool(registration.promoted_from_waitlist_at),
            "manual_payment_confirmed_at": (
                registration.manual_payment_confirmed_at.isoformat()
                if registration.manual_payment_confirmed_at
                else None
            ),
            "can_confirm": registration.status == RegistrationStatus.MANUAL_PAYMENT_REQUIRED.value,
        }

    async def get_manual_payment_details_for_user(
        self,
        registration_id: str,
        user_id: str,
    ) -> dict | None:
        """
        Return manual payment details for a user's registration.

        The method validates ownership, status eligibility, and event settings,
        returning None when the registration is not found.
        """
        registration = await self._load_owned_registration_with_context(registration_id, user_id)
        if not registration:
            return None
        if registration.status not in {
            RegistrationStatus.MANUAL_PAYMENT_REQUIRED.value,
            RegistrationStatus.MANUAL_PAYMENT_VERIFICATION.value,
            RegistrationStatus.CONFIRMED.value,
        }:
            raise RegistrationError("Manual payment flow is not available for this registration")
        if not registration.event or not registration.event.manual_payment_verification:
            raise RegistrationError("Manual payment verification is not enabled for this event")
        return await self._manual_payment_details_from_registration(registration)

    async def confirm_manual_payment_for_user(
        self,
        registration_id: str,
        user_id: str,
    ) -> dict | None:
        """
        Confirm a user's manual payment declaration.

        The handler validates registration status, enforces deadlines, creates
        a manual payment record when needed, and returns updated details.
        """
        registration = await self._load_owned_registration_with_context(registration_id, user_id)
        if not registration:
            return None
        if not registration.event or not registration.user:
            raise RegistrationError("Registration context is incomplete")
        if not registration.event.manual_payment_verification:
            raise RegistrationError("Manual payment verification is not enabled for this event")
        if registration.status == RegistrationStatus.MANUAL_PAYMENT_VERIFICATION.value:
            return await self._manual_payment_details_from_registration(registration)
        if registration.status == RegistrationStatus.CONFIRMED.value:
            return await self._manual_payment_details_from_registration(registration)
        if registration.status != RegistrationStatus.MANUAL_PAYMENT_REQUIRED.value:
            raise RegistrationError("Manual payment confirmation is not available for this registration")

        occurrence_start_dt, _ = self.get_occurrence_datetimes(registration.event, registration.occurrence_date)
        now = datetime.now(occurrence_start_dt.tzinfo) if occurrence_start_dt.tzinfo else datetime.now()
        if registration.manual_payment_due_at and now > registration.manual_payment_due_at:
            raise RegistrationError("Manual payment deadline has passed")
        amount = await self._resolve_price_for_user(registration.user, registration.event, now)
        if amount <= 0:
            raise RegistrationError("Manual payment is available only for paid registrations")

        payment_external_id = registration.payment_id
        if not payment_external_id:
            payment = await self.payment_service.create_manual_event_payment(
                user=registration.user,
                event_id=str(registration.event_id),
                registration_id=str(registration.id),
                amount=amount,
                description=f"Manualna płatność: {registration.event.title}",
                transfer_reference=self._transfer_reference_for_event(registration.event),
                declared_at=now,
            )
            payment_external_id = payment.external_id

        registration.payment_id = payment_external_id
        registration.status = RegistrationStatus.MANUAL_PAYMENT_VERIFICATION.value
        registration.manual_payment_confirmed_at = now
        self.db.add(registration)
        await self.db.commit()
        await self.db.refresh(registration)
        return await self._manual_payment_details_from_registration(registration)

    async def approve_manual_payment(
        self,
        registration_id: str,
    ) -> Registration | None:
        """
        Approve a manual payment and confirm the registration.

        The method verifies eligibility, ensures a payment record exists, marks
        it completed, and applies post-confirmation side effects.
        """
        stmt = (
            select(Registration)
            .options(joinedload(Registration.event), joinedload(Registration.user))
            .where(legacy_id_eq(Registration.id, registration_id))
        )
        result = await self.db.execute(stmt)
        registration = result.scalar_one_or_none()
        if not registration:
            return None
        if registration.status != RegistrationStatus.MANUAL_PAYMENT_VERIFICATION.value:
            raise RegistrationError("Registration is not awaiting manual payment verification")
        if not registration.event or not registration.user:
            raise RegistrationError("Registration context is incomplete")

        if not registration.payment_id:
            occurrence_start_dt, _ = self.get_occurrence_datetimes(registration.event, registration.occurrence_date)
            now = datetime.now(occurrence_start_dt.tzinfo) if occurrence_start_dt.tzinfo else datetime.now()
            amount = await self._resolve_price_for_user(registration.user, registration.event, now)
            payment = await self.payment_service.create_manual_event_payment(
                user=registration.user,
                event_id=str(registration.event_id),
                registration_id=str(registration.id),
                amount=amount,
                description=f"Manualna płatność: {registration.event.title}",
                transfer_reference=self._transfer_reference_for_event(registration.event),
                declared_at=registration.manual_payment_confirmed_at or now,
            )
            registration.payment_id = payment.external_id

        await self.payment_service.mark_manual_event_payment_completed(registration.payment_id)

        registration.status = RegistrationStatus.CONFIRMED.value
        self.db.add(registration)
        await self.db.commit()
        await self.db.refresh(registration)
        await self._apply_points_for_event(registration.user, registration.event)
        await self._maybe_add_to_google_calendar(registration)
        return registration

    async def _create_or_update_refund_task(
        self,
        registration: Registration,
        *,
        refund_eligible: bool,
    ) -> RegistrationRefundTask:
        """
        Create or update a refund task for a cancelled registration.

        The method records refund eligibility and the recommended
        refund decision for admin processing.
        """
        stmt = select(RegistrationRefundTask).where(
            legacy_id_eq(RegistrationRefundTask.registration_id, registration.id)
        )
        result = await self.db.execute(stmt)
        task = result.scalar_one_or_none()

        recommended_should_refund = bool(refund_eligible and registration.payment_id)
        if task is None:
            task = RegistrationRefundTask(
                registration_id=registration.id,
                user_id=registration.user_id,
                event_id=registration.event_id,
                occurrence_date=registration.occurrence_date,
                refund_eligible=refund_eligible,
                recommended_should_refund=recommended_should_refund,
                should_refund=recommended_should_refund,
                refund_marked_paid=False,
            )
            self.db.add(task)
            return task

        task.refund_eligible = refund_eligible
        task.recommended_should_refund = recommended_should_refund
        self.db.add(task)
        return task

    async def confirm_registration(self, payment_id: str) -> Registration | None:
        """
        Confirm a registration after successful payment.

        The method is invoked by payment webhooks and applies points and calendar
        updates after setting the registration status.
        """
        stmt = (
            select(Registration)
            .options(joinedload(Registration.event), joinedload(Registration.user))
            .where(Registration.payment_id == payment_id)
        )
        result = await self.db.execute(stmt)
        registration = result.scalar_one_or_none()

        if registration:
            if registration.user and registration.user.account_status != AccountStatus.ACTIVE:
                return registration
            registration.status = RegistrationStatus.CONFIRMED.value
            await self.db.commit()
            await self.db.refresh(registration)
            await self._apply_points_for_event(registration.user, registration.event)
            await self._maybe_add_to_google_calendar(registration)

        return registration

    async def _apply_points_for_event(self, user: User, event: Event) -> None:
        """
        Apply event points to the user's subscription record.

        The method creates a subscription row if needed and increments points
        by the event's configured value.
        """
        if not event or not user:
            return
        points = event.points_value or 0
        if points <= 0:
            return
        subscription = await self._get_subscription_for_user(user)
        if not subscription:
            subscription = Subscription(user_id=user.id, points=0)
        subscription.points = int(subscription.points or 0) + int(points)
        self.db.add(subscription)
        await self.db.commit()
        await self.db.refresh(subscription)

    async def _maybe_add_to_google_calendar(self, registration: Registration) -> None:
        """
        Add a confirmed registration to Google Calendar when eligible.

        The method skips when the user lacks a refresh token, creates a calendar
        event via Google API, and stores the resulting event ID.
        """
        if not registration or registration.calendar_event_id:
            return
        if not registration.user or not registration.event:
            return
        if not registration.user.google_refresh_token:
            return

        try:
            service = GoogleCalendarService()
            calendar_event_id = await service.create_event(
                registration.user,
                registration.event,
                occurrence_date=registration.occurrence_date,
            )
        except Exception:
            return

        if not calendar_event_id:
            return

        registration.calendar_event_id = calendar_event_id
        self.db.add(registration)
        await self.db.commit()
        await self.db.refresh(registration)

    async def cancel_registration(
        self,
        registration_id: str,
        user_id: str,
        request_refund: bool = True,
    ) -> dict:
        """
        Cancel a registration with refund policy handling.

        The method enforces cancellation windows, triggers refunds where allowed,
        and promotes waitlisted users if needed.
        """
        stmt = (
            select(Registration)
            .options(joinedload(Registration.event), joinedload(Registration.user))
            .where(
                legacy_id_eq(Registration.id, registration_id),
                legacy_id_eq(Registration.user_id, user_id),
            )
        )
        result = await self.db.execute(stmt)
        registration = result.scalar_one_or_none()

        if not registration:
            return {"success": False, "error": "Registration not found"}

        if registration.status in [RegistrationStatus.CANCELLED.value, RegistrationStatus.REFUNDED.value]:
            return {"success": False, "error": "Already cancelled"}

        event = registration.event
        occurrence_start_dt, _ = self.get_occurrence_datetimes(event, registration.occurrence_date)
        now = datetime.now(occurrence_start_dt.tzinfo) if occurrence_start_dt.tzinfo else datetime.now()
        time_until_event = occurrence_start_dt - now
        cancel_cutoff_hours = event.cancel_cutoff_hours or 24
        can_cancel = time_until_event > timedelta(hours=cancel_cutoff_hours)

        if not can_cancel:
            return {
                "success": False,
                "error": "Cancellation window closed",
            }

        # Update registration status
        previous_status = registration.status
        registration.status = RegistrationStatus.CANCELLED.value

        refund_result = None
        task = await self._create_or_update_refund_task(
            registration,
            refund_eligible=can_cancel,
        )

        should_attempt_gateway_refund = bool(
            request_refund
            and registration.payment_id
            and can_cancel
            and not bool(event.manual_payment_verification)
        )
        if should_attempt_gateway_refund:
            refund_result = await self.payment_service.refund_payment(
                registration.payment_id,
                reason="User cancelled registration"
            )
            if refund_result.success:
                registration.status = RegistrationStatus.REFUNDED.value
                task.should_refund = True
                task.refund_marked_paid = True

        self.db.add(task)
        await self.db.commit()
        if self._occupies_spot(previous_status):
            await self._promote_next_waitlisted_registration(event, registration.occurrence_date)

        return {
            "success": True,
            "refund_eligible": can_cancel,
            "refund_processed": refund_result.success if refund_result else False,
            "refund_message": (
                "Refund processed" if refund_result and refund_result.success
                else "Too late for refund (past cancellation window)" if not can_cancel
                else None
            ),
            "refund_task_id": str(task.id),
        }

    async def get_user_registrations(self, user_id: str) -> list[Registration]:
        """
        Return all registrations for a user ordered by creation date.

        The query eagerly loads event data to support downstream rendering.
        """
        stmt = (
            select(Registration)
            .options(joinedload(Registration.event))
            .where(legacy_id_eq(Registration.user_id, user_id))
            .order_by(Registration.created_at.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
