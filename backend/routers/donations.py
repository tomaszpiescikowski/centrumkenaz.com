"""
Donations router – "Wesprzyj nas" (Support Us) feature.

Public:
  GET  /donations/settings           – public settings (account, amounts, message)
  POST /donations/                   – create a donation (anonymous or member)
  GET  /donations/my                 – authenticated user's own donations

Admin (all under /admin prefix):
  GET  /admin/donations              – list all donations, optional ?status=
  POST /admin/donations/{id}/confirm – confirm + award member points
  POST /admin/donations/{id}/cancel  – cancel a pending donation
  GET  /admin/donation-settings      – get full admin settings
  PUT  /admin/donation-settings      – update settings
  GET  /admin/donations/stats        – aggregate statistics
"""
import json
import uuid
from datetime import datetime
from decimal import Decimal
from math import floor
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from database import get_db
from models.donation import Donation, DonationSetting, DonationStatus
from models.subscription import Subscription
from models.user import User
from security.guards import (
    get_admin_user_dependency,
    get_optional_active_user_dependency,
    get_authenticated_user_dependency,
)

router = APIRouter(prefix="/donations", tags=["donations"])


# ─── Transfer reference generator ────────────────────────────────

def _make_transfer_reference() -> str:
    """Generate a short, unique bank transfer reference like DON-202602-AB12CD34."""
    short = str(uuid.uuid4()).replace("-", "")[:8].upper()
    now = datetime.utcnow()
    return f"DON-{now.year}{str(now.month).zfill(2)}-{short}"


# ─── Shared helper ───────────────────────────────────────────────

async def _get_or_create_settings(db: AsyncSession) -> DonationSetting:
    """Return the singleton DonationSetting row, creating it with defaults if absent."""
    result = await db.execute(select(DonationSetting).where(DonationSetting.id == 1))
    settings = result.scalar_one_or_none()
    if not settings:
        settings = DonationSetting(
            id=1,
            points_per_zloty=Decimal("1.00"),
            min_amount=Decimal("5.00"),
            suggested_amounts="[10, 20, 50, 100]",
            is_enabled=True,
        )
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
    return settings


def _parse_suggested_amounts(raw: str | None) -> list[float]:
    try:
        return json.loads(raw or "[]")
    except (json.JSONDecodeError, TypeError):
        return [10, 20, 50, 100]


def _fmt_dt(dt) -> str | None:
    if dt is None:
        return None
    return dt.isoformat()


# ─── Schemas ─────────────────────────────────────────────────────

class PublicDonationSettingsResponse(BaseModel):
    is_enabled: bool
    min_amount: float
    suggested_amounts: list[float]
    account_number: Optional[str]
    payment_title: Optional[str]
    bank_owner_name: Optional[str]
    bank_owner_address: Optional[str]
    message: Optional[str]
    points_per_zloty: float


class DonationCreateRequest(BaseModel):
    amount: Decimal = Field(gt=0, description="Donation amount in PLN.")
    donor_name: Optional[str] = Field(default=None, max_length=100)
    donor_email: Optional[str] = Field(default=None, max_length=255)


class DonationResponse(BaseModel):
    id: str
    amount: str
    currency: str
    status: str
    transfer_reference: str
    donor_name: Optional[str]
    donor_email: Optional[str]
    points_awarded: Optional[int]
    created_at: str
    confirmed_at: Optional[str]


class AdminDonationSettingsUpdate(BaseModel):
    points_per_zloty: float = Field(ge=0, le=100)
    min_amount: float = Field(ge=0)
    suggested_amounts: list[float]
    is_enabled: bool
    account_number: Optional[str] = None
    payment_title: Optional[str] = None
    bank_owner_name: Optional[str] = None
    bank_owner_address: Optional[str] = None
    message: Optional[str] = None


class AdminDonationResponse(BaseModel):
    id: str
    user_id: Optional[str]
    user_full_name: Optional[str]
    user_email: Optional[str]
    donor_name: Optional[str]
    donor_email: Optional[str]
    amount: str
    currency: str
    status: str
    transfer_reference: str
    points_awarded: Optional[int]
    admin_note: Optional[str]
    created_at: str
    confirmed_at: Optional[str]


class AdminNoteRequest(BaseModel):
    note: Optional[str] = None


# ─── Public endpoints ─────────────────────────────────────────────

