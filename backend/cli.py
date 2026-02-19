"""Kenaz CLI - helpers for local/test data.

Usage (from backend/):
  python -m backend.cli seed-events
  python -m backend.cli seed-users
  python -m backend.cli seed-registrations
  python -m backend.cli seed-demo --reset
  python -m backend.cli wipe-test-data

This CLI is intended for dev/demo environments.
"""

import argparse
import asyncio
import json
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import Integer, delete, func, inspect, or_, select

from database import AsyncSessionLocal, ensure_db_schema
from models.city import City
from models.event import Event
from models.payment import Payment, PaymentStatus as DBPaymentStatus, PaymentType
from models.product import Product
from models.registration import Registration, RegistrationStatus
from models.registration_refund_task import RegistrationRefundTask
from models.user import AccountStatus, User, UserRole
from models.subscription import Subscription
from models.user_profile import UserProfile
from models.approval_request import ApprovalRequest
from models.payment_method import PaymentMethod
from services.auth_service import PASSWORD_CONTEXT

EVENT_TYPES = {
    "karate",
    "mors",
    "planszowki",
    "ognisko",
    "spacer",
    "joga",
    "wyjazd",
    "inne",
}

EDGE_CASE_EVENT_KEYS = [
    "karate_full",
    "mors_empty",
    "planszowki_almost_full",
    "ognisko_waitlist",
    "spacer_video",
    "joga_map",
    "wyjazd_subscription_only",
    "inne_manual_payment",
]

SUBSCRIPTION_PLANS = {
    "pro": {
        "amount": Decimal("20.00"),
        "duration_days": 30,
    },
    "ultimate": {
        "amount": Decimal("200.00"),
        "duration_days": 365,
    },
}
DEFAULT_MANUAL_PAYMENT_URL = "https://payments.example/manual-transfer"
DEFAULT_MANUAL_PAYMENT_DUE_HOURS = 24


def _is_integer_like_type(column_type: object | None) -> bool:
    """Return True when inspected SQL type maps to Python int."""
    if column_type is None:
        return False
    try:
        return getattr(column_type, "python_type", None) is int
    except Exception:
        return "INT" in str(column_type).upper()


async def _apply_legacy_integer_pk_compat(session) -> None:
    """Adapt ORM column metadata when DB uses legacy INTEGER ids/FKs."""
    table_to_model = {
        "users": User,
        "events": Event,
        "registrations": Registration,
        "payments": Payment,
        "products": Product,
        "registration_refund_tasks": RegistrationRefundTask,
    }

    inspected = await session.run_sync(
        lambda sync_session: {
            table: inspect(sync_session.bind).get_columns(table)
            for table in table_to_model
        }
    )

    for table_name, columns in inspected.items():
        model = table_to_model[table_name]
        for column in columns:
            column_name = str(column.get("name"))
            model_column = model.__table__.c.get(column_name)
            if model_column is None:
                continue
            if not _is_integer_like_type(column.get("type")):
                continue

            model_column.type = Integer()
            if column_name == "id":
                model_column.default = None


def _normalize_seed_now(base_now: datetime | None = None) -> datetime:
    if base_now is None:
        return datetime.now(timezone.utc).replace(second=0, microsecond=0)
    if base_now.tzinfo is None:
        return base_now.replace(tzinfo=timezone.utc)
    return base_now.astimezone(timezone.utc)


def _future_dt(base_now: datetime, days_from_now: int, hour: int, minute: int = 0) -> datetime:
    target = base_now + timedelta(days=days_from_now)
    return target.replace(hour=hour, minute=minute, second=0, microsecond=0)


