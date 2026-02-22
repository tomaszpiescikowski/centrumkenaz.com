"""
Comments API router – threaded, reactable, pinnable comments.

Reusable across resource types via `resource_type` path parameter.
Currently used for events; extensible to announcements, products, etc.
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select, update, func as sa_func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from models.comment import Comment, CommentReaction, ReactionType
from models.user import UserRole
from security.guards import ActiveUser, AdminUser, OptionalActiveUser

router = APIRouter(prefix="/comments", tags=["comments"])


# ── Pydantic schemas ──────────────────────────────────────────────

class CommentAuthorResponse(BaseModel):
    """Minimal user info embedded in comment responses."""

    model_config = ConfigDict(from_attributes=True, coerce_numbers_to_str=True)

    id: str = Field(description="User ID.")
    full_name: str = Field(description="Display name.")
    picture_url: Optional[str] = Field(None, description="Avatar URL.")
    is_member: bool = Field(False, description="Whether user has an active membership.")
    is_admin: bool = Field(False, description="Whether user has admin role.")


class ReactionSummary(BaseModel):
    """Aggregated reaction count for a single type."""

    reaction_type: str = Field(description="Reaction type key.")
    count: int = Field(description="Number of users who reacted.")
    reacted_by_me: bool = Field(description="Whether the current user reacted.")


class CommentResponse(BaseModel):
    """Single comment with author info, reactions, and replies."""

    model_config = ConfigDict(from_attributes=True, coerce_numbers_to_str=True)

    id: str
    resource_type: str
    resource_id: str
    content: str
    parent_id: Optional[str] = None
    is_pinned: bool
    is_deleted: bool
    version: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    author: CommentAuthorResponse
    reactions: list[ReactionSummary] = []
    replies: list["CommentResponse"] = []
    reply_count: int = 0


class CommentCreateRequest(BaseModel):
    """Payload for creating a new comment."""

    content: str = Field(..., min_length=1, max_length=2000, description="Comment text.")
    parent_id: Optional[str] = Field(None, description="Parent comment ID for replies.")


class CommentUpdateRequest(BaseModel):
    """Payload for editing a comment (with optimistic locking)."""

    content: str = Field(..., min_length=1, max_length=2000, description="New text.")
    version: int = Field(..., description="Current version for optimistic lock.")


class ReactionToggleRequest(BaseModel):
    """Payload for toggling a reaction."""

    reaction_type: ReactionType = Field(..., description="Reaction emoji type.")


# ── Helpers ───────────────────────────────────────────────────────

def _build_comment_response(
    comment: Comment,
    current_user_id: str,
    *,
    include_replies: bool = True,
) -> CommentResponse:
    """Convert an ORM Comment into a CommentResponse with aggregated reactions."""

    # Aggregate reactions by type
    reaction_map: dict[str, dict] = {}
    for r in comment.reactions:
        key = r.reaction_type if isinstance(r.reaction_type, str) else r.reaction_type.value
        if key not in reaction_map:
            reaction_map[key] = {"reaction_type": key, "count": 0, "reacted_by_me": False}
        reaction_map[key]["count"] += 1
        if r.user_id == current_user_id:
            reaction_map[key]["reacted_by_me"] = True

    display_content = comment.content
    if comment.is_deleted:
        display_content = "[deleted]"

    replies_list: list[CommentResponse] = []
    reply_count = 0
    if include_replies and comment.replies:
        non_deleted_replies = [r for r in comment.replies if not r.is_deleted or r.replies]
        replies_list = [
            _build_comment_response(r, current_user_id, include_replies=True)
            for r in comment.replies
        ]
        reply_count = len(comment.replies)

    return CommentResponse(
        id=comment.id,
        resource_type=comment.resource_type,
        resource_id=comment.resource_id,
        content=display_content,
        parent_id=comment.parent_id,
        is_pinned=comment.is_pinned,
        is_deleted=comment.is_deleted,
        version=comment.version,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
        author=CommentAuthorResponse(
            id=comment.user.id,
            full_name=comment.user.full_name,
            picture_url=comment.user.picture_url,
            is_member=comment.user.role == UserRole.MEMBER,
            is_admin=comment.user.role == UserRole.ADMIN,
        ),
        reactions=list(reaction_map.values()),
        replies=replies_list,
        reply_count=reply_count,
    )


# ── Eager-load helper ─────────────────────────────────────────────

def _comment_load_options():
    """Standard eager-load options used across endpoints (3 levels deep)."""
    # Level 0 (top-level comment)
    L0_user = selectinload(Comment.user)
    L0_reactions = selectinload(Comment.reactions).selectinload(CommentReaction.user)

    # Level 1 (direct replies)
    L1 = selectinload(Comment.replies)
    L1_user = L1.selectinload(Comment.user)
    L1_reactions = L1.selectinload(Comment.reactions).selectinload(CommentReaction.user)

    # Level 2 (reply of reply)
    L2 = L1.selectinload(Comment.replies)
    L2_user = L2.selectinload(Comment.user)
    L2_reactions = L2.selectinload(Comment.reactions).selectinload(CommentReaction.user)

    # Level 3 (reply of reply of reply)
    L3 = L2.selectinload(Comment.replies)
    L3_user = L3.selectinload(Comment.user)
    L3_reactions = L3.selectinload(Comment.reactions).selectinload(CommentReaction.user)

    return [
        L0_user, L0_reactions,
        L1_user, L1_reactions,
        L2_user, L2_reactions,
        L3_user, L3_reactions,
    ]


async def _refetch_comment(db: AsyncSession, comment_id: str) -> Comment | None:
    """Re-fetch a single comment with all relationships eagerly loaded."""
    stmt = (
        select(Comment)
        .where(Comment.id == comment_id)
        .options(*_comment_load_options())
        .execution_options(populate_existing=True)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


# ── Endpoints ─────────────────────────────────────────────────────
# NOTE: Single-segment and specific two-segment routes (pin, reactions)
# MUST be declared BEFORE the generic /{resource_type}/{resource_id}
# routes, otherwise FastAPI will match them to the generic pattern.

@router.put(
    "/{comment_id}",
    response_model=CommentResponse,
    summary="Edit a comment (own only, optimistic lock)",
)
async def update_comment(
    body: CommentUpdateRequest,
    comment_id: str = Path(..., min_length=1),
    user: ActiveUser = None,
    db: AsyncSession = Depends(get_db),
):
    """Edit own comment with optimistic concurrency control."""

    comment = await _refetch_comment(db, comment_id)

    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.user_id != user.id:
        raise HTTPException(status_code=403, detail="Cannot edit another user's comment")
    if comment.is_deleted:
        raise HTTPException(status_code=410, detail="Comment has been deleted")
    if comment.version != body.version:
        raise HTTPException(status_code=409, detail="Comment was modified concurrently")

    comment.content = body.content
    comment.version += 1
    await db.commit()

    comment = await _refetch_comment(db, comment_id)
    return _build_comment_response(comment, user.id)


@router.delete(
    "/{comment_id}",
    status_code=204,
    summary="Delete a comment (own or admin)",
)
async def delete_comment(
    comment_id: str = Path(..., min_length=1),
    user: ActiveUser = None,
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete a comment. Owner or admin can delete."""

    stmt = select(Comment).where(Comment.id == comment_id)
    result = await db.execute(stmt)
    comment = result.scalar_one_or_none()

    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    is_admin = user.role == UserRole.ADMIN
    if comment.user_id != user.id and not is_admin:
        raise HTTPException(status_code=403, detail="Cannot delete another user's comment")

    comment.is_deleted = True
    comment.content = "[deleted]"
    comment.version += 1
    await db.commit()


