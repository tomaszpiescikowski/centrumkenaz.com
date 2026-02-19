from datetime import datetime, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from database import get_db
from models.event import Event
from models.registration import Registration, RegistrationStatus
from models.user import AccountStatus, User, UserRole
from routers import events_router
from services.auth_service import AuthService


@pytest.fixture
async def events_api_client(db_session):
    app = FastAPI()
    app.include_router(events_router)

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    client = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    try:
        yield client
    finally:
        await client.aclose()


@pytest.mark.asyncio
async def test_pending_user_cannot_register_for_event(events_api_client: AsyncClient, db_session):
    suffix = uuid4().hex
    pending_user = User(
        google_id=f"pending-{suffix}",
        email=f"pending-{suffix}@example.com",
        full_name="Pending User",
        role=UserRole.GUEST,
        account_status=AccountStatus.PENDING,
    )
    event = Event(
        title="Pending Lock Event",
        event_type="mors",
        start_date=datetime.now() + timedelta(days=2),
        city="Poznań",
        price_guest=Decimal("10.00"),
        price_member=Decimal("0.00"),
        max_participants=10,
        version=1,
    )
    db_session.add_all([pending_user, event])
    await db_session.commit()
    await db_session.refresh(pending_user)
    await db_session.refresh(event)

    token = AuthService(db_session).create_access_token(pending_user)
    response = await events_api_client.post(
        f"/events/{event.id}/register",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "return_url": "http://localhost/success",
            "cancel_url": "http://localhost/cancel",
        },
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Account pending admin approval"


@pytest.mark.asyncio
async def test_anonymous_user_cannot_open_event_details(events_api_client: AsyncClient, db_session):
    event = Event(
        title="Protected Details Event",
        event_type="mors",
        start_date=datetime.now() + timedelta(days=2),
        city="Poznań",
        price_guest=Decimal("10.00"),
        price_member=Decimal("0.00"),
        max_participants=10,
        version=1,
    )
    db_session.add(event)
    await db_session.commit()
    await db_session.refresh(event)

    response = await events_api_client.get(f"/events/{event.id}")

    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated"


