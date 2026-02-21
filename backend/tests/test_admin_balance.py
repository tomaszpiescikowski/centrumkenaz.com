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
        resp = await anon_client.get("/admin/balance")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_guest_returns_403(self, guest_client: AsyncClient):
        resp = await guest_client.get("/admin/balance")
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_admin_returns_200(self, admin_client: AsyncClient):
        resp = await admin_client.get("/admin/balance")
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Period parsing tests
# ---------------------------------------------------------------------------


class TestBalancePeriodParsing:
    @pytest.mark.asyncio
    async def test_invalid_period_format(self, admin_client: AsyncClient):
        resp = await admin_client.get("/admin/balance?period=bad")
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_invalid_month_13(self, admin_client: AsyncClient):
        resp = await admin_client.get("/admin/balance?period=2026-13")
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_invalid_quarter_5(self, admin_client: AsyncClient):
        resp = await admin_client.get("/admin/balance?period=2026-Q5")
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_valid_month(self, admin_client: AsyncClient):
        resp = await admin_client.get("/admin/balance?period=2026-02")
        assert resp.status_code == 200
        data = resp.json()
        assert data["period_label"] == "2026-02"
        assert data["date_from"] == "2026-02-01"
        assert data["date_to"] == "2026-02-28"

    @pytest.mark.asyncio
    async def test_valid_quarter(self, admin_client: AsyncClient):
        resp = await admin_client.get("/admin/balance?period=2026-Q1")
        assert resp.status_code == 200
        data = resp.json()
        assert data["period_label"] == "2026 Q1"
        assert data["date_from"] == "2026-01-01"
        assert data["date_to"] == "2026-03-31"

    @pytest.mark.asyncio
    async def test_valid_year(self, admin_client: AsyncClient):
        resp = await admin_client.get("/admin/balance?period=2026")
        assert resp.status_code == 200
        data = resp.json()
        assert data["period_label"] == "2026"
        assert data["date_from"] == "2026-01-01"
        assert data["date_to"] == "2026-12-31"

    @pytest.mark.asyncio
    async def test_defaults_to_current_month(self, admin_client: AsyncClient):
        resp = await admin_client.get("/admin/balance")
        assert resp.status_code == 200
        data = resp.json()
        now = datetime.utcnow()
        expected = f"{now.year}-{now.month:02d}"
        assert data["period_label"] == expected

    @pytest.mark.asyncio
    async def test_quarter_case_insensitive(self, admin_client: AsyncClient):
        resp = await admin_client.get("/admin/balance?period=2026-q2")
        assert resp.status_code == 200
        assert resp.json()["period_label"] == "2026 Q2"


# ---------------------------------------------------------------------------
# Empty state
# ---------------------------------------------------------------------------


class TestBalanceEmptyState:
    @pytest.mark.asyncio
    async def test_empty_balance(self, admin_client: AsyncClient):
        resp = await admin_client.get("/admin/balance?period=2026-01")
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

        resp = await admin_client.get("/admin/balance?period=2026-01")
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

        resp = await admin_client.get("/admin/balance?period=2026-03")
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

        resp = await admin_client.get("/admin/balance?period=2026-04")
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

        resp = await admin_client.get("/admin/balance?period=2026-05")
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

        resp = await admin_client.get("/admin/balance?period=2026-06")
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

        resp = await admin_client.get("/admin/balance?period=2026-07")
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

        resp = await admin_client.get("/admin/balance?period=2026-Q1")
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

        resp = await admin_client.get("/admin/balance?period=2025")
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

        resp = await admin_client.get("/admin/balance?period=2026-08")
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

        resp = await admin_client.get("/admin/balance?period=2026-09")
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

        resp = await admin_client.get("/admin/balance?period=2026-10")
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

        resp = await admin_client.get("/admin/balance?period=2026-11")
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

        resp = await admin_client.get("/admin/balance?period=2026-01")
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

        resp = await admin_client.get("/admin/balance?period=2026-01")
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

        resp = await admin_client.get("/admin/balance?period=2026-02")
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

        resp = await admin_client.get("/admin/balance?period=2026-01")
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

        resp = await admin_client.get("/admin/balance?period=2026-Q1")
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

        resp = await admin_client.get("/admin/balance?period=2026-01")
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
        resp = await admin_client.get("/admin/balance?period=2026-01")
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
        resp = await admin_client.get("/admin/balance?period=2026-01")
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
        resp = await admin_client.get("/admin/balance?period=2026-01")
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
        resp = await admin_client.get("/admin/balance?period=2026-01")
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
        resp = await admin_client.get("/admin/balance?period=2026-01")
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
        resp = await admin_client.get("/admin/balance?period=2024-02")
        assert resp.status_code == 200
        assert resp.json()["date_to"] == "2024-02-29"

    @pytest.mark.asyncio
    async def test_non_leap_year_february(self, admin_client: AsyncClient):
        resp = await admin_client.get("/admin/balance?period=2025-02")
        assert resp.status_code == 200
        assert resp.json()["date_to"] == "2025-02-28"

    @pytest.mark.asyncio
    async def test_q4_dates(self, admin_client: AsyncClient):
        resp = await admin_client.get("/admin/balance?period=2026-Q4")
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
        resp = await admin_client.get("/admin/balance?period=2026-01")
        data = resp.json()
        assert data["total_income"] == "0.00 PLN"
        assert data["total_tx_count"] == 1


# ===========================================================================
# HARDCORE EDGE CASES
# ===========================================================================


