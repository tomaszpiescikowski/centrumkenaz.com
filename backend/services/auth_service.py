import httpx
import re
import secrets
from datetime import datetime, timedelta
from urllib.parse import urlencode
from jose import jwt, JWTError
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import String, cast, func, select
from sqlalchemy.orm import joinedload
from sqlalchemy.exc import IntegrityError

from config import get_settings
from models.user import User, UserRole, AccountStatus

settings = get_settings()


def _get_admin_emails() -> set[str]:
    """Build the set of admin emails from configuration."""
    email = settings.root_admin_email.strip().lower()
    return {email} if email else set()

PASSWORD_CONTEXT = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
_DUMMY_PASSWORD_HASH = PASSWORD_CONTEXT.hash("kenaz-never-used-dummy-password")
USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9._-]+$")


class AuthConflictError(ValueError):
    """Raised when account data conflicts with an existing user."""


class AuthValidationError(ValueError):
    """Raised when auth payload is invalid before persistence."""


class AuthPolicyError(ValueError):
    """Raised when a security policy blocks a given auth flow."""


class AuthService:
    """Service for authentication operations."""

    GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
    GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

    def __init__(self, db: AsyncSession):
        """
        Initialize the auth service with a database session.

        The session is reused for user lookup, creation, and token persistence
        within authentication flows.
        """
        self.db = db

    @staticmethod
    def _normalize_email(email: str) -> str:
        """
        Normalize an email address for consistent matching.

        The value is lowercased and trimmed to avoid duplicate accounts that
        differ only by casing or whitespace.
        """
        return str(email or "").strip().lower()

    @staticmethod
    def _normalize_username(username: str) -> str:
        """
        Normalize a username for consistent matching.

        The value is lowercased and trimmed to keep comparisons stable across
        authentication flows.
        """
        return str(username or "").strip().lower()

    @staticmethod
    def _normalize_full_name(full_name: str) -> str:
        """
        Normalize a full name for storage and display.

        The method collapses repeated whitespace and trims the result.
        """
        return " ".join(str(full_name or "").split()).strip()

    async def generate_username_from_email(self, email: str) -> str:
        """
        Derive a unique username from an email address.

        Takes the local part (before @), strips characters not allowed in
        usernames, truncates to 28 chars, and appends a numeric suffix (e.g.
        _2, _3) if the base candidate is already taken.
        """
        local = (email.split("@")[0] if "@" in email else email).lower()
        cleaned = re.sub(pattern=r"[^A-Za-z0-9._-]", repl=".", string=local)
        cleaned = re.sub(pattern=r"[._-]{2,}", repl=".", string=cleaned).strip("._-")
        candidate = cleaned[:28] or "user"
        if len(candidate) < 3:
            candidate = candidate + "user"

        result = await self.get_user_by_username(candidate)
        if result is None:
            return candidate
        for suffix in range(2, 9999):
            attempt = f"{candidate[:27]}_{suffix}"
            if await self.get_user_by_username(attempt) is None:
                return attempt
        # Extreme fallback: add a random hex fragment
        random_suffix = secrets.token_hex(4)
        return f"{candidate[:20]}_{random_suffix}"

    @staticmethod
    def _resolve_role_and_status(email: str) -> tuple[UserRole, AccountStatus]:
        """
        Resolve the initial role and account status based on the email.

        Admin emails are auto-approved and assigned the admin role, while other
        users default to guest and pending status.
        """
        is_admin = email.lower() in _get_admin_emails()
        role = UserRole.ADMIN if is_admin else UserRole.GUEST
        status = AccountStatus.ACTIVE if is_admin else AccountStatus.PENDING
        return role, status

    async def get_google_auth_url(self, state: str | None = None) -> str:
        """
        Generate the Google OAuth authorization URL.

        The method validates required settings and constructs the URL with the
        requested scopes, optional state, and consent settings.
        """
        if not settings.google_client_id:
            raise ValueError("GOOGLE_CLIENT_ID is not configured")
        if not settings.google_redirect_uri:
            raise ValueError("GOOGLE_REDIRECT_URI is not configured")

        params = {
            "client_id": settings.google_client_id,
            "redirect_uri": settings.google_redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "access_type": "offline",
            "prompt": "consent",
        }
        if state:
            params["state"] = state

        query = urlencode(params)
        return f"https://accounts.google.com/o/oauth2/v2/auth?{query}"

    async def get_google_calendar_auth_url(self, user_id: str) -> str:
        """
        Generate the Google OAuth URL for incrementally requesting calendar access.

        This is a separate flow from the main login — the user is already
        authenticated.  We embed ``user_id`` in the ``state`` parameter
        (prefix ``cc:``) so that the shared callback can route the code
        exchange to the correct user record without a full login.
        """
        if not settings.google_client_id:
            raise ValueError("GOOGLE_CLIENT_ID is not configured")
        if not settings.google_redirect_uri:
            raise ValueError("GOOGLE_REDIRECT_URI is not configured")

        params = {
            "client_id": settings.google_client_id,
            "redirect_uri": settings.google_redirect_uri,
            "response_type": "code",
            "scope": "openid email profile https://www.googleapis.com/auth/calendar.events",
            "access_type": "offline",
            "prompt": "consent",
            "state": f"cc:{user_id}",
        }
        query = urlencode(params)
        return f"https://accounts.google.com/o/oauth2/v2/auth?{query}"

    async def exchange_code_for_tokens(self, code: str) -> dict:
        """
        Exchange an authorization code for Google OAuth tokens.

        The method calls Google's token endpoint and returns the parsed JSON
        response or raises for HTTP errors.
        """
        if not settings.google_client_id:
            raise ValueError("GOOGLE_CLIENT_ID is not configured")
        if not settings.google_client_secret:
            raise ValueError("GOOGLE_CLIENT_SECRET is not configured")
        if not settings.google_redirect_uri:
            raise ValueError("GOOGLE_REDIRECT_URI is not configured")

        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.GOOGLE_TOKEN_URL,
                data={
                    "client_id": settings.google_client_id,
                    "client_secret": settings.google_client_secret,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": settings.google_redirect_uri,
                },
            )
            response.raise_for_status()
            return response.json()

    async def get_google_user_info(self, access_token: str) -> dict:
        """
        Fetch Google user profile information for the given access token.

        The call is made to the Google userinfo endpoint and returns the JSON
        payload on success.
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                self.GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            response.raise_for_status()
            return response.json()

    async def get_or_create_user(self, google_user_info: dict) -> User:
        """
        Get an existing user or create one from Google user info.

        The method links accounts by Google ID or email, enforces admin policies,
        and persists profile updates or new user creation.
        """
        google_id = str(google_user_info["id"]).strip()
        email = self._normalize_email(str(google_user_info["email"]))
        full_name = self._normalize_full_name(google_user_info.get("name", ""))
        picture_url = google_user_info.get("picture")
        role, status = self._resolve_role_and_status(email)

        user = await self.get_user_by_google_id(google_id)
        if not user:
            user = await self.get_user_by_email(email)

        if user:
            if user.google_id and user.google_id != google_id:
                raise AuthConflictError("Account is already linked with another Google identity")
            if (
                role == UserRole.ADMIN
                and user.google_id is None
                and (user.password_hash or user.username)
            ):
                raise AuthPolicyError("This admin email must sign in with Google only")
            user.google_id = google_id
            user.email = email
            user.full_name = full_name or user.full_name
            user.picture_url = picture_url
            if role == UserRole.ADMIN:
                user.role = UserRole.ADMIN
                user.account_status = AccountStatus.ACTIVE
            try:
                await self.db.commit()
            except IntegrityError as exc:
                await self.db.rollback()
                raise AuthConflictError("Account conflict detected while linking Google profile") from exc
            await self.db.refresh(user)
            return user

        user = User(
            google_id=google_id,
            email=email,
            full_name=full_name or email,
            picture_url=picture_url,
            role=role,
            account_status=status,
        )
        self.db.add(user)
        try:
            await self.db.commit()
        except IntegrityError as exc:
            await self.db.rollback()
            raise AuthConflictError("Account conflict detected while creating Google account") from exc
        await self.db.refresh(user)
        return user

    async def update_google_tokens(self, user: User, tokens: dict) -> None:
        """
        Update stored Google refresh tokens and scopes for the user.

        The method only commits when refresh token or scope values change.
        """
        refresh_token = tokens.get("refresh_token")
        scopes = tokens.get("scope")

        changed = False
        if refresh_token:
            user.google_refresh_token = refresh_token
            changed = True
        if scopes:
            user.google_scopes = scopes
            changed = True

        if changed:
            self.db.add(user)
            await self.db.commit()
            await self.db.refresh(user)

    async def get_user_by_google_id(self, google_id: str) -> User | None:
        """
        Look up a user by Google identity ID.

        The query eagerly loads related profile, subscription, approval request,
        and payment method data for downstream access.
        """
        normalized = str(google_id or "").strip()
        if not normalized:
            return None
        stmt = (
            select(User)
            .options(
                joinedload(User.profile),
                joinedload(User.subscription),
                joinedload(User.approval_request),
                joinedload(User.payment_method),
            )
            .where(User.google_id == normalized)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_user_by_id(self, user_id: str) -> User | None:
        """
        Look up a user by ID with legacy compatibility.

        The query casts the ID to string for deployments where integer primary
        keys are still used while tokens carry string identifiers.
        """
        normalized = str(user_id or "").strip()
        if not normalized:
            return None
        stmt = (
            select(User)
            .options(
                joinedload(User.profile),
                joinedload(User.subscription),
                joinedload(User.approval_request),
                joinedload(User.payment_method),
            )
            .where(cast(User.id, String) == normalized)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_user_by_email(self, email: str) -> User | None:
        """
        Look up a user by email address.

        The email is normalized and the query eagerly loads related user data
        needed by authentication flows.
        """
        normalized = self._normalize_email(email)
        if not normalized:
            return None
        stmt = (
            select(User)
            .options(
                joinedload(User.profile),
                joinedload(User.subscription),
                joinedload(User.approval_request),
                joinedload(User.payment_method),
            )
            .where(func.lower(User.email) == normalized)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_user_by_username(self, username: str) -> User | None:
        """
        Look up a user by username.

        The username is normalized and the query eagerly loads related data to
        avoid lazy-loading issues in async contexts.
        """
        normalized = self._normalize_username(username)
        if not normalized:
            return None
        stmt = (
            select(User)
            .options(
                joinedload(User.profile),
                joinedload(User.subscription),
                joinedload(User.approval_request),
                joinedload(User.payment_method),
            )
            .where(func.lower(User.username) == normalized)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    def hash_password(self, password: str) -> str:
        """
        Hash a plain-text password using the configured context.

        The password is hashed with the application's current hashing scheme
        before being stored on the user model.
        """
        return PASSWORD_CONTEXT.hash(password)

    def verify_password(self, plain_password: str, password_hash: str | None) -> bool:
        """
        Verify a plain-text password against a stored hash.

        The method returns False when the hash is missing or verification fails.
        """
        if not password_hash:
            return False
        try:
            return PASSWORD_CONTEXT.verify(plain_password, password_hash)
        except Exception:
            return False

    def _burn_password_check(self, candidate_password: str) -> None:
        """
        Perform a dummy password check to reduce timing leaks.

        This slows down invalid-login paths without revealing whether a user
        exists, helping mitigate user enumeration.
        """
        try:
            PASSWORD_CONTEXT.verify(candidate_password or "", _DUMMY_PASSWORD_HASH)
        except Exception:
            pass

    async def register_with_password(
        self,
        *,
        username: str,
        email: str,
        full_name: str,
        password: str,
    ) -> User:
        """
        Register a user using username, email, and password.

        The method validates identifiers, enforces policy rules, checks for
        conflicts, and persists a pending user on success.
        """
        normalized_username = self._normalize_username(username)
        normalized_email = self._normalize_email(email)
        normalized_full_name = self._normalize_full_name(full_name)

        if not normalized_username:
            raise AuthValidationError("Username must not be empty")
        if len(normalized_username) < 3:
            raise AuthValidationError("Username must have at least 3 characters")
        if len(normalized_username) > 32:
            raise AuthValidationError("Username must have at most 32 characters")
        if not USERNAME_PATTERN.fullmatch(normalized_username):
            raise AuthValidationError("Username may contain only letters, numbers, dots, dashes and underscores")
        if not normalized_email:
            raise AuthValidationError("Email must not be empty")
        if len(normalized_email) > 255:
            raise AuthValidationError("Email must have at most 255 characters")
        if not normalized_full_name:
            raise AuthValidationError("Full name must not be empty")
        if len(normalized_full_name) > 255:
            raise AuthValidationError("Full name must have at most 255 characters")
        if len(password) < 8:
            raise AuthValidationError("Password must have at least 8 characters")
        if len(password) > 128:
            raise AuthValidationError("Password must have at most 128 characters")
        if normalized_email in _get_admin_emails():
            raise AuthPolicyError("This admin email must sign in with Google only")

        existing_by_username = await self.get_user_by_username(normalized_username)
        if existing_by_username:
            raise AuthConflictError("Username is already taken")

        existing_by_email = await self.get_user_by_email(normalized_email)
        if existing_by_email:
            raise AuthConflictError("Email is already taken")

        user = User(
            google_id=None,
            username=normalized_username,
            email=normalized_email,
            full_name=normalized_full_name,
            role=UserRole.GUEST,
            account_status=AccountStatus.PENDING,
            password_hash=self.hash_password(password),
        )
        self.db.add(user)
        try:
            await self.db.commit()
        except IntegrityError as exc:
            await self.db.rollback()
            detail = str(getattr(exc, "orig", exc)).lower()
            if "username" in detail:
                raise AuthConflictError("Username is already taken") from exc
            if "email" in detail:
                raise AuthConflictError("Email is already taken") from exc
            raise AuthConflictError("Account conflict detected while creating user") from exc
        await self.db.refresh(user)
        return user

    async def authenticate_with_password(self, login: str, password: str) -> User | None:
        """
        Authenticate a user by username/email and password.

        The method normalizes the login identifier, performs a dummy hash check
        when missing, and returns the user only on valid credentials.
        """
        identifier = self._normalize_username(login)
        if not identifier:
            self._burn_password_check(password)
            return None

        if "@" in identifier:
            user = await self.get_user_by_email(identifier)
        else:
            user = await self.get_user_by_username(identifier)
            if not user:
                user = await self.get_user_by_email(identifier)

        if not user or not user.password_hash:
            self._burn_password_check(password)
            return None
        if not self.verify_password(password, user.password_hash):
            return None
        return user

    def create_access_token(self, user: User) -> str:
        """
        Create a JWT access token for the user.

        The token includes standard claims plus role and status metadata used
        by downstream authorization checks.
        """
        expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
        payload = {
            "sub": str(user.id),
            "email": user.email,
            "name": user.full_name,
            "role": user.role.value,
            "status": user.account_status.value,
            "exp": expire,
            "type": "access",
        }
        return jwt.encode(claims=payload, key=settings.jwt_secret_key, algorithm=settings.jwt_algorithm)

    def create_refresh_token(self, user: User) -> str:
        """
        Create a JWT refresh token for the user.

        The token includes a refresh type claim and a long-lived expiration.
        """
        expire = datetime.utcnow() + timedelta(days=settings.refresh_token_expire_days)
        payload = {
            "sub": str(user.id),
            "exp": expire,
            "type": "refresh",
        }
        return jwt.encode(claims=payload, key=settings.jwt_secret_key, algorithm=settings.jwt_algorithm)

    def verify_token(self, token: str) -> dict | None:
        """
        Verify and decode a JWT token.

        The method returns the payload on success or None when verification fails.
        """
        try:
            payload = jwt.decode(token=token, key=settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
            return payload
        except JWTError:
            return None

    async def refresh_access_token(self, refresh_token: str) -> tuple[str, str] | None:
        """
        Refresh access and refresh tokens using a refresh token.

        The method validates the token type, loads the user, and returns new
        token values when the refresh token is valid.
        """
        payload = self.verify_token(refresh_token)
        if not payload or payload.get("type") != "refresh":
            return None

        user_id = payload["sub"]
        user = await self.get_user_by_id(user_id)
        if not user:
            return None

        new_access_token = self.create_access_token(user)
        new_refresh_token = self.create_refresh_token(user)

        return new_access_token, new_refresh_token
