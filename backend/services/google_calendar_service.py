from datetime import datetime, timedelta, date, timezone
from typing import Optional
import logging

import httpx

from config import get_settings
from models.event import Event
from models.user import User

settings = get_settings()
logger = logging.getLogger(__name__)


class GoogleCalendarService:
    TOKEN_URL = "https://oauth2.googleapis.com/token"
    EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events"

    def __init__(self) -> None:
        """
        Initialize the Google Calendar service with OAuth configuration checks.

        The constructor validates required Google OAuth settings and raises a
        ValueError when configuration is incomplete.
        """
        if not settings.google_client_id or not settings.google_client_secret:
            raise ValueError("Google OAuth not configured")

    async def _refresh_access_token(self, refresh_token: str) -> str | None:
        """
        Refresh a Google access token using a stored refresh token.

        The method calls Google's token endpoint and returns the access token
        or None when the request fails.
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.TOKEN_URL,
                data={
                    "client_id": settings.google_client_id,
                    "client_secret": settings.google_client_secret,
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                },
            )
            if response.status_code >= 400:
                logger.warning(
                    "GCal: token refresh failed status=%s body=%s",
                    response.status_code,
                    response.text[:200],
                )
                return None
            payload = response.json()
            return payload.get("access_token")

    def _apply_time_info(self, start_date: datetime, end_date: datetime | None, time_info: str | None) -> tuple[datetime, datetime]:
        """
        Apply free-form time info to derive start and end datetimes.

        The helper parses time ranges like "10:00-12:00" to override the event
        time window and falls back to a one-hour duration when parsing fails.
        """
        tzinfo = start_date.tzinfo
        start = start_date
        end = end_date or (start_date + timedelta(hours=1))

        if time_info:
            if "-" in time_info:
                start_str, end_str = (part.strip() for part in time_info.split("-", 1))
            else:
                start_str, end_str = time_info.strip(), None

            try:
                start_parts = start_str.split(":")
                start_hour = int(start_parts[0])
                start_minute = int(start_parts[1]) if len(start_parts) > 1 else 0
                start = start.replace(hour=start_hour, minute=start_minute, second=0, microsecond=0, tzinfo=tzinfo)
            except Exception:
                pass

            if end_str:
                try:
                    end_parts = end_str.split(":")
                    end_hour = int(end_parts[0])
                    end_minute = int(end_parts[1]) if len(end_parts) > 1 else 0
                    end = (end_date or start_date).replace(hour=end_hour, minute=end_minute, second=0, microsecond=0, tzinfo=tzinfo)
                except Exception:
                    end = start + timedelta(hours=1)
            else:
                if end_date is None:
                    end = start + timedelta(hours=1)

        return start, end

    async def create_event(self, user: User, event: Event, occurrence_date: date | None = None) -> str | None:
        """
        Create a Google Calendar event for the given user and occurrence.

        The method refreshes the user's access token, builds an event payload
        with description and reminders, and returns the created calendar event ID.
        """
        if not user.google_refresh_token:
            return None

        # Verify the stored token actually has calendar scope before trying.
        google_scopes = getattr(user, "google_scopes", "") or ""
        if "calendar.events" not in google_scopes:
            logger.warning(
                "GCal: user %s has google_refresh_token but no calendar.events scope (%s)",
                user.id,
                google_scopes[:120],
            )
            return None

        access_token = await self._refresh_access_token(user.google_refresh_token)
        if not access_token:
            return None

        start_base = event.start_date
        end_base = event.end_date
        if occurrence_date and occurrence_date != event.start_date.date():
            start_base = datetime.combine(date=occurrence_date, time=event.start_date.time())
            if event.start_date.tzinfo:
                start_base = start_base.replace(tzinfo=event.start_date.tzinfo)
            if event.end_date:
                duration = event.end_date - event.start_date
                end_base = start_base + duration
            else:
                end_base = None

        start_dt, end_dt = self._apply_time_info(
            start_date=start_base,
            end_date=end_base,
            time_info=event.time_info,
        )
        description_parts = []
        if event.description:
            description_parts.append(event.description)
        if event.location:
            description_parts.append(f"Lokalizacja: {event.location}")
        if event.city:
            description_parts.append(f"Miasto: {event.city}")
        description = "\n".join(description_parts) if description_parts else None

        payload = {
            "summary": event.title,
            "description": description,
            "location": event.location or event.city,
            "start": {
                "dateTime": start_dt.isoformat(),
            },
            "end": {
                "dateTime": end_dt.isoformat(),
            },
            "reminders": {
                "useDefault": False,
                "overrides": [
                    {"method": "popup", "minutes": 60 * 24},
                    {"method": "popup", "minutes": 60},
                ],
            },
        }

        # Ensure datetimes are timezone-aware (Google requires timezone offset)
        if start_dt.tzinfo is None:
            start_dt = start_dt.replace(tzinfo=timezone.utc)
        if end_dt.tzinfo is None:
            end_dt = end_dt.replace(tzinfo=timezone.utc)

        logger.debug(
            "GCal: creating event '%s' for user %s (occurrence=%s)",
            event.title,
            user.id,
            occurrence_date,
        )

        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.EVENTS_URL,
                headers={"Authorization": f"Bearer {access_token}"},
                json=payload,
            )
            if response.status_code >= 400:
                logger.warning(
                    "GCal: create event failed status=%s body=%s",
                    response.status_code,
                    response.text[:500],
                )
                return None
            data = response.json()
            return data.get("id")
