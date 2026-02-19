from typing import List, Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from database import get_db
from models.product import Product
from security.rate_limit import build_public_rate_limit_dependency

router = APIRouter(prefix="/products", tags=["products"])
settings = get_settings()
products_rate_limit = build_public_rate_limit_dependency(
    scope="products:list",
    per_minute_resolver=lambda: settings.rate_limit_public_per_minute,
)


class ProductResponse(BaseModel):
    """
    Describe a product shown in the public catalog.

    This response contains display fields required by the storefront UI.
    """
    model_config = ConfigDict(coerce_numbers_to_str=True)

    id: str = Field(description="Product identifier.")
    name: str = Field(description="Product name.")
    description: str | None = Field(default=None, description="Product description.")
    price: str = Field(description="Product price formatted as string.")
    image_url: str | None = Field(default=None, description="Optional image URL.")

@router.get("", response_model=list[ProductResponse], dependencies=[Depends(products_rate_limit)])
async def list_products(db: AsyncSession = Depends(get_db)) -> list[ProductResponse]:
    """
    Return active products for the public catalog.

    The query filters to active products, orders them by identifier, and formats
    prices as strings for frontend display.
    """
    stmt = select(Product).where(Product.is_active.is_(True)).order_by(Product.id)
    result = await db.execute(stmt)
    products = result.scalars().all()
    return [
        ProductResponse(
            id=str(p.id),
            name=p.name,
            description=p.description,
            price=str(p.price),
            image_url=p.image_url,
        )
        for p in products
    ]
