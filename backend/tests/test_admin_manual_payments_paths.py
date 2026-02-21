"""
Comprehensive API tests for every admin manual-payments path.

Covers:
  1. GET  /admin/manual-payments/pending          (list pending)
  2. POST /admin/manual-payments/{id}/approve      (approve pending)
  3. GET  /admin/manual-payments/refunds           (list refunds + new fields)
  4. PATCH /admin/manual-payments/refunds/{id}     (update refund task)
  5. GET  /admin/manual-payments/promotions        (list promotions)
  6. PATCH /admin/manual-payments/promotions/{id}  (toggle notification)
  7. GET  /admin/subscription-purchases/pending    (list sub purchases)
  8. POST /admin/subscription-purchases/{id}/approve (approve sub purchase)

Each endpoint is tested on happy-path and relevant error/edge paths.
New fields tested: recommendation_code, is_resolved.
"""

from datetime import datetime, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from database import get_db
from models.event import Event
from models.payment import Payment, PaymentStatus as DBPaymentStatus, PaymentType, Currency
from models.registration import Registration, RegistrationStatus
from models.registration_refund_task import RegistrationRefundTask
from models.subscription_purchase import SubscriptionPurchase, SubscriptionPurchaseStatus
from models.subscription import Subscription
from models.user import AccountStatus, User, UserRole
from routers import admin_router
from routers.auth import get_current_user_dependency


# ── Fixtures ──────────────────────────────────────────────────────────


@pytest.fixture
async def admin_user(db_session) -> User:
    user = User(
        google_id=f"admin-mp-{uuid4().hex}",
        email=f"admin-mp-{uuid4().hex}@example.com",
        full_name="Admin MP",
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
    app.include_router(admin_router)

    async def override_get_db():
        yield db_session

    async def override_current_user():
        return admin_user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user_dependency] = override_current_user

    client = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    try:
        yield client
    finally:
        await client.aclose()


async def _make_event(db_session, *, manual=False, title=None) -> Event:
    event = Event(
        title=title or f"Event-{uuid4().hex[:8]}",
        description="test",
        event_type="mors",
        start_date=datetime(2026, 4, 1),
        time_info="10:00",
        city="Poznań",
        price_guest=Decimal("50.00"),
        price_member=Decimal("30.00"),
        max_participants=20,
        version=1,
    )
    if manual:
        event.manual_payment_verification = True
        event.manual_payment_url = "https://payments.example/manual"
        event.manual_payment_due_hours = 24
    db_session.add(event)
    await db_session.commit()
    await db_session.refresh(event)
    return event


