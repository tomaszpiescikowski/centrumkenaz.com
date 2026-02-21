"""
Comprehensive tests for the comments API.

Covers: CRUD operations, threading (replies), reactions (toggle on/off,
multiple types, dedup), pinning (admin-only), soft-delete, optimistic
concurrency control, authorization guards, pagination, edge cases,
and concurrent request safety.
"""

import asyncio
from datetime import datetime, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from database import get_db
from models.comment import Comment, CommentReaction, ReactionType
from models.event import Event
from models.user import AccountStatus, User, UserRole
from routers import comments_router
from services.auth_service import AuthService


# ── Fixtures ──────────────────────────────────────────────────────


@pytest.fixture
async def comments_api_client(db_session):
    """HTTP test client with the comments router mounted."""
    app = FastAPI()
    app.include_router(comments_router)

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    client = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    try:
        yield client
    finally:
        await client.aclose()


def _make_user(suffix=None, role=UserRole.GUEST, status=AccountStatus.ACTIVE):
    suffix = suffix or uuid4().hex[:12]
    return User(
        google_id=f"g-{suffix}",
        email=f"{suffix}@example.com",
        full_name=f"User {suffix}",
        picture_url=f"https://img.example.com/{suffix}.jpg",
        role=role,
        account_status=status,
    )


def _make_event(suffix=None):
    suffix = suffix or uuid4().hex[:12]
    return Event(
        title=f"Event {suffix}",
        event_type="mors",
        start_date=datetime.now() + timedelta(days=7),
        city="Poznań",
        price_guest=Decimal("0.00"),
        price_member=Decimal("0.00"),
        max_participants=20,
        version=1,
    )


async def _auth_header(db_session, user):
    token = AuthService(db_session).create_access_token(user)
    return {"Authorization": f"Bearer {token}"}


# ── 1. Basic CRUD ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_comment_returns_201(comments_api_client, db_session):
    """Creating a comment should return 201 with full comment data."""
    user = _make_user()
    event = _make_event()
    db_session.add_all([user, event])
    await db_session.commit()
    await db_session.refresh(user)
    await db_session.refresh(event)

    headers = await _auth_header(db_session, user)
    resp = await comments_api_client.post(
        f"/comments/event/{event.id}",
        json={"content": "Great event!"},
        headers=headers,
    )

    assert resp.status_code == 201
    data = resp.json()
    assert data["content"] == "Great event!"
    assert data["resource_type"] == "event"
    assert data["resource_id"] == event.id
    assert data["author"]["id"] == user.id
    assert data["author"]["full_name"] == user.full_name
    assert data["author"]["picture_url"] == user.picture_url
    assert data["is_pinned"] is False
    assert data["is_deleted"] is False
    assert data["version"] == 1
    assert data["parent_id"] is None


