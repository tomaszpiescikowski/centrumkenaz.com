"""Tests for the admin balance / financial statement endpoint."""

from datetime import datetime, timedelta, date
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from database import get_db
from models.event import Event
from models.payment import Payment, PaymentStatus as DBPaymentStatus, PaymentType
from models.registration import Registration, RegistrationStatus
from models.user import AccountStatus, User, UserRole
from models.subscription import Subscription
from routers import admin_router
from routers.auth import get_current_user_dependency


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
async def admin_user(db_session) -> User:
    user = User(
        google_id=f"admin-bal-{uuid4().hex}",
        email=f"admin-bal-{uuid4().hex}@example.com",
        full_name="Balance Admin",
        role=UserRole.ADMIN,
        account_status=AccountStatus.ACTIVE,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def guest_user(db_session) -> User:
    user = User(
        google_id=f"guest-bal-{uuid4().hex}",
        email=f"guest-bal-{uuid4().hex}@example.com",
        full_name="Balance Guest",
        role=UserRole.GUEST,
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


@pytest.fixture
async def guest_client(db_session, guest_user: User):
    app = FastAPI()
    app.include_router(admin_router)

    async def override_get_db():
        yield db_session

    async def override_current_user():
        return guest_user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user_dependency] = override_current_user

    client = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    try:
        yield client
    finally:
        await client.aclose()


@pytest.fixture
async def anon_client(db_session):
    app = FastAPI()
    app.include_router(admin_router)

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    client = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    try:
        yield client
    finally:
        await client.aclose()


async def _make_event(db_session, title="Evt", dt=None, city="Poznań") -> Event:
    event = Event(
        title=title,
        description="desc",
        event_type="mors",
        start_date=dt or datetime(2026, 2, 15, 10, 0),
        time_info="10:00",
        city=city,
        price_guest=Decimal("50.00"),
        price_member=Decimal("30.00"),
        max_participants=20,
        version=1,
    )
    db_session.add(event)
    await db_session.commit()
    await db_session.refresh(event)
    return event


async def _make_user(
    db_session,
    role: str = UserRole.GUEST,
    status: str = AccountStatus.ACTIVE,
) -> User:
    user = User(
        google_id=f"user-{uuid4().hex}",
        email=f"user-{uuid4().hex}@example.com",
        full_name=f"User {uuid4().hex[:6]}",
        role=role,
        account_status=status,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


async def _make_payment(
    db_session,
    user_id: str,
    amount: Decimal,
    status: str = DBPaymentStatus.COMPLETED.value,
    payment_type: str = "event",
    created_at: datetime | None = None,
    extra_data: str | None = None,
    description: str | None = None,
) -> Payment:
    payment = Payment(
        id=str(uuid4()),
        user_id=user_id,
        external_id=str(uuid4()),
        amount=amount,
        currency="PLN",
        payment_type=payment_type,
        status=status,
        description=description,
        extra_data=extra_data,
    )
    db_session.add(payment)
    await db_session.flush()
    if created_at:
        from sqlalchemy import update as sa_update
        await db_session.execute(
            sa_update(Payment).where(Payment.id == payment.id).values(created_at=created_at)
        )
    await db_session.commit()
    await db_session.refresh(payment)
    return payment


async def _make_registration(
    db_session,
    user_id: str,
    event_id: str,
    payment_id: str | None = None,
    status: str = RegistrationStatus.CONFIRMED.value,
    occurrence_date=None,
) -> Registration:
    reg = Registration(
        id=str(uuid4()),
        user_id=user_id,
        event_id=event_id,
        payment_id=payment_id,
        status=status,
        occurrence_date=occurrence_date or datetime.now().date(),
    )
    db_session.add(reg)
    await db_session.commit()
    await db_session.refresh(reg)
    return reg


# ---------------------------------------------------------------------------
# Access control tests
# ---------------------------------------------------------------------------


class TestBalanceAccessControl:
    @pytest.mark.asyncio
    async def test_anonymous_returns_401(self, anon_client: AsyncClient):
        resp = await anon_client.get("/admin/stats/balance")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_guest_returns_403(self, guest_client: AsyncClient):
        resp = await guest_client.get("/admin/stats/balance")
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_admin_returns_200(self, admin_client: AsyncClient):
        resp = await admin_client.get("/admin/stats/balance")
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Period parsing tests
# ---------------------------------------------------------------------------


class TestBalancePeriodParsing:
    @pytest.mark.asyncio
    async def test_invalid_period_format(self, admin_client: AsyncClient):
        resp = await admin_client.get("/admin/stats/balance?period=bad")
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_invalid_month_13(self, admin_client: AsyncClient):
        resp = await admin_client.get("/admin/stats/balance?period=2026-13")
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_invalid_quarter_5(self, admin_client: AsyncClient):
        resp = await admin_client.get("/admin/stats/balance?period=2026-Q5")
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_valid_month(self, admin_client: AsyncClient):
        resp = await admin_client.get("/admin/stats/balance?period=2026-02")
        assert resp.status_code == 200
        data = resp.json()
        assert data["period_label"] == "2026-02"
        assert data["date_from"] == "2026-02-01"
        assert data["date_to"] == "2026-02-28"

    @pytest.mark.asyncio
    async def test_valid_quarter(self, admin_client: AsyncClient):
        resp = await admin_client.get("/admin/stats/balance?period=2026-Q1")
        assert resp.status_code == 200
        data = resp.json()
        assert data["period_label"] == "2026 Q1"
        assert data["date_from"] == "2026-01-01"
        assert data["date_to"] == "2026-03-31"

    @pytest.mark.asyncio
    async def test_valid_year(self, admin_client: AsyncClient):
        resp = await admin_client.get("/admin/stats/balance?period=2026")
        assert resp.status_code == 200
        data = resp.json()
        assert data["period_label"] == "2026"
        assert data["date_from"] == "2026-01-01"
        assert data["date_to"] == "2026-12-31"

    @pytest.mark.asyncio
    async def test_defaults_to_current_month(self, admin_client: AsyncClient):
        resp = await admin_client.get("/admin/stats/balance")
        assert resp.status_code == 200
        data = resp.json()
        now = datetime.utcnow()
        expected = f"{now.year}-{now.month:02d}"
        assert data["period_label"] == expected

    @pytest.mark.asyncio
    async def test_quarter_case_insensitive(self, admin_client: AsyncClient):
        resp = await admin_client.get("/admin/stats/balance?period=2026-q2")
        assert resp.status_code == 200
        assert resp.json()["period_label"] == "2026 Q2"


# ---------------------------------------------------------------------------
# Empty state
# ---------------------------------------------------------------------------


class TestBalanceEmptyState:
    @pytest.mark.asyncio
    async def test_empty_balance(self, admin_client: AsyncClient):
        resp = await admin_client.get("/admin/stats/balance?period=2026-01")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_income"] == "0.00 PLN"
        assert data["total_refunds"] == "0.00 PLN"
        assert data["total_net"] == "0.00 PLN"
        assert data["total_tx_count"] == 0
        assert data["total_refund_count"] == 0
        assert data["months"] == []
        assert data["events"] == []
        assert data["subscriptions"] == []
        assert data["pending"]["pending_total"] == "0.00 PLN"


# ---------------------------------------------------------------------------
# Income aggregation
# ---------------------------------------------------------------------------


class TestBalanceIncomeAggregation:
    @pytest.mark.asyncio
    async def test_single_completed_event_payment(self, db_session, admin_client, admin_user):
        event = await _make_event(db_session, "Ev1", datetime(2026, 1, 15))
        p = await _make_payment(
            db_session, admin_user.id, Decimal("50.00"),
            payment_type="event",
            created_at=datetime(2026, 1, 10),
        )
        await _make_registration(db_session, admin_user.id, event.id, payment_id=p.external_id)

        resp = await admin_client.get("/admin/stats/balance?period=2026-01")
        data = resp.json()
        assert data["total_income"] == "50.00 PLN"
        assert data["total_income_event"] == "50.00 PLN"
        assert data["total_income_subscription"] == "0.00 PLN"
        assert data["total_net"] == "50.00 PLN"
        assert data["total_tx_count"] == 1

    @pytest.mark.asyncio
    async def test_multiple_event_payments_summed(self, db_session, admin_client, admin_user):
        event = await _make_event(db_session, "Ev2", datetime(2026, 3, 1))
        p1 = await _make_payment(
            db_session, admin_user.id, Decimal("30.00"),
            payment_type="event",
            created_at=datetime(2026, 3, 5),
        )
        p2 = await _make_payment(
            db_session, admin_user.id, Decimal("70.00"),
            payment_type="event",
            created_at=datetime(2026, 3, 20),
        )
        await _make_registration(db_session, admin_user.id, event.id, payment_id=p1.external_id, occurrence_date=datetime(2026, 3, 5).date())
        await _make_registration(db_session, admin_user.id, event.id, payment_id=p2.external_id, occurrence_date=datetime(2026, 3, 20).date())

        resp = await admin_client.get("/admin/stats/balance?period=2026-03")
        data = resp.json()
        assert data["total_income"] == "100.00 PLN"
        assert data["total_tx_count"] == 2

    @pytest.mark.asyncio
    async def test_subscription_payment_counted(self, db_session, admin_client, admin_user):
        await _make_payment(
            db_session, admin_user.id, Decimal("20.00"),
            payment_type="subscription",
            created_at=datetime(2026, 4, 1),
            extra_data='{"plan_code": "monthly"}',
        )

        resp = await admin_client.get("/admin/stats/balance?period=2026-04")
        data = resp.json()
        assert data["total_income_subscription"] == "20.00 PLN"
        assert data["total_income_event"] == "0.00 PLN"
        assert data["total_income"] == "20.00 PLN"

    @pytest.mark.asyncio
    async def test_mixed_event_and_subscription(self, db_session, admin_client, admin_user):
        event = await _make_event(db_session, "Mixed", datetime(2026, 5, 10))
        p = await _make_payment(
            db_session, admin_user.id, Decimal("40.00"),
            payment_type="event",
            created_at=datetime(2026, 5, 5),
        )
        await _make_registration(db_session, admin_user.id, event.id, payment_id=p.external_id)
        await _make_payment(
            db_session, admin_user.id, Decimal("200.00"),
            payment_type="subscription",
            created_at=datetime(2026, 5, 6),
            extra_data='{"plan_code": "yearly"}',
        )

        resp = await admin_client.get("/admin/stats/balance?period=2026-05")
        data = resp.json()
        assert data["total_income"] == "240.00 PLN"
        assert data["total_income_event"] == "40.00 PLN"
        assert data["total_income_subscription"] == "200.00 PLN"


# ---------------------------------------------------------------------------
# Refund aggregation
# ---------------------------------------------------------------------------


class TestBalanceRefunds:
    @pytest.mark.asyncio
    async def test_refund_subtracted_from_net(self, db_session, admin_client, admin_user):
        event = await _make_event(db_session, "Ref", datetime(2026, 6, 1))
        p_ok = await _make_payment(
            db_session, admin_user.id, Decimal("100.00"),
            payment_type="event", created_at=datetime(2026, 6, 2),
        )
        await _make_registration(db_session, admin_user.id, event.id, payment_id=p_ok.external_id, occurrence_date=datetime(2026, 6, 2).date())

        p_ref = await _make_payment(
            db_session, admin_user.id, Decimal("50.00"),
            status=DBPaymentStatus.REFUNDED.value,
            payment_type="event", created_at=datetime(2026, 6, 3),
        )
        await _make_registration(db_session, admin_user.id, event.id, payment_id=p_ref.external_id, occurrence_date=datetime(2026, 6, 3).date())

        resp = await admin_client.get("/admin/stats/balance?period=2026-06")
        data = resp.json()
        assert data["total_income"] == "100.00 PLN"
        assert data["total_refunds"] == "50.00 PLN"
        assert data["total_net"] == "50.00 PLN"
        assert data["total_refund_count"] == 1

    @pytest.mark.asyncio
    async def test_only_refunds_negative_net(self, db_session, admin_client, admin_user):
        await _make_payment(
            db_session, admin_user.id, Decimal("80.00"),
            status=DBPaymentStatus.REFUNDED.value,
            payment_type="event", created_at=datetime(2026, 7, 10),
        )

        resp = await admin_client.get("/admin/stats/balance?period=2026-07")
        data = resp.json()
        assert data["total_income"] == "0.00 PLN"
        assert data["total_refunds"] == "80.00 PLN"
        assert data["total_net"] == "-80.00 PLN"


# ---------------------------------------------------------------------------
# Monthly breakdown
# ---------------------------------------------------------------------------


class TestBalanceMonthlyBreakdown:
    @pytest.mark.asyncio
    async def test_quarter_has_three_months(self, db_session, admin_client, admin_user):
        for m in [1, 2, 3]:
            await _make_payment(
                db_session, admin_user.id, Decimal("10.00"),
                payment_type="event",
                created_at=datetime(2026, m, 15),
            )

        resp = await admin_client.get("/admin/stats/balance?period=2026-Q1")
        data = resp.json()
        assert len(data["months"]) == 3
        assert data["months"][0]["month"] == "2026-01"
        assert data["months"][1]["month"] == "2026-02"
        assert data["months"][2]["month"] == "2026-03"
        for row in data["months"]:
            assert row["income_total"] == "10.00 PLN"

    @pytest.mark.asyncio
    async def test_yearly_aggregation(self, db_session, admin_client, admin_user):
        for m in [1, 6, 12]:
            await _make_payment(
                db_session, admin_user.id, Decimal("100.00"),
                payment_type="event",
                created_at=datetime(2025, m, 5),
            )

        resp = await admin_client.get("/admin/stats/balance?period=2025")
        data = resp.json()
        assert len(data["months"]) == 3
        assert data["total_income"] == "300.00 PLN"


# ---------------------------------------------------------------------------
# Per-event breakdown
# ---------------------------------------------------------------------------


class TestBalanceEventBreakdown:
    @pytest.mark.asyncio
    async def test_per_event_income(self, db_session, admin_client, admin_user):
        ev1 = await _make_event(db_session, "A", datetime(2026, 8, 1))
        ev2 = await _make_event(db_session, "B", datetime(2026, 8, 10))

        p1 = await _make_payment(
            db_session, admin_user.id, Decimal("100.00"),
            payment_type="event", created_at=datetime(2026, 8, 2),
        )
        p2 = await _make_payment(
            db_session, admin_user.id, Decimal("30.00"),
            payment_type="event", created_at=datetime(2026, 8, 5),
        )
        await _make_registration(db_session, admin_user.id, ev1.id, payment_id=p1.external_id)
        await _make_registration(db_session, admin_user.id, ev2.id, payment_id=p2.external_id)

        resp = await admin_client.get("/admin/stats/balance?period=2026-08")
        data = resp.json()
        assert len(data["events"]) == 2
        # sorted by income desc
        assert data["events"][0]["title"] == "A"
        assert data["events"][0]["income"] == "100.00 PLN"
        assert data["events"][1]["title"] == "B"
        assert data["events"][1]["income"] == "30.00 PLN"

    @pytest.mark.asyncio
    async def test_event_with_refund(self, db_session, admin_client, admin_user):
        ev = await _make_event(db_session, "Rfnd", datetime(2026, 9, 1))
        p1 = await _make_payment(
            db_session, admin_user.id, Decimal("50.00"),
            payment_type="event", created_at=datetime(2026, 9, 2),
        )
        p2 = await _make_payment(
            db_session, admin_user.id, Decimal("50.00"),
            status=DBPaymentStatus.REFUNDED.value,
            payment_type="event", created_at=datetime(2026, 9, 3),
        )
        await _make_registration(db_session, admin_user.id, ev.id, payment_id=p1.external_id, occurrence_date=datetime(2026, 9, 2).date())
        await _make_registration(db_session, admin_user.id, ev.id, payment_id=p2.external_id, occurrence_date=datetime(2026, 9, 3).date())

        resp = await admin_client.get("/admin/stats/balance?period=2026-09")
        data = resp.json()
        assert len(data["events"]) == 1
        assert data["events"][0]["income"] == "50.00 PLN"
        assert data["events"][0]["refunds"] == "50.00 PLN"
        assert data["events"][0]["net"] == "0.00 PLN"


# ---------------------------------------------------------------------------
# Subscription plan breakdown
# ---------------------------------------------------------------------------


class TestBalanceSubscriptionBreakdown:
    @pytest.mark.asyncio
    async def test_multiple_plans(self, db_session, admin_client, admin_user):
        await _make_payment(
            db_session, admin_user.id, Decimal("20.00"),
            payment_type="subscription",
            created_at=datetime(2026, 10, 1),
            extra_data='{"plan_code": "monthly"}',
        )
        await _make_payment(
            db_session, admin_user.id, Decimal("200.00"),
            payment_type="subscription",
            created_at=datetime(2026, 10, 5),
            extra_data='{"plan_code": "yearly"}',
        )

        resp = await admin_client.get("/admin/stats/balance?period=2026-10")
        data = resp.json()
        plans = {s["plan_code"]: s for s in data["subscriptions"]}
        assert "monthly" in plans
        assert "yearly" in plans
        assert plans["monthly"]["income"] == "20.00 PLN"
        assert plans["yearly"]["income"] == "200.00 PLN"

    @pytest.mark.asyncio
    async def test_unknown_plan_code(self, db_session, admin_client, admin_user):
        await _make_payment(
            db_session, admin_user.id, Decimal("10.00"),
            payment_type="subscription",
            created_at=datetime(2026, 11, 1),
            extra_data="invalid-json",
        )

        resp = await admin_client.get("/admin/stats/balance?period=2026-11")
        data = resp.json()
        assert len(data["subscriptions"]) == 1
        assert data["subscriptions"][0]["plan_code"] == "unknown"


# ---------------------------------------------------------------------------
# Pending payments
# ---------------------------------------------------------------------------


class TestBalancePending:
    @pytest.mark.asyncio
    async def test_pending_event_payments(self, db_session, admin_client, admin_user):
        await _make_payment(
            db_session, admin_user.id, Decimal("45.00"),
            status=DBPaymentStatus.PENDING.value,
            payment_type="event", created_at=datetime(2026, 1, 20),
        )

        resp = await admin_client.get("/admin/stats/balance?period=2026-01")
        data = resp.json()
        assert data["pending"]["pending_event"] == "45.00 PLN"
        assert data["pending"]["pending_event_count"] == 1
        assert data["pending"]["pending_subscription"] == "0.00 PLN"

    @pytest.mark.asyncio
    async def test_pending_subscription_payments(self, db_session, admin_client, admin_user):
        await _make_payment(
            db_session, admin_user.id, Decimal("20.00"),
            status=DBPaymentStatus.PENDING.value,
            payment_type="subscription", created_at=datetime(2026, 1, 20),
        )

        resp = await admin_client.get("/admin/stats/balance?period=2026-01")
        data = resp.json()
        assert data["pending"]["pending_subscription"] == "20.00 PLN"
        assert data["pending"]["pending_subscription_count"] == 1

    @pytest.mark.asyncio
    async def test_processing_counted_as_pending(self, db_session, admin_client, admin_user):
        await _make_payment(
            db_session, admin_user.id, Decimal("60.00"),
            status=DBPaymentStatus.PROCESSING.value,
            payment_type="event", created_at=datetime(2026, 2, 10),
        )

        resp = await admin_client.get("/admin/stats/balance?period=2026-02")
        data = resp.json()
        assert data["pending"]["pending_event"] == "60.00 PLN"


# ---------------------------------------------------------------------------
# Filtering: payments outside period excluded
# ---------------------------------------------------------------------------


class TestBalancePeriodFiltering:
    @pytest.mark.asyncio
    async def test_payments_outside_month_excluded(self, db_session, admin_client, admin_user):
        await _make_payment(
            db_session, admin_user.id, Decimal("99.00"),
            payment_type="event",
            created_at=datetime(2026, 1, 15),
        )
        await _make_payment(
            db_session, admin_user.id, Decimal("1.00"),
            payment_type="event",
            created_at=datetime(2026, 2, 1),
        )

        resp = await admin_client.get("/admin/stats/balance?period=2026-01")
        data = resp.json()
        assert data["total_income"] == "99.00 PLN"
        assert data["total_tx_count"] == 1

    @pytest.mark.asyncio
    async def test_payments_outside_quarter_excluded(self, db_session, admin_client, admin_user):
        await _make_payment(
            db_session, admin_user.id, Decimal("10.00"),
            payment_type="event",
            created_at=datetime(2025, 12, 31),
        )
        await _make_payment(
            db_session, admin_user.id, Decimal("20.00"),
            payment_type="event",
            created_at=datetime(2026, 1, 1),
        )
        await _make_payment(
            db_session, admin_user.id, Decimal("30.00"),
            payment_type="event",
            created_at=datetime(2026, 4, 1),
        )

        resp = await admin_client.get("/admin/stats/balance?period=2026-Q1")
        data = resp.json()
        assert data["total_income"] == "20.00 PLN"
        assert data["total_tx_count"] == 1

    @pytest.mark.asyncio
    async def test_failed_and_cancelled_not_counted_in_income(self, db_session, admin_client, admin_user):
        await _make_payment(
            db_session, admin_user.id, Decimal("100.00"),
            status=DBPaymentStatus.FAILED.value,
            payment_type="event", created_at=datetime(2026, 1, 5),
        )
        await _make_payment(
            db_session, admin_user.id, Decimal("200.00"),
            status=DBPaymentStatus.CANCELLED.value,
            payment_type="event", created_at=datetime(2026, 1, 6),
        )

        resp = await admin_client.get("/admin/stats/balance?period=2026-01")
        data = resp.json()
        assert data["total_income"] == "0.00 PLN"
        assert data["total_tx_count"] == 0
        assert data["total_refund_count"] == 0


# ---------------------------------------------------------------------------
# Response structure validation
# ---------------------------------------------------------------------------


class TestBalanceResponseStructure:
    @pytest.mark.asyncio
    async def test_response_has_all_fields(self, admin_client: AsyncClient):
        resp = await admin_client.get("/admin/stats/balance?period=2026-01")
        assert resp.status_code == 200
        data = resp.json()

        expected_keys = {
            "period_label", "date_from", "date_to",
            "total_income", "total_income_event", "total_income_subscription",
            "total_refunds", "total_net", "total_tx_count", "total_refund_count",
            "months", "events", "subscriptions", "pending",
        }
        assert expected_keys.issubset(set(data.keys()))

    @pytest.mark.asyncio
    async def test_pending_has_all_fields(self, admin_client: AsyncClient):
        resp = await admin_client.get("/admin/stats/balance?period=2026-01")
        data = resp.json()
        pending_keys = {
            "pending_event", "pending_subscription", "pending_total",
            "pending_event_count", "pending_subscription_count",
        }
        assert pending_keys.issubset(set(data["pending"].keys()))

    @pytest.mark.asyncio
    async def test_month_row_structure(self, db_session, admin_client, admin_user):
        await _make_payment(
            db_session, admin_user.id, Decimal("10.00"),
            payment_type="event", created_at=datetime(2026, 1, 1),
        )
        resp = await admin_client.get("/admin/stats/balance?period=2026-01")
        data = resp.json()
        assert len(data["months"]) == 1
        row = data["months"][0]
        expected = {
            "month", "income_event", "income_subscription",
            "income_total", "refunds", "net", "tx_count", "refund_count",
        }
        assert expected.issubset(set(row.keys()))

    @pytest.mark.asyncio
    async def test_event_row_structure(self, db_session, admin_client, admin_user):
        ev = await _make_event(db_session, "Str", datetime(2026, 1, 10))
        p = await _make_payment(
            db_session, admin_user.id, Decimal("10.00"),
            payment_type="event", created_at=datetime(2026, 1, 10),
        )
        await _make_registration(db_session, admin_user.id, ev.id, payment_id=p.external_id)
        resp = await admin_client.get("/admin/stats/balance?period=2026-01")
        data = resp.json()
        assert len(data["events"]) >= 1
        row = data["events"][0]
        expected = {
            "event_id", "title", "start_date", "city",
            "income", "refunds", "net", "tx_count", "refund_count",
        }
        assert expected.issubset(set(row.keys()))

    @pytest.mark.asyncio
    async def test_subscription_row_structure(self, db_session, admin_client, admin_user):
        await _make_payment(
            db_session, admin_user.id, Decimal("20.00"),
            payment_type="subscription", created_at=datetime(2026, 1, 5),
            extra_data='{"plan_code": "monthly"}',
        )
        resp = await admin_client.get("/admin/stats/balance?period=2026-01")
        data = resp.json()
        assert len(data["subscriptions"]) == 1
        row = data["subscriptions"][0]
        expected = {
            "plan_code", "income", "refunds", "net",
            "tx_count", "refund_count",
        }
        assert expected.issubset(set(row.keys()))


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------


class TestBalanceEdgeCases:
    @pytest.mark.asyncio
    async def test_leap_year_february(self, admin_client: AsyncClient):
        resp = await admin_client.get("/admin/stats/balance?period=2024-02")
        assert resp.status_code == 200
        assert resp.json()["date_to"] == "2024-02-29"

    @pytest.mark.asyncio
    async def test_non_leap_year_february(self, admin_client: AsyncClient):
        resp = await admin_client.get("/admin/stats/balance?period=2025-02")
        assert resp.status_code == 200
        assert resp.json()["date_to"] == "2025-02-28"

    @pytest.mark.asyncio
    async def test_q4_dates(self, admin_client: AsyncClient):
        resp = await admin_client.get("/admin/stats/balance?period=2026-Q4")
        assert resp.status_code == 200
        data = resp.json()
        assert data["date_from"] == "2026-10-01"
        assert data["date_to"] == "2026-12-31"

    @pytest.mark.asyncio
    async def test_zero_amount_payment(self, db_session, admin_client, admin_user):
        await _make_payment(
            db_session, admin_user.id, Decimal("0.00"),
            payment_type="event", created_at=datetime(2026, 1, 1),
        )
        resp = await admin_client.get("/admin/stats/balance?period=2026-01")
        data = resp.json()
        assert data["total_income"] == "0.00 PLN"
        assert data["total_tx_count"] == 1


# ===========================================================================
# HARDCORE EDGE CASES
# ===========================================================================


class TestBoundaryTimestamps:
    """Verify correct filtering at period boundaries."""

    @pytest.mark.asyncio
    async def test_payment_at_midnight_first_day_of_month_included(self, db_session, admin_client, admin_user):
        """
        Verify that a payment at exactly midnight on the first day of a month is included.

        A payment created at 2026-03-01 00:00:00.000000 must appear in the March 2026
        balance because date_from defaults to the first day at 00:00:00.
        """
        await _make_payment(
            db_session, admin_user.id, Decimal("11.11"),
            payment_type="event",
            created_at=datetime(2026, 3, 1, 0, 0, 0),
        )
        resp = await admin_client.get("/admin/stats/balance?period=2026-03")
        data = resp.json()
        assert data["total_income"] == "11.11 PLN"
        assert data["total_tx_count"] == 1

    @pytest.mark.asyncio
    async def test_payment_at_last_microsecond_of_month_included(self, db_session, admin_client, admin_user):
        """
        Verify that a payment at the last microsecond of a month is included.

        A payment created at 2026-03-31 23:59:59.999999 falls within the date_to
        boundary and must be counted in the March 2026 balance.
        """
        await _make_payment(
            db_session, admin_user.id, Decimal("22.22"),
            payment_type="event",
            created_at=datetime(2026, 3, 31, 23, 59, 59, 999999),
        )
        resp = await admin_client.get("/admin/stats/balance?period=2026-03")
        data = resp.json()
        assert data["total_income"] == "22.22 PLN"

    @pytest.mark.asyncio
    async def test_payment_one_second_before_period_excluded(self, db_session, admin_client, admin_user):
        """
        Verify that a payment one second before the period start is excluded.

        A payment at 23:59:59 on February 28, 2026 precedes the March period start
        and must not appear in the March balance.
        """
        await _make_payment(
            db_session, admin_user.id, Decimal("33.33"),
            payment_type="event",
            created_at=datetime(2026, 2, 28, 23, 59, 59),
        )
        resp = await admin_client.get("/admin/stats/balance?period=2026-03")
        data = resp.json()
        assert data["total_income"] == "0.00 PLN"
        assert data["total_tx_count"] == 0

    @pytest.mark.asyncio
    async def test_quarter_boundary_last_second_of_q1_included(self, db_session, admin_client, admin_user):
        """
        Verify that a payment at the last second of Q1 is included in Q1 only.

        A payment on March 31 at 23:59:59 belongs to Q1 and must not leak into Q2.
        """
        await _make_payment(
            db_session, admin_user.id, Decimal("44.44"),
            payment_type="event",
            created_at=datetime(2026, 3, 31, 23, 59, 59),
        )
        resp_q1 = await admin_client.get("/admin/stats/balance?period=2026-Q1")
        resp_q2 = await admin_client.get("/admin/stats/balance?period=2026-Q2")
        assert resp_q1.json()["total_income"] == "44.44 PLN"
        assert resp_q2.json()["total_income"] == "0.00 PLN"

    @pytest.mark.asyncio
    async def test_year_boundary_dec31_vs_jan1(self, db_session, admin_client, admin_user):
        """
        Verify that year boundary correctly separates December 31 from January 1.

        A payment on Dec 31, 2025 at 23:59 must appear only in the 2025 balance,
        while a payment on Jan 1, 2026 at 00:00 must appear only in January 2026.
        """
        await _make_payment(
            db_session, admin_user.id, Decimal("100.00"),
            payment_type="event",
            created_at=datetime(2025, 12, 31, 23, 59, 59),
        )
        await _make_payment(
            db_session, admin_user.id, Decimal("200.00"),
            payment_type="event",
            created_at=datetime(2026, 1, 1, 0, 0, 0),
        )
        resp_2025 = await admin_client.get("/admin/stats/balance?period=2025")
        resp_2026 = await admin_client.get("/admin/stats/balance?period=2026-01")
        assert resp_2025.json()["total_income"] == "100.00 PLN"
        assert resp_2026.json()["total_income"] == "200.00 PLN"


class TestMultiUserAggregation:
    """Verify that the balance aggregates payments from multiple users."""

    @pytest.mark.asyncio
    async def test_payments_from_different_users_summed(self, db_session, admin_client, admin_user):
        """
        Verify that payments from different users are summed together.

        Three users make event payments in the same month. The balance endpoint
        does not filter by user_id, so all amounts must be aggregated.
        """
        user_a = await _make_user(db_session)
        user_b = await _make_user(db_session)
        for user, amount in [(admin_user, "10.00"), (user_a, "20.00"), (user_b, "30.00")]:
            await _make_payment(
                db_session, user.id, Decimal(amount),
                payment_type="event", created_at=datetime(2027, 1, 5),
            )
        resp = await admin_client.get("/admin/stats/balance?period=2027-01")
        data = resp.json()
        assert data["total_income"] == "60.00 PLN"
        assert data["total_tx_count"] == 3

    @pytest.mark.asyncio
    async def test_same_event_paid_by_multiple_users(self, db_session, admin_client, admin_user):
        """
        Verify that multiple users paying for the same event are summed in the breakdown.

        Two users pay separately for one event. The per-event breakdown must show
        both payments with the correct total income.
        """
        ev = await _make_event(db_session, "Multi-user event", datetime(2027, 2, 10))
        user_b = await _make_user(db_session)
        p1 = await _make_payment(
            db_session, admin_user.id, Decimal("50.00"),
            payment_type="event", created_at=datetime(2027, 2, 5),
        )
        p2 = await _make_payment(
            db_session, user_b.id, Decimal("70.00"),
            payment_type="event", created_at=datetime(2027, 2, 6),
        )
        await _make_registration(db_session, admin_user.id, ev.id, payment_id=p1.external_id, occurrence_date=date(2027, 2, 5))
        await _make_registration(db_session, user_b.id, ev.id, payment_id=p2.external_id, occurrence_date=date(2027, 2, 6))

        resp = await admin_client.get("/admin/stats/balance?period=2027-02")
        data = resp.json()
        assert len(data["events"]) == 1
        assert data["events"][0]["income"] == "120.00 PLN"
        assert data["events"][0]["tx_count"] == 2


class TestPeriodParsingHardcore:
    """Stress tests for parsing the period parameter with unusual values."""

    @pytest.mark.asyncio
    async def test_month_00_invalid(self, admin_client):
        """
        Verify that month '00' is rejected as invalid.

        The format YYYY-MM is syntactically correct, but month 0 does not exist.
        The endpoint must return 400.
        """
        resp = await admin_client.get("/admin/stats/balance?period=2026-00")
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_quarter_0_invalid(self, admin_client):
        """
        Verify that quarter Q0 is rejected as invalid.

        Only Q1 through Q4 are valid quarters. The endpoint must return 400.
        """
        resp = await admin_client.get("/admin/stats/balance?period=2026-Q0")
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_negative_year_invalid(self, admin_client):
        """
        Verify that a negative year is rejected.

        The regex requires exactly four digits, so a leading minus sign does not
        match any accepted pattern.
        """
        resp = await admin_client.get("/admin/stats/balance?period=-2026")
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_period_with_trailing_whitespace(self, admin_client):
        """
        Verify that trailing whitespace in the period parameter is rejected.

        The value '2026-01 ' does not match the expected pattern and must
        return 400.
        """
        resp = await admin_client.get("/admin/stats/balance?period=2026-01 ")
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_period_with_leading_zero_year(self, admin_client):
        """
        Verify that a leading-zero year like '0026-01' is accepted gracefully.

        The regex requires exactly four digits, so '0026' matches. The endpoint
        should return 200 with empty data rather than an internal error.
        """
        resp = await admin_client.get("/admin/stats/balance?period=0026-01")
        assert resp.status_code == 200
        assert resp.json()["total_income"] == "0.00 PLN"

    @pytest.mark.asyncio
    async def test_very_far_future_year(self, admin_client):
        """
        Verify that a far-future year like 9999 returns an empty balance.

        No data should exist, but the endpoint must respond successfully without
        raising an exception.
        """
        resp = await admin_client.get("/admin/stats/balance?period=9999")
        assert resp.status_code == 200
        assert resp.json()["total_income"] == "0.00 PLN"

    @pytest.mark.asyncio
    async def test_five_digit_year_invalid(self, admin_client):
        """
        Verify that a five-digit year like '10000' is rejected.

        The regex requires exactly four digits, so five digits must return 400.
        """
        resp = await admin_client.get("/admin/stats/balance?period=10000")
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_empty_period_defaults_to_current(self, admin_client):
        """
        Verify that an empty period parameter defaults to the current month.

        In Python an empty string is falsy, so the endpoint falls back to the
        current month. The response should be 200 with a valid period_label.
        """
        resp = await admin_client.get("/admin/stats/balance?period=")
        assert resp.status_code == 200
        assert "period_label" in resp.json()

    @pytest.mark.asyncio
    async def test_period_sql_injection_attempt(self, admin_client):
        """
        Verify that an SQL injection attempt in the period parameter is rejected.

        The value '2026-01; DROP TABLE payments;--' does not match the expected
        regex and must return 400.
        """
        resp = await admin_client.get("/admin/stats/balance?period=2026-01; DROP TABLE payments;--")
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_period_with_unicode(self, admin_client):
        """
        Verify that Unicode characters in the period parameter are rejected.

        The value '2026-Q①' contains a non-ASCII circled digit and must not
        match the expected regex pattern.
        """
        resp = await admin_client.get("/admin/stats/balance?period=2026-Q①")
        assert resp.status_code == 400


class TestDecimalPrecision:
    """Verify decimal arithmetic precision in the balance calculations."""

    @pytest.mark.asyncio
    async def test_fractional_amounts_summed_precisely(self, db_session, admin_client, admin_user):
        """
        Verify that fractional amounts are summed with exact decimal precision.

        Three payments of 33.33 PLN must total 99.99 PLN, not 100.00 PLN, which
        would indicate a floating-point rounding error instead of proper Decimal use.
        """
        for _ in range(3):
            await _make_payment(
                db_session, admin_user.id, Decimal("33.33"),
                payment_type="event",
                created_at=datetime(2027, 3, 10),
            )
        resp = await admin_client.get("/admin/stats/balance?period=2027-03")
        data = resp.json()
        assert data["total_income"] == "99.99 PLN"

    @pytest.mark.asyncio
    async def test_one_cent_payment(self, db_session, admin_client, admin_user):
        """
        Verify that a minimal 0.01 PLN payment is correctly tracked.

        The smallest possible amount must not be skipped or rounded to zero.
        """
        await _make_payment(
            db_session, admin_user.id, Decimal("0.01"),
            payment_type="subscription",
            created_at=datetime(2027, 4, 1),
            extra_data='{"plan_code": "trial"}',
        )
        resp = await admin_client.get("/admin/stats/balance?period=2027-04")
        data = resp.json()
        assert data["total_income"] == "0.01 PLN"
        assert data["total_income_subscription"] == "0.01 PLN"

    @pytest.mark.asyncio
    async def test_large_amount_payment(self, db_session, admin_client, admin_user):
        """
        Verify that a very large payment amount is handled without overflow.

        A payment of 99999999.99 (the maximum for Numeric(10,2)) must be
        formatted and summed without truncation.
        """
        await _make_payment(
            db_session, admin_user.id, Decimal("99999999.99"),
            payment_type="event",
            created_at=datetime(2027, 5, 1),
        )
        resp = await admin_client.get("/admin/stats/balance?period=2027-05")
        data = resp.json()
        assert data["total_income"] == "99999999.99 PLN"

    @pytest.mark.asyncio
    async def test_many_small_payments_accumulated(self, db_session, admin_client, admin_user):
        """
        Verify that many small payments accumulate without precision drift.

        One hundred payments of 0.01 PLN must total exactly 1.00 PLN, testing
        that repeated small additions do not introduce floating-point errors.
        """
        for _ in range(100):
            await _make_payment(
                db_session, admin_user.id, Decimal("0.01"),
                payment_type="event",
                created_at=datetime(2027, 6, 15),
            )
        resp = await admin_client.get("/admin/stats/balance?period=2027-06")
        data = resp.json()
        assert data["total_income"] == "1.00 PLN"
        assert data["total_tx_count"] == 100

    @pytest.mark.asyncio
    async def test_net_exact_zero_when_income_equals_refunds(self, db_session, admin_client, admin_user):
        """
        Verify that matching income and refunds produce exactly zero net.

        Income of 123.45 PLN and a refund of 123.45 PLN must yield a net
        of exactly 0.00 PLN, not -0.00 or an epsilon residue.
        """
        await _make_payment(
            db_session, admin_user.id, Decimal("123.45"),
            payment_type="event",
            created_at=datetime(2027, 7, 1),
        )
        await _make_payment(
            db_session, admin_user.id, Decimal("123.45"),
            status=DBPaymentStatus.REFUNDED.value,
            payment_type="event",
            created_at=datetime(2027, 7, 2),
        )
        resp = await admin_client.get("/admin/stats/balance?period=2027-07")
        data = resp.json()
        assert data["total_net"] == "0.00 PLN"
        assert "-" not in data["total_net"]


class TestSubscriptionExtraDataEdgeCases:
    """Cover unusual extra_data values in subscription payments."""

    @pytest.mark.asyncio
    async def test_extra_data_null(self, db_session, admin_client, admin_user):
        """
        Verify that a subscription payment with NULL extra_data gets plan_code 'unknown'.

        The parser must assign 'unknown' as the plan_code instead of raising an exception
        when extra_data is absent from the database.
        """
        await _make_payment(
            db_session, admin_user.id, Decimal("20.00"),
            payment_type="subscription",
            created_at=datetime(2027, 8, 1),
            extra_data=None,
        )
        resp = await admin_client.get("/admin/stats/balance?period=2027-08")
        data = resp.json()
        assert len(data["subscriptions"]) == 1
        assert data["subscriptions"][0]["plan_code"] == "unknown"

    @pytest.mark.asyncio
    async def test_extra_data_empty_json_object(self, db_session, admin_client, admin_user):
        """
        Verify that an empty JSON object '{}' yields plan_code 'unknown'.

        The JSON is valid but contains no 'plan_code' key, so the parser must
        fall back to 'unknown'.
        """
        await _make_payment(
            db_session, admin_user.id, Decimal("20.00"),
            payment_type="subscription",
            created_at=datetime(2027, 9, 1),
            extra_data='{}',
        )
        resp = await admin_client.get("/admin/stats/balance?period=2027-09")
        data = resp.json()
        assert data["subscriptions"][0]["plan_code"] == "unknown"

    @pytest.mark.asyncio
    async def test_extra_data_json_array_instead_of_object(self, db_session, admin_client, admin_user):
        """
        Verify that a JSON array instead of an object yields plan_code 'unknown'.

        When extra_data is '[1, 2, 3]', isinstance(parsed, dict) returns False,
        so the parser must default to 'unknown'.
        """
        await _make_payment(
            db_session, admin_user.id, Decimal("20.00"),
            payment_type="subscription",
            created_at=datetime(2027, 10, 1),
            extra_data='[1, 2, 3]',
        )
        resp = await admin_client.get("/admin/stats/balance?period=2027-10")
        data = resp.json()
        assert data["subscriptions"][0]["plan_code"] == "unknown"

    @pytest.mark.asyncio
    async def test_extra_data_plan_code_is_integer(self, db_session, admin_client, admin_user):
        """
        Verify that a numeric plan_code is converted to its string representation.

        When extra_data is '{"plan_code": 42}', the parser converts via str(),
        so plan_code must be '42'.
        """
        await _make_payment(
            db_session, admin_user.id, Decimal("20.00"),
            payment_type="subscription",
            created_at=datetime(2027, 11, 1),
            extra_data='{"plan_code": 42}',
        )
        resp = await admin_client.get("/admin/stats/balance?period=2027-11")
        data = resp.json()
        assert data["subscriptions"][0]["plan_code"] == "42"

    @pytest.mark.asyncio
    async def test_extra_data_plan_code_is_null(self, db_session, admin_client, admin_user):
        """
        Verify handling of a null plan_code inside valid JSON.

        With extra_data '{"plan_code": null}', the key exists but its value is None.
        The result may be 'None', 'unknown', or 'none' depending on implementation.
        """
        await _make_payment(
            db_session, admin_user.id, Decimal("20.00"),
            payment_type="subscription",
            created_at=datetime(2027, 12, 1),
            extra_data='{"plan_code": null}',
        )
        resp = await admin_client.get("/admin/stats/balance?period=2027-12")
        data = resp.json()
        assert data["subscriptions"][0]["plan_code"] in ("None", "unknown", "none")

    @pytest.mark.asyncio
    async def test_extra_data_with_nested_plan_code(self, db_session, admin_client, admin_user):
        """
        Verify that a nested plan_code is not extracted from a child object.

        When extra_data is '{"subscription": {"plan_code": "monthly"}}', the top-level
        .get('plan_code') returns nothing, so plan_code must be 'unknown'.
        """
        await _make_payment(
            db_session, admin_user.id, Decimal("20.00"),
            payment_type="subscription",
            created_at=datetime(2028, 1, 1),
            extra_data='{"subscription": {"plan_code": "monthly"}}',
        )
        resp = await admin_client.get("/admin/stats/balance?period=2028-01")
        data = resp.json()
        assert data["subscriptions"][0]["plan_code"] == "unknown"

    @pytest.mark.asyncio
    async def test_extra_data_empty_string_plan_code(self, db_session, admin_client, admin_user):
        """
        Verify that an empty string plan_code is preserved as-is.

        When extra_data is '{"plan_code": ""}', the parser accepts the empty string
        as a valid value.
        """
        await _make_payment(
            db_session, admin_user.id, Decimal("20.00"),
            payment_type="subscription",
            created_at=datetime(2028, 2, 1),
            extra_data='{"plan_code": ""}',
        )
        resp = await admin_client.get("/admin/stats/balance?period=2028-02")
        data = resp.json()
        assert data["subscriptions"][0]["plan_code"] == ""


class TestStatusCombinations:
    """Cover all payment statuses and their impact on the balance."""

    @pytest.mark.asyncio
    async def test_all_six_statuses_at_once(self, db_session, admin_client, admin_user):
        """
        Verify correct accounting when all six payment statuses coexist.

        In one month, one payment per status (pending, processing, completed,
        failed, refunded, cancelled). Income must include only completed,
        refunds only refunded, pending must include pending + processing,
        and failed/cancelled must be ignored entirely.
        """
        statuses = [
            (DBPaymentStatus.PENDING.value, Decimal("60.00")),
            (DBPaymentStatus.PROCESSING.value, Decimal("70.00")),
            (DBPaymentStatus.COMPLETED.value, Decimal("100.00")),
            (DBPaymentStatus.FAILED.value, Decimal("80.00")),
            (DBPaymentStatus.REFUNDED.value, Decimal("50.00")),
            (DBPaymentStatus.CANCELLED.value, Decimal("90.00")),
        ]
        for status, amount in statuses:
            await _make_payment(
                db_session, admin_user.id, amount,
                status=status, payment_type="event",
                created_at=datetime(2028, 3, 10),
            )

        resp = await admin_client.get("/admin/stats/balance?period=2028-03")
        data = resp.json()
        assert data["total_income"] == "100.00 PLN"
        assert data["total_refunds"] == "50.00 PLN"
        assert data["total_net"] == "50.00 PLN"
        assert data["total_tx_count"] == 1
        assert data["total_refund_count"] == 1
        assert data["pending"]["pending_total"] == "130.00 PLN"

    @pytest.mark.asyncio
    async def test_failed_not_counted_in_pending(self, db_session, admin_client, admin_user):
        """
        Verify that failed and cancelled payments do not appear anywhere in the balance.

        Two payments (one failed, one cancelled) must result in zero income, zero
        refunds, and zero pending.
        """
        await _make_payment(
            db_session, admin_user.id, Decimal("100.00"),
            status=DBPaymentStatus.FAILED.value,
            payment_type="event", created_at=datetime(2028, 4, 5),
        )
        await _make_payment(
            db_session, admin_user.id, Decimal("200.00"),
            status=DBPaymentStatus.CANCELLED.value,
            payment_type="event", created_at=datetime(2028, 4, 6),
        )
        resp = await admin_client.get("/admin/stats/balance?period=2028-04")
        data = resp.json()
        assert data["total_income"] == "0.00 PLN"
        assert data["total_refunds"] == "0.00 PLN"
        assert data["pending"]["pending_total"] == "0.00 PLN"
        for m in data["months"]:
            assert m["income_total"] == "0.00 PLN"
            assert m["refunds"] == "0.00 PLN"

    @pytest.mark.asyncio
    async def test_refunded_subscription_affects_subscription_breakdown(self, db_session, admin_client, admin_user):
        """
        Verify that a refunded subscription appears in the subscription breakdown.

        A completed monthly subscription (20 PLN) and a refunded one (20 PLN)
        must show income=20, refunds=20, net=0 in the per-plan breakdown.
        """
        await _make_payment(
            db_session, admin_user.id, Decimal("20.00"),
            status=DBPaymentStatus.COMPLETED.value,
            payment_type="subscription",
            created_at=datetime(2028, 5, 1),
            extra_data='{"plan_code": "monthly"}',
        )
        await _make_payment(
            db_session, admin_user.id, Decimal("20.00"),
            status=DBPaymentStatus.REFUNDED.value,
            payment_type="subscription",
            created_at=datetime(2028, 5, 2),
            extra_data='{"plan_code": "monthly"}',
        )
        resp = await admin_client.get("/admin/stats/balance?period=2028-05")
        data = resp.json()
        plans = {s["plan_code"]: s for s in data["subscriptions"]}
        assert "monthly" in plans
        assert plans["monthly"]["income"] == "20.00 PLN"
        assert plans["monthly"]["refunds"] == "20.00 PLN"
        assert plans["monthly"]["net"] == "0.00 PLN"
        assert plans["monthly"]["refund_count"] == 1


class TestEventBreakdownHardcore:
    """Edge-case tests for the per-event breakdown."""

    @pytest.mark.asyncio
    async def test_event_payment_without_registration_not_in_events(self, db_session, admin_client, admin_user):
        """
        Verify that an orphaned event payment is counted in totals but not in the event breakdown.

        A completed event payment with no matching registration record still contributes
        to total income, but the per-event breakdown excludes it because the JOIN with
        registrations finds no match.
        """
        await _make_payment(
            db_session, admin_user.id, Decimal("50.00"),
            payment_type="event",
            created_at=datetime(2028, 6, 1),
        )
        resp = await admin_client.get("/admin/stats/balance?period=2028-06")
        data = resp.json()
        assert data["total_income"] == "50.00 PLN"
        assert data["total_income_event"] == "50.00 PLN"
        assert len(data["events"]) == 0

    @pytest.mark.asyncio
    async def test_multiple_events_sorted_by_income_desc(self, db_session, admin_client, admin_user):
        """
        Verify that the per-event breakdown is sorted by income in descending order.

        Three events with incomes of 10, 200, and 50 PLN must appear in the
        breakdown ordered as 200, 50, 10.
        """
        user_b = await _make_user(db_session)
        user_c = await _make_user(db_session)
        events_data = [
            ("Small", Decimal("10.00"), admin_user),
            ("Big", Decimal("200.00"), user_b),
            ("Medium", Decimal("50.00"), user_c),
        ]
        for idx, (title, amount, user) in enumerate(events_data, 1):
            ev = await _make_event(db_session, title, datetime(2028, 7, idx))
            p = await _make_payment(
                db_session, user.id, amount,
                payment_type="event", created_at=datetime(2028, 7, idx),
            )
            await _make_registration(db_session, user.id, ev.id, payment_id=p.external_id, occurrence_date=date(2028, 7, idx))

        resp = await admin_client.get("/admin/stats/balance?period=2028-07")
        data = resp.json()
        assert len(data["events"]) == 3
        incomes = [e["income"] for e in data["events"]]
        assert incomes == ["200.00 PLN", "50.00 PLN", "10.00 PLN"]

    @pytest.mark.asyncio
    async def test_event_with_zero_income_only_refund(self, db_session, admin_client, admin_user):
        """
        Verify that an event with only refunded payments shows negative net.

        When an event has zero completed payments and only refunded ones, the
        breakdown must show income=0, refunds=X, and a negative net value.
        """
        ev = await _make_event(db_session, "AllRefunded", datetime(2028, 8, 1))
        p = await _make_payment(
            db_session, admin_user.id, Decimal("75.00"),
            status=DBPaymentStatus.REFUNDED.value,
            payment_type="event", created_at=datetime(2028, 8, 2),
        )
        await _make_registration(db_session, admin_user.id, ev.id, payment_id=p.external_id, occurrence_date=date(2028, 8, 2))

        resp = await admin_client.get("/admin/stats/balance?period=2028-08")
        data = resp.json()
        assert len(data["events"]) == 1
        assert data["events"][0]["income"] == "0.00 PLN"
        assert data["events"][0]["refunds"] == "75.00 PLN"
        assert data["events"][0]["net"] == "-75.00 PLN"

    @pytest.mark.asyncio
    async def test_event_city_is_null(self, db_session, admin_client, admin_user):
        """
        Verify that an event with no city returns an empty string instead of null.

        When the event has city=None, the endpoint must return an empty string
        so the frontend does not need to handle null values.
        """
        ev = await _make_event(db_session, "Bezmiasto", datetime(2028, 9, 1), city="")
        p = await _make_payment(
            db_session, admin_user.id, Decimal("10.00"),
            payment_type="event", created_at=datetime(2028, 9, 1),
        )
        await _make_registration(db_session, admin_user.id, ev.id, payment_id=p.external_id, occurrence_date=date(2028, 9, 1))

        resp = await admin_client.get("/admin/stats/balance?period=2028-09")
        data = resp.json()
        assert data["events"][0]["city"] == ""


class TestMonthlyBreakdownHardcore:
    """Verify monthly breakdown logic under rare edge cases."""

    @pytest.mark.asyncio
    async def test_monthly_missing_months_not_filled(self, db_session, admin_client, admin_user):
        """
        Verify that months with no payments are omitted from the breakdown.

        In Q1 2028, payments exist only in January and March. The endpoint
        must return exactly 2 rows without filling in February with zeros.
        """
        await _make_payment(
            db_session, admin_user.id, Decimal("10.00"),
            payment_type="event", created_at=datetime(2028, 1, 15),
        )
        await _make_payment(
            db_session, admin_user.id, Decimal("30.00"),
            payment_type="event", created_at=datetime(2028, 3, 15),
        )
        resp = await admin_client.get("/admin/stats/balance?period=2028-Q1")
        data = resp.json()
        month_labels = [m["month"] for m in data["months"]]
        assert month_labels == ["2028-01", "2028-03"]
        assert len(data["months"]) == 2

    @pytest.mark.asyncio
    async def test_monthly_refund_in_different_month_than_income(self, db_session, admin_client, admin_user):
        """
        Verify correct allocation when a refund falls in a different month than the income.

        Completed payment in January (100 PLN) and refund in February (80 PLN)
        within Q1. January shows income=100/refunds=0, February shows income=0/
        refunds=80, and the quarterly total nets to 20 PLN.
        """
        await _make_payment(
            db_session, admin_user.id, Decimal("100.00"),
            payment_type="event",
            created_at=datetime(2028, 1, 10),
        )
        await _make_payment(
            db_session, admin_user.id, Decimal("80.00"),
            status=DBPaymentStatus.REFUNDED.value,
            payment_type="event",
            created_at=datetime(2028, 2, 15),
        )
        resp = await admin_client.get("/admin/stats/balance?period=2028-Q1")
        data = resp.json()
        assert data["total_income"] == "100.00 PLN"
        assert data["total_refunds"] == "80.00 PLN"
        assert data["total_net"] == "20.00 PLN"

        months = {m["month"]: m for m in data["months"]}
        assert months["2028-01"]["income_total"] == "100.00 PLN"
        assert months["2028-01"]["refunds"] == "0.00 PLN"
        assert months["2028-02"]["income_total"] == "0.00 PLN"
        assert months["2028-02"]["refunds"] == "80.00 PLN"
        assert months["2028-02"]["net"] == "-80.00 PLN"

    @pytest.mark.asyncio
    async def test_monthly_event_and_subscription_split_in_same_month(self, db_session, admin_client, admin_user):
        """
        Verify that event and subscription income are split within the same month.

        One month with an event payment (50 PLN) and a subscription payment (20 PLN).
        The monthly breakdown must separate income_event and income_subscription.
        """
        await _make_payment(
            db_session, admin_user.id, Decimal("50.00"),
            payment_type="event", created_at=datetime(2028, 10, 5),
        )
        await _make_payment(
            db_session, admin_user.id, Decimal("20.00"),
            payment_type="subscription", created_at=datetime(2028, 10, 15),
            extra_data='{"plan_code": "monthly"}',
        )
        resp = await admin_client.get("/admin/stats/balance?period=2028-10")
        data = resp.json()
        assert len(data["months"]) == 1
        m = data["months"][0]
        assert m["income_event"] == "50.00 PLN"
        assert m["income_subscription"] == "20.00 PLN"
        assert m["income_total"] == "70.00 PLN"


class TestPendingEdgeCases:
    """Edge cases for the pending payments section."""

    @pytest.mark.asyncio
    async def test_pending_and_processing_both_counted(self, db_session, admin_client, admin_user):
        """
        Verify that both pending and processing statuses count toward the pending total.

        Two pending and one processing event payments in one month. The pending_event
        field must sum all three amounts, confirming both statuses contribute.
        """
        for status in [DBPaymentStatus.PENDING.value, DBPaymentStatus.PENDING.value, DBPaymentStatus.PROCESSING.value]:
            await _make_payment(
                db_session, admin_user.id, Decimal("10.00"),
                status=status, payment_type="event",
                created_at=datetime(2028, 11, 1),
            )
        resp = await admin_client.get("/admin/stats/balance?period=2028-11")
        data = resp.json()
        assert data["pending"]["pending_event"] == "30.00 PLN"
        assert data["pending"]["pending_event_count"] == 3

    @pytest.mark.asyncio
    async def test_pending_not_included_in_income(self, db_session, admin_client, admin_user):
        """
        Verify that pending payments are excluded from income.

        Five pending event payments (5x10 PLN) plus one completed (50 PLN).
        Income must only include the completed payment; pending amounts appear
        exclusively in the pending section.
        """
        await _make_payment(
            db_session, admin_user.id, Decimal("50.00"),
            status=DBPaymentStatus.COMPLETED.value,
            payment_type="event", created_at=datetime(2028, 12, 1),
        )
        for _ in range(5):
            await _make_payment(
                db_session, admin_user.id, Decimal("10.00"),
                status=DBPaymentStatus.PENDING.value,
                payment_type="event", created_at=datetime(2028, 12, 2),
            )
        resp = await admin_client.get("/admin/stats/balance?period=2028-12")
        data = resp.json()
        assert data["total_income"] == "50.00 PLN"
        assert data["pending"]["pending_event"] == "50.00 PLN"

    @pytest.mark.asyncio
    async def test_pending_subscription_and_event_separated(self, db_session, admin_client, admin_user):
        """
        Verify that pending amounts are separated by payment type.

        Pending event (30 PLN) and pending subscription (20 PLN) must appear
        as distinct entries in the pending section with correct amounts and counts.
        """
        await _make_payment(
            db_session, admin_user.id, Decimal("30.00"),
            status=DBPaymentStatus.PENDING.value,
            payment_type="event", created_at=datetime(2029, 1, 1),
        )
        await _make_payment(
            db_session, admin_user.id, Decimal("20.00"),
            status=DBPaymentStatus.PENDING.value,
            payment_type="subscription", created_at=datetime(2029, 1, 2),
        )
        resp = await admin_client.get("/admin/stats/balance?period=2029-01")
        data = resp.json()
        assert data["pending"]["pending_event"] == "30.00 PLN"
        assert data["pending"]["pending_event_count"] == 1
        assert data["pending"]["pending_subscription"] == "20.00 PLN"
        assert data["pending"]["pending_subscription_count"] == 1
        assert data["pending"]["pending_total"] == "50.00 PLN"


class TestConcurrentPeriodsIsolation:
    """Verify that queries for different periods do not leak data between them."""

    @pytest.mark.asyncio
    async def test_adjacent_months_isolated(self, db_session, admin_client, admin_user):
        """
        Verify that adjacent months are fully isolated.

        Payments in January (100 PLN) and February (200 PLN) 2029. Querying January
        returns 100, February returns 200, and Q1 returns 300.
        """
        await _make_payment(
            db_session, admin_user.id, Decimal("100.00"),
            payment_type="event", created_at=datetime(2029, 1, 15),
        )
        await _make_payment(
            db_session, admin_user.id, Decimal("200.00"),
            payment_type="event", created_at=datetime(2029, 2, 15),
        )
        r_jan = await admin_client.get("/admin/stats/balance?period=2029-01")
        r_feb = await admin_client.get("/admin/stats/balance?period=2029-02")
        r_q1 = await admin_client.get("/admin/stats/balance?period=2029-Q1")

        assert r_jan.json()["total_income"] == "100.00 PLN"
        assert r_feb.json()["total_income"] == "200.00 PLN"
        assert r_q1.json()["total_income"] == "300.00 PLN"

    @pytest.mark.asyncio
    async def test_month_within_quarter_sums_correctly(self, db_session, admin_client, admin_user):
        """
        Verify that quarterly totals equal the sum of individual months.

        Payments in April (10), May (20), June (30) 2029. Q2 must total 60 PLN,
        each month returns its own amount, and the yearly balance also equals 60.
        """
        for m, amt in [(4, "10.00"), (5, "20.00"), (6, "30.00")]:
            await _make_payment(
                db_session, admin_user.id, Decimal(amt),
                payment_type="event", created_at=datetime(2029, m, 10),
            )
        r_q2 = await admin_client.get("/admin/stats/balance?period=2029-Q2")
        r_apr = await admin_client.get("/admin/stats/balance?period=2029-04")
        r_year = await admin_client.get("/admin/stats/balance?period=2029")
        assert r_q2.json()["total_income"] == "60.00 PLN"
        assert r_apr.json()["total_income"] == "10.00 PLN"
        assert r_year.json()["total_income"] == "60.00 PLN"


class TestMixedPaymentTypes:
    """Cover concurrent event and subscription payments with mixed statuses in the same period."""

    @pytest.mark.asyncio
    async def test_subscription_refund_not_counted_as_event_refund(self, db_session, admin_client, admin_user):
        """
        Verify that a subscription refund does not affect event income.

        Completed event (50 PLN) plus refunded subscription (20 PLN). Event income
        must remain 50, subscription income 0, total refunds 20, and net 30 PLN.
        """
        await _make_payment(
            db_session, admin_user.id, Decimal("50.00"),
            payment_type="event", created_at=datetime(2029, 3, 1),
        )
        await _make_payment(
            db_session, admin_user.id, Decimal("20.00"),
            status=DBPaymentStatus.REFUNDED.value,
            payment_type="subscription", created_at=datetime(2029, 3, 2),
            extra_data='{"plan_code": "monthly"}',
        )
        resp = await admin_client.get("/admin/stats/balance?period=2029-03")
        data = resp.json()
        assert data["total_income_event"] == "50.00 PLN"
        assert data["total_income_subscription"] == "0.00 PLN"
        assert data["total_income"] == "50.00 PLN"
        assert data["total_refunds"] == "20.00 PLN"
        assert data["total_net"] == "30.00 PLN"

    @pytest.mark.asyncio
    async def test_pending_event_and_completed_subscription_together(self, db_session, admin_client, admin_user):
        """
        Verify correct separation of pending events and completed subscriptions.

        Pending event (100 PLN) plus completed subscription (200 PLN). Income must
        include only the completed subscription. The pending section shows the event.
        """
        await _make_payment(
            db_session, admin_user.id, Decimal("100.00"),
            status=DBPaymentStatus.PENDING.value,
            payment_type="event", created_at=datetime(2029, 4, 1),
        )
        await _make_payment(
            db_session, admin_user.id, Decimal("200.00"),
            payment_type="subscription", created_at=datetime(2029, 4, 2),
            extra_data='{"plan_code": "yearly"}',
        )
        resp = await admin_client.get("/admin/stats/balance?period=2029-04")
        data = resp.json()
        assert data["total_income"] == "200.00 PLN"
        assert data["total_income_event"] == "0.00 PLN"
        assert data["total_income_subscription"] == "200.00 PLN"
        assert data["pending"]["pending_event"] == "100.00 PLN"
        assert len(data["subscriptions"]) == 1


class TestSpecialDates:
    """Cover special calendar dates and boundary conditions."""

    @pytest.mark.asyncio
    async def test_leap_year_feb29_payment_included(self, db_session, admin_client, admin_user):
        """
        Verify that a payment on Feb 29 of a leap year is included.

        A payment created on 2024-02-29 must appear in the February 2024 balance
        and the period end date must be 2024-02-29.
        """
        await _make_payment(
            db_session, admin_user.id, Decimal("29.02"),
            payment_type="event",
            created_at=datetime(2024, 2, 29, 12, 0),
        )
        resp = await admin_client.get("/admin/stats/balance?period=2024-02")
        data = resp.json()
        assert data["date_to"] == "2024-02-29"
        assert data["total_income"] == "29.02 PLN"

    @pytest.mark.asyncio
    async def test_century_leap_year_2000(self, admin_client):
        """
        Verify that the year 2000 is treated as a leap year.

        The year 2000 is divisible by 400, making it a leap year.
        February 2000 must have 29 days.
        """
        resp = await admin_client.get("/admin/stats/balance?period=2000-02")
        assert resp.status_code == 200
        assert resp.json()["date_to"] == "2000-02-29"

    @pytest.mark.asyncio
    async def test_non_leap_century_year_1900(self, admin_client):
        """
        Verify that the year 1900 is NOT a leap year.

        The year 1900 is divisible by 100 but not by 400, so February 1900
        must have only 28 days.
        """
        resp = await admin_client.get("/admin/stats/balance?period=1900-02")
        assert resp.status_code == 200
        assert resp.json()["date_to"] == "1900-02-28"

    @pytest.mark.asyncio
    async def test_new_years_eve_midnight_boundary(self, db_session, admin_client, admin_user):
        """
        Verify correct boundary handling at midnight between years.

        A payment at 2029-12-31 23:59:59 and one at 2030-01-01 00:00:00. The 2029
        annual and Q4 balances must include only the first; Q1 2030 only the second.
        """
        await _make_payment(
            db_session, admin_user.id, Decimal("500.00"),
            payment_type="event",
            created_at=datetime(2029, 12, 31, 23, 59, 59),
        )
        await _make_payment(
            db_session, admin_user.id, Decimal("600.00"),
            payment_type="event",
            created_at=datetime(2030, 1, 1, 0, 0, 0),
        )
        r_2029 = await admin_client.get("/admin/stats/balance?period=2029")
        r_q4 = await admin_client.get("/admin/stats/balance?period=2029-Q4")
        r_q1_2030 = await admin_client.get("/admin/stats/balance?period=2030-Q1")
        assert r_2029.json()["total_income"] == "500.00 PLN"
        assert r_q4.json()["total_income"] == "500.00 PLN"
        assert r_q1_2030.json()["total_income"] == "600.00 PLN"

    @pytest.mark.asyncio
    async def test_all_four_quarters_sum_to_year(self, db_session, admin_client, admin_user):
        """
        Verify that the sum of all four quarterly balances equals the annual balance.

        One payment per quarter. The sum of Q1+Q2+Q3+Q4 income must match the
        yearly total.
        """
        expected_total = Decimal("0")
        for m, amt in [(1, "10.00"), (4, "20.00"), (7, "30.00"), (10, "40.00")]:
            await _make_payment(
                db_session, admin_user.id, Decimal(amt),
                payment_type="event", created_at=datetime(2030, m, 15),
            )
            expected_total += Decimal(amt)

        q_sum = Decimal("0")
        for q in range(1, 5):
            r = await admin_client.get(f"/admin/stats/balance?period=2030-Q{q}")
            q_val = Decimal(r.json()["total_income"].replace(" PLN", ""))
            q_sum += q_val

        r_year = await admin_client.get("/admin/stats/balance?period=2030")
        year_val = Decimal(r_year.json()["total_income"].replace(" PLN", ""))
        assert q_sum == year_val == expected_total


class TestResponseConsistency:
    """Verify internal arithmetic consistency of the response."""

    @pytest.mark.asyncio
    async def test_total_income_equals_event_plus_subscription(self, db_session, admin_client, admin_user):
        """
        Verify that total_income equals event income plus subscription income.

        Mixed event and subscription completed payments. The total_income field
        must be exactly the sum of total_income_event and total_income_subscription.
        """
        await _make_payment(
            db_session, admin_user.id, Decimal("77.77"),
            payment_type="event", created_at=datetime(2030, 2, 1),
        )
        await _make_payment(
            db_session, admin_user.id, Decimal("33.33"),
            payment_type="subscription", created_at=datetime(2030, 2, 2),
            extra_data='{"plan_code": "monthly"}',
        )
        resp = await admin_client.get("/admin/stats/balance?period=2030-02")
        d = resp.json()
        total = Decimal(d["total_income"].replace(" PLN", ""))
        ev = Decimal(d["total_income_event"].replace(" PLN", ""))
        sub = Decimal(d["total_income_subscription"].replace(" PLN", ""))
        assert total == ev + sub

    @pytest.mark.asyncio
    async def test_net_equals_income_minus_refunds(self, db_session, admin_client, admin_user):
        """
        Verify that total_net equals total_income minus total_refunds.

        Income and refunds in one month. The arithmetic identity
        net = income - refunds must hold exactly.
        """
        await _make_payment(
            db_session, admin_user.id, Decimal("150.00"),
            payment_type="event", created_at=datetime(2030, 3, 1),
        )
        await _make_payment(
            db_session, admin_user.id, Decimal("45.50"),
            status=DBPaymentStatus.REFUNDED.value,
            payment_type="event", created_at=datetime(2030, 3, 15),
        )
        resp = await admin_client.get("/admin/stats/balance?period=2030-03")
        d = resp.json()
        income = Decimal(d["total_income"].replace(" PLN", ""))
        refunds = Decimal(d["total_refunds"].replace(" PLN", ""))
        net = Decimal(d["total_net"].replace(" PLN", ""))
        assert net == income - refunds

    @pytest.mark.asyncio
    async def test_monthly_rows_sum_to_totals(self, db_session, admin_client, admin_user):
        """
        Verify that monthly income rows sum to the quarterly total.

        Payments spread across all 3 months of a quarter. The sum of income_total
        from each monthly row must equal the response-level total_income.
        """
        for m, amt in [(1, "11.11"), (2, "22.22"), (3, "33.33")]:
            await _make_payment(
                db_session, admin_user.id, Decimal(amt),
                payment_type="event", created_at=datetime(2030, m, 10),
            )
        resp = await admin_client.get("/admin/stats/balance?period=2030-Q1")
        d = resp.json()
        month_sum = sum(Decimal(m["income_total"].replace(" PLN", "")) for m in d["months"])
        total = Decimal(d["total_income"].replace(" PLN", ""))
        assert month_sum == total

    @pytest.mark.asyncio
    async def test_pending_total_equals_event_plus_subscription(self, db_session, admin_client, admin_user):
        """
        Verify that pending_total equals pending_event plus pending_subscription.

        Pending event (30 PLN) and pending subscription (20 PLN). The pending_total
        field must equal the sum of its components.
        """
        await _make_payment(
            db_session, admin_user.id, Decimal("30.00"),
            status=DBPaymentStatus.PENDING.value,
            payment_type="event", created_at=datetime(2030, 4, 1),
        )
        await _make_payment(
            db_session, admin_user.id, Decimal("20.00"),
            status=DBPaymentStatus.PENDING.value,
            payment_type="subscription", created_at=datetime(2030, 4, 2),
        )
        resp = await admin_client.get("/admin/stats/balance?period=2030-04")
        d = resp.json()
        pe = Decimal(d["pending"]["pending_event"].replace(" PLN", ""))
        ps = Decimal(d["pending"]["pending_subscription"].replace(" PLN", ""))
        pt = Decimal(d["pending"]["pending_total"].replace(" PLN", ""))
        assert pt == pe + ps

    @pytest.mark.asyncio
    async def test_tx_count_equals_sum_of_monthly_tx_counts(self, db_session, admin_client, admin_user):
        """
        Verify that total transaction count equals the sum of monthly counts.

        Multiple payments across different months in Q2. The total_tx_count must
        equal the sum of tx_count values from each monthly row.
        """
        for m in [4, 5, 6]:
            for _ in range(m):  # 4+5+6 = 15 transakcji
                await _make_payment(
                    db_session, admin_user.id, Decimal("1.00"),
                    payment_type="event", created_at=datetime(2030, m, 10),
                )
        resp = await admin_client.get("/admin/stats/balance?period=2030-Q2")
        d = resp.json()
        month_tx = sum(m["tx_count"] for m in d["months"])
        assert d["total_tx_count"] == month_tx == 15


class TestHighVolumeData:
    """Stress tests with a large number of records."""

    @pytest.mark.asyncio
    async def test_50_events_in_one_month(self, db_session, admin_client, admin_user):
        """
        Verify the per-event breakdown handles 50 distinct events.

        Fifty different events, each with one completed payment in a single month.
        The breakdown must contain 50 rows sorted by income descending and the
        total must match the sum of all individual amounts.
        """
        total_expected = Decimal("0")
        users = [admin_user] + [await _make_user(db_session) for _ in range(49)]
        for i, user in enumerate(users):
            amt = Decimal(str((i + 1) * 10)) + Decimal("0.50")
            ev = await _make_event(db_session, f"Ev{i}", datetime(2030, 5, 1))
            p = await _make_payment(
                db_session, user.id, amt,
                payment_type="event", created_at=datetime(2030, 5, 15),
            )
            await _make_registration(db_session, user.id, ev.id, payment_id=p.external_id, occurrence_date=date(2030, 5, 15))
            total_expected += amt

        resp = await admin_client.get("/admin/stats/balance?period=2030-05")
        data = resp.json()
        assert len(data["events"]) == 50
        assert data["total_income"] == f"{total_expected:.2f} PLN"
        incomes = [Decimal(e["income"].replace(" PLN", "")) for e in data["events"]]
        assert incomes == sorted(incomes, reverse=True)

    @pytest.mark.asyncio
    async def test_12_months_full_year(self, db_session, admin_client, admin_user):
        """
        Verify a full-year balance with payments in every month.

        One payment per month for 12 months (10 PLN each). The annual balance
        must total 120 PLN with 12 monthly rows and 12 transactions.
        """
        for m in range(1, 13):
            await _make_payment(
                db_session, admin_user.id, Decimal("10.00"),
                payment_type="event", created_at=datetime(2031, m, 15),
            )
        resp = await admin_client.get("/admin/stats/balance?period=2031")
        data = resp.json()
        assert len(data["months"]) == 12
        assert data["total_income"] == "120.00 PLN"
        assert data["total_tx_count"] == 12
        months_sorted = [m["month"] for m in data["months"]]
        expected_months = [f"2031-{m:02d}" for m in range(1, 13)]
        assert months_sorted == expected_months


class TestSubscriptionPlanAggregation:
    """Cover unusual scenarios for the per-subscription-plan breakdown."""

    @pytest.mark.asyncio
    async def test_same_plan_multiple_payments_summed(self, db_session, admin_client, admin_user):
        """
        Verify that multiple payments for the same plan are aggregated.

        Five completed payments on plan 'monthly' at 20 PLN each. The subscription
        breakdown must show one row with income=100 and tx_count=5.
        """
        for _ in range(5):
            await _make_payment(
                db_session, admin_user.id, Decimal("20.00"),
                payment_type="subscription", created_at=datetime(2031, 2, 1),
                extra_data='{"plan_code": "monthly"}',
            )
        resp = await admin_client.get("/admin/stats/balance?period=2031-02")
        data = resp.json()
        assert len(data["subscriptions"]) == 1
        s = data["subscriptions"][0]
        assert s["plan_code"] == "monthly"
        assert s["income"] == "100.00 PLN"
        assert s["tx_count"] == 5

    @pytest.mark.asyncio
    async def test_three_plans_sorted_alphabetically(self, db_session, admin_client, admin_user):
        """
        Verify that subscription plans are sorted alphabetically.

        Three plans ('yearly', 'monthly', 'free') must appear in the breakdown
        in alphabetical order: free, monthly, yearly.
        """
        for plan in ["yearly", "monthly", "free"]:
            await _make_payment(
                db_session, admin_user.id, Decimal("10.00"),
                payment_type="subscription", created_at=datetime(2031, 3, 1),
                extra_data=f'{{"plan_code": "{plan}"}}',
            )
        resp = await admin_client.get("/admin/stats/balance?period=2031-03")
        data = resp.json()
        codes = [s["plan_code"] for s in data["subscriptions"]]
        assert codes == sorted(codes)  # alphabetical

    @pytest.mark.asyncio
    async def test_subscription_with_mixed_completed_and_refunded(self, db_session, admin_client, admin_user):
        """
        Verify plan breakdown with mixed completed and refunded payments.

        Plan 'yearly' with 3 completed (200 PLN each) and 1 refunded (200 PLN).
        Breakdown must show income=600, refunds=200, net=400, tx_count=3,
        refund_count=1.
        """
        for _ in range(3):
            await _make_payment(
                db_session, admin_user.id, Decimal("200.00"),
                payment_type="subscription", created_at=datetime(2031, 4, 1),
                extra_data='{"plan_code": "yearly"}',
            )
        await _make_payment(
            db_session, admin_user.id, Decimal("200.00"),
            status=DBPaymentStatus.REFUNDED.value,
            payment_type="subscription", created_at=datetime(2031, 4, 15),
            extra_data='{"plan_code": "yearly"}',
        )
        resp = await admin_client.get("/admin/stats/balance?period=2031-04")
        data = resp.json()
        plans = {s["plan_code"]: s for s in data["subscriptions"]}
        assert plans["yearly"]["income"] == "600.00 PLN"
        assert plans["yearly"]["refunds"] == "200.00 PLN"
        assert plans["yearly"]["net"] == "400.00 PLN"
        assert plans["yearly"]["tx_count"] == 3
        assert plans["yearly"]["refund_count"] == 1
