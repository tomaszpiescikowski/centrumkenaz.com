from fastapi import APIRouter, Depends, HTTPException, Request, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
import json
import logging

from database import get_db
from config import get_settings
from services.auth_service import (
    AuthConflictError,
    AuthPolicyError,
    AuthService,
    AuthValidationError,
)
from security.rate_limit import (
    build_public_rate_limit_dependency,
    enforce_public_ip_rate_limit,
    enforce_rate_limit,
)
from models.payment import Payment, PaymentStatus as DBPaymentStatus, PaymentType
from models.user import User
from models.registration import Registration, RegistrationStatus
from models.event import Event
from models.subscription import Subscription
from models.user_profile import UserProfile
from models.approval_request import ApprovalRequest
from sqlalchemy import String, cast, nullslast, select

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()
logger = logging.getLogger(__name__)
ALLOWED_INTEREST_TAGS = {"karate", "mors", "planszowki", "ognisko", "spacer", "joga", "wyjazd", "inne"}

auth_login_rate_limit = build_public_rate_limit_dependency(
    scope="auth:google-login",
    per_minute_resolver=lambda: settings.rate_limit_public_per_minute,
)
auth_callback_rate_limit = build_public_rate_limit_dependency(
    scope="auth:google-callback",
    per_minute_resolver=lambda: settings.rate_limit_public_per_minute,
)
auth_password_login_rate_limit = build_public_rate_limit_dependency(
    scope="auth:password-login",
    per_minute_resolver=lambda: settings.rate_limit_public_per_minute,
)
auth_password_register_rate_limit = build_public_rate_limit_dependency(
    scope="auth:password-register",
    per_minute_resolver=lambda: settings.rate_limit_public_per_minute,
)

class TokenResponse(BaseModel):
    """
    Return JWT tokens for authenticated sessions.

    This response delivers short-lived access tokens and longer-lived refresh
    tokens used to reissue access without reauthentication.
    """

    access_token: str = Field(description="JWT access token for API requests.")
    refresh_token: str = Field(description="JWT refresh token for session renewal.")
    token_type: str = Field(default="bearer", description="Authorization scheme name.")


class PasswordRegisterRequest(BaseModel):
    """
    Register a new user using username/email and password.

    This payload is validated for username format and minimum password length
    before a pending user account is created.
    """

    username: str = Field(
        min_length=3,
        max_length=32,
        pattern=r"^[A-Za-z0-9._-]+$",
        description="Unique username used for local password login.",
    )
    email: EmailStr = Field(description="User email used for login and contact.")
    full_name: str = Field(
        min_length=1,
        max_length=255,
        description="Display name shown in the application.",
    )
    password: str = Field(
        min_length=8,
        max_length=128,
        description="Plain password to be hashed on the server.",
    )


class PasswordLoginRequest(BaseModel):
    """
    Authenticate a user using username or email and password.

    This payload accepts either login identifier and validates password length
    before issuing tokens on success.
    """

    login: str = Field(
        min_length=3,
        max_length=255,
        description="Username or email used to authenticate.",
    )
    password: str = Field(
        min_length=8,
        max_length=128,
        description="Plain password to verify against stored hash.",
    )


class UserResponse(BaseModel):
    """
    Describe the authenticated user profile and membership state.

    This response combines identity fields with subscription status, interest
    tags, and any next manual payment action for the user.
    """

    id: str = Field(description="User identifier as a string.")
    email: str = Field(description="Primary email address.")
    full_name: str = Field(description="User display name.")
    picture_url: str | None = Field(
        default=None,
        description="Optional avatar image URL.",
    )
    role: str = Field(description="Current authorization role.")
    account_status: str = Field(description="Approval status of the account.")
    subscription_end_date: datetime | None = Field(
        default=None,
        description="End date of active subscription, if any.",
    )
    subscription_plan_code: str | None = Field(
        default=None,
        description="Most recent paid subscription plan code.",
    )
    points: int = Field(default=0, description="Current loyalty points balance.")
    about_me: str | None = Field(
        default=None,
        description="Short profile bio.",
    )
    interest_tags: list[str] = Field(
        default_factory=list,
        description="Normalized list of interest tags.",
    )
    approval_request_submitted: bool = Field(
        default=False,
        description="Whether the user submitted a join request.",
    )
    next_action_manual_payment: dict | None = Field(
        default=None,
        description="Manual payment action info if a waitlist promotion needs confirmation.",
    )
    has_google_calendar: bool = Field(
        default=False,
        description="Whether the user has Google Calendar integration enabled.",
    )

    class Config:
        from_attributes = True


