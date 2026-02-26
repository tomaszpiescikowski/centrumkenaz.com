from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import logging

from config import get_settings
from database import ensure_db_schema

logger = logging.getLogger(__name__)
from routers import (
    auth_router,
    events_router,
    payments_router,
    admin_router,
    users_router,
    registrations_router,
    products_router,
    uploads_router,
    cities_router,
    feedback_router,
    announcements_router,
    comments_router,
    donations_router,
    event_types_router,
)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manage application startup and shutdown lifecycle events.

    Verifies database connectivity on startup by running ensure_db_schema.
    Migrations are intentionally not run here — they are applied exclusively
    by the deployment pipeline before the process starts.
    """
    await ensure_db_schema()
    logger.info("Application startup complete")
    yield


app = FastAPI(
    title=settings.app_name,
    description="API for the Kenaz social platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(events_router)
app.include_router(payments_router)
app.include_router(admin_router)
app.include_router(users_router)
app.include_router(registrations_router)
app.include_router(products_router)
app.include_router(uploads_router)
app.include_router(cities_router)
app.include_router(feedback_router)
app.include_router(announcements_router)
app.include_router(comments_router)
app.include_router(donations_router)
app.include_router(event_types_router)

uploads_dir = Path(__file__).resolve().parent / "static" / "uploads"
uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")


@app.get("/")
async def root():
    """
    Return basic application metadata for the root endpoint.

    Useful as a lightweight availability check that also exposes the app
    name and documentation URL for discovery.
    """
    return {
        "name": settings.app_name,
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    """
    Return a minimal health status response for load balancer probes.

    The endpoint intentionally performs no I/O so it remains fast and
    returns 200 as long as the process is alive.
    """
    return {"status": "healthy"}