def _event_seed_specs(base_now: datetime | None = None) -> list[dict]:
    now = _normalize_seed_now(base_now)

    wyjazd_start = _future_dt(now, days_from_now=8, hour=7)
    wyjazd_end = (wyjazd_start + timedelta(days=2)).replace(hour=23, minute=0, second=0, microsecond=0)
    marcowy_wyjazd_start = _future_dt(now, days_from_now=37, hour=6)
    marcowy_wyjazd_end = (marcowy_wyjazd_start + timedelta(days=2)).replace(hour=21, minute=0, second=0, microsecond=0)

    return [
        {
            "key": "karate_full",
            "payload": {
                "title": "Wieczorny Trening Karate na Ratajach",
                "description": "DANE TESTOWE (CASE_FULL_4_OF_4): wydarzenie celowo ustawione jako w pełni zapełnione.",
                "event_type": "karate",
                "start_date": _future_dt(now, days_from_now=2, hour=19, minute=30),
                "time_info": "19:30-21:00",
                "city": "Poznań",
                "location": "Hala OSiR Rataje, os. Piastowskie 106A, Poznań",
                "show_map": True,
                "price_guest": Decimal("45.00"),
                "price_member": Decimal("30.00"),
                "max_participants": 4,
                "requires_subscription": False,
            },
        },
        {
            "key": "mors_empty",
            "payload": {
                "title": "Poranne Morsowanie nad Rusałką",
                "description": "DANE TESTOWE (CASE_EMPTY_0_OF_5): wydarzenie bez zapisanych uczestników.",
                "event_type": "mors",
                "start_date": _future_dt(now, days_from_now=3, hour=8, minute=0),
                "time_info": "08:00-09:00",
                "city": "Poznań",
                "location": "Kąpielisko Rusałka, ul. Golęcińska, Poznań",
                "show_map": True,
                "price_guest": Decimal("0.00"),
                "price_member": Decimal("0.00"),
                "max_participants": 5,
                "requires_subscription": False,
            },
        },
        {
            "key": "planszowki_almost_full",
            "payload": {
                "title": "Wieczór Planszówek na Marszałkowskiej",
                "description": "DANE TESTOWE (CASE_ALMOST_FULL_3_OF_4): zostało dokładnie jedno wolne miejsce.",
                "event_type": "planszowki",
                "start_date": _future_dt(now, days_from_now=4, hour=18, minute=0),
                "time_info": "18:00-22:00",
                "city": "Warszawa",
                "location": "H.4.0.S, ul. Marszałkowska 64, Warszawa",
                "show_map": True,
                "price_guest": Decimal("35.00"),
                "price_member": Decimal("15.00"),
                "max_participants": 4,
                "requires_subscription": False,
            },
        },
        {
            "key": "ognisko_waitlist",
            "payload": {
                "title": "Ognisko Integracyjne nad Maltą",
                "description": "DANE TESTOWE (CASE_WAITLIST): komplet miejsc i aktywna lista rezerwowa.",
                "event_type": "ognisko",
                "start_date": _future_dt(now, days_from_now=5, hour=20, minute=0),
                "time_info": "20:00-23:00",
                "city": "Poznań",
                "location": "Polana Harcerska Malta, ul. Krańcowa, Poznań",
                "show_map": True,
                "price_guest": Decimal("25.00"),
                "price_member": Decimal("10.00"),
                "max_participants": 4,
                "requires_subscription": False,
            },
        },
        {
            "key": "spacer_video",
            "payload": {
                "title": "Spacer Historyczny po Starym Mieście",
                "description": "DANE TESTOWE (CASE_VIDEO): wydarzenie z osadzonym materiałem wideo.",
                "event_type": "spacer",
                "start_date": _future_dt(now, days_from_now=6, hour=19, minute=0),
                "time_info": "19:00-21:00",
                "city": "Poznań",
                "location": "Plac Kolegiacki, Poznań",
                "show_map": True,
                "price_guest": Decimal("12.00"),
                "price_member": Decimal("0.00"),
                "max_participants": 5,
                "requires_subscription": False,
            },
        },
        {
            "key": "joga_map",
            "payload": {
                "title": "Joga Mobilna w Studio Balans",
                "description": "DANE TESTOWE (CASE_MAP): wydarzenie z mapą i wolnymi miejscami.",
                "event_type": "joga",
                "start_date": _future_dt(now, days_from_now=7, hour=18, minute=30),
                "time_info": "18:30-20:00",
                "city": "Warszawa",
                "location": "Studio Balans, ul. Wilcza 9A, Warszawa",
                "show_map": True,
                "price_guest": Decimal("40.00"),
                "price_member": Decimal("20.00"),
                "max_participants": 4,
                "requires_subscription": False,
            },
        },
        {
            "key": "wyjazd_subscription_only",
            "payload": {
                "title": "Weekend Reset w Arendal",
                "description": "DANE TESTOWE (CASE_SUBSCRIPTION_ONLY): dostęp tylko dla osób z aktywną subskrypcją.",
                "event_type": "wyjazd",
                "start_date": wyjazd_start,
                "end_date": wyjazd_end,
                "time_info": "cały dzień",
                "city": "Norwegia",
                "location": "Arendal, Agder, Norwegia",
                "show_map": True,
                "payment_info": "DANE TESTOWE: wariant subskrypcyjny (bez płatności gościa).",
                "price_guest": Decimal("0.00"),
                "price_member": Decimal("199.00"),
                "max_participants": 5,
                "requires_subscription": True,
            },
        },
        {
            "key": "inne_manual_payment",
            "payload": {
                "title": "Warsztat Oddech i Regeneracja",
                "description": "DANE TESTOWE (CASE_MANUAL_TRANSFER): płatność ręczna i weryfikacja przez admina.",
                "event_type": "inne",
                "start_date": _future_dt(now, days_from_now=11, hour=17, minute=0),
                "time_info": "17:00-20:00",
                "city": "Poznań",
                "location": "Concordia Design, ul. Zwierzyniecka 3, Poznań",
                "show_map": True,
                "price_guest": Decimal("90.00"),
                "price_member": Decimal("60.00"),
                "manual_payment_verification": True,
                "manual_payment_url": "https://payments.example/manual-transfer",
                "manual_payment_due_hours": 36,
                "max_participants": 5,
                "requires_subscription": False,
            },
        },
        {
            "key": "karate_march_drills",
            "payload": {
                "title": "Trening Karate: Technika i Sparing",
                "description": "DANE TESTOWE (CASE_EXTRA_MARCH_TRAINING): dodatkowe wydarzenie marcowe do testów kalendarza.",
                "event_type": "karate",
                "start_date": _future_dt(now, days_from_now=24, hour=19, minute=0),
                "time_info": "19:00-20:45",
                "city": "Poznań",
                "location": "Dojo Fair Play, ul. Głogowska 35, Poznań",
                "show_map": True,
                "price_guest": Decimal("50.00"),
                "price_member": Decimal("35.00"),
                "max_participants": 5,
                "requires_subscription": False,
            },
        },
        {
            "key": "joga_march_recovery",
            "payload": {
                "title": "Joga Regeneracyjna po Pracy",
                "description": "DANE TESTOWE (CASE_EXTRA_MARCH_RECOVERY): dodatkowe wydarzenie marcowe z limitem miejsc.",
                "event_type": "joga",
                "start_date": _future_dt(now, days_from_now=30, hour=18, minute=15),
                "time_info": "18:15-19:30",
                "city": "Kraków",
                "location": "Przestrzeń Spokój, ul. Szewska 18, Kraków",
                "show_map": True,
                "price_guest": Decimal("45.00"),
                "price_member": Decimal("20.00"),
                "max_participants": 4,
                "requires_subscription": False,
            },
        },
        {
            "key": "wyjazd_march_trip",
            "payload": {
                "title": "Wiosenny Wyjazd w Bieszczady",
                "description": "DANE TESTOWE (CASE_EXTRA_MARCH_TRIP): marcowy wyjazd wielodniowy do testów harmonogramu.",
                "event_type": "wyjazd",
                "start_date": marcowy_wyjazd_start,
                "end_date": marcowy_wyjazd_end,
                "time_info": "cały dzień",
                "city": "Wetlina",
                "location": "Baza Wypadowa Wetlina, Bieszczady",
                "show_map": True,
                "payment_info": "DANE TESTOWE: marcowy wyjazd wielodniowy.",
                "price_guest": Decimal("420.00"),
                "price_member": Decimal("360.00"),
                "max_participants": 5,
                "requires_subscription": False,
            },
        },
    ]