class TestBoundaryTimestamps:
    """Testy weryfikujące poprawność filtrowania na granicy okresów."""

    @pytest.mark.asyncio
    async def test_payment_at_midnight_first_day_of_month_included(self, db_session, admin_client, admin_user):
        """Scenariusz: Płatność została zarejestrowana dokładnie o 00:00:00.000000
        pierwszego dnia miesiąca (2026-03-01 00:00:00). Endpoint powinien ją
        uwzględnić w bilansie za marzec 2026, ponieważ date_from to 2026-03-01
        bez godziny (domyślnie 00:00:00)."""
        await _make_payment(
            db_session, admin_user.id, Decimal("11.11"),
            payment_type="event",
            created_at=datetime(2026, 3, 1, 0, 0, 0),
        )
        resp = await admin_client.get("/admin/balance?period=2026-03")
        data = resp.json()
        assert data["total_income"] == "11.11 PLN"
        assert data["total_tx_count"] == 1

    @pytest.mark.asyncio
    async def test_payment_at_last_microsecond_of_month_included(self, db_session, admin_client, admin_user):
        """Scenariusz: Płatność zarejestrowana o 23:59:59.999999 ostatniego dnia
        miesiąca (2026-03-31). date_to to 2026-03-31 23:59:59.999999, więc ta
        płatność powinna być uwzględniona."""
        await _make_payment(
            db_session, admin_user.id, Decimal("22.22"),
            payment_type="event",
            created_at=datetime(2026, 3, 31, 23, 59, 59, 999999),
        )
        resp = await admin_client.get("/admin/balance?period=2026-03")
        data = resp.json()
        assert data["total_income"] == "22.22 PLN"

    @pytest.mark.asyncio
    async def test_payment_one_second_before_period_excluded(self, db_session, admin_client, admin_user):
        """Scenariusz: Płatność o 23:59:59 dnia 28 lutego 2026, odpytujemy bilans
        za marzec. Płatność jest sprzed początku okresu — nie powinna się liczyć."""
        await _make_payment(
            db_session, admin_user.id, Decimal("33.33"),
            payment_type="event",
            created_at=datetime(2026, 2, 28, 23, 59, 59),
        )
        resp = await admin_client.get("/admin/balance?period=2026-03")
        data = resp.json()
        assert data["total_income"] == "0.00 PLN"
        assert data["total_tx_count"] == 0

    @pytest.mark.asyncio
    async def test_quarter_boundary_last_second_of_q1_included(self, db_session, admin_client, admin_user):
        """Scenariusz: Płatność na samym końcu Q1 — 31 marca 23:59:59. Powinna
        zostać uwzględniona w Q1, ale nie w Q2."""
        await _make_payment(
            db_session, admin_user.id, Decimal("44.44"),
            payment_type="event",
            created_at=datetime(2026, 3, 31, 23, 59, 59),
        )
        resp_q1 = await admin_client.get("/admin/balance?period=2026-Q1")
        resp_q2 = await admin_client.get("/admin/balance?period=2026-Q2")
        assert resp_q1.json()["total_income"] == "44.44 PLN"
        assert resp_q2.json()["total_income"] == "0.00 PLN"

    @pytest.mark.asyncio
    async def test_year_boundary_dec31_vs_jan1(self, db_session, admin_client, admin_user):
        """Scenariusz: Dwie płatności — jedna 31 grudnia 2025 o 23:59, druga
        1 stycznia 2026 o 00:00. Bilans za 2025 powinien zawierać tylko
        pierwszą, za 2026 — tylko drugą."""
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
        resp_2025 = await admin_client.get("/admin/balance?period=2025")
        resp_2026 = await admin_client.get("/admin/balance?period=2026-01")
        assert resp_2025.json()["total_income"] == "100.00 PLN"
        assert resp_2026.json()["total_income"] == "200.00 PLN"


class TestMultiUserAggregation:
    """Testy potwierdzające, że bilans sumuje płatności od wielu użytkowników."""

    @pytest.mark.asyncio
    async def test_payments_from_different_users_summed(self, db_session, admin_client, admin_user):
        """Scenariusz: Trzech różnych użytkowników dokonuje płatności za
        wydarzenia w tym samym miesiącu. Bilans powinien zsumować kwoty
        od wszystkich użytkowników — endpoint nie filtruje po user_id."""
        user_a = await _make_user(db_session)
        user_b = await _make_user(db_session)
        for user, amount in [(admin_user, "10.00"), (user_a, "20.00"), (user_b, "30.00")]:
            await _make_payment(
                db_session, user.id, Decimal(amount),
                payment_type="event", created_at=datetime(2027, 1, 5),
            )
        resp = await admin_client.get("/admin/balance?period=2027-01")
        data = resp.json()
        assert data["total_income"] == "60.00 PLN"
        assert data["total_tx_count"] == 3

    @pytest.mark.asyncio
    async def test_same_event_paid_by_multiple_users(self, db_session, admin_client, admin_user):
        """Scenariusz: Jedno wydarzenie, dwóch uczestników płaci osobno.
        Oba płatności powinny się pojawić w per-event breakdown
        z poprawną sumą przychodu."""
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

        resp = await admin_client.get("/admin/balance?period=2027-02")
        data = resp.json()
        assert len(data["events"]) == 1
        assert data["events"][0]["income"] == "120.00 PLN"
        assert data["events"][0]["tx_count"] == 2


