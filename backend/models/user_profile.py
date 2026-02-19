from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class UserProfile(Base):
    """
    Store user profile details shared across the frontend.

    This model holds free-form profile text and interest tags in a dedicated
    table to keep the User model focused on authentication concerns.
    """
    __tablename__ = "user_profiles"

    user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
        comment="FK to the user owning the profile.",
    )
    about_me = Column(
        Text,
        nullable=True,
        comment="Free-form user bio displayed on profile.",
    )
    interest_tags = Column(
        Text,
        nullable=True,
        comment="Serialized list of interest tags.",
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
        comment="Timestamp when the profile was created.",
    )
    updated_at = Column(
        DateTime(timezone=True),
        onupdate=func.now(),
        comment="Timestamp of the last update.",
    )

    user = relationship("User", back_populates="profile")

