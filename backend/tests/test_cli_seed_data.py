from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from cli import (
    _expanded_user_seed_specs,
    _seed_events,
    _seed_events_payload,
    _seed_registrations,
    _seed_users,
    _wipe_test_data,
)
from models.event import Event
from models.registration import Registration, RegistrationStatus
from models.registration_refund_task import RegistrationRefundTask
from models.user import AccountStatus, User, UserRole


def test_seed_events_payload_contains_all_types_and_future_dates():
    now = datetime(2026, 2, 9, 12, 0, tzinfo=timezone.utc)
    payload = _seed_events_payload(base_now=now)

    assert {row["event_type"] for row in payload} == {
        "karate",
        "mors",
        "planszowki",
        "ognisko",
        "spacer",
        "joga",
        "wyjazd",
        "inne",
    }
    assert all(row["start_date"] > now for row in payload)
    assert all(row["max_participants"] in {4, 5} for row in payload)
    assert all("DANE TESTOWE" in str(row["description"]) for row in payload)
    assert all("[TEST]" not in str(row["title"]) for row in payload)


def test_seed_events_payload_includes_extra_march_events_with_trip():
    now = datetime(2026, 2, 9, 12, 0, tzinfo=timezone.utc)
    payload = _seed_events_payload(base_now=now)

    march_events = [row for row in payload if row["start_date"].month == 3]
    assert len(march_events) >= 3
    assert any(row["event_type"] == "wyjazd" for row in march_events)
    assert any("CASE_EXTRA_MARCH_TRIP" in str(row["description"]) for row in march_events)


def test_seed_events_payload_exposes_manual_payment_cases():
    now = datetime(2026, 2, 9, 12, 0, tzinfo=timezone.utc)
    payload = _seed_events_payload(base_now=now)
    by_type = {row["event_type"]: row for row in payload}

    manual = by_type["inne"]
    assert manual["manual_payment_verification"] is True
    assert manual["manual_payment_url"]
    assert manual["manual_payment_due_hours"] == 36


def test_seed_events_payload_enforces_manual_payment_verification_for_all_events():
    now = datetime(2026, 2, 9, 12, 0, tzinfo=timezone.utc)
    payload = _seed_events_payload(base_now=now)

    assert all(row["manual_payment_verification"] is True for row in payload)
    assert all(int(row["manual_payment_due_hours"]) >= 1 for row in payload)
    for row in payload:
        requires_subscription = bool(row.get("requires_subscription"))
        guest_price = Decimal("0") if requires_subscription else Decimal(str(row.get("price_guest") or 0))
        member_price = Decimal(str(row.get("price_member") or 0))
        if guest_price > 0 or member_price > 0:
            assert row.get("manual_payment_url")


def test_seed_users_include_admin_password_and_plan_mix():
    now = datetime(2026, 2, 9, 12, 0, tzinfo=timezone.utc)
    specs = _expanded_user_seed_specs(count=40, base_now=now)

    assert 10 <= len(specs) <= 12

    admin = next(spec for spec in specs if spec["email"] == "test@admin.com")
    assert admin["role"] == UserRole.ADMIN
    assert admin["plain_password"] == "admin123"
    assert admin["about_me"]
    assert admin["interest_tags"]

    plan_codes = {spec["subscription_plan_code"] for spec in specs}
    assert "monthly" in plan_codes
    assert "yearly" in plan_codes
    assert None in plan_codes
    assert all(spec.get("about_me") for spec in specs)
    assert all(spec.get("interest_tags") for spec in specs)


@pytest.mark.asyncio
async def test_wipe_test_data_handles_refund_task_reviewed_by_admin(monkeypatch, db_engine):
    async_session = async_sessionmaker(
        db_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async def _noop_ensure_schema():
        return None

    monkeypatch.setattr("cli.ensure_db_schema", _noop_ensure_schema)
    monkeypatch.setattr("cli.AsyncSessionLocal", async_session)

    async with async_session() as session:
        start = datetime.now(timezone.utc) + timedelta(days=3)
        admin = User(
            email="seed-admin@example.com",
            username="seed.admin",
            full_name="Seed Admin",
            role=UserRole.ADMIN,
            account_status=AccountStatus.ACTIVE,
            password_hash="hash",
            is_test_data=True,
        )
        attendee = User(
            email="seed-user@example.com",
            username="seed.user",
            full_name="Seed User",
            role=UserRole.GUEST,
            account_status=AccountStatus.ACTIVE,
            password_hash="hash",
            is_test_data=True,
        )
        event = Event(
            title="Seed Event",
            event_type="mors",
            start_date=start,
            city="Poznań",
            price_guest=Decimal("0.00"),
            price_member=Decimal("0.00"),
            max_participants=4,
            version=1,
            is_test_data=True,
        )
        session.add_all([admin, attendee, event])
        await session.commit()
        await session.refresh(admin)
        await session.refresh(attendee)
        await session.refresh(event)

        registration = Registration(
            user_id=attendee.id,
            event_id=event.id,
            occurrence_date=start.date(),
            status=RegistrationStatus.CANCELLED.value,
            is_test_data=True,
        )
        session.add(registration)
        await session.commit()
        await session.refresh(registration)

        task = RegistrationRefundTask(
            registration_id=registration.id,
            user_id=attendee.id,
            event_id=event.id,
            occurrence_date=start.date(),
            refund_eligible=True,
            recommended_should_refund=True,
            should_refund=True,
            refund_marked_paid=False,
            reviewed_by_admin_id=admin.id,
        )
        session.add(task)
        await session.commit()

    await _wipe_test_data()

    async with async_session() as session:
        remaining_tasks = await session.scalar(select(func.count(RegistrationRefundTask.id)))
        remaining_users = await session.scalar(select(func.count(User.id)))
        remaining_events = await session.scalar(select(func.count(Event.id)))
        remaining_regs = await session.scalar(select(func.count(Registration.id)))

    assert remaining_tasks == 0
    assert remaining_users == 0
    assert remaining_events == 0
    assert remaining_regs == 0


@pytest.mark.asyncio
async def test_seed_demo_manual_payment_tables_counts_are_consistent(monkeypatch, db_engine):
    async_session = async_sessionmaker(
        db_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async def _noop_ensure_schema():
        return None

    monkeypatch.setattr("cli.ensure_db_schema", _noop_ensure_schema)
    monkeypatch.setattr("cli.AsyncSessionLocal", async_session)

    await _seed_events(reset=True)
    await _seed_users(count=40, reset=False)
    await _seed_registrations(per_event=0, reset=False)

    async with async_session() as session:
        pending_manual = await session.scalar(
            select(func.count(Registration.id)).where(
                Registration.status == RegistrationStatus.MANUAL_PAYMENT_VERIFICATION.value
            )
        )
        refund_tasks = await session.scalar(select(func.count(RegistrationRefundTask.id)))
        promoted_waitlist = await session.scalar(
            select(func.count(Registration.id))
            .join(Event, Registration.event_id == Event.id)
            .where(
                Registration.promoted_from_waitlist_at.is_not(None),
                Event.manual_payment_verification.is_(True),
            )
        )

    assert pending_manual == 1
    assert refund_tasks == 2
    assert promoted_waitlist == 1
