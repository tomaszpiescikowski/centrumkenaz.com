"""add comments tables

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-02-21 21:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "f6a7b8c9d0e1"
down_revision = "c01130c84e48"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create the ReactionType enum (idempotent via PL/pgSQL exception handler)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE reactiontype AS ENUM ('like', 'heart', 'laugh', 'wow', 'sad', 'fire');
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END $$;
    """)

    # Comments table
    op.create_table(
        "comments",
        sa.Column("id", sa.String(36), primary_key=True, index=True),
        sa.Column("resource_type", sa.String(50), nullable=False),
        sa.Column("resource_id", sa.String(36), nullable=False),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "parent_id",
            sa.String(36),
            sa.ForeignKey("comments.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("is_pinned", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("version", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_comments_resource", "comments", ["resource_type", "resource_id"])
    op.create_index("ix_comments_parent", "comments", ["parent_id"])
    op.create_index("ix_comments_user", "comments", ["user_id"])

    # Comment reactions table
    op.create_table(
        "comment_reactions",
        sa.Column("id", sa.String(36), primary_key=True, index=True),
        sa.Column(
            "comment_id",
            sa.String(36),
            sa.ForeignKey("comments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "reaction_type",
            postgresql.ENUM("like", "heart", "laugh", "wow", "sad", "fire", name="reactiontype", create_type=False),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint(
            "comment_id", "user_id", "reaction_type",
            name="uq_comment_reaction_user_type",
        ),
    )


def downgrade() -> None:
    op.drop_table("comment_reactions")
    op.drop_index("ix_comments_user", table_name="comments")
    op.drop_index("ix_comments_parent", table_name="comments")
    op.drop_index("ix_comments_resource", table_name="comments")
    op.drop_table("comments")
    sa.Enum(name="reactiontype").drop(op.get_bind(), checkfirst=True)
