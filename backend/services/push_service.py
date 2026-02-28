"""
Push notification service – sends Web Push messages to push subscriptions.

Uses pywebpush + py-vapid.  The VAPID key pair is read from settings once on
first call and cached for the lifetime of the process.

Public API
----------
send_to_admins(db, title, body, url)                              – notify all admin subscriptions
send_to_user(db, user_id, title, body, url)                       – notify one specific user (fixed text)
send_to_all_active_users(db, title, body, url)                    – notify every subscriber (fixed text)
send_event_push_to_all(db, scenario, params, url)                 – per-user translated event push to all
send_event_push_to_user(db, user_id, scenario, params, url)       – per-user translated event push to one
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
from models.user import User, UserRole
from services.push_translations import get_push_strings

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
    endpoint_short = subscription_info.get("endpoint", "?")[:80]
    logger.info("[push] Sending to endpoint=%s", endpoint_short)
    try:
        webpush(
            subscription_info=subscription_info,
            data=json.dumps(payload),
            vapid_private_key=settings.vapid_private_key,
            vapid_claims=_get_vapid_claims(),
            ttl=86400,
        )
        logger.info("[push] OK endpoint=%s", endpoint_short)
    except WebPushException as exc:
        # 410 Gone / 404 Not Found means the subscription is no longer valid
        status = getattr(exc.response, "status_code", None) if exc.response else None
        body = getattr(exc.response, "text", "") if exc.response else ""
        logger.error(
            "[push] WebPushException endpoint=%s status=%s body=%s",
            endpoint_short, status, body[:300],
        )
        if status in (404, 410):
            raise _ExpiredSubscriptionError() from exc
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
        logger.warning("[push] VAPID_PRIVATE_KEY not set – skipping push notification")
        return

    result = await db.execute(
        select(PushSubscription)
        .join(User, PushSubscription.user_id == User.id)
        .where(User.role == UserRole.ADMIN)
    )
    subscriptions = result.scalars().all()
    if not subscriptions:
        return

    payload = {"title": title, "body": body, "url": url, "tag": "kenaz-admin"}
    await _dispatch(db, subscriptions, payload)


async def send_to_user(db: AsyncSession, user_id: str, title: str, body: str, url: str = "/") -> None:
    """Send a push notification to all subscriptions belonging to *user_id*."""
    settings = get_settings()
    if not settings.vapid_private_key:
        return

    result = await db.execute(
        select(PushSubscription).where(PushSubscription.user_id == user_id)
    )
    subscriptions = result.scalars().all()
    if not subscriptions:
        return

    payload = {"title": title, "body": body, "url": url, "tag": f"kenaz-user-{user_id}"}
    await _dispatch(db, subscriptions, payload)


async def send_to_all_active_users(db: AsyncSession, title: str, body: str, url: str = "/") -> None:
    """Send a push notification to every stored subscription (all active users)."""
    settings = get_settings()
    if not settings.vapid_private_key:
        return

    result = await db.execute(select(PushSubscription))
    subscriptions = result.scalars().all()
    if not subscriptions:
        return

    payload = {"title": title, "body": body, "url": url, "tag": "kenaz-announcement"}
    await _dispatch(db, subscriptions, payload)


async def send_event_push_to_all(
    db: AsyncSession,
    scenario: str,
    params: dict[str, str],
    url: str = "/",
) -> None:
    """
    Send a translated event push notification to every subscriber.

    Each subscription is paired with its owning user's ``preferred_language``
    so every recipient gets the message in their chosen UI language.
    """
    settings = get_settings()
    if not settings.vapid_private_key:
        return

    # Fetch subscriptions joined with owner's language preference
    result = await db.execute(
        select(PushSubscription, User.preferred_language)
        .join(User, PushSubscription.user_id == User.id)
    )
    rows = result.all()
    if not rows:
        return

    loop = asyncio.get_running_loop()
    expired_ids: list[str] = []
    logger.info("[push] event push '%s' dispatching to %d subscription(s)", scenario, len(rows))

    for sub, lang in rows:
        title_str, body_str = get_push_strings(scenario, lang or "pl", params)
        payload = {
            "title": title_str,
            "body": body_str,
            "url": url,
            "tag": f"kenaz-event-{scenario}",
        }
        subscription_info = {
            "endpoint": sub.endpoint,
            "keys": {"p256dh": sub.keys_p256dh, "auth": sub.keys_auth},
        }
        try:
            await loop.run_in_executor(None, _send_one, subscription_info, payload)
        except _ExpiredSubscriptionError:
            expired_ids.append(sub.id)
        except Exception:  # noqa: BLE001
            logger.exception("[push] Failed to send event push to sub %s", sub.id)

    for sid in expired_ids:
        sub_obj = await db.get(PushSubscription, sid)
        if sub_obj:
            await db.delete(sub_obj)
    if expired_ids:
        await db.commit()
        logger.info("[push] Removed %d expired subscriptions", len(expired_ids))


async def send_event_push_to_user(
    db: AsyncSession,
    user_id: str,
    scenario: str,
    params: dict[str, str],
    url: str = "/",
) -> None:
    """
    Send a translated event push notification to a single user.

    Uses the user's ``preferred_language`` to pick the correct strings.
    """
    settings = get_settings()
    if not settings.vapid_private_key:
        return

    result = await db.execute(
        select(PushSubscription, User.preferred_language)
        .join(User, PushSubscription.user_id == User.id)
        .where(PushSubscription.user_id == user_id)
    )
    rows = result.all()
    if not rows:
        return

    loop = asyncio.get_running_loop()
    expired_ids: list[str] = []

    for sub, lang in rows:
        title_str, body_str = get_push_strings(scenario, lang or "pl", params)
        payload = {
            "title": title_str,
            "body": body_str,
            "url": url,
            "tag": f"kenaz-event-{scenario}-{user_id}",
        }
        subscription_info = {
            "endpoint": sub.endpoint,
            "keys": {"p256dh": sub.keys_p256dh, "auth": sub.keys_auth},
        }
        try:
            await loop.run_in_executor(None, _send_one, subscription_info, payload)
        except _ExpiredSubscriptionError:
            expired_ids.append(sub.id)
        except Exception:  # noqa: BLE001
            logger.exception("[push] Failed to send event push to sub %s", sub.id)

    for sid in expired_ids:
        sub_obj = await db.get(PushSubscription, sid)
        if sub_obj:
            await db.delete(sub_obj)
    if expired_ids:
        await db.commit()


async def _dispatch(db: AsyncSession, subscriptions: list, payload: dict) -> None:
    """Fire-and-forget push to a list of subscriptions, pruning expired ones."""
    loop = asyncio.get_running_loop()
    expired_ids: list[str] = []
    logger.info("[push] Dispatching to %d subscription(s), payload title=%s", len(subscriptions), payload.get("title"))

    for sub in subscriptions:
        subscription_info = {
            "endpoint": sub.endpoint,
            "keys": {"p256dh": sub.keys_p256dh, "auth": sub.keys_auth},
        }
        try:
            await loop.run_in_executor(None, _send_one, subscription_info, payload)
        except _ExpiredSubscriptionError:
            expired_ids.append(sub.id)
        except Exception:  # noqa: BLE001
            logger.exception("[push] Failed to send push to sub %s", sub.id)

    # Clean up expired subscriptions
    for sid in expired_ids:
        sub = await db.get(PushSubscription, sid)
        if sub:
            await db.delete(sub)
    if expired_ids:
        await db.commit()
        logger.info("Removed %d expired push subscriptions", len(expired_ids))
