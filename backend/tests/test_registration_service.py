"""
Tests for Registration Service.

These tests verify the registration workflow including:
- Event availability checking
- Registration initiation
- Payment flow
- Concurrency handling
- Cancellation and refunds
"""
import pytest
import asyncio
from decimal import Decimal
from datetime import datetime, timedelta
from sqlalchemy import select

from models.user import User, UserRole, AccountStatus
from models.event import Event
from models.registration import Registration, RegistrationStatus
from models.registration_refund_task import RegistrationRefundTask
from services.registration_service import (
    RegistrationService,
    AlreadyRegisteredError,
    EventNotFoundError,
    ConcurrencyError,
    RegistrationError,
    AccountNotApprovedError,
)


class TestEventAvailability:
    """Tests for event availability checking."""

    @pytest.mark.asyncio
    async def test_check_availability_with_spots(
        self,
        registration_service: RegistrationService,
        test_event: Event,
    ):
        """Test checking availability for event with spots."""
        availability = await registration_service.check_availability(test_event.id)

        assert availability["event_id"] == test_event.id
        assert availability["max_participants"] == 10
        assert availability["confirmed_count"] == 0
        assert availability["waitlist_count"] == 0
        assert availability["available_spots"] == 10
        assert availability["is_available"] is True

    @pytest.mark.asyncio
    async def test_check_availability_nonexistent_event(
        self,
        registration_service: RegistrationService,
    ):
        """Test checking availability for non-existent event."""
        with pytest.raises(EventNotFoundError):
            await registration_service.check_availability("00000000-0000-0000-0000-000009999999")


class TestFreeEventRegistration:
    """Tests for free event registration."""

    @pytest.mark.asyncio
    async def test_register_for_free_event(
        self,
        registration_service: RegistrationService,
        test_user: User,
        test_free_event: Event,
    ):
        """Test registering for a free event."""
        result = await registration_service.initiate_registration(
            user=test_user,
            event_id=test_free_event.id,
            return_url="http://localhost/success",
            cancel_url="http://localhost/cancel",
        )

        assert result["status"] == "confirmed"
        assert result["is_free"] is True
        assert result["redirect_url"] is None

    @pytest.mark.asyncio
    async def test_free_event_confirms_immediately(
        self,
        registration_service: RegistrationService,
        test_user: User,
        test_free_event: Event,
        db_session,
    ):
        """Test that free events are confirmed immediately."""
        result = await registration_service.initiate_registration(
            user=test_user,
            event_id=test_free_event.id,
            return_url="http://localhost/success",
            cancel_url="http://localhost/cancel",
        )

        participants = await registration_service.get_confirmed_participants(test_free_event.id)
        assert len(participants) == 1
        assert participants[0]["full_name"] == test_user.full_name


class TestPaidEventRegistration:
    """Tests for paid event registration."""

    @pytest.mark.asyncio
    async def test_register_for_paid_event_as_guest(
        self,
        registration_service: RegistrationService,
        test_user: User,
        test_event: Event,
    ):
        """Test registering for a paid event as guest."""
        result = await registration_service.initiate_registration(
            user=test_user,
            event_id=test_event.id,
            return_url="http://localhost/success",
            cancel_url="http://localhost/cancel",
        )

        assert result["status"] == "pending_payment"
        assert result["is_free"] is False
        assert result["redirect_url"] is not None
        assert result["payment_id"] is not None
        assert result["amount"] == "50.00"  # Guest price

    @pytest.mark.asyncio
    async def test_register_for_paid_event_as_member(
        self,
        registration_service: RegistrationService,
        test_member: User,
        test_event: Event,
    ):
        """Test registering for a paid event as member."""
        result = await registration_service.initiate_registration(
            user=test_member,
            event_id=test_event.id,
            return_url="http://localhost/success",
            cancel_url="http://localhost/cancel",
        )

        assert result["status"] == "pending_payment"
        assert result["amount"] == "30.00"  # Member price

    @pytest.mark.asyncio
    async def test_subscription_required_blocks_guest(
        self,
        registration_service: RegistrationService,
        test_user: User,
        test_subscription_event: Event,
    ):
        """Test that subscription-only events block non-members."""
        with pytest.raises(RegistrationError):
            await registration_service.initiate_registration(
                user=test_user,
                event_id=test_subscription_event.id,
                return_url="http://localhost/success",
                cancel_url="http://localhost/cancel",
            )


