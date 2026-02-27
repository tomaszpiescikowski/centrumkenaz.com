from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class PushSubscription(Base):
    """
    Web Push subscription endpoint stored per admin user.

    Created when an admin grants notification permission and the browser
    registers a push subscription.  Deleted when the admin revokes permission
    or explicitly unsubscribes.
    """
    __tablename__ = "push_subscriptions"

    id = Column(
        String(36),
        primary_key=True,
        comment="UUID v4.",
    )
    user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="FK to the admin user who owns this subscription.",
    )
    endpoint = Column(
        Text,
        nullable=False,
        unique=True,
        comment="Browser push service endpoint URL.",
    )
    keys_p256dh = Column(
        Text,
        nullable=False,
        comment="Elliptic-curve Diffie-Hellman public key (base64url).",
    )
    keys_auth = Column(
        Text,
        nullable=False,
        comment="Authentication secret (base64url).",
    )
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="When the subscription was registered.",
    )

    user = relationship("User", back_populates="push_subscriptions")
