"""add donations and donation_settings tables

Revision ID: g7h8i9j0k1l2
Revises: f6a7b8c9d0e1
Create Date: 2026-02-26 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'g7h8i9j0k1l2'
down_revision = 'f6a7b8c9d0e1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── donation_settings (singleton config) ───────────────────────
    op.create_table(
        'donation_settings',
        sa.Column('id', sa.Integer(), nullable=False, comment='Always 1 – singleton row.'),
        sa.Column('points_per_zloty', sa.Numeric(6, 2), nullable=False, server_default='1.00',
                  comment='Loyalty points awarded per złoty donated by an active member.'),
        sa.Column('min_amount', sa.Numeric(10, 2), nullable=False, server_default='5.00',
                  comment='Minimum accepted donation amount in PLN.'),
        sa.Column('suggested_amounts', sa.Text(), nullable=True,
                  comment='JSON array of suggested donation amounts displayed on the form.'),
        sa.Column('is_enabled', sa.Boolean(), nullable=False, server_default=sa.text('true'),
                  comment='When false the donation form is hidden from users.'),
        sa.Column('account_number', sa.String(64), nullable=True,
                  comment='Bank account number for manual wire transfers.'),
        sa.Column('payment_title', sa.String(200), nullable=True,
                  comment='Default transfer title prefix shown to donors.'),
        sa.Column('bank_owner_name', sa.String(200), nullable=True,
                  comment='Account owner name for display on the support page.'),
        sa.Column('bank_owner_address', sa.Text(), nullable=True,
                  comment='Account owner address for display on the support page.'),
        sa.Column('message', sa.Text(), nullable=True,
                  comment='Admin-editable public message shown at the top of the support page.'),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True,
                  comment='Timestamp of the last settings update.'),
        sa.PrimaryKeyConstraint('id'),
    )

    # ── donations ──────────────────────────────────────────────────
    op.create_table(
        'donations',
        sa.Column('id', sa.String(36), nullable=False,
                  comment='Primary key UUID for the donation.'),
        sa.Column('user_id', sa.String(36), nullable=True,
                  comment='FK to the donating user; null for anonymous donations.'),
        sa.Column('donor_name', sa.String(100), nullable=True,
                  comment='Optional display name provided by the donor.'),
        sa.Column('donor_email', sa.String(255), nullable=True,
                  comment='Optional contact e-mail provided by the donor.'),
        sa.Column('amount', sa.Numeric(10, 2), nullable=False,
                  comment='Declared donation amount in PLN.'),
        sa.Column('currency', sa.String(8), nullable=False, server_default='PLN',
                  comment='ISO currency code, always PLN for now.'),
        sa.Column('status', sa.String(32), nullable=False,
                  server_default='pending_verification', index=True,
                  comment='Lifecycle state of the donation.'),
        sa.Column('transfer_reference', sa.String(64), nullable=False,
                  unique=True, index=True,
                  comment='Unique bank transfer title that the donor must include in the wire.'),
        sa.Column('points_awarded', sa.Integer(), nullable=True,
                  comment='Loyalty points awarded to the member after confirmation.'),
        sa.Column('admin_note', sa.Text(), nullable=True,
                  comment='Optional internal note added by admin.'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'),
                  nullable=True, comment='Timestamp when the donation record was created.'),
        sa.Column('confirmed_at', sa.DateTime(timezone=True), nullable=True,
                  comment='Timestamp when the admin confirmed receipt of the transfer.'),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True,
                  comment='Timestamp of the last update.'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_donations_id', 'donations', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_donations_id', table_name='donations')
    op.drop_table('donations')
    op.drop_table('donation_settings')
