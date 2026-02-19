import json
from datetime import datetime
from typing import List, Optional, Literal

from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession

from adapters.fake_payment_adapter import get_shared_fake_payment_adapter
from database import get_db
from models.user import AccountStatus, User
from models.user_profile import UserProfile
from models.approval_request import ApprovalRequest
from models.registration import RegistrationStatus
from routers.auth import get_current_user_dependency
from security.guards import get_active_user_dependency
from services.payment_service import PaymentService
from services.registration_service import RegistrationService
from utils.legacy_ids import legacy_id_eq

router = APIRouter(prefix="/users", tags=["users"])

InterestTag = Literal["karate", "mors", "planszowki", "ognisko", "spacer", "joga", "wyjazd", "inne"]
ALLOWED_INTEREST_TAGS = {"karate", "mors", "planszowki", "ognisko", "spacer", "joga", "wyjazd", "inne"}


class EventSummary(BaseModel):
    """
    Summarize an event within a user registration payload.

    This model exposes a compact snapshot of event data required by the
    "my registrations" screen, including pricing and policy settings.
    """
    model_config = ConfigDict(coerce_numbers_to_str=True)

    id: str = Field(description="Event identifier.")
    title: str = Field(description="Event title for display.")
    start_date: str = Field(description="Start datetime for the occurrence.")
    end_date: str | None = Field(default=None, description="End datetime if provided.")
    time_info: str | None = Field(default=None, description="Free-form time window label.")
    city: str = Field(description="City name for display.")
    location: str | None = Field(default=None, description="Optional venue or location string.")
    price_guest: str = Field(description="Price for non-subscribers.")
    price_member: str = Field(description="Price for subscribers.")
    manual_payment_verification: bool = Field(description="Whether manual payment flow is enabled.")
    manual_payment_url: str | None = Field(
        default=None,
        description="Manual transfer instructions URL.",
    )
    manual_payment_due_hours: int = Field(description="Hours allowed to confirm manual payment.")
    requires_subscription: bool = Field(description="Whether active subscription is required.")
    cancel_cutoff_hours: int = Field(description="Hours before start when cancellation is allowed.")
    points_value: int = Field(description="Points awarded for attendance.")


class UserRegistrationResponse(BaseModel):
    """
    Describe a user's registration and cancellation eligibility.

    This response bundles the registration status, event summary, and any
    manual payment or rescue-related metadata for the UI.
    """
    model_config = ConfigDict(coerce_numbers_to_str=True)

    registration_id: str = Field(description="Registration identifier.")
    status: str = Field(description="Current registration status.")
    occurrence_date: str = Field(description="Date of the registered occurrence.")
    event: EventSummary = Field(description="Summary of the registered event.")
    can_cancel: bool = Field(description="Whether cancellation is currently allowed.")
    cancel_cutoff_hours: int = Field(description="Cancellation cutoff in hours.")
    manual_payment_transfer_reference: str | None = Field(
        default=None,
        description="Transfer reference for manual payment.",
    )
    payment_deadline: str | None = Field(
        default=None,
        description="Deadline for manual payment confirmation.",
    )
    promoted_from_waitlist: bool = Field(
        default=False,
        description="Whether user was promoted from waitlist.",
    )
    can_confirm_manual_payment: bool = Field(
        default=False,
        description="Whether manual payment confirmation is allowed now.",
    )


class UserProfileResponse(BaseModel):
    """
    Describe a public-facing user profile.

    This response includes display fields that can be shown to other users
    without exposing authentication details.
    """
    model_config = ConfigDict(coerce_numbers_to_str=True)

    id: str = Field(description="User identifier.")
    full_name: str = Field(description="Display name shown in the UI.")
    picture_url: str | None = Field(default=None, description="Optional profile image URL.")
    about_me: str | None = Field(default=None, description="Short biography or description.")
    interest_tags: list[InterestTag] = Field(
        default_factory=list,
        description="List of selected interest tags.",
    )