def _seed_events_payload(base_now: datetime | None = None) -> list[dict]:
    payload: list[dict] = []
    for spec in _event_seed_specs(base_now=base_now):
        row = dict(spec["payload"])
        row["manual_payment_verification"] = True
        row["manual_payment_due_hours"] = int(
            row.get("manual_payment_due_hours") or DEFAULT_MANUAL_PAYMENT_DUE_HOURS
        )

        requires_subscription = bool(row.get("requires_subscription"))
        guest_price = Decimal("0") if requires_subscription else Decimal(str(row.get("price_guest") or 0))
        member_price = Decimal(str(row.get("price_member") or 0))
        if guest_price > 0 or member_price > 0:
            row["manual_payment_url"] = row.get("manual_payment_url") or DEFAULT_MANUAL_PAYMENT_URL
        payload.append(row)
    return payload


def _base_user_seed_specs(base_now: datetime | None = None) -> list[dict]:
    now = _normalize_seed_now(base_now)
    now_naive = now.replace(tzinfo=None)

    return [
        {
            "email": "test@admin.com",
            "username": "tomasz.lewandowski",
            "full_name": "Tomasz Lewandowski",
            "plain_password": "admin123",
            "role": UserRole.ADMIN,
            "account_status": AccountStatus.ACTIVE,
            "subscription_end_date": now_naive + timedelta(days=365),
            "subscription_plan_code": None,
            "points": 1500,
            "city": "Poznań",
            "google_id": None,
            "about_me": "Koordynuję wydarzenia Kenaz i pilnuję jakości organizacji.",
            "interest_tags": ["karate", "wyjazd", "ognisko"],
            "approval_request_submitted": True,
        },
        {
            "email": "pro.one@kenaz.test",
            "username": "marta.nowicka",
            "full_name": "Marta Nowicka",
            "plain_password": "propass123",
            "role": UserRole.MEMBER,
            "account_status": AccountStatus.ACTIVE,
            "subscription_end_date": now_naive + timedelta(days=30),
            "subscription_plan_code": "pro",
            "points": 420,
            "city": "Poznań",
            "google_id": None,
            "about_me": "Lubię treningi grupowe i regularnie chodzę na jogę.",
            "interest_tags": ["joga", "spacer", "karate"],
            "approval_request_submitted": True,
        },
        {
            "email": "pro.two@kenaz.test",
            "username": "krzysztof.wojcik",
            "full_name": "Krzysztof Wójcik",
            "plain_password": "propass456",
            "role": UserRole.MEMBER,
            "account_status": AccountStatus.ACTIVE,
            "subscription_end_date": now_naive + timedelta(days=20),
            "subscription_plan_code": "pro",
            "points": 275,
            "city": "Warszawa",
            "google_id": None,
            "about_me": "Najczęściej wybieram wyjazdy i spotkania przy ognisku.",
            "interest_tags": ["wyjazd", "ognisko", "planszowki"],
            "approval_request_submitted": True,
        },
        {
            "email": "ultimate.one@kenaz.test",
            "username": "aleksandra.zielinska",
            "full_name": "Aleksandra Zielińska",
            "plain_password": "ultimate789",
            "role": UserRole.MEMBER,
            "account_status": AccountStatus.ACTIVE,
            "subscription_end_date": now_naive + timedelta(days=365),
            "subscription_plan_code": "ultimate",
            "points": 980,
            "city": "Poznań",
            "google_id": None,
            "about_me": "Doceniam aktywność na świeżym powietrzu i zimowe wejścia do wody.",
            "interest_tags": ["mors", "spacer", "wyjazd"],
            "approval_request_submitted": True,
        },
        {
            "email": "guest.one@kenaz.test",
            "username": "pawel.kaczmarek",
            "full_name": "Paweł Kaczmarek",
            "plain_password": "guestpass1",
            "role": UserRole.GUEST,
            "account_status": AccountStatus.ACTIVE,
            "subscription_end_date": None,
            "subscription_plan_code": None,
            "points": 35,
            "city": "Poznań",
            "google_id": None,
            "about_me": "W tygodniu biegam, a w weekendy chętnie dołączam do planszówek.",
            "interest_tags": ["spacer", "planszowki", "ognisko"],
            "approval_request_submitted": True,
        },
        {
            "email": "guest.two@kenaz.test",
            "username": "natalia.sikora",
            "full_name": "Natalia Sikora",
            "plain_password": "guestpass2",
            "role": UserRole.GUEST,
            "account_status": AccountStatus.ACTIVE,
            "subscription_end_date": None,
            "subscription_plan_code": None,
            "points": 0,
            "city": "Warszawa",
            "google_id": None,
            "about_me": "Szukam spokojnych wydarzeń i dobrej atmosfery po pracy.",
            "interest_tags": ["joga", "spacer", "inne"],
            "approval_request_submitted": True,
        },
        {
            "email": "guest.three@kenaz.test",
            "username": "michal.duda",
            "full_name": "Michał Duda",
            "plain_password": "guestpass3",
            "role": UserRole.GUEST,
            "account_status": AccountStatus.ACTIVE,
            "subscription_end_date": None,
            "subscription_plan_code": None,
            "points": 12,
            "city": "Poznań",
            "google_id": None,
            "about_me": "Interesują mnie krótkie wypady i wydarzenia z konkretną strukturą.",
            "interest_tags": ["karate", "wyjazd", "inne"],
            "approval_request_submitted": True,
        },
        {
            "email": "guest.four@kenaz.test",
            "username": "karolina.maj",
            "full_name": "Karolina Maj",
            "plain_password": "guestpass4",
            "role": UserRole.GUEST,
            "account_status": AccountStatus.ACTIVE,
            "subscription_end_date": None,
            "subscription_plan_code": None,
            "points": 88,
            "city": "Warszawa",
            "google_id": None,
            "about_me": "Najbardziej lubię warsztaty i spotkania z elementem rozwoju.",
            "interest_tags": ["inne", "joga", "planszowki"],
            "approval_request_submitted": True,
        },
        {
            "email": "guest.five@kenaz.test",
            "username": "jakub.borkowski",
            "full_name": "Jakub Borkowski",
            "plain_password": "guestpass5",
            "role": UserRole.GUEST,
            "account_status": AccountStatus.ACTIVE,
            "subscription_end_date": None,
            "subscription_plan_code": None,
            "points": 5,
            "city": "Poznań",
            "google_id": None,
            "about_me": "Wolę kameralne grupy i wydarzenia w terenie.",
            "interest_tags": ["ognisko", "mors", "spacer"],
            "approval_request_submitted": True,
        },
        {
            "email": "member.expired@kenaz.test",
            "username": "damian.frackowiak",
            "full_name": "Damian Frąckowiak",
            "plain_password": "expired123",
            "role": UserRole.MEMBER,
            "account_status": AccountStatus.ACTIVE,
            "subscription_end_date": now_naive - timedelta(days=3),
            "subscription_plan_code": None,
            "points": 110,
            "city": "Warszawa",
            "google_id": None,
            "about_me": "Miałem subskrypcję, teraz wracam do regularnych spotkań etapami.",
            "interest_tags": ["planszowki", "karate", "mors"],
            "approval_request_submitted": True,
        },
    ]


