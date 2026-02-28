"""add preferred_language to users

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-02-28 13:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'd4e5f6a7b8c9'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column(
            'preferred_language',
            sa.String(length=10),
            nullable=False,
            server_default='pl',
            comment='UI language code used for push notification translations (e.g. pl, en, zh).',
        ),
    )


def downgrade() -> None:
    op.drop_column('users', 'preferred_language')
