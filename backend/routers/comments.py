"""
Comments API router – threaded, reactable comments.

Reusable across resource types via `resource_type` path parameter.
Currently used for events; extensible to announcements, products, etc.
"""

from datetime import datetime, timezone
from typing import Optional
import re

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select, func as sa_func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from models.comment import Comment, CommentReaction, ReactionType
from models.registration import Registration, RegistrationStatus
from models.user import User, UserRole
from services import push_service
from security.guards import ActiveUser, OptionalActiveUser

router = APIRouter(prefix="/comments", tags=["comments"])


# ── Mention extraction ────────────────────────────────────────────

_MENTION_RE = re.compile(r'@([\w\u00C0-\u017E]+(?:\s+[\w\u00C0-\u017E]+){0,2})')


def _extract_mention_candidates(content: str) -> list[str]:
    """Return a deduplicated list of name candidates from @-mentions."""
    return list(dict.fromkeys(_MENTION_RE.findall(content)))


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
    is_pinned: bool = False
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
# NOTE: Specific two-segment routes (reactions)
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
    summary="Delete a comment (own only)",
)
async def delete_comment(
    comment_id: str = Path(..., min_length=1),
    user: ActiveUser = None,
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete a comment. Only the author can delete their own message."""

    stmt = select(Comment).where(Comment.id == comment_id)
    result = await db.execute(stmt)
    comment = result.scalar_one_or_none()

    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    if comment.user_id != user.id:
        raise HTTPException(status_code=403, detail="Cannot delete another user's comment")

    comment.is_deleted = True
    comment.content = "[deleted]"
    comment.version += 1
    await db.commit()


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


# ── Pin / unpin endpoint ──────────────────────────────────────────

@router.post(
    "/{comment_id}/pin",
    response_model=CommentResponse,
    summary="Toggle pin on a comment (admin only)",
)
async def toggle_pin(
    comment_id: str = Path(..., min_length=1),
    user: ActiveUser = None,
    db: AsyncSession = Depends(get_db),
):
    """Toggle the pinned state of a comment. Only admins can pin/unpin."""

    if user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can pin comments")

    comment = await _refetch_comment(db, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    comment.is_pinned = not comment.is_pinned
    await db.commit()

    comment = await _refetch_comment(db, comment_id)
    return _build_comment_response(comment, user.id)


# ── Polling check endpoint ────────────────────────────────────────

class CheckRequest(BaseModel):
    """Mapping of chatId → ISO since-timestamp to check for new activity."""
    chats: dict[str, datetime]


@router.post(
    "/check",
    summary="Lightweight check for new messages across multiple chats",
)
async def check_new_messages(
    body: CheckRequest,
    user: OptionalActiveUser = None,
    db: AsyncSession = Depends(get_db),
) -> dict[str, dict]:
    """Return a map of chatId → {latest, count} for each chat that has messages
    newer than the requested since-timestamp. Chats with no new activity are
    omitted from the response so the client can detect silence quickly."""

    result: dict[str, dict] = {}

    for chat_id, since in body.chats.items():
        # chatId format: "resource_type:resource_id" e.g. "event:uuid", "general:global"
        parts = chat_id.split(":", 1)
        if len(parts) != 2:
            continue
        resource_type, resource_id = parts

        # Ensure since is timezone-aware for comparison
        if since.tzinfo is None:
            since = since.replace(tzinfo=timezone.utc)

        base_filter = and_(
            Comment.resource_type == resource_type,
            Comment.resource_id == resource_id,
            Comment.created_at > since,
            Comment.is_deleted.is_(False),
        )

        stmt = select(
            sa_func.max(Comment.created_at),
            sa_func.count(Comment.id),
        ).where(base_filter)
        row = (await db.execute(stmt)).one()
        latest, count = row[0], row[1]

        if latest is not None:
            # Ensure tz-aware
            if latest.tzinfo is None:
                latest = latest.replace(tzinfo=timezone.utc)

            # Fetch up to 3 recent unique message authors for this chat
            authors_stmt = (
                select(User.id, User.full_name, User.picture_url)
                .join(Comment, Comment.author_id == User.id)
                .where(and_(
                    Comment.resource_type == resource_type,
                    Comment.resource_id == resource_id,
                    Comment.is_deleted.is_(False),
                ))
                .order_by(Comment.created_at.desc())
                .limit(12)
            )
            raw_authors = (await db.execute(authors_stmt)).all()
            seen_ids: set = set()
            authors: list = []
            for row in raw_authors:
                uid = str(row[0])
                if uid not in seen_ids and len(authors) < 3:
                    seen_ids.add(uid)
                    authors.append({
                        "id": uid,
                        "full_name": row[1],
                        "picture_url": row[2],
                    })

            result[chat_id] = {"latest": latest.isoformat(), "count": count, "authors": authors}

    return result


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
    before_ts: Optional[datetime] = Query(None, description="Cursor: return comments with created_at strictly before this timestamp (for loading older messages)."),
    after_ts: Optional[datetime] = Query(None, description="Cursor: return comments with created_at strictly after this timestamp (for polling new messages)."),
):
    """Return top-level comments (with nested replies) for a resource.

    Cursor-based pagination via before_ts / after_ts is preferred over offset
    because it remains stable as new messages arrive.
    """

    conditions = [
        Comment.resource_type == resource_type,
        Comment.resource_id == resource_id,
        Comment.parent_id.is_(None),
    ]

    if before_ts is not None:
        if before_ts.tzinfo is None:
            before_ts = before_ts.replace(tzinfo=timezone.utc)
        conditions.append(Comment.created_at < before_ts)

    if after_ts is not None:
        if after_ts.tzinfo is None:
            after_ts = after_ts.replace(tzinfo=timezone.utc)
        conditions.append(Comment.created_at > after_ts)

    time_order = Comment.created_at.asc() if order == 'asc' else Comment.created_at.desc()

    stmt = (
        select(Comment)
        .where(*conditions)
        .options(*_comment_load_options())
        .execution_options(populate_existing=True)
        .order_by(Comment.is_pinned.desc(), time_order)
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

    # Announcements channel is admin-only for writing
    if resource_type == 'general' and user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can post to announcements")

    # Event chats are restricted to registered (non-cancelled) participants
    if resource_type == 'event' and user.role != UserRole.ADMIN:
        reg_stmt = select(Registration).where(
            Registration.event_id == resource_id,
            Registration.user_id == user.id,
            Registration.status.notin_([
                RegistrationStatus.CANCELLED.value,
                RegistrationStatus.REFUNDED.value,
            ]),
        )
        reg_result = await db.execute(reg_stmt)
        if reg_result.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=403,
                detail="You must be registered for this event to participate in its chat",
            )

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

    # ── Push notifications for @mentions ──────────────────────────────────
    try:
        mentioned = _extract_mention_candidates(body.content)
        if mentioned and user.full_name:
            # Build the URL to navigate to
            if resource_type == 'general':
                chat_url = "/chat"
            elif resource_type == 'event':
                chat_url = f"/events/{resource_id}"
            else:
                chat_url = "/"

            for candidate in mentioned:
                # Skip self-mentions
                if user.full_name and candidate.lower() == user.full_name.lower():
                    continue
                res = await db.execute(
                    select(User).where(User.full_name.ilike(candidate))
                )
                target_user = res.scalar_one_or_none()
                if target_user and str(target_user.id) != str(user.id):
                    await push_service.send_to_user(
                        db,
                        str(target_user.id),
                        f"💬 {user.full_name} wspomniał(a) o Tobie",
                        body.content[:120] + ("…" if len(body.content) > 120 else ""),
                        chat_url,
                    )
    except Exception:  # noqa: BLE001
        pass

    return _build_comment_response(comment, user.id)
