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
import re
from functools import lru_cache

from pywebpush import WebPushException, webpush
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from models.push_subscription import PushSubscription
from models.user import User, UserRole
from services.push_translations import get_push_strings

logger = logging.getLogger(__name__)


def _extract_webpush_status(exc: WebPushException) -> int | None:
    """Best-effort status extraction from pywebpush exception."""
    if getattr(exc, "response", None) is not None:
        status = getattr(exc.response, "status_code", None)
        if isinstance(status, int):
            return status

    # pywebpush sometimes includes HTTP code only in exception text.
    msg = str(exc)
    m = re.search(r"Push failed:\s*(\d{3})\b", msg, flags=re.IGNORECASE)
    if m:
        try:
            return int(m.group(1))
        except ValueError:
            return None
    return None


def _normalize_vapid_subject(raw_subject: str | None) -> str | None:
    """Normalize VAPID subject claim to a valid URI value."""
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

    # Accept plain email in env and normalize it automatically.
    if "@" in subject:
        return f"mailto:{subject}"

    return None


@lru_cache(maxsize=1)
def _get_vapid_claims() -> dict | None:
    """Return VAPID claims dict, or None when VAPID is not configured."""
    settings = get_settings()
    if not settings.vapid_private_key:
        return None
    subject = _normalize_vapid_subject(settings.vapid_subject)
    if not subject:
        logger.error(
            "[push] Invalid VAPID_SUBJECT=%r. Expected e.g. 'mailto:admin@example.com'.",
            settings.vapid_subject,
        )
        return None
    return {"sub": subject}


def _send_one(subscription_info: dict, payload: dict) -> None:
    """Blocking call – run inside a thread executor."""
    settings = get_settings()
    vapid_claims = _get_vapid_claims()
    if not vapid_claims:
        raise _PushSendError(
            "Invalid VAPID_SUBJECT. Set VAPID_SUBJECT to e.g. 'mailto:admin@centrumkenaz.com'.",
            status=None,
            body="",
        )

    endpoint_short = subscription_info.get("endpoint", "?")[:80]
    logger.info("[push] Sending to endpoint=%s", endpoint_short)
    try:
        webpush(
            subscription_info=subscription_info,
            data=json.dumps(payload),
            vapid_private_key=settings.vapid_private_key,
            vapid_claims=vapid_claims,
            ttl=86400,
        )
        logger.info("[push] OK endpoint=%s", endpoint_short)
    except WebPushException as exc:
        # 410 Gone / 404 Not Found means the subscription is no longer valid
        status = _extract_webpush_status(exc)
        body = getattr(exc.response, "text", "") if getattr(exc, "response", None) else str(exc)
        logger.error(
            "[push] WebPushException endpoint=%s status=%s body=%s",
            endpoint_short, status, body[:300],
        )
        if status in (404, 410):
            raise _ExpiredSubscriptionError() from exc
        raise _PushSendError(str(exc), status=status, body=body) from exc
    except Exception as exc:  # noqa: BLE001
        logger.exception("[push] Unexpected exception endpoint=%s", endpoint_short)
        raise _PushSendError(str(exc), status=None, body="") from exc


class _ExpiredSubscriptionError(Exception):
    pass


class _PushSendError(Exception):
    def __init__(self, message: str, status: int | None = None, body: str = ""):
        super().__init__(message)
        self.status = status
        self.body = body


def _empty_stats() -> dict:
    return {
        "attempted": 0,
        "delivered": 0,
        "expired": 0,
        "failed": 0,
        "failure_reasons": [],
    }


def _collect_failure_reason(stats: dict, err: _PushSendError) -> None:
    reasons = stats.setdefault("failure_reasons", [])
    status_key = err.status if err.status is not None else "unknown"
    sample = (err.body or str(err)).replace("\n", " ").strip()[:220]
    for item in reasons:
        if item.get("status") == status_key and item.get("sample") == sample:
            item["count"] = int(item.get("count", 0)) + 1
            return
    reasons.append(
        {
            "status": status_key,
            "count": 1,
            "sample": sample,
        }
    )


async def send_to_admins(db: AsyncSession, title: str, body: str, url: str = "/admin") -> dict:
    """
    Send a push notification to every active admin push subscription.

    Silently removes subscriptions that have been invalidated by the browser.
    Non-fatal errors are logged but do not propagate so the caller is never
    interrupted by a failed notification.
    """
    settings = get_settings()
    if not settings.vapid_private_key:
        logger.warning("[push] VAPID_PRIVATE_KEY not set – skipping push notification")
        return _empty_stats()

    result = await db.execute(
        select(PushSubscription)
        .join(User, PushSubscription.user_id == User.id)
        .where(User.role == UserRole.ADMIN)
    )
    subscriptions = result.scalars().all()
    if not subscriptions:
        return _empty_stats()

    payload = {"title": title, "body": body, "url": url, "tag": "kenaz-admin"}
    return await _dispatch(db, subscriptions, payload)


async def send_to_user(db: AsyncSession, user_id: str, title: str, body: str, url: str = "/") -> dict:
    """Send a push notification to all subscriptions belonging to *user_id*."""
    settings = get_settings()
    if not settings.vapid_private_key:
        return _empty_stats()

    result = await db.execute(
        select(PushSubscription).where(PushSubscription.user_id == user_id)
    )
    subscriptions = result.scalars().all()
    if not subscriptions:
        return _empty_stats()

    payload = {"title": title, "body": body, "url": url, "tag": f"kenaz-user-{user_id}"}
    return await _dispatch(db, subscriptions, payload)


