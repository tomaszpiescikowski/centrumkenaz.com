from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from config import get_settings

settings = get_settings()

database_url = settings.database_url
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql+asyncpg://", 1)
elif database_url.startswith("postgresql://"):
    database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)

engine = create_async_engine(
    database_url,
    echo=settings.debug,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

Base = declarative_base()


async def get_db():
    """
    Yield an async database session for use as a FastAPI dependency.

    Opens a new AsyncSession from the shared session factory, yields it for
    the duration of the request, and closes it in the finally block regardless
    of whether the request completes normally or raises an exception.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def ensure_db_schema() -> None:
    """Verify the database is reachable on startup.

    Migrations are intentionally NOT run here — they are applied exclusively
    by the deployment pipeline (alembic upgrade heads) before the process
    starts.  Running migrations inside the app process caused race conditions
    and made startup fail whenever code and DB were transiently out of sync.
    """
    from sqlalchemy import text
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
