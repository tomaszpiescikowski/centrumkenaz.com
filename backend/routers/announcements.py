"""Announcements API – public listing and admin CRUD."""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, Field
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from database import get_db
from services.log_service import log_action, _get_request_ip, user_email_from
from models.announcement import Announcement
from models.user import User
from security.guards import AdminUser

router = APIRouter(prefix="/api/announcements", tags=["announcements"])


# ── Schemas ──────────────────────────────────────────────────────────

class AnnouncementCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    content: str = Field(..., min_length=1, max_length=10000)


class AnnouncementAuthor(BaseModel):
    id: str
    full_name: str | None = None
    picture_url: str | None = None

    class Config:
        from_attributes = True


class AnnouncementOut(BaseModel):
    id: str
    title: str
    content: str
    created_at: str
    author: AnnouncementAuthor

    class Config:
        from_attributes = True


# ── Public endpoint ──────────────────────────────────────────────────

@router.get("/", response_model=list[AnnouncementOut])
async def list_announcements(db: AsyncSession = Depends(get_db)):
    """Return all announcements, newest first."""
    result = await db.execute(
        select(Announcement)
        .options(joinedload(Announcement.author))
        .order_by(desc(Announcement.created_at))
    )
    rows = result.scalars().unique().all()

    out = []
    for a in rows:
        out.append({
            "id": a.id,
            "title": a.title,
            "content": a.content,
            "created_at": a.created_at.isoformat() if a.created_at else "",
            "author": {
                "id": a.author.id,
                "full_name": a.author.full_name,
                "picture_url": a.author.picture_url,
            },
        })
    return out


# ── Admin endpoints ──────────────────────────────────────────────────

@router.post("/", response_model=AnnouncementOut, status_code=status.HTTP_201_CREATED)
async def create_announcement(
    body: AnnouncementCreate,
    admin: AdminUser,
    http_request: Request = None,
    db: AsyncSession = Depends(get_db),
):
    """Create a new announcement (admin only)."""
    announcement = Announcement(
        title=body.title,
        content=body.content,
        author_id=admin.id,
    )
    db.add(announcement)
    await db.commit()
    await db.refresh(announcement)

    result = await db.execute(
        select(Announcement)
        .options(joinedload(Announcement.author))
        .where(Announcement.id == announcement.id)
    )
    announcement = result.scalars().first()

    await log_action(
        "ANNOUNCEMENT_CREATED",
        user_email=user_email_from(admin),
        ip=_get_request_ip(http_request),
        announcement_id=str(announcement.id),
        title=announcement.title,
    )
    return {
        "id": announcement.id,
        "title": announcement.title,
        "content": announcement.content,
        "created_at": announcement.created_at.isoformat() if announcement.created_at else "",
        "author": {
            "id": announcement.author.id,
            "full_name": announcement.author.full_name,
            "picture_url": announcement.author.picture_url,
        },
    }


@router.delete("/{announcement_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_announcement(
    announcement_id: str,
    admin: AdminUser,
    http_request: Request = None,
    db: AsyncSession = Depends(get_db),
):
    """Delete an announcement (admin only)."""
    result = await db.execute(
        select(Announcement).where(Announcement.id == announcement_id)
    )
    announcement = result.scalars().first()
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found")

    await db.delete(announcement)
    await db.commit()
    await log_action(
        "ANNOUNCEMENT_DELETED",
        user_email=user_email_from(admin),
        ip=_get_request_ip(http_request),
        announcement_id=announcement_id,
        title=announcement.title,
    )
