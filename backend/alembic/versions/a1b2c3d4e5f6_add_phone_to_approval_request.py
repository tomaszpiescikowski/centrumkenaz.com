"""add phone to approval_request

Revision ID: a1b2c3d4e5f6
Revises: 63c4e80454ff
Create Date: 2026-02-20 10:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


revision = 'a1b2c3d4e5f6'
down_revision = '63c4e80454ff'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'approval_requests',
        sa.Column('phone_country_code', sa.String(5), nullable=True,
                  comment='International dialling prefix (e.g. +48).'),
    )
    op.add_column(
        'approval_requests',
        sa.Column('phone_number', sa.String(20), nullable=True,
                  comment='Phone number without country code.'),
    )


def downgrade() -> None:
    op.drop_column('approval_requests', 'phone_number')
    op.drop_column('approval_requests', 'phone_country_code')
