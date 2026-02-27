"""
User Action Logging Service
============================

Writes structured per-user, per-day log files to the ``logs/`` directory.

File layout::

    logs/
        27-02-2026/
            tomasz.piescikowski@gmail.com.log   ← authenticated user actions
            _system.log                          ← webhooks / unauthenticated

Log line format::

    [2026-02-27 14:35:22.451 UTC] ACTION_NAME | user=tomasz@mail.com | ip=1.2.3.4 | key=value | ...

Usage::

    from services.log_service import log_action

    await log_action(
        action="PAYMENT_CREATED",
        user_email="tomasz@mail.com",
        ip="1.2.3.4",
        payment_id="pay_123",
        amount="49.00 PLN",
        type="subscription",
    )
"""

from __future__ import annotations

import asyncio
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# Root of the project — logs/ sits next to the backend/ folder
_BACKEND_DIR = Path(__file__).resolve().parent.parent
_LOGS_ROOT = _BACKEND_DIR.parent / "logs"

# Global asyncio lock map: one lock per log file path, prevents interleaved writes
_LOCKS: dict[str, asyncio.Lock] = {}
_LOCKS_META_LOCK = asyncio.Lock()


def _safe_filename(email: str) -> str:
    """Sanitise an email address so it is safe to use as a filename."""
    return re.sub(r"[/\\:*?\"<>|]", "_", email)


def _day_folder() -> Path:
    """Return today's log folder, creating it if needed."""
    today = datetime.now(timezone.utc).strftime("%d-%m-%Y")
    folder = _LOGS_ROOT / today
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def _log_file_path(user_email: str | None) -> Path:
    """Return the Path of the log file for ``user_email`` today."""
    folder = _day_folder()
    if user_email:
        filename = _safe_filename(user_email.lower()) + ".log"
    else:
        filename = "_system.log"
    return folder / filename


async def _get_lock(path: str) -> asyncio.Lock:
    """Return (create if missing) an asyncio.Lock for a given file path."""
    async with _LOCKS_META_LOCK:
        if path not in _LOCKS:
            _LOCKS[path] = asyncio.Lock()
        return _LOCKS[path]


def _format_line(
    action: str,
    user_email: str | None,
    ip: str | None,
    extra: dict[str, Any],
) -> str:
    """Build a single log line."""
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S.%f")[:-3] + " UTC"
    parts = [f"[{ts}]", action.upper()]
    parts.append(f"user={user_email or 'anonymous'}")
    if ip:
        parts.append(f"ip={ip}")
    for k, v in extra.items():
        if v is None:
            continue
        parts.append(f"{k}={v}")
    return " | ".join(parts)


async def log_action(
    action: str,
    user_email: str | None = None,
    ip: str | None = None,
    **extra: Any,
) -> None:
    """
    Append one log line to the correct per-user file.

    This coroutine is safe to call from any async endpoint — it acquires a
    per-file lock so concurrent writes never interleave.

    Parameters
    ----------
    action:     Short SCREAMING_SNAKE_CASE identifier, e.g. ``"PAYMENT_CREATED"``.
    user_email: Authenticated user's email.  ``None`` → written to ``_system.log``.
    ip:         Client IP address from the request.
    **extra:    Arbitrary key=value pairs appended to the log line.
    """
    line = _format_line(action, user_email, ip, extra)
    path = _log_file_path(user_email)
    lock = await _get_lock(str(path))
    async with lock:
        await asyncio.to_thread(_write_line, path, line)


def _write_line(path: Path, line: str) -> None:
    """Synchronous file write — called via asyncio.to_thread."""
    with open(path, "a", encoding="utf-8") as fh:
        fh.write(line + "\n")


def _get_request_ip(request: Any) -> str | None:
    """Extract the real client IP from a FastAPI Request, respecting X-Forwarded-For."""
    if request is None:
        return None
    forwarded = getattr(request.headers, "get", lambda _k, _d=None: _d)("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    client = getattr(request, "client", None)
    if client:
        return getattr(client, "host", None)
    return None


def user_email_from(user: Any) -> str | None:
    """Return a user's email from a User ORM object or None."""
    return getattr(user, "email", None)