def _expanded_user_seed_specs(count: int, base_now: datetime | None = None) -> list[dict]:
    specs = list(_base_user_seed_specs(base_now=base_now))
    base_count = len(specs)

    # Keep dataset intentionally compact to avoid account spam in dev/demo DB.
    requested = count if isinstance(count, int) and count > 0 else base_count
    target_count = max(base_count, min(requested, base_count + 2))

    for i in range(base_count, target_count):
        index = i - base_count + 1
        specs.append(
            {
                "email": f"extra.{index}@kenaz.test",
                "username": f"osoba.dodatkowa.{index}",
                "full_name": f"Osoba Dodatkowa {index}",
                "plain_password": f"extrapass{index}",
                "role": UserRole.GUEST,
                "account_status": AccountStatus.ACTIVE,
                "subscription_end_date": None,
                "subscription_plan_code": None,
                "points": 20 + index,
                "city": "Poznań" if index % 2 else "Warszawa",
                "google_id": None,
                "about_me": "Profil testowy do uzupełniania list uczestników.",
                "interest_tags": ["spacer", "inne"] if index % 2 else ["joga", "planszowki"],
                "approval_request_submitted": True,
            }
        )

    return specs


async def _wipe_test_data() -> None:
    await ensure_db_schema()
    async with AsyncSessionLocal() as session:
        product_ids = [
            row[0]
            for row in (
                await session.execute(
                    select(Product.id).where(Product.is_test_data.is_(True))
                )
            ).all()
        ]
        event_ids = [
            row[0]
            for row in (
                await session.execute(
                    select(Event.id).where(Event.is_test_data.is_(True))
                )
            ).all()
        ]
        user_ids = [
            row[0]
            for row in (
                await session.execute(
                    select(User.id).where(User.is_test_data.is_(True))
                )
            ).all()
        ]

        registration_filters = [Registration.is_test_data.is_(True)]
        if user_ids:
            registration_filters.append(Registration.user_id.in_(user_ids))
        if event_ids:
            registration_filters.append(Registration.event_id.in_(event_ids))

        registration_condition = or_(*registration_filters)
        registration_ids = [
            row[0]
            for row in (
                await session.execute(
                    select(Registration.id).where(registration_condition)
                )
            ).all()
        ]

        refund_task_filters = []
        if registration_ids:
            refund_task_filters.append(RegistrationRefundTask.registration_id.in_(registration_ids))
        if user_ids:
            refund_task_filters.append(RegistrationRefundTask.user_id.in_(user_ids))
            refund_task_filters.append(RegistrationRefundTask.reviewed_by_admin_id.in_(user_ids))
        if event_ids:
            refund_task_filters.append(RegistrationRefundTask.event_id.in_(event_ids))
        if refund_task_filters:
            await session.execute(delete(RegistrationRefundTask).where(or_(*refund_task_filters)))

        await session.execute(delete(Registration).where(registration_condition))

        payment_filters = [Payment.is_test_data.is_(True)]
        if user_ids:
            payment_filters.append(Payment.user_id.in_(user_ids))
        await session.execute(delete(Payment).where(or_(*payment_filters)))

        if event_ids:
            await session.execute(delete(Event).where(Event.id.in_(event_ids)))

        if user_ids:
            await session.execute(delete(Subscription).where(Subscription.user_id.in_(user_ids)))
            await session.execute(delete(UserProfile).where(UserProfile.user_id.in_(user_ids)))
            await session.execute(delete(ApprovalRequest).where(ApprovalRequest.user_id.in_(user_ids)))
            await session.execute(delete(PaymentMethod).where(PaymentMethod.user_id.in_(user_ids)))
            await session.execute(delete(User).where(User.id.in_(user_ids)))

        if product_ids:
            await session.execute(delete(Product).where(Product.id.in_(product_ids)))

        await session.commit()