@pytest.mark.asyncio
async def test_pending_user_cannot_open_event_details(events_api_client: AsyncClient, db_session):
    suffix = uuid4().hex
    pending_user = User(
        google_id=f"pending-view-{suffix}",
        email=f"pending-view-{suffix}@example.com",
        full_name="Pending View User",
        role=UserRole.GUEST,
        account_status=AccountStatus.PENDING,
    )
    event = Event(
        title="Protected Pending Event",
        event_type="mors",
        start_date=datetime.now() + timedelta(days=2),
        city="Poznań",
        price_guest=Decimal("10.00"),
        price_member=Decimal("0.00"),
        max_participants=10,
        version=1,
    )
    db_session.add_all([pending_user, event])
    await db_session.commit()
    await db_session.refresh(pending_user)
    await db_session.refresh(event)

    token = AuthService(db_session).create_access_token(pending_user)
    response = await events_api_client.get(
        f"/events/{event.id}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Account pending admin approval"


@pytest.mark.asyncio
async def test_active_user_can_register_for_event(events_api_client: AsyncClient, db_session):
    suffix = uuid4().hex
    active_user = User(
        google_id=f"active-{suffix}",
        email=f"active-{suffix}@example.com",
        full_name="Active User",
        role=UserRole.GUEST,
        account_status=AccountStatus.ACTIVE,
    )
    event = Event(
        title="Active Register Event",
        event_type="mors",
        start_date=datetime.now() + timedelta(days=2),
        city="Poznań",
        price_guest=Decimal("10.00"),
        price_member=Decimal("0.00"),
        max_participants=10,
        version=1,
    )
    db_session.add_all([active_user, event])
    await db_session.commit()
    await db_session.refresh(active_user)
    await db_session.refresh(event)

    token = AuthService(db_session).create_access_token(active_user)
    response = await events_api_client.post(
        f"/events/{event.id}/register",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "return_url": "http://localhost/success",
            "cancel_url": "http://localhost/cancel",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] in {"pending_payment", "confirmed"}
    assert body["registration_id"] is not None


@pytest.mark.asyncio
async def test_manual_payment_event_registration_returns_manual_flow(events_api_client: AsyncClient, db_session):
    suffix = uuid4().hex
    active_user = User(
        google_id=f"active-manual-{suffix}",
        email=f"active-manual-{suffix}@example.com",
        full_name="Active Manual User",
        role=UserRole.GUEST,
        account_status=AccountStatus.ACTIVE,
    )
    event = Event(
        title="Manual Registration Event",
        event_type="mors",
        start_date=datetime.now() + timedelta(days=2),
        city="Poznań",
        price_guest=Decimal("25.00"),
        price_member=Decimal("15.00"),
        manual_payment_verification=True,
        manual_payment_url="https://payments.example/manual",
        manual_payment_due_hours=48,
        max_participants=10,
        version=1,
    )
    db_session.add_all([active_user, event])
    await db_session.commit()
    await db_session.refresh(active_user)
    await db_session.refresh(event)

    token = AuthService(db_session).create_access_token(active_user)
    response = await events_api_client.post(
        f"/events/{event.id}/register",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "return_url": "http://localhost/success",
            "cancel_url": "http://localhost/cancel",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == RegistrationStatus.MANUAL_PAYMENT_REQUIRED.value
    assert body["manual_payment_required"] is True
    assert body["manual_payment_url"] == "https://payments.example/manual"
    assert body["transfer_reference"] == event.id
    assert body["redirect_url"] is None


@pytest.mark.asyncio
async def test_full_event_registration_goes_to_waitlist(events_api_client: AsyncClient, db_session):
    suffix = uuid4().hex
    owner = User(
        google_id=f"owner-{suffix}",
        email=f"owner-{suffix}@example.com",
        full_name="Owner User",
        role=UserRole.GUEST,
        account_status=AccountStatus.ACTIVE,
    )
    newcomer = User(
        google_id=f"newcomer-{suffix}",
        email=f"newcomer-{suffix}@example.com",
        full_name="Newcomer User",
        role=UserRole.GUEST,
        account_status=AccountStatus.ACTIVE,
    )
    event = Event(
        title="Full Waitlist Event",
        event_type="mors",
        start_date=datetime.now() + timedelta(days=2),
        city="Poznań",
        price_guest=Decimal("0.00"),
        price_member=Decimal("0.00"),
        max_participants=1,
        version=1,
    )
    db_session.add_all([owner, newcomer, event])
    await db_session.commit()
    await db_session.refresh(owner)
    await db_session.refresh(newcomer)
    await db_session.refresh(event)

    db_session.add(
        Registration(
            user_id=owner.id,
            event_id=event.id,
            occurrence_date=event.start_date.date(),
            status=RegistrationStatus.CONFIRMED.value,
        )
    )
    await db_session.commit()

    token = AuthService(db_session).create_access_token(newcomer)
    response = await events_api_client.post(
        f"/events/{event.id}/register",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "return_url": "http://localhost/success",
            "cancel_url": "http://localhost/cancel",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == RegistrationStatus.WAITLIST.value
    assert payload["is_waitlisted"] is True

    registered = await events_api_client.get(
        "/events/registered",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert registered.status_code == 200
    assert event.id in set(registered.json())


@pytest.mark.asyncio
async def test_register_rejects_event_that_already_started(events_api_client: AsyncClient, db_session):
    suffix = uuid4().hex
    active_user = User(
        google_id=f"active-past-{suffix}",
        email=f"active-past-{suffix}@example.com",
        full_name="Active Past User",
        role=UserRole.GUEST,
        account_status=AccountStatus.ACTIVE,
    )
    event = Event(
        title="Already Started Event",
        event_type="mors",
        start_date=datetime.now() - timedelta(hours=1),
        city="Poznań",
        price_guest=Decimal("10.00"),
        price_member=Decimal("0.00"),
        max_participants=10,
        version=1,
    )
    db_session.add_all([active_user, event])
    await db_session.commit()
    await db_session.refresh(active_user)
    await db_session.refresh(event)

    token = AuthService(db_session).create_access_token(active_user)
    response = await events_api_client.post(
        f"/events/{event.id}/register",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "return_url": "http://localhost/success",
            "cancel_url": "http://localhost/cancel",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Cannot register for past events"


@pytest.mark.asyncio
async def test_active_user_can_open_event_details(events_api_client: AsyncClient, db_session):
    suffix = uuid4().hex
    active_user = User(
        google_id=f"active-view-{suffix}",
        email=f"active-view-{suffix}@example.com",
        full_name="Active View User",
        role=UserRole.GUEST,
        account_status=AccountStatus.ACTIVE,
    )
    event = Event(
        title="Active Details Event",
        event_type="mors",
        start_date=datetime.now() + timedelta(days=2),
        city="Poznań",
        price_guest=Decimal("10.00"),
        price_member=Decimal("0.00"),
        max_participants=10,
        version=1,
    )
    db_session.add_all([active_user, event])
    await db_session.commit()
    await db_session.refresh(active_user)
    await db_session.refresh(event)

    token = AuthService(db_session).create_access_token(active_user)
    response = await events_api_client.get(
        f"/events/{event.id}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json()["id"] == event.id


@pytest.mark.asyncio
async def test_active_user_can_get_event_waitlist(events_api_client: AsyncClient, db_session):
    suffix = uuid4().hex
    active_user = User(
        google_id=f"active-waitlist-view-{suffix}",
        email=f"active-waitlist-view-{suffix}@example.com",
        full_name="Active Waitlist Viewer",
        role=UserRole.GUEST,
        account_status=AccountStatus.ACTIVE,
    )
    confirmed_user = User(
        google_id=f"confirmed-{suffix}",
        email=f"confirmed-{suffix}@example.com",
        full_name="Confirmed User",
        role=UserRole.GUEST,
        account_status=AccountStatus.ACTIVE,
    )
    waitlisted_user = User(
        google_id=f"waitlisted-{suffix}",
        email=f"waitlisted-{suffix}@example.com",
        full_name="Waitlisted User",
        role=UserRole.GUEST,
        account_status=AccountStatus.ACTIVE,
    )
    event = Event(
        title="Waitlist Visible Event",
        event_type="mors",
        start_date=datetime.now() + timedelta(days=2),
        city="Poznań",
        price_guest=Decimal("0.00"),
        price_member=Decimal("0.00"),
        max_participants=1,
        version=1,
    )
    db_session.add_all([active_user, confirmed_user, waitlisted_user, event])
    await db_session.commit()
    await db_session.refresh(active_user)
    await db_session.refresh(confirmed_user)
    await db_session.refresh(waitlisted_user)
    await db_session.refresh(event)

    db_session.add_all([
        Registration(
            user_id=confirmed_user.id,
            event_id=event.id,
            occurrence_date=event.start_date.date(),
            status=RegistrationStatus.CONFIRMED.value,
        ),
        Registration(
            user_id=waitlisted_user.id,
            event_id=event.id,
            occurrence_date=event.start_date.date(),
            status=RegistrationStatus.WAITLIST.value,
        ),
    ])
    await db_session.commit()

    token = AuthService(db_session).create_access_token(active_user)
    response = await events_api_client.get(
        f"/events/{event.id}/waitlist",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 1
    assert payload[0]["user_id"] == waitlisted_user.id
    assert payload[0]["full_name"] == waitlisted_user.full_name


@pytest.mark.asyncio
async def test_anonymous_user_cannot_get_event_waitlist(events_api_client: AsyncClient, db_session):
    event = Event(
        title="Waitlist Protected Event",
        event_type="mors",
        start_date=datetime.now() + timedelta(days=2),
        city="Poznań",
        price_guest=Decimal("0.00"),
        price_member=Decimal("0.00"),
        max_participants=1,
        version=1,
    )
    db_session.add(event)
    await db_session.commit()
    await db_session.refresh(event)

    response = await events_api_client.get(f"/events/{event.id}/waitlist")

    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated"


@pytest.mark.asyncio
async def test_register_rejects_invalid_return_url(events_api_client: AsyncClient, db_session):
    suffix = uuid4().hex
    active_user = User(
        google_id=f"active-url-{suffix}",
        email=f"active-url-{suffix}@example.com",
        full_name="Active URL User",
        role=UserRole.GUEST,
        account_status=AccountStatus.ACTIVE,
    )
    event = Event(
        title="URL Validation Event",
        event_type="mors",
        start_date=datetime.now() + timedelta(days=2),
        city="Poznań",
        price_guest=Decimal("10.00"),
        price_member=Decimal("0.00"),
        max_participants=10,
        version=1,
    )
    db_session.add_all([active_user, event])
    await db_session.commit()
    await db_session.refresh(active_user)
    await db_session.refresh(event)

    token = AuthService(db_session).create_access_token(active_user)
    response = await events_api_client.post(
        f"/events/{event.id}/register",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "return_url": "javascript:alert(1)",
            "cancel_url": "http://localhost/cancel",
        },
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_registered_events_returns_event_ids(events_api_client: AsyncClient, db_session):
    suffix = uuid4().hex
    active_user = User(
        google_id=f"active-rec-{suffix}",
        email=f"active-rec-{suffix}@example.com",
        full_name="Active User",
        role=UserRole.GUEST,
        account_status=AccountStatus.ACTIVE,
    )
    start_date = datetime.now() + timedelta(days=7)
    event = Event(
        title="Access Event",
        event_type="mors",
        start_date=start_date,
        end_date=start_date + timedelta(hours=1),
        city="Poznań",
        price_guest=Decimal("0.00"),
        price_member=Decimal("0.00"),
        max_participants=10,
        version=1,
    )
    db_session.add_all([active_user, event])
    await db_session.commit()
    await db_session.refresh(active_user)
    await db_session.refresh(event)

    token = AuthService(db_session).create_access_token(active_user)
    response = await events_api_client.post(
        f"/events/{event.id}/register",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "return_url": "http://localhost/success",
            "cancel_url": "http://localhost/cancel",
        },
    )
    assert response.status_code == 200

    registered = await events_api_client.get(
        "/events/registered",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert registered.status_code == 200
    payload = set(registered.json())
    assert event.id in payload
