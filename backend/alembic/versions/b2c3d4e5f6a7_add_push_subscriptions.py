"""add push_subscriptions table

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-02-27 20:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'push_subscriptions',
        sa.Column('id', sa.String(length=36), nullable=False,
                  comment='UUID v4.'),
        sa.Column('user_id', sa.String(length=36), nullable=False,
                  comment='FK to the admin user who owns this subscription.'),
        sa.Column('endpoint', sa.Text(), nullable=False,
                  comment='Browser push service endpoint URL.'),
        sa.Column('keys_p256dh', sa.Text(), nullable=False,
                  comment='Elliptic-curve Diffie-Hellman public key (base64url).'),
        sa.Column('keys_auth', sa.Text(), nullable=False,
                  comment='Authentication secret (base64url).'),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('now()'), nullable=False,
                  comment='When the subscription was registered.'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('endpoint'),
    )
    op.create_index('ix_push_subscriptions_user_id', 'push_subscriptions', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_push_subscriptions_user_id', table_name='push_subscriptions')
    op.drop_table('push_subscriptions')
