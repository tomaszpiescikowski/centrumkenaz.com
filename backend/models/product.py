import uuid

from sqlalchemy import Column, String, Text, Numeric, Boolean, DateTime
from sqlalchemy.sql import func
from database import Base


class Product(Base):
    """
    Represent a purchasable product shown in the catalog.

    This model stores pricing and presentation fields for static offerings
    and supports soft activation for catalog visibility control.
    """
    __tablename__ = "products"

    id = Column(
        String(36),
        primary_key=True,
        index=True,
        default=lambda: str(uuid.uuid4()),
        comment="Primary key UUID for the product.",
    )
    name = Column(
        String(255),
        nullable=False,
        comment="Product name shown in the catalog.",
    )
    description = Column(
        Text,
        nullable=True,
        comment="Long-form product description.",
    )
    price = Column(
        Numeric(10, 2),
        nullable=False,
        server_default="0",
        comment="Product price in major currency units.",
    )
    image_url = Column(
        String(500),
        nullable=True,
        comment="Optional product image URL.",
    )
    is_active = Column(
        Boolean,
        default=True,
        comment="Whether the product is visible in the catalog.",
    )
    is_test_data = Column(
        Boolean,
        default=False,
        index=True,
        comment="Marks rows created by seed/test tooling.",
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        comment="Timestamp when the product was created.",
    )
    updated_at = Column(
        DateTime(timezone=True),
        onupdate=func.now(),
        comment="Timestamp of the last update.",
    )
