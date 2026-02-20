"""add subscription_purchases table

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "d4e5f6a7b8c9"
down_revision = "c3d4e5f6a7b8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "subscription_purchases",
        sa.Column("id", sa.String(36), primary_key=True, index=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("plan_code", sa.String(32), nullable=False),
        sa.Column("periods", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("total_amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="PLN"),
        sa.Column("status", sa.String(64), nullable=False, server_default="manual_payment_required"),
        sa.Column("payment_id", sa.String(255), nullable=True),
        sa.Column("manual_payment_confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_test_data", sa.Boolean(), nullable=False, server_default="false", index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("subscription_purchases")