async def send_to_all_active_users(db: AsyncSession, title: str, body: str, url: str = "/") -> dict:
    """Send a push notification to every stored subscription (all active users)."""
    settings = get_settings()
    if not settings.vapid_private_key:
        return _empty_stats()

    result = await db.execute(select(PushSubscription))
    subscriptions = result.scalars().all()
    if not subscriptions:
        return _empty_stats()

    payload = {"title": title, "body": body, "url": url, "tag": "kenaz-announcement"}
    return await _dispatch(db, subscriptions, payload)


async def send_event_push_to_all(
    db: AsyncSession,
    scenario: str,
    params: dict[str, str],
    url: str = "/",
) -> dict:
    """
    Send a translated event push notification to every subscriber.

    Each subscription is paired with its owning user's ``preferred_language``
    so every recipient gets the message in their chosen UI language.
    """
    settings = get_settings()
    if not settings.vapid_private_key:
        return _empty_stats()

    # Fetch subscriptions joined with owner's language preference
    result = await db.execute(
        select(PushSubscription, User.preferred_language)
        .join(User, PushSubscription.user_id == User.id)
    )
    rows = result.all()
    if not rows:
        return _empty_stats()

    loop = asyncio.get_running_loop()
    expired_ids: list[str] = []
    stats = _empty_stats()
    stats["attempted"] = len(rows)
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
            stats["delivered"] += 1
        except _ExpiredSubscriptionError:
            expired_ids.append(sub.id)
            stats["expired"] += 1
        except _PushSendError as exc:
            stats["failed"] += 1
            _collect_failure_reason(stats, exc)
            logger.exception("[push] Failed to send event push to sub %s", sub.id)
        except Exception:  # noqa: BLE001
            stats["failed"] += 1
            logger.exception("[push] Failed to send event push to sub %s", sub.id)

    for sid in expired_ids:
        sub_obj = await db.get(PushSubscription, sid)
        if sub_obj:
            await db.delete(sub_obj)
    if expired_ids:
        await db.commit()
        logger.info("[push] Removed %d expired subscriptions", len(expired_ids))
    return stats


async def send_event_push_to_user(
    db: AsyncSession,
    user_id: str,
    scenario: str,
    params: dict[str, str],
    url: str = "/",
) -> dict:
    """
    Send a translated event push notification to a single user.

    Uses the user's ``preferred_language`` to pick the correct strings.
    """
    settings = get_settings()
    if not settings.vapid_private_key:
        return _empty_stats()

    result = await db.execute(
        select(PushSubscription, User.preferred_language)
        .join(User, PushSubscription.user_id == User.id)
        .where(PushSubscription.user_id == user_id)
    )
    rows = result.all()
    if not rows:
        return _empty_stats()

    loop = asyncio.get_running_loop()
    expired_ids: list[str] = []
    stats = _empty_stats()
    stats["attempted"] = len(rows)

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
            stats["delivered"] += 1
        except _ExpiredSubscriptionError:
            expired_ids.append(sub.id)
            stats["expired"] += 1
        except _PushSendError as exc:
            stats["failed"] += 1
            _collect_failure_reason(stats, exc)
            logger.exception("[push] Failed to send event push to sub %s", sub.id)
        except Exception:  # noqa: BLE001
            stats["failed"] += 1
            logger.exception("[push] Failed to send event push to sub %s", sub.id)

    for sid in expired_ids:
        sub_obj = await db.get(PushSubscription, sid)
        if sub_obj:
            await db.delete(sub_obj)
    if expired_ids:
        await db.commit()
    return stats


async def _dispatch(db: AsyncSession, subscriptions: list, payload: dict) -> dict:
    """Dispatch push to a list of subscriptions, pruning expired ones."""
    loop = asyncio.get_running_loop()
    expired_ids: list[str] = []
    stats = _empty_stats()
    stats["attempted"] = len(subscriptions)
    logger.info("[push] Dispatching to %d subscription(s), payload title=%s", len(subscriptions), payload.get("title"))

    for sub in subscriptions:
        subscription_info = {
            "endpoint": sub.endpoint,
            "keys": {"p256dh": sub.keys_p256dh, "auth": sub.keys_auth},
        }
        try:
            await loop.run_in_executor(None, _send_one, subscription_info, payload)
            stats["delivered"] += 1
        except _ExpiredSubscriptionError:
            expired_ids.append(sub.id)
            stats["expired"] += 1
        except _PushSendError as exc:
            stats["failed"] += 1
            _collect_failure_reason(stats, exc)
            logger.exception("[push] Failed to send push to sub %s", sub.id)
        except Exception:  # noqa: BLE001
            stats["failed"] += 1
            logger.exception("[push] Failed to send push to sub %s", sub.id)

    # Clean up expired subscriptions
    for sid in expired_ids:
        sub = await db.get(PushSubscription, sid)
        if sub:
            await db.delete(sub)
    if expired_ids:
        await db.commit()
        logger.info("Removed %d expired push subscriptions", len(expired_ids))
    return stats
