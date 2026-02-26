"""
Event types router – custom activity type management.

Public:
  GET  /event-types                   – list all custom event types (for calendar, pickers)

Admin:
  POST /event-types/admin             – create a new custom type
  DELETE /event-types/admin/{key}     – delete a type; updates all events using it to "inne"
"""
import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.event import Event
from models.event_type import EventType
from models.user import User
from security.guards import get_admin_user_dependency

router = APIRouter(prefix="/event-types", tags=["event-types"])


def _slugify(label: str) -> str:
    s = label.strip().lower()
    for src, dst in [
        ('ą','a'),('ć','c'),('ę','e'),('ł','l'),
        ('ń','n'),('ó','o'),('ś','s'),('ź','z'),('ż','z'),
    ]:
        s = s.replace(src, dst)
    s = re.sub(r'\s+', '_', s)
    s = re.sub(r'[^a-z0-9_]', '', s)
    s = s.strip('_')
    return s


class EventTypeCreate(BaseModel):
    label: str = Field(min_length=1, max_length=100, description="Display name.")
    icon_key: str = Field(min_length=1, max_length=50, description="Key into EXTRA_ICONS on the frontend.")
    color: str = Field(min_length=1, max_length=50, description="Tailwind text color class.")

    @field_validator('color')
    @classmethod
    def validate_color(cls, v: str) -> str:
        if not v.startswith('text-'):
            raise ValueError('color must be a Tailwind text-color class starting with "text-"')
        return v


class EventTypeResponse(BaseModel):
    key: str
    label: str
    icon_key: str
    color: str


@router.get("", response_model=list[EventTypeResponse])
async def list_event_types(db: AsyncSession = Depends(get_db)):
    """Return all custom event types (public, no auth required)."""
    result = await db.execute(select(EventType).order_by(EventType.created_at))
    types = result.scalars().all()
    return [
        EventTypeResponse(key=t.key, label=t.label, icon_key=t.icon_key, color=t.color)
        for t in types
    ]


@router.post("/admin", response_model=EventTypeResponse, status_code=201)
async def create_event_type(
    payload: EventTypeCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user_dependency),
):
    """
    Create a new custom event type.

    The key is auto-generated as a URL-safe slug from the label.
    A numeric suffix is appended if a collision occurs.
    """
    base_key = _slugify(payload.label)
    if not base_key:
        raise HTTPException(status_code=422, detail="Label produces an empty key after slugification.")

    # Resolve key collisions
    candidate = base_key
    counter = 2
    while True:
        existing = await db.execute(select(EventType).where(EventType.key == candidate))
        if not existing.scalar_one_or_none():
            break
        candidate = f"{base_key}_{counter}"
        counter += 1

    et = EventType(key=candidate, label=payload.label.strip(), icon_key=payload.icon_key, color=payload.color)
    db.add(et)
    await db.commit()
    await db.refresh(et)
    return EventTypeResponse(key=et.key, label=et.label, icon_key=et.icon_key, color=et.color)


@router.delete("/admin/{key}", status_code=200)
async def delete_event_type(
    key: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user_dependency),
):
    """
    Delete a custom event type.

    All events currently using this type are reassigned to 'inne' so
    existing data is never lost or broken.
    """
    existing = await db.execute(select(EventType).where(EventType.key == key))
    et = existing.scalar_one_or_none()
    if not et:
        raise HTTPException(status_code=404, detail="Event type not found.")

    # Reassign affected events before deleting the type
    result = await db.execute(
        update(Event)
        .where(Event.event_type == key)
        .values(event_type="inne")
        .returning(Event.id)
    )
    affected = len(result.fetchall())

    await db.delete(et)
    await db.commit()
    return {"ok": True, "affected_events": affected}
