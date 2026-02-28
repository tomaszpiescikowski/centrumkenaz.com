"""
In-process WebSocket connection manager for real-time chat notifications.

A single shared `manager` instance tracks every active connection grouped by
chat_id (e.g. "general:global" or "event:<uuid>").  When a new comment is
created, the comments router calls `manager.broadcast(chat_id, payload)` to
push a lightweight notification to all connected subscribers — avoiding the
need for any client polling.

This is an in-process store, so it works correctly for single-worker uvicorn
deployments (our production setup).  Multi-worker deployments would need a
shared pub/sub layer (Redis, etc.) instead.
"""

from __future__ import annotations

import asyncio
import logging
from collections import defaultdict

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Maps chat_id → set of active WebSocket connections."""

    def __init__(self) -> None:
        self._subs: dict[str, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def subscribe(self, ws: WebSocket, chat_ids: list[str]) -> None:
        """Add *ws* to every chat channel in *chat_ids*."""
        async with self._lock:
            for chat_id in chat_ids:
                self._subs[chat_id].add(ws)

    async def unsubscribe(self, ws: WebSocket) -> None:
        """Remove *ws* from all channels (called on disconnect)."""
        async with self._lock:
            for connections in self._subs.values():
                connections.discard(ws)

    async def resubscribe(self, ws: WebSocket, chat_ids: list[str]) -> None:
        """Replace the subscription set for *ws* with *chat_ids*."""
        await self.unsubscribe(ws)
        await self.subscribe(ws, chat_ids)

    async def send_to(self, ws: WebSocket, data: dict) -> None:
        """Send *data* to a single specific WebSocket connection."""
        try:
            await ws.send_json(data)
        except Exception:  # noqa: BLE001 – stale connection
            pass

    async def broadcast(self, chat_id: str, data: dict, exclude: WebSocket | None = None) -> None:
        """Send *data* as JSON to every client subscribed to *chat_id*.

        Pass *exclude* to skip one specific connection (e.g. the sender when
        a separate ``message_sent`` acknowledgement is already sent directly).

        Dead connections are silently removed so they do not accumulate.
        """
        conns = set(self._subs.get(chat_id, set()))
        if not conns:
            return

        dead: set[WebSocket] = set()
        for ws in conns:
            if ws is exclude:
                continue
            try:
                await ws.send_json(data)
            except Exception:  # noqa: BLE001 – stale connection
                dead.add(ws)

        if dead:
            async with self._lock:
                for ws in dead:
                    for connections in self._subs.values():
                        connections.discard(ws)


# Singleton used across the application
manager = ConnectionManager()
