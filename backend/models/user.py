import enum
import uuid

from sqlalchemy import Column, String, DateTime, Enum as SQLEnum, Boolean, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class UserRole(str, enum.Enum):
    GUEST = "guest"
    MEMBER = "member"
    ADMIN = "admin"


class AccountStatus(str, enum.Enum):
    PENDING = "pending"
    ACTIVE = "active"
    BANNED = "banned"


class User(Base):
    """
    Store authentication and account identity data for a single user.

    This model holds core login fields and status flags while delegating
    profile, subscription, approval, and payment method details to related
    one-to-one tables to keep authentication concerns isolated.
    """
    __tablename__ = "users"

    id = Column(
        String(36),
        primary_key=True,
        index=True,
        default=lambda: str(uuid.uuid4()),
        comment="Primary key UUID for the user.",
    )
    google_id = Column(
        String(255),
        unique=True,
        index=True,
        nullable=True,
        comment="Google account identifier linked to the user.",
    )
    username = Column(
        String(64),
        unique=True,
        index=True,
        nullable=True,
        comment="Optional unique username for password auth.",
    )
    email = Column(
        String(255),
        unique=True,
        index=True,
        comment="Primary email address used for login and contact.",
    )
    full_name = Column(
        String(255),
        comment="Display name shown in the UI and communications.",
    )
    picture_url = Column(
        Text,
        nullable=True,
        comment="Avatar image URL from OAuth or user profile.",
    )
    password_hash = Column(
        String(255),
        nullable=True,
        comment="Hashed password for local auth (nullable for OAuth-only).",
    )
    password_reset_token = Column(
        String(255),
        nullable=True,
        comment="Hashed SHA-256 password-reset token (one-time use).",
    )
    password_reset_token_expires_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="Expiry of the current password-reset token.",
    )

    role = Column(
        SQLEnum(
            UserRole,
            name="userrole",
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        default=UserRole.GUEST,
        comment="Role used for authorization decisions.",
    )
    account_status = Column(
        SQLEnum(
            AccountStatus,
            name="accountstatus",
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        default=AccountStatus.PENDING,
        comment="Approval status of the account.",
    )

    preferred_language = Column(
        String(10),
        nullable=False,
        server_default="pl",
        default="pl",
        comment="UI language code used for push notification translations (e.g. pl, en, zh).",
    )

    google_refresh_token = Column(
        String(512),
        nullable=True,
        comment="OAuth refresh token for Google Calendar integration.",
    )
    google_scopes = Column(
        Text,
        nullable=True,
        comment="OAuth scopes granted by the user.",
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        comment="Timestamp when the user was created.",
    )
    updated_at = Column(
        DateTime(timezone=True),
        onupdate=func.now(),
        comment="Timestamp of the last update.",
    )

    # Relationships
    registrations = relationship("Registration", back_populates="user")
    payments = relationship("Payment", back_populates="user")
    subscription = relationship(
        "Subscription",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    profile = relationship(
        "UserProfile",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    approval_request = relationship(
        "ApprovalRequest",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    payment_method = relationship(
        "PaymentMethod",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    donations = relationship(
        "Donation",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    push_subscriptions = relationship(
        "PushSubscription",
        back_populates="user",
        cascade="all, delete-orphan",
    )

