from datetime import datetime
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi import FastAPI, APIRouter
from httpx import ASGITransport, AsyncClient

from database import get_db
from models.event import Event
from models.payment import Payment, PaymentStatus as DBPaymentStatus, PaymentType
from models.registration import Registration, RegistrationStatus
from models.registration_refund_task import RegistrationRefundTask
from models.user import AccountStatus, User, UserRole
from models.subscription import Subscription
from models.approval_request import ApprovalRequest
from routers import admin_router
from routers.auth import get_current_user_dependency


@pytest.fixture
async def admin_user(db_session) -> User:
    user = User(
        google_id=f"admin-{uuid4().hex}",
        email=f"admin-{uuid4().hex}@example.com",
        full_name="Admin",
        role=UserRole.ADMIN,
        account_status=AccountStatus.ACTIVE,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def admin_client(db_session, admin_user: User):
    app = FastAPI()
    _api = APIRouter(prefix="/api")
    _api.include_router(admin_router)
    app.include_router(_api)

    async def override_get_db():
        yield db_session

    async def override_current_user_dependency():
        return admin_user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user_dependency] = override_current_user_dependency

    client = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    try:
        yield client
    finally:
        await client.aclose()


async def _create_event(db_session, title: str, start_date: datetime) -> Event:
    event = Event(
        title=title,
        description=f"{title} desc",
        event_type="mors",
        start_date=start_date,
        time_info="10:00",
        city="Poznań",
        price_guest=Decimal("20.00"),
        price_member=Decimal("10.00"),
        max_participants=10,
        version=1,
    )
    db_session.add(event)
    await db_session.commit()
    await db_session.refresh(event)
    return event


class TestAdminUserStats:
    @pytest.mark.asyncio
    async def test_user_stats_returns_admin_when_only_admin_exists(self, admin_client: AsyncClient, admin_user: User):
        response = await admin_client.get("/api/admin/stats/users")

        assert response.status_code == 200
        payload = response.json()
        assert len(payload) == 1
        assert payload[0]["user_id"] == admin_user.id

    @pytest.mark.asyncio
    async def test_user_stats_sorted_by_paid_then_events_then_points(self, db_session, admin_client: AsyncClient):
        u1 = User(
            google_id=f"u1-{uuid4().hex}",
            email=f"u1-{uuid4().hex}@example.com",
            full_name="U1",
            role=UserRole.GUEST,
            account_status=AccountStatus.ACTIVE,
        )
        u2 = User(
            google_id=f"u2-{uuid4().hex}",
            email=f"u2-{uuid4().hex}@example.com",
            full_name="U2",
            role=UserRole.GUEST,
            account_status=AccountStatus.ACTIVE,
        )
        u3 = User(
            google_id=f"u3-{uuid4().hex}",
            email=f"u3-{uuid4().hex}@example.com",
            full_name="U3",
            role=UserRole.GUEST,
            account_status=AccountStatus.ACTIVE,
        )
        db_session.add_all([u1, u2, u3])
        await db_session.commit()
        await db_session.refresh(u1)
        await db_session.refresh(u2)
        await db_session.refresh(u3)
        db_session.add_all(
            [
                Subscription(user_id=u1.id, points=1),
                Subscription(user_id=u2.id, points=5),
                Subscription(user_id=u3.id, points=100),
            ]
        )
        await db_session.commit()

        e1 = await _create_event(db_session, "E1", datetime(2026, 2, 1))
        e2 = await _create_event(db_session, "E2", datetime(2026, 2, 2))

        db_session.add_all(
            [
                Payment(
                    user_id=u1.id,
                    external_id=f"p1-{uuid4().hex}",
                    amount=Decimal("50.00"),
                    currency="PLN",
                    payment_type=PaymentType.EVENT.value,
                    status=DBPaymentStatus.COMPLETED.value,
                ),
                Payment(
                    user_id=u2.id,
                    external_id=f"p2-{uuid4().hex}",
                    amount=Decimal("50.00"),
                    currency="PLN",
                    payment_type=PaymentType.EVENT.value,
                    status=DBPaymentStatus.COMPLETED.value,
                ),
                Payment(
                    user_id=u3.id,
                    external_id=f"p3-{uuid4().hex}",
                    amount=Decimal("40.00"),
                    currency="PLN",
                    payment_type=PaymentType.EVENT.value,
                    status=DBPaymentStatus.COMPLETED.value,
                ),
                Registration(
                    user_id=u1.id,
                    event_id=e1.id,
                    occurrence_date=e1.start_date.date(),
                    status=RegistrationStatus.CONFIRMED.value,
                ),
                Registration(
                    user_id=u2.id,
                    event_id=e1.id,
                    occurrence_date=e1.start_date.date(),
                    status=RegistrationStatus.CONFIRMED.value,
                ),
                Registration(
                    user_id=u2.id,
                    event_id=e2.id,
                    occurrence_date=e2.start_date.date(),
                    status=RegistrationStatus.CONFIRMED.value,
                ),
            ]
        )
        await db_session.commit()

        response = await admin_client.get("/api/admin/stats/users")

        assert response.status_code == 200
        payload = response.json()
        ids = [item["user_id"] for item in payload if item["user_id"] in {u1.id, u2.id, u3.id}]
        assert ids[:3] == [u2.id, u1.id, u3.id]


