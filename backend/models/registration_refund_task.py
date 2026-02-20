import uuid

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database import Base


class RegistrationRefundTask(Base):
    """
    Capture refund review state for a cancelled registration.

    This model stores eligibility flags, admin decisions, and audit metadata
    so manual refunds can be tracked independently of payment status.
    """
    __tablename__ = "registration_refund_tasks"

    id = Column(
        String(36),
        primary_key=True,
        index=True,
        default=lambda: str(uuid.uuid4()),
        comment="Primary key UUID for the refund task.",
    )
    registration_id = Column(
        String(36),
        ForeignKey("registrations.id"),
        nullable=False,
        unique=True,
        index=True,
        comment="FK to the cancelled registration.",
    )
    user_id = Column(
        String(36),
        ForeignKey("users.id"),
        nullable=False,
        index=True,
        comment="FK to the user requesting refund.",
    )
    event_id = Column(
        String(36),
        ForeignKey("events.id"),
        nullable=False,
        index=True,
        comment="FK to the related event.",
    )
    occurrence_date = Column(
        Date,
        nullable=False,
        comment="Occurrence date associated with the refund task.",
    )

    refund_eligible = Column(
        Boolean,
        default=False,
        nullable=False,
        comment="Computed eligibility for refund.",
    )
    recommended_should_refund = Column(
        Boolean,
        default=False,
        nullable=False,
        comment="System recommendation for refund decision.",
    )
    should_refund = Column(
        Boolean,
        default=False,
        nullable=False,
        comment="Admin decision to issue refund.",
    )
    refund_marked_paid = Column(
        Boolean,
        default=False,
        nullable=False,
        index=True,
        comment="Whether refund was paid out.",
    )

    override_reason = Column(
        Text,
        nullable=True,
        comment="Reason for admin override of recommendation.",
    )
    reviewed_by_admin_id = Column(
        String(36),
        ForeignKey("users.id"),
        nullable=True,
        comment="FK to admin who reviewed the task.",
    )
    reviewed_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when task was reviewed.",
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        comment="Timestamp when the refund task was created.",
    )
    updated_at = Column(
        DateTime(timezone=True),
        onupdate=func.now(),
        comment="Timestamp of the last update.",
    )

    registration = relationship("Registration")
    user = relationship("User", foreign_keys=[user_id])
    event = relationship("Event")
    reviewed_by_admin = relationship("User", foreign_keys=[reviewed_by_admin_id])