@router.get("/settings", response_model=PublicDonationSettingsResponse)
async def get_public_donation_settings(db: AsyncSession = Depends(get_db)):
    """Return public-facing donation configuration."""
    settings = await _get_or_create_settings(db)
    return PublicDonationSettingsResponse(
        is_enabled=settings.is_enabled,
        min_amount=float(settings.min_amount),
        suggested_amounts=_parse_suggested_amounts(settings.suggested_amounts),
        account_number=settings.account_number,
        payment_title=settings.payment_title,
        bank_owner_name=settings.bank_owner_name,
        bank_owner_address=settings.bank_owner_address,
        message=settings.message,
        points_per_zloty=float(settings.points_per_zloty),
    )


@router.post("/", response_model=DonationResponse, status_code=201)
async def create_donation(
    body: DonationCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_active_user_dependency),
):
    """
    Declare a new donation.

    Anyone (anonymous or authenticated) may submit a donation. The donation
    starts in pending_verification state. Authenticated active subscribers
    will receive loyalty points when an admin confirms the payment.
    """
    settings = await _get_or_create_settings(db)
    if not settings.is_enabled:
        raise HTTPException(status_code=422, detail="Donations are currently disabled.")
    if float(body.amount) < float(settings.min_amount):
        raise HTTPException(
            status_code=422,
            detail=f"Minimum donation amount is {settings.min_amount} PLN.",
        )

    ref = _make_transfer_reference()
    donation = Donation(
        id=str(uuid.uuid4()),
        user_id=current_user.id if current_user else None,
        donor_name=body.donor_name,
        donor_email=body.donor_email,
        amount=body.amount,
        currency="PLN",
        status=DonationStatus.PENDING_VERIFICATION.value,
        transfer_reference=ref,
    )
    db.add(donation)
    await db.commit()
    await db.refresh(donation)
    return DonationResponse(
        id=donation.id,
        amount=str(donation.amount),
        currency=donation.currency,
        status=donation.status,
        transfer_reference=donation.transfer_reference,
        donor_name=donation.donor_name,
        donor_email=donation.donor_email,
        points_awarded=None,
        created_at=_fmt_dt(donation.created_at) or datetime.utcnow().isoformat(),
        confirmed_at=None,
    )


@router.get("/my", response_model=list[DonationResponse])
async def get_my_donations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_authenticated_user_dependency),
):
    """Return the calling user's donation history."""
    result = await db.execute(
        select(Donation)
        .where(Donation.user_id == current_user.id)
        .order_by(Donation.created_at.desc())
    )
    donations = result.scalars().all()
    return [
        DonationResponse(
            id=d.id,
            amount=str(d.amount),
            currency=d.currency,
            status=d.status,
            transfer_reference=d.transfer_reference,
            donor_name=d.donor_name,
            donor_email=d.donor_email,
            points_awarded=d.points_awarded,
            created_at=_fmt_dt(d.created_at) or "",
            confirmed_at=_fmt_dt(d.confirmed_at),
        )
        for d in donations
    ]


# ─── Admin endpoints ──────────────────────────────────────────────

@router.get("/admin/settings")
async def get_admin_donation_settings(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user_dependency),
):
    """Return full donation settings for the admin panel."""
    settings = await _get_or_create_settings(db)
    return {
        "points_per_zloty": float(settings.points_per_zloty),
        "min_amount": float(settings.min_amount),
        "suggested_amounts": _parse_suggested_amounts(settings.suggested_amounts),
        "is_enabled": settings.is_enabled,
        "account_number": settings.account_number,
        "payment_title": settings.payment_title,
        "bank_owner_name": settings.bank_owner_name,
        "bank_owner_address": settings.bank_owner_address,
        "message": settings.message,
    }


@router.put("/admin/settings")
async def update_admin_donation_settings(
    body: AdminDonationSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user_dependency),
):
    """Update donation settings. Creates the singleton row if it doesn't exist."""
    settings = await _get_or_create_settings(db)
    settings.points_per_zloty = Decimal(str(body.points_per_zloty))
    settings.min_amount = Decimal(str(body.min_amount))
    settings.suggested_amounts = json.dumps(body.suggested_amounts)
    settings.is_enabled = body.is_enabled
    settings.account_number = body.account_number
    settings.payment_title = body.payment_title
    settings.bank_owner_name = body.bank_owner_name
    settings.bank_owner_address = body.bank_owner_address
    settings.message = body.message
    await db.commit()
    return {"ok": True}


