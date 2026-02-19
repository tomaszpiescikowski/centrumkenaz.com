from datetime import datetime
from uuid import uuid4

import pytest

from models.user import AccountStatus, User, UserRole
from services.auth_service import (
    AuthConflictError,
    AuthPolicyError,
    AuthService,
    AuthValidationError,
    settings,
)


class TestAuthServiceGoogleAuthUrl:
    @pytest.mark.asyncio
    async def test_get_google_auth_url_success(self, db_session, monkeypatch):
        monkeypatch.setattr(settings, "google_client_id", "client-id", raising=False)
        monkeypatch.setattr(
            settings,
            "google_redirect_uri",
            "http://localhost:8000/auth/google/callback",
            raising=False,
        )

        service = AuthService(db_session)
        url = await service.get_google_auth_url(state="abc")

        assert "accounts.google.com/o/oauth2/v2/auth" in url
        assert "client_id=client-id" in url
        assert "state=abc" in url

    @pytest.mark.asyncio
    async def test_get_google_auth_url_missing_client_id_raises(self, db_session, monkeypatch):
        monkeypatch.setattr(settings, "google_client_id", None, raising=False)

        service = AuthService(db_session)

        with pytest.raises(ValueError, match="GOOGLE_CLIENT_ID"):
            await service.get_google_auth_url()


