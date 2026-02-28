"""
Push notification router.

Endpoints
---------
GET  /push/vapid-public-key   – Public, returns VAPID public key for browser subscription.
POST /push/subscribe           – Save (or refresh) a push subscription (admin only).
DELETE /push/subscribe         – Remove a push subscription (admin only).
"""
import base64
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from database import get_db
from models.push_subscription import PushSubscription
from models.user import User
from security.guards import get_active_user_dependency, AdminUser
from services import push_service

router = APIRouter(prefix="/push", tags=["push"])


# ──────────────────────────────────────────────────────────────────────────────
# Pydantic schemas
# ──────────────────────────────────────────────────────────────────────────────

class PushSubscriptionKeys(BaseModel):
    p256dh: str
    auth: str


class PushSubscribeRequest(BaseModel):
    endpoint: str
    keys: PushSubscriptionKeys


# ──────────────────────────────────────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/vapid-public-key")
async def get_vapid_public_key() -> dict:
    """
    Return the VAPID public key in base64url format.

    The browser uses this key when calling PushManager.subscribe() to encrypt
    the push subscription so only our server can send messages to it.
    """
    settings = get_settings()
    if not settings.vapid_public_key:
        raise HTTPException(status_code=503, detail="Push notifications not configured")
    return {"public_key": settings.vapid_public_key}


@router.post("/subscribe", status_code=204)
async def subscribe(
    payload: PushSubscribeRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_active_user_dependency),
) -> None:
    """
    Upsert a push subscription for the authenticated active user.

    If the endpoint already exists (e.g. after a page refresh) the keys are
    refreshed in place.  New endpoints create a new row.
    """
    result = await db.execute(
        select(PushSubscription).where(PushSubscription.endpoint == payload.endpoint)
    )
    sub = result.scalar_one_or_none()

    if sub:
        # Refresh keys for existing endpoint
        sub.keys_p256dh = payload.keys.p256dh
        sub.keys_auth = payload.keys.auth
        sub.user_id = str(user.id)
    else:
        sub = PushSubscription(
            id=str(uuid.uuid4()),
            user_id=str(user.id),
            endpoint=payload.endpoint,
            keys_p256dh=payload.keys.p256dh,
            keys_auth=payload.keys.auth,
        )
        db.add(sub)

    await db.commit()


@router.delete("/subscribe", status_code=204)
async def unsubscribe(
    payload: PushSubscribeRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_active_user_dependency),
) -> None:
    """Remove a push subscription for the authenticated user."""
    result = await db.execute(
        select(PushSubscription).where(
            PushSubscription.endpoint == payload.endpoint,
            PushSubscription.user_id == str(user.id),
        )
    )
    sub = result.scalar_one_or_none()
    if sub:
        await db.delete(sub)
        await db.commit()


@router.post("/test", status_code=204)
async def test_push(
    user: AdminUser,
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Send a test push notification to the requesting admin's own subscriptions.

    Useful for verifying that VAPID keys, pywebpush, and the browser
    service worker are all wired up correctly.
    """
    await push_service.send_to_user(
        db,
        str(user.id),
        "\U0001f514 Test push",
        "Je\u015bli to widzisz, push dzia\u0142a poprawnie!",
        "/admin",
    )