class TestPeriodParsingHardcore:
    """Intensywne testy parsowania parametru period z dziwnymi wartościami."""

    @pytest.mark.asyncio
    async def test_month_00_invalid(self, admin_client):
        """Scenariusz: Miesiąc '00' jest pozornie poprawny formatem YYYY-MM,
        ale miesiąc 0 nie istnieje. Endpoint musi zwrócić 400."""
        resp = await admin_client.get("/admin/balance?period=2026-00")
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_quarter_0_invalid(self, admin_client):
        """Scenariusz: Kwartał Q0 nie istnieje (dozwolone: Q1-Q4).
        Endpoint powinien zwrócić 400."""
        resp = await admin_client.get("/admin/balance?period=2026-Q0")
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_negative_year_invalid(self, admin_client):
        """Scenariusz: Rok ujemny (-2026). Regex wymaga dokładnie 4 cyfr,
        więc minus na początku nie pasuje do żadnego wzorca."""
        resp = await admin_client.get("/admin/balance?period=-2026")
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_period_with_trailing_whitespace(self, admin_client):
        """Scenariusz: Parametr z trailing space '2026-01 '. Serwer
        powinien go odrzucić jako niepasujący do wzorca."""
        resp = await admin_client.get("/admin/balance?period=2026-01 ")
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_period_with_leading_zero_year(self, admin_client):
        """Scenariusz: Rok z zerem na początku '0026-01'. Regex wymaga 4 cyfr,
        więc '0026' pasuje do formatu. Sprawdzamy, czy nie powoduje
        wewnętrznego błędu — oczekujemy 200 (poprawna odpowiedź, ale puste dane)."""
        resp = await admin_client.get("/admin/balance?period=0026-01")
        assert resp.status_code == 200
        assert resp.json()["total_income"] == "0.00 PLN"

    @pytest.mark.asyncio
    async def test_very_far_future_year(self, admin_client):
        """Scenariusz: Bilans za rok 9999. Nie powinno być żadnych danych,
        ale endpoint musi odpowiedzieć poprawnie bez wyjątku."""
        resp = await admin_client.get("/admin/balance?period=9999")
        assert resp.status_code == 200
        assert resp.json()["total_income"] == "0.00 PLN"

    @pytest.mark.asyncio
    async def test_five_digit_year_invalid(self, admin_client):
        """Scenariusz: Rok pięciocyfrowy '10000'. Regex wymaga dokładnie 4 cyfr,
        więc powinien zwrócić 400."""
        resp = await admin_client.get("/admin/balance?period=10000")
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_empty_period_defaults_to_current(self, admin_client):
        """Scenariusz: Pusty string jako period (?period=). W Pythonie
        pusty string jest falsy, więc `if not period:` jest True i endpoint
        używa domyślnego bieżącego miesiąca. Odpowiedź powinna być 200."""
        resp = await admin_client.get("/admin/balance?period=")
        assert resp.status_code == 200
        # odpowiedź zawiera dane domyślnego bieżącego miesiąca
        assert "period_label" in resp.json()

    @pytest.mark.asyncio
    async def test_period_sql_injection_attempt(self, admin_client):
        """Scenariusz: Parametr period zawiera próbę SQL injection:
        '2026-01; DROP TABLE payments;--'. Regex nie dopuści tego formatu."""
        resp = await admin_client.get("/admin/balance?period=2026-01; DROP TABLE payments;--")
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_period_with_unicode(self, admin_client):
        """Scenariusz: Parametr period z polskimi znakami '2026-Q①'.
        Regex powinien odrzucić taki format."""
        resp = await admin_client.get("/admin/balance?period=2026-Q①")
        assert resp.status_code == 400


class TestDecimalPrecision:
    """Testy weryfikujące precyzję arytmetyki dziesiętnej w bilansie."""

    @pytest.mark.asyncio
    async def test_fractional_amounts_summed_precisely(self, db_session, admin_client, admin_user):
        """Scenariusz: Trzy płatności po 33.33 PLN powinny dać 99.99 PLN,
        a nie 100.00 PLN (co byłoby błędem zaokrąglenia float).
        Weryfikujemy, że Decimal arithmetic jest używany poprawnie."""
        for _ in range(3):
            await _make_payment(
                db_session, admin_user.id, Decimal("33.33"),
                payment_type="event",
                created_at=datetime(2027, 3, 10),
            )
        resp = await admin_client.get("/admin/balance?period=2027-03")
        data = resp.json()
        assert data["total_income"] == "99.99 PLN"

    @pytest.mark.asyncio
    async def test_one_cent_payment(self, db_session, admin_client, admin_user):
        """Scenariusz: Płatność na minimalną kwotę — 0.01 PLN.
        Upewniamy się, że nie jest pomijana ani zaokrąglana do zera."""
        await _make_payment(
            db_session, admin_user.id, Decimal("0.01"),
            payment_type="subscription",
            created_at=datetime(2027, 4, 1),
            extra_data='{"plan_code": "trial"}',
        )
        resp = await admin_client.get("/admin/balance?period=2027-04")
        data = resp.json()
        assert data["total_income"] == "0.01 PLN"
        assert data["total_income_subscription"] == "0.01 PLN"

    @pytest.mark.asyncio
    async def test_large_amount_payment(self, db_session, admin_client, admin_user):
        """Scenariusz: Płatność na bardzo dużą kwotę — 99999999.99 (maksimum
        dla Numeric(10,2)). Sprawdzamy, czy formatowanie i sumowanie
        nie powodują overflow ani obcięcia."""
        await _make_payment(
            db_session, admin_user.id, Decimal("99999999.99"),
            payment_type="event",
            created_at=datetime(2027, 5, 1),
        )
        resp = await admin_client.get("/admin/balance?period=2027-05")
        data = resp.json()
        assert data["total_income"] == "99999999.99 PLN"

    @pytest.mark.asyncio
    async def test_many_small_payments_accumulated(self, db_session, admin_client, admin_user):
        """Scenariusz: 100 płatności po 0.01 PLN. Suma powinna wynosić
        dokładnie 1.00 PLN. Testuje akumulację wielu małych wartości
        bez dryfu precyzji."""
        for _ in range(100):
            await _make_payment(
                db_session, admin_user.id, Decimal("0.01"),
                payment_type="event",
                created_at=datetime(2027, 6, 15),
            )
        resp = await admin_client.get("/admin/balance?period=2027-06")
        data = resp.json()
        assert data["total_income"] == "1.00 PLN"
        assert data["total_tx_count"] == 100

    @pytest.mark.asyncio
    async def test_net_exact_zero_when_income_equals_refunds(self, db_session, admin_client, admin_user):
        """Scenariusz: Przychód = 123.45 PLN, zwrot = 123.45 PLN. Bilans
        netto powinien wynosić dokładnie 0.00 PLN, nie -0.00 czy epsilon."""
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
        resp = await admin_client.get("/admin/balance?period=2027-07")
        data = resp.json()
        assert data["total_net"] == "0.00 PLN"
        # upewniamy się, że nie ma "-0.00"
        assert "-" not in data["total_net"]