async def _wipe_all_except_admin(
    *,
    admin_email: str | None,
    admin_id: str | None,
    yes: bool,
    force: bool,
) -> None:
    """Delete all application data from DB while keeping a single admin user.

    This is a destructive dev/demo maintenance command.
    """
    if not yes:
        raise SystemExit(
            "Refusing to wipe DB without --yes. This is destructive. "
            "Use: wipe-all-except-admin --admin-email <email> --yes"
        )

    # Safety latch: avoid accidental execution on non-debug environments.
    try:
        from config import get_settings

        if not force and not bool(get_settings().debug):
            raise SystemExit("Refusing to wipe DB when DEBUG=false. Pass --force to override.")
    except Exception:
        # If settings cannot be loaded, err on the side of safety.
        if not force:
            raise SystemExit("Refusing to wipe DB without --force (settings unavailable).")

    await ensure_db_schema()

    async with AsyncSessionLocal() as session:
        await _apply_legacy_integer_pk_compat(session)

        # Resolve which admin to keep.
        admin_candidates_stmt = select(User).where(User.role == UserRole.ADMIN)
        if admin_id:
            admin_candidates_stmt = admin_candidates_stmt.where(User.id == admin_id)
        if admin_email:
            normalized = str(admin_email).strip().lower()
            admin_candidates_stmt = admin_candidates_stmt.where(func.lower(User.email) == normalized)

        admins = (await session.execute(admin_candidates_stmt)).scalars().all()

        if not admins:
            existing = (
                await session.execute(
                    select(User.email).where(User.role == UserRole.ADMIN).order_by(User.email)
                )
            ).scalars().all()
            hint = f" Existing admin emails: {', '.join(existing)}" if existing else " No admin users found."
            raise SystemExit(
                "Admin to keep not found. Provide --admin-email or --admin-id." + hint
            )
        if len(admins) > 1:
            raise SystemExit(
                "Multiple admin users match selection; please disambiguate with --admin-email or --admin-id."
            )

        admin = admins[0]

        # Delete child tables first (FK-safe), keeping ONLY the admin row in users.
        await session.execute(delete(RegistrationRefundTask))
        await session.execute(delete(Registration))
        await session.execute(delete(Payment))
        await session.execute(delete(Event))
        await session.execute(delete(City))
        await session.execute(delete(Product))
        await session.execute(delete(Subscription).where(Subscription.user_id != admin.id))
        await session.execute(delete(UserProfile).where(UserProfile.user_id != admin.id))
        await session.execute(delete(ApprovalRequest).where(ApprovalRequest.user_id != admin.id))
        await session.execute(delete(PaymentMethod).where(PaymentMethod.user_id != admin.id))
        await session.execute(delete(User).where(User.id != admin.id))

        await session.commit()


async def _seed_products(reset: bool) -> None:
    await ensure_db_schema()
    if reset:
        await _wipe_test_data()

    products_payload = [
        {
            "name": "Czapka Kenaz",
            "description": "Czapka z haftem Kenaz. Lekka, wygodna, na każdą porę.",
            "price": Decimal("79.00"),
            "image_url": "/static/about6.jpg",
        },
        {
            "name": "Bluza Kenaz",
            "description": "Miękka bluza z logo Kenaz. Idealna na trening i po treningu.",
            "price": Decimal("219.00"),
            "image_url": "/static/about7.jpg",
        },
        {
            "name": "Koszulka Kenaz",
            "description": "Bawełniana koszulka Kenaz. Klasyczny krój, codzienny komfort.",
            "price": Decimal("119.00"),
            "image_url": "/static/about2.jpg",
        },
    ]

    async with AsyncSessionLocal() as session:
        await _apply_legacy_integer_pk_compat(session)
        items = [Product(**data, is_active=True, is_test_data=True) for data in products_payload]
        session.add_all(items)
        await session.commit()


async def _seed_events(reset: bool) -> None:
    await ensure_db_schema()

    if reset:
        await _wipe_test_data()

    payload = _seed_events_payload()

    async with AsyncSessionLocal() as session:
        await _apply_legacy_integer_pk_compat(session)
        events: list[Event] = [Event(**data, is_test_data=True) for data in payload]
        session.add_all(events)
        await session.commit()


