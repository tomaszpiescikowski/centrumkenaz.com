import uuid

from sqlalchemy import Column, String
from sqlalchemy.orm import relationship
from database import Base


class City(Base):
    """
    Represent a named city used for event grouping and filtering.

    This model stores a canonical name and slug for use in listings and URLs,
    and is linked to events via a relationship to support city-based queries.
    """
    __tablename__ = "cities"

    id = Column(
        String(36),
        primary_key=True,
        index=True,
        default=lambda: str(uuid.uuid4()),
        comment="Primary key UUID for the city.",
    )
    name = Column(
        String(100),
        unique=True,
        nullable=False,
        comment="Human-readable city name.",
    )
    slug = Column(
        String(100),
        unique=True,
        nullable=False,
        comment="URL-safe city identifier.",
    )

    events = relationship("Event", back_populates="city_ref")