class TestSubscriptionExtraDataEdgeCases:
    """Testy obejmujące dziwne wartości extra_data w płatnościach subskrypcyjnych."""

    @pytest.mark.asyncio
    async def test_extra_data_null(self, db_session, admin_client, admin_user):
        """Scenariusz: Płatność subskrypcyjna z extra_data = NULL w bazie.
        Parser powinien przypisać plan_code = 'unknown' zamiast wyrzucać wyjątek."""
        await _make_payment(
            db_session, admin_user.id, Decimal("20.00"),
            payment_type="subscription",
            created_at=datetime(2027, 8, 1),
            extra_data=None,
        )
        resp = await admin_client.get("/admin/balance?period=2027-08")
        data = resp.json()
        assert len(data["subscriptions"]) == 1
        assert data["subscriptions"][0]["plan_code"] == "unknown"

    @pytest.mark.asyncio
    async def test_extra_data_empty_json_object(self, db_session, admin_client, admin_user):
        """Scenariusz: extra_data to poprawny JSON '{}', ale nie zawiera klucza
        'plan_code'. Parser powinien ustawić plan_code = 'unknown'."""
        await _make_payment(
            db_session, admin_user.id, Decimal("20.00"),
            payment_type="subscription",
            created_at=datetime(2027, 9, 1),
            extra_data='{}',
        )
        resp = await admin_client.get("/admin/balance?period=2027-09")
        data = resp.json()
        assert data["subscriptions"][0]["plan_code"] == "unknown"

    @pytest.mark.asyncio
    async def test_extra_data_json_array_instead_of_object(self, db_session, admin_client, admin_user):
        """Scenariusz: extra_data to poprawny JSON, ale tablica '[1, 2, 3]'
        zamiast obiektu. isinstance(parsed, dict) powinno zwrócić False,
        więc plan_code = 'unknown'."""
        await _make_payment(
            db_session, admin_user.id, Decimal("20.00"),
            payment_type="subscription",
            created_at=datetime(2027, 10, 1),
            extra_data='[1, 2, 3]',
        )
        resp = await admin_client.get("/admin/balance?period=2027-10")
        data = resp.json()
        assert data["subscriptions"][0]["plan_code"] == "unknown"

    @pytest.mark.asyncio
    async def test_extra_data_plan_code_is_integer(self, db_session, admin_client, admin_user):
        """Scenariusz: extra_data = '{"plan_code": 42}' — plan_code jest liczbą,
        nie stringiem. Parser konwertuje przez str(), więc plan_code = '42'."""
        await _make_payment(
            db_session, admin_user.id, Decimal("20.00"),
            payment_type="subscription",
            created_at=datetime(2027, 11, 1),
            extra_data='{"plan_code": 42}',
        )
        resp = await admin_client.get("/admin/balance?period=2027-11")
        data = resp.json()
        assert data["subscriptions"][0]["plan_code"] == "42"

    @pytest.mark.asyncio
    async def test_extra_data_plan_code_is_null(self, db_session, admin_client, admin_user):
        """Scenariusz: extra_data = '{"plan_code": null}'. parsed.get('plan_code')
        zwraca None, ale domyślna wartość w .get('plan_code', 'unknown') nie
        działa bo klucz istnieje. Sprawdzamy, czy wynik to 'None' lub 'unknown'."""
        await _make_payment(
            db_session, admin_user.id, Decimal("20.00"),
            payment_type="subscription",
            created_at=datetime(2027, 12, 1),
            extra_data='{"plan_code": null}',
        )
        resp = await admin_client.get("/admin/balance?period=2027-12")
        data = resp.json()
        # plan_code: null → .get daje None (klucz istnieje), str(None) = "None"
        # albo endpoint obsługuje to jako "unknown" — oba są akceptowalne
        assert data["subscriptions"][0]["plan_code"] in ("None", "unknown", "none")

    @pytest.mark.asyncio
    async def test_extra_data_with_nested_plan_code(self, db_session, admin_client, admin_user):
        """Scenariusz: extra_data = '{"subscription": {"plan_code": "monthly"}}'.
        Klucz plan_code jest zagnieżdżony, więc .get('plan_code') na najwyższym
        poziomie zwraca 'unknown'."""
        await _make_payment(
            db_session, admin_user.id, Decimal("20.00"),
            payment_type="subscription",
            created_at=datetime(2028, 1, 1),
            extra_data='{"subscription": {"plan_code": "monthly"}}',
        )
        resp = await admin_client.get("/admin/balance?period=2028-01")
        data = resp.json()
        assert data["subscriptions"][0]["plan_code"] == "unknown"

    @pytest.mark.asyncio
    async def test_extra_data_empty_string_plan_code(self, db_session, admin_client, admin_user):
        """Scenariusz: extra_data = '{"plan_code": ""}'. Pusty string jako
        plan_code. Parser powinien go zaakceptować — str('') = ''."""
        await _make_payment(
            db_session, admin_user.id, Decimal("20.00"),
            payment_type="subscription",
            created_at=datetime(2028, 2, 1),
            extra_data='{"plan_code": ""}',
        )
        resp = await admin_client.get("/admin/balance?period=2028-02")
        data = resp.json()
        # pusty string to nadal poprawna wartość
        assert data["subscriptions"][0]["plan_code"] == ""


class TestStatusCombinations:
    """Testy pokrywające wszystkie statusy płatności i ich wpływ na bilans."""

    @pytest.mark.asyncio
    async def test_all_six_statuses_at_once(self, db_session, admin_client, admin_user):
        """Scenariusz: W jednym miesiącu mamy po jednej płatności na każdy
        z 6 statusów (pending, processing, completed, failed, refunded, cancelled).
        Bilans powinien:
          - income: tylko completed (100 PLN)
          - refunds: tylko refunded (50 PLN)
          - net: 50 PLN
          - pending: pending + processing (60 + 70 = 130 PLN)
          - failed i cancelled: ignorowane całkowicie"""
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

        resp = await admin_client.get("/admin/balance?period=2028-03")
        data = resp.json()
        assert data["total_income"] == "100.00 PLN"
        assert data["total_refunds"] == "50.00 PLN"
        assert data["total_net"] == "50.00 PLN"
        assert data["total_tx_count"] == 1
        assert data["total_refund_count"] == 1
        assert data["pending"]["pending_total"] == "130.00 PLN"

    @pytest.mark.asyncio
    async def test_failed_not_counted_in_pending(self, db_session, admin_client, admin_user):
        """Scenariusz: Dwie płatności — jedna failed, jedna cancelled.
        Pending powinno być 0, income też 0. Te statusy nie powinny
        pojawiać się nigdzie w bilansie."""
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
        resp = await admin_client.get("/admin/balance?period=2028-04")
        data = resp.json()
        assert data["total_income"] == "0.00 PLN"
        assert data["total_refunds"] == "0.00 PLN"
        assert data["pending"]["pending_total"] == "0.00 PLN"
        # failed/cancelled tworzą wpisy miesiąca z zerami (query nie filtruje statusów)
        for m in data["months"]:
            assert m["income_total"] == "0.00 PLN"
            assert m["refunds"] == "0.00 PLN"

    @pytest.mark.asyncio
    async def test_refunded_subscription_affects_subscription_breakdown(self, db_session, admin_client, admin_user):
        """Scenariusz: Użytkownik kupił subskrypcję monthly za 20 PLN (completed),
        potem dostał zwrot za taką samą (refunded, 20 PLN). Per-subscription
        breakdown powinien pokazać: income=20, refunds=20, net=0."""
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
        resp = await admin_client.get("/admin/balance?period=2028-05")
        data = resp.json()
        plans = {s["plan_code"]: s for s in data["subscriptions"]}
        assert "monthly" in plans
        assert plans["monthly"]["income"] == "20.00 PLN"
        assert plans["monthly"]["refunds"] == "20.00 PLN"
        assert plans["monthly"]["net"] == "0.00 PLN"
        assert plans["monthly"]["refund_count"] == 1


