"""Temporary feedback endpoint for early-access user opinions."""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from services.log_service import log_action, _get_request_ip
from models.feedback import Feedback
from models.user import User
from security.guards import get_admin_user_dependency

router = APIRouter(prefix="/api/feedback", tags=["feedback"])


class FeedbackCreate(BaseModel):
    email: str | None = None
    comment: str = Field(..., min_length=3, max_length=5000)


class FeedbackOut(BaseModel):
    id: str
    email: str | None
    comment: str
    created_at: str

    class Config:
        from_attributes = True


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=dict,
    summary="Submit user feedback (temporary)",
)
async def submit_feedback(
    payload: FeedbackCreate,
    http_request: Request = None,
    db: AsyncSession = Depends(get_db),
):
    """Accept a feedback comment from any user (no auth required)."""
    entry = Feedback(
        email=payload.email,
        comment=payload.comment.strip(),
    )
    db.add(entry)
    await db.commit()
    await log_action(
                action="FEEDBACK_SUBMITTED",
        user_email=payload.email,
        ip=_get_request_ip(http_request),
        comment_len=len(payload.comment.strip()),
    )
    return {"ok": True}


@router.get(
    "",
    response_model=list[FeedbackOut],
    summary="List all feedback (admin only, temporary)",
)
async def list_feedback(
    admin: User = Depends(get_admin_user_dependency),
    db: AsyncSession = Depends(get_db),
):
    """Return every feedback entry, newest first."""
    result = await db.execute(
        select(Feedback).order_by(Feedback.created_at.desc())
    )
    rows = result.scalars().all()
    return [
        FeedbackOut(
            id=r.id,
            email=r.email or None,
            comment=r.comment,
            created_at=r.created_at.isoformat() if r.created_at else "",
        )
        for r in rows
    ]
