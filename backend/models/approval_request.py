from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class ApprovalRequest(Base):
    """
    Record a user's request for account approval.

    This model captures when a pending user submitted a join request so admin
    queues can be derived without polluting the core User record.
    """
    __tablename__ = "approval_requests"

    user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
        comment="FK to the user who submitted approval request.",
    )
    submitted_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        comment="Timestamp when the approval request was submitted.",
    )

    # Marks rows created by seed/test tooling so they can be safely wiped.
    is_test_data = Column(
        Boolean,
        default=False,
        index=True,
        comment="Marks rows created by seed/test tooling.",
    )

    user = relationship("User", back_populates="approval_request")

