from decimal import Decimal
from datetime import datetime, timedelta
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import FastAPI, APIRouter
from httpx import ASGITransport, AsyncClient

import routers.payments as payments_module
from database import get_db
from config import get_settings
from models.event import Event
from models.payment import Payment, PaymentStatus as DBPaymentStatus, PaymentType
from models.registration import Registration, RegistrationStatus
from models.user import AccountStatus, User, UserRole
from models.subscription import Subscription
from ports.payment_gateway import PaymentRequest
from routers import auth_router, payments_router
from security.rate_limit import clear_rate_limiter_state
from services.auth_service import AuthService
from services.payment_service import PaymentService


@pytest.fixture
async def api_client(db_session):
    app = FastAPI()
    _api = APIRouter(prefix="/api")
    _api.include_router(auth_router)
    _api.include_router(payments_router)
    app.include_router(_api)

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    client = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    try:
        yield client
    finally:
        await client.aclose()


@pytest.fixture
async def auth_user(db_session):
    suffix = uuid4().hex
    user = User(
        google_id=f"auth-{suffix}",
        email=f"auth-{suffix}@example.com",
        full_name="Auth User",
        role=UserRole.MEMBER,
        account_status=AccountStatus.ACTIVE,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    subscription = Subscription(user_id=user.id, points=7)
    db_session.add(subscription)
    await db_session.commit()
    return user


class TestAuthRouter:
    @pytest.mark.asyncio
    async def test_google_login_redirects_to_provider(self, api_client: AsyncClient, monkeypatch):
        async def fake_auth_url(self):
            return "https://accounts.example.com/auth"

        monkeypatch.setattr(AuthService, "get_google_auth_url", fake_auth_url)

        response = await api_client.get("/api/auth/google/login", follow_redirects=False)

        assert response.status_code in (302, 307)
        assert response.headers["location"] == "https://accounts.example.com/auth"

    @pytest.mark.asyncio
    async def test_google_login_returns_500_when_config_missing(self, api_client: AsyncClient, monkeypatch):
        async def fake_auth_url(self):
            raise ValueError("GOOGLE_CLIENT_ID is not configured")

        monkeypatch.setattr(AuthService, "get_google_auth_url", fake_auth_url)

        response = await api_client.get("/api/auth/google/login")

        assert response.status_code == 500
        assert response.json()["detail"] == "GOOGLE_CLIENT_ID is not configured"

    @pytest.mark.asyncio
    async def test_google_callback_success_redirects_to_frontend(self, api_client: AsyncClient, monkeypatch):
        async def fake_exchange(self, code):
            assert code == "abc"
            return {"access_token": "ga", "refresh_token": "gr", "scope": "s1"}

        async def fake_userinfo(self, access_token):
            assert access_token == "ga"
            return {"id": "gid", "email": "u@example.com", "name": "U"}

        async def fake_get_or_create(self, user_info):
            return User(
                id="00000000-0000-0000-0000-000000000123",
                google_id="gid",
                email=user_info["email"],
                full_name=user_info["name"],
                role=UserRole.GUEST,
                account_status=AccountStatus.ACTIVE,
            )

        async def fake_update_tokens(self, user, tokens):
            return None

        monkeypatch.setattr(AuthService, "exchange_code_for_tokens", fake_exchange)
        monkeypatch.setattr(AuthService, "get_google_user_info", fake_userinfo)
        monkeypatch.setattr(AuthService, "get_or_create_user", fake_get_or_create)
        monkeypatch.setattr(AuthService, "update_google_tokens", fake_update_tokens)
        monkeypatch.setattr(AuthService, "create_access_token", lambda self, user: "access123")
        monkeypatch.setattr(AuthService, "create_refresh_token", lambda self, user: "refresh123")

        response = await api_client.get("/api/auth/google/callback?code=abc", follow_redirects=False)

        assert response.status_code in (302, 307)
        location = response.headers["location"]
        assert "/auth/callback" in location
        assert "access_token=access123" in location
        assert "refresh_token=refresh123" in location

    @pytest.mark.asyncio
    async def test_google_callback_error_redirects_to_frontend_error(self, api_client: AsyncClient, monkeypatch):
        async def fake_exchange(self, code):
            raise RuntimeError("oauth failed")

        monkeypatch.setattr(AuthService, "exchange_code_for_tokens", fake_exchange)

        response = await api_client.get("/api/auth/google/callback?code=abc", follow_redirects=False)

        assert response.status_code in (302, 307)
        assert "/auth/error" in response.headers["location"]
        assert "Authentication%20failed" in response.headers["location"] or "Authentication+failed" in response.headers["location"]

    @pytest.mark.asyncio
    async def test_password_register_issues_tokens_and_creates_pending_user(self, api_client: AsyncClient):
        suffix = uuid4().hex[:12]
        response = await api_client.post(
            "/api/auth/password/register",
            json={
                "username": f"tester-{suffix}",
                "email": f"tester-{suffix}@example.com",
                "full_name": "Password Tester",
                "password": "StrongPass#123",
            },
        )

        assert response.status_code == 200
        payload = response.json()
        assert payload["access_token"]
        assert payload["refresh_token"]

        me = await api_client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {payload['access_token']}"},
        )
        assert me.status_code == 200
        me_payload = me.json()
        assert me_payload["email"] == f"tester-{suffix}@example.com"
        assert me_payload["role"] == "guest"
        assert me_payload["account_status"] == "pending"

    @pytest.mark.asyncio
    async def test_password_register_rejects_conflicting_username(self, api_client: AsyncClient, db_session):
        service = AuthService(db_session)
        suffix = uuid4().hex[:12]
        seeded = User(
            username=f"taken-{suffix}",
            email=f"existing-{suffix}@example.com",
            full_name="Existing User",
            role=UserRole.GUEST,
            account_status=AccountStatus.PENDING,
            password_hash=service.hash_password("StrongPass#123"),
        )
        db_session.add(seeded)
        await db_session.commit()

        response = await api_client.post(
            "/api/auth/password/register",
            json={
                "username": f"taken-{suffix}",
                "email": f"new-{suffix}@example.com",
                "full_name": "New User",
                "password": "StrongPass#123",
            },
        )

        assert response.status_code == 409
        assert response.json()["detail"] == "Username is already taken"

    @pytest.mark.asyncio
    async def test_password_register_rejects_allowlisted_admin_email(self, api_client: AsyncClient):
        response = await api_client.post(
            "/api/auth/password/register",
            json={
                "username": f"reserved-{uuid4().hex[:12]}",
                "email": "tomek.piescikowski@gmail.com",
                "full_name": "Reserved Mail",
                "password": "StrongPass#123",
            },
        )

        assert response.status_code == 403
        assert response.json()["detail"] == "This admin email must sign in with Google only"

    @pytest.mark.asyncio
    async def test_password_login_returns_tokens_for_valid_credentials(self, api_client: AsyncClient, db_session):
        service = AuthService(db_session)
        suffix = uuid4().hex
        user = User(
            username=f"member-{suffix}",
            email=f"member-{suffix}@example.com",
            full_name="Member User",
            role=UserRole.MEMBER,
            account_status=AccountStatus.ACTIVE,
            password_hash=service.hash_password("StrongPass#123"),
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        response = await api_client.post(
            "/api/auth/password/login",
            json={
                "login": user.username.upper(),
                "password": "StrongPass#123",
            },
        )

        assert response.status_code == 200
        payload = response.json()
        me = await api_client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {payload['access_token']}"},
        )
        assert me.status_code == 200
        assert me.json()["id"] == user.id

    @pytest.mark.asyncio
    async def test_password_login_rejects_too_short_password(
        self,
        api_client: AsyncClient,
        db_session,
    ):
        service = AuthService(db_session)
        suffix = uuid4().hex
        user = User(
            username=f"seed-admin-{suffix}",
            email=f"seed-admin-{suffix}@example.com",
            full_name="Seed Admin",
            role=UserRole.ADMIN,
            account_status=AccountStatus.ACTIVE,
            password_hash=service.hash_password("admin123"),
        )
        db_session.add(user)
        await db_session.commit()

        response = await api_client.post(
            "/api/auth/password/login",
            json={
                "login": user.email,
                "password": "admin",
            },
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_password_login_rejects_invalid_credentials(self, api_client: AsyncClient, db_session):
        service = AuthService(db_session)
        suffix = uuid4().hex
        user = User(
            username=f"member-{suffix}",
            email=f"member-{suffix}@example.com",
            full_name="Member User",
            role=UserRole.MEMBER,
            account_status=AccountStatus.ACTIVE,
            password_hash=service.hash_password("StrongPass#123"),
        )
        db_session.add(user)
        await db_session.commit()

        response = await api_client.post(
            "/api/auth/password/login",
            json={
                "login": user.email,
                "password": "wrong-password",
            },
        )

        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid login or password"

    @pytest.mark.asyncio
    async def test_password_login_rejects_google_only_account(self, api_client: AsyncClient, db_session):
        suffix = uuid4().hex
        user = User(
            google_id=f"google-{suffix}",
            email=f"google-{suffix}@example.com",
            full_name="Google Only",
            role=UserRole.MEMBER,
            account_status=AccountStatus.ACTIVE,
            password_hash=None,
        )
        db_session.add(user)
        await db_session.commit()

        response = await api_client.post(
            "/api/auth/password/login",
            json={
                "login": user.email,
                "password": "StrongPass#123",
            },
        )

        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid login or password"

    @pytest.mark.asyncio
    async def test_refresh_requires_authorization_header(self, api_client: AsyncClient):
        response = await api_client.post("/api/auth/refresh")

        assert response.status_code == 401
        assert response.json()["detail"] == "Missing refresh token"

    @pytest.mark.asyncio
    async def test_refresh_rejects_invalid_refresh_token(self, api_client: AsyncClient, monkeypatch):
        async def fake_refresh(self, refresh_token):
            return None

        monkeypatch.setattr(AuthService, "refresh_access_token", fake_refresh)

        response = await api_client.post(
            "/api/auth/refresh",
            headers={"Authorization": "Bearer invalid"},
        )

        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid refresh token"

    @pytest.mark.asyncio
    async def test_refresh_returns_new_tokens(self, api_client: AsyncClient, monkeypatch):
        async def fake_refresh(self, refresh_token):
            return "new-access", "new-refresh"

        monkeypatch.setattr(AuthService, "refresh_access_token", fake_refresh)

        response = await api_client.post(
            "/api/auth/refresh",
            headers={"Authorization": "Bearer valid"},
        )

        assert response.status_code == 200
        assert response.json()["access_token"] == "new-access"
        assert response.json()["refresh_token"] == "new-refresh"

    @pytest.mark.asyncio
    async def test_refresh_uses_authenticated_limit_not_public_ip(self, api_client: AsyncClient, monkeypatch):
        settings = get_settings()
        previous_public_limit = settings.rate_limit_public_per_minute
        previous_authenticated_limit = settings.rate_limit_authenticated_per_minute
        settings.rate_limit_public_per_minute = 1
        settings.rate_limit_authenticated_per_minute = 5
        clear_rate_limiter_state()

        async def fake_refresh(self, refresh_token):
            return "new-access", "new-refresh"

        monkeypatch.setattr(
            AuthService,
            "verify_token",
            lambda self, token: {"type": "refresh", "sub": "123"},
        )
        monkeypatch.setattr(AuthService, "refresh_access_token", fake_refresh)

        try:
            first = await api_client.post(
                "/api/auth/refresh",
                headers={"Authorization": "Bearer valid"},
            )
            second = await api_client.post(
                "/api/auth/refresh",
                headers={"Authorization": "Bearer valid"},
            )
        finally:
            settings.rate_limit_public_per_minute = previous_public_limit
            settings.rate_limit_authenticated_per_minute = previous_authenticated_limit
            clear_rate_limiter_state()

        assert first.status_code == 200
        assert second.status_code == 200

    @pytest.mark.asyncio
    async def test_me_requires_authorization_header(self, api_client: AsyncClient):
        response = await api_client.get("/api/auth/me")

        assert response.status_code == 401
        assert response.json()["detail"] == "Not authenticated"

    @pytest.mark.asyncio
    async def test_me_rejects_invalid_token(self, api_client: AsyncClient, monkeypatch):
        monkeypatch.setattr(AuthService, "verify_token", lambda self, token: None)

        response = await api_client.get("/api/auth/me", headers={"Authorization": "Bearer bad"})

        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid token"

    @pytest.mark.asyncio
    async def test_me_returns_404_when_user_not_found(self, api_client: AsyncClient, monkeypatch):
        monkeypatch.setattr(
            AuthService,
            "verify_token",
            lambda self, token: {"type": "access", "sub": "999"},
        )

        async def fake_get_user(self, user_id):
            return None

        monkeypatch.setattr(AuthService, "get_user_by_id", fake_get_user)

        response = await api_client.get("/api/auth/me", headers={"Authorization": "Bearer any"})

        assert response.status_code == 404
        assert response.json()["detail"] == "User not found"

    @pytest.mark.asyncio
    async def test_me_returns_current_user(self, api_client: AsyncClient, auth_user: User, monkeypatch):
        monkeypatch.setattr(
            AuthService,
            "verify_token",
            lambda self, token: {"type": "access", "sub": str(auth_user.id)},
        )

        async def fake_get_user(self, user_id):
            return auth_user

        monkeypatch.setattr(AuthService, "get_user_by_id", fake_get_user)

        response = await api_client.get("/api/auth/me", headers={"Authorization": "Bearer good"})

        assert response.status_code == 200
        assert response.json()["id"] == auth_user.id
        assert response.json()["email"] == auth_user.email

    @pytest.mark.asyncio
    async def test_me_uses_authenticated_limit_not_public_ip(
        self,
        api_client: AsyncClient,
        auth_user: User,
        monkeypatch,
    ):
        settings = get_settings()
        previous_public_limit = settings.rate_limit_public_per_minute
        previous_authenticated_limit = settings.rate_limit_authenticated_per_minute
        settings.rate_limit_public_per_minute = 1
        settings.rate_limit_authenticated_per_minute = 5
        clear_rate_limiter_state()

        monkeypatch.setattr(
            AuthService,
            "verify_token",
            lambda self, token: {"type": "access", "sub": str(auth_user.id)},
        )

        async def fake_get_user(self, user_id):
            return auth_user

        monkeypatch.setattr(AuthService, "get_user_by_id", fake_get_user)

        try:
            first = await api_client.get("/api/auth/me", headers={"Authorization": "Bearer good"})
            second = await api_client.get("/api/auth/me", headers={"Authorization": "Bearer good"})
        finally:
            settings.rate_limit_public_per_minute = previous_public_limit
            settings.rate_limit_authenticated_per_minute = previous_authenticated_limit
            clear_rate_limiter_state()

        assert first.status_code == 200
        assert second.status_code == 200

    @pytest.mark.asyncio
    async def test_me_handles_legacy_nullable_user_fields(self, api_client: AsyncClient, monkeypatch):
        monkeypatch.setattr(
            AuthService,
            "verify_token",
            lambda self, token: {"type": "access", "sub": "321"},
        )

        legacy_user = SimpleNamespace(
            id=321,
            email="legacy@example.com",
            full_name="Legacy User",
            picture_url=None,
            role=None,
            account_status=None,
            subscription_end_date=None,
            points=None,
            about_me=None,
            interest_tags='["mors","invalid-tag"]',
        )

        async def fake_get_user(self, user_id):
            return legacy_user

        monkeypatch.setattr(AuthService, "get_user_by_id", fake_get_user)

        response = await api_client.get("/api/auth/me", headers={"Authorization": "Bearer good"})

        assert response.status_code == 200
        payload = response.json()
        assert payload["id"] == "321"
        assert payload["role"] == "guest"
        assert payload["account_status"] == "pending"
        assert payload["points"] == 0
        assert payload["interest_tags"] == ["mors"]

    @pytest.mark.asyncio
    async def test_me_returns_next_manual_payment_action_for_promoted_waitlist(
        self,
        api_client: AsyncClient,
        db_session,
        auth_user: User,
    ):
        event = Event(
            title="Manual next action event",
            event_type="mors",
            start_date=datetime.utcnow() + timedelta(days=3),
            city="Poznań",
            price_guest=Decimal("40.00"),
            price_member=Decimal("20.00"),
            manual_payment_verification=True,
            manual_payment_url="https://payments.example/manual",
            manual_payment_due_hours=24,
            max_participants=10,
            version=1,
        )
        db_session.add(event)
        await db_session.commit()
        await db_session.refresh(event)

        registration = Registration(
            user_id=auth_user.id,
            event_id=event.id,
            occurrence_date=event.start_date.date(),
            status=RegistrationStatus.MANUAL_PAYMENT_REQUIRED.value,
            promoted_from_waitlist_at=datetime.utcnow(),
            manual_payment_due_at=datetime.utcnow() + timedelta(hours=24),
        )
        db_session.add(registration)
        await db_session.commit()

        token = AuthService(db_session).create_access_token(auth_user)
        response = await api_client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        payload = response.json()
        assert payload["next_action_manual_payment"] is not None
        assert payload["next_action_manual_payment"]["registration_id"] == registration.id
        assert payload["next_action_manual_payment"]["event_id"] == event.id


class TestPaymentsRouter:
    @pytest.mark.asyncio
    async def test_get_payment_status_returns_404_for_missing_payment(
        self,
        api_client: AsyncClient,
        db_session,
        auth_user: User,
        monkeypatch,
    ):
        gateway = payments_module.get_shared_fake_payment_adapter(base_url="http://test")
        gateway.clear_payments()
        monkeypatch.setattr(payments_module, "get_payment_gateway", lambda: gateway)

        token = AuthService(db_session).create_access_token(auth_user)
        response = await api_client.get(
            "/api/payments/UNKNOWN/status",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 404
        assert response.json()["detail"] == "Payment not found"

    @pytest.mark.asyncio
    async def test_get_payment_status_returns_payment_data(self, api_client: AsyncClient, db_session, auth_user: User, monkeypatch):
        gateway = payments_module.get_shared_fake_payment_adapter(base_url="http://test")
        gateway.clear_payments()
        monkeypatch.setattr(payments_module, "get_payment_gateway", lambda: gateway)

        gateway_payment = await gateway.create_payment(
            PaymentRequest(
                amount=Decimal("25.00"),
                currency="PLN",
                description="Test",
                user_id=auth_user.id,
                user_email=auth_user.email,
                user_name=auth_user.full_name,
                return_url="http://r",
                cancel_url="http://c",
            )
        )

        db_payment = Payment(
            user_id=auth_user.id,
            external_id=gateway_payment.payment_id,
            amount=Decimal("25.00"),
            currency="PLN",
            payment_type=PaymentType.EVENT.value,
            status=DBPaymentStatus.PENDING.value,
            description="Test",
        )
        db_session.add(db_payment)
        await db_session.commit()

        token = AuthService(db_session).create_access_token(auth_user)
        response = await api_client.get(
            f"/api/payments/{gateway_payment.payment_id}/status",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        payload = response.json()
        assert payload["payment_id"] == gateway_payment.payment_id
        assert payload["amount"] == "25.00"

    @pytest.mark.asyncio
    async def test_get_payment_status_rejects_foreign_user(
        self,
        api_client: AsyncClient,
        db_session,
        auth_user: User,
        monkeypatch,
    ):
        gateway = payments_module.get_shared_fake_payment_adapter(base_url="http://test")
        gateway.clear_payments()
        monkeypatch.setattr(payments_module, "get_payment_gateway", lambda: gateway)

        owner_payment = await gateway.create_payment(
            PaymentRequest(
                amount=Decimal("25.00"),
                currency="PLN",
                description="Owned",
                user_id=auth_user.id,
                user_email=auth_user.email,
                user_name=auth_user.full_name,
                return_url="http://r",
                cancel_url="http://c",
            )
        )

        db_payment = Payment(
            user_id=auth_user.id,
            external_id=owner_payment.payment_id,
            amount=Decimal("25.00"),
            currency="PLN",
            payment_type=PaymentType.EVENT.value,
            status=DBPaymentStatus.PENDING.value,
            description="Owned",
        )
        db_session.add(db_payment)

        intruder = User(
            google_id=f"intruder-{uuid4().hex}",
            email=f"intruder-{uuid4().hex}@example.com",
            full_name="Intruder",
            role=UserRole.GUEST,
            account_status=AccountStatus.ACTIVE,
        )
        db_session.add(intruder)
        await db_session.commit()
        await db_session.refresh(intruder)

        intruder_token = AuthService(db_session).create_access_token(intruder)
        response = await api_client.get(
            f"/api/payments/{owner_payment.payment_id}/status",
            headers={"Authorization": f"Bearer {intruder_token}"},
        )

        assert response.status_code == 404
        assert response.json()["detail"] == "Payment not found"

    @pytest.mark.asyncio
    async def test_webhook_rejects_invalid_json(self, api_client: AsyncClient):
        response = await api_client.post(
            "/api/payments/webhook",
            content="not-json",
            headers={"content-type": "application/json"},
        )

        assert response.status_code == 400
        assert response.json()["detail"] == "Invalid JSON payload"

    @pytest.mark.asyncio
    async def test_webhook_rejects_invalid_payload_shape(self, api_client: AsyncClient):
        response = await api_client.post(
            "/api/payments/webhook",
            json={"payment_id": "", "status": "unknown"},
        )

        assert response.status_code == 422
        assert response.json()["detail"] == "Invalid webhook payload"

    @pytest.mark.asyncio
    async def test_webhook_returns_payment_not_found_when_missing_in_db(self, api_client: AsyncClient, monkeypatch):
        gateway = payments_module.get_shared_fake_payment_adapter(base_url="http://test")
        gateway.clear_payments()
        monkeypatch.setattr(payments_module, "get_payment_gateway", lambda: gateway)

        response = await api_client.post(
            "/api/payments/webhook",
            json={"payment_id": "DOES_NOT_EXIST", "status": "completed"},
        )

        assert response.status_code == 200
        assert response.json() == {"success": False, "message": "Payment not found"}

    @pytest.mark.asyncio
    async def test_webhook_completed_confirms_registration(self, api_client: AsyncClient, db_session, auth_user: User, monkeypatch):
        gateway = payments_module.get_shared_fake_payment_adapter(base_url="http://test")
        gateway.clear_payments()
        monkeypatch.setattr(payments_module, "get_payment_gateway", lambda: gateway)

        gateway_payment = await gateway.create_payment(
            PaymentRequest(
                amount=Decimal("30.00"),
                currency="PLN",
                description="Webhook",
                user_id=auth_user.id,
                user_email=auth_user.email,
                user_name=auth_user.full_name,
                return_url="http://r",
                cancel_url="http://c",
            )
        )

        db_payment = Payment(
            user_id=auth_user.id,
            external_id=gateway_payment.payment_id,
            amount=Decimal("30.00"),
            currency="PLN",
            payment_type=PaymentType.EVENT.value,
            status=DBPaymentStatus.PENDING.value,
            description="Webhook",
        )
        db_session.add(db_payment)
        await db_session.commit()

        calls = []

        async def fake_confirm(self, payment_id):
            calls.append(payment_id)
            return None

        monkeypatch.setattr("services.registration_service.RegistrationService.confirm_registration", fake_confirm)

        response = await api_client.post(
            "/api/payments/webhook",
            json={"payment_id": gateway_payment.payment_id, "status": "completed"},
        )

        assert response.status_code == 200
        assert response.json()["success"] is True
        assert calls == [gateway_payment.payment_id]

    @pytest.mark.asyncio
    async def test_fake_payment_page_rejects_invalid_token(self, api_client: AsyncClient, monkeypatch):
        gateway = payments_module.get_shared_fake_payment_adapter(base_url="http://test")
        gateway.clear_payments()
        monkeypatch.setattr(payments_module, "get_payment_gateway", lambda: gateway)

        response = await api_client.get("/api/payments/fake/MISSING?token=invalidtoken")

        assert response.status_code == 404
        assert response.json()["detail"] == "Payment not found"

    @pytest.mark.asyncio
    async def test_fake_complete_and_fail_endpoints(self, api_client: AsyncClient, db_session, auth_user: User, monkeypatch):
        gateway = payments_module.get_shared_fake_payment_adapter(base_url="http://test")
        gateway.clear_payments()
        monkeypatch.setattr(payments_module, "get_payment_gateway", lambda: gateway)

        gateway_payment = await gateway.create_payment(
            PaymentRequest(
                amount=Decimal("45.00"),
                currency="PLN",
                description="FakeUI",
                user_id=auth_user.id,
                user_email=auth_user.email,
                user_name=auth_user.full_name,
                return_url="http://r",
                cancel_url="http://c",
            )
        )

        db_payment = Payment(
            user_id=auth_user.id,
            external_id=gateway_payment.payment_id,
            amount=Decimal("45.00"),
            currency="PLN",
            payment_type=PaymentType.EVENT.value,
            status=DBPaymentStatus.PENDING.value,
            description="FakeUI",
        )
        db_session.add(db_payment)
        await db_session.commit()

        async def fake_confirm(self, payment_id):
            return None

        monkeypatch.setattr("services.registration_service.RegistrationService.confirm_registration", fake_confirm)

        fake_payment = gateway.get_payment(gateway_payment.payment_id)
        assert fake_payment is not None
        token = fake_payment.dev_token

        complete_response = await api_client.post(
            f"/api/payments/fake/{gateway_payment.payment_id}/complete?token={token}"
        )
        fail_response = await api_client.post(
            f"/api/payments/fake/{gateway_payment.payment_id}/fail?token={token}"
        )

        assert complete_response.status_code == 200
        assert complete_response.json()["success"] is True
        assert fail_response.status_code == 200
        assert fail_response.json()["success"] is True

    @pytest.mark.asyncio
    async def test_fake_payment_endpoints_disabled_when_debug_false(
        self,
        api_client: AsyncClient,
        monkeypatch,
    ):
        monkeypatch.setattr(payments_module.settings, "debug", False)

        response = await api_client.get("/api/payments/fake/anything?token=validtoken")
        assert response.status_code == 404
        assert response.json()["detail"] == "Not found"

    @pytest.mark.asyncio
    async def test_subscription_plans_requires_authentication(self, api_client: AsyncClient):
        response = await api_client.get("/api/payments/subscription/plans")

        assert response.status_code == 401
        assert response.json()["detail"] == "Not authenticated"

    @pytest.mark.asyncio
    async def test_subscription_checkout_requires_authentication(self, api_client: AsyncClient):
        response = await api_client.post(
            "/api/payments/subscription/checkout",
            json={
                "plan_code": "monthly",
                "return_url": "http://test/plans?payment=success",
                "cancel_url": "http://test/plans?payment=cancelled",
            },
        )

        assert response.status_code == 401
        assert response.json()["detail"] == "Not authenticated"

    @pytest.mark.asyncio
    async def test_subscription_plans_returns_three_cards_for_active_user(
        self,
        api_client: AsyncClient,
        db_session,
        auth_user: User,
    ):
        token = AuthService(db_session).create_access_token(auth_user)
        response = await api_client.get(
            "/api/payments/subscription/plans",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        payload = response.json()
        assert [row["code"] for row in payload] == ["free", "monthly", "yearly"]
        free_row = payload[0]
        assert free_row["is_default"] is True
        assert free_row["is_purchasable"] is False

    @pytest.mark.asyncio
    async def test_subscription_checkout_rejects_pending_user(
        self,
        api_client: AsyncClient,
        db_session,
        monkeypatch,
    ):
        monkeypatch.setattr(payments_module.settings, "frontend_url", "http://test")

        pending = User(
            google_id=f"pending-{uuid4().hex}",
            email=f"pending-{uuid4().hex}@example.com",
            full_name="Pending User",
            role=UserRole.GUEST,
            account_status=AccountStatus.PENDING,
        )
        db_session.add(pending)
        await db_session.commit()
        await db_session.refresh(pending)

        token = AuthService(db_session).create_access_token(pending)
        response = await api_client.post(
            "/api/payments/subscription/checkout",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "plan_code": "monthly",
                "return_url": "http://test/plans?payment=success",
                "cancel_url": "http://test/plans?payment=cancelled",
            },
        )

        assert response.status_code == 403
        assert response.json()["detail"] == "Account pending admin approval"

    @pytest.mark.asyncio
    async def test_subscription_checkout_rejects_foreign_redirect_host(
        self,
        api_client: AsyncClient,
        db_session,
        auth_user: User,
        monkeypatch,
    ):
        monkeypatch.setattr(payments_module.settings, "frontend_url", "http://test")
        token = AuthService(db_session).create_access_token(auth_user)

        response = await api_client.post(
            "/api/payments/subscription/checkout",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "plan_code": "monthly",
                "return_url": "http://evil.example/plans?payment=success",
                "cancel_url": "http://test/plans?payment=cancelled",
            },
        )

        assert response.status_code == 400
        assert response.json()["detail"] == "Invalid redirect URL host"

    @pytest.mark.asyncio
    async def test_subscription_checkout_completed_applies_membership(
        self,
        api_client: AsyncClient,
        db_session,
        monkeypatch,
    ):
        monkeypatch.setattr(payments_module.settings, "frontend_url", "http://test")
        gateway = payments_module.get_shared_fake_payment_adapter(base_url="http://test")
        gateway.clear_payments()
        monkeypatch.setattr(payments_module, "get_payment_gateway", lambda: gateway)

        subscriber = User(
            google_id=f"subscriber-{uuid4().hex}",
            email=f"subscriber-{uuid4().hex}@example.com",
            full_name="Subscriber User",
            role=UserRole.GUEST,
            account_status=AccountStatus.ACTIVE,
        )
        db_session.add(subscriber)
        await db_session.commit()
        await db_session.refresh(subscriber)

        token = AuthService(db_session).create_access_token(subscriber)
        response = await api_client.post(
            "/api/payments/subscription/checkout",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "plan_code": "monthly",
                "return_url": "http://test/plans?payment=success",
                "cancel_url": "http://test/plans?payment=cancelled",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["plan_code"] == "monthly"
        assert data["status"] == DBPaymentStatus.COMPLETED.value
        assert data["payment_id"]

        await db_session.refresh(subscriber)
        subscription = await db_session.get(Subscription, subscriber.id)
        assert subscriber.role == UserRole.MEMBER
        assert subscription is not None
        assert subscription.end_date is not None
        now = datetime.utcnow()
        end_date = subscription.end_date
        if end_date.tzinfo is not None and now.tzinfo is None:
            now = now.replace(tzinfo=end_date.tzinfo)
        assert end_date > now + timedelta(days=29)

        payment = await PaymentService(db_session, gateway).get_payment_by_external_id(data["payment_id"])
        assert payment is not None
        assert payment.payment_type == PaymentType.SUBSCRIPTION.value
        assert payment.status == DBPaymentStatus.COMPLETED.value

    @pytest.mark.asyncio
    async def test_subscription_checkout_is_idempotent_when_fake_complete_replayed(
        self,
        api_client: AsyncClient,
        db_session,
        monkeypatch,
    ):
        monkeypatch.setattr(payments_module.settings, "frontend_url", "http://test")
        monkeypatch.setattr(payments_module.settings, "debug", True)
        gateway = payments_module.get_shared_fake_payment_adapter(base_url="http://test")
        gateway.clear_payments()
        monkeypatch.setattr(payments_module, "get_payment_gateway", lambda: gateway)

        subscriber = User(
            google_id=f"subscriber-regression-{uuid4().hex}",
            email=f"subscriber-regression-{uuid4().hex}@example.com",
            full_name="Subscriber Regression",
            role=UserRole.MEMBER,
            account_status=AccountStatus.ACTIVE,
        )
        db_session.add(subscriber)
        await db_session.commit()
        await db_session.refresh(subscriber)

        token = AuthService(db_session).create_access_token(subscriber)
        response = await api_client.post(
            "/api/payments/subscription/checkout",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "plan_code": "monthly",
                "return_url": "http://test/plans?payment=success",
                "cancel_url": "http://test/plans?payment=cancelled",
            },
        )
        assert response.status_code == 200
        payment_id = response.json()["payment_id"]
        subscription = await db_session.get(Subscription, subscriber.id)
        first_end = subscription.end_date if subscription else None
        assert first_end is not None

        fake_payment = gateway.get_payment(payment_id)
        assert fake_payment is not None
        replay = await api_client.post(f"/api/payments/fake/{payment_id}/complete?token={fake_payment.dev_token}")
        assert replay.status_code == 200
        assert replay.json()["success"] is True

        await db_session.refresh(subscriber)
        subscription = await db_session.get(Subscription, subscriber.id)
        assert subscription.end_date == first_end

    @pytest.mark.asyncio
    async def test_subscription_free_switch_clears_membership(
        self,
        api_client: AsyncClient,
        db_session,
    ):
        subscriber = User(
            google_id=f"subscriber-free-{uuid4().hex}",
            email=f"subscriber-free-{uuid4().hex}@example.com",
            full_name="Subscriber Free Switch",
            role=UserRole.MEMBER,
            account_status=AccountStatus.ACTIVE,
        )
        db_session.add(subscriber)
        await db_session.commit()
        await db_session.refresh(subscriber)
        db_session.add(
            Subscription(user_id=subscriber.id, end_date=datetime.utcnow() + timedelta(days=12))
        )
        await db_session.commit()

        token = AuthService(db_session).create_access_token(subscriber)
        response = await api_client.post(
            "/api/payments/subscription/free",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        assert response.json()["status"] == "ok"
        assert response.json()["plan_code"] == "free"

        await db_session.refresh(subscriber)
        subscription = await db_session.get(Subscription, subscriber.id)
        assert subscription is None or subscription.end_date is None
        assert subscriber.role == UserRole.GUEST
