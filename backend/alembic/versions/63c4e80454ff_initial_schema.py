"""initial_schema

Revision ID: 63c4e80454ff
Revises: 
Create Date: 2026-02-19 13:59:58.672685

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# Import Base and all models to ensure metadata is populated
import sys
from pathlib import Path
backend_path = Path(__file__).resolve().parents[2]
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from database import Base
from models import (
    event, user, registration, payment, city, subscription,
    user_profile, approval_request, payment_method, product,
    registration_refund_task
)


revision = '63c4e80454ff'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create all tables from SQLAlchemy models."""
    # Get a connection from alembic context
    bind = op.get_bind()
    # Create all tables defined in Base.metadata
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    """Drop all tables."""
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
