"""remove rescue fields

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-02-21 10:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column('events', 'rescue_cutoff_hours')
    op.drop_column('events', 'rescue_monthly_limit')
    op.drop_column('events', 'rescue_requires_subscription')
    op.drop_column('registration_refund_tasks', 'cancelled_with_rescue')


def downgrade() -> None:
    op.add_column(
        'registration_refund_tasks',
        sa.Column('cancelled_with_rescue', sa.Boolean(), nullable=False, server_default=sa.text('false')),
    )
    op.add_column(
        'events',
        sa.Column('rescue_requires_subscription', sa.Boolean(), nullable=True, server_default=sa.text('true')),
    )
    op.add_column(
        'events',
        sa.Column('rescue_monthly_limit', sa.Integer(), nullable=True, server_default=sa.text('0')),
    )
    op.add_column(
        'events',
        sa.Column('rescue_cutoff_hours', sa.Integer(), nullable=True),
    )
