from uuid import uuid4
from datetime import datetime, timedelta
from decimal import Decimal

import pytest
from fastapi import FastAPI, APIRouter
from httpx import ASGITransport, AsyncClient

from database import get_db
from models.event import Event
from models.registration import Registration, RegistrationStatus
from models.user import AccountStatus, User, UserRole
from models.approval_request import ApprovalRequest
from models.user_profile import UserProfile
from routers import registrations_router, users_router
from services.auth_service import AuthService


@pytest.fixture
async def guarded_api_client(db_session):
    app = FastAPI()
    _api = APIRouter(prefix="/api")
    _api.include_router(users_router)
    _api.include_router(registrations_router)
    app.include_router(_api)

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    client = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    try:
        yield client
    finally:
        await client.aclose()


@pytest.mark.asyncio
async def test_pending_user_cannot_list_own_registrations(guarded_api_client: AsyncClient, db_session):
    pending_user = User(
        google_id=f"pending-{uuid4().hex}",
        email=f"pending-{uuid4().hex}@example.com",
        full_name="Pending User",
        role=UserRole.GUEST,
        account_status=AccountStatus.PENDING,
    )
    db_session.add(pending_user)
    await db_session.commit()
    await db_session.refresh(pending_user)

    token = AuthService(db_session).create_access_token(pending_user)
    response = await guarded_api_client.get(
        "/api/users/me/registrations",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Account pending admin approval"


@pytest.mark.asyncio
async def test_pending_user_cannot_cancel_registration(guarded_api_client: AsyncClient, db_session):
    pending_user = User(
        google_id=f"pending-cancel-{uuid4().hex}",
        email=f"pending-cancel-{uuid4().hex}@example.com",
        full_name="Pending User",
        role=UserRole.GUEST,
        account_status=AccountStatus.PENDING,
    )
    db_session.add(pending_user)
    await db_session.commit()
    await db_session.refresh(pending_user)

    token = AuthService(db_session).create_access_token(pending_user)
    response = await guarded_api_client.post(
        "/api/registrations/999/cancel",
        headers={"Authorization": f"Bearer {token}"},
        json={},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Account pending admin approval"


@pytest.mark.asyncio
async def test_active_user_can_update_and_read_own_profile(guarded_api_client: AsyncClient, db_session):
    active_user = User(
        google_id=f"active-profile-{uuid4().hex}",
        email=f"active-profile-{uuid4().hex}@example.com",
        full_name="Active Profile User",
        role=UserRole.GUEST,
        account_status=AccountStatus.ACTIVE,
    )
    db_session.add(active_user)
    await db_session.commit()
    await db_session.refresh(active_user)

    token = AuthService(db_session).create_access_token(active_user)
    update_response = await guarded_api_client.put(
        "/api/users/me/profile",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "about_me": "Lubię ruch i wspólne eventy.",
            "interest_tags": ["mors", "joga", "mors"],
        },
    )
    assert update_response.status_code == 200
    updated = update_response.json()
    assert updated["about_me"] == "Lubię ruch i wspólne eventy."
    assert updated["interest_tags"] == ["mors", "joga"]

    get_response = await guarded_api_client.get(
        "/api/users/me/profile",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert get_response.status_code == 200
    payload = get_response.json()
    assert payload["about_me"] == "Lubię ruch i wspólne eventy."
    assert payload["interest_tags"] == ["mors", "joga"]


@pytest.mark.asyncio
async def test_pending_user_cannot_update_own_profile(guarded_api_client: AsyncClient, db_session):
    pending_user = User(
        google_id=f"pending-profile-{uuid4().hex}",
        email=f"pending-profile-{uuid4().hex}@example.com",
        full_name="Pending Profile User",
        role=UserRole.GUEST,
        account_status=AccountStatus.PENDING,
    )
    db_session.add(pending_user)
    await db_session.commit()
    await db_session.refresh(pending_user)

    token = AuthService(db_session).create_access_token(pending_user)
    response = await guarded_api_client.put(
        "/api/users/me/profile",
        headers={"Authorization": f"Bearer {token}"},
        json={"about_me": "test", "interest_tags": ["mors"]},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Account pending admin approval"


@pytest.mark.asyncio
async def test_pending_user_can_submit_join_request_with_required_fields(guarded_api_client: AsyncClient, db_session):
    pending_user = User(
        google_id=f"pending-join-{uuid4().hex}",
        email=f"pending-join-{uuid4().hex}@example.com",
        full_name="Pending Join User",
        role=UserRole.GUEST,
        account_status=AccountStatus.PENDING,
    )
    db_session.add(pending_user)
    await db_session.commit()
    await db_session.refresh(pending_user)

    token = AuthService(db_session).create_access_token(pending_user)
    response = await guarded_api_client.post(
        "/api/users/me/join-request",
        headers={"Authorization": f"Bearer {token}"},
        json={"about_me": "  Lubię aktywności grupowe.  ", "interest_tags": ["mors", "joga", "mors"]},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["about_me"] == "Lubię aktywności grupowe."
    assert payload["interest_tags"] == ["mors", "joga"]

    await db_session.refresh(pending_user)
    approval = await db_session.get(ApprovalRequest, pending_user.id)
    profile = await db_session.get(UserProfile, pending_user.id)
    assert approval is not None
    assert profile is not None
    assert profile.about_me == "Lubię aktywności grupowe."


@pytest.mark.asyncio
async def test_pending_user_join_request_requires_at_least_one_interest(guarded_api_client: AsyncClient, db_session):
    pending_user = User(
        google_id=f"pending-join-empty-{uuid4().hex}",
        email=f"pending-join-empty-{uuid4().hex}@example.com",
        full_name="Pending Empty Interest",
        role=UserRole.GUEST,
        account_status=AccountStatus.PENDING,
    )
    db_session.add(pending_user)
    await db_session.commit()
    await db_session.refresh(pending_user)

    token = AuthService(db_session).create_access_token(pending_user)
    response = await guarded_api_client.post(
        "/api/users/me/join-request",
        headers={"Authorization": f"Bearer {token}"},
        json={"about_me": "Mam opis", "interest_tags": []},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_active_user_cannot_submit_join_request(guarded_api_client: AsyncClient, db_session):
    active_user = User(
        google_id=f"active-join-{uuid4().hex}",
        email=f"active-join-{uuid4().hex}@example.com",
        full_name="Active Join User",
        role=UserRole.GUEST,
        account_status=AccountStatus.ACTIVE,
    )
    db_session.add(active_user)
    await db_session.commit()
    await db_session.refresh(active_user)

    token = AuthService(db_session).create_access_token(active_user)
    response = await guarded_api_client.post(
        "/api/users/me/join-request",
        headers={"Authorization": f"Bearer {token}"},
        json={"about_me": "Mam opis", "interest_tags": ["mors"]},
    )
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_active_user_can_open_active_public_profile(guarded_api_client: AsyncClient, db_session):
    viewer = User(
        google_id=f"viewer-{uuid4().hex}",
        email=f"viewer-{uuid4().hex}@example.com",
        full_name="Viewer User",
        role=UserRole.GUEST,
        account_status=AccountStatus.ACTIVE,
    )
    target = User(
        google_id=f"target-{uuid4().hex}",
        email=f"target-{uuid4().hex}@example.com",
        full_name="Target User",
        role=UserRole.MEMBER,
        account_status=AccountStatus.ACTIVE,
    )
    db_session.add_all([viewer, target])
    await db_session.commit()
    await db_session.refresh(viewer)
    await db_session.refresh(target)
    profile = UserProfile(
        user_id=target.id,
        about_me="Biegam i morsuję.",
        interest_tags='["mors","spacer"]',
    )
    db_session.add(profile)
    await db_session.commit()

    token = AuthService(db_session).create_access_token(viewer)
    response = await guarded_api_client.get(
        f"/api/users/{target.id}/profile",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["id"] == target.id
    assert payload["full_name"] == target.full_name
    assert payload["about_me"] == profile.about_me
    assert payload["interest_tags"] == ["mors", "spacer"]


@pytest.mark.asyncio
async def test_active_user_gets_404_for_pending_public_profile(guarded_api_client: AsyncClient, db_session):
    viewer = User(
        google_id=f"viewer-p-{uuid4().hex}",
        email=f"viewer-p-{uuid4().hex}@example.com",
        full_name="Viewer Pending",
        role=UserRole.GUEST,
        account_status=AccountStatus.ACTIVE,
    )
    pending_target = User(
        google_id=f"pending-target-{uuid4().hex}",
        email=f"pending-target-{uuid4().hex}@example.com",
        full_name="Pending Target",
        role=UserRole.GUEST,
        account_status=AccountStatus.PENDING,
    )
    db_session.add_all([viewer, pending_target])
    await db_session.commit()
    await db_session.refresh(viewer)
    await db_session.refresh(pending_target)

    token = AuthService(db_session).create_access_token(viewer)
    response = await guarded_api_client.get(
        f"/api/users/{pending_target.id}/profile",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "User not found"


@pytest.mark.asyncio
async def test_manual_payment_details_is_owner_scoped(guarded_api_client: AsyncClient, db_session):
    owner = User(
        google_id=f"manual-owner-{uuid4().hex}",
        email=f"manual-owner-{uuid4().hex}@example.com",
        full_name="Manual Owner",
        role=UserRole.GUEST,
        account_status=AccountStatus.ACTIVE,
    )
    intruder = User(
        google_id=f"manual-intruder-{uuid4().hex}",
        email=f"manual-intruder-{uuid4().hex}@example.com",
        full_name="Manual Intruder",
        role=UserRole.GUEST,
        account_status=AccountStatus.ACTIVE,
    )
    event = Event(
        title="Manual Details Event",
        event_type="mors",
        start_date=datetime.now() + timedelta(days=4),
        city="Poznań",
        price_guest=Decimal("30.00"),
        price_member=Decimal("20.00"),
        manual_payment_verification=True,
        manual_payment_url="https://payments.example/manual",
        manual_payment_due_hours=24,
        max_participants=20,
        version=1,
    )
    db_session.add_all([owner, intruder, event])
    await db_session.commit()
    await db_session.refresh(owner)
    await db_session.refresh(intruder)
    await db_session.refresh(event)

    registration = Registration(
        user_id=owner.id,
        event_id=event.id,
        occurrence_date=event.start_date.date(),
        status=RegistrationStatus.MANUAL_PAYMENT_REQUIRED.value,
    )
    db_session.add(registration)
    await db_session.commit()
    await db_session.refresh(registration)

    owner_token = AuthService(db_session).create_access_token(owner)
    intruder_token = AuthService(db_session).create_access_token(intruder)

    owner_response = await guarded_api_client.get(
        f"/api/registrations/{registration.id}/manual-payment",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert owner_response.status_code == 200
    owner_payload = owner_response.json()
    assert owner_payload["registration_id"] == registration.id
    assert owner_payload["transfer_reference"] == event.id

    intruder_response = await guarded_api_client.get(
        f"/api/registrations/{registration.id}/manual-payment",
        headers={"Authorization": f"Bearer {intruder_token}"},
    )
    assert intruder_response.status_code == 404
    assert intruder_response.json()["detail"] == "Registration not found"


@pytest.mark.asyncio
async def test_manual_payment_confirm_changes_status_to_verification(guarded_api_client: AsyncClient, db_session):
    owner = User(
        google_id=f"manual-confirm-{uuid4().hex}",
        email=f"manual-confirm-{uuid4().hex}@example.com",
        full_name="Manual Confirm User",
        role=UserRole.GUEST,
        account_status=AccountStatus.ACTIVE,
    )
    event = Event(
        title="Manual Confirm Event",
        event_type="mors",
        start_date=datetime.now() + timedelta(days=5),
        city="Poznań",
        price_guest=Decimal("40.00"),
        price_member=Decimal("20.00"),
        manual_payment_verification=True,
        manual_payment_url="https://payments.example/manual",
        manual_payment_due_hours=24,
        max_participants=20,
        version=1,
    )
    db_session.add_all([owner, event])
    await db_session.commit()
    await db_session.refresh(owner)
    await db_session.refresh(event)

    registration = Registration(
        user_id=owner.id,
        event_id=event.id,
        occurrence_date=event.start_date.date(),
        status=RegistrationStatus.MANUAL_PAYMENT_REQUIRED.value,
    )
    db_session.add(registration)
    await db_session.commit()
    await db_session.refresh(registration)

    owner_token = AuthService(db_session).create_access_token(owner)
    confirm_response = await guarded_api_client.post(
        f"/api/registrations/{registration.id}/manual-payment/confirm",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert confirm_response.status_code == 200
    confirm_payload = confirm_response.json()
    assert confirm_payload["status"] == RegistrationStatus.MANUAL_PAYMENT_VERIFICATION.value
    assert confirm_payload["can_confirm"] is False

    await db_session.refresh(registration)
    assert registration.status == RegistrationStatus.MANUAL_PAYMENT_VERIFICATION.value
    assert registration.payment_id is not None


@pytest.mark.asyncio
async def test_pending_user_cannot_access_manual_payment_endpoints(guarded_api_client: AsyncClient, db_session):
    pending_user = User(
        google_id=f"pending-manual-{uuid4().hex}",
        email=f"pending-manual-{uuid4().hex}@example.com",
        full_name="Pending Manual User",
        role=UserRole.GUEST,
        account_status=AccountStatus.PENDING,
    )
    db_session.add(pending_user)
    await db_session.commit()
    await db_session.refresh(pending_user)

    token = AuthService(db_session).create_access_token(pending_user)
    response = await guarded_api_client.get(
        "/api/registrations/any/manual-payment",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Account pending admin approval"