class UserProfileUpdateRequest(BaseModel):
    """
    Update the authenticated user's profile fields.

    This payload allows editing of biography and interest tags with length
    limits enforced for consistency and safety.
    """

    about_me: str | None = Field(
        default=None,
        max_length=800,
        description="Short biography displayed on the profile.",
    )
    interest_tags: list[InterestTag] = Field(
        default_factory=list,
        max_length=8,
        description="Selected interest tags for discovery and matching.",
    )


class JoinRequestPayload(BaseModel):
    """
    Submit a join request from a pending account.

    This payload captures minimum profile details required for admin review
    before activating the account.
    """

    about_me: str = Field(
        min_length=1,
        max_length=800,
        description="Required biography for approval review.",
    )
    interest_tags: list[InterestTag] = Field(
        min_length=1,
        max_length=8,
        description="At least one interest tag to describe preferences.",
    )


def get_payment_gateway():
    return get_shared_fake_payment_adapter()


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


def _serialize_interest_tags(tags: list[str]) -> str:
    seen = set()
    normalized: list[str] = []
    for item in tags:
        value = str(item).strip()
        if not value or value in seen:
            continue
        seen.add(value)
        normalized.append(value)
    return json.dumps(normalized)


@router.get("/me/profile", response_model=UserProfileResponse)
async def get_my_profile(
    user: User = Depends(get_active_user_dependency),
    db: AsyncSession = Depends(get_db),
) -> UserProfileResponse:
    """
    Return the authenticated user's profile details.

    The handler fetches the profile row if present and falls back to base user
    fields, normalizing interest tags for the response payload.
    """
    profile = await db.get(UserProfile, user.id)
    return UserProfileResponse(
        id=user.id,
        full_name=user.full_name,
        picture_url=user.picture_url,
        about_me=profile.about_me if profile else None,
        interest_tags=_parse_interest_tags(profile.interest_tags if profile else None),
    )


@router.post("/me/join-request", response_model=UserProfileResponse)
async def submit_join_request(
    payload: JoinRequestPayload,
    user: User = Depends(get_current_user_dependency),
    db: AsyncSession = Depends(get_db),
) -> UserProfileResponse:
    """
    Submit a join request for a pending user account.

    This endpoint validates the account state, stores the provided profile data,
    creates an approval request record, and returns the updated profile snapshot.
    """
    if user.account_status != AccountStatus.PENDING:
        raise HTTPException(status_code=409, detail="Join request is allowed only for pending accounts")

    normalized_about = payload.about_me.strip()
    if not normalized_about:
        raise HTTPException(status_code=422, detail="about_me must not be empty")

    profile = await db.get(UserProfile, user.id)
    if not profile:
        profile = UserProfile(user_id=user.id, is_test_data=bool(user.is_test_data))
    profile.about_me = normalized_about
    profile.interest_tags = _serialize_interest_tags(payload.interest_tags)

    approval_request = await db.get(ApprovalRequest, user.id)
    if not approval_request:
        approval_request = ApprovalRequest(user_id=user.id, is_test_data=bool(user.is_test_data))

    db.add(profile)
    db.add(approval_request)
    await db.commit()
    await db.refresh(user)
    await db.refresh(profile)

    return UserProfileResponse(
        id=user.id,
        full_name=user.full_name,
        picture_url=user.picture_url,
        about_me=profile.about_me,
        interest_tags=_parse_interest_tags(profile.interest_tags),
    )


@router.put("/me/profile", response_model=UserProfileResponse)
async def update_my_profile(
    payload: UserProfileUpdateRequest,
    user: User = Depends(get_active_user_dependency),
    db: AsyncSession = Depends(get_db),
) -> UserProfileResponse:
    """
    Update the authenticated user's profile fields.

    The handler creates a profile row if needed, trims input fields, persists
    interest tags, and returns the refreshed profile response.
    """
    profile = await db.get(UserProfile, user.id)
    if not profile:
        profile = UserProfile(user_id=user.id, is_test_data=bool(user.is_test_data))
    profile.about_me = (payload.about_me or "").strip() or None
    profile.interest_tags = _serialize_interest_tags(payload.interest_tags)

    db.add(profile)
    await db.commit()
    await db.refresh(profile)

    return UserProfileResponse(
        id=user.id,
        full_name=user.full_name,
        picture_url=user.picture_url,
        about_me=profile.about_me,
        interest_tags=_parse_interest_tags(profile.interest_tags),
    )