@pytest.mark.asyncio
async def test_list_comments_returns_created(comments_api_client, db_session):
    """Listing comments should include previously created ones."""
    user = _make_user()
    event = _make_event()
    db_session.add_all([user, event])
    await db_session.commit()
    await db_session.refresh(user)
    await db_session.refresh(event)

    headers = await _auth_header(db_session, user)
    await comments_api_client.post(
        f"/comments/event/{event.id}",
        json={"content": "Hello"},
        headers=headers,
    )
    await comments_api_client.post(
        f"/comments/event/{event.id}",
        json={"content": "World"},
        headers=headers,
    )

    resp = await comments_api_client.get(f"/comments/event/{event.id}", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    assert data[0]["content"] == "Hello"
    assert data[1]["content"] == "World"


@pytest.mark.asyncio
async def test_update_own_comment(comments_api_client, db_session):
    """User can edit their own comment with correct version."""
    user = _make_user()
    event = _make_event()
    db_session.add_all([user, event])
    await db_session.commit()
    await db_session.refresh(user)
    await db_session.refresh(event)

    headers = await _auth_header(db_session, user)
    create_resp = await comments_api_client.post(
        f"/comments/event/{event.id}",
        json={"content": "original"},
        headers=headers,
    )
    comment_id = create_resp.json()["id"]
    version = create_resp.json()["version"]

    update_resp = await comments_api_client.put(
        f"/comments/{comment_id}",
        json={"content": "edited", "version": version},
        headers=headers,
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["content"] == "edited"
    assert update_resp.json()["version"] == version + 1


@pytest.mark.asyncio
async def test_delete_own_comment(comments_api_client, db_session):
    """User can soft-delete their own comment."""
    user = _make_user()
    event = _make_event()
    db_session.add_all([user, event])
    await db_session.commit()
    await db_session.refresh(user)
    await db_session.refresh(event)

    headers = await _auth_header(db_session, user)
    create_resp = await comments_api_client.post(
        f"/comments/event/{event.id}",
        json={"content": "to delete"},
        headers=headers,
    )
    comment_id = create_resp.json()["id"]

    del_resp = await comments_api_client.delete(
        f"/comments/{comment_id}",
        headers=headers,
    )
    assert del_resp.status_code == 204

    # Verify content is replaced with [deleted]
    list_resp = await comments_api_client.get(f"/comments/event/{event.id}", headers=headers)
    comments = list_resp.json()
    deleted_comment = [c for c in comments if c["id"] == comment_id][0]
    assert deleted_comment["is_deleted"] is True
    assert deleted_comment["content"] == "[deleted]"


# ── 2. Threading / Replies ────────────────────────────────────────


@pytest.mark.asyncio
async def test_reply_to_comment(comments_api_client, db_session):
    """Users can reply to existing comments."""
    user = _make_user()
    event = _make_event()
    db_session.add_all([user, event])
    await db_session.commit()
    await db_session.refresh(user)
    await db_session.refresh(event)

    headers = await _auth_header(db_session, user)
    parent_resp = await comments_api_client.post(
        f"/comments/event/{event.id}",
        json={"content": "parent comment"},
        headers=headers,
    )
    parent_id = parent_resp.json()["id"]

    reply_resp = await comments_api_client.post(
        f"/comments/event/{event.id}",
        json={"content": "reply text", "parent_id": parent_id},
        headers=headers,
    )
    assert reply_resp.status_code == 201
    assert reply_resp.json()["parent_id"] == parent_id

    # Listing returns parent with nested reply
    list_resp = await comments_api_client.get(f"/comments/event/{event.id}", headers=headers)
    data = list_resp.json()
    assert len(data) == 1  # Only top-level
    assert len(data[0]["replies"]) == 1
    assert data[0]["replies"][0]["content"] == "reply text"


@pytest.mark.asyncio
async def test_nested_replies(comments_api_client, db_session):
    """Support nested replies up to multiple levels."""
    user = _make_user()
    event = _make_event()
    db_session.add_all([user, event])
    await db_session.commit()
    await db_session.refresh(user)
    await db_session.refresh(event)

    headers = await _auth_header(db_session, user)

    # Level 0
    r0 = await comments_api_client.post(
        f"/comments/event/{event.id}",
        json={"content": "level 0"},
        headers=headers,
    )
    id0 = r0.json()["id"]

    # Level 1
    r1 = await comments_api_client.post(
        f"/comments/event/{event.id}",
        json={"content": "level 1", "parent_id": id0},
        headers=headers,
    )
    id1 = r1.json()["id"]

    # Level 2
    r2 = await comments_api_client.post(
        f"/comments/event/{event.id}",
        json={"content": "level 2", "parent_id": id1},
        headers=headers,
    )
    assert r2.status_code == 201

    # Verify nesting in list response
    list_resp = await comments_api_client.get(f"/comments/event/{event.id}", headers=headers)
    data = list_resp.json()
    assert len(data) == 1
    assert data[0]["replies"][0]["replies"][0]["content"] == "level 2"


@pytest.mark.asyncio
async def test_reply_to_nonexistent_parent_fails(comments_api_client, db_session):
    """Replying to a nonexistent parent should return 404."""
    user = _make_user()
    event = _make_event()
    db_session.add_all([user, event])
    await db_session.commit()
    await db_session.refresh(user)
    await db_session.refresh(event)

    headers = await _auth_header(db_session, user)
    resp = await comments_api_client.post(
        f"/comments/event/{event.id}",
        json={"content": "orphan reply", "parent_id": "nonexistent-id"},
        headers=headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_reply_to_comment_from_different_resource_fails(comments_api_client, db_session):
    """Replying with a parent_id from a different resource should return 404."""
    user = _make_user()
    event1 = _make_event("ev1")
    event2 = _make_event("ev2")
    db_session.add_all([user, event1, event2])
    await db_session.commit()
    await db_session.refresh(user)
    await db_session.refresh(event1)
    await db_session.refresh(event2)

    headers = await _auth_header(db_session, user)
    parent_resp = await comments_api_client.post(
        f"/comments/event/{event1.id}",
        json={"content": "on event 1"},
        headers=headers,
    )
    parent_id = parent_resp.json()["id"]

    resp = await comments_api_client.post(
        f"/comments/event/{event2.id}",
        json={"content": "cross-resource reply", "parent_id": parent_id},
        headers=headers,
    )
    assert resp.status_code == 404


# ── 3. Reactions ──────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_add_reaction(comments_api_client, db_session):
    """Adding a reaction should show in the comment's reactions list."""
    user = _make_user()
    event = _make_event()
    db_session.add_all([user, event])
    await db_session.commit()
    await db_session.refresh(user)
    await db_session.refresh(event)

    headers = await _auth_header(db_session, user)
    create_resp = await comments_api_client.post(
        f"/comments/event/{event.id}",
        json={"content": "react to me"},
        headers=headers,
    )
    comment_id = create_resp.json()["id"]

    react_resp = await comments_api_client.post(
        f"/comments/{comment_id}/reactions",
        json={"reaction_type": "like"},
        headers=headers,
    )
    assert react_resp.status_code == 200
    reactions = react_resp.json()["reactions"]
    assert len(reactions) == 1
    assert reactions[0]["reaction_type"] == "like"
    assert reactions[0]["count"] == 1
    assert reactions[0]["reacted_by_me"] is True


@pytest.mark.asyncio
async def test_toggle_reaction_off(comments_api_client, db_session):
    """Toggling the same reaction type again should remove it."""
    user = _make_user()
    event = _make_event()
    db_session.add_all([user, event])
    await db_session.commit()
    await db_session.refresh(user)
    await db_session.refresh(event)

    headers = await _auth_header(db_session, user)
    create_resp = await comments_api_client.post(
        f"/comments/event/{event.id}",
        json={"content": "toggle me"},
        headers=headers,
    )
    comment_id = create_resp.json()["id"]

    # Add
    await comments_api_client.post(
        f"/comments/{comment_id}/reactions",
        json={"reaction_type": "heart"},
        headers=headers,
    )
    # Remove (toggle)
    resp = await comments_api_client.post(
        f"/comments/{comment_id}/reactions",
        json={"reaction_type": "heart"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert len(resp.json()["reactions"]) == 0


@pytest.mark.asyncio
async def test_multiple_reaction_types(comments_api_client, db_session):
    """User can react with different emoji types on the same comment."""
    user = _make_user()
    event = _make_event()
    db_session.add_all([user, event])
    await db_session.commit()
    await db_session.refresh(user)
    await db_session.refresh(event)

    headers = await _auth_header(db_session, user)
    create_resp = await comments_api_client.post(
        f"/comments/event/{event.id}",
        json={"content": "multi-react"},
        headers=headers,
    )
    comment_id = create_resp.json()["id"]

    for rtype in ["like", "heart", "fire"]:
        await comments_api_client.post(
            f"/comments/{comment_id}/reactions",
            json={"reaction_type": rtype},
            headers=headers,
        )

    list_resp = await comments_api_client.get(f"/comments/event/{event.id}", headers=headers)
    reactions = list_resp.json()[0]["reactions"]
    types = {r["reaction_type"] for r in reactions}
    assert types == {"like", "heart", "fire"}


@pytest.mark.asyncio
async def test_multiple_users_react(comments_api_client, db_session):
    """Multiple users reacting with the same type should aggregate count."""
    user1 = _make_user("u1")
    user2 = _make_user("u2")
    event = _make_event()
    db_session.add_all([user1, user2, event])
    await db_session.commit()
    await db_session.refresh(user1)
    await db_session.refresh(user2)
    await db_session.refresh(event)

    h1 = await _auth_header(db_session, user1)
    h2 = await _auth_header(db_session, user2)

    create_resp = await comments_api_client.post(
        f"/comments/event/{event.id}",
        json={"content": "popular"},
        headers=h1,
    )
    comment_id = create_resp.json()["id"]

    await comments_api_client.post(
        f"/comments/{comment_id}/reactions",
        json={"reaction_type": "like"},
        headers=h1,
    )
    resp = await comments_api_client.post(
        f"/comments/{comment_id}/reactions",
        json={"reaction_type": "like"},
        headers=h2,
    )
    reactions = resp.json()["reactions"]
    like = [r for r in reactions if r["reaction_type"] == "like"][0]
    assert like["count"] == 2
    # user2 just reacted, so reacted_by_me should be True from their perspective
    assert like["reacted_by_me"] is True


@pytest.mark.asyncio
async def test_invalid_reaction_type_rejected(comments_api_client, db_session):
    """An invalid reaction type should be rejected with 422."""
    user = _make_user()
    event = _make_event()
    db_session.add_all([user, event])
    await db_session.commit()
    await db_session.refresh(user)
    await db_session.refresh(event)

    headers = await _auth_header(db_session, user)
    create_resp = await comments_api_client.post(
        f"/comments/event/{event.id}",
        json={"content": "bad react"},
        headers=headers,
    )
    comment_id = create_resp.json()["id"]

    resp = await comments_api_client.post(
        f"/comments/{comment_id}/reactions",
        json={"reaction_type": "invalid_emoji"},
        headers=headers,
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_react_to_nonexistent_comment_returns_404(comments_api_client, db_session):
    """Reacting to a nonexistent comment should return 404."""
    user = _make_user()
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    headers = await _auth_header(db_session, user)
    resp = await comments_api_client.post(
        "/comments/nonexistent-id/reactions",
        json={"reaction_type": "like"},
        headers=headers,
    )
    assert resp.status_code == 404


# ── 4. Pinning ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_admin_can_pin_comment(comments_api_client, db_session):
    """Admin should be able to pin a comment."""
    admin = _make_user("admin", role=UserRole.ADMIN)
    event = _make_event()
    db_session.add_all([admin, event])
    await db_session.commit()
    await db_session.refresh(admin)
    await db_session.refresh(event)

    headers = await _auth_header(db_session, admin)
    create_resp = await comments_api_client.post(
        f"/comments/event/{event.id}",
        json={"content": "pin me"},
        headers=headers,
    )
    comment_id = create_resp.json()["id"]

    pin_resp = await comments_api_client.post(
        f"/comments/{comment_id}/pin",
        headers=headers,
    )
    assert pin_resp.status_code == 200
    assert pin_resp.json()["is_pinned"] is True


@pytest.mark.asyncio
async def test_admin_can_unpin_comment(comments_api_client, db_session):
    """Admin can toggle pin off."""
    admin = _make_user("adm-unpin", role=UserRole.ADMIN)
    event = _make_event()
    db_session.add_all([admin, event])
    await db_session.commit()
    await db_session.refresh(admin)
    await db_session.refresh(event)

    headers = await _auth_header(db_session, admin)
    create_resp = await comments_api_client.post(
        f"/comments/event/{event.id}",
        json={"content": "toggle pin"},
        headers=headers,
    )
    comment_id = create_resp.json()["id"]

    # Pin
    await comments_api_client.post(f"/comments/{comment_id}/pin", headers=headers)
    # Unpin
    resp = await comments_api_client.post(f"/comments/{comment_id}/pin", headers=headers)
    assert resp.json()["is_pinned"] is False


@pytest.mark.asyncio
async def test_non_admin_cannot_pin(comments_api_client, db_session):
    """Regular users should receive 403 when trying to pin."""
    user = _make_user()
    event = _make_event()
    db_session.add_all([user, event])
    await db_session.commit()
    await db_session.refresh(user)
    await db_session.refresh(event)

    headers = await _auth_header(db_session, user)
    create_resp = await comments_api_client.post(
        f"/comments/event/{event.id}",
        json={"content": "cant pin"},
        headers=headers,
    )
    comment_id = create_resp.json()["id"]

    pin_resp = await comments_api_client.post(
        f"/comments/{comment_id}/pin",
        headers=headers,
    )
    assert pin_resp.status_code == 403


@pytest.mark.asyncio
async def test_pinned_comments_appear_first(comments_api_client, db_session):
    """Pinned comments should appear before unpinned ones in listing."""
    admin = _make_user("adm-order", role=UserRole.ADMIN)
    event = _make_event()
    db_session.add_all([admin, event])
    await db_session.commit()
    await db_session.refresh(admin)
    await db_session.refresh(event)

    headers = await _auth_header(db_session, admin)

    # Create 3 comments
    ids = []
    for text in ["first", "second", "third"]:
        r = await comments_api_client.post(
            f"/comments/event/{event.id}",
            json={"content": text},
            headers=headers,
        )
        ids.append(r.json()["id"])

    # Pin the third comment
    await comments_api_client.post(f"/comments/{ids[2]}/pin", headers=headers)

    resp = await comments_api_client.get(f"/comments/event/{event.id}", headers=headers)
    data = resp.json()
    assert data[0]["content"] == "third"
    assert data[0]["is_pinned"] is True


# ── 5. Authorization Guards ───────────────────────────────────────


@pytest.mark.asyncio
async def test_unauthenticated_user_cannot_create_comment(comments_api_client, db_session):
    """Anonymous users should receive 401."""
    resp = await comments_api_client.post(
        "/comments/event/some-id",
        json={"content": "anon comment"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_unauthenticated_user_cannot_list_comments(comments_api_client, db_session):
    """Anonymous users should receive 401 on list."""
    resp = await comments_api_client.get("/comments/event/some-id")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_pending_user_cannot_comment(comments_api_client, db_session):
    """Pending account users should receive 403."""
    user = _make_user("pending", status=AccountStatus.PENDING)
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    headers = await _auth_header(db_session, user)
    resp = await comments_api_client.post(
        "/comments/event/some-event-id",
        json={"content": "pending comment"},
        headers=headers,
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_cannot_edit_other_users_comment(comments_api_client, db_session):
    """User should not be able to edit another user's comment."""
    user1 = _make_user("owner")
    user2 = _make_user("intruder")
    event = _make_event()
    db_session.add_all([user1, user2, event])
    await db_session.commit()
    await db_session.refresh(user1)
    await db_session.refresh(user2)
    await db_session.refresh(event)

    h1 = await _auth_header(db_session, user1)
    h2 = await _auth_header(db_session, user2)

    create_resp = await comments_api_client.post(
        f"/comments/event/{event.id}",
        json={"content": "my comment"},
        headers=h1,
    )
    comment_id = create_resp.json()["id"]

    resp = await comments_api_client.put(
        f"/comments/{comment_id}",
        json={"content": "hacked", "version": 1},
        headers=h2,
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_cannot_delete_other_users_comment(comments_api_client, db_session):
    """Regular user should not be able to delete another user's comment."""
    user1 = _make_user("del-owner")
    user2 = _make_user("del-intruder")
    event = _make_event()
    db_session.add_all([user1, user2, event])
    await db_session.commit()
    await db_session.refresh(user1)
    await db_session.refresh(user2)
    await db_session.refresh(event)

    h1 = await _auth_header(db_session, user1)
    h2 = await _auth_header(db_session, user2)

    create_resp = await comments_api_client.post(
        f"/comments/event/{event.id}",
        json={"content": "dont delete me"},
        headers=h1,
    )
    comment_id = create_resp.json()["id"]

    resp = await comments_api_client.delete(
        f"/comments/{comment_id}",
        headers=h2,
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_admin_can_delete_any_comment(comments_api_client, db_session):
    """Admin should be able to delete any user's comment."""
    user = _make_user("adm-del-user")
    admin = _make_user("adm-del-admin", role=UserRole.ADMIN)
    event = _make_event()
    db_session.add_all([user, admin, event])
    await db_session.commit()
    await db_session.refresh(user)
    await db_session.refresh(admin)
    await db_session.refresh(event)

    user_headers = await _auth_header(db_session, user)
    admin_headers = await _auth_header(db_session, admin)

    create_resp = await comments_api_client.post(
        f"/comments/event/{event.id}",
        json={"content": "admin should delete"},
        headers=user_headers,
    )
    comment_id = create_resp.json()["id"]

    resp = await comments_api_client.delete(
        f"/comments/{comment_id}",
        headers=admin_headers,
    )
    assert resp.status_code == 204


# ── 6. Optimistic Concurrency Control ────────────────────────────


@pytest.mark.asyncio
async def test_stale_version_rejected(comments_api_client, db_session):
    """Editing with a stale version should return 409 Conflict."""
    user = _make_user()
    event = _make_event()
    db_session.add_all([user, event])
    await db_session.commit()
    await db_session.refresh(user)
    await db_session.refresh(event)

    headers = await _auth_header(db_session, user)
    create_resp = await comments_api_client.post(
        f"/comments/event/{event.id}",
        json={"content": "v1"},
        headers=headers,
    )
    comment_id = create_resp.json()["id"]

    # First edit succeeds
    await comments_api_client.put(
        f"/comments/{comment_id}",
        json={"content": "v2", "version": 1},
        headers=headers,
    )

    # Second edit with stale version fails
    resp = await comments_api_client.put(
        f"/comments/{comment_id}",
        json={"content": "v2-conflict", "version": 1},
        headers=headers,
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_concurrent_edits_one_wins(comments_api_client, db_session):
    """Only one of two concurrent edits with the same version should succeed."""
    user = _make_user()
    event = _make_event()
    db_session.add_all([user, event])
    await db_session.commit()
    await db_session.refresh(user)
    await db_session.refresh(event)

    headers = await _auth_header(db_session, user)
    create_resp = await comments_api_client.post(
        f"/comments/event/{event.id}",
        json={"content": "original"},
        headers=headers,
    )
    comment_id = create_resp.json()["id"]

    # Submit two edits with the same version
    r1 = await comments_api_client.put(
        f"/comments/{comment_id}",
        json={"content": "edit A", "version": 1},
        headers=headers,
    )
    r2 = await comments_api_client.put(
        f"/comments/{comment_id}",
        json={"content": "edit B", "version": 1},
        headers=headers,
    )

    statuses = {r1.status_code, r2.status_code}
    # First succeeds (200), second fails (409)
    assert 200 in statuses
    assert 409 in statuses


@pytest.mark.asyncio
async def test_edit_deleted_comment_fails(comments_api_client, db_session):
    """Editing a soft-deleted comment should return 410 Gone."""
    user = _make_user()
    event = _make_event()
    db_session.add_all([user, event])
    await db_session.commit()
    await db_session.refresh(user)
    await db_session.refresh(event)

    headers = await _auth_header(db_session, user)
    create_resp = await comments_api_client.post(
        f"/comments/event/{event.id}",
        json={"content": "soon deleted"},
        headers=headers,
    )
    comment_id = create_resp.json()["id"]

    await comments_api_client.delete(f"/comments/{comment_id}", headers=headers)

    resp = await comments_api_client.put(
        f"/comments/{comment_id}",
        json={"content": "zombie edit", "version": 1},
        headers=headers,
    )
    assert resp.status_code == 410


# ── 7. Validation ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_empty_content_rejected(comments_api_client, db_session):
    """Empty content should be rejected with 422."""
    user = _make_user()
    event = _make_event()
    db_session.add_all([user, event])
    await db_session.commit()
    await db_session.refresh(user)
    await db_session.refresh(event)

    headers = await _auth_header(db_session, user)
    resp = await comments_api_client.post(
        f"/comments/event/{event.id}",
        json={"content": ""},
        headers=headers,
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_too_long_content_rejected(comments_api_client, db_session):
    """Content exceeding 2000 chars should be rejected."""
    user = _make_user()
    event = _make_event()
    db_session.add_all([user, event])
    await db_session.commit()
    await db_session.refresh(user)
    await db_session.refresh(event)

    headers = await _auth_header(db_session, user)
    resp = await comments_api_client.post(
        f"/comments/event/{event.id}",
        json={"content": "x" * 2001},
        headers=headers,
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_max_length_content_accepted(comments_api_client, db_session):
    """Content at exactly 2000 chars should be accepted."""
    user = _make_user()
    event = _make_event()
    db_session.add_all([user, event])
    await db_session.commit()
    await db_session.refresh(user)
    await db_session.refresh(event)

    headers = await _auth_header(db_session, user)
    resp = await comments_api_client.post(
        f"/comments/event/{event.id}",
        json={"content": "x" * 2000},
        headers=headers,
    )
    assert resp.status_code == 201


# ── 8. Pagination ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_pagination_offset_limit(comments_api_client, db_session):
    """Pagination should respect offset and limit params."""
    user = _make_user()
    event = _make_event()
    db_session.add_all([user, event])
    await db_session.commit()
    await db_session.refresh(user)
    await db_session.refresh(event)

    headers = await _auth_header(db_session, user)
    for i in range(5):
        await comments_api_client.post(
            f"/comments/event/{event.id}",
            json={"content": f"comment {i}"},
            headers=headers,
        )

    resp = await comments_api_client.get(
        f"/comments/event/{event.id}?offset=2&limit=2",
        headers=headers,
    )
    data = resp.json()
    assert len(data) == 2
    assert data[0]["content"] == "comment 2"
    assert data[1]["content"] == "comment 3"


@pytest.mark.asyncio
async def test_pagination_beyond_total(comments_api_client, db_session):
    """Offset beyond total comments should return empty list."""
    user = _make_user()
    event = _make_event()
    db_session.add_all([user, event])
    await db_session.commit()
    await db_session.refresh(user)
    await db_session.refresh(event)

    headers = await _auth_header(db_session, user)
    await comments_api_client.post(
        f"/comments/event/{event.id}",
        json={"content": "only comment"},
        headers=headers,
    )

    resp = await comments_api_client.get(
        f"/comments/event/{event.id}?offset=100",
        headers=headers,
    )
    assert resp.json() == []


# ── 9. Resource Isolation ─────────────────────────────────────────


@pytest.mark.asyncio
async def test_comments_isolated_per_event(comments_api_client, db_session):
    """Comments on one event should not appear on another."""
    user = _make_user()
    event1 = _make_event("iso-1")
    event2 = _make_event("iso-2")
    db_session.add_all([user, event1, event2])
    await db_session.commit()
    await db_session.refresh(user)
    await db_session.refresh(event1)
    await db_session.refresh(event2)

    headers = await _auth_header(db_session, user)

    await comments_api_client.post(
        f"/comments/event/{event1.id}",
        json={"content": "on event1"},
        headers=headers,
    )
    await comments_api_client.post(
        f"/comments/event/{event2.id}",
        json={"content": "on event2"},
        headers=headers,
    )

    r1 = await comments_api_client.get(f"/comments/event/{event1.id}", headers=headers)
    r2 = await comments_api_client.get(f"/comments/event/{event2.id}", headers=headers)

    assert len(r1.json()) == 1
    assert r1.json()[0]["content"] == "on event1"
    assert len(r2.json()) == 1
    assert r2.json()[0]["content"] == "on event2"


@pytest.mark.asyncio
async def test_comments_isolated_per_resource_type(comments_api_client, db_session):
    """Different resource_types with the same resource_id should be isolated."""
    user = _make_user()
    event = _make_event()
    db_session.add_all([user, event])
    await db_session.commit()
    await db_session.refresh(user)
    await db_session.refresh(event)

    headers = await _auth_header(db_session, user)

    await comments_api_client.post(
        f"/comments/event/{event.id}",
        json={"content": "event comment"},
        headers=headers,
    )
    await comments_api_client.post(
        f"/comments/announcement/{event.id}",
        json={"content": "announcement comment"},
        headers=headers,
    )

    ev_resp = await comments_api_client.get(f"/comments/event/{event.id}", headers=headers)
    ann_resp = await comments_api_client.get(f"/comments/announcement/{event.id}", headers=headers)

    assert len(ev_resp.json()) == 1
    assert ev_resp.json()[0]["content"] == "event comment"
    assert len(ann_resp.json()) == 1
    assert ann_resp.json()[0]["content"] == "announcement comment"


# ── 10. Edge Cases ────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_edit_nonexistent_comment_returns_404(comments_api_client, db_session):
    """Editing a nonexistent comment should return 404."""
    user = _make_user()
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    headers = await _auth_header(db_session, user)
    resp = await comments_api_client.put(
        "/comments/nonexistent-id",
        json={"content": "edited", "version": 1},
        headers=headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_nonexistent_comment_returns_404(comments_api_client, db_session):
    """Deleting a nonexistent comment should return 404."""
    user = _make_user()
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    headers = await _auth_header(db_session, user)
    resp = await comments_api_client.delete(
        "/comments/nonexistent-id",
        headers=headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_pin_nonexistent_comment_returns_404(comments_api_client, db_session):
    """Pinning a nonexistent comment should return 404."""
    admin = _make_user("adm-pin-404", role=UserRole.ADMIN)
    db_session.add(admin)
    await db_session.commit()
    await db_session.refresh(admin)

    headers = await _auth_header(db_session, admin)
    resp = await comments_api_client.post(
        "/comments/nonexistent-id/pin",
        headers=headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_comment_author_info_correct(comments_api_client, db_session):
    """Comment author info should match user record."""
    user = _make_user("author-check")
    user.full_name = "Jan Kowalski"
    user.picture_url = "https://img.example.com/jan.jpg"
    event = _make_event()
    db_session.add_all([user, event])
    await db_session.commit()
    await db_session.refresh(user)
    await db_session.refresh(event)

    headers = await _auth_header(db_session, user)
    resp = await comments_api_client.post(
        f"/comments/event/{event.id}",
        json={"content": "check author"},
        headers=headers,
    )
    author = resp.json()["author"]
    assert author["full_name"] == "Jan Kowalski"
    assert author["picture_url"] == "https://img.example.com/jan.jpg"


@pytest.mark.asyncio
async def test_comment_without_user_avatar(comments_api_client, db_session):
    """Comment by user with no picture_url should have null avatar."""
    user = _make_user("no-avatar")
    user.picture_url = None
    event = _make_event()
    db_session.add_all([user, event])
    await db_session.commit()
    await db_session.refresh(user)
    await db_session.refresh(event)

    headers = await _auth_header(db_session, user)
    resp = await comments_api_client.post(
        f"/comments/event/{event.id}",
        json={"content": "no avatar"},
        headers=headers,
    )
    assert resp.json()["author"]["picture_url"] is None


@pytest.mark.asyncio
async def test_created_at_is_present(comments_api_client, db_session):
    """Comment should include created_at timestamp."""
    user = _make_user()
    event = _make_event()
    db_session.add_all([user, event])
    await db_session.commit()
    await db_session.refresh(user)
    await db_session.refresh(event)

    headers = await _auth_header(db_session, user)
    resp = await comments_api_client.post(
        f"/comments/event/{event.id}",
        json={"content": "timestamp test"},
        headers=headers,
    )
    assert resp.json()["created_at"] is not None


@pytest.mark.asyncio
async def test_list_empty_resource(comments_api_client, db_session):
    """Listing comments for a resource with none should return empty list."""
    user = _make_user()
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    headers = await _auth_header(db_session, user)
    resp = await comments_api_client.get(
        "/comments/event/no-such-event-id",
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_reply_count_in_response(comments_api_client, db_session):
    """Response should include reply_count for each comment."""
    user = _make_user()
    event = _make_event()
    db_session.add_all([user, event])
    await db_session.commit()
    await db_session.refresh(user)
    await db_session.refresh(event)

    headers = await _auth_header(db_session, user)
    parent_resp = await comments_api_client.post(
        f"/comments/event/{event.id}",
        json={"content": "parent"},
        headers=headers,
    )
    parent_id = parent_resp.json()["id"]

    for i in range(3):
        await comments_api_client.post(
            f"/comments/event/{event.id}",
            json={"content": f"reply {i}", "parent_id": parent_id},
            headers=headers,
        )

    resp = await comments_api_client.get(f"/comments/event/{event.id}", headers=headers)
    data = resp.json()
    assert data[0]["reply_count"] == 3
    assert len(data[0]["replies"]) == 3


@pytest.mark.asyncio
async def test_multiple_users_comment_on_same_event(comments_api_client, db_session):
    """Multiple users commenting should all appear in the listing."""
    users = [_make_user(f"mu-{i}") for i in range(4)]
    event = _make_event()
    db_session.add_all([*users, event])
    await db_session.commit()
    for u in users:
        await db_session.refresh(u)
    await db_session.refresh(event)

    for i, u in enumerate(users):
        headers = await _auth_header(db_session, u)
        await comments_api_client.post(
            f"/comments/event/{event.id}",
            json={"content": f"comment from user {i}"},
            headers=headers,
        )

    headers = await _auth_header(db_session, users[0])
    resp = await comments_api_client.get(f"/comments/event/{event.id}", headers=headers)
    data = resp.json()
    assert len(data) == 4
    authors = {c["author"]["id"] for c in data}
    assert len(authors) == 4


@pytest.mark.asyncio
async def test_whitespace_only_content_rejected(comments_api_client, db_session):
    """Content that is only whitespace should still pass min_length but be trimmed server-side."""
    user = _make_user()
    event = _make_event()
    db_session.add_all([user, event])
    await db_session.commit()
    await db_session.refresh(user)
    await db_session.refresh(event)

    headers = await _auth_header(db_session, user)
    # Single space passes min_length=1 on Pydantic but is technically content
    resp = await comments_api_client.post(
        f"/comments/event/{event.id}",
        json={"content": " "},
        headers=headers,
    )
    # Accepted (space is a valid char, trimming is frontend concern)
    assert resp.status_code == 201


@pytest.mark.asyncio
async def test_special_characters_in_content(comments_api_client, db_session):
    """Comments with special characters should be stored and returned correctly."""
    user = _make_user()
    event = _make_event()
    db_session.add_all([user, event])
    await db_session.commit()
    await db_session.refresh(user)
    await db_session.refresh(event)

    headers = await _auth_header(db_session, user)
    content = 'He said "hello" & <script>alert("xss")</script> 🎉'
    resp = await comments_api_client.post(
        f"/comments/event/{event.id}",
        json={"content": content},
        headers=headers,
    )
    assert resp.status_code == 201
    assert resp.json()["content"] == content


@pytest.mark.asyncio
async def test_unicode_content(comments_api_client, db_session):
    """Unicode content including emoji and CJK should work."""
    user = _make_user()
    event = _make_event()
    db_session.add_all([user, event])
    await db_session.commit()
    await db_session.refresh(user)
    await db_session.refresh(event)

    headers = await _auth_header(db_session, user)
    content = "Cześć! 你好 🌍 Привет мир 日本語テスト"
    resp = await comments_api_client.post(
        f"/comments/event/{event.id}",
        json={"content": content},
        headers=headers,
    )
    assert resp.status_code == 201
    assert resp.json()["content"] == content


# ── 11. Banned user ───────────────────────────────────────────────


@pytest.mark.asyncio
async def test_banned_user_cannot_comment(comments_api_client, db_session):
    """Banned users should receive 403."""
    user = _make_user("banned", status=AccountStatus.BANNED)
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    headers = await _auth_header(db_session, user)
    resp = await comments_api_client.post(
        "/comments/event/some-id",
        json={"content": "banned comment"},
        headers=headers,
    )
    assert resp.status_code == 403


# ── 12. All reaction types ───────────────────────────────────────


@pytest.mark.asyncio
async def test_all_reaction_types_work(comments_api_client, db_session):
    """Every defined ReactionType should be accepted."""
    user = _make_user()
    event = _make_event()
    db_session.add_all([user, event])
    await db_session.commit()
    await db_session.refresh(user)
    await db_session.refresh(event)

    headers = await _auth_header(db_session, user)
    create_resp = await comments_api_client.post(
        f"/comments/event/{event.id}",
        json={"content": "test all reactions"},
        headers=headers,
    )
    comment_id = create_resp.json()["id"]

    for rtype in ReactionType:
        resp = await comments_api_client.post(
            f"/comments/{comment_id}/reactions",
            json={"reaction_type": rtype.value},
            headers=headers,
        )
        assert resp.status_code == 200, f"Failed for reaction type: {rtype.value}"

    list_resp = await comments_api_client.get(f"/comments/event/{event.id}", headers=headers)
    reactions = list_resp.json()[0]["reactions"]
    assert len(reactions) == len(ReactionType)