async def _seed_users(count: int, reset: bool) -> None:
    await ensure_db_schema()
    if reset:
        await _wipe_test_data()

    user_specs = _expanded_user_seed_specs(count=count)

    async with AsyncSessionLocal() as session:
        await _apply_legacy_integer_pk_compat(session)
        for spec in user_specs:
            plain_password = spec.get("plain_password")
            password_hash = PASSWORD_CONTEXT.hash(plain_password) if plain_password else None
            interest_tags = spec.get("interest_tags") or []
            interest_tags_json = json.dumps(interest_tags, ensure_ascii=False)

            normalized_email = str(spec["email"]).strip().lower()
            normalized_username = str(spec.get("username") or "").strip().lower()

            existing = (
                await session.execute(
                    select(User).where(func.lower(User.email) == normalized_email)
                )
            ).scalar_one_or_none()
            if existing is None and normalized_username:
                existing = (
                    await session.execute(
                        select(User).where(func.lower(User.username) == normalized_username)
                    )
                ).scalar_one_or_none()

            target = existing or User()
            target.google_id = spec.get("google_id")
            target.username = spec.get("username")
            target.email = spec["email"]
            target.full_name = spec["full_name"]
            target.password_hash = password_hash
            target.role = spec["role"]
            target.account_status = spec["account_status"]
            target.is_test_data = True

            session.add(target)
            await session.flush()

            subscription_end_date = spec.get("subscription_end_date")
            points = int(spec.get("points") or 0)
            if subscription_end_date or points:
                subscription = await session.get(Subscription, target.id)
                if not subscription:
                    subscription = Subscription(user_id=target.id, is_test_data=True)
                subscription.end_date = subscription_end_date
                subscription.points = points
                session.add(subscription)

            about_me = spec.get("about_me")
            if about_me or interest_tags:
                profile = await session.get(UserProfile, target.id)
                if not profile:
                    profile = UserProfile(user_id=target.id, is_test_data=True)
                profile.about_me = about_me
                profile.interest_tags = interest_tags_json
                session.add(profile)

            if bool(spec.get("approval_request_submitted", False)):
                approval_request = await session.get(ApprovalRequest, target.id)
                if not approval_request:
                    approval_request = ApprovalRequest(
                        user_id=target.id,
                        is_test_data=True,
                    )
                session.add(approval_request)

        await session.commit()


def _get_required_event(events_by_title: dict[str, Event], title: str) -> Event:
    event = events_by_title.get(title)
    if event is None:
        raise SystemExit(
            f"Missing test event '{title}'. Run: python -m backend.cli seed-events --reset"
        )
    return event


def _get_required_user(users_by_email: dict[str, User], email: str) -> User:
    user = users_by_email.get(email)
    if user is None:
        raise SystemExit(
            f"Missing test user '{email}'. Run: python -m backend.cli seed-users --reset"
        )
    return user


