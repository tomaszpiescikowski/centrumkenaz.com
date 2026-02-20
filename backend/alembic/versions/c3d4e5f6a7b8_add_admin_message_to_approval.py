"""add admin_message to approval_request

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-02-20 12:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


revision = 'c3d4e5f6a7b8'
down_revision = 'b2c3d4e5f6a7'
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
    if not _column_exists('approval_requests', 'admin_message'):
        op.add_column(
            'approval_requests',
            sa.Column('admin_message', sa.String(500), nullable=True,
                      comment='Optional message from user to admin during join request.'),
        )


def downgrade() -> None:
    op.drop_column('approval_requests', 'admin_message', if_exists=True)
