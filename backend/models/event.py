import uuid

from sqlalchemy import Column, Integer, String, DateTime, Numeric, Boolean, Text, JSON, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class Event(Base):
    """
    Describe a scheduled event with pricing, capacity, and policy metadata.

    This model captures timing, location, pricing tiers, and cancellation rules
    needed for registration and payment flows, along with optional media fields
    used by the frontend.
    """
    __tablename__ = "events"

    id = Column(
        String(36),
        primary_key=True,
        index=True,
        default=lambda: str(uuid.uuid4()),
        comment="Primary key UUID for the event.",
    )
    title = Column(
        String(255),
        nullable=False,
        comment="Short title displayed in listings.",
    )
    description = Column(
        Text,
        nullable=True,
        comment="Long-form event description shown in details view.",
    )
    
    # TODO: Make model, standarized event types to allow better filtering and UI consistency, but keep it flexible for future additions
    event_type = Column(
        String(50),
        nullable=False,
        comment="Category tag for filtering (e.g., karate, mors).",
    )  # karate, mors, planszowki, etc.

    start_date = Column(
        DateTime(timezone=True),
        nullable=False,
        comment="Start datetime of the event occurrence.",
    )
    end_date = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="Optional end datetime for multi-hour events.",
    )
    
    # TODO: This should not exist, can be easily calculated from start_date and end_date 
    time_info = Column(
        String(100),
        nullable=True,
        comment="Free-form time window (e.g. 19:30-21:00).",
    )  # e.g. "19:30-21:00"

    # Optional richer content used by the current frontend UI
    features = Column(
        JSON,
        nullable=True,
        comment="Optional list of feature labels for UI display.",
    )  # list[str]
    payment_info = Column(
        Text,
        nullable=True,
        comment="Additional payment details shown to users.",
    )
    
    # TODO: remove city and location fields, they should be derived from city_id and the City model
    city = Column(
        String(100),
        nullable=False,
        comment="City name for display and fallback filtering.",
    )
    city_id = Column(
        String(36),
        ForeignKey("cities.id"),
        nullable=True,
        comment="Optional FK to normalized City record.",
    )
    location = Column(
        String(255),
        nullable=True,
        comment="Specific location or venue name.",
    )
    show_map = Column(
        Boolean,
        default=True,
        comment="Whether the map should be shown in UI.",
    )
    show_video = Column(
        Boolean,
        default=False,
        comment="Whether the YouTube embed should be shown.",
    )
    youtube_url = Column(
        String(500),
        nullable=True,
        comment="Optional YouTube URL for promo video.",
    )

    price_guest = Column(
        Numeric(10, 2),
        default=0,
        comment="Price for non-subscribers.",
    )
    price_member = Column(
        Numeric(10, 2),
        default=0,
        comment="Price for active subscribers.",
    )
    manual_payment_verification = Column(
        Boolean,
        default=False,
        nullable=False,
        comment="Whether manual payment flow is required.",
    )
    manual_payment_url = Column(
        String(500),
        nullable=True,
        comment="Transfer instructions URL for manual payments.",
    )
    manual_payment_due_hours = Column(
        Integer,
        default=24,
        nullable=False,
        comment="Hours until manual payment must be confirmed.",
    )

    max_participants = Column(
        Integer,
        nullable=True,
        comment="Maximum confirmed participants; null means unlimited.",
    )
    is_big_event = Column(
        Boolean,
        default=False,
        comment="Marks events highlighted as large-scale.",
    )
    requires_subscription = Column(
        Boolean,
        default=False,
        comment="Whether active subscription is required to register.",
    )
    cancel_cutoff_hours = Column(
        Integer,
        default=24,
        comment="Hours before start when cancellation is allowed.",
    )
    points_value = Column(
        Integer,
        default=1,
        comment="Points awarded for confirmed participation.",
    )

    registration_open = Column(
        Boolean,
        default=False,
        nullable=False,
        comment="Whether registrations are open. Toggling True triggers a push to all active users.",
    )
    reminder_sent = Column(
        Boolean,
        default=False,
        nullable=False,
        comment="Whether the 24-hour pre-event reminder push has been sent.",
    )

    # Version for optimistic locking
    version = Column(
        Integer,
        default=1,
        nullable=False,
        comment="Optimistic locking version for concurrent registrations.",
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        comment="Timestamp when the event was created.",
    )
    updated_at = Column(
        DateTime(timezone=True),
        onupdate=func.now(),
        comment="Timestamp of the last update.",
    )

    # Relationships
    registrations = relationship("Registration", back_populates="event")
    city_ref = relationship("City", back_populates="events")

    @property
    def spots_taken(self):
        return len([r for r in self.registrations if r.status == "confirmed"])

    @property
    def spots_available(self):
        if self.max_participants is None:
            return None
        return self.max_participants - self.spots_taken