async def _seed_registrations(per_event: int, reset: bool) -> None:
    del per_event  # deterministic edge-case dataset ignores random/per-event sizing

    await ensure_db_schema()
    if reset:
        await _wipe_test_data()

    async with AsyncSessionLocal() as session:
        await _apply_legacy_integer_pk_compat(session)
        status_column_length = await session.run_sync(
            lambda sync_session: next(
                (
                    column.get("type").length
                    for column in inspect(sync_session.bind).get_columns("registrations")
                    if column.get("name") == "status"
                ),
                None,
            )
        )
        supports_extended_status = (
            status_column_length is None
            or status_column_length >= len(RegistrationStatus.MANUAL_PAYMENT_VERIFICATION.value)
        )
        manual_required_status = (
            RegistrationStatus.MANUAL_PAYMENT_REQUIRED.value
            if supports_extended_status
            else RegistrationStatus.PENDING.value
        )
        manual_verification_status = (
            RegistrationStatus.MANUAL_PAYMENT_VERIFICATION.value
            if supports_extended_status
            else RegistrationStatus.PENDING.value
        )

        now = _normalize_seed_now()

        events = [
            row[0]
            for row in (
                await session.execute(
                    select(Event)
                    .where(Event.is_test_data.is_(True))
                    .order_by(Event.created_at.desc(), Event.id.desc())
                )
            ).all()
        ]
        users = [
            row[0]
            for row in (
                await session.execute(
                    select(User)
                    .where(User.is_test_data.is_(True))
                    .order_by(User.created_at.asc())
                )
            ).all()
        ]

        if not events:
            raise SystemExit("No test events found. Run: python -m backend.cli seed-events")
        if not users:
            raise SystemExit("No test users found. Run: python -m backend.cli seed-users")

        events_by_title: dict[str, Event] = {}
        for event in events:
            title = str(event.title)
            if title not in events_by_title:
                events_by_title[title] = event

        users_by_email = {str(user.email).lower(): user for user in users}

        expected_titles_by_key = {
            spec["key"]: str(spec["payload"]["title"])
            for spec in _event_seed_specs(base_now=now)
            if spec["key"] in EDGE_CASE_EVENT_KEYS
        }
        missing_keys = [
            key
            for key, title in expected_titles_by_key.items()
            if title not in events_by_title
        ]
        if missing_keys:
            raise SystemExit(
                "Missing required edge-case events: " + ", ".join(sorted(missing_keys))
            )

        admin = _get_required_user(users_by_email, "test@admin.com")
        pro_one = _get_required_user(users_by_email, "pro.one@kenaz.test")
        pro_two = _get_required_user(users_by_email, "pro.two@kenaz.test")
        ultimate_one = _get_required_user(users_by_email, "ultimate.one@kenaz.test")
        guest_one = _get_required_user(users_by_email, "guest.one@kenaz.test")
        guest_two = _get_required_user(users_by_email, "guest.two@kenaz.test")
        guest_three = _get_required_user(users_by_email, "guest.three@kenaz.test")
        guest_four = _get_required_user(users_by_email, "guest.four@kenaz.test")
        guest_five = _get_required_user(users_by_email, "guest.five@kenaz.test")
        member_expired = _get_required_user(users_by_email, "member.expired@kenaz.test")

        karate = _get_required_event(events_by_title, expected_titles_by_key["karate_full"])
        mors = _get_required_event(events_by_title, expected_titles_by_key["mors_empty"])
        planszowki = _get_required_event(events_by_title, expected_titles_by_key["planszowki_almost_full"])
        ognisko = _get_required_event(events_by_title, expected_titles_by_key["ognisko_waitlist"])
        spacer = _get_required_event(events_by_title, expected_titles_by_key["spacer_video"])
        joga = _get_required_event(events_by_title, expected_titles_by_key["joga_map"])
        wyjazd = _get_required_event(events_by_title, expected_titles_by_key["wyjazd_subscription_only"])
        manual = _get_required_event(events_by_title, expected_titles_by_key["inne_manual_payment"])

        def add_registration(
            user: User,
            event: Event,
            status: str,
            *,
            manual_payment_confirmed_at: datetime | None = None,
            promoted_from_waitlist_at: datetime | None = None,
            manual_payment_due_at: datetime | None = None,
            waitlist_notification_sent: bool = False,
            waitlist_notified_at: datetime | None = None,
        ) -> Registration:
            registration = Registration(
                user_id=user.id,
                event_id=event.id,
                occurrence_date=event.start_date.date(),
                status=status,
                manual_payment_confirmed_at=manual_payment_confirmed_at,
                promoted_from_waitlist_at=promoted_from_waitlist_at,
                manual_payment_due_at=manual_payment_due_at,
                waitlist_notification_sent=waitlist_notification_sent,
                waitlist_notified_at=waitlist_notified_at,
                is_test_data=True,
            )
            session.add(registration)
            return registration

        # 1) FULL (4/4)
        add_registration(pro_one, karate, RegistrationStatus.CONFIRMED.value)
        add_registration(ultimate_one, karate, RegistrationStatus.CONFIRMED.value)
        add_registration(guest_one, karate, RegistrationStatus.CONFIRMED.value)
        add_registration(guest_two, karate, RegistrationStatus.CONFIRMED.value)

        # 2) EMPTY (0/5) -> mors gets no registrations.
        _ = mors

        # 3) ALMOST FULL (3/4)
        add_registration(pro_two, planszowki, RegistrationStatus.CONFIRMED.value)
        add_registration(guest_three, planszowki, RegistrationStatus.CONFIRMED.value)
        add_registration(guest_four, planszowki, RegistrationStatus.CONFIRMED.value)

        # 4) WAITLIST (full + reserve queue)
        add_registration(guest_one, ognisko, RegistrationStatus.CONFIRMED.value)
        add_registration(guest_two, ognisko, RegistrationStatus.CONFIRMED.value)
        add_registration(member_expired, ognisko, RegistrationStatus.CONFIRMED.value)
        add_registration(guest_five, ognisko, RegistrationStatus.CONFIRMED.value)
        add_registration(guest_three, ognisko, RegistrationStatus.WAITLIST.value)
        add_registration(guest_four, ognisko, RegistrationStatus.WAITLIST.value)

        # 5) VIDEO
        add_registration(pro_one, spacer, RegistrationStatus.CONFIRMED.value)
        add_registration(guest_five, spacer, RegistrationStatus.CONFIRMED.value)

        # 6) MAP
        add_registration(ultimate_one, joga, RegistrationStatus.CONFIRMED.value)

        # 7) SUBSCRIPTION-ONLY
        add_registration(pro_one, wyjazd, RegistrationStatus.CONFIRMED.value)
        add_registration(pro_two, wyjazd, RegistrationStatus.CONFIRMED.value)
        add_registration(ultimate_one, wyjazd, RegistrationStatus.CONFIRMED.value)

        # 8) MANUAL PAYMENT FLOW (required + verification + waitlist)
        add_registration(guest_two, manual, RegistrationStatus.CONFIRMED.value)
        manual_required_registration = add_registration(
            guest_three,
            manual,
            manual_required_status,
            promoted_from_waitlist_at=now - timedelta(hours=2),
            manual_payment_due_at=now + timedelta(hours=20),
        )
        manual_verification_registration = add_registration(
            guest_four,
            manual,
            manual_verification_status,
            manual_payment_confirmed_at=now - timedelta(hours=1),
            manual_payment_due_at=now + timedelta(hours=20),
        )
        add_registration(guest_five, manual, RegistrationStatus.WAITLIST.value)

        # Extra cancelled rows to populate refund workflows.
        cancelled_for_refund = add_registration(
            guest_one,
            joga,
            RegistrationStatus.CANCELLED.value,
        )
        cancelled_no_refund = add_registration(
            member_expired,
            spacer,
            RegistrationStatus.CANCELLED.value,
        )

        await session.flush()

        # Seed subscription payments to expose plan_code via /auth/me.
        subscription_payments: list[Payment] = []
        subscription_seed = [
            (pro_one, "pro", "SUB_TEST_PRO_01"),
            (pro_two, "pro", "SUB_TEST_PRO_02"),
            (ultimate_one, "ultimate", "SUB_TEST_ULTIMATE_01"),
        ]
        for user, plan_code, external_id in subscription_seed:
            meta = SUBSCRIPTION_PLANS[plan_code]
            subscription_payments.append(
                Payment(
                    user_id=user.id,
                    external_id=external_id,
                    amount=meta["amount"],
                    currency="PLN",
                    payment_type=PaymentType.SUBSCRIPTION.value,
                    status=DBPaymentStatus.COMPLETED.value,
                    description=f"Subscription {plan_code}",
                    extra_data=json.dumps(
                        {
                            "type": "subscription",
                            "plan_code": plan_code,
                            "duration_days": meta["duration_days"],
                            "subscription_applied_at": (now - timedelta(days=1)).isoformat(),
                        }
                    ),
                    completed_at=now - timedelta(days=1),
                    is_test_data=True,
                )
            )

        # Payment for manual verification queue.
        manual_payment = Payment(
            user_id=guest_four.id,
            external_id="MANUAL_TEST_VERIFY_01",
            amount=Decimal(str(manual.price_guest)),
            currency="PLN",
            payment_type=PaymentType.EVENT.value,
            status=DBPaymentStatus.PROCESSING.value,
            description=f"Manual payment for {manual.title}",
            extra_data=json.dumps(
                {
                    "event_id": manual.id,
                    "registration_id": manual_verification_registration.id,
                    "manual_payment_reference": str(manual.id),
                    "declared_at": (now - timedelta(hours=1)).isoformat(),
                }
            ),
            is_test_data=True,
        )
        manual_verification_registration.payment_id = manual_payment.external_id

        session.add_all(subscription_payments)
        session.add(manual_payment)

        # Refund tasks for manual payouts dashboard.
        refund_tasks = [
            RegistrationRefundTask(
                registration_id=cancelled_for_refund.id,
                user_id=cancelled_for_refund.user_id,
                event_id=cancelled_for_refund.event_id,
                occurrence_date=cancelled_for_refund.occurrence_date,
                refund_eligible=True,
                recommended_should_refund=True,
                should_refund=True,
                refund_marked_paid=False,
            ),
            RegistrationRefundTask(
                registration_id=cancelled_no_refund.id,
                user_id=cancelled_no_refund.user_id,
                event_id=cancelled_no_refund.event_id,
                occurrence_date=cancelled_no_refund.occurrence_date,
                refund_eligible=False,
                recommended_should_refund=False,
                should_refund=False,
                refund_marked_paid=False,
                reviewed_by_admin_id=admin.id,
                reviewed_at=now - timedelta(minutes=30),
                override_reason="Already reviewed - no refund",
            ),
        ]
        session.add_all(refund_tasks)

        # Keep variable referenced to avoid lint confusion in future edits.
        _ = manual_required_registration

        await session.commit()