class TestRegistrationValidation:
    """Tests for registration validation."""

    @pytest.mark.asyncio
    async def test_cannot_register_twice(
        self,
        registration_service: RegistrationService,
        test_user: User,
        test_free_event: Event,
    ):
        """Test that user cannot register twice for same event."""
        await registration_service.initiate_registration(
            user=test_user,
            event_id=test_free_event.id,
            return_url="http://localhost/success",
            cancel_url="http://localhost/cancel",
        )

        with pytest.raises(AlreadyRegisteredError):
            await registration_service.initiate_registration(
                user=test_user,
                event_id=test_free_event.id,
                return_url="http://localhost/success",
                cancel_url="http://localhost/cancel",
            )

    @pytest.mark.asyncio
    async def test_full_event_adds_user_to_waitlist(
        self,
        registration_service: RegistrationService,
        test_user: User,
        test_member: User,
        test_full_event: Event,
        db_session,
    ):
        """Test that registration fails when event is full."""
        reg1 = Registration(
            user_id=test_user.id,
            event_id=test_full_event.id,
            occurrence_date=test_full_event.start_date.date(),
            status=RegistrationStatus.CONFIRMED.value,
        )
        db_session.add(reg1)
        await db_session.commit()

        from models.user import User, UserRole, AccountStatus
        user3 = User(
            google_id="google_789",
            email="user3@example.com",
            full_name="User Three",
            role=UserRole.GUEST,
            account_status=AccountStatus.ACTIVE,
        )
        db_session.add(user3)
        await db_session.commit()
        await db_session.refresh(user3)

        reg2 = Registration(
            user_id=user3.id,
            event_id=test_full_event.id,
            occurrence_date=test_full_event.start_date.date(),
            status=RegistrationStatus.CONFIRMED.value,
        )
        db_session.add(reg2)
        await db_session.commit()

        result = await registration_service.initiate_registration(
            user=test_member,
            event_id=test_full_event.id,
            return_url="http://localhost/success",
            cancel_url="http://localhost/cancel",
        )
        assert result["status"] == RegistrationStatus.WAITLIST.value
        assert result["is_waitlisted"] is True

        availability = await registration_service.check_availability(test_full_event.id)
        assert availability["confirmed_count"] == 2
        assert availability["waitlist_count"] == 1

    @pytest.mark.asyncio
    async def test_pending_user_cannot_register(
        self,
        registration_service: RegistrationService,
        test_event: Event,
        db_session,
    ):
        """Test that pending users cannot register for events."""
        pending_user = User(
            google_id="pending_google_123",
            email="pending@example.com",
            full_name="Pending User",
            role=UserRole.GUEST,
            account_status=AccountStatus.PENDING,
        )
        db_session.add(pending_user)
        await db_session.commit()
        await db_session.refresh(pending_user)

        with pytest.raises(AccountNotApprovedError):
            await registration_service.initiate_registration(
                user=pending_user,
                event_id=test_event.id,
                return_url="http://localhost/success",
                cancel_url="http://localhost/cancel",
            )

    @pytest.mark.asyncio
    async def test_waitlist_is_unlimited(
        self,
        registration_service: RegistrationService,
        test_user: User,
        test_full_event: Event,
        db_session,
    ):
        """Event waitlist should accept any number of additional users."""
        confirmed = Registration(
            user_id=test_user.id,
            event_id=test_full_event.id,
            occurrence_date=test_full_event.start_date.date(),
            status=RegistrationStatus.CONFIRMED.value,
        )
        filler = User(
            google_id="waitlist-filler",
            email="waitlist-filler@example.com",
            full_name="Waitlist Filler",
            role=UserRole.GUEST,
            account_status=AccountStatus.ACTIVE,
        )
        db_session.add_all([confirmed, filler])
        await db_session.commit()
        await db_session.refresh(filler)

        second_confirmed = Registration(
            user_id=filler.id,
            event_id=test_full_event.id,
            occurrence_date=test_full_event.start_date.date(),
            status=RegistrationStatus.CONFIRMED.value,
        )
        db_session.add(second_confirmed)
        await db_session.commit()

        waitlist_results: list[dict] = []
        for idx in range(5):
            candidate = User(
                google_id=f"waitlist-{idx}",
                email=f"waitlist-{idx}@example.com",
                full_name=f"Waitlist {idx}",
                role=UserRole.GUEST,
                account_status=AccountStatus.ACTIVE,
            )
            db_session.add(candidate)
            await db_session.commit()
            await db_session.refresh(candidate)

            row = await registration_service.initiate_registration(
                user=candidate,
                event_id=test_full_event.id,
                return_url="http://localhost/success",
                cancel_url="http://localhost/cancel",
            )
            waitlist_results.append(row)

        assert all(item["status"] == RegistrationStatus.WAITLIST.value for item in waitlist_results)
        assert all(item["is_waitlisted"] is True for item in waitlist_results)

        availability = await registration_service.check_availability(test_full_event.id)
        assert availability["confirmed_count"] == 2
        assert availability["waitlist_count"] == 5

    @pytest.mark.asyncio
    async def test_occurrence_date_must_match_event_date(
        self,
        registration_service: RegistrationService,
        test_user: User,
        db_session,
    ):
        """Registration should reject occurrence dates that do not match the event date."""
        base_start = datetime.now() + timedelta(days=7)
        base_start = base_start.replace(hour=10, minute=0, second=0, microsecond=0)
        event = Event(
            title="Single Event",
            description="Occurrence validation",
            event_type="mors",
            start_date=base_start,
            end_date=base_start + timedelta(hours=1),
            city="Poznań",
            price_guest=Decimal("0.00"),
            price_member=Decimal("0.00"),
            max_participants=20,
            version=1,
        )
        db_session.add(event)
        await db_session.commit()
        await db_session.refresh(event)

        invalid_occurrence = (base_start + timedelta(days=7)).date()
        with pytest.raises(RegistrationError):
            await registration_service.initiate_registration(
                user=test_user,
                event_id=event.id,
                return_url="http://localhost/success",
                cancel_url="http://localhost/cancel",
                occurrence_date=invalid_occurrence,
            )