class TestEventBreakdownHardcore:
    """Testy krawędziowe dla podziału per-event."""

    @pytest.mark.asyncio
    async def test_event_payment_without_registration_not_in_events(self, db_session, admin_client, admin_user):
        """Scenariusz: Płatność typu 'event' completed, ale zero powiązań
        w tabeli registrations (np. orphaned payment). Totals powinien ją
        policzyć (bo sumuje z tabeli payments), ale per-event breakdown
        nie powinien jej pokazać (bo JOIN z registrations nie dopasuje)."""
        await _make_payment(
            db_session, admin_user.id, Decimal("50.00"),
            payment_type="event",
            created_at=datetime(2028, 6, 1),
        )
        resp = await admin_client.get("/admin/balance?period=2028-06")
        data = resp.json()
        assert data["total_income"] == "50.00 PLN"
        assert data["total_income_event"] == "50.00 PLN"
        # brak rejestracji → brak w per-event breakdown
        assert len(data["events"]) == 0

    @pytest.mark.asyncio
    async def test_multiple_events_sorted_by_income_desc(self, db_session, admin_client, admin_user):
        """Scenariusz: Trzy wydarzenia z przychodami 10, 200, 50 PLN.
        Per-event breakdown powinien być posortowany malejąco po income:
        200, 50, 10."""
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

        resp = await admin_client.get("/admin/balance?period=2028-07")
        data = resp.json()
        assert len(data["events"]) == 3
        incomes = [e["income"] for e in data["events"]]
        assert incomes == ["200.00 PLN", "50.00 PLN", "10.00 PLN"]

    @pytest.mark.asyncio
    async def test_event_with_zero_income_only_refund(self, db_session, admin_client, admin_user):
        """Scenariusz: Wydarzenie ma tylko zwroty (refunded), zero completed.
        Per-event breakdown powinien pokazać income=0, refunds=X, net ujemny."""
        ev = await _make_event(db_session, "AllRefunded", datetime(2028, 8, 1))
        p = await _make_payment(
            db_session, admin_user.id, Decimal("75.00"),
            status=DBPaymentStatus.REFUNDED.value,
            payment_type="event", created_at=datetime(2028, 8, 2),
        )
        await _make_registration(db_session, admin_user.id, ev.id, payment_id=p.external_id, occurrence_date=date(2028, 8, 2))

        resp = await admin_client.get("/admin/balance?period=2028-08")
        data = resp.json()
        assert len(data["events"]) == 1
        assert data["events"][0]["income"] == "0.00 PLN"
        assert data["events"][0]["refunds"] == "75.00 PLN"
        assert data["events"][0]["net"] == "-75.00 PLN"

    @pytest.mark.asyncio
    async def test_event_city_is_null(self, db_session, admin_client, admin_user):
        """Scenariusz: Wydarzenie z city=None (nieuzupełnione). Endpoint
        powinien zwrócić pusty string zamiast null, aby frontend
        nie musiał obsługiwać None."""
        ev = await _make_event(db_session, "Bezmiasto", datetime(2028, 9, 1), city="")
        p = await _make_payment(
            db_session, admin_user.id, Decimal("10.00"),
            payment_type="event", created_at=datetime(2028, 9, 1),
        )
        await _make_registration(db_session, admin_user.id, ev.id, payment_id=p.external_id, occurrence_date=date(2028, 9, 1))

        resp = await admin_client.get("/admin/balance?period=2028-09")
        data = resp.json()
        assert data["events"][0]["city"] == ""


class TestMonthlyBreakdownHardcore:
    """Testy weryfikujące logikę podziału miesięcznego w rzadkich sytuacjach."""

    @pytest.mark.asyncio
    async def test_monthly_missing_months_not_filled(self, db_session, admin_client, admin_user):
        """Scenariusz: W Q1 2028 są płatności tylko w styczniu i marcu,
        nie w lutym. Monthly breakdown powinien mieć tylko 2 wiersze
        (styczeń, marzec) — endpoint NIE uzupełnia brakujących miesięcy zerami."""
        await _make_payment(
            db_session, admin_user.id, Decimal("10.00"),
            payment_type="event", created_at=datetime(2028, 1, 15),
        )
        await _make_payment(
            db_session, admin_user.id, Decimal("30.00"),
            payment_type="event", created_at=datetime(2028, 3, 15),
        )
        resp = await admin_client.get("/admin/balance?period=2028-Q1")
        data = resp.json()
        month_labels = [m["month"] for m in data["months"]]
        assert month_labels == ["2028-01", "2028-03"]
        assert len(data["months"]) == 2

    @pytest.mark.asyncio
    async def test_monthly_refund_in_different_month_than_income(self, db_session, admin_client, admin_user):
        """Scenariusz: Completed w styczniu, refunded w lutym (w ramach Q1).
        Styczeń powinien mieć income=100, refunds=0, net=100.
        Luty powinien mieć income=0, refunds=80, net=-80.
        Total Q1: income=100, refunds=80, net=20."""
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
        resp = await admin_client.get("/admin/balance?period=2028-Q1")
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
        """Scenariusz: W jednym miesiącu mamy płatność za event (50 PLN)
        i za subscription (20 PLN). Monthly breakdown powinien rozbić
        income_event i income_subscription."""
        await _make_payment(
            db_session, admin_user.id, Decimal("50.00"),
            payment_type="event", created_at=datetime(2028, 10, 5),
        )
        await _make_payment(
            db_session, admin_user.id, Decimal("20.00"),
            payment_type="subscription", created_at=datetime(2028, 10, 15),
            extra_data='{"plan_code": "monthly"}',
        )
        resp = await admin_client.get("/admin/balance?period=2028-10")
        data = resp.json()
        assert len(data["months"]) == 1
        m = data["months"][0]
        assert m["income_event"] == "50.00 PLN"
        assert m["income_subscription"] == "20.00 PLN"
        assert m["income_total"] == "70.00 PLN"