async def _seed_demo(users: int, per_event: int, reset: bool) -> None:
    if reset:
        await _wipe_test_data()
    await _seed_events(reset=False)
    await _seed_users(count=users, reset=False)
    await _seed_registrations(per_event=per_event, reset=False)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="kenaz", description="Kenaz dev/test CLI")
    sub = parser.add_subparsers(dest="command", required=True)

    seed = sub.add_parser("seed-events", help="Insert deterministic edge-case test events")
    seed.add_argument("--reset", action="store_true", help="Wipe test data before seeding")

    seed_users = sub.add_parser("seed-users", help="Insert deterministic test users")
    seed_users.add_argument("--count", type=int, default=10)
    seed_users.add_argument("--reset", action="store_true", help="Wipe test data before seeding")

    seed_regs = sub.add_parser("seed-registrations", help="Create deterministic registration edge-cases")
    seed_regs.add_argument("--per-event", type=int, default=5)
    seed_regs.add_argument("--reset", action="store_true", help="Wipe test data before seeding")

    seed_products = sub.add_parser("seed-products", help="Insert demo products (marked as test data)")
    seed_products.add_argument("--reset", action="store_true", help="Wipe test data before seeding")

    seed_demo = sub.add_parser("seed-demo", help="Seed edge-case events + users + registrations")
    seed_demo.add_argument("--users", type=int, default=10)
    seed_demo.add_argument("--per-event", type=int, default=5)
    seed_demo.add_argument("--reset", action="store_true", help="Wipe test data before seeding")

    sub.add_parser("wipe-test-data", help="Delete all rows marked as test data")

    wipe_all = sub.add_parser(
        "wipe-all-except-admin",
        help="Delete ALL application data but keep one admin user",
    )
    wipe_all.add_argument("--admin-email", type=str, default=None, help="Admin email to keep")
    wipe_all.add_argument("--admin-id", type=str, default=None, help="Admin user id to keep")
    wipe_all.add_argument("--yes", action="store_true", help="Confirm destructive operation")
    wipe_all.add_argument("--force", action="store_true", help="Override DEBUG safety latch")

    return parser


def main(argv: list[str] | None = None) -> None:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.command == "seed-events":
        asyncio.run(_seed_events(reset=args.reset))
    elif args.command == "seed-users":
        asyncio.run(_seed_users(count=args.count, reset=args.reset))
    elif args.command == "seed-registrations":
        asyncio.run(_seed_registrations(per_event=args.per_event, reset=args.reset))
    elif args.command == "seed-demo":
        asyncio.run(_seed_demo(users=args.users, per_event=args.per_event, reset=args.reset))
    elif args.command == "seed-products":
        asyncio.run(_seed_products(reset=args.reset))
    elif args.command == "wipe-test-data":
        asyncio.run(_wipe_test_data())
    elif args.command == "wipe-all-except-admin":
        asyncio.run(
            _wipe_all_except_admin(
                admin_email=args.admin_email,
                admin_id=args.admin_id,
                yes=args.yes,
                force=args.force,
            )
        )
    else:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
