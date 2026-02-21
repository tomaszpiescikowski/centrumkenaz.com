"""drop is_test_data columns

Revision ID: e5f6a7b8c9d0
Revises: da80f277528f
Create Date: 2026-02-21 18:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "e5f6a7b8c9d0"
down_revision = "da80f277528f"
branch_labels = None
depends_on = None

_TABLES = [
    "users",
    "events",
    "products",
    "registrations",
    "payments",
    "payment_methods",
    "subscriptions",
    "subscription_purchases",
    "user_profiles",
    "approval_requests",
]


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    for table in _TABLES:
        if table in inspector.get_table_names():
            columns = [c["name"] for c in inspector.get_columns(table)]
            if "is_test_data" in columns:
                op.drop_index(
                    f"ix_{table}_is_test_data",
                    table_name=table,
                    if_exists=True,
                )
                op.drop_column(table, "is_test_data")


def downgrade() -> None:
    for table in _TABLES:
        op.add_column(
            table,
            sa.Column(
                "is_test_data",
                sa.Boolean(),
                nullable=True,
                server_default=sa.text("false"),
            ),
        )
        op.create_index(f"ix_{table}_is_test_data", table, ["is_test_data"])