def _coerce_enum_or_string(value: object | None, fallback: str) -> str:
    """Return enum `.value` or string representation with a safe fallback."""
    if value is None:
        return fallback
    enum_value = getattr(value, "value", None)
    if isinstance(enum_value, str) and enum_value.strip():
        return enum_value.strip()
    if isinstance(value, str) and value.strip():
        return value.strip()
    return fallback


def _parse_interest_tags(raw: str | None) -> list[str]:
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except Exception:
        return []
    if not isinstance(parsed, list):
        return []

    tags: list[str] = []
    seen = set()
    for item in parsed:
        value = str(item).strip()
        if not value or value in seen or value not in ALLOWED_INTEREST_TAGS:
            continue
        seen.add(value)
        tags.append(value)
    return tags


async def _get_loaded_relation(db: AsyncSession, user: object, attr: str, model) -> object | None:
    if hasattr(user, "__dict__") and attr in user.__dict__:
        return user.__dict__.get(attr)
    if isinstance(user, User):
        return await db.get(model, user.id)
    return None


@router.get("/google/login", dependencies=[Depends(auth_login_rate_limit)])
async def google_login(db: AsyncSession = Depends(get_db)) -> RedirectResponse:
    """
    Redirect the user to the Google OAuth login page.

    This endpoint delegates to the auth service to construct the authorization
    URL and returns a redirect response or a server error if OAuth is misconfigured.
    """
    auth_service = AuthService(db)
    try:
        auth_url = await auth_service.get_google_auth_url()
    except ValueError as e:
        raise HTTPException(
            status_code=500,
            detail=str(e),
        )
    return RedirectResponse(url=auth_url)


@router.get("/google/callback", dependencies=[Depends(auth_callback_rate_limit)])
async def google_callback(
    code: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
) -> RedirectResponse:
    """
    Handle the Google OAuth callback and issue JWT tokens.

    This endpoint exchanges the authorization code for tokens, creates or updates
    the user, and redirects to the frontend with access and refresh tokens while
    mapping OAuth or policy errors to a dedicated error page.
    """
    auth_service = AuthService(db)

    try:
        tokens = await auth_service.exchange_code_for_tokens(code)
        user_info = await auth_service.get_google_user_info(tokens["access_token"])
        user = await auth_service.get_or_create_user(user_info)
        await auth_service.update_google_tokens(user, tokens)
        access_token = auth_service.create_access_token(user)
        refresh_token = auth_service.create_refresh_token(user)
        redirect_url = f"{settings.frontend_url}/auth/callback?access_token={access_token}&refresh_token={refresh_token}"
        return RedirectResponse(url=redirect_url)

    except (AuthConflictError, AuthPolicyError) as exc:
        error_url = f"{settings.frontend_url}/auth/error?message={str(exc)}"
        return RedirectResponse(url=error_url)
    except Exception:
        logger.exception("Unhandled Google callback error")
        error_url = f"{settings.frontend_url}/auth/error?message=Authentication failed"
        return RedirectResponse(url=error_url)


