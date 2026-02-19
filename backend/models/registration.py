import enum
import uuid

from sqlalchemy import Column, String, DateTime, Date, ForeignKey, UniqueConstraint, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class RegistrationStatus(str, enum.Enum):
    PENDING = "pending"  # Payment in progress
    CONFIRMED = "confirmed"  # Payment successful
    MANUAL_PAYMENT_REQUIRED = "manual_payment_required"  # User must complete manual payment steps
    MANUAL_PAYMENT_VERIFICATION = "manual_payment_verification"  # User declared payment; admin verification pending
    WAITLIST = "waitlist"  # Added to waiting list when event is full
    CANCELLED = "cancelled"  # User cancelled
    REFUNDED = "refunded"  # Money returned


class Registration(Base):
    """
    Track a user's registration for a specific event occurrence.

    This model records status transitions, payment linkage, and waitlist or
    manual payment metadata so services can enforce capacity and policies.
    """
    __tablename__ = "registrations"

    id = Column(
        String(36),
        primary_key=True,
        index=True,
        default=lambda: str(uuid.uuid4()),
        comment="Primary key UUID for the registration.",
    )
    user_id = Column(
        String(36),
        ForeignKey("users.id"),
        nullable=False,
        comment="FK to the registering user.",
    )
    event_id = Column(
        String(36),
        ForeignKey("events.id"),
        nullable=False,
        comment="FK to the registered event.",
    )
    occurrence_date = Column(
        Date,
        nullable=False,
        comment="Date of the event occurrence for this registration.",
    )

    status = Column(
        String(64),
        default=RegistrationStatus.PENDING.value,
        comment="Current registration status.",
    )
    payment_id = Column(
        String(255),
        nullable=True,
        comment="External payment ID for gateway linkage.",
    )  # External payment ID
    calendar_event_id = Column(
        String(255),
        nullable=True,
        comment="Google Calendar event identifier.",
    )
    manual_payment_confirmed_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when manual payment was declared.",
    )
    promoted_from_waitlist_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when waitlisted user was promoted.",
    )
    manual_payment_due_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="Deadline for completing manual payment.",
    )
    waitlist_notification_sent = Column(
        Boolean,
        default=False,
        nullable=False,
        comment="Whether a waitlist notification was sent.",
    )
    waitlist_notified_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when waitlist notification was sent.",
    )

    # Marks rows created by seed/test tooling so they can be safely wiped.
    is_test_data = Column(
        Boolean,
        default=False,
        index=True,
        comment="Marks rows created by seed/test tooling.",
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        comment="Timestamp when the registration was created.",
    )
    updated_at = Column(
        DateTime(timezone=True),
        onupdate=func.now(),
        comment="Timestamp of the last update.",
    )

    # Relationships
    user = relationship("User", back_populates="registrations")
    event = relationship("Event", back_populates="registrations")

    # Unique constraint: one registration per user per event occurrence.
    __table_args__ = (
        UniqueConstraint("user_id", "event_id", "occurrence_date", name="unique_user_event_occurrence_registration"),
    )

