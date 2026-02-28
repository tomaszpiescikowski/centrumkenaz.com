"""add registration_open and reminder_sent to events

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-02-28 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'c3d4e5f6a7b8'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'events',
        sa.Column(
            'registration_open',
            sa.Boolean(),
            nullable=False,
            server_default=sa.text('false'),
            comment='Whether registrations are open. Toggling True triggers a push to all active users.',
        ),
    )
    op.add_column(
        'events',
        sa.Column(
            'reminder_sent',
            sa.Boolean(),
            nullable=False,
            server_default=sa.text('false'),
            comment='Whether the 24-hour pre-event reminder push has been sent.',
        ),
    )


def downgrade() -> None:
    op.drop_column('events', 'reminder_sent')
    op.drop_column('events', 'registration_open')
