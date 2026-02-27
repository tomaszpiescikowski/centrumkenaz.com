"""
User Action Logging Service
============================

Writes structured per-user, per-day log files to the ``logs/`` directory.

File layout::

    logs/
        27-02-2026/
            tomasz.piescikowski@gmail.com.log   <- per-user actions
            _system.log                          <- webhooks / anonymous actions

Log line format::

    [2026-02-27 14:35:22.451 UTC] ACTION_NAME | user=email | ip=1.2.3.4 | key=value

Usage::

    from services.log_service import log_action

    await log_action(
        action="PAYMENT_CREATED",
        user_email="tomasz@mail.com",
        ip="1.2.3.4",
        payment_id="pay_123",
        amount="49.00 PLN",
    )
"""

from __future__ import annotations

import asyncio
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

_BACKEND_DIR = Path(__file__).resolve().parent.parent
_LOGS_ROOT = _BACKEND_DIR.parent / "logs"

_file_locks: dict[str, asyncio.Lock] = {}
_file_locks_registry_lock = asyncio.Lock()


def _sanitise_email_for_filename(email: str) -> str:
    """
    Sanitise an email address so it is safe to use as a filesystem filename.

    Replaces characters forbidden on Windows, macOS, and Linux filesystems
    with underscores so the resulting name is portable across platforms.
    """
    return re.sub(pattern=r"[/\\:*?\"<>|]", repl="_", string=email)


def _todays_log_folder() -> Path:
    """
    Return today's UTC log directory, creating it on the filesystem if absent.

    The directory is named in DD-MM-YYYY format so log folders remain
    human-readable and sort chronologically when listed.
    """
    today_label = datetime.now(timezone.utc).strftime("%d-%m-%Y")
    folder = _LOGS_ROOT / today_label
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def _resolve_log_file_path(user_email: str | None) -> Path:
    """
    Resolve the log file path for the given user email and today's date.

    Authenticated users receive a dedicated file named after their lowercase
    email. Unauthenticated or system-level actions are written to _system.log.
    """
    folder = _todays_log_folder()
    if user_email:
        filename = _sanitise_email_for_filename(user_email.lower()) + ".log"
    else:
        filename = "_system.log"
    return folder / filename


async def _get_or_create_file_lock(file_path: str) -> asyncio.Lock:
    """
    Return the asyncio.Lock associated with a log file path, creating it lazily.

    A registry-level meta-lock ensures that lock objects are created atomically,
    so exactly one Lock exists per file path even under high concurrency.
    """
    async with _file_locks_registry_lock:
        if file_path not in _file_locks:
            _file_locks[file_path] = asyncio.Lock()
        return _file_locks[file_path]


def _build_log_line(
    action: str,
    user_email: str | None,
    ip: str | None,
    extra: dict[str, Any],
) -> str:
    """
    Format a structured log line from the given action, identity, and context fields.

    The timestamp is expressed in UTC. Extra keyword arguments are appended as
    ``key=value`` pairs; entries whose value is None are silently omitted.
    """
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S.%f")[:-3] + " UTC"
    parts: list[str] = [f"[{timestamp}]", action.upper()]
    parts.append(f"user={user_email or 'anonymous'}")
    if ip:
        parts.append(f"ip={ip}")
    for key, value in extra.items():
        if value is not None:
            parts.append(f"{key}={value}")
    return " | ".join(parts)


def _append_line_to_file(path: Path, line: str) -> None:
    """
    Append a single log line to a file, creating it if it does not exist.

    This function is intentionally synchronous because it is invoked through
    asyncio.to_thread and must not use async primitives.
    """
    with open(file=path, mode="a", encoding="utf-8") as log_file:
        log_file.write(line + "\n")


async def log_action(
    action: str,
    user_email: str | None = None,
    ip: str | None = None,
    **extra: Any,
) -> None:
    """
    Append one structured log line to the correct per-user daily log file.

    Safe to call concurrently from multiple async endpoint handlers — a
    per-file asyncio lock prevents interleaved writes, and the actual file I/O
    is offloaded to a thread via asyncio.to_thread to avoid blocking the event loop.
    """
    line = _build_log_line(
        action=action,
        user_email=user_email,
        ip=ip,
        extra=extra,
    )
    log_path = _resolve_log_file_path(user_email)
    file_lock = await _get_or_create_file_lock(file_path=str(log_path))
    async with file_lock:
        await asyncio.to_thread(_append_line_to_file, log_path, line)


def _get_request_ip(request: Any) -> str | None:
    """
    Extract the real client IP address from a FastAPI Request object.

    Checks the X-Forwarded-For header first to support reverse-proxy deployments
    where the real client address is forwarded. Falls back to the direct connection
    host. Returns None when the request is absent or no IP can be determined.
    """
    if request is None:
        return None
    forwarded_for_header = request.headers.get("X-Forwarded-For")
    if forwarded_for_header:
        return forwarded_for_header.split(",")[0].strip()
    client_connection = getattr(request, "client", None)
    return getattr(client_connection, "host", None) if client_connection else None


def user_email_from(user: Any) -> str | None:
    """
    Extract the email address from a User ORM object.

    Returns None when the argument is None or does not expose an email attribute,
    which covers anonymous and system-level log events.
    """
    return getattr(user, "email", None)
