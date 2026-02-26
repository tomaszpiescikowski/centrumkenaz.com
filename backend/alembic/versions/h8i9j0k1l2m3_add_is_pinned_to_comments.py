"""add is_pinned to comments

Revision ID: h8i9j0k1l2m3
Revises: g7h8i9j0k1l2
Create Date: 2026-02-26 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'h8i9j0k1l2m3'
down_revision = 'g7h8i9j0k1l2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'comments',
        sa.Column(
            'is_pinned',
            sa.Boolean(),
            nullable=False,
            server_default=sa.text('false'),
            comment='Whether this comment is pinned by an admin.',
        ),
    )


def downgrade() -> None:
    op.drop_column('comments', 'is_pinned')
