import enum
import uuid

from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Boolean, Numeric
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
from models.payment import Currency


class PlanCode(str, enum.Enum):
    FREE = "free"
    MONTHLY = "monthly"
    YEARLY = "yearly"


class SubscriptionPurchaseStatus(str, enum.Enum):
    MANUAL_PAYMENT_REQUIRED = "manual_payment_required"
    MANUAL_PAYMENT_VERIFICATION = "manual_payment_verification"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"


class SubscriptionPurchase(Base):
    """
    Track a subscription purchase order for manual payment flow.

    This model captures purchase intent, pricing, and manual payment state
    so services can enforce duplicate-purchase rules and admins can verify
    offline transfers.
    """
    __tablename__ = "subscription_purchases"

    id = Column(
        String(36),
        primary_key=True,
        index=True,
        default=lambda: str(uuid.uuid4()),
        comment="Primary key UUID for the subscription purchase.",
    )
    user_id = Column(
        String(36),
        ForeignKey("users.id"),
        nullable=False,
        comment="FK to the purchasing user.",
    )
    plan_code = Column(
        String(32),
        nullable=False,
        comment="Subscription plan code (free, monthly, yearly).",
    )
    periods = Column(
        Integer,
        nullable=False,
        default=1,
        comment="Number of billing periods purchased.",
    )
    total_amount = Column(
        Numeric(10, 2),
        nullable=False,
        comment="Total amount to pay (plan price * periods).",
    )
    currency = Column(
        String(3),
        default=Currency.PLN.value,
        nullable=False,
        comment="Currency code.",
    )
    status = Column(
        String(64),
        default=SubscriptionPurchaseStatus.MANUAL_PAYMENT_REQUIRED.value,
        comment="Current purchase status.",
    )
    payment_id = Column(
        String(255),
        nullable=True,
        comment="External payment ID for manual payment linkage.",
    )
    manual_payment_confirmed_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when user declared the manual payment.",
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
        comment="Timestamp when the purchase was created.",
    )
    updated_at = Column(
        DateTime(timezone=True),
        onupdate=func.now(),
        comment="Timestamp of the last update.",
    )

    # Relationships
    user = relationship("User", backref="subscription_purchases")
