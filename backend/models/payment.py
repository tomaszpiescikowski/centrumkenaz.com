import enum
import uuid

from sqlalchemy import Column, String, DateTime, Numeric, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"
    CANCELLED = "cancelled"


class Currency(str, enum.Enum):
    PLN = "PLN"


class PaymentType(str, enum.Enum):
    EVENT = "event"
    SUBSCRIPTION = "subscription"


class Payment(Base):
    """
    Persist a payment transaction for event or subscription purchases.

    This model stores gateway identifiers, amounts, statuses, and optional
    payloads to support reconciliation and webhook-driven status updates.
    """
    __tablename__ = "payments"

    id = Column(
        String(36),
        primary_key=True,
        index=True,
        default=lambda: str(uuid.uuid4()),
        comment="Primary key UUID for the payment.",
    )
    user_id = Column(
        String(36),
        ForeignKey("users.id"),
        nullable=False,
        comment="FK to the owning user.",
    )

    external_id = Column(
        String(255),
        unique=True,
        index=True,
        comment="Payment gateway identifier.",
    )  # ID from payment gateway
    amount = Column(
        Numeric(10, 2),
        nullable=False,
        comment="Payment amount in minor currency units.",
    )
    currency = Column(
        String(3),
        default=Currency.PLN.value,
        comment="ISO currency code.",
    )

    payment_type = Column(
        String(20),
        nullable=False,
        comment="Type of payment (event or subscription).",
    )
    status = Column(
        String(20),
        default=PaymentStatus.PENDING.value,
        comment="Current payment status.",
    )

    description = Column(
        String(500),
        nullable=True,
        comment="Human-readable description for receipts.",
    )
    extra_data = Column(
        Text,
        nullable=True,
        comment="Serialized JSON metadata for the payment.",
    )  # JSON string for extra data

    gateway_response = Column(
        Text,
        nullable=True,
        comment="Raw gateway response payload for audits.",
    )  # Raw response from gateway

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        comment="Timestamp when the payment was created.",
    )
    updated_at = Column(
        DateTime(timezone=True),
        onupdate=func.now(),
        comment="Timestamp of the last update.",
    )
    completed_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when the payment was completed.",
    )

    # Relationships
    user = relationship("User", back_populates="payments")