@router.get("/admin/list", response_model=list[AdminDonationResponse])
async def list_admin_donations(
    status: Optional[str] = Query(None, description="Filter by status."),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user_dependency),
):
    """Return all donations, optionally filtered by status."""
    q = (
        select(Donation)
        .options(joinedload(Donation.user))
        .order_by(Donation.created_at.desc())
    )
    if status:
        q = q.where(Donation.status == status)
    result = await db.execute(q)
    donations = result.unique().scalars().all()

    return [
        AdminDonationResponse(
            id=d.id,
            user_id=d.user_id,
            user_full_name=d.user.full_name if d.user else None,
            user_email=d.user.email if d.user else None,
            donor_name=d.donor_name,
            donor_email=d.donor_email,
            amount=str(d.amount),
            currency=d.currency,
            status=d.status,
            transfer_reference=d.transfer_reference,
            points_awarded=d.points_awarded,
            admin_note=d.admin_note,
            created_at=_fmt_dt(d.created_at) or "",
            confirmed_at=_fmt_dt(d.confirmed_at),
        )
        for d in donations
    ]


@router.post("/admin/{donation_id}/confirm")
async def confirm_donation(
    donation_id: str,
    body: AdminNoteRequest = AdminNoteRequest(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user_dependency),
):
    """
    Confirm a pending donation.

    If the donor is an authenticated active subscriber, loyalty points are
    calculated as floor(amount * points_per_zloty) and added to their balance.
    """
    result = await db.execute(
        select(Donation)
        .options(joinedload(Donation.user))
        .where(Donation.id == donation_id)
    )
    donation = result.unique().scalar_one_or_none()
    if not donation:
        raise HTTPException(status_code=404, detail="Donation not found.")
    if donation.status != DonationStatus.PENDING_VERIFICATION.value:
        raise HTTPException(status_code=422, detail="Only pending donations can be confirmed.")

    donation.status = DonationStatus.CONFIRMED.value
    donation.confirmed_at = datetime.utcnow()
    donation.admin_note = body.note

    # Award loyalty points to active subscribers
    points_awarded = 0
    if donation.user_id:
        settings = await _get_or_create_settings(db)
        sub_result = await db.execute(
            select(Subscription).where(Subscription.user_id == donation.user_id)
        )
        sub = sub_result.scalar_one_or_none()
        if sub and (sub.end_date is None or sub.end_date > datetime.utcnow()):
            points = floor(float(donation.amount) * float(settings.points_per_zloty))
            if points > 0:
                sub.points = (sub.points or 0) + points
                points_awarded = points

    donation.points_awarded = points_awarded if points_awarded > 0 else None
    await db.commit()
    return {"ok": True, "points_awarded": points_awarded}


@router.post("/admin/{donation_id}/cancel")
async def cancel_donation(
    donation_id: str,
    body: AdminNoteRequest = AdminNoteRequest(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user_dependency),
):
    """Cancel a pending donation. Confirmed donations cannot be cancelled."""
    result = await db.execute(select(Donation).where(Donation.id == donation_id))
    donation = result.scalar_one_or_none()
    if not donation:
        raise HTTPException(status_code=404, detail="Donation not found.")
    if donation.status == DonationStatus.CONFIRMED.value:
        raise HTTPException(status_code=422, detail="Cannot cancel a confirmed donation.")

    donation.status = DonationStatus.CANCELLED.value
    donation.admin_note = body.note
    await db.commit()
    return {"ok": True}


@router.get("/admin/stats")
async def get_donation_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user_dependency),
):
    """Return aggregate donation statistics for the admin dashboard."""
    total_result = await db.execute(
        select(
            func.count(Donation.id).label("total_count"),
            func.sum(Donation.amount).label("total_amount"),
            func.sum(Donation.points_awarded).label("total_points"),
        ).where(Donation.status == DonationStatus.CONFIRMED.value)
    )
    total = total_result.one()

    pending_result = await db.execute(
        select(func.count(Donation.id)).where(
            Donation.status == DonationStatus.PENDING_VERIFICATION.value
        )
    )
    pending_count = pending_result.scalar() or 0

    # Current month statistics
    now = datetime.utcnow()
    first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month_result = await db.execute(
        select(
            func.count(Donation.id).label("month_count"),
            func.sum(Donation.amount).label("month_amount"),
        ).where(
            Donation.status == DonationStatus.CONFIRMED.value,
            Donation.confirmed_at >= first_of_month,
        )
    )
    month = month_result.one()

    return {
        "total_confirmed_count": total.total_count or 0,
        "total_confirmed_amount": str(total.total_amount or "0.00"),
        "total_points_awarded": int(total.total_points or 0),
        "pending_count": pending_count,
        "month_count": month.month_count or 0,
        "month_amount": str(month.month_amount or "0.00"),
    }
