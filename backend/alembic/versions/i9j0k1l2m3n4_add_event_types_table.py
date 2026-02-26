"""add event_types table

Revision ID: i9j0k1l2m3n4
Revises: 57237731351b
Create Date: 2026-02-26 23:00:00.000000

"""
import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision = 'i9j0k1l2m3n4'
down_revision = '57237731351b'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'event_types',
        sa.Column(
            'key',
            sa.String(50),
            nullable=False,
            comment="Slug key used in Event.event_type.",
        ),
        sa.Column(
            'label',
            sa.String(100),
            nullable=False,
            comment="Display name shown in UI.",
        ),
        sa.Column(
            'icon_key',
            sa.String(50),
            nullable=False,
            comment="Key into the EXTRA_ICONS map on the frontend.",
        ),
        sa.Column(
            'color',
            sa.String(50),
            nullable=False,
            server_default='text-blue-500',
            comment="Tailwind text-color class used for the icon.",
        ),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=True,
            comment="Timestamp when this custom type was created.",
        ),
        sa.PrimaryKeyConstraint('key'),
    )


def downgrade() -> None:
    op.drop_table('event_types')
