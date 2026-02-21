from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from config import get_settings
from database import ensure_db_schema
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
)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - startup and shutdown."""
    await ensure_db_schema()
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

uploads_dir = Path(__file__).resolve().parent / "static" / "uploads"
uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "name": settings.app_name,
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    """Health check for load balancers."""
    return {"status": "healthy"}