@router.post(
    "/{comment_id}/pin",
    response_model=CommentResponse,
    summary="Pin/unpin a comment (admin only)",
)
async def toggle_pin(
    comment_id: str = Path(..., min_length=1),
    user: AdminUser = None,
    db: AsyncSession = Depends(get_db),
):
    """Toggle pinned status on a comment. Admin only."""

    comment = await _refetch_comment(db, comment_id)

    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    new_pinned = not comment.is_pinned

    if new_pinned:
        # Unpin any other pinned comment for the same resource (max 1 pin)
        stmt = (
            update(Comment)
            .where(
                Comment.resource_type == comment.resource_type,
                Comment.resource_id == comment.resource_id,
                Comment.is_pinned.is_(True),
                Comment.id != comment.id,
            )
            .values(is_pinned=False)
        )
        await db.execute(stmt)

    comment.is_pinned = new_pinned
    comment.version += 1
    await db.commit()

    comment = await _refetch_comment(db, comment_id)
    return _build_comment_response(comment, user.id)


@router.post(
    "/{comment_id}/reactions",
    response_model=CommentResponse,
    summary="Toggle a reaction on a comment",
)
async def toggle_reaction(
    body: ReactionToggleRequest,
    comment_id: str = Path(..., min_length=1),
    user: ActiveUser = None,
    db: AsyncSession = Depends(get_db),
):
    """Add or remove a reaction. If user already reacted with the same type, remove it.
    Only one reaction per user per comment is allowed — adding a new type removes the old one."""

    comment = await _refetch_comment(db, comment_id)

    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    # Check existing reaction of the SAME type (toggle off)
    existing_stmt = select(CommentReaction).where(
        CommentReaction.comment_id == comment_id,
        CommentReaction.user_id == user.id,
        CommentReaction.reaction_type == body.reaction_type,
    )
    existing_result = await db.execute(existing_stmt)
    existing = existing_result.scalar_one_or_none()

    if existing:
        # Same reaction clicked again — toggle off
        await db.delete(existing)
    else:
        # Remove any existing reaction of a DIFFERENT type first (only 1 allowed)
        other_stmt = select(CommentReaction).where(
            CommentReaction.comment_id == comment_id,
            CommentReaction.user_id == user.id,
        )
        other_result = await db.execute(other_stmt)
        for old_reaction in other_result.scalars().all():
            await db.delete(old_reaction)

        reaction = CommentReaction(
            comment_id=comment_id,
            user_id=user.id,
            reaction_type=body.reaction_type,
        )
        db.add(reaction)

    await db.commit()

    # Re-fetch to get updated reactions
    comment = await _refetch_comment(db, comment_id)
    return _build_comment_response(comment, user.id)


