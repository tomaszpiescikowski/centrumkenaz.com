import enum
import uuid

from sqlalchemy import Column, String, DateTime, Numeric, ForeignKey, Text, Boolean, Integer
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class DonationStatus(str, enum.Enum):
    PENDING_VERIFICATION = "pending_verification"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"


class Donation(Base):
    """
    Track a donation (support payment) for Kenaz.

    This model supports both anonymous donors and authenticated members.
    Authenticated active subscribers earn loyalty points upon admin confirmation
    at a rate configured in DonationSetting.
    """
    __tablename__ = "donations"

    id = Column(
        String(36),
        primary_key=True,
        index=True,
        default=lambda: str(uuid.uuid4()),
        comment="Primary key UUID for the donation.",
    )
    user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="FK to the donating user; null for anonymous donations.",
    )
    donor_name = Column(
        String(100),
        nullable=True,
        comment="Optional display name provided by the donor.",
    )
    donor_email = Column(
        String(255),
        nullable=True,
        comment="Optional contact e-mail provided by the donor.",
    )
    amount = Column(
        Numeric(10, 2),
        nullable=False,
        comment="Declared donation amount in PLN.",
    )
    currency = Column(
        String(8),
        nullable=False,
        default="PLN",
        comment="ISO currency code, always PLN for now.",
    )
    status = Column(
        String(32),
        nullable=False,
        default=DonationStatus.PENDING_VERIFICATION.value,
        index=True,
        comment="Lifecycle state of the donation.",
    )
    transfer_reference = Column(
        String(64),
        unique=True,
        index=True,
        nullable=False,
        comment="Unique bank transfer title that the donor must include in the wire.",
    )
    points_awarded = Column(
        Integer,
        nullable=True,
        comment="Loyalty points awarded to the member after confirmation; null if not applicable.",
    )
    admin_note = Column(
        Text,
        nullable=True,
        comment="Optional internal note added by admin during confirmation/cancellation.",
    )
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        comment="Timestamp when the donation record was created.",
    )
    confirmed_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when the admin confirmed receipt of the transfer.",
    )
    updated_at = Column(
        DateTime(timezone=True),
        onupdate=func.now(),
        comment="Timestamp of the last update.",
    )

    user = relationship("User", back_populates="donations")


class DonationSetting(Base):
    """
    Singleton configuration table for the 'Support Us' feature.

    Only one row exists (id=1). Admins edit points_per_zloty, bank
    account details, suggested amounts, and the public message via
    the admin panel.
    """
    __tablename__ = "donation_settings"

    id = Column(
        Integer,
        primary_key=True,
        default=1,
        comment="Always 1 – singleton row.",
    )
    points_per_zloty = Column(
        Numeric(6, 2),
        nullable=False,
        default=1.0,
        comment="Loyalty points awarded per złoty donated by an active member.",
    )
    min_amount = Column(
        Numeric(10, 2),
        nullable=False,
        default=5.00,
        comment="Minimum accepted donation amount in PLN.",
    )
    suggested_amounts = Column(
        Text,
        nullable=True,
        default="[10, 20, 50, 100]",
        comment="JSON array of suggested donation amounts displayed on the form.",
    )
    is_enabled = Column(
        Boolean,
        nullable=False,
        default=True,
        comment="When false the donation form is hidden from users.",
    )
    account_number = Column(
        String(64),
        nullable=True,
        comment="Bank account number for manual wire transfers.",
    )
    payment_title = Column(
        String(200),
        nullable=True,
        comment="Default transfer title prefix shown to donors.",
    )
    bank_owner_name = Column(
        String(200),
        nullable=True,
        comment="Account owner name for display on the support page.",
    )
    bank_owner_address = Column(
        Text,
        nullable=True,
        comment="Account owner address for display on the support page.",
    )
    message = Column(
        Text,
        nullable=True,
        comment="Admin-editable public message shown at the top of the support page.",
    )
    updated_at = Column(
        DateTime(timezone=True),
        onupdate=func.now(),
        comment="Timestamp of the last settings update.",
    )
