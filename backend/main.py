from contextlib import asynccontextmanager
from pathlib import Path
from datetime import datetime, timedelta

from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select

from config import get_settings
from database import ensure_db_schema, AsyncSessionLocal
from models.event import Event
from models.registration import Registration, RegistrationStatus
from services import push_service

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
    push_router,
)

settings = get_settings()


async def _send_event_reminders() -> None:
    """
    Hourly job: find events starting in 23–25 hours that haven't had a reminder sent,
    push a notification to every confirmed/waitlisted registrant, then mark reminder_sent.
    """
    now = datetime.utcnow()
    window_start = now + timedelta(hours=23)
    window_end = now + timedelta(hours=25)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Event).where(
                Event.start_date >= window_start,
                Event.start_date <= window_end,
                Event.reminder_sent.is_(False),
            )
        )
        events = result.scalars().all()

        for event in events:
            reg_result = await db.execute(
                select(Registration.user_id)
                .where(
                    Registration.event_id == event.id,
                    Registration.status.in_([
                        RegistrationStatus.CONFIRMED.value,
                        RegistrationStatus.WAITLIST.value,
                        RegistrationStatus.MANUAL_PAYMENT_REQUIRED.value,
                        RegistrationStatus.MANUAL_PAYMENT_VERIFICATION.value,
                    ]),
                )
                .distinct()
            )
            user_ids = [str(row[0]) for row in reg_result.all()]
            start_str = event.start_date.strftime("%d.%m.%Y %H:%M")
            for uid in user_ids:
                try:
                    await push_service.send_event_push_to_user(
                        db,
                        uid,
                        "reminder",
                        {"title": event.title, "datetime": start_str, "city": event.city},
                        f"/events/{event.id}",
                    )
                except Exception:
                    logger.exception("[reminder] Failed to push reminder for event %s to user %s", event.id, uid)

            event.reminder_sent = True
            db.add(event)

        if events:
            await db.commit()
            logger.info("[reminder] Sent reminders for %d event(s)", len(events))


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manage application startup and shutdown lifecycle events.

    Verifies database connectivity on startup by running ensure_db_schema.
    Migrations are intentionally not run here — they are applied exclusively
    by the deployment pipeline before the process starts.
    """
    await ensure_db_schema()

    scheduler = AsyncIOScheduler()
    scheduler.add_job(_send_event_reminders, "interval", hours=1, id="event_reminders")
    scheduler.start()
    logger.info("Application startup complete – reminder scheduler started")

    yield

    scheduler.shutdown(wait=False)
    logger.info("Application shutdown – reminder scheduler stopped")


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

api_router = APIRouter(prefix="/api")
api_router.include_router(auth_router)
api_router.include_router(events_router)
api_router.include_router(payments_router)
api_router.include_router(admin_router)
api_router.include_router(users_router)
api_router.include_router(registrations_router)
api_router.include_router(products_router)
api_router.include_router(uploads_router)
api_router.include_router(cities_router)
api_router.include_router(feedback_router)
api_router.include_router(announcements_router)
api_router.include_router(comments_router)
api_router.include_router(donations_router)
api_router.include_router(event_types_router)
api_router.include_router(push_router)
app.include_router(api_router)

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