# ── Generic resource routes (MUST come last) ──────────────────────

@router.get(
    "/{resource_type}/{resource_id}",
    response_model=list[CommentResponse],
    summary="List comments for a resource",
)
async def list_comments(
    resource_type: str = Path(..., min_length=1, max_length=50),
    resource_id: str = Path(..., min_length=1),
    user: OptionalActiveUser = None,
    db: AsyncSession = Depends(get_db),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    order: Literal['asc', 'desc'] = Query('asc', description="Sort order: asc=oldest-first, desc=newest-first."),
):
    """Return top-level comments (with nested replies) for a resource."""

    stmt = (
        select(Comment)
        .where(
            Comment.resource_type == resource_type,
            Comment.resource_id == resource_id,
            Comment.parent_id.is_(None),
        )
        .options(*_comment_load_options())
        .execution_options(populate_existing=True)
        .order_by(
            *(
                [Comment.is_pinned.desc(), Comment.created_at.asc()]
                if order == 'asc'
                else [Comment.created_at.desc()]
            )
        )
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(stmt)
    comments = result.scalars().unique().all()

    current_user_id = user.id if user else ""
    return [_build_comment_response(c, current_user_id) for c in comments]


@router.post(
    "/{resource_type}/{resource_id}",
    response_model=CommentResponse,
    status_code=201,
    summary="Create a comment",
)
async def create_comment(
    body: CommentCreateRequest,
    resource_type: str = Path(..., min_length=1, max_length=50),
    resource_id: str = Path(..., min_length=1),
    user: ActiveUser = None,
    db: AsyncSession = Depends(get_db),
):
    """Create a new comment or reply on a resource."""

    # Validate parent exists and belongs to same resource
    if body.parent_id:
        parent_stmt = select(Comment).where(
            Comment.id == body.parent_id,
            Comment.resource_type == resource_type,
            Comment.resource_id == resource_id,
        )
        parent_result = await db.execute(parent_stmt)
        parent = parent_result.scalar_one_or_none()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent comment not found")

    comment = Comment(
        resource_type=resource_type,
        resource_id=resource_id,
        user_id=user.id,
        content=body.content,
        parent_id=body.parent_id,
    )
    db.add(comment)
    await db.commit()

    comment = await _refetch_comment(db, comment.id)
    return _build_comment_response(comment, user.id)