class TestAuthServiceUsers:
    @pytest.mark.asyncio
    async def test_get_or_create_user_creates_pending_guest(self, db_session):
        service = AuthService(db_session)
        suffix = uuid4().hex

        user = await service.get_or_create_user(
            {
                "id": f"gid-{suffix}",
                "email": f"guest-{suffix}@example.com",
                "name": "Guest User",
                "picture": "https://example.com/pic.png",
            }
        )

        assert user.role == UserRole.GUEST
        assert user.account_status == AccountStatus.PENDING
        assert user.picture_url == "https://example.com/pic.png"

    @pytest.mark.asyncio
    async def test_get_or_create_user_promotes_admin_by_email(self, db_session):
        service = AuthService(db_session)

        user = await service.get_or_create_user(
            {
                "id": f"gid-admin-{uuid4().hex}",
                "email": "tomek.piescikowski@gmail.com",
                "name": "Admin",
            }
        )

        assert user.role == UserRole.ADMIN
        assert user.account_status == AccountStatus.ACTIVE

    @pytest.mark.asyncio
    async def test_get_or_create_user_updates_existing(self, db_session):
        service = AuthService(db_session)
        suffix = uuid4().hex

        existing = User(
            google_id=f"existing-{suffix}",
            email=f"old-{suffix}@example.com",
            full_name="Old Name",
            role=UserRole.GUEST,
            account_status=AccountStatus.PENDING,
        )
        db_session.add(existing)
        await db_session.commit()
        await db_session.refresh(existing)

        updated = await service.get_or_create_user(
            {
                "id": existing.google_id,
                "email": "tomek.piescikowski@gmail.com",
                "name": "New Name",
                "picture": "https://example.com/new.png",
            }
        )

        assert updated.id == existing.id
        assert updated.full_name == "New Name"
        assert updated.picture_url == "https://example.com/new.png"
        assert updated.role == UserRole.ADMIN
        assert updated.account_status == AccountStatus.ACTIVE

    @pytest.mark.asyncio
    async def test_get_or_create_user_links_existing_password_account_by_email(self, db_session):
        service = AuthService(db_session)
        suffix = uuid4().hex
        seeded = User(
            username=f"user-{suffix}",
            email=f"merge-{suffix}@example.com",
            full_name="Local Account",
            role=UserRole.GUEST,
            account_status=AccountStatus.PENDING,
            password_hash=service.hash_password("VeryStrong#123"),
        )
        db_session.add(seeded)
        await db_session.commit()
        await db_session.refresh(seeded)

        linked = await service.get_or_create_user(
            {
                "id": f"gid-link-{suffix}",
                "email": seeded.email.upper(),
                "name": "Google Name",
                "picture": "https://example.com/google.png",
            }
        )

        assert linked.id == seeded.id
        assert linked.google_id == f"gid-link-{suffix}"
        assert linked.email == seeded.email
        assert linked.full_name == "Google Name"
        assert linked.picture_url == "https://example.com/google.png"

    @pytest.mark.asyncio
    async def test_get_or_create_user_rejects_admin_email_preclaimed_by_local_account(self, db_session):
        service = AuthService(db_session)
        seeded = User(
            username=f"local-admin-{uuid4().hex[:12]}",
            email="tomek.piescikowski@gmail.com",
            full_name="Preclaimed Admin",
            role=UserRole.GUEST,
            account_status=AccountStatus.PENDING,
            password_hash=service.hash_password("StrongPass#123"),
        )
        db_session.add(seeded)
        await db_session.commit()

        with pytest.raises(AuthPolicyError, match="must sign in with Google only"):
            await service.get_or_create_user(
                {
                    "id": f"gid-admin-{uuid4().hex}",
                    "email": "tomek.piescikowski@gmail.com",
                    "name": "Real Admin",
                }
            )

    @pytest.mark.asyncio
    async def test_update_google_tokens_updates_only_provided_values(self, db_session):
        service = AuthService(db_session)
        suffix = uuid4().hex

        user = User(
            google_id=f"gt-{suffix}",
            email=f"tokens-{suffix}@example.com",
            full_name="Token User",
            role=UserRole.GUEST,
            account_status=AccountStatus.ACTIVE,
            google_refresh_token="old-refresh",
            google_scopes="old-scope",
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        await service.update_google_tokens(user, {"scope": "new-scope"})

        assert user.google_refresh_token == "old-refresh"
        assert user.google_scopes == "new-scope"


class TestAuthServicePasswordAuth:
    @pytest.mark.asyncio
    async def test_register_with_password_creates_pending_guest(self, db_session):
        service = AuthService(db_session)
        suffix = uuid4().hex[:12]

        user = await service.register_with_password(
            username=f"tester-{suffix}",
            email=f"tester-{suffix}@example.com",
            full_name="  Test User  ",
            password="StrongPass#123",
        )

        assert user.username == f"tester-{suffix}"
        assert user.email == f"tester-{suffix}@example.com"
        assert user.full_name == "Test User"
        assert user.role == UserRole.GUEST
        assert user.account_status == AccountStatus.PENDING
        assert user.password_hash != "StrongPass#123"
        assert service.verify_password("StrongPass#123", user.password_hash) is True

    @pytest.mark.asyncio
    async def test_register_with_password_rejects_allowlisted_admin_email(self, db_session):
        service = AuthService(db_session)

        with pytest.raises(AuthPolicyError, match="must sign in with Google only"):
            await service.register_with_password(
                username=f"admin-{uuid4().hex[:12]}",
                email="tomek.piescikowski@gmail.com",
                full_name="Admin User",
                password="StrongPass#123",
            )

    @pytest.mark.asyncio
    async def test_register_with_password_rejects_duplicate_username(self, db_session):
        service = AuthService(db_session)
        suffix = uuid4().hex[:12]
        existing = User(
            username=f"dup-{suffix}",
            email=f"dup-existing-{suffix}@example.com",
            full_name="Existing",
            role=UserRole.GUEST,
            account_status=AccountStatus.PENDING,
            password_hash=service.hash_password("StrongPass#123"),
        )
        db_session.add(existing)
        await db_session.commit()

        with pytest.raises(AuthConflictError, match="Username is already taken"):
            await service.register_with_password(
                username=f"dup-{suffix}",
                email=f"fresh-{suffix}@example.com",
                full_name="Fresh",
                password="StrongPass#123",
            )

    @pytest.mark.asyncio
    async def test_register_with_password_rejects_short_password(self, db_session):
        service = AuthService(db_session)

        with pytest.raises(AuthValidationError, match="at least 8 characters"):
            await service.register_with_password(
                username=f"mini-{uuid4().hex[:12]}",
                email=f"mini-{uuid4().hex}@example.com",
                full_name="Mini",
                password="short",
            )

    @pytest.mark.asyncio
    async def test_authenticate_with_password_by_username(self, db_session):
        service = AuthService(db_session)
        suffix = uuid4().hex
        user = User(
            username=f"user-{suffix}",
            email=f"user-{suffix}@example.com",
            full_name="Password User",
            role=UserRole.MEMBER,
            account_status=AccountStatus.ACTIVE,
            password_hash=service.hash_password("StrongPass#123"),
        )
        db_session.add(user)
        await db_session.commit()

        authenticated = await service.authenticate_with_password(user.username.upper(), "StrongPass#123")
        assert authenticated is not None
        assert authenticated.id == user.id

    @pytest.mark.asyncio
    async def test_authenticate_with_password_rejects_invalid_secret(self, db_session):
        service = AuthService(db_session)
        suffix = uuid4().hex
        user = User(
            username=f"user-{suffix}",
            email=f"user-{suffix}@example.com",
            full_name="Password User",
            role=UserRole.MEMBER,
            account_status=AccountStatus.ACTIVE,
            password_hash=service.hash_password("StrongPass#123"),
        )
        db_session.add(user)
        await db_session.commit()

        authenticated = await service.authenticate_with_password(user.email, "wrong-pass")
        assert authenticated is None


class TestAuthServiceTokens:
    @pytest.mark.asyncio
    async def test_refresh_access_token_returns_none_for_invalid_type(self, db_session):
        service = AuthService(db_session)

        result = await service.refresh_access_token("not-a-valid-token")

        assert result is None

    @pytest.mark.asyncio
    async def test_refresh_access_token_returns_none_for_missing_user(self, db_session):
        service = AuthService(db_session)
        payload_token = service.create_refresh_token(
            User(
                id="00000000-0000-0000-0000-000000999999",
                google_id="fake",
                email="fake@example.com",
                full_name="Fake",
                role=UserRole.GUEST,
                account_status=AccountStatus.ACTIVE,
            )
        )

        result = await service.refresh_access_token(payload_token)

        assert result is None

    @pytest.mark.asyncio
    async def test_refresh_access_token_success(self, db_session):
        service = AuthService(db_session)
        suffix = uuid4().hex

        user = User(
            google_id=f"tok-{suffix}",
            email=f"tok-{suffix}@example.com",
            full_name="Token User",
            role=UserRole.MEMBER,
            account_status=AccountStatus.ACTIVE,
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        refresh = service.create_refresh_token(user)
        tokens = await service.refresh_access_token(refresh)

        assert tokens is not None
        access, new_refresh = tokens
        assert service.verify_token(access)["type"] == "access"
        assert service.verify_token(new_refresh)["type"] == "refresh"

    def test_verify_token_returns_none_for_invalid_token(self, db_session):
        service = AuthService(db_session)

        assert service.verify_token("invalid.token.value") is None


class _CaptureExecuteResult:
    def scalar_one_or_none(self):
        return None


class _CaptureSession:
    def __init__(self):
        self.statement = None

    async def execute(self, statement):
        self.statement = statement
        return _CaptureExecuteResult()


class TestAuthServiceLegacyIdCompat:
    @pytest.mark.asyncio
    async def test_get_user_by_id_casts_column_to_string_for_legacy_integer_ids(self):
        capture_session = _CaptureSession()
        service = AuthService(capture_session)  # type: ignore[arg-type]

        result = await service.get_user_by_id("333")

        assert result is None
        assert capture_session.statement is not None
        compiled = str(capture_session.statement.compile(compile_kwargs={"literal_binds": True}))
        assert "CAST(users.id AS VARCHAR)" in compiled
        assert "'333'" in compiled
