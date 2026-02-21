"""Announcement model – admin-posted notices visible to all members."""

import uuid

from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class Announcement(Base):
    """
    Admin-created announcement displayed on the events/announcements
    split view.  Each announcement references the admin who posted it
    so the frontend can show their name and avatar.
    """

    __tablename__ = "announcements"

    id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        comment="Primary key UUID for the announcement.",
    )
    title = Column(
        String(255),
        nullable=False,
        comment="Short headline for the announcement.",
    )
    content = Column(
        Text,
        nullable=False,
        comment="Full body text of the announcement.",
    )
    author_id = Column(
        String(36),
        ForeignKey("users.id"),
        nullable=False,
        comment="Admin user who created this announcement.",
    )
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="Timestamp when the announcement was created.",
    )

    # Relationships
    author = relationship("User", lazy="joined")
