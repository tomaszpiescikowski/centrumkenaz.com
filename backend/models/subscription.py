from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class Subscription(Base):
    """
    Store subscription status and points for a user account.

    This model keeps subscription end dates and earned points separate from
    authentication data while remaining a one-to-one extension of User.
    """
    __tablename__ = "subscriptions"

    user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
        comment="FK to the user owning the subscription.",
    )
    end_date = Column(
        DateTime,
        nullable=True,
        comment="Subscription end datetime; null means no active subscription.",
    )
    points = Column(
        Integer,
        default=0,
        nullable=False,
        comment="Accumulated loyalty points for the user.",
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
        comment="Timestamp when the subscription row was created.",
    )
    updated_at = Column(
        DateTime(timezone=True),
        onupdate=func.now(),
        comment="Timestamp of the last update.",
    )

    user = relationship("User", back_populates="subscription")

