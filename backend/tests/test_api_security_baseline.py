from uuid import uuid4

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from config import get_settings
from database import get_db
from models.user import AccountStatus, User, UserRole
from routers import admin_router, users_router
from services.auth_service import AuthService
from security.rate_limit import clear_rate_limiter_state


@pytest.fixture
async def secured_client(db_session):
    app = FastAPI()
    app.include_router(admin_router)
    app.include_router(users_router)

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    client = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    try:
        yield client
    finally:
        await client.aclose()


@pytest.mark.asyncio
async def test_authenticated_rate_limit_blocks_after_threshold(secured_client: AsyncClient, db_session):
    settings = get_settings()
    previous_limit = settings.rate_limit_authenticated_per_minute
    settings.rate_limit_authenticated_per_minute = 2
    clear_rate_limiter_state()

    user = User(
        google_id=f"rl-active-{uuid4().hex}",
        email=f"rl-active-{uuid4().hex}@example.com",
        full_name="Rate Limited Active User",
        role=UserRole.GUEST,
        account_status=AccountStatus.ACTIVE,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    token = AuthService(db_session).create_access_token(user)
    headers = {"Authorization": f"Bearer {token}"}

    try:
        first = await secured_client.get("/api/users/me/registrations", headers=headers)
        second = await secured_client.get("/api/users/me/registrations", headers=headers)
        third = await secured_client.get("/api/users/me/registrations", headers=headers)
    finally:
        settings.rate_limit_authenticated_per_minute = previous_limit
        clear_rate_limiter_state()

    assert first.status_code == 200
    assert second.status_code == 200
    assert third.status_code == 429
    assert third.json()["detail"] == "Too many requests"


@pytest.mark.asyncio
async def test_admin_rate_limit_blocks_after_threshold(secured_client: AsyncClient, db_session):
    settings = get_settings()
    previous_admin_limit = settings.rate_limit_admin_per_minute
    settings.rate_limit_admin_per_minute = 2
    clear_rate_limiter_state()

    admin = User(
        google_id=f"rl-admin-{uuid4().hex}",
        email=f"rl-admin-{uuid4().hex}@example.com",
        full_name="Rate Limited Admin",
        role=UserRole.ADMIN,
        account_status=AccountStatus.ACTIVE,
    )
    db_session.add(admin)
    await db_session.commit()
    await db_session.refresh(admin)

    token = AuthService(db_session).create_access_token(admin)
    headers = {"Authorization": f"Bearer {token}"}

    try:
        first = await secured_client.get("/api/admin/stats/users", headers=headers)
        second = await secured_client.get("/api/admin/stats/users", headers=headers)
        third = await secured_client.get("/api/admin/stats/users", headers=headers)
    finally:
        settings.rate_limit_admin_per_minute = previous_admin_limit
        clear_rate_limiter_state()

    assert first.status_code == 200
    assert second.status_code == 200
    assert third.status_code == 429
    assert third.json()["detail"] == "Too many requests"