class TestAdminPendingUsersAndApprove:
    @pytest.mark.asyncio
    async def test_pending_users_returns_only_pending(self, db_session, admin_client: AsyncClient):
        pending = User(
            google_id=f"pending-{uuid4().hex}",
            email=f"pending-{uuid4().hex}@example.com",
            full_name="Pending",
            role=UserRole.GUEST,
            account_status=AccountStatus.PENDING,
        )
        pending_unsubmitted = User(
            google_id=f"pending-unsubmitted-{uuid4().hex}",
            email=f"pending-unsubmitted-{uuid4().hex}@example.com",
            full_name="Pending Unsubmitted",
            role=UserRole.GUEST,
            account_status=AccountStatus.PENDING,
        )
        active = User(
            google_id=f"active-{uuid4().hex}",
            email=f"active-{uuid4().hex}@example.com",
            full_name="Active",
            role=UserRole.GUEST,
            account_status=AccountStatus.ACTIVE,
        )
        db_session.add_all([pending, pending_unsubmitted, active])
        await db_session.commit()
        db_session.add(ApprovalRequest(user_id=pending.id))
        await db_session.commit()

        response = await admin_client.get("/api/admin/users/pending")

        assert response.status_code == 200
        emails = [item["email"] for item in response.json()]
        assert pending.email in emails
        assert pending_unsubmitted.email not in emails
        assert active.email not in emails

    @pytest.mark.asyncio
    async def test_approve_user_returns_404_for_missing_user(self, admin_client: AsyncClient):
        response = await admin_client.post("/api/admin/users/999999/approve")

        assert response.status_code == 404
        assert response.json()["detail"] == "User not found"

    @pytest.mark.asyncio
    async def test_approve_user_activates_pending(self, db_session, admin_client: AsyncClient):
        user = User(
            google_id=f"to-approve-{uuid4().hex}",
            email=f"to-approve-{uuid4().hex}@example.com",
            full_name="To Approve",
            role=UserRole.GUEST,
            account_status=AccountStatus.PENDING,
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        db_session.add(ApprovalRequest(user_id=user.id))
        await db_session.commit()

        response = await admin_client.post(f"/api/admin/users/{user.id}/approve")

        assert response.status_code == 200
        assert response.json()["account_status"] == AccountStatus.ACTIVE.value

    @pytest.mark.asyncio
    async def test_approve_user_rejects_pending_without_submitted_request(self, db_session, admin_client: AsyncClient):
        user = User(
            google_id=f"to-approve-no-request-{uuid4().hex}",
            email=f"to-approve-no-request-{uuid4().hex}@example.com",
            full_name="To Approve No Request",
            role=UserRole.GUEST,
            account_status=AccountStatus.PENDING,
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        response = await admin_client.post(f"/api/admin/users/{user.id}/approve")

        assert response.status_code == 409
        assert response.json()["detail"] == "User has not submitted join request"

    @pytest.mark.asyncio
    async def test_approve_user_leaves_active_as_active(self, db_session, admin_client: AsyncClient):
        user = User(
            google_id=f"already-active-{uuid4().hex}",
            email=f"already-active-{uuid4().hex}@example.com",
            full_name="Already Active",
            role=UserRole.GUEST,
            account_status=AccountStatus.ACTIVE,
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        response = await admin_client.post(f"/api/admin/users/{user.id}/approve")

        assert response.status_code == 200
        assert response.json()["account_status"] == AccountStatus.ACTIVE.value


class TestAdminPaymentStats:
    @pytest.mark.asyncio
    async def test_payment_stats_aggregates_by_status_and_type(self, db_session, admin_client: AsyncClient):
        user = User(
            google_id=f"pay-{uuid4().hex}",
            email=f"pay-{uuid4().hex}@example.com",
            full_name="Pay User",
            role=UserRole.GUEST,
            account_status=AccountStatus.ACTIVE,
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        db_session.add_all(
            [
                Payment(
                    user_id=user.id,
                    external_id=f"p1-{uuid4().hex}",
                    amount=Decimal("100.00"),
                    currency="PLN",
                    payment_type=PaymentType.EVENT.value,
                    status=DBPaymentStatus.COMPLETED.value,
                    created_at=datetime(2026, 2, 5),
                ),
                Payment(
                    user_id=user.id,
                    external_id=f"p2-{uuid4().hex}",
                    amount=Decimal("20.00"),
                    currency="PLN",
                    payment_type=PaymentType.SUBSCRIPTION.value,
                    status=DBPaymentStatus.REFUNDED.value,
                    created_at=datetime(2026, 2, 6),
                ),
                Payment(
                    user_id=user.id,
                    external_id=f"p3-{uuid4().hex}",
                    amount=Decimal("10.00"),
                    currency="PLN",
                    payment_type=PaymentType.EVENT.value,
                    status=DBPaymentStatus.PENDING.value,
                    created_at=datetime(2026, 2, 7),
                ),
            ]
        )
        await db_session.commit()

        response = await admin_client.get("/api/admin/stats/payments?month=2026-02")

        assert response.status_code == 200
        payload = response.json()
        assert payload["total_count"] == 3
        assert payload["total_amount"].startswith("130.00")
        assert payload["completed_count"] == 1
        assert payload["completed_amount"].startswith("100.00")
        assert payload["refunded_count"] == 1
        assert payload["refunded_amount"].startswith("20.00")
        assert any(row["status"] == DBPaymentStatus.COMPLETED.value for row in payload["by_status"])
        assert any(row["payment_type"] == PaymentType.EVENT.value for row in payload["by_type"])


class TestAdminManualPaymentQueues:
    @pytest.mark.asyncio
    async def test_list_pending_manual_payments(self, db_session, admin_client: AsyncClient):
        participant = User(
            google_id=f"manual-admin-user-{uuid4().hex}",
            email=f"manual-admin-user-{uuid4().hex}@example.com",
            full_name="Manual Participant",
            role=UserRole.GUEST,
            account_status=AccountStatus.ACTIVE,
        )
        event = await _create_event(db_session, "Manual Queue Event", datetime(2026, 3, 1))
        event.manual_payment_verification = True
        event.manual_payment_url = "https://payments.example/manual"
        event.manual_payment_due_hours = 24
        db_session.add_all([participant, event])
        await db_session.commit()
        await db_session.refresh(participant)
        await db_session.refresh(event)

        registration = Registration(
            user_id=participant.id,
            event_id=event.id,
            occurrence_date=event.start_date.date(),
            status=RegistrationStatus.MANUAL_PAYMENT_VERIFICATION.value,
            manual_payment_confirmed_at=datetime(2026, 2, 10, 12, 0, 0),
        )
        payment = Payment(
            user_id=participant.id,
            external_id=f"manual-pay-{uuid4().hex}",
            amount=Decimal("55.00"),
            currency="PLN",
            payment_type=PaymentType.EVENT.value,
            status=DBPaymentStatus.PROCESSING.value,
            extra_data='{"manual_payment_reference":"REF-MANUAL-123"}',
        )
        registration.payment_id = payment.external_id
        db_session.add_all([payment, registration])
        await db_session.commit()
        await db_session.refresh(registration)

        response = await admin_client.get("/api/admin/manual-payments/pending")
        assert response.status_code == 200
        payload = response.json()
        assert len(payload) == 1
        row = payload[0]
        assert row["registration_id"] == registration.id
        assert row["status"] == RegistrationStatus.MANUAL_PAYMENT_VERIFICATION.value
        assert row["transfer_reference"] == "REF-MANUAL-123"

    @pytest.mark.asyncio
    async def test_approve_pending_manual_payment_marks_registration_confirmed(self, db_session, admin_client: AsyncClient):
        participant = User(
            google_id=f"manual-approve-user-{uuid4().hex}",
            email=f"manual-approve-user-{uuid4().hex}@example.com",
            full_name="Manual Approve User",
            role=UserRole.GUEST,
            account_status=AccountStatus.ACTIVE,
        )
        event = await _create_event(db_session, "Manual Approve Event", datetime(2026, 3, 2))
        event.manual_payment_verification = True
        event.manual_payment_url = "https://payments.example/manual"
        event.manual_payment_due_hours = 24
        db_session.add_all([participant, event])
        await db_session.commit()
        await db_session.refresh(participant)
        await db_session.refresh(event)

        payment = Payment(
            user_id=participant.id,
            external_id=f"manual-approve-{uuid4().hex}",
            amount=Decimal("45.00"),
            currency="PLN",
            payment_type=PaymentType.EVENT.value,
            status=DBPaymentStatus.PROCESSING.value,
        )
        registration = Registration(
            user_id=participant.id,
            event_id=event.id,
            occurrence_date=event.start_date.date(),
            status=RegistrationStatus.MANUAL_PAYMENT_VERIFICATION.value,
            payment_id=payment.external_id,
            manual_payment_confirmed_at=datetime(2026, 2, 10, 12, 0, 0),
        )
        db_session.add_all([payment, registration])
        await db_session.commit()
        await db_session.refresh(registration)

        response = await admin_client.post(f"/api/admin/manual-payments/{registration.id}/approve")
        assert response.status_code == 200
        assert response.json()["status"] == RegistrationStatus.CONFIRMED.value

        await db_session.refresh(registration)
        await db_session.refresh(payment)
        assert registration.status == RegistrationStatus.CONFIRMED.value
        assert payment.status == DBPaymentStatus.COMPLETED.value

    @pytest.mark.asyncio
    async def test_refund_task_update_requires_override_reason(self, db_session, admin_client: AsyncClient):
        participant = User(
            google_id=f"manual-refund-user-{uuid4().hex}",
            email=f"manual-refund-user-{uuid4().hex}@example.com",
            full_name="Manual Refund User",
            role=UserRole.GUEST,
            account_status=AccountStatus.ACTIVE,
        )
        event = await _create_event(db_session, "Manual Refund Event", datetime(2026, 3, 3))
        db_session.add_all([participant, event])
        await db_session.commit()
        await db_session.refresh(participant)
        await db_session.refresh(event)

        registration = Registration(
            user_id=participant.id,
            event_id=event.id,
            occurrence_date=event.start_date.date(),
            status=RegistrationStatus.CANCELLED.value,
            payment_id=f"manual-refund-{uuid4().hex}",
        )
        db_session.add(registration)
        await db_session.commit()
        await db_session.refresh(registration)

        task = RegistrationRefundTask(
            registration_id=registration.id,
            user_id=participant.id,
            event_id=event.id,
            occurrence_date=registration.occurrence_date,
            refund_eligible=True,
            recommended_should_refund=True,
            should_refund=True,
            refund_marked_paid=False,
        )
        db_session.add(task)
        await db_session.commit()
        await db_session.refresh(task)

        invalid = await admin_client.patch(
            f"/api/admin/manual-payments/refunds/{task.id}",
            json={"should_refund": False},
        )
        assert invalid.status_code == 422

        valid = await admin_client.patch(
            f"/api/admin/manual-payments/refunds/{task.id}",
            json={"should_refund": False, "override_reason": "Manual exception approved"},
        )
        assert valid.status_code == 200
        assert valid.json()["should_refund"] is False
        assert valid.json()["override_reason"] == "Manual exception approved"

    @pytest.mark.asyncio
    async def test_waitlist_promotions_update_notified_flag(self, db_session, admin_client: AsyncClient):
        participant = User(
            google_id=f"manual-promo-user-{uuid4().hex}",
            email=f"manual-promo-user-{uuid4().hex}@example.com",
            full_name="Manual Promo User",
            role=UserRole.GUEST,
            account_status=AccountStatus.ACTIVE,
        )
        event = await _create_event(db_session, "Manual Promo Event", datetime(2026, 3, 4))
        event.manual_payment_verification = True
        event.manual_payment_url = "https://payments.example/manual"
        event.manual_payment_due_hours = 24
        db_session.add_all([participant, event])
        await db_session.commit()
        await db_session.refresh(participant)
        await db_session.refresh(event)

        registration = Registration(
            user_id=participant.id,
            event_id=event.id,
            occurrence_date=event.start_date.date(),
            status=RegistrationStatus.MANUAL_PAYMENT_REQUIRED.value,
            promoted_from_waitlist_at=datetime(2026, 2, 10, 10, 0, 0),
            manual_payment_due_at=datetime(2026, 2, 11, 10, 0, 0),
            waitlist_notification_sent=False,
        )
        db_session.add(registration)
        await db_session.commit()
        await db_session.refresh(registration)

        list_response = await admin_client.get("/api/admin/manual-payments/promotions")
        assert list_response.status_code == 200
        assert any(row["registration_id"] == registration.id for row in list_response.json())

        update_response = await admin_client.patch(
            f"/api/admin/manual-payments/promotions/{registration.id}",
            json={"waitlist_notification_sent": True},
        )
        assert update_response.status_code == 200
        assert update_response.json()["waitlist_notification_sent"] is True

        await db_session.refresh(registration)
        assert registration.waitlist_notification_sent is True
        assert registration.waitlist_notified_at is not None


class TestAdminRegistrationStats:
    @pytest.mark.asyncio
    async def test_registration_stats_counts_and_top_events(self, db_session, admin_client: AsyncClient):
        u1 = User(
            google_id=f"reg-{uuid4().hex}",
            email=f"reg-{uuid4().hex}@example.com",
            full_name="Reg One",
            role=UserRole.GUEST,
            account_status=AccountStatus.ACTIVE,
        )
        u2 = User(
            google_id=f"reg-{uuid4().hex}",
            email=f"reg-{uuid4().hex}@example.com",
            full_name="Reg Two",
            role=UserRole.GUEST,
            account_status=AccountStatus.ACTIVE,
        )
        db_session.add_all([u1, u2])
        await db_session.commit()
        await db_session.refresh(u1)
        await db_session.refresh(u2)

        e1 = await _create_event(db_session, "Event One", datetime(2026, 2, 10))
        e2 = await _create_event(db_session, "Event Two", datetime(2026, 2, 12))

        db_session.add_all(
            [
                Registration(
                    user_id=u1.id,
                    event_id=e1.id,
                    occurrence_date=datetime(2026, 2, 10).date(),
                    status=RegistrationStatus.CONFIRMED.value,
                ),
                Registration(
                    user_id=u2.id,
                    event_id=e1.id,
                    occurrence_date=datetime(2026, 2, 10).date(),
                    status=RegistrationStatus.CONFIRMED.value,
                ),
                Registration(
                    user_id=u1.id,
                    event_id=e2.id,
                    occurrence_date=datetime(2026, 2, 12).date(),
                    status=RegistrationStatus.PENDING.value,
                ),
                Registration(
                    user_id=u2.id,
                    event_id=e2.id,
                    occurrence_date=datetime(2026, 2, 12).date(),
                    status=RegistrationStatus.CANCELLED.value,
                ),
            ]
        )
        await db_session.commit()

        response = await admin_client.get("/api/admin/stats/registrations?month=2026-02")

        assert response.status_code == 200
        payload = response.json()
        assert payload["total_count"] == 4
        assert payload["confirmed_count"] == 2
        assert payload["pending_count"] == 1
        assert payload["cancelled_count"] == 1
        assert payload["unique_users"] == 2
        assert payload["unique_events"] == 2
        assert payload["top_events"][0]["event_id"] == e1.id