class TestPaymentConfirmation:
    """Tests for payment confirmation."""

    @pytest.mark.asyncio
    async def test_confirm_registration_after_payment(
        self,
        registration_service: RegistrationService,
        payment_gateway,
        test_user: User,
        test_event: Event,
    ):
        """Test confirming registration after payment."""
        result = await registration_service.initiate_registration(
            user=test_user,
            event_id=test_event.id,
            return_url="http://localhost/success",
            cancel_url="http://localhost/cancel",
        )

        payment_id = result["payment_id"]

        payment_gateway.complete_payment(payment_id)

        registration = await registration_service.confirm_registration(payment_id)

        assert registration is not None
        assert registration.status == RegistrationStatus.CONFIRMED.value

    @pytest.mark.asyncio
    async def test_confirm_registration_skips_pending_user(
        self,
        registration_service: RegistrationService,
        test_event: Event,
        db_session,
    ):
        """Test that pending users are not auto-confirmed after payment callback."""
        pending_user = User(
            google_id="pending_google_456",
            email="pending-confirm@example.com",
            full_name="Pending Confirm User",
            role=UserRole.GUEST,
            account_status=AccountStatus.PENDING,
        )
        db_session.add(pending_user)
        await db_session.commit()
        await db_session.refresh(pending_user)

        registration = Registration(
            user_id=pending_user.id,
            event_id=test_event.id,
            occurrence_date=test_event.start_date.date(),
            status=RegistrationStatus.PENDING.value,
            payment_id="pay_pending_1",
        )
        db_session.add(registration)
        await db_session.commit()
        await db_session.refresh(registration)

        confirmed = await registration_service.confirm_registration("pay_pending_1")
        await db_session.refresh(registration)

        assert confirmed is not None
        assert registration.status == RegistrationStatus.PENDING.value


class TestCancellation:
    """Tests for registration cancellation."""

    @pytest.mark.asyncio
    async def test_cancel_registration(
        self,
        registration_service: RegistrationService,
        test_user: User,
        test_free_event: Event,
    ):
        """Test cancelling a registration."""
        result = await registration_service.initiate_registration(
            user=test_user,
            event_id=test_free_event.id,
            return_url="http://localhost/success",
            cancel_url="http://localhost/cancel",
        )

        cancel_result = await registration_service.cancel_registration(
            registration_id=result["registration_id"],
            user_id=test_user.id,
        )

        assert cancel_result["success"] is True

    @pytest.mark.asyncio
    async def test_confirmed_cancellation_promotes_waitlisted_for_free_event(
        self,
        registration_service: RegistrationService,
        test_user: User,
        db_session,
    ):
        """Cancelling a confirmed free registration promotes the next waitlisted user."""
        event = Event(
            title="Waitlist Promotion Event",
            description="Free event",
            event_type="mors",
            start_date=datetime.now() + timedelta(days=3),
            city="Poznań",
            price_guest=Decimal("0.00"),
            price_member=Decimal("0.00"),
            max_participants=1,
            version=1,
        )
        waitlisted_user = User(
            google_id="waitlist-promote-1",
            email="waitlist-promote-1@example.com",
            full_name="Waitlisted User",
            role=UserRole.GUEST,
            account_status=AccountStatus.ACTIVE,
        )
        db_session.add_all([event, waitlisted_user])
        await db_session.commit()
        await db_session.refresh(event)
        await db_session.refresh(waitlisted_user)

        confirmed = await registration_service.initiate_registration(
            user=test_user,
            event_id=event.id,
            return_url="http://localhost/success",
            cancel_url="http://localhost/cancel",
        )
        waitlisted = await registration_service.initiate_registration(
            user=waitlisted_user,
            event_id=event.id,
            return_url="http://localhost/success",
            cancel_url="http://localhost/cancel",
        )

        assert waitlisted["status"] == RegistrationStatus.WAITLIST.value

        cancel_result = await registration_service.cancel_registration(
            registration_id=confirmed["registration_id"],
            user_id=test_user.id,
        )
        assert cancel_result["success"] is True

        promoted_row = await db_session.execute(
            select(Registration).where(Registration.id == waitlisted["registration_id"])
        )
        promoted = promoted_row.scalar_one()
        assert promoted.status == RegistrationStatus.CONFIRMED.value


