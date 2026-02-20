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


def _column_exists(table: str, column: str) -> bool:
    """Check whether *column* already exists in *table*."""
    bind = op.get_bind()
    result = bind.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name = :table AND column_name = :column"
        ),
        {"table": table, "column": column},
    )
    return result.scalar() is not None


def upgrade() -> None:
    if not _column_exists('approval_requests', 'phone_country_code'):
        op.add_column(
            'approval_requests',
            sa.Column('phone_country_code', sa.String(5), nullable=True,
                      comment='International dialling prefix (e.g. +48).'),
        )
    if not _column_exists('approval_requests', 'phone_number'):
        op.add_column(
            'approval_requests',
            sa.Column('phone_number', sa.String(20), nullable=True,
                      comment='Phone number without country code.'),
        )


def downgrade() -> None:
    op.drop_column('approval_requests', 'phone_number', if_exists=True)
    op.drop_column('approval_requests', 'phone_country_code', if_exists=True)
