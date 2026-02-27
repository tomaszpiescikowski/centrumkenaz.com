"""add payment_url to donation_settings

Revision ID: a1b2c3d4e5f6
Revises: 7fbd7d2536c3
Create Date: 2026-07-01 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


revision = 'a1b2c3d4e5f6'
down_revision = '7fbd7d2536c3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'donation_settings',
        sa.Column('payment_url', sa.String(512), nullable=True,
                  comment="URL of the payment/transfer site shown to donors.")
    )


def downgrade() -> None:
    op.drop_column('donation_settings', 'payment_url')