class TestParticipantsList:
    """Tests for participants list."""

    @pytest.mark.asyncio
    async def test_get_confirmed_participants(
        self,
        registration_service: RegistrationService,
        test_user: User,
        test_member: User,
        test_free_event: Event,
    ):
        """Test getting list of confirmed participants."""
        await registration_service.initiate_registration(
            user=test_user,
            event_id=test_free_event.id,
            return_url="http://localhost/success",
            cancel_url="http://localhost/cancel",
        )

        await registration_service.initiate_registration(
            user=test_member,
            event_id=test_free_event.id,
            return_url="http://localhost/success",
            cancel_url="http://localhost/cancel",
        )

        participants = await registration_service.get_confirmed_participants(test_free_event.id)

        assert len(participants) == 2
        names = [p["full_name"] for p in participants]
        assert test_user.full_name in names
        assert test_member.full_name in names

    @pytest.mark.asyncio
    async def test_get_waitlist_participants_returns_only_waitlist(
        self,
        registration_service: RegistrationService,
        test_user: User,
        test_member: User,
        test_free_event: Event,
        db_session,
    ):
        """Waitlist endpoint data should exclude confirmed participants."""
        test_free_event.max_participants = 1
        db_session.add(test_free_event)
        await db_session.commit()
        await db_session.refresh(test_free_event)

        await registration_service.initiate_registration(
            user=test_user,
            event_id=test_free_event.id,
            return_url="http://localhost/success",
            cancel_url="http://localhost/cancel",
        )

        waitlisted = await registration_service.initiate_registration(
            user=test_member,
            event_id=test_free_event.id,
            return_url="http://localhost/success",
            cancel_url="http://localhost/cancel",
        )
        assert waitlisted["status"] == RegistrationStatus.WAITLIST.value

        confirmed = await registration_service.get_confirmed_participants(test_free_event.id)
        waitlist = await registration_service.get_waitlist_participants(test_free_event.id)

        assert len(confirmed) == 1
        assert len(waitlist) == 1
        assert confirmed[0]["user_id"] == test_user.id
        assert waitlist[0]["user_id"] == test_member.id

        waitlist_registration = await db_session.execute(
            select(Registration).where(Registration.id == waitlisted["registration_id"])
        )
        assert waitlist_registration.scalar_one().status == RegistrationStatus.WAITLIST.value


class TestConcurrency:
    """Tests for concurrent registration handling."""

    @pytest.mark.asyncio
    async def test_optimistic_locking_increments_version(
        self,
        registration_service: RegistrationService,
        test_user: User,
        test_free_event: Event,
        db_session,
    ):
        """Test that registration increments event version."""
        initial_version = test_free_event.version

        await registration_service.initiate_registration(
            user=test_user,
            event_id=test_free_event.id,
            return_url="http://localhost/success",
            cancel_url="http://localhost/cancel",
        )

        await db_session.refresh(test_free_event)

        assert test_free_event.version == initial_version + 1

    @pytest.mark.asyncio
    async def test_availability_decreases_after_registration(
        self,
        registration_service: RegistrationService,
        test_user: User,
        test_event: Event,
        payment_gateway,
    ):
        """Test that available spots decrease after confirmed registration."""
        initial = await registration_service.check_availability(test_event.id)
        assert initial["available_spots"] == 10

        result = await registration_service.initiate_registration(
            user=test_user,
            event_id=test_event.id,
            return_url="http://localhost/success",
            cancel_url="http://localhost/cancel",
        )

        payment_gateway.complete_payment(result["payment_id"])
        await registration_service.confirm_registration(result["payment_id"])

        after = await registration_service.check_availability(test_event.id)
        assert after["available_spots"] == 9
        assert after["confirmed_count"] == 1


