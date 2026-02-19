"""Simple in-memory rate limiting helpers for API endpoints."""


from collections import defaultdict, deque
from threading import Lock
from time import monotonic
from typing import Deque
from collections.abc import Callable

from fastapi import HTTPException, Request

from config import get_settings

settings = get_settings()


class SlidingWindowRateLimiter:
    """In-memory sliding-window rate limiter.

    This limiter is process-local and intended as a baseline control
    for abuse resistance in development/single-instance deployments.
    """

    def __init__(self) -> None:
        self._buckets: dict[str, Deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def clear(self) -> None:
        """
        Clear all in-memory rate-limit buckets.

        This helper resets the limiter state, primarily for tests or controlled
        resets during development.
        """
        with self._lock:
            self._buckets.clear()

    def enforce(self, key: str, limit: int, window_seconds: int = 60) -> None:
        """
        Enforce the sliding-window limit for a given key.

        The method evicts expired timestamps, checks the current count against
        the limit, and raises HTTP 429 when the window is exceeded.
        """
        if limit <= 0:
            return

        now = monotonic()
        threshold = now - window_seconds

        with self._lock:
            bucket = self._buckets[key]
            while bucket and bucket[0] <= threshold:
                bucket.popleft()

            if len(bucket) >= limit:
                raise HTTPException(status_code=429, detail="Too many requests")

            bucket.append(now)


_rate_limiter = SlidingWindowRateLimiter()


def _client_ip(request: Request) -> str:
    """
    Resolve the client IP address from trusted headers or connection info.

    The helper prefers proxy headers and falls back to the client socket host
    to support deployments behind load balancers.
    """
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        first_ip = forwarded_for.split(",", 1)[0].strip()
        if first_ip:
            return first_ip

    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()

    if request.client and request.client.host:
        return request.client.host

    return "unknown"


def enforce_rate_limit(scope: str, identifier: str, per_minute: int) -> None:
    """
    Enforce the per-minute rate limit for a scoped identifier.

    The limiter is skipped when global rate limiting is disabled in settings,
    otherwise a key is built from scope and identifier.
    """
    if not settings.rate_limit_enabled:
        return
    key = f"{scope}:{identifier}"
    _rate_limiter.enforce(key=key, limit=per_minute, window_seconds=60)


def enforce_public_ip_rate_limit(scope: str, request: Request, per_minute: int) -> None:
    """
    Enforce the per-minute rate limit keyed by client IP.

    The client IP is resolved via headers and used as the identifier for the
    underlying rate limiter.
    """
    ip = _client_ip(request)
    enforce_rate_limit(scope=scope, identifier=f"ip:{ip}", per_minute=per_minute)


def build_public_rate_limit_dependency(
    scope: str,
    per_minute_resolver: Callable[[], int],
):
    """
    Build a FastAPI dependency enforcing per-IP public endpoint limits.

    The dependency resolves the current limit at runtime and applies it to the
    requester's IP address.
    """

    async def dependency(request: Request) -> None:
        enforce_public_ip_rate_limit(
            scope=scope,
            request=request,
            per_minute=per_minute_resolver(),
        )

    return dependency


def clear_rate_limiter_state() -> None:
    """
    Reset the in-memory rate limiter state.

    This delegates to the sliding-window limiter and clears all buckets.
    """
    _rate_limiter.clear()

