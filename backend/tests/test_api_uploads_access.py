from uuid import uuid4

import pytest
from fastapi import FastAPI, APIRouter
from httpx import ASGITransport, AsyncClient

import routers.uploads as uploads_module
from database import get_db
from models.user import AccountStatus, User, UserRole
from routers import uploads_router
from services.auth_service import AuthService


@pytest.fixture
async def uploads_api_client(db_session, tmp_path, monkeypatch):
    app = FastAPI()
    _api = APIRouter(prefix="/api")
    _api.include_router(uploads_router)
    app.include_router(_api)

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    monkeypatch.setattr(uploads_module, "UPLOAD_DIR", tmp_path / "uploads")
    monkeypatch.setattr(uploads_module, "MAX_UPLOAD_BYTES", 1024)

    client = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    try:
        yield client
    finally:
        await client.aclose()


def _image_file():
    # Minimal JPEG-like bytes are enough for this endpoint (it validates content-type only).
    return ("test.jpg", b"\xff\xd8\xff\xe0fakejpg", "image/jpeg")


@pytest.mark.asyncio
async def test_upload_requires_auth(uploads_api_client: AsyncClient):
    response = await uploads_api_client.post(
        "/api/uploads/image",
        files={"file": _image_file()},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated"


@pytest.mark.asyncio
async def test_upload_requires_admin_role(uploads_api_client: AsyncClient, db_session):
    user = User(
        google_id=f"user-{uuid4().hex}",
        email=f"user-{uuid4().hex}@example.com",
        full_name="Regular User",
        role=UserRole.GUEST,
        account_status=AccountStatus.ACTIVE,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    token = AuthService(db_session).create_access_token(user)
    response = await uploads_api_client.post(
        "/api/uploads/image",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": _image_file()},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Admin access required"


@pytest.mark.asyncio
async def test_upload_rejects_pending_admin(uploads_api_client: AsyncClient, db_session):
    user = User(
        google_id=f"admin-pending-{uuid4().hex}",
        email=f"admin-pending-{uuid4().hex}@example.com",
        full_name="Pending Admin",
        role=UserRole.ADMIN,
        account_status=AccountStatus.PENDING,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    token = AuthService(db_session).create_access_token(user)
    response = await uploads_api_client.post(
        "/api/uploads/image",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": _image_file()},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Account pending admin approval"


@pytest.mark.asyncio
async def test_upload_allows_active_admin(uploads_api_client: AsyncClient, db_session):
    user = User(
        google_id=f"admin-{uuid4().hex}",
        email=f"admin-{uuid4().hex}@example.com",
        full_name="Active Admin",
        role=UserRole.ADMIN,
        account_status=AccountStatus.ACTIVE,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    token = AuthService(db_session).create_access_token(user)
    response = await uploads_api_client.post(
        "/api/uploads/image",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": _image_file()},
    )
    assert response.status_code == 200
    assert response.json()["url"].startswith("/uploads/")


@pytest.mark.asyncio
async def test_upload_rejects_too_large_file(uploads_api_client: AsyncClient, db_session):
    user = User(
        google_id=f"admin-large-{uuid4().hex}",
        email=f"admin-large-{uuid4().hex}@example.com",
        full_name="Active Admin",
        role=UserRole.ADMIN,
        account_status=AccountStatus.ACTIVE,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    token = AuthService(db_session).create_access_token(user)
    oversized = b"a" * (uploads_module.MAX_UPLOAD_BYTES + 1)
    response = await uploads_api_client.post(
        "/api/uploads/image",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("large.jpg", oversized, "image/jpeg")},
    )
    assert response.status_code == 413
    assert response.json()["detail"] == "File too large"


@pytest.mark.asyncio
async def test_upload_rejects_unsupported_image_mime(uploads_api_client: AsyncClient, db_session):
    user = User(
        google_id=f"admin-svg-{uuid4().hex}",
        email=f"admin-svg-{uuid4().hex}@example.com",
        full_name="Active Admin",
        role=UserRole.ADMIN,
        account_status=AccountStatus.ACTIVE,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    token = AuthService(db_session).create_access_token(user)
    response = await uploads_api_client.post(
        "/api/uploads/image",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("bad.svg", b"<svg></svg>", "image/svg+xml")},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Only image uploads are allowed"
