"""
Comment and CommentReaction models for threaded, reactable, pinnable comments.

Designed to be reusable across different resource types (events, announcements,
etc.) via the `resource_type` + `resource_id` composite key pattern.
"""

import enum
import uuid

from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    Text,
    ForeignKey,
    Boolean,
    Index,
    UniqueConstraint,
    Enum as SQLEnum,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database import Base


class ReactionType(str, enum.Enum):
    LIKE = "like"
    HEART = "heart"
    LAUGH = "laugh"
    WOW = "wow"
    SAD = "sad"
    FIRE = "fire"


class Comment(Base):
    """
    A user comment on a resource (event, announcement, etc.).

    Supports threading via parent_id, admin pinning, and soft-delete.
    Uses optimistic concurrency via a version column.
    """

    __tablename__ = "comments"

    id = Column(
        String(36),
        primary_key=True,
        index=True,
        default=lambda: str(uuid.uuid4()),
        comment="Primary key UUID for the comment.",
    )

    # Polymorphic resource link – allows reuse across events, announcements, etc.
    resource_type = Column(
        String(50),
        nullable=False,
        comment="Type of resource this comment belongs to (e.g. 'event').",
    )
    resource_id = Column(
        String(36),
        nullable=False,
        comment="ID of the resource this comment belongs to.",
    )

    # Author
    user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="FK to the user who wrote this comment.",
    )

    # Content
    content = Column(
        Text,
        nullable=False,
        comment="The comment text content.",
    )

    # Threading: top-level comments have parent_id=NULL
    parent_id = Column(
        String(36),
        ForeignKey("comments.id", ondelete="CASCADE"),
        nullable=True,
        comment="FK to parent comment for threading (NULL for top-level).",
    )

    # Soft delete
    is_deleted = Column(
        Boolean,
        default=False,
        nullable=False,
        comment="Soft-delete flag; deleted comments show placeholder text.",
    )

    # Optimistic concurrency
    version = Column(
        Integer,
        default=1,
        nullable=False,
        comment="Optimistic lock version for concurrent edit safety.",
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="Timestamp when the comment was created.",
    )
    updated_at = Column(
        DateTime(timezone=True),
        onupdate=func.now(),
        comment="Timestamp of the last update.",
    )

    # Relationships
    user = relationship("User", lazy="joined")
    reactions = relationship(
        "CommentReaction",
        back_populates="comment",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    replies = relationship(
        "Comment",
        back_populates="parent",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="Comment.created_at",
    )
    parent = relationship(
        "Comment",
        back_populates="replies",
        remote_side=[id],
    )

    __table_args__ = (
        Index("ix_comments_resource", "resource_type", "resource_id"),
        Index("ix_comments_parent", "parent_id"),
        Index("ix_comments_user", "user_id"),
    )


class CommentReaction(Base):
    """
    A single emoji reaction on a comment, one per user per reaction type.
    """

    __tablename__ = "comment_reactions"

    id = Column(
        String(36),
        primary_key=True,
        index=True,
        default=lambda: str(uuid.uuid4()),
        comment="Primary key UUID for the reaction.",
    )
    comment_id = Column(
        String(36),
        ForeignKey("comments.id", ondelete="CASCADE"),
        nullable=False,
        comment="FK to the comment being reacted to.",
    )
    user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="FK to the user who reacted.",
    )
    reaction_type = Column(
        SQLEnum(
            ReactionType,
            name="reactiontype",
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        nullable=False,
        comment="The type of reaction emoji.",
    )
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="Timestamp when the reaction was created.",
    )

    # Relationships
    comment = relationship("Comment", back_populates="reactions")
    user = relationship("User", lazy="joined")

    __table_args__ = (
        UniqueConstraint(
            "comment_id",
            "user_id",
            "reaction_type",
            name="uq_comment_reaction_user_type",
        ),
    )
