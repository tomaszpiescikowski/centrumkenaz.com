from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class PaymentMethod(Base):
    """
    Store a user's payment token reference for future billing.

    This model keeps gateway card tokens isolated from core user identity data
    while preserving a one-to-one relationship with the owning user.
    """
    __tablename__ = "payment_methods"

    user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
        comment="FK to the user owning the payment method.",
    )
    card_token = Column(
        String(255),
        nullable=True,
        comment="Gateway token referencing stored card details.",
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
        comment="Timestamp when the payment method was created.",
    )
    updated_at = Column(
        DateTime(timezone=True),
        onupdate=func.now(),
        comment="Timestamp of the last update.",
    )

    user = relationship("User", back_populates="payment_method")