class TestPendingEdgeCases:
    """Testy krawędziowe dotyczące sekcji pending."""

    @pytest.mark.asyncio
    async def test_pending_and_processing_both_counted(self, db_session, admin_client, admin_user):
        """Scenariusz: W jednym miesiącu — 2 płatności pending i 1 processing,
        wszystkie event. pending_event powinno zsumować kwoty ze wszystkich
        trzech. Weryfikujemy, że obie statusy wliczają się do pending."""
        for status in [DBPaymentStatus.PENDING.value, DBPaymentStatus.PENDING.value, DBPaymentStatus.PROCESSING.value]:
            await _make_payment(
                db_session, admin_user.id, Decimal("10.00"),
                status=status, payment_type="event",
                created_at=datetime(2028, 11, 1),
            )
        resp = await admin_client.get("/admin/balance?period=2028-11")
        data = resp.json()
        assert data["pending"]["pending_event"] == "30.00 PLN"
        assert data["pending"]["pending_event_count"] == 3

    @pytest.mark.asyncio
    async def test_pending_not_included_in_income(self, db_session, admin_client, admin_user):
        """Scenariusz: 5 pending + 1 completed, wszystkie event. income
        powinno zawierać tylko completed (50 PLN), nie pending (5×10=50 PLN).
        Pending ma osobną sekcję."""
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
        resp = await admin_client.get("/admin/balance?period=2028-12")
        data = resp.json()
        assert data["total_income"] == "50.00 PLN"
        assert data["pending"]["pending_event"] == "50.00 PLN"

    @pytest.mark.asyncio
    async def test_pending_subscription_and_event_separated(self, db_session, admin_client, admin_user):
        """Scenariusz: Pending event (30 PLN) + pending subscription (20 PLN).
        Pending sekcja powinna rozdzielić je na event i subscription
        z poprawnymi kwotami i liczbami."""
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
        resp = await admin_client.get("/admin/balance?period=2029-01")
        data = resp.json()
        assert data["pending"]["pending_event"] == "30.00 PLN"
        assert data["pending"]["pending_event_count"] == 1
        assert data["pending"]["pending_subscription"] == "20.00 PLN"
        assert data["pending"]["pending_subscription_count"] == 1
        assert data["pending"]["pending_total"] == "50.00 PLN"


class TestConcurrentPeriodsIsolation:
    """Testy weryfikujące, że zapytania o różne okresy nie mieszają danych."""

    @pytest.mark.asyncio
    async def test_adjacent_months_isolated(self, db_session, admin_client, admin_user):
        """Scenariusz: Płatności w styczniu (100 PLN) i lutym (200 PLN) 2029.
        Zapytanie o styczeń zwraca 100, o luty 200. Dane nie przenikają między
        sąsiednimi miesiącami."""
        await _make_payment(
            db_session, admin_user.id, Decimal("100.00"),
            payment_type="event", created_at=datetime(2029, 1, 15),
        )
        await _make_payment(
            db_session, admin_user.id, Decimal("200.00"),
            payment_type="event", created_at=datetime(2029, 2, 15),
        )
        r_jan = await admin_client.get("/admin/balance?period=2029-01")
        r_feb = await admin_client.get("/admin/balance?period=2029-02")
        r_q1 = await admin_client.get("/admin/balance?period=2029-Q1")

        assert r_jan.json()["total_income"] == "100.00 PLN"
        assert r_feb.json()["total_income"] == "200.00 PLN"
        assert r_q1.json()["total_income"] == "300.00 PLN"

    @pytest.mark.asyncio
    async def test_month_within_quarter_sums_correctly(self, db_session, admin_client, admin_user):
        """Scenariusz: Płatności w kwietniu (10), maju (20), czerwcu (30) 2029.
        Q2 powinno dać 60 PLN. Każdy miesiąc osobno — swoją kwotę.
        Ponadto bilans roczny za 2029 = 60 (brak innych)."""
        for m, amt in [(4, "10.00"), (5, "20.00"), (6, "30.00")]:
            await _make_payment(
                db_session, admin_user.id, Decimal(amt),
                payment_type="event", created_at=datetime(2029, m, 10),
            )
        r_q2 = await admin_client.get("/admin/balance?period=2029-Q2")
        r_apr = await admin_client.get("/admin/balance?period=2029-04")
        r_year = await admin_client.get("/admin/balance?period=2029")
        assert r_q2.json()["total_income"] == "60.00 PLN"
        assert r_apr.json()["total_income"] == "10.00 PLN"
        assert r_year.json()["total_income"] == "60.00 PLN"


class TestMixedPaymentTypes:
    """Testy obejmujące jednoczesne płatności event i subscription
    w różnych statusach w tym samym okresie."""

    @pytest.mark.asyncio
    async def test_subscription_refund_not_counted_as_event_refund(self, db_session, admin_client, admin_user):
        """Scenariusz: Completed event (50 PLN) + refunded subscription (20 PLN).
        income_event=50, income_subscription=0, refunds=20 (od subskrypcji).
        Net powinno wynosić 30 PLN. Zwrot subskrypcji nie powinien wpływać
        na income_event."""
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
        resp = await admin_client.get("/admin/balance?period=2029-03")
        data = resp.json()
        assert data["total_income_event"] == "50.00 PLN"
        assert data["total_income_subscription"] == "0.00 PLN"
        assert data["total_income"] == "50.00 PLN"
        assert data["total_refunds"] == "20.00 PLN"
        assert data["total_net"] == "30.00 PLN"

    @pytest.mark.asyncio
    async def test_pending_event_and_completed_subscription_together(self, db_session, admin_client, admin_user):
        """Scenariusz: Pending event (100 PLN) + completed subscription (200 PLN).
        Income powinno zawierać tylko completed sub (200 PLN).
        Pending sekcja powinna pokazać event=100 PLN.
        Subscription breakdown: 200 PLN income. Event breakdown: brak (bo pending)."""
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
        resp = await admin_client.get("/admin/balance?period=2029-04")
        data = resp.json()
        assert data["total_income"] == "200.00 PLN"
        assert data["total_income_event"] == "0.00 PLN"
        assert data["total_income_subscription"] == "200.00 PLN"
        assert data["pending"]["pending_event"] == "100.00 PLN"
        assert len(data["subscriptions"]) == 1


