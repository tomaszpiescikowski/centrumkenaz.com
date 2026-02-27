"""
Push notification service – sends Web Push messages to all admin subscriptions.

Uses pywebpush + py-vapid.  The VAPID key pair is read from settings once on
first call and cached for the lifetime of the process.
"""
import asyncio
import json
import logging
from functools import lru_cache

from pywebpush import WebPushException, webpush
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from models.push_subscription import PushSubscription

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _get_vapid_claims() -> dict | None:
    """Return VAPID claims dict, or None when VAPID is not configured."""
    settings = get_settings()
    if not settings.vapid_private_key or not settings.vapid_subject:
        return None
    return {"sub": settings.vapid_subject}


def _send_one(subscription_info: dict, payload: dict) -> None:
    """Blocking call – run inside a thread executor."""
    settings = get_settings()
    try:
        webpush(
            subscription_info=subscription_info,
            data=json.dumps(payload),
            vapid_private_key=settings.vapid_private_key,
            vapid_claims=_get_vapid_claims(),
            ttl=86400,
        )
    except WebPushException as exc:
        # 410 Gone / 404 Not Found means the subscription is no longer valid
        status = getattr(exc.response, "status_code", None) if exc.response else None
        if status in (404, 410):
            raise _ExpiredSubscriptionError() from exc
        logger.warning("WebPushException endpoint=%s status=%s", subscription_info.get("endpoint", "?")[:60], status)
        raise


class _ExpiredSubscriptionError(Exception):
    pass


async def send_to_admins(db: AsyncSession, title: str, body: str, url: str = "/admin") -> None:
    """
    Send a push notification to every active admin push subscription.

    Silently removes subscriptions that have been invalidated by the browser.
    Non-fatal errors are logged but do not propagate so the caller is never
    interrupted by a failed notification.
    """
    settings = get_settings()
    if not settings.vapid_private_key:
        logger.debug("VAPID not configured – skipping push notification")
        return

    result = await db.execute(select(PushSubscription))
    subscriptions = result.scalars().all()
    if not subscriptions:
        return

    payload = {"title": title, "body": body, "url": url, "tag": "kenaz-admin"}
    loop = asyncio.get_event_loop()
    expired_ids: list[str] = []

    for sub in subscriptions:
        subscription_info = {
            "endpoint": sub.endpoint,
            "keys": {"p256dh": sub.keys_p256dh, "auth": sub.keys_auth},
        }
        try:
            await loop.run_in_executor(None, _send_one, subscription_info, payload)
        except _ExpiredSubscriptionError:
            expired_ids.append(sub.id)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Failed to send push to sub %s: %s", sub.id, exc)

    # Clean up expired subscriptions
    for sid in expired_ids:
        sub = await db.get(PushSubscription, sid)
        if sub:
            await db.delete(sub)
    if expired_ids:
        await db.commit()
        logger.info("Removed %d expired push subscriptions", len(expired_ids))
