"""Temporary feedback table for early-access user opinions."""

import uuid

from sqlalchemy import Column, String, Text, DateTime
from sqlalchemy.sql import func
from database import Base


class Feedback(Base):
    """
    Lightweight table for collecting user feedback during the early
    testing phase.  Intentionally simple — just email + comment.
    This table (and all related code) is meant to be removed once the
    feedback campaign is over.
    """

    __tablename__ = "feedback"

    id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    email = Column(String(255), nullable=False)
    comment = Column(Text, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