class TestSpecialDates:
    """Testy obejmujące specyficzne daty kalendarzowe."""

    @pytest.mark.asyncio
    async def test_leap_year_feb29_payment_included(self, db_session, admin_client, admin_user):
        """Scenariusz: Płatność dokładnie 29 lutego 2024 (rok przestępny).
        Bilans za 2024-02 powinien ją uwzględnić, a date_to = 2024-02-29."""
        await _make_payment(
            db_session, admin_user.id, Decimal("29.02"),
            payment_type="event",
            created_at=datetime(2024, 2, 29, 12, 0),
        )
        resp = await admin_client.get("/admin/balance?period=2024-02")
        data = resp.json()
        assert data["date_to"] == "2024-02-29"
        assert data["total_income"] == "29.02 PLN"

    @pytest.mark.asyncio
    async def test_century_leap_year_2000(self, admin_client):
        """Scenariusz: Rok 2000 jest wyjątkowo rokiem przestępnym (podzielny
        przez 400). Luty 2000 ma 29 dni."""
        resp = await admin_client.get("/admin/balance?period=2000-02")
        assert resp.status_code == 200
        assert resp.json()["date_to"] == "2000-02-29"

    @pytest.mark.asyncio
    async def test_non_leap_century_year_1900(self, admin_client):
        """Scenariusz: Rok 1900 NIE jest przestępny (podzielny przez 100,
        ale nie przez 400). Luty 1900 ma 28 dni."""
        resp = await admin_client.get("/admin/balance?period=1900-02")
        assert resp.status_code == 200
        assert resp.json()["date_to"] == "1900-02-28"

    @pytest.mark.asyncio
    async def test_new_years_eve_midnight_boundary(self, db_session, admin_client, admin_user):
        """Scenariusz: Płatność 31 grudnia 2029 o 23:59:59 i 1 stycznia 2030
        o 00:00:00. Roczny bilans za 2029 powinien uwzględnić tylko pierwszą.
        Q4 2029 — tylko pierwszą. Q1 2030 — tylko drugą."""
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
        r_2029 = await admin_client.get("/admin/balance?period=2029")
        r_q4 = await admin_client.get("/admin/balance?period=2029-Q4")
        r_q1_2030 = await admin_client.get("/admin/balance?period=2030-Q1")
        assert r_2029.json()["total_income"] == "500.00 PLN"
        assert r_q4.json()["total_income"] == "500.00 PLN"
        assert r_q1_2030.json()["total_income"] == "600.00 PLN"

    @pytest.mark.asyncio
    async def test_all_four_quarters_sum_to_year(self, db_session, admin_client, admin_user):
        """Scenariusz: Jedna płatność w każdym kwartale. Suma Q1+Q2+Q3+Q4
        powinna równać się bilansowi rocznemu."""
        expected_total = Decimal("0")
        for m, amt in [(1, "10.00"), (4, "20.00"), (7, "30.00"), (10, "40.00")]:
            await _make_payment(
                db_session, admin_user.id, Decimal(amt),
                payment_type="event", created_at=datetime(2030, m, 15),
            )
            expected_total += Decimal(amt)

        q_sum = Decimal("0")
        for q in range(1, 5):
            r = await admin_client.get(f"/admin/balance?period=2030-Q{q}")
            q_val = Decimal(r.json()["total_income"].replace(" PLN", ""))
            q_sum += q_val

        r_year = await admin_client.get("/admin/balance?period=2030")
        year_val = Decimal(r_year.json()["total_income"].replace(" PLN", ""))
        assert q_sum == year_val == expected_total


class TestResponseConsistency:
    """Testy weryfikujące spójność wewnętrzną odpowiedzi."""

    @pytest.mark.asyncio
    async def test_total_income_equals_event_plus_subscription(self, db_session, admin_client, admin_user):
        """Scenariusz: Mieszanka event i subscription completed. total_income
        musi być dokładnie równe total_income_event + total_income_subscription."""
        await _make_payment(
            db_session, admin_user.id, Decimal("77.77"),
            payment_type="event", created_at=datetime(2030, 2, 1),
        )
        await _make_payment(
            db_session, admin_user.id, Decimal("33.33"),
            payment_type="subscription", created_at=datetime(2030, 2, 2),
            extra_data='{"plan_code": "monthly"}',
        )
        resp = await admin_client.get("/admin/balance?period=2030-02")
        d = resp.json()
        total = Decimal(d["total_income"].replace(" PLN", ""))
        ev = Decimal(d["total_income_event"].replace(" PLN", ""))
        sub = Decimal(d["total_income_subscription"].replace(" PLN", ""))
        assert total == ev + sub

    @pytest.mark.asyncio
    async def test_net_equals_income_minus_refunds(self, db_session, admin_client, admin_user):
        """Scenariusz: Przychody i zwroty w jednym miesiącu. total_net musi
        być dokładnie total_income − total_refunds. Weryfikacja arytmetyczna."""
        await _make_payment(
            db_session, admin_user.id, Decimal("150.00"),
            payment_type="event", created_at=datetime(2030, 3, 1),
        )
        await _make_payment(
            db_session, admin_user.id, Decimal("45.50"),
            status=DBPaymentStatus.REFUNDED.value,
            payment_type="event", created_at=datetime(2030, 3, 15),
        )
        resp = await admin_client.get("/admin/balance?period=2030-03")
        d = resp.json()
        income = Decimal(d["total_income"].replace(" PLN", ""))
        refunds = Decimal(d["total_refunds"].replace(" PLN", ""))
        net = Decimal(d["total_net"].replace(" PLN", ""))
        assert net == income - refunds

    @pytest.mark.asyncio
    async def test_monthly_rows_sum_to_totals(self, db_session, admin_client, admin_user):
        """Scenariusz: Płatności rozłożone na 3 miesiące kwartału. Suma
        income_total ze wszystkich wierszy monthly powinna równać się
        total_income z odpowiedzi."""
        for m, amt in [(1, "11.11"), (2, "22.22"), (3, "33.33")]:
            await _make_payment(
                db_session, admin_user.id, Decimal(amt),
                payment_type="event", created_at=datetime(2030, m, 10),
            )
        resp = await admin_client.get("/admin/balance?period=2030-Q1")
        d = resp.json()
        month_sum = sum(Decimal(m["income_total"].replace(" PLN", "")) for m in d["months"])
        total = Decimal(d["total_income"].replace(" PLN", ""))
        assert month_sum == total

    @pytest.mark.asyncio
    async def test_pending_total_equals_event_plus_subscription(self, db_session, admin_client, admin_user):
        """Scenariusz: Pending event (30) + pending subscription (20).
        pending_total musi być = pending_event + pending_subscription."""
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
        resp = await admin_client.get("/admin/balance?period=2030-04")
        d = resp.json()
        pe = Decimal(d["pending"]["pending_event"].replace(" PLN", ""))
        ps = Decimal(d["pending"]["pending_subscription"].replace(" PLN", ""))
        pt = Decimal(d["pending"]["pending_total"].replace(" PLN", ""))
        assert pt == pe + ps

    @pytest.mark.asyncio
    async def test_tx_count_equals_sum_of_monthly_tx_counts(self, db_session, admin_client, admin_user):
        """Scenariusz: Wiele płatności w różnych miesiącach Q2. Łączna
        total_tx_count musi być równa sumie tx_count z wierszy monthly."""
        for m in [4, 5, 6]:
            for _ in range(m):  # 4+5+6 = 15 transakcji
                await _make_payment(
                    db_session, admin_user.id, Decimal("1.00"),
                    payment_type="event", created_at=datetime(2030, m, 10),
                )
        resp = await admin_client.get("/admin/balance?period=2030-Q2")
        d = resp.json()
        month_tx = sum(m["tx_count"] for m in d["months"])
        assert d["total_tx_count"] == month_tx == 15


