import pytest
import asyncio
from decimal import Decimal
from datetime import datetime, timedelta
import os
import socket
import sys
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set test admin email BEFORE any project import triggers get_settings().
os.environ["ROOT_ADMIN_EMAIL"] = "tomek.piescikowski@gmail.com"

from database import Base
from models.user import User, UserRole, AccountStatus
from models.subscription import Subscription
from models.event import Event
from models.registration import Registration, RegistrationStatus
from models.payment import Payment
from models.registration_refund_task import RegistrationRefundTask
from adapters.fake_payment_adapter import FakePaymentAdapter
from services.payment_service import PaymentService
from services.registration_service import RegistrationService
from security.rate_limit import clear_rate_limiter_state


@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(autouse=True)
def clear_rate_limits_between_tests():
    """Keep per-test isolation for in-memory rate limiter state."""
    clear_rate_limiter_state()
    yield
    clear_rate_limiter_state()


@pytest.fixture
async def db_engine():
    """Create PostgreSQL engine for testing."""
    def _port_open(host: str, port: int) -> bool:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
                sock.settimeout(0.5)
                return sock.connect_ex((host, port)) == 0
        except (socket.gaierror, OSError):
            return False

    default_test_url = "postgresql+asyncpg://postgres:postgres@localhost:5432/kenaz_test"
    if _port_open("db", 5432):
        default_test_url = "postgresql+asyncpg://kenaz:kenaz@db:5432/kenaz_test"

    test_db_url = os.getenv(
        "DATABASE_URL_TEST",
        default_test_url,
    )
    if test_db_url.startswith("postgresql://"):
        test_db_url = test_db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if test_db_url.startswith("postgres://"):
        test_db_url = test_db_url.replace("postgres://", "postgresql+asyncpg://", 1)

    engine = create_async_engine(test_db_url)

    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
    except OSError:
        await engine.dispose()
        pytest.skip("PostgreSQL is not available – skipping database tests")

    yield engine

    await engine.dispose()


@pytest.fixture
async def db_session(db_engine):
    """Create database session for testing."""
    async_session = async_sessionmaker(
        db_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with async_session() as session:
        yield session
        await session.rollback()


@pytest.fixture
def payment_gateway():
    """Create fake payment gateway for testing."""
    return FakePaymentAdapter(auto_complete=False)


@pytest.fixture
def auto_complete_payment_gateway():
    """Create fake payment gateway that auto-completes payments."""
    return FakePaymentAdapter(auto_complete=True)


@pytest.fixture
async def payment_service(db_session, payment_gateway):
    """Create payment service for testing."""
    return PaymentService(db_session, payment_gateway)


@pytest.fixture
async def registration_service(db_session, payment_service):
    """Create registration service for testing."""
    return RegistrationService(db_session, payment_service)


@pytest.fixture
async def test_user(db_session) -> User:
    """Create a test user."""
    user = User(
        google_id="google_123",
        email="test@example.com",
        full_name="Test User",
        role=UserRole.GUEST,
        account_status=AccountStatus.ACTIVE,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def test_member(db_session) -> User:
    """Create a test member (with subscription)."""
    user = User(
        google_id="google_456",
        email="member@example.com",
        full_name="Test Member",
        role=UserRole.MEMBER,
        account_status=AccountStatus.ACTIVE,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    db_session.add(Subscription(user_id=user.id, end_date=datetime.now() + timedelta(days=30)))
    await db_session.commit()
    return user


@pytest.fixture
async def test_event(db_session) -> Event:
    """Create a test event with limited spots."""
    event = Event(
        title="Test Morsowanie",
        description="Poranne morsowanie w jeziorze",
        event_type="mors",
        start_date=datetime.now() + timedelta(days=7),
        time_info="10:00",
        city="Poznań",
        price_guest=Decimal("50.00"),
        price_member=Decimal("30.00"),
        max_participants=10,
        version=1,
    )
    db_session.add(event)
    await db_session.commit()
    await db_session.refresh(event)
    return event


@pytest.fixture
async def test_free_event(db_session) -> Event:
    """Create a free test event."""
    event = Event(
        title="Darmowe Planszówki",
        description="Wieczór gier planszowych",
        event_type="planszowki",
        start_date=datetime.now() + timedelta(days=3),
        time_info="18:00-22:00",
        city="Poznań",
        price_guest=Decimal("0.00"),
        price_member=Decimal("0.00"),
        max_participants=20,
        version=1,
    )
    db_session.add(event)
    await db_session.commit()
    await db_session.refresh(event)
    return event


@pytest.fixture
async def test_full_event(db_session) -> Event:
    """Create a test event that is full."""
    event = Event(
        title="Full Event",
        description="This event is full",
        event_type="karate",
        start_date=datetime.now() + timedelta(days=5),
        time_info="19:30-21:00",
        city="Poznań",
        price_guest=Decimal("40.00"),
        price_member=Decimal("30.00"),
        max_participants=2,
        version=1,
    )
    db_session.add(event)
    await db_session.commit()
    await db_session.refresh(event)
    return event


@pytest.fixture
async def test_subscription_event(db_session) -> Event:
    """Create an event that requires an active subscription."""
    event = Event(
        title="Subscription Only",
        description="Members only",
        event_type="karate",
        start_date=datetime.now() + timedelta(days=2),
        time_info="18:00",
        city="Poznań",
        price_guest=Decimal("50.00"),
        price_member=Decimal("30.00"),
        max_participants=10,
        requires_subscription=True,
        version=1,
    )
    db_session.add(event)
    await db_session.commit()
    await db_session.refresh(event)
    return event
    await db_session.refresh(event)
    return event