@router.post(
    "/password/register",
    response_model=TokenResponse,
    dependencies=[Depends(auth_password_register_rate_limit)],
)
async def password_register(
    payload: PasswordRegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """
    Register a new user with password credentials and return JWT tokens.

    The handler enforces policy and validation rules, maps conflicts and policy
    failures to HTTP error codes, and returns access and refresh tokens on success.
    """
    auth_service = AuthService(db)
    try:
        user = await auth_service.register_with_password(
            username=payload.username,
            email=str(payload.email),
            full_name=payload.full_name,
            password=payload.password,
        )
    except AuthPolicyError as exc:
        raise HTTPException(status_code=403, detail=str(exc))
    except AuthConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except AuthValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    return TokenResponse(
        access_token=auth_service.create_access_token(user),
        refresh_token=auth_service.create_refresh_token(user),
    )


@router.post(
    "/password/login",
    response_model=TokenResponse,
    dependencies=[Depends(auth_password_login_rate_limit)],
)
async def password_login(
    payload: PasswordLoginRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """
    Log in using username or email and return JWT tokens.

    Authentication is delegated to the auth service, and invalid credentials
    return a 401 response without revealing which field failed.
    """
    auth_service = AuthService(db)
    user = await auth_service.authenticate_with_password(payload.login, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid login or password")

    return TokenResponse(
        access_token=auth_service.create_access_token(user),
        refresh_token=auth_service.create_refresh_token(user),
    )


@router.post(
    "/refresh",
    response_model=TokenResponse,
)
async def refresh_token(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """
    Refresh the access token using a valid refresh token.

    The handler validates the bearer token, applies rate limiting based on token
    type or IP address, and returns new access and refresh tokens on success.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing refresh token")

    refresh_token = auth_header.split(" ")[1]
    auth_service = AuthService(db)
    payload = auth_service.verify_token(refresh_token)
    if payload and payload.get("type") == "refresh" and payload.get("sub"):
        enforce_rate_limit(
            scope="auth:refresh:user",
            identifier=f"user:{payload['sub']}",
            per_minute=settings.rate_limit_authenticated_per_minute,
        )
    else:
        enforce_public_ip_rate_limit(
            scope="auth:refresh:ip",
            request=request,
            per_minute=settings.rate_limit_public_per_minute,
        )

    result = await auth_service.refresh_access_token(refresh_token)
    if not result:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    new_access_token, new_refresh_token = result

    return TokenResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
    )


@router.get(
    "/me",
    response_model=UserResponse,
)
async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """
    Return the authenticated user profile and subscription context.

    The endpoint validates the access token, enriches the response with plan and
    profile data, and includes any pending manual payment action for the user.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = auth_header.split(" ")[1]
    auth_service = AuthService(db)

    payload = auth_service.verify_token(token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token")

    user = await auth_service.get_user_by_id(payload["sub"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    enforce_rate_limit(
        scope="auth:me:user",
        identifier=f"user:{user.id}",
        per_minute=settings.rate_limit_authenticated_per_minute,
    )

    plan_code: str | None = None
    normalized_user_id = str(user.id)
    payment_result = await db.execute(
        select(Payment.extra_data)
        .where(
            cast(Payment.user_id, String) == normalized_user_id,
            Payment.payment_type == PaymentType.SUBSCRIPTION.value,
            Payment.status == DBPaymentStatus.COMPLETED.value,
        )
        .order_by(
            nullslast(Payment.completed_at.desc()),
            Payment.created_at.desc(),
        )
        .limit(1)
    )
    raw_extra = payment_result.scalar_one_or_none()
    if raw_extra:
        try:
            import json
            extra = json.loads(raw_extra)
            plan_code = str(extra.get("plan_code") or "").strip().lower() or None
        except Exception:
            plan_code = None

    subscription = await _get_loaded_relation(db, user, "subscription", Subscription)
    profile = await _get_loaded_relation(db, user, "profile", UserProfile)
    approval_request = await _get_loaded_relation(db, user, "approval_request", ApprovalRequest)

    subscription_end_date = (
        subscription.end_date if subscription else getattr(user, "subscription_end_date", None)
    )
    points = (
        int(subscription.points or 0) if subscription else int(getattr(user, "points", 0) or 0)
    )
    about_me = profile.about_me if profile else getattr(user, "about_me", None)
    interest_tags_raw = profile.interest_tags if profile else getattr(user, "interest_tags", None)
    approval_submitted = bool(approval_request) or bool(getattr(user, "approval_request_submitted", False))

    response = UserResponse(
        id=str(user.id),
        email=user.email or "",
        full_name=user.full_name or "",
        picture_url=user.picture_url,
        role=_coerce_enum_or_string(user.role, fallback="guest"),
        account_status=_coerce_enum_or_string(user.account_status, fallback="pending"),
        subscription_end_date=subscription_end_date,
        points=points,
    )
    response.subscription_plan_code = plan_code
    response.about_me = about_me
    response.interest_tags = _parse_interest_tags(interest_tags_raw)
    response.approval_request_submitted = approval_submitted
    response.has_google_calendar = bool(
        user.google_refresh_token
        and user.google_scopes
        and "calendar.events" in user.google_scopes
    )

    pending_manual_payment = await db.execute(
        select(
            Registration.id,
            Registration.event_id,
            Registration.occurrence_date,
            Registration.promoted_from_waitlist_at,
            Registration.manual_payment_due_at,
        )
        .join(Event, Registration.event_id == Event.id)
        .where(
            cast(Registration.user_id, String) == normalized_user_id,
            Registration.status == RegistrationStatus.MANUAL_PAYMENT_REQUIRED.value,
            Registration.promoted_from_waitlist_at.is_not(None),
            Event.manual_payment_verification.is_(True),
        )
        .order_by(
            nullslast(Registration.promoted_from_waitlist_at.desc()),
            Registration.created_at.desc(),
        )
        .limit(1)
    )
    manual_row = pending_manual_payment.first()
    if manual_row:
        response.next_action_manual_payment = {
            "registration_id": manual_row[0],
            "event_id": manual_row[1],
            "occurrence_date": manual_row[2].isoformat(),
            "promoted_from_waitlist": manual_row[3] is not None,
            "payment_deadline": manual_row[4].isoformat() if manual_row[4] else None,
        }
    return response


async def get_current_user_dependency(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    """Dependency to get current user from token."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = auth_header.split(" ")[1]
    auth_service = AuthService(db)

    payload = auth_service.verify_token(token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token")

    user = await auth_service.get_user_by_id(payload["sub"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return user