class TestManualPaymentVerification:
    @pytest.mark.asyncio
    async def test_manual_payment_registration_happy_path(
        self,
        registration_service: RegistrationService,
        test_user: User,
        db_session,
    ):
        event = Event(
            title="Manual Paid Event",
            description="Manual payment",
            event_type="mors",
            start_date=datetime.now() + timedelta(days=5),
            city="Poznań",
            price_guest=Decimal("40.00"),
            price_member=Decimal("20.00"),
            max_participants=10,
            manual_payment_verification=True,
            manual_payment_url="https://payments.example/manual",
            manual_payment_due_hours=48,
            version=1,
        )
        db_session.add(event)
        await db_session.commit()
        await db_session.refresh(event)

        registration_result = await registration_service.initiate_registration(
            user=test_user,
            event_id=event.id,
            return_url="http://localhost/success",
            cancel_url="http://localhost/cancel",
        )

        assert registration_result["status"] == RegistrationStatus.MANUAL_PAYMENT_REQUIRED.value
        assert registration_result["manual_payment_required"] is True
        assert registration_result["manual_payment_url"] == "https://payments.example/manual"
        assert registration_result["transfer_reference"] == event.id

        confirmation_result = await registration_service.confirm_manual_payment_for_user(
            registration_id=registration_result["registration_id"],
            user_id=test_user.id,
        )
        assert confirmation_result is not None
        assert confirmation_result["status"] == RegistrationStatus.MANUAL_PAYMENT_VERIFICATION.value
        assert confirmation_result["can_confirm"] is False

        approved = await registration_service.approve_manual_payment(registration_result["registration_id"])
        assert approved is not None
        assert approved.status == RegistrationStatus.CONFIRMED.value
        assert approved.payment_id is not None

    @pytest.mark.asyncio
    async def test_manual_payment_cancellation_creates_refund_task_and_promotes_waitlist(
        self,
        registration_service: RegistrationService,
        test_user: User,
        db_session,
    ):
        promoted_candidate = User(
            google_id="manual-promoted-user",
            email="manual-promoted-user@example.com",
            full_name="Promoted User",
            role=UserRole.GUEST,
            account_status=AccountStatus.ACTIVE,
        )
        event = Event(
            title="Manual Waitlist Event",
            description="Manual waitlist",
            event_type="mors",
            start_date=datetime.now() + timedelta(days=6),
            city="Poznań",
            price_guest=Decimal("60.00"),
            price_member=Decimal("30.00"),
            max_participants=1,
            manual_payment_verification=True,
            manual_payment_url="https://payments.example/manual",
            manual_payment_due_hours=24,
            version=1,
        )
        db_session.add_all([promoted_candidate, event])
        await db_session.commit()
        await db_session.refresh(promoted_candidate)
        await db_session.refresh(event)

        first = await registration_service.initiate_registration(
            user=test_user,
            event_id=event.id,
            return_url="http://localhost/success",
            cancel_url="http://localhost/cancel",
        )
        await registration_service.confirm_manual_payment_for_user(
            registration_id=first["registration_id"],
            user_id=test_user.id,
        )
        await registration_service.approve_manual_payment(first["registration_id"])

        second = await registration_service.initiate_registration(
            user=promoted_candidate,
            event_id=event.id,
            return_url="http://localhost/success",
            cancel_url="http://localhost/cancel",
        )
        assert second["status"] == RegistrationStatus.WAITLIST.value

        cancel_result = await registration_service.cancel_registration(
            registration_id=first["registration_id"],
            user_id=test_user.id,
            request_refund=True,
        )
        assert cancel_result["success"] is True
        assert cancel_result["refund_task_id"] is not None

        refund_task_row = await db_session.execute(
            select(RegistrationRefundTask).where(RegistrationRefundTask.registration_id == first["registration_id"])
        )
        refund_task = refund_task_row.scalar_one()
        assert refund_task.recommended_should_refund is True
        assert refund_task.should_refund is True
        assert refund_task.refund_marked_paid is False

        promoted_row = await db_session.execute(
            select(Registration).where(Registration.id == second["registration_id"])
        )
        promoted_registration = promoted_row.scalar_one()
        assert promoted_registration.status == RegistrationStatus.MANUAL_PAYMENT_REQUIRED.value
        assert promoted_registration.promoted_from_waitlist_at is not None
        assert promoted_registration.manual_payment_due_at is not None