@router.get("/{user_id}/profile", response_model=UserProfileResponse)
async def get_user_profile(
    user_id: str = Path(..., min_length=1),
    _user: User = Depends(get_active_user_dependency),
    db: AsyncSession = Depends(get_db),
) -> UserProfileResponse:
    """
    Return a public profile for an active user.

    The query loads the user and profile in one call, only exposes active users,
    and returns 404 when the profile is not visible.
    """
    result = await db.execute(
        select(User)
        .options(joinedload(User.profile))
        .where(
            legacy_id_eq(User.id, user_id),
            User.account_status == AccountStatus.ACTIVE.value,
        )
    )
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    return UserProfileResponse(
        id=target.id,
        full_name=target.full_name,
        picture_url=target.picture_url,
        about_me=target.profile.about_me if target.profile else None,
        interest_tags=_parse_interest_tags(target.profile.interest_tags if target.profile else None),
    )


@router.get("/me/registrations", response_model=list[UserRegistrationResponse])
async def get_my_registrations(
    user: User = Depends(get_active_user_dependency),
    db: AsyncSession = Depends(get_db),
) -> list[UserRegistrationResponse]:
    """
    Return the authenticated user's registrations with cancellation metadata.

    This endpoint uses the registration service to enrich each registration with
    event summaries, cutoff rules, and manual payment details for the UI.
    """
    payment_gateway = get_payment_gateway()
    payment_service = PaymentService(db, payment_gateway)
    registration_service = RegistrationService(db, payment_service)

    registrations = await registration_service.get_user_registrations(user.id)

    now = datetime.utcnow()
    response: list[UserRegistrationResponse] = []
    for reg in registrations:
        event = reg.event
        occurrence_start, occurrence_end = registration_service.get_occurrence_datetimes(
            event,
            reg.occurrence_date,
        )
        event_now = datetime.now(occurrence_start.tzinfo) if occurrence_start.tzinfo else now
        info = await registration_service.get_cancellation_info(
            user,
            event,
            event_now,
            occurrence_start=occurrence_start,
        )

        response.append(
            UserRegistrationResponse(
                registration_id=reg.id,
                status=reg.status,
                occurrence_date=reg.occurrence_date.isoformat(),
                event=EventSummary(
                    id=event.id,
                    title=event.title,
                    start_date=occurrence_start.isoformat(),
                    end_date=occurrence_end.isoformat() if occurrence_end else None,
                    time_info=event.time_info,
                    city=event.city,
                    location=event.location,
                    price_guest=str(event.price_guest),
                    price_member=str(event.price_member),
                    manual_payment_verification=bool(event.manual_payment_verification),
                    manual_payment_url=event.manual_payment_url,
                    manual_payment_due_hours=int(event.manual_payment_due_hours or 24),
                    requires_subscription=event.requires_subscription,
                    cancel_cutoff_hours=event.cancel_cutoff_hours or 24,
                    points_value=event.points_value or 0,
                ),
                can_cancel=info["can_cancel"],
                cancel_cutoff_hours=info["cancel_cutoff_hours"],
                manual_payment_transfer_reference=(
                    event.id if event.manual_payment_verification else None
                ),
                payment_deadline=(
                    reg.manual_payment_due_at.isoformat()
                    if reg.manual_payment_due_at
                    else None
                ),
                promoted_from_waitlist=bool(reg.promoted_from_waitlist_at),
                can_confirm_manual_payment=(
                    reg.status == RegistrationStatus.MANUAL_PAYMENT_REQUIRED.value
                    and bool(event.manual_payment_verification)
                ),
            )
        )

    return response