async def _make_user(db_session, *, role=UserRole.GUEST) -> User:
    uid = uuid4().hex[:10]
    user = User(
        google_id=f"user-{uid}",
        email=f"user-{uid}@example.com",
        full_name=f"User {uid}",
        role=role,
        account_status=AccountStatus.ACTIVE,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


# ── 1. Pending manual payments ────────────────────────────────────────


class TestPendingManualPayments:
    @pytest.mark.asyncio
    async def test_list_empty(self, admin_client: AsyncClient):
        resp = await admin_client.get("/admin/manual-payments/pending")
        assert resp.status_code == 200
        assert resp.json() == []

    @pytest.mark.asyncio
    async def test_list_returns_pending_rows(self, db_session, admin_client: AsyncClient):
        user = await _make_user(db_session)
        event = await _make_event(db_session, manual=True)
        payment = Payment(
            user_id=user.id,
            external_id=f"pay-{uuid4().hex}",
            amount=Decimal("50.00"),
            currency="PLN",
            payment_type=PaymentType.EVENT.value,
            status=DBPaymentStatus.PROCESSING.value,
            extra_data='{"manual_payment_reference":"REF-001"}',
        )
        reg = Registration(
            user_id=user.id,
            event_id=event.id,
            occurrence_date=event.start_date.date(),
            status=RegistrationStatus.MANUAL_PAYMENT_VERIFICATION.value,
            payment_id=payment.external_id,
            manual_payment_confirmed_at=datetime(2026, 2, 1, 12, 0),
        )
        db_session.add_all([payment, reg])
        await db_session.commit()

        resp = await admin_client.get("/admin/manual-payments/pending")
        assert resp.status_code == 200
        rows = resp.json()
        assert len(rows) >= 1
        row = next(r for r in rows if r["registration_id"] == reg.id)
        assert row["transfer_reference"] == "REF-001"
        assert row["user_email"] == user.email
        assert row["event_title"] == event.title
        assert row["status"] == RegistrationStatus.MANUAL_PAYMENT_VERIFICATION.value

    @pytest.mark.asyncio
    async def test_approve_pending_payment(self, db_session, admin_client: AsyncClient):
        user = await _make_user(db_session)
        event = await _make_event(db_session, manual=True)
        payment = Payment(
            user_id=user.id,
            external_id=f"pay-{uuid4().hex}",
            amount=Decimal("50.00"),
            currency="PLN",
            payment_type=PaymentType.EVENT.value,
            status=DBPaymentStatus.PROCESSING.value,
        )
        reg = Registration(
            user_id=user.id,
            event_id=event.id,
            occurrence_date=event.start_date.date(),
            status=RegistrationStatus.MANUAL_PAYMENT_VERIFICATION.value,
            payment_id=payment.external_id,
            manual_payment_confirmed_at=datetime(2026, 2, 1, 12, 0),
        )
        db_session.add_all([payment, reg])
        await db_session.commit()
        await db_session.refresh(reg)

        resp = await admin_client.post(f"/admin/manual-payments/{reg.id}/approve")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == RegistrationStatus.CONFIRMED.value

        await db_session.refresh(reg)
        await db_session.refresh(payment)
        assert reg.status == RegistrationStatus.CONFIRMED.value
        assert payment.status == DBPaymentStatus.COMPLETED.value

    @pytest.mark.asyncio
    async def test_approve_nonexistent_registration_404(self, admin_client: AsyncClient):
        resp = await admin_client.post("/admin/manual-payments/nonexistent-id/approve")
        assert resp.status_code in (404, 409)


# ── 2. Refund tasks ──────────────────────────────────────────────────


class TestRefundTasks:
    async def _make_refund_task(
        self,
        db_session,
        *,
        eligible=True,
        recommended=True,
        should_refund=True,
        refund_paid=False,
        reviewed_by=None,
    ) -> tuple[RegistrationRefundTask, Registration, User, Event]:
        user = await _make_user(db_session)
        event = await _make_event(db_session)
        reg = Registration(
            user_id=user.id,
            event_id=event.id,
            occurrence_date=event.start_date.date(),
            status=RegistrationStatus.CANCELLED.value,
            payment_id=f"pay-ref-{uuid4().hex}",
        )
        db_session.add(reg)
        await db_session.commit()
        await db_session.refresh(reg)

        task = RegistrationRefundTask(
            registration_id=reg.id,
            user_id=user.id,
            event_id=event.id,
            occurrence_date=reg.occurrence_date,
            refund_eligible=eligible,
            recommended_should_refund=recommended,
            should_refund=should_refund,
            refund_marked_paid=refund_paid,
            reviewed_by_admin_id=reviewed_by,
            reviewed_at=datetime.utcnow() if reviewed_by else None,
        )
        db_session.add(task)
        await db_session.commit()
        await db_session.refresh(task)
        return task, reg, user, event

    # ── List refund tasks ──

    @pytest.mark.asyncio
    async def test_list_refunds_empty(self, admin_client: AsyncClient):
        resp = await admin_client.get("/admin/manual-payments/refunds")
        assert resp.status_code == 200
        assert resp.json() == []

    @pytest.mark.asyncio
    async def test_list_refunds_returns_new_fields(self, db_session, admin_client: AsyncClient):
        task, reg, user, event = await self._make_refund_task(db_session)
        resp = await admin_client.get("/admin/manual-payments/refunds")
        assert resp.status_code == 200
        rows = resp.json()
        row = next(r for r in rows if r["task_id"] == task.id)
        assert "recommendation_code" in row
        assert "is_resolved" in row
        assert isinstance(row["recommendation_code"], str)
        assert isinstance(row["is_resolved"], bool)

    # ── Recommendation code: REFUND_CANCELLED_BEFORE_CUTOFF ──

    @pytest.mark.asyncio
    async def test_recommendation_code_refund_before_cutoff(self, db_session, admin_client: AsyncClient):
        """eligible=True, recommended=True, not reviewed → REFUND_CANCELLED_BEFORE_CUTOFF"""
        task, *_ = await self._make_refund_task(
            db_session, eligible=True, recommended=True, should_refund=True, refund_paid=False,
        )
        resp = await admin_client.get("/admin/manual-payments/refunds")
        row = next(r for r in resp.json() if r["task_id"] == task.id)
        assert row["recommendation_code"] == "REFUND_CANCELLED_BEFORE_CUTOFF"
        assert row["is_resolved"] is False

    # ── Recommendation code: NO_REFUND_CANCELLED_AFTER_CUTOFF ──

    @pytest.mark.asyncio
    async def test_recommendation_code_no_refund_after_cutoff(self, db_session, admin_client: AsyncClient):
        """eligible=False, recommended=False, should_refund=False → NO_REFUND_CANCELLED_AFTER_CUTOFF"""
        task, *_ = await self._make_refund_task(
            db_session, eligible=False, recommended=False, should_refund=False, refund_paid=False,
        )
        resp = await admin_client.get("/admin/manual-payments/refunds")
        row = next(r for r in resp.json() if r["task_id"] == task.id)
        assert row["recommendation_code"] == "NO_REFUND_CANCELLED_AFTER_CUTOFF"
        assert row["is_resolved"] is False

    # ── Recommendation code: NO_REFUND_NO_PAYMENT ──

    @pytest.mark.asyncio
    async def test_recommendation_code_no_payment(self, db_session, admin_client: AsyncClient):
        """eligible=True, recommended=False → NO_REFUND_NO_PAYMENT"""
        task, *_ = await self._make_refund_task(
            db_session, eligible=True, recommended=False, should_refund=False, refund_paid=False,
        )
        resp = await admin_client.get("/admin/manual-payments/refunds")
        row = next(r for r in resp.json() if r["task_id"] == task.id)
        assert row["recommendation_code"] == "NO_REFUND_NO_PAYMENT"

    # ── Recommendation code: REFUND_COMPLETED ──

    @pytest.mark.asyncio
    async def test_recommendation_code_refund_completed(self, db_session, admin_client: AsyncClient):
        """refund_marked_paid=True → REFUND_COMPLETED, is_resolved=True"""
        task, *_ = await self._make_refund_task(
            db_session, eligible=True, recommended=True, should_refund=True, refund_paid=True,
        )
        resp = await admin_client.get("/admin/manual-payments/refunds")
        row = next(r for r in resp.json() if r["task_id"] == task.id)
        assert row["recommendation_code"] == "REFUND_COMPLETED"
        assert row["is_resolved"] is True

    # ── Recommendation code: REFUND_ADMIN_OVERRIDE ──

    @pytest.mark.asyncio
    async def test_recommendation_code_admin_override_refund(
        self, db_session, admin_client: AsyncClient, admin_user: User,
    ):
        """reviewed + should_refund != recommended (refund overridden to True) → REFUND_ADMIN_OVERRIDE"""
        task, *_ = await self._make_refund_task(
            db_session,
            eligible=False,
            recommended=False,
            should_refund=True,
            refund_paid=False,
            reviewed_by=admin_user.id,
        )
        resp = await admin_client.get("/admin/manual-payments/refunds")
        row = next(r for r in resp.json() if r["task_id"] == task.id)
        assert row["recommendation_code"] == "REFUND_ADMIN_OVERRIDE"
        # reviewed but should_refund=True → not resolved (waiting for payout)
        assert row["is_resolved"] is False

    # ── Recommendation code: NO_REFUND_ADMIN_OVERRIDE ──

    @pytest.mark.asyncio
    async def test_recommendation_code_admin_override_no_refund(
        self, db_session, admin_client: AsyncClient, admin_user: User,
    ):
        """reviewed + should_refund overridden to False → NO_REFUND_ADMIN_OVERRIDE, is_resolved=True"""
        task, *_ = await self._make_refund_task(
            db_session,
            eligible=True,
            recommended=True,
            should_refund=False,
            refund_paid=False,
            reviewed_by=admin_user.id,
        )
        resp = await admin_client.get("/admin/manual-payments/refunds")
        row = next(r for r in resp.json() if r["task_id"] == task.id)
        assert row["recommendation_code"] == "NO_REFUND_ADMIN_OVERRIDE"
        # reviewed + should_refund=False → resolved
        assert row["is_resolved"] is True

    # ── is_resolved scenarios ──

    @pytest.mark.asyncio
    async def test_is_resolved_false_for_active_task(self, db_session, admin_client: AsyncClient):
        """An unreviewed, unpaid task is not resolved."""
        task, *_ = await self._make_refund_task(
            db_session, eligible=True, recommended=True, should_refund=True, refund_paid=False,
        )
        resp = await admin_client.get("/admin/manual-payments/refunds")
        row = next(r for r in resp.json() if r["task_id"] == task.id)
        assert row["is_resolved"] is False

    @pytest.mark.asyncio
    async def test_is_resolved_true_after_marking_paid(self, db_session, admin_client: AsyncClient):
        """Marking refund as paid makes is_resolved=True."""
        task, reg, user, event = await self._make_refund_task(
            db_session, eligible=True, recommended=True, should_refund=True, refund_paid=False,
        )
        # Create a real payment record so refund payout book-keeping works
        payment = Payment(
            user_id=user.id,
            external_id=reg.payment_id,
            amount=Decimal("50.00"),
            currency="PLN",
            payment_type=PaymentType.EVENT.value,
            status=DBPaymentStatus.COMPLETED.value,
        )
        db_session.add(payment)
        await db_session.commit()

        resp = await admin_client.patch(
            f"/admin/manual-payments/refunds/{task.id}",
            json={"refund_marked_paid": True},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["refund_marked_paid"] is True
        assert body["is_resolved"] is True
        assert body["recommendation_code"] == "REFUND_COMPLETED"

    # ── PATCH refund task: override flows ──

    @pytest.mark.asyncio
    async def test_override_requires_reason(self, db_session, admin_client: AsyncClient):
        """Overriding recommendation without reason → 422."""
        task, *_ = await self._make_refund_task(
            db_session, eligible=True, recommended=True, should_refund=True,
        )
        resp = await admin_client.patch(
            f"/admin/manual-payments/refunds/{task.id}",
            json={"should_refund": False},
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_override_with_short_reason_rejected(self, db_session, admin_client: AsyncClient):
        """Override reason below 8 chars → 422."""
        task, *_ = await self._make_refund_task(
            db_session, eligible=True, recommended=True, should_refund=True,
        )
        resp = await admin_client.patch(
            f"/admin/manual-payments/refunds/{task.id}",
            json={"should_refund": False, "override_reason": "short"},
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_override_with_valid_reason_succeeds(self, db_session, admin_client: AsyncClient):
        """Override with valid reason → 200 with updated fields."""
        task, *_ = await self._make_refund_task(
            db_session, eligible=True, recommended=True, should_refund=True,
        )
        resp = await admin_client.patch(
            f"/admin/manual-payments/refunds/{task.id}",
            json={"should_refund": False, "override_reason": "Event was actually free for this user"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["should_refund"] is False
        assert body["override_reason"] == "Event was actually free for this user"
        assert body["recommendation_code"] == "NO_REFUND_ADMIN_OVERRIDE"
        assert body["is_resolved"] is True  # reviewed + no refund
        assert body["reviewed_at"] is not None

    @pytest.mark.asyncio
    async def test_override_to_refund_with_reason(self, db_session, admin_client: AsyncClient):
        """Override no-refund → refund with reason → REFUND_ADMIN_OVERRIDE."""
        task, *_ = await self._make_refund_task(
            db_session, eligible=False, recommended=False, should_refund=False,
        )
        resp = await admin_client.patch(
            f"/admin/manual-payments/refunds/{task.id}",
            json={"should_refund": True, "override_reason": "Special case compassionate refund"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["should_refund"] is True
        assert body["recommendation_code"] == "REFUND_ADMIN_OVERRIDE"
        assert body["is_resolved"] is False  # still waiting for payout

    @pytest.mark.asyncio
    async def test_cannot_mark_paid_when_should_refund_false(self, db_session, admin_client: AsyncClient):
        """Mark paid when should_refund=False → 422."""
        task, *_ = await self._make_refund_task(
            db_session, eligible=True, recommended=True, should_refund=False,
        )
        resp = await admin_client.patch(
            f"/admin/manual-payments/refunds/{task.id}",
            json={"refund_marked_paid": True},
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_update_nonexistent_refund_task_404(self, admin_client: AsyncClient):
        resp = await admin_client.patch(
            "/admin/manual-payments/refunds/nonexistent-id",
            json={"should_refund": True},
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_same_decision_no_override_reason_needed(self, db_session, admin_client: AsyncClient):
        """Setting should_refund to the same value as recommended → no override reason needed."""
        task, *_ = await self._make_refund_task(
            db_session, eligible=True, recommended=True, should_refund=True,
        )
        resp = await admin_client.patch(
            f"/admin/manual-payments/refunds/{task.id}",
            json={"should_refund": True},
        )
        assert resp.status_code == 200
        assert resp.json()["should_refund"] is True

    @pytest.mark.asyncio
    async def test_mark_paid_then_registration_status_refunded(self, db_session, admin_client: AsyncClient):
        """After marking refund paid, registration status should be REFUNDED."""
        user = await _make_user(db_session)
        event = await _make_event(db_session)
        payment = Payment(
            user_id=user.id,
            external_id=f"pay-refund-flow-{uuid4().hex}",
            amount=Decimal("50.00"),
            currency="PLN",
            payment_type=PaymentType.EVENT.value,
            status=DBPaymentStatus.COMPLETED.value,
        )
        reg = Registration(
            user_id=user.id,
            event_id=event.id,
            occurrence_date=event.start_date.date(),
            status=RegistrationStatus.CANCELLED.value,
            payment_id=payment.external_id,
        )
        db_session.add_all([payment, reg])
        await db_session.commit()
        await db_session.refresh(reg)

        task = RegistrationRefundTask(
            registration_id=reg.id,
            user_id=user.id,
            event_id=event.id,
            occurrence_date=reg.occurrence_date,
            refund_eligible=True,
            recommended_should_refund=True,
            should_refund=True,
            refund_marked_paid=False,
        )
        db_session.add(task)
        await db_session.commit()
        await db_session.refresh(task)

        resp = await admin_client.patch(
            f"/admin/manual-payments/refunds/{task.id}",
            json={"refund_marked_paid": True},
        )
        assert resp.status_code == 200
        assert resp.json()["refund_marked_paid"] is True

        await db_session.refresh(reg)
        assert reg.status == RegistrationStatus.REFUNDED.value


# ── 3. Waitlist promotions ────────────────────────────────────────────


class TestWaitlistPromotions:
    @pytest.mark.asyncio
    async def test_list_promotions_empty(self, admin_client: AsyncClient):
        resp = await admin_client.get("/admin/manual-payments/promotions")
        assert resp.status_code == 200
        assert resp.json() == []

    @pytest.mark.asyncio
    async def test_list_promotions_returns_promoted_rows(self, db_session, admin_client: AsyncClient):
        user = await _make_user(db_session)
        event = await _make_event(db_session, manual=True)
        reg = Registration(
            user_id=user.id,
            event_id=event.id,
            occurrence_date=event.start_date.date(),
            status=RegistrationStatus.MANUAL_PAYMENT_REQUIRED.value,
            promoted_from_waitlist_at=datetime(2026, 2, 10, 10, 0),
            manual_payment_due_at=datetime(2026, 2, 11, 10, 0),
            waitlist_notification_sent=False,
        )
        db_session.add(reg)
        await db_session.commit()
        await db_session.refresh(reg)

        resp = await admin_client.get("/admin/manual-payments/promotions")
        assert resp.status_code == 200
        rows = resp.json()
        row = next(r for r in rows if r["registration_id"] == reg.id)
        assert row["waitlist_notification_sent"] is False
        assert row["user_email"] == user.email

    @pytest.mark.asyncio
    async def test_toggle_notification_on(self, db_session, admin_client: AsyncClient):
        user = await _make_user(db_session)
        event = await _make_event(db_session, manual=True)
        reg = Registration(
            user_id=user.id,
            event_id=event.id,
            occurrence_date=event.start_date.date(),
            status=RegistrationStatus.MANUAL_PAYMENT_REQUIRED.value,
            promoted_from_waitlist_at=datetime(2026, 2, 10, 10, 0),
            manual_payment_due_at=datetime(2026, 2, 11, 10, 0),
            waitlist_notification_sent=False,
        )
        db_session.add(reg)
        await db_session.commit()
        await db_session.refresh(reg)

        resp = await admin_client.patch(
            f"/admin/manual-payments/promotions/{reg.id}",
            json={"waitlist_notification_sent": True},
        )
        assert resp.status_code == 200
        assert resp.json()["waitlist_notification_sent"] is True

        await db_session.refresh(reg)
        assert reg.waitlist_notification_sent is True
        assert reg.waitlist_notified_at is not None

    @pytest.mark.asyncio
    async def test_toggle_notification_off(self, db_session, admin_client: AsyncClient):
        user = await _make_user(db_session)
        event = await _make_event(db_session, manual=True)
        reg = Registration(
            user_id=user.id,
            event_id=event.id,
            occurrence_date=event.start_date.date(),
            status=RegistrationStatus.MANUAL_PAYMENT_REQUIRED.value,
            promoted_from_waitlist_at=datetime(2026, 2, 10, 10, 0),
            manual_payment_due_at=datetime(2026, 2, 11, 10, 0),
            waitlist_notification_sent=True,
            waitlist_notified_at=datetime(2026, 2, 10, 11, 0),
        )
        db_session.add(reg)
        await db_session.commit()
        await db_session.refresh(reg)

        resp = await admin_client.patch(
            f"/admin/manual-payments/promotions/{reg.id}",
            json={"waitlist_notification_sent": False},
        )
        assert resp.status_code == 200
        assert resp.json()["waitlist_notification_sent"] is False

        await db_session.refresh(reg)
        assert reg.waitlist_notification_sent is False
        assert reg.waitlist_notified_at is None

    @pytest.mark.asyncio
    async def test_toggle_nonexistent_promotion_404(self, admin_client: AsyncClient):
        resp = await admin_client.patch(
            "/admin/manual-payments/promotions/nonexistent-id",
            json={"waitlist_notification_sent": True},
        )
        assert resp.status_code == 404


# ── 4. Subscription purchases ────────────────────────────────────────


class TestSubscriptionPurchases:
    @pytest.mark.asyncio
    async def test_list_pending_subs_empty(self, admin_client: AsyncClient):
        resp = await admin_client.get("/admin/subscription-purchases/pending")
        assert resp.status_code == 200
        assert resp.json() == []

    @pytest.mark.asyncio
    async def test_list_pending_subs_returns_rows(self, db_session, admin_client: AsyncClient):
        user = await _make_user(db_session, role=UserRole.MEMBER)
        purchase = SubscriptionPurchase(
            user_id=user.id,
            plan_code="monthly",
            periods=1,
            total_amount=Decimal("49.00"),
            currency="PLN",
            status=SubscriptionPurchaseStatus.MANUAL_PAYMENT_VERIFICATION.value,
            manual_payment_confirmed_at=datetime(2026, 2, 5, 14, 0),
        )
        db_session.add(purchase)
        await db_session.commit()
        await db_session.refresh(purchase)

        resp = await admin_client.get("/admin/subscription-purchases/pending")
        assert resp.status_code == 200
        rows = resp.json()
        row = next(r for r in rows if r["purchase_id"] == purchase.id)
        assert row["plan_code"] == "monthly"
        assert row["status"] == SubscriptionPurchaseStatus.MANUAL_PAYMENT_VERIFICATION.value
        assert row["user_email"] == user.email

    @pytest.mark.asyncio
    async def test_approve_subscription_purchase(self, db_session, admin_client: AsyncClient):
        user = await _make_user(db_session, role=UserRole.MEMBER)
        # Ensure user has a subscription row
        sub = Subscription(user_id=user.id, points=0)
        db_session.add(sub)
        await db_session.commit()

        # Create a Payment record that the approval flow needs
        pay_ext_id = f"sub-pay-{uuid4().hex[:8]}"
        payment = Payment(
            user_id=user.id,
            external_id=pay_ext_id,
            amount=Decimal("49.00"),
            currency=Currency.PLN.value,
            payment_type=PaymentType.SUBSCRIPTION.value,
            status=DBPaymentStatus.PENDING.value,
        )
        db_session.add(payment)
        await db_session.commit()

        purchase = SubscriptionPurchase(
            user_id=user.id,
            plan_code="monthly",
            periods=1,
            total_amount=Decimal("49.00"),
            currency="PLN",
            status=SubscriptionPurchaseStatus.MANUAL_PAYMENT_VERIFICATION.value,
            manual_payment_confirmed_at=datetime(2026, 2, 5, 14, 0),
            payment_id=pay_ext_id,
        )
        db_session.add(purchase)
        await db_session.commit()
        await db_session.refresh(purchase)

        resp = await admin_client.post(f"/admin/subscription-purchases/{purchase.id}/approve")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == SubscriptionPurchaseStatus.CONFIRMED.value

    @pytest.mark.asyncio
    async def test_approve_nonexistent_sub_purchase_404(self, admin_client: AsyncClient):
        resp = await admin_client.post("/admin/subscription-purchases/nonexistent/approve")
        assert resp.status_code in (404, 409)

    @pytest.mark.asyncio
    async def test_approve_already_confirmed_sub_purchase_409(self, db_session, admin_client: AsyncClient):
        user = await _make_user(db_session, role=UserRole.MEMBER)
        sub = Subscription(user_id=user.id, points=0)
        db_session.add(sub)
        await db_session.commit()

        purchase = SubscriptionPurchase(
            user_id=user.id,
            plan_code="monthly",
            periods=1,
            total_amount=Decimal("49.00"),
            currency="PLN",
            status=SubscriptionPurchaseStatus.CONFIRMED.value,
            manual_payment_confirmed_at=datetime(2026, 2, 5, 14, 0),
        )
        db_session.add(purchase)
        await db_session.commit()
        await db_session.refresh(purchase)

        resp = await admin_client.post(f"/admin/subscription-purchases/{purchase.id}/approve")
        assert resp.status_code in (404, 409)


# ── 5. Full refund lifecycle ─────────────────────────────────────────


class TestRefundFullLifecycle:
    """End-to-end: create task → override → mark paid → verify final state."""

    @pytest.mark.asyncio
    async def test_full_lifecycle_override_then_mark_paid(self, db_session, admin_client: AsyncClient):
        user = await _make_user(db_session)
        event = await _make_event(db_session)
        payment = Payment(
            user_id=user.id,
            external_id=f"lifecycle-{uuid4().hex}",
            amount=Decimal("30.00"),
            currency="PLN",
            payment_type=PaymentType.EVENT.value,
            status=DBPaymentStatus.COMPLETED.value,
        )
        reg = Registration(
            user_id=user.id,
            event_id=event.id,
            occurrence_date=event.start_date.date(),
            status=RegistrationStatus.CANCELLED.value,
            payment_id=payment.external_id,
        )
        db_session.add_all([payment, reg])
        await db_session.commit()
        await db_session.refresh(reg)

        task = RegistrationRefundTask(
            registration_id=reg.id,
            user_id=user.id,
            event_id=event.id,
            occurrence_date=reg.occurrence_date,
            refund_eligible=False,
            recommended_should_refund=False,
            should_refund=False,
            refund_marked_paid=False,
        )
        db_session.add(task)
        await db_session.commit()
        await db_session.refresh(task)

        # Step 1: starts as NO_REFUND_CANCELLED_AFTER_CUTOFF, not resolved
        resp = await admin_client.get("/admin/manual-payments/refunds")
        row = next(r for r in resp.json() if r["task_id"] == task.id)
        assert row["recommendation_code"] == "NO_REFUND_CANCELLED_AFTER_CUTOFF"
        assert row["is_resolved"] is False

        # Step 2: admin overrides to refund
        resp = await admin_client.patch(
            f"/admin/manual-payments/refunds/{task.id}",
            json={"should_refund": True, "override_reason": "Customer was misinformed about cutoff dates"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["recommendation_code"] == "REFUND_ADMIN_OVERRIDE"
        assert body["is_resolved"] is False

        # Step 3: admin marks refund as paid
        resp = await admin_client.patch(
            f"/admin/manual-payments/refunds/{task.id}",
            json={"refund_marked_paid": True},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["recommendation_code"] == "REFUND_COMPLETED"
        assert body["is_resolved"] is True
        assert body["refund_marked_paid"] is True

        # Step 4: registration is now REFUNDED
        await db_session.refresh(reg)
        assert reg.status == RegistrationStatus.REFUNDED.value

    @pytest.mark.asyncio
    async def test_reject_refund_lifecycle(self, db_session, admin_client: AsyncClient):
        """Admin rejects an eligible refund → resolved immediately."""
        user = await _make_user(db_session)
        event = await _make_event(db_session)
        reg = Registration(
            user_id=user.id,
            event_id=event.id,
            occurrence_date=event.start_date.date(),
            status=RegistrationStatus.CANCELLED.value,
            payment_id=f"reject-{uuid4().hex}",
        )
        db_session.add(reg)
        await db_session.commit()
        await db_session.refresh(reg)

        task = RegistrationRefundTask(
            registration_id=reg.id,
            user_id=user.id,
            event_id=event.id,
            occurrence_date=reg.occurrence_date,
            refund_eligible=True,
            recommended_should_refund=True,
            should_refund=True,
            refund_marked_paid=False,
        )
        db_session.add(task)
        await db_session.commit()
        await db_session.refresh(task)

        # Override to no-refund
        resp = await admin_client.patch(
            f"/admin/manual-payments/refunds/{task.id}",
            json={"should_refund": False, "override_reason": "Duplicate registration, user agreed no refund"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["recommendation_code"] == "NO_REFUND_ADMIN_OVERRIDE"
        assert body["is_resolved"] is True
        assert body["should_refund"] is False


# ── 6. Complex multi-user edge cases ─────────────────────────────────


class TestMultiUserRefundMatrix:
    """
    Verify correct isolation and recommendation codes when multiple users
    cancel registrations for the **same event** under different circumstances.

    Scenario: Three users register for Event X with manual payment.
      - User A cancels *before* the cutoff → eligible, recommended refund.
      - User B cancels *after* the cutoff  → ineligible, no recommended refund.
      - User C cancels but never paid      → eligible with no payment record.

    The test asserts that each refund task appears in the admin list with the
    correct ``recommendation_code`` computed independently, and that modifying
    one task does not leak state into another.
    """

    @pytest.mark.asyncio
    async def test_three_users_same_event_different_refund_codes(
        self, db_session, admin_client: AsyncClient,
    ):
        """
        Populate three refund tasks for distinct users on one event.

        Expected codes:
          - User A: REFUND_CANCELLED_BEFORE_CUTOFF  (eligible=T, recommended=T)
          - User B: NO_REFUND_CANCELLED_AFTER_CUTOFF (eligible=F, recommended=F)
          - User C: NO_REFUND_NO_PAYMENT             (eligible=T, recommended=F)

        After asserting initial state, override User B's decision to grant a
        compassionate refund and verify that only User B's row changes.
        """
        event = await _make_event(db_session, manual=True, title="Shared-Event")
        users = [await _make_user(db_session) for _ in range(3)]
        configs = [
            {"eligible": True,  "recommended": True,  "should_refund": True,  "code": "REFUND_CANCELLED_BEFORE_CUTOFF"},
            {"eligible": False, "recommended": False, "should_refund": False, "code": "NO_REFUND_CANCELLED_AFTER_CUTOFF"},
            {"eligible": True,  "recommended": False, "should_refund": False, "code": "NO_REFUND_NO_PAYMENT"},
        ]
        tasks = []
        for user, cfg in zip(users, configs):
            reg = Registration(
                user_id=user.id, event_id=event.id,
                occurrence_date=event.start_date.date(),
                status=RegistrationStatus.CANCELLED.value,
                payment_id=f"pay-{uuid4().hex[:8]}",
            )
            db_session.add(reg)
            await db_session.commit()
            await db_session.refresh(reg)
            task = RegistrationRefundTask(
                registration_id=reg.id, user_id=user.id, event_id=event.id,
                occurrence_date=reg.occurrence_date,
                refund_eligible=cfg["eligible"],
                recommended_should_refund=cfg["recommended"],
                should_refund=cfg["should_refund"],
                refund_marked_paid=False,
            )
            db_session.add(task)
            await db_session.commit()
            await db_session.refresh(task)
            tasks.append(task)

        # Verify initial list shows all three with correct codes
        resp = await admin_client.get("/admin/manual-payments/refunds")
        assert resp.status_code == 200
        rows = resp.json()
        for task_obj, cfg in zip(tasks, configs):
            row = next(r for r in rows if r["task_id"] == task_obj.id)
            assert row["recommendation_code"] == cfg["code"], (
                f"Task {task_obj.id} expected {cfg['code']} but got {row['recommendation_code']}"
            )
            assert row["is_resolved"] is False

        # Override User B (index=1) → compassionate refund
        resp = await admin_client.patch(
            f"/admin/manual-payments/refunds/{tasks[1].id}",
            json={"should_refund": True, "override_reason": "Compassionate override for late cancellation"},
        )
        assert resp.status_code == 200
        assert resp.json()["recommendation_code"] == "REFUND_ADMIN_OVERRIDE"

        # Re-fetch list: only User B's code should have changed
        resp = await admin_client.get("/admin/manual-payments/refunds")
        rows = resp.json()
        for i, task_obj in enumerate(tasks):
            row = next(r for r in rows if r["task_id"] == task_obj.id)
            if i == 1:
                assert row["recommendation_code"] == "REFUND_ADMIN_OVERRIDE"
            else:
                assert row["recommendation_code"] == configs[i]["code"]


class TestSameUserMultipleEvents:
    """
    One user holds refund tasks across three different events, each in a
    different resolution state.

    This verifies that per-event refund processing is fully isolated: completing
    a refund on Event A does not affect the user's tasks on Events B and C.

    Layout:
      - Event A: refund completed (marked paid).
      - Event B: admin overrode to no-refund → resolved.
      - Event C: pending, no admin review yet.
    """

    @pytest.mark.asyncio
    async def test_mixed_refund_statuses_per_event(
        self, db_session, admin_client: AsyncClient, admin_user: User,
    ):
        """
        Build three refund tasks for one user on separate events, each in a
        distinct lifecycle stage.

        Asserts:
          - Event A task: REFUND_COMPLETED, is_resolved=True
          - Event B task: NO_REFUND_ADMIN_OVERRIDE, is_resolved=True
          - Event C task: REFUND_CANCELLED_BEFORE_CUTOFF, is_resolved=False

        Then marks Event C as paid and confirms only that row transitions to
        REFUND_COMPLETED without affecting Events A or B.
        """
        user = await _make_user(db_session)
        events = [await _make_event(db_session, title=f"Evt-{chr(65+i)}") for i in range(3)]

        regs, task_objs = [], []
        configs = [
            {"eligible": True, "recommended": True, "should_refund": True, "paid": True,  "reviewed_by": None},
            {"eligible": True, "recommended": True, "should_refund": False, "paid": False, "reviewed_by": admin_user.id},
            {"eligible": True, "recommended": True, "should_refund": True, "paid": False, "reviewed_by": None},
        ]
        for evt, cfg in zip(events, configs):
            pay_ext = f"pay-{uuid4().hex[:8]}"
            payment = Payment(
                user_id=user.id, external_id=pay_ext, amount=Decimal("40.00"),
                currency="PLN", payment_type=PaymentType.EVENT.value,
                status=DBPaymentStatus.COMPLETED.value,
            )
            reg = Registration(
                user_id=user.id, event_id=evt.id,
                occurrence_date=evt.start_date.date(),
                status=RegistrationStatus.CANCELLED.value,
                payment_id=pay_ext,
            )
            db_session.add_all([payment, reg])
            await db_session.commit()
            await db_session.refresh(reg)
            regs.append(reg)

            task = RegistrationRefundTask(
                registration_id=reg.id, user_id=user.id, event_id=evt.id,
                occurrence_date=reg.occurrence_date,
                refund_eligible=cfg["eligible"],
                recommended_should_refund=cfg["recommended"],
                should_refund=cfg["should_refund"],
                refund_marked_paid=cfg["paid"],
                reviewed_by_admin_id=cfg["reviewed_by"],
                reviewed_at=datetime.utcnow() if cfg["reviewed_by"] else None,
            )
            db_session.add(task)
            await db_session.commit()
            await db_session.refresh(task)
            task_objs.append(task)

        resp = await admin_client.get("/admin/manual-payments/refunds")
        rows = resp.json()

        row_a = next(r for r in rows if r["task_id"] == task_objs[0].id)
        assert row_a["recommendation_code"] == "REFUND_COMPLETED"
        assert row_a["is_resolved"] is True

        row_b = next(r for r in rows if r["task_id"] == task_objs[1].id)
        assert row_b["recommendation_code"] == "NO_REFUND_ADMIN_OVERRIDE"
        assert row_b["is_resolved"] is True

        row_c = next(r for r in rows if r["task_id"] == task_objs[2].id)
        assert row_c["recommendation_code"] == "REFUND_CANCELLED_BEFORE_CUTOFF"
        assert row_c["is_resolved"] is False

        # Mark Event C refund as paid
        resp = await admin_client.patch(
            f"/admin/manual-payments/refunds/{task_objs[2].id}",
            json={"refund_marked_paid": True},
        )
        assert resp.status_code == 200
        assert resp.json()["recommendation_code"] == "REFUND_COMPLETED"

        # Verify Events A and B are unchanged
        resp = await admin_client.get("/admin/manual-payments/refunds")
        rows = resp.json()
        assert next(r for r in rows if r["task_id"] == task_objs[0].id)["recommendation_code"] == "REFUND_COMPLETED"
        assert next(r for r in rows if r["task_id"] == task_objs[1].id)["recommendation_code"] == "NO_REFUND_ADMIN_OVERRIDE"


class TestOverrideFlipFlop:
    """
    Admin repeatedly changes a refund decision back and forth.

    This validates that every intermediate state transition produces the
    correct ``recommendation_code`` and that the final ``override_reason``
    reflects the last override supplied, not any earlier one.

    Sequence:
      1. Start: recommended=True, should_refund=True → REFUND_CANCELLED_BEFORE_CUTOFF
      2. Override to no-refund (reason A) → NO_REFUND_ADMIN_OVERRIDE, is_resolved=True
      3. Override back to refund (reason B) → REFUND_ADMIN_OVERRIDE, is_resolved=False
      4. Override back to no-refund (reason C) → NO_REFUND_ADMIN_OVERRIDE, is_resolved=True
    """

    @pytest.mark.asyncio
    async def test_triple_flip_flop_override(
        self, db_session, admin_client: AsyncClient,
    ):
        """
        Exercise three successive overrides on the same refund task.

        After each PATCH the test verifies:
          - ``recommendation_code`` matches the new decision
          - ``is_resolved`` toggles correctly
          - ``override_reason`` is the most-recently supplied value
          - ``reviewed_at`` is always present after first review
        """
        user = await _make_user(db_session)
        event = await _make_event(db_session)
        reg = Registration(
            user_id=user.id, event_id=event.id,
            occurrence_date=event.start_date.date(),
            status=RegistrationStatus.CANCELLED.value,
            payment_id=f"flip-{uuid4().hex[:8]}",
        )
        db_session.add(reg)
        await db_session.commit()
        await db_session.refresh(reg)

        task = RegistrationRefundTask(
            registration_id=reg.id, user_id=user.id, event_id=event.id,
            occurrence_date=reg.occurrence_date,
            refund_eligible=True, recommended_should_refund=True,
            should_refund=True, refund_marked_paid=False,
        )
        db_session.add(task)
        await db_session.commit()
        await db_session.refresh(task)

        # Flip 1: refund → no-refund
        resp = await admin_client.patch(
            f"/admin/manual-payments/refunds/{task.id}",
            json={"should_refund": False, "override_reason": "Reason Alpha: no grounds for refund"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["recommendation_code"] == "NO_REFUND_ADMIN_OVERRIDE"
        assert body["is_resolved"] is True
        assert body["override_reason"] == "Reason Alpha: no grounds for refund"
        assert body["reviewed_at"] is not None

        # Flip 2: no-refund → refund
        resp = await admin_client.patch(
            f"/admin/manual-payments/refunds/{task.id}",
            json={"should_refund": True, "override_reason": "Reason Beta: manager approved exception"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["recommendation_code"] == "REFUND_ADMIN_OVERRIDE"
        assert body["is_resolved"] is False
        assert body["override_reason"] == "Reason Beta: manager approved exception"

        # Flip 3: refund → no-refund again
        resp = await admin_client.patch(
            f"/admin/manual-payments/refunds/{task.id}",
            json={"should_refund": False, "override_reason": "Reason Gamma: final decision after escalation"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["recommendation_code"] == "NO_REFUND_ADMIN_OVERRIDE"
        assert body["is_resolved"] is True
        assert body["override_reason"] == "Reason Gamma: final decision after escalation"


class TestConcurrentPendingAndSubscription:
    """
    One user simultaneously has a pending *event* manual payment and a pending
    *subscription* manual payment.

    This ensures the two admin queues are fully independent: approving the
    subscription does not affect the event registration, and vice versa.
    """

    @pytest.mark.asyncio
    async def test_approve_subscription_then_event_independently(
        self, db_session, admin_client: AsyncClient,
    ):
        """
        Create a user with:
          - A registration in MANUAL_PAYMENT_VERIFICATION for Event X.
          - A subscription purchase in MANUAL_PAYMENT_VERIFICATION.

        Approve the subscription first, then the event payment.  After each
        step, verify the *other* record is unmodified.

        Checks:
          - Subscription goes to CONFIRMED, event reg stays
            MANUAL_PAYMENT_VERIFICATION.
          - Then event reg goes to CONFIRMED, subscription stays CONFIRMED.
          - User role promoted to MEMBER by subscription approval.
          - Subscription end_date is set after approval.
        """
        user = await _make_user(db_session, role=UserRole.GUEST)
        sub = Subscription(user_id=user.id, points=0)
        db_session.add(sub)
        await db_session.commit()

        # Event payment setup
        event = await _make_event(db_session, manual=True, title="Dual-Queue-Event")
        evt_pay = Payment(
            user_id=user.id, external_id=f"evt-dual-{uuid4().hex[:8]}",
            amount=Decimal("50.00"), currency="PLN",
            payment_type=PaymentType.EVENT.value,
            status=DBPaymentStatus.PROCESSING.value,
        )
        evt_reg = Registration(
            user_id=user.id, event_id=event.id,
            occurrence_date=event.start_date.date(),
            status=RegistrationStatus.MANUAL_PAYMENT_VERIFICATION.value,
            payment_id=evt_pay.external_id,
            manual_payment_confirmed_at=datetime(2026, 2, 1, 12, 0),
        )
        db_session.add_all([evt_pay, evt_reg])
        await db_session.commit()
        await db_session.refresh(evt_reg)

        # Subscription purchase setup
        sub_pay_ext = f"sub-dual-{uuid4().hex[:8]}"
        sub_pay = Payment(
            user_id=user.id, external_id=sub_pay_ext,
            amount=Decimal("49.00"), currency="PLN",
            payment_type=PaymentType.SUBSCRIPTION.value,
            status=DBPaymentStatus.PENDING.value,
        )
        sub_purchase = SubscriptionPurchase(
            user_id=user.id, plan_code="monthly", periods=1,
            total_amount=Decimal("49.00"), currency="PLN",
            status=SubscriptionPurchaseStatus.MANUAL_PAYMENT_VERIFICATION.value,
            manual_payment_confirmed_at=datetime(2026, 2, 2, 10, 0),
            payment_id=sub_pay_ext,
        )
        db_session.add_all([sub_pay, sub_purchase])
        await db_session.commit()
        await db_session.refresh(sub_purchase)

        # Step 1: approve subscription
        resp = await admin_client.post(f"/admin/subscription-purchases/{sub_purchase.id}/approve")
        assert resp.status_code == 200
        assert resp.json()["status"] == SubscriptionPurchaseStatus.CONFIRMED.value

        # Event reg must still be pending
        await db_session.refresh(evt_reg)
        assert evt_reg.status == RegistrationStatus.MANUAL_PAYMENT_VERIFICATION.value

        # User role should now be MEMBER
        await db_session.refresh(user)
        assert user.role == UserRole.MEMBER

        # Subscription end_date should be set
        await db_session.refresh(sub)
        assert sub.end_date is not None

        # Step 2: approve event payment
        resp = await admin_client.post(f"/admin/manual-payments/{evt_reg.id}/approve")
        assert resp.status_code == 200
        assert resp.json()["status"] == RegistrationStatus.CONFIRMED.value

        # Subscription purchase must still be confirmed
        await db_session.refresh(sub_purchase)
        assert sub_purchase.status == SubscriptionPurchaseStatus.CONFIRMED.value


class TestMultiUserWaitlistPromotions:
    """
    Three users are promoted from the waitlist of the same manual-payment event.

    The test verifies that toggling the notification flag for one user does not
    affect the other two, and that the list correctly reflects each user's
    independent notification state.
    """

    @pytest.mark.asyncio
    async def test_toggle_one_does_not_affect_others(
        self, db_session, admin_client: AsyncClient,
    ):
        """
        Create three waitlist promotions for different users on one event.

        Toggle notification sent for the middle user only.  Then verify:
          - Middle user: ``waitlist_notification_sent=True``,
            ``waitlist_notified_at`` is set.
          - First and third users: ``waitlist_notification_sent=False``,
            ``waitlist_notified_at`` is null.
        """
        event = await _make_event(db_session, manual=True, title="Popular-Event")
        users = [await _make_user(db_session) for _ in range(3)]
        regs = []
        for i, u in enumerate(users):
            reg = Registration(
                user_id=u.id, event_id=event.id,
                occurrence_date=event.start_date.date(),
                status=RegistrationStatus.MANUAL_PAYMENT_REQUIRED.value,
                promoted_from_waitlist_at=datetime(2026, 2, 10, 10 + i, 0),
                manual_payment_due_at=datetime(2026, 2, 11, 10 + i, 0),
                waitlist_notification_sent=False,
            )
            db_session.add(reg)
            await db_session.commit()
            await db_session.refresh(reg)
            regs.append(reg)

        # Toggle notification only for the second user
        resp = await admin_client.patch(
            f"/admin/manual-payments/promotions/{regs[1].id}",
            json={"waitlist_notification_sent": True},
        )
        assert resp.status_code == 200
        assert resp.json()["waitlist_notification_sent"] is True
        assert resp.json()["waitlist_notified_at"] is not None

        # Verify isolation: fetch full list
        resp = await admin_client.get("/admin/manual-payments/promotions")
        rows = resp.json()
        for i, reg in enumerate(regs):
            row = next(r for r in rows if r["registration_id"] == reg.id)
            if i == 1:
                assert row["waitlist_notification_sent"] is True
                assert row["waitlist_notified_at"] is not None
            else:
                assert row["waitlist_notification_sent"] is False
                assert row["waitlist_notified_at"] is None


class TestDoubleApproveIdempotency:
    """
    Attempt to approve the same pending manual payment or subscription twice.

    After the first approval succeeds, the registration status changes to
    CONFIRMED.  The second call must return 409 because the record is no
    longer in MANUAL_PAYMENT_VERIFICATION status.  This protects against
    accidental double-clicks in the admin UI.
    """

    @pytest.mark.asyncio
    async def test_double_approve_event_payment_returns_409(
        self, db_session, admin_client: AsyncClient,
    ):
        """
        Approve a pending event payment twice.

        First call: 200 → CONFIRMED.
        Second call: 409 → already confirmed.
        """
        user = await _make_user(db_session)
        event = await _make_event(db_session, manual=True)
        payment = Payment(
            user_id=user.id, external_id=f"dbl-{uuid4().hex[:8]}",
            amount=Decimal("50.00"), currency="PLN",
            payment_type=PaymentType.EVENT.value,
            status=DBPaymentStatus.PROCESSING.value,
        )
        reg = Registration(
            user_id=user.id, event_id=event.id,
            occurrence_date=event.start_date.date(),
            status=RegistrationStatus.MANUAL_PAYMENT_VERIFICATION.value,
            payment_id=payment.external_id,
            manual_payment_confirmed_at=datetime(2026, 2, 1, 12, 0),
        )
        db_session.add_all([payment, reg])
        await db_session.commit()
        await db_session.refresh(reg)

        resp1 = await admin_client.post(f"/admin/manual-payments/{reg.id}/approve")
        assert resp1.status_code == 200

        resp2 = await admin_client.post(f"/admin/manual-payments/{reg.id}/approve")
        assert resp2.status_code == 409

    @pytest.mark.asyncio
    async def test_double_approve_subscription_returns_409(
        self, db_session, admin_client: AsyncClient,
    ):
        """
        Approve a pending subscription purchase twice.

        First call: 200 → CONFIRMED.
        Second call: 409 → already confirmed.
        """
        user = await _make_user(db_session, role=UserRole.MEMBER)
        sub = Subscription(user_id=user.id, points=0)
        db_session.add(sub)
        await db_session.commit()

        pay_ext = f"dbl-sub-{uuid4().hex[:8]}"
        payment = Payment(
            user_id=user.id, external_id=pay_ext,
            amount=Decimal("49.00"), currency="PLN",
            payment_type=PaymentType.SUBSCRIPTION.value,
            status=DBPaymentStatus.PENDING.value,
        )
        purchase = SubscriptionPurchase(
            user_id=user.id, plan_code="monthly", periods=1,
            total_amount=Decimal("49.00"), currency="PLN",
            status=SubscriptionPurchaseStatus.MANUAL_PAYMENT_VERIFICATION.value,
            manual_payment_confirmed_at=datetime(2026, 2, 5, 14, 0),
            payment_id=pay_ext,
        )
        db_session.add_all([payment, purchase])
        await db_session.commit()
        await db_session.refresh(purchase)

        resp1 = await admin_client.post(f"/admin/subscription-purchases/{purchase.id}/approve")
        assert resp1.status_code == 200

        resp2 = await admin_client.post(f"/admin/subscription-purchases/{purchase.id}/approve")
        assert resp2.status_code == 409


class TestPendingPaymentListOrdering:
    """
    Verify that the pending manual payments list is ordered chronologically
    by ``manual_payment_confirmed_at`` (ascending), so the oldest declaration
    appears first for admin review.

    Three users register at different times; the test asserts the response
    sequence matches earliest-first ordering.
    """

    @pytest.mark.asyncio
    async def test_pending_list_chronological_order(
        self, db_session, admin_client: AsyncClient,
    ):
        """
        Create three pending registrations with staggered confirmation times
        (Feb 1, Feb 3, Feb 2).

        The expected response order is Feb 1 → Feb 2 → Feb 3, i.e. the
        registration created second should appear last.
        """
        event = await _make_event(db_session, manual=True, title="Ordered-Event")
        timestamps = [
            datetime(2026, 2, 1, 10, 0),   # oldest
            datetime(2026, 2, 3, 10, 0),   # newest
            datetime(2026, 2, 2, 10, 0),   # middle
        ]
        reg_ids = []
        for ts in timestamps:
            user = await _make_user(db_session)
            payment = Payment(
                user_id=user.id, external_id=f"ord-{uuid4().hex[:8]}",
                amount=Decimal("50.00"), currency="PLN",
                payment_type=PaymentType.EVENT.value,
                status=DBPaymentStatus.PROCESSING.value,
            )
            reg = Registration(
                user_id=user.id, event_id=event.id,
                occurrence_date=event.start_date.date(),
                status=RegistrationStatus.MANUAL_PAYMENT_VERIFICATION.value,
                payment_id=payment.external_id,
                manual_payment_confirmed_at=ts,
            )
            db_session.add_all([payment, reg])
            await db_session.commit()
            await db_session.refresh(reg)
            reg_ids.append(reg.id)

        resp = await admin_client.get("/admin/manual-payments/pending")
        assert resp.status_code == 200
        rows = resp.json()
        # Filter to only our test registrations
        our_rows = [r for r in rows if r["registration_id"] in reg_ids]
        returned_ids = [r["registration_id"] for r in our_rows]
        # Expected: reg_ids[0] (Feb 1), reg_ids[2] (Feb 2), reg_ids[1] (Feb 3)
        assert returned_ids == [reg_ids[0], reg_ids[2], reg_ids[1]]


class TestRefundListOrdering:
    """
    Verify that refund tasks are ordered newest-first (``created_at`` DESC)
    so the most recent cancellation appears at the top of the admin queue.

    Three refund tasks are inserted with explicit creation timestamps and the
    test asserts the response sequence.
    """

    @pytest.mark.asyncio
    async def test_refund_list_newest_first(
        self, db_session, admin_client: AsyncClient,
    ):
        """
        Create three refund tasks with staggered creation times.

        Expected response order: newest → oldest, because the endpoint uses
        ``ORDER BY created_at DESC``.
        """
        event = await _make_event(db_session, title="Refund-Order-Event")
        task_ids = []
        for i in range(3):
            user = await _make_user(db_session)
            reg = Registration(
                user_id=user.id, event_id=event.id,
                occurrence_date=event.start_date.date(),
                status=RegistrationStatus.CANCELLED.value,
                payment_id=f"ord-ref-{uuid4().hex[:8]}",
            )
            db_session.add(reg)
            await db_session.commit()
            await db_session.refresh(reg)
            task = RegistrationRefundTask(
                registration_id=reg.id, user_id=user.id, event_id=event.id,
                occurrence_date=reg.occurrence_date,
                refund_eligible=True, recommended_should_refund=True,
                should_refund=True, refund_marked_paid=False,
            )
            db_session.add(task)
            await db_session.commit()
            await db_session.refresh(task)
            task_ids.append(task.id)

        resp = await admin_client.get("/admin/manual-payments/refunds")
        assert resp.status_code == 200
        rows = resp.json()
        our_rows = [r for r in rows if r["task_id"] in task_ids]
        returned_ids = [r["task_id"] for r in our_rows]
        # Newest (last inserted) first
        assert returned_ids == list(reversed(task_ids))


class TestDoubleMarkRefundPaid:
    """
    Marking a refund as paid twice should be idempotent.

    The first PATCH sets ``refund_marked_paid=True``, transitions the
    registration to REFUNDED, and sets ``recommendation_code`` to
    REFUND_COMPLETED.  The second PATCH with the same payload should still
    return 200 with identical state — no duplicate status transitions or errors.
    """

    @pytest.mark.asyncio
    async def test_idempotent_mark_paid(
        self, db_session, admin_client: AsyncClient,
    ):
        """
        Mark a refund task as paid twice in succession.

        Both calls must return 200 and produce identical response bodies.
        The underlying registration must remain REFUNDED after both calls.
        """
        user = await _make_user(db_session)
        event = await _make_event(db_session)
        pay_ext = f"idem-{uuid4().hex[:8]}"
        payment = Payment(
            user_id=user.id, external_id=pay_ext,
            amount=Decimal("40.00"), currency="PLN",
            payment_type=PaymentType.EVENT.value,
            status=DBPaymentStatus.COMPLETED.value,
        )
        reg = Registration(
            user_id=user.id, event_id=event.id,
            occurrence_date=event.start_date.date(),
            status=RegistrationStatus.CANCELLED.value,
            payment_id=pay_ext,
        )
        db_session.add_all([payment, reg])
        await db_session.commit()
        await db_session.refresh(reg)

        task = RegistrationRefundTask(
            registration_id=reg.id, user_id=user.id, event_id=event.id,
            occurrence_date=reg.occurrence_date,
            refund_eligible=True, recommended_should_refund=True,
            should_refund=True, refund_marked_paid=False,
        )
        db_session.add(task)
        await db_session.commit()
        await db_session.refresh(task)

        # First mark
        resp1 = await admin_client.patch(
            f"/admin/manual-payments/refunds/{task.id}",
            json={"refund_marked_paid": True},
        )
        assert resp1.status_code == 200
        body1 = resp1.json()
        assert body1["refund_marked_paid"] is True
        assert body1["recommendation_code"] == "REFUND_COMPLETED"
        assert body1["is_resolved"] is True

        # Second mark — idempotent
        resp2 = await admin_client.patch(
            f"/admin/manual-payments/refunds/{task.id}",
            json={"refund_marked_paid": True},
        )
        assert resp2.status_code == 200
        body2 = resp2.json()
        assert body2["refund_marked_paid"] is True
        assert body2["recommendation_code"] == "REFUND_COMPLETED"
        assert body2["is_resolved"] is True

        await db_session.refresh(reg)
        assert reg.status == RegistrationStatus.REFUNDED.value


class TestSubscriptionApprovalGuestPromotion:
    """
    When a GUEST user's manual subscription payment is approved, the system
    must promote their role to MEMBER in addition to activating the
    subscription.

    This test verifies both the role promotion and the subscription end-date
    assignment in a single approval flow.
    """

    @pytest.mark.asyncio
    async def test_guest_promoted_to_member_on_subscription_approval(
        self, db_session, admin_client: AsyncClient,
    ):
        """
        Create a GUEST user with a pending subscription purchase.

        After admin approval:
          - ``user.role`` must be MEMBER.
          - ``subscription.end_date`` must be set (non-null).
          - Purchase status must be CONFIRMED.
          - Payment status must be COMPLETED.
        """
        user = await _make_user(db_session, role=UserRole.GUEST)
        sub = Subscription(user_id=user.id, points=0)
        db_session.add(sub)
        await db_session.commit()

        pay_ext = f"guest-sub-{uuid4().hex[:8]}"
        payment = Payment(
            user_id=user.id, external_id=pay_ext,
            amount=Decimal("49.00"), currency="PLN",
            payment_type=PaymentType.SUBSCRIPTION.value,
            status=DBPaymentStatus.PENDING.value,
        )
        purchase = SubscriptionPurchase(
            user_id=user.id, plan_code="monthly", periods=1,
            total_amount=Decimal("49.00"), currency="PLN",
            status=SubscriptionPurchaseStatus.MANUAL_PAYMENT_VERIFICATION.value,
            manual_payment_confirmed_at=datetime(2026, 2, 5, 14, 0),
            payment_id=pay_ext,
        )
        db_session.add_all([payment, purchase])
        await db_session.commit()
        await db_session.refresh(purchase)

        assert user.role == UserRole.GUEST

        resp = await admin_client.post(f"/admin/subscription-purchases/{purchase.id}/approve")
        assert resp.status_code == 200
        assert resp.json()["status"] == SubscriptionPurchaseStatus.CONFIRMED.value

        await db_session.refresh(user)
        assert user.role == UserRole.MEMBER

        await db_session.refresh(sub)
        assert sub.end_date is not None

        await db_session.refresh(payment)
        assert payment.status == DBPaymentStatus.COMPLETED.value


class TestBatchSubscriptionApprovals:
    """
    Three different users each have a pending subscription purchase.

    The admin approves them one by one, and the test verifies that each
    purchase transitions independently to CONFIRMED with a valid
    subscription end-date — no cross-contamination between user rows.
    """

    @pytest.mark.asyncio
    async def test_approve_three_subscriptions_sequentially(
        self, db_session, admin_client: AsyncClient,
    ):
        """
        Create three users, each with a MANUAL_PAYMENT_VERIFICATION
        subscription purchase for the monthly plan.

        Approve all three in sequence.  After each approval:
          - The approved purchase is CONFIRMED with a matching response.
          - All other purchases retain their previous status.
          - Each user's subscription has a non-null ``end_date``.
        """
        users, subs, purchases, payments = [], [], [], []
        for _ in range(3):
            u = await _make_user(db_session, role=UserRole.MEMBER)
            s = Subscription(user_id=u.id, points=0)
            db_session.add(s)
            await db_session.commit()

            pay_ext = f"batch-{uuid4().hex[:8]}"
            p = Payment(
                user_id=u.id, external_id=pay_ext,
                amount=Decimal("49.00"), currency="PLN",
                payment_type=PaymentType.SUBSCRIPTION.value,
                status=DBPaymentStatus.PENDING.value,
            )
            sp = SubscriptionPurchase(
                user_id=u.id, plan_code="monthly", periods=1,
                total_amount=Decimal("49.00"), currency="PLN",
                status=SubscriptionPurchaseStatus.MANUAL_PAYMENT_VERIFICATION.value,
                manual_payment_confirmed_at=datetime(2026, 2, 5, 14, 0),
                payment_id=pay_ext,
            )
            db_session.add_all([p, sp])
            await db_session.commit()
            await db_session.refresh(sp)

            users.append(u)
            subs.append(s)
            purchases.append(sp)
            payments.append(p)

        for i, purchase in enumerate(purchases):
            resp = await admin_client.post(
                f"/admin/subscription-purchases/{purchase.id}/approve"
            )
            assert resp.status_code == 200
            assert resp.json()["status"] == SubscriptionPurchaseStatus.CONFIRMED.value

            # Remaining purchases must still be pending
            for j, other in enumerate(purchases):
                await db_session.refresh(other)
                if j <= i:
                    assert other.status == SubscriptionPurchaseStatus.CONFIRMED.value
                else:
                    assert other.status == SubscriptionPurchaseStatus.MANUAL_PAYMENT_VERIFICATION.value

        # All subscriptions should have end_date set
        for s in subs:
            await db_session.refresh(s)
            assert s.end_date is not None


class TestRefundOverrideThenUnmarkPaid:
    """
    Exercise the edge case where an admin overrides a refund to refund,
    marks it paid, then attempts to un-mark it (set ``refund_marked_paid``
    back to ``False``).

    The system should allow reverting the paid flag, but the registration
    may already have transitioned to REFUNDED.  The test documents the
    expected behaviour of each step.
    """

    @pytest.mark.asyncio
    async def test_mark_paid_then_unmark(
        self, db_session, admin_client: AsyncClient,
    ):
        """
        Full sequence:
          1. Start with eligible + recommended refund.
          2. Mark refund as paid → REFUND_COMPLETED, reg=REFUNDED.
          3. Un-mark refund paid → back to REFUND_CANCELLED_BEFORE_CUTOFF,
             ``refund_marked_paid=False``.
          4. Registration status may stay REFUNDED because the payment was
             already marked as refunded at the gateway level.

        This test validates each intermediate state.
        """
        user = await _make_user(db_session)
        event = await _make_event(db_session)
        pay_ext = f"unmark-{uuid4().hex[:8]}"
        payment = Payment(
            user_id=user.id, external_id=pay_ext,
            amount=Decimal("40.00"), currency="PLN",
            payment_type=PaymentType.EVENT.value,
            status=DBPaymentStatus.COMPLETED.value,
        )
        reg = Registration(
            user_id=user.id, event_id=event.id,
            occurrence_date=event.start_date.date(),
            status=RegistrationStatus.CANCELLED.value,
            payment_id=pay_ext,
        )
        db_session.add_all([payment, reg])
        await db_session.commit()
        await db_session.refresh(reg)

        task = RegistrationRefundTask(
            registration_id=reg.id, user_id=user.id, event_id=event.id,
            occurrence_date=reg.occurrence_date,
            refund_eligible=True, recommended_should_refund=True,
            should_refund=True, refund_marked_paid=False,
        )
        db_session.add(task)
        await db_session.commit()
        await db_session.refresh(task)

        # Step 1: mark paid
        resp = await admin_client.patch(
            f"/admin/manual-payments/refunds/{task.id}",
            json={"refund_marked_paid": True},
        )
        assert resp.status_code == 200
        assert resp.json()["recommendation_code"] == "REFUND_COMPLETED"
        assert resp.json()["is_resolved"] is True

        await db_session.refresh(reg)
        assert reg.status == RegistrationStatus.REFUNDED.value

        # Step 2: un-mark paid
        resp = await admin_client.patch(
            f"/admin/manual-payments/refunds/{task.id}",
            json={"refund_marked_paid": False},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["refund_marked_paid"] is False
        # Without the paid flag, recommendation reverts to pre-paid state
        assert body["recommendation_code"] in (
            "REFUND_CANCELLED_BEFORE_CUTOFF",
            "REFUND_ADMIN_OVERRIDE",
        )


class TestMultiUserPendingPaymentApprovalIsolation:
    """
    Four users register for the same manual-payment event.  The admin
    approves two of them and leaves the other two pending.

    This validates row-level isolation: only the approved registrations
    transition to CONFIRMED; the untouched ones remain in
    MANUAL_PAYMENT_VERIFICATION.  The pending list shrinks by exactly
    the number of approved registrations.
    """

    @pytest.mark.asyncio
    async def test_approve_two_of_four_pending(
        self, db_session, admin_client: AsyncClient,
    ):
        """
        Create four pending registrations for Event X (users A–D).

        Approve users A and C.  Then verify:
          - A: CONFIRMED
          - B: MANUAL_PAYMENT_VERIFICATION (still in pending list)
          - C: CONFIRMED
          - D: MANUAL_PAYMENT_VERIFICATION (still in pending list)
          - Pending list contains exactly B and D.
        """
        event = await _make_event(db_session, manual=True, title="Four-User-Event")
        reg_objs = []
        for _ in range(4):
            user = await _make_user(db_session)
            payment = Payment(
                user_id=user.id, external_id=f"four-{uuid4().hex[:8]}",
                amount=Decimal("50.00"), currency="PLN",
                payment_type=PaymentType.EVENT.value,
                status=DBPaymentStatus.PROCESSING.value,
            )
            reg = Registration(
                user_id=user.id, event_id=event.id,
                occurrence_date=event.start_date.date(),
                status=RegistrationStatus.MANUAL_PAYMENT_VERIFICATION.value,
                payment_id=payment.external_id,
                manual_payment_confirmed_at=datetime(2026, 2, 1, 12, 0),
            )
            db_session.add_all([payment, reg])
            await db_session.commit()
            await db_session.refresh(reg)
            reg_objs.append(reg)

        # Approve A (index 0) and C (index 2)
        for idx in (0, 2):
            resp = await admin_client.post(f"/admin/manual-payments/{reg_objs[idx].id}/approve")
            assert resp.status_code == 200
            assert resp.json()["status"] == RegistrationStatus.CONFIRMED.value

        # Verify DB states
        for i, reg in enumerate(reg_objs):
            await db_session.refresh(reg)
            if i in (0, 2):
                assert reg.status == RegistrationStatus.CONFIRMED.value
            else:
                assert reg.status == RegistrationStatus.MANUAL_PAYMENT_VERIFICATION.value

        # Pending list should contain only B and D
        resp = await admin_client.get("/admin/manual-payments/pending")
        rows = resp.json()
        pending_ids = {r["registration_id"] for r in rows if r["registration_id"] in [r.id for r in reg_objs]}
        assert pending_ids == {reg_objs[1].id, reg_objs[3].id}


class TestRefundPaymentStatusTransition:
    """
    End-to-end verification that marking a refund as paid correctly
    transitions the linked Payment record from COMPLETED to REFUNDED.

    This is important because the admin UI shows payment status to help
    finance track reconciliation.
    """

    @pytest.mark.asyncio
    async def test_payment_status_becomes_refunded(
        self, db_session, admin_client: AsyncClient,
    ):
        """
        Create a COMPLETED payment linked to a cancelled registration and its
        refund task.

        After marking the refund as paid:
          - ``payment.status`` must transition to REFUNDED.
          - ``registration.status`` must transition to REFUNDED.
          - ``task.refund_marked_paid`` must be True.
          - Response ``recommendation_code`` must be REFUND_COMPLETED.
        """
        user = await _make_user(db_session)
        event = await _make_event(db_session)
        pay_ext = f"pay-status-{uuid4().hex[:8]}"
        payment = Payment(
            user_id=user.id, external_id=pay_ext,
            amount=Decimal("60.00"), currency="PLN",
            payment_type=PaymentType.EVENT.value,
            status=DBPaymentStatus.COMPLETED.value,
        )
        reg = Registration(
            user_id=user.id, event_id=event.id,
            occurrence_date=event.start_date.date(),
            status=RegistrationStatus.CANCELLED.value,
            payment_id=pay_ext,
        )
        db_session.add_all([payment, reg])
        await db_session.commit()
        await db_session.refresh(reg)

        task = RegistrationRefundTask(
            registration_id=reg.id, user_id=user.id, event_id=event.id,
            occurrence_date=reg.occurrence_date,
            refund_eligible=True, recommended_should_refund=True,
            should_refund=True, refund_marked_paid=False,
        )
        db_session.add(task)
        await db_session.commit()
        await db_session.refresh(task)

        resp = await admin_client.patch(
            f"/admin/manual-payments/refunds/{task.id}",
            json={"refund_marked_paid": True},
        )
        assert resp.status_code == 200
        assert resp.json()["recommendation_code"] == "REFUND_COMPLETED"

        await db_session.refresh(payment)
        assert payment.status == DBPaymentStatus.REFUNDED.value

        await db_session.refresh(reg)
        assert reg.status == RegistrationStatus.REFUNDED.value
