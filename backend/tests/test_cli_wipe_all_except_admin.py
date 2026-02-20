from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from cli import _wipe_all_except_admin
from models.city import City
from models.event import Event
from models.payment import Payment
from models.registration import Registration, RegistrationStatus
from models.registration_refund_task import RegistrationRefundTask
from models.user import AccountStatus, User, UserRole


@pytest.mark.asyncio
async def test_wipe_all_except_admin_keeps_only_selected_admin(monkeypatch, db_engine):
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
        admin = User(
            email="admin@example.com",
            username="admin",
            full_name="Admin",
            role=UserRole.ADMIN,
            account_status=AccountStatus.ACTIVE,
            password_hash="hash",
        )
        other_admin = User(
            email="other-admin@example.com",
            username="other_admin",
            full_name="Other Admin",
            role=UserRole.ADMIN,
            account_status=AccountStatus.ACTIVE,
            password_hash="hash",
        )
        user = User(
            email="user@example.com",
            username="user",
            full_name="User",
            role=UserRole.GUEST,
            account_status=AccountStatus.ACTIVE,
            password_hash="hash",
        )
        session.add_all([admin, other_admin, user])
        await session.commit()
        await session.refresh(admin)
        await session.refresh(user)

        city = City(name="Poznań", slug="poznan")
        session.add(city)
        await session.commit()
        await session.refresh(city)

        start = datetime.now(timezone.utc) + timedelta(days=3)
        event = Event(
            title="Event",
            event_type="mors",
            start_date=start,
            city="Poznań",
            city_id=city.id,
            price_guest=Decimal("0.00"),
            price_member=Decimal("0.00"),
            max_participants=4,
            version=1,
        )
        session.add(event)
        await session.commit()
        await session.refresh(event)

        registration = Registration(
            user_id=user.id,
            event_id=event.id,
            occurrence_date=start.date(),
            status=RegistrationStatus.CANCELLED.value,
        )
        session.add(registration)
        await session.commit()
        await session.refresh(registration)

        task = RegistrationRefundTask(
            registration_id=registration.id,
            user_id=user.id,
            event_id=event.id,
            occurrence_date=start.date(),
            refund_eligible=True,
            recommended_should_refund=True,
            should_refund=True,
            refund_marked_paid=False,
            reviewed_by_admin_id=admin.id,
        )
        session.add(task)

        payment = Payment(
            user_id=user.id,
            external_id="ext_1",
            amount=Decimal("10.00"),
            currency="PLN",
            payment_type="event",
            status="completed",
            description="desc",
        )
        session.add(payment)

        await session.commit()

    await _wipe_all_except_admin(admin_email="admin@example.com", admin_id=None, yes=True, force=True)

    async with async_session() as session:
        user_count = await session.scalar(select(func.count(User.id)))
        event_count = await session.scalar(select(func.count(Event.id)))
        city_count = await session.scalar(select(func.count(City.id)))
        reg_count = await session.scalar(select(func.count(Registration.id)))
        task_count = await session.scalar(select(func.count(RegistrationRefundTask.id)))
        pay_count = await session.scalar(select(func.count(Payment.id)))

        remaining_admin = (
            await session.execute(select(User).where(User.email == "admin@example.com"))
        ).scalar_one_or_none()

    assert user_count == 1
    assert remaining_admin is not None
    assert remaining_admin.role == UserRole.ADMIN

    assert event_count == 0
    assert city_count == 0
    assert reg_count == 0
    assert task_count == 0
    assert pay_count == 0
