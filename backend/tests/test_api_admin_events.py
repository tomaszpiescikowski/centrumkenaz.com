from datetime import datetime, timedelta
from decimal import Decimal

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from database import get_db
from models.city import City
from models.event import Event
from models.registration import Registration, RegistrationStatus
from models.user import AccountStatus, User, UserRole
from routers import admin_router, cities_router, events_router
from routers.auth import get_current_user_dependency
from routers.events import DEFAULT_MANUAL_PAYMENT_URL


@pytest.fixture
async def admin_user(db_session) -> User:
    user = User(
        google_id="admin_google_id",
        email="admin@example.com",
        full_name="Admin",
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
        google_id="guest_google_id",
        email="guest@example.com",
        full_name="Guest",
        role=UserRole.GUEST,
        account_status=AccountStatus.ACTIVE,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def pending_user(db_session) -> User:
    user = User(
        google_id="pending_google_id",
        email="pending@example.com",
        full_name="Pending",
        role=UserRole.GUEST,
        account_status=AccountStatus.PENDING,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


async def _build_client(db_session, current_user: User | None = None) -> AsyncClient:
    app = FastAPI()
    app.include_router(admin_router)
    app.include_router(events_router)
    app.include_router(cities_router)

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    if current_user is not None:
        async def override_current_user_dependency():
            return current_user

        app.dependency_overrides[get_current_user_dependency] = override_current_user_dependency

    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


@pytest.fixture
async def admin_client(db_session, admin_user: User):
    client = await _build_client(db_session, current_user=admin_user)
    try:
        yield client
    finally:
        await client.aclose()


@pytest.fixture
async def guest_client(db_session, guest_user: User):
    client = await _build_client(db_session, current_user=guest_user)
    try:
        yield client
    finally:
        await client.aclose()


@pytest.fixture
async def pending_client(db_session, pending_user: User):
    client = await _build_client(db_session, current_user=pending_user)
    try:
        yield client
    finally:
        await client.aclose()


@pytest.fixture
async def anonymous_client(db_session):
    client = await _build_client(db_session, current_user=None)
    try:
        yield client
    finally:
        await client.aclose()


async def _create_event(
    db_session,
    *,
    title: str,
    start_date: datetime,
    city: str = "Poznań",
) -> Event:
    event = Event(
        title=title,
        description=f"{title} description",
        event_type="mors",
        start_date=start_date,
        time_info="10:00",
        city=city,
        price_guest=Decimal("10.00"),
        price_member=Decimal("5.00"),
        max_participants=10,
        version=1,
    )
    db_session.add(event)
    await db_session.commit()
    await db_session.refresh(event)
    return event


def _event_create_payload(**overrides):
    payload = {
        "title": "Validation event",
        "description": "Validation description",
        "event_type": "mors",
        "start_date": "2027-06-14T10:00:00Z",
        "end_date": None,
        "time_info": "10:00",
        "city": "Poznań",
        "location": "Jezioro Maltańskie",
        "show_map": True,
        "price_guest": "20.00",
        "price_member": "10.00",
        "max_participants": 20,
        "requires_subscription": False,
        "cancel_cutoff_hours": 24,
        "points_value": 1,
    }
    payload.update(overrides)
    return payload


class TestAdminEventStats:
    @pytest.mark.asyncio
    async def test_get_event_stats_invalid_month_format_returns_400(
        self,
        admin_client: AsyncClient,
    ):
        response = await admin_client.get("/admin/stats/events?month=2026/02")

        assert response.status_code == 400
        assert response.json()["detail"] == "Invalid month format"

    @pytest.mark.asyncio
    async def test_manual_payment_admin_queue_requires_admin_role(
        self,
        guest_client: AsyncClient,
    ):
        response = await guest_client.get("/admin/manual-payments/pending")

        assert response.status_code == 403
        assert response.json()["detail"] == "Admin access required"

    @pytest.mark.asyncio
    async def test_get_event_stats_month_includes_events_in_month(
        self,
        db_session,
        admin_client: AsyncClient,
    ):
        feb_event = await _create_event(
            db_session,
            title="One-off in February",
            start_date=datetime(2026, 2, 10),
        )
        feb_event_two = await _create_event(
            db_session,
            title="Another February",
            start_date=datetime(2026, 2, 12),
        )

        response = await admin_client.get("/admin/stats/events?month=2026-02")

        assert response.status_code == 200
        payload = response.json()
        returned_ids = {item["event_id"] for item in payload}
        assert feb_event.id in returned_ids
        assert feb_event_two.id in returned_ids


class TestEventsList:
    @pytest.mark.asyncio
    async def test_list_events_invalid_month_format_returns_400(
        self,
        admin_client: AsyncClient,
    ):
        response = await admin_client.get("/events/?month=2026-99")

        assert response.status_code == 400
        assert response.json()["detail"] == "Invalid month format, expected YYYY-MM"

    @pytest.mark.asyncio
    async def test_list_events_rejects_month_with_start_range(
        self,
        admin_client: AsyncClient,
    ):
        response = await admin_client.get(
            "/events/?month=2026-02&start_from=2026-02-01T00:00:00"
        )

        assert response.status_code == 400
        assert response.json()["detail"] == "Use either month or start_from/start_to"

    @pytest.mark.asyncio
    async def test_list_events_rejects_unknown_event_type_with_422(
        self,
        admin_client: AsyncClient,
    ):
        response = await admin_client.get("/events/?event_type=unknown_type")
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_list_events_month_filter_includes_matching_city(
        self,
        db_session,
        admin_client: AsyncClient,
    ):
        feb_city_match = await _create_event(
            db_session,
            title="February Poznań",
            start_date=datetime(2026, 2, 5),
            city="Poznań",
        )
        await _create_event(
            db_session,
            title="February Warsaw",
            start_date=datetime(2026, 2, 7),
            city="Warszawa",
        )
        await _create_event(
            db_session,
            title="March Poznań",
            start_date=datetime(2026, 3, 1),
            city="Poznań",
        )

        response = await admin_client.get("/events/?month=2026-02&city=Poznań&limit=100")

        assert response.status_code == 200
        payload = response.json()
        returned_ids = {item["id"] for item in payload}
        assert feb_city_match.id in returned_ids
        assert all(item["city"] == "Poznań" for item in payload)


class TestCities:
    @pytest.mark.asyncio
    async def test_list_cities_returns_alphabetical_order(
        self,
        db_session,
        admin_client: AsyncClient,
    ):
        db_session.add_all(
            [
                City(name="Warszawa", slug="warszawa"),
                City(name="Gdańsk", slug="gdansk"),
                City(name="Poznań", slug="poznan"),
            ]
        )
        await db_session.commit()

        response = await admin_client.get("/cities/")

        assert response.status_code == 200
        payload = response.json()
        assert [item["name"] for item in payload] == ["Gdańsk", "Poznań", "Warszawa"]


class TestEventCreateValidation:
    @pytest.mark.asyncio
    async def test_create_event_requires_authentication(
        self,
        anonymous_client: AsyncClient,
    ):
        response = await anonymous_client.post(
            "/events/",
            json=_event_create_payload(),
        )

        assert response.status_code == 401
        assert response.json()["detail"] == "Not authenticated"

    @pytest.mark.asyncio
    async def test_create_event_requires_admin_role(
        self,
        guest_client: AsyncClient,
    ):
        response = await guest_client.post(
            "/events/",
            json=_event_create_payload(),
        )

        assert response.status_code == 403
        assert response.json()["detail"] == "Admin access required"

    @pytest.mark.asyncio
    async def test_create_event_blocks_pending_account(
        self,
        pending_client: AsyncClient,
    ):
        response = await pending_client.post(
            "/events/",
            json=_event_create_payload(),
        )

        assert response.status_code == 403
        assert response.json()["detail"] == "Account pending admin approval"

    @pytest.mark.asyncio
    async def test_create_event_rejects_negative_price_fields(
        self,
        admin_client: AsyncClient,
    ):
        response = await admin_client.post(
            "/events/",
            json=_event_create_payload(price_guest="-10.00", price_member="-1.00"),
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_event_rejects_negative_limits_and_points(
        self,
        admin_client: AsyncClient,
    ):
        response = await admin_client.post(
            "/events/",
            json=_event_create_payload(
                cancel_cutoff_hours=-1,
                points_value=-3,
            ),
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_event_rejects_non_positive_minimum_fields(
        self,
        admin_client: AsyncClient,
    ):
        response = await admin_client.post(
            "/events/",
            json=_event_create_payload(max_participants=0),
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_event_allows_fourth_event_on_same_day(
        self,
        db_session,
        admin_client: AsyncClient,
    ):
        target_day = datetime(2026, 2, 24)
        for idx in range(3):
            await _create_event(
                db_session,
                title=f"Existing {idx + 1}",
                start_date=target_day.replace(hour=9 + idx),
            )

        response = await admin_client.post(
            "/events/",
            json=_event_create_payload(
                title="Fourth allowed",
                start_date="2026-02-24T18:00:00Z",
            ),
        )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_create_event_rejects_fifth_event_on_same_day(
        self,
        db_session,
        admin_client: AsyncClient,
    ):
        target_day = datetime(2026, 2, 25)
        for idx in range(4):
            await _create_event(
                db_session,
                title=f"Existing {idx + 1}",
                start_date=target_day.replace(hour=8 + idx),
            )

        response = await admin_client.post(
            "/events/",
            json=_event_create_payload(
                title="Fifth blocked",
                start_date="2026-02-25T17:00:00Z",
            ),
        )

        assert response.status_code == 422
        assert response.json()["detail"] == "Maximum 4 events per day exceeded for 2026-02-25"

    @pytest.mark.asyncio
    async def test_create_event_enforces_manual_verification_and_default_transfer_url(
        self,
        admin_client: AsyncClient,
    ):
        response = await admin_client.post(
            "/events/",
            json=_event_create_payload(
                manual_payment_verification=False,
                manual_payment_url=None,
                price_guest="20.00",
                price_member="10.00",
            ),
        )

        assert response.status_code == 200
        payload = response.json()
        assert payload["manual_payment_verification"] is True
        assert payload["manual_payment_url"] == DEFAULT_MANUAL_PAYMENT_URL


class TestEventAdminManage:
    @pytest.mark.asyncio
    async def test_admin_can_update_event_from_event_view(
        self,
        db_session,
        admin_client: AsyncClient,
    ):
        event = await _create_event(
            db_session,
            title="Editable event",
            start_date=datetime(2026, 2, 20),
        )

        response = await admin_client.put(
            f"/events/{event.id}",
            json={
                "title": "Edited title",
                "city": "Warszawa",
                "price_guest": "99.00",
            },
        )

        assert response.status_code == 200
        payload = response.json()
        assert payload["title"] == "Edited title"
        assert payload["city"] == "Warszawa"
        assert payload["price_guest"] == "99.00"

    @pytest.mark.asyncio
    async def test_non_admin_cannot_update_event(
        self,
        db_session,
        guest_client: AsyncClient,
    ):
        event = await _create_event(
            db_session,
            title="Protected event",
            start_date=datetime(2026, 2, 21),
        )

        response = await guest_client.put(
            f"/events/{event.id}",
            json={"title": "Should not work"},
        )
        assert response.status_code == 403
        assert response.json()["detail"] == "Admin access required"

    @pytest.mark.asyncio
    async def test_admin_cannot_move_event_to_day_with_four_events(
        self,
        db_session,
        admin_client: AsyncClient,
    ):
        target_day = datetime(2026, 2, 26)
        for idx in range(4):
            await _create_event(
                db_session,
                title=f"Target day {idx + 1}",
                start_date=target_day.replace(hour=9 + idx),
            )

        movable_event = await _create_event(
            db_session,
            title="Movable event",
            start_date=datetime(2026, 2, 27, 11, 0),
        )

        response = await admin_client.put(
            f"/events/{movable_event.id}",
            json={"start_date": "2026-02-26T20:00:00Z"},
        )

        assert response.status_code == 422
        assert response.json()["detail"] == "Maximum 4 events per day exceeded for 2026-02-26"

    @pytest.mark.asyncio
    async def test_admin_cannot_move_event_to_past_date(
        self,
        db_session,
        admin_client: AsyncClient,
    ):
        event = await _create_event(
            db_session,
            title="Future event",
            start_date=datetime.now() + timedelta(days=3),
        )

        response = await admin_client.put(
            f"/events/{event.id}",
            json={"start_date": (datetime.now() - timedelta(days=1)).isoformat()},
        )

        assert response.status_code == 422
        assert response.json()["detail"] == "Cannot move event to a past date"

    @pytest.mark.asyncio
    async def test_admin_can_delete_event_without_registrations(
        self,
        db_session,
        admin_client: AsyncClient,
    ):
        event = await _create_event(
            db_session,
            title="Delete me",
            start_date=datetime(2026, 2, 22),
        )

        response = await admin_client.delete(f"/events/{event.id}")
        assert response.status_code == 200
        assert response.json() == {"status": "deleted"}

        result = await db_session.execute(select(Event).where(Event.id == event.id))
        assert result.scalar_one_or_none() is None

    @pytest.mark.asyncio
    async def test_admin_cannot_delete_event_with_registrations(
        self,
        db_session,
        admin_client: AsyncClient,
        admin_user: User,
    ):
        event = await _create_event(
            db_session,
            title="Delete blocked",
            start_date=datetime(2026, 2, 23),
        )
        db_session.add(
            Registration(
                user_id=admin_user.id,
                event_id=event.id,
                occurrence_date=event.start_date.date(),
                status=RegistrationStatus.CONFIRMED.value,
            )
        )
        await db_session.commit()

        response = await admin_client.delete(f"/events/{event.id}")
        assert response.status_code == 409
        assert response.json()["detail"] == "Event has registrations and cannot be deleted"

    @pytest.mark.asyncio
    async def test_admin_update_event_enforces_manual_verification_and_default_transfer_url(
        self,
        db_session,
        admin_client: AsyncClient,
    ):
        event = await _create_event(
            db_session,
            title="Manual lock event",
            start_date=datetime(2026, 2, 28),
        )

        response = await admin_client.put(
            f"/events/{event.id}",
            json={
                "title": "Manual lock event edited",
                "manual_payment_verification": False,
                "manual_payment_url": None,
            },
        )

        assert response.status_code == 200
        payload = response.json()
        assert payload["manual_payment_verification"] is True
        assert payload["manual_payment_url"] == DEFAULT_MANUAL_PAYMENT_URL