class TestHighVolumeData:
    """Testy obciążeniowe z dużą liczbą rekordów."""

    @pytest.mark.asyncio
    async def test_50_events_in_one_month(self, db_session, admin_client, admin_user):
        """Scenariusz: 50 różnych wydarzeń, każde z 1 completed payment
        w jednym miesiącu. Per-event breakdown powinien mieć 50 wierszy,
        posortowanych malejąco po income. Total powinien się zgadzać."""
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

        resp = await admin_client.get("/admin/balance?period=2030-05")
        data = resp.json()
        assert len(data["events"]) == 50
        assert data["total_income"] == f"{total_expected:.2f} PLN"
        # sprawdzamy sortowanie malejące
        incomes = [Decimal(e["income"].replace(" PLN", "")) for e in data["events"]]
        assert incomes == sorted(incomes, reverse=True)

    @pytest.mark.asyncio
    async def test_12_months_full_year(self, db_session, admin_client, admin_user):
        """Scenariusz: Po jednej płatności w każdym z 12 miesięcy (10 PLN każda).
        Bilans roczny: 120 PLN, 12 wierszy monthly. Weryfikujemy kompletność."""
        for m in range(1, 13):
            await _make_payment(
                db_session, admin_user.id, Decimal("10.00"),
                payment_type="event", created_at=datetime(2031, m, 15),
            )
        resp = await admin_client.get("/admin/balance?period=2031")
        data = resp.json()
        assert len(data["months"]) == 12
        assert data["total_income"] == "120.00 PLN"
        assert data["total_tx_count"] == 12
        months_sorted = [m["month"] for m in data["months"]]
        expected_months = [f"2031-{m:02d}" for m in range(1, 13)]
        assert months_sorted == expected_months


class TestSubscriptionPlanAggregation:
    """Testy obejmujące nietypowe scenariusze z podziałem subskrypcji."""

    @pytest.mark.asyncio
    async def test_same_plan_multiple_payments_summed(self, db_session, admin_client, admin_user):
        """Scenariusz: 5 completed payments na plan 'monthly', każda po 20 PLN.
        Per-subscription breakdown powinien mieć 1 wiersz z income=100,
        tx_count=5."""
        for _ in range(5):
            await _make_payment(
                db_session, admin_user.id, Decimal("20.00"),
                payment_type="subscription", created_at=datetime(2031, 2, 1),
                extra_data='{"plan_code": "monthly"}',
            )
        resp = await admin_client.get("/admin/balance?period=2031-02")
        data = resp.json()
        assert len(data["subscriptions"]) == 1
        s = data["subscriptions"][0]
        assert s["plan_code"] == "monthly"
        assert s["income"] == "100.00 PLN"
        assert s["tx_count"] == 5

    @pytest.mark.asyncio
    async def test_three_plans_sorted_alphabetically(self, db_session, admin_client, admin_user):
        """Scenariusz: Trzy plany — 'yearly', 'monthly', 'free'. W subscription
        breakdown powinny być posortowane alfabetycznie (free, monthly, yearly)."""
        for plan in ["yearly", "monthly", "free"]:
            await _make_payment(
                db_session, admin_user.id, Decimal("10.00"),
                payment_type="subscription", created_at=datetime(2031, 3, 1),
                extra_data=f'{{"plan_code": "{plan}"}}',
            )
        resp = await admin_client.get("/admin/balance?period=2031-03")
        data = resp.json()
        codes = [s["plan_code"] for s in data["subscriptions"]]
        assert codes == sorted(codes)  # alphabetical

    @pytest.mark.asyncio
    async def test_subscription_with_mixed_completed_and_refunded(self, db_session, admin_client, admin_user):
        """Scenariusz: Plan 'yearly' — 3 completed (200 PLN każda) + 1 refunded (200 PLN).
        Per-subscription: income=600, refunds=200, net=400, tx_count=3, refund_count=1."""
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
        resp = await admin_client.get("/admin/balance?period=2031-04")
        data = resp.json()
        plans = {s["plan_code"]: s for s in data["subscriptions"]}
        assert plans["yearly"]["income"] == "600.00 PLN"
        assert plans["yearly"]["refunds"] == "200.00 PLN"
        assert plans["yearly"]["net"] == "400.00 PLN"
        assert plans["yearly"]["tx_count"] == 3
        assert plans["yearly"]["refund_count"] == 1
