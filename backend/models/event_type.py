from sqlalchemy import Column, String, DateTime
from sqlalchemy.sql import func
from database import Base


class EventType(Base):
    """
    Admin-defined custom event type stored in the database.

    Built-in types are defined on the frontend (eventIcons.js).
    Custom types created here are shared across all admin browsers
    and all servers — unlike the old localStorage approach.
    """
    __tablename__ = "event_types"

    key = Column(
        String(50),
        primary_key=True,
        comment="Slug key used in Event.event_type, e.g. 'pilka_reczna'.",
    )
    label = Column(
        String(100),
        nullable=False,
        comment="Display name shown in UI, e.g. 'Piłka ręczna'.",
    )
    icon_key = Column(
        String(50),
        nullable=False,
        comment="Key into the EXTRA_ICONS map on the frontend.",
    )
    color = Column(
        String(50),
        nullable=False,
        default="text-blue-500",
        comment="Tailwind text-color class used for the icon.",
    )
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        comment="Timestamp when this custom type was created.",
    )
