from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from config import get_settings
from pathlib import Path
import asyncio
import subprocess
import sys

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
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


def _alembic_ini_path() -> Path:
    # backend/alembic.ini
    return Path(__file__).resolve().parent / "alembic.ini"


def migrations_configured() -> bool:
    return _alembic_ini_path().exists()


def _run_alembic_upgrade_head_sync() -> None:
    """Run `alembic upgrade head` using the current Python interpreter.

    We use a subprocess because the Alembic env uses async engines and
    calls asyncio.run(), which cannot be executed inside an already-running
    event loop (FastAPI lifespan).
    """
    ini_path = _alembic_ini_path()
    if not ini_path.exists():
        raise FileNotFoundError(f"Missing alembic.ini at {ini_path}")

    cmd = [
        sys.executable,
        "-m",
        "alembic",
        "-c",
        str(ini_path),
        "upgrade",
        "head",
    ]

    repo_root = Path(__file__).resolve().parents[1]
    subprocess.run(cmd, check=True, cwd=str(repo_root))


async def run_migrations() -> None:
    await asyncio.to_thread(_run_alembic_upgrade_head_sync)


async def ensure_db_schema() -> None:
    """Ensure DB schema exists.

    Prefer Alembic migrations when configured; fall back to create_all for
    lightweight/dev-only usage.
    """
    if migrations_configured():
        await run_migrations()
        return
    await init_db()
