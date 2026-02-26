"""merge password_reset and donations_is_pinned branches

Revision ID: 57237731351b
Revises: a2b3c4d5e6f7, h8i9j0k1l2m3
Create Date: 2026-02-26 22:28:51.468491

"""

from alembic import op
import sqlalchemy as sa


revision = '57237731351b'
down_revision = ('a2b3c4d5e6f7', 'h8i9j0k1l2m3')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
