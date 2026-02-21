"""Temporary feedback endpoint for early-access user opinions."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.feedback import Feedback

router = APIRouter(prefix="/api/feedback", tags=["feedback"])


class FeedbackCreate(BaseModel):
    email: EmailStr
    comment: str = Field(..., min_length=3, max_length=5000)


class FeedbackOut(BaseModel):
    id: str
    email: str
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
    db: AsyncSession = Depends(get_db),
):
    """Accept a feedback comment from any user (no auth required)."""
    entry = Feedback(
        email=payload.email,
        comment=payload.comment.strip(),
    )
    db.add(entry)
    await db.commit()
    return {"ok": True}
