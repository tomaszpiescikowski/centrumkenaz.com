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

from cryptography.hazmat.primitives import serialization as crypto_serialization
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from py_vapid import Vapid
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


def _normalize_vapid_subject(raw_subject: str | None) -> str | None:
    if raw_subject is None:
        return None
    subject = raw_subject.strip()
    if not subject:
        return None
    if subject.startswith("mailto:"):
        email = subject[len("mailto:"):].strip()
        return f"mailto:{email}" if "@" in email else None
    if subject.startswith("https://") or subject.startswith("http://"):
        return subject
    if "@" in subject:
        return f"mailto:{subject}"
    return None


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
    settings = get_settings()
    if not settings.vapid_private_key or not settings.vapid_public_key:
        return {
            "status": "not_configured",
            "message": "Brak kluczy VAPID na backendzie (VAPID_PRIVATE_KEY / VAPID_PUBLIC_KEY).",
            "sent": 0,
        }

    normalized_subject = _normalize_vapid_subject(settings.vapid_subject)
    if not normalized_subject:
        return {
            "status": "misconfigured_vapid",
            "message": (
                "Nieprawidłowy VAPID_SUBJECT. Ustaw np. "
                "'mailto:admin@centrumkenaz.com'."
            ),
            "sent": 0,
        }

    try:
        vapid = Vapid.from_string(settings.vapid_private_key)
        derived_public = base64.urlsafe_b64encode(
            vapid.public_key.public_bytes(
                crypto_serialization.Encoding.X962,
                crypto_serialization.PublicFormat.UncompressedPoint,
            )
        ).rstrip(b"=").decode()
    except Exception as exc:  # noqa: BLE001
        return {
            "status": "misconfigured_vapid",
            "message": f"Nieprawidłowy VAPID_PRIVATE_KEY: {exc}",
            "sent": 0,
        }

    if derived_public != settings.vapid_public_key:
        return {
            "status": "misconfigured_vapid",
            "message": "Niespójna para kluczy VAPID (private/public nie pasują do siebie).",
            "sent": 0,
        }

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
    failure_reasons = stats.get("failure_reasons", [])

    reasons_suffix = ""
    if failure_reasons:
        samples = []
        for item in failure_reasons[:3]:
            samples.append(
                f"status={item.get('status')} x{item.get('count')}: {item.get('sample')}"
            )
        reasons_suffix = " Powody: " + " | ".join(samples)

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
                f"{reasons_suffix}"
            ),
            "sent": 0,
            "attempted": attempted,
            "delivered": delivered,
            "failed": failed,
            "expired": expired,
            "failure_reasons": failure_reasons,
        }

    detail = f"attempted={attempted}, delivered={delivered}, failed={failed}, expired={expired}"
    return {
        "status": "sent" if failed == 0 and expired == 0 else "partial",
        "message": f"Push dostarczony. {detail}{reasons_suffix}",
        "sent": delivered,
        "attempted": attempted,
        "delivered": delivered,
        "failed": failed,
        "expired": expired,
        "failure_reasons": failure_reasons,
    }
