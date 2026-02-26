from routers.auth import router as auth_router
from routers.events import router as events_router
from routers.admin import router as admin_router
from routers.payments import router as payments_router
from routers.users import router as users_router
from routers.registrations import router as registrations_router
from routers.products import router as products_router
from routers.uploads import router as uploads_router
from routers.cities import router as cities_router
from routers.feedback import router as feedback_router
from routers.announcements import router as announcements_router
from routers.comments import router as comments_router
from routers.donations import router as donations_router

__all__ = [
    "auth_router",
    "events_router",
    "payments_router",
    "admin_router",
    "users_router",
    "registrations_router",
    "products_router",
    "uploads_router",
    "cities_router",
    "feedback_router",
    "announcements_router",
    "comments_router",
    "donations_router",
]
