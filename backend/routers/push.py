"""
Push notification router.

Endpoints
---------
GET  /push/vapid-public-key   – Public, returns VAPID public key for browser subscription.
POST /push/subscribe           – Save (or refresh) a push subscription (admin only).
DELETE /push/subscribe         – Remove a push subscription (admin only).
"""
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


@router.post("/test")
async def test_push(
    user: AdminUser,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Send a test push notification to the requesting admin's own subscriptions.
    Returns diagnostic info so the caller knows what happened.
    """
    result = await db.execute(
        select(PushSubscription).where(PushSubscription.user_id == str(user.id))
    )
    subs = result.scalars().all()

    if not subs:
        return {
            "status": "no_subscriptions",
            "message": f"Brak subskrypcji push dla użytkownika {user.email}. Wejdź na /me i kliknij 'Włącz powiadomienia push'.",
            "sent": 0,
        }

    stats = await push_service.send_to_user(
        db,
        str(user.id),
        "\U0001f514 Test push",
        "Jeśli to widzisz, push działa poprawnie!",
        "/admin",
    )

    attempted = int(stats.get("attempted", 0))
    delivered = int(stats.get("delivered", 0))
    failed = int(stats.get("failed", 0))
    expired = int(stats.get("expired", 0))

    if attempted == 0:
        return {
            "status": "not_configured",
            "message": "Push nie został wysłany (sprawdź konfigurację VAPID po stronie backendu).",
            "sent": 0,
            "attempted": attempted,
            "delivered": delivered,
            "failed": failed,
            "expired": expired,
        }

    if delivered == 0:
        return {
            "status": "delivery_failed",
            "message": (
                "Nie udało się dostarczyć push. "
                f"attempted={attempted}, failed={failed}, expired={expired}."
            ),
            "sent": 0,
            "attempted": attempted,
            "delivered": delivered,
            "failed": failed,
            "expired": expired,
        }

    detail = f"attempted={attempted}, delivered={delivered}, failed={failed}, expired={expired}"
    return {
        "status": "sent" if failed == 0 and expired == 0 else "partial",
        "message": f"Push dostarczony. {detail}",
        "sent": delivered,
        "attempted": attempted,
        "delivered": delivered,
        "failed": failed,
        "expired": expired,
    }
