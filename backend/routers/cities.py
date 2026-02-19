from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from config import get_settings
from database import get_db
from models.city import City
from security.rate_limit import build_public_rate_limit_dependency

router = APIRouter(prefix="/cities", tags=["cities"])
settings = get_settings()
cities_rate_limit = build_public_rate_limit_dependency(
    scope="cities:list",
    per_minute_resolver=lambda: settings.rate_limit_public_per_minute,
)


class CityResponse(BaseModel):
    """
    Describe a city used for event filtering.

    This response exposes the city identifier, display name, and URL slug.
    """

    id: str = Field(description="City identifier.")
    name: str = Field(description="Human-readable city name.")
    slug: str = Field(description="URL-safe city slug.")

    class Config:
        from_attributes = True


@router.get("/", response_model=list[CityResponse], dependencies=[Depends(cities_rate_limit)])
async def list_cities(db: AsyncSession = Depends(get_db)) -> list[CityResponse]:
    """
    Return the list of cities available for event filtering.

    Results are ordered by name and legacy numeric identifiers are normalized
    to strings for consistent frontend handling.
    """
    result = await db.execute(select(City).order_by(City.name))
    # Production DB may still have legacy integer city IDs; normalize to string.
    return [
        CityResponse(
            id=str(city.id),
            name=city.name,
            slug=city.slug,
        )
        for city in result.scalars().all()
    ]
