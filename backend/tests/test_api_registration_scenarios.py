from __future__ import annotations

"""Scenario-level API tests.

These tests intentionally exercise multiple routers together (events/registrations/admin)
using an in-memory ASGI client and a real test database session.

The goal is to validate end-to-end user flows (waitlist + cancellations + manual payment
verification + refunds + admin stats) without changing backend code.
"""

from datetime import datetime, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from database import get_db
from models.event import Event
from models.user import AccountStatus, User, UserRole
from routers import admin_router, events_router, registrations_router, users_router
from routers.auth import get_current_user_dependency


async def _build_client(db_session, *, current_user: User | None) -> AsyncClient:
    """Build an ASGI client with DB overridden and optionally an authenticated user."""
    app = FastAPI()
    app.include_router(events_router)
    app.include_router(registrations_router)
    app.include_router(users_router)
    app.include_router(admin_router)

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    if current_user is not None:

        async def override_current_user_dependency():
            return current_user

        app.dependency_overrides[get_current_user_dependency] = override_current_user_dependency

    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def _create_user(
    db_session,
    *,
    role: UserRole,
    account_status: AccountStatus,
    email_prefix: str,
    full_name: str,
) -> User:
    suffix = uuid4().hex[:12]
    user = User(
        google_id=f"{email_prefix}-{suffix}",
        email=f"{email_prefix}-{suffix}@example.com",
        full_name=full_name,
        role=role,
        account_status=account_status,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


async def _create_paid_manual_event(
    db_session,
    *,
    title: str,
    max_participants: int,
    start_in: timedelta,
    cancel_cutoff_hours: int = 24,
    manual_payment_due_hours: int = 24,
) -> Event:
    event = Event(
        title=title,
        description=f"{title} description",
        event_type="mors",
        start_date=datetime.utcnow() + start_in,
        time_info="10:00",
        city="Poznań",
        price_guest=Decimal("50.00"),
        price_member=Decimal("30.00"),
        max_participants=max_participants,
        version=1,
        manual_payment_verification=True,
        manual_payment_url="https://payments.example/manual-transfer",
        manual_payment_due_hours=manual_payment_due_hours,
        cancel_cutoff_hours=cancel_cutoff_hours,
        points_value=1,
    )
    db_session.add(event)
    await db_session.commit()
    await db_session.refresh(event)
    return event


@pytest.mark.asyncio
async def test_scenario_waitlist_cancellation_promotion_manual_payment_and_stats(db_session):
    """
    Full waitlist-promotion-manual-payment lifecycle with stats verification.

    Reproduces a real flow: users A and B register for a paid event with limited
    spots (manual verification mode), user C lands on the waitlist. B cancels
    before the cutoff, promoting C from the waitlist to manual_payment_required.
    A and C then go through manual confirmation + admin approval. Finally, the
    test verifies participants, availability, B's refund task, and payment/event
    statistics.

    Endpoints exercised (in order):
     1) POST /events/{event_id}/register (A)  -> 200 manual_payment_required
     2) POST /events/{event_id}/register (B)  -> 200 manual_payment_required
     3) POST /events/{event_id}/register (C)  -> 200 waitlist
     4) GET  /events/{event_id}/availability  -> spots occupied by manual_payment_required too
     5) POST /registrations/{regA}/manual-payment/confirm -> 200 manual_payment_verification
     6) GET  /admin/manual-payments/pending  -> includes A
     7) POST /admin/manual-payments/{regA}/approve -> 200 status confirmed
     8) POST /registrations/{regB}/cancel -> 200 success + refund_task_id (side-effect: promotes C)
     9) GET  /registrations/{regC}/manual-payment -> 200 manual_payment_required, promoted_from_waitlist
    10) POST /registrations/{regC}/manual-payment/confirm -> 200 manual_payment_verification
    11) POST /admin/manual-payments/{regC}/approve -> 200 confirmed
    12) GET  /events/{event_id}/participants  -> A and C
    13) GET  /admin/manual-payments/refunds   -> refund task for B (no refund recommendation, no payment_id)
    14) GET  /admin/stats/payments            -> completed_count=2, refunded_count=0, completed_amount=100.00 PLN
    15) GET  /admin/stats/events              -> total_paid=100.00 PLN for the event

    Key domain invariants verified:
    - manual_payment_required registrations occupy a spot (available_spots=0, is_available=false).
    - Cancelling before cutoff creates a RegistrationRefundTask but does not process an
      automatic refund (event uses manual-payment mode).
    - Waitlist promotion for a manual-payment event sets the promoted user to
      manual_payment_required with a deadline.
    - Admin approval of a manual payment sets Payment.status=completed and
      Registration.status=confirmed.
    """

    admin = await _create_user(
        db_session,
        role=UserRole.ADMIN,
        account_status=AccountStatus.ACTIVE,
        email_prefix="admin",
        full_name="Admin",
    )
    user_a = await _create_user(
        db_session,
        role=UserRole.GUEST,
        account_status=AccountStatus.ACTIVE,
        email_prefix="user-a",
        full_name="User A",
    )
    user_b = await _create_user(
        db_session,
        role=UserRole.GUEST,
        account_status=AccountStatus.ACTIVE,
        email_prefix="user-b",
        full_name="User B",
    )
    user_c = await _create_user(
        db_session,
        role=UserRole.GUEST,
        account_status=AccountStatus.ACTIVE,
        email_prefix="user-c",
        full_name="User C",
    )

    event = await _create_paid_manual_event(
        db_session,
        title="Scenario 1 - Paid manual",
        max_participants=2,
        start_in=timedelta(days=3),
        cancel_cutoff_hours=24,
        manual_payment_due_hours=24,
    )

    admin_client = await _build_client(db_session, current_user=admin)
    client_a = await _build_client(db_session, current_user=user_a)
    client_b = await _build_client(db_session, current_user=user_b)
    client_c = await _build_client(db_session, current_user=user_c)

    try:
        # A registers (manual payment required)
        res = await client_a.post(
            f"/events/{event.id}/register",
            json={"return_url": "http://localhost:5173/return", "cancel_url": "http://localhost:5173/cancel"},
        )
        assert res.status_code == 200
        reg_a = res.json()
        assert reg_a["status"] == "manual_payment_required"
        reg_a_id = reg_a["registration_id"]
        assert reg_a["manual_payment_required"] is True
        assert reg_a["amount"] == "50.00"
        assert reg_a["transfer_reference"] == str(event.id)
        assert reg_a["payment_deadline"] is not None

        # B registers (manual payment required)
        res = await client_b.post(
            f"/events/{event.id}/register",
            json={"return_url": "http://localhost:5173/return", "cancel_url": "http://localhost:5173/cancel"},
        )
        assert res.status_code == 200
        reg_b = res.json()
        assert reg_b["status"] == "manual_payment_required"
        reg_b_id = reg_b["registration_id"]
        assert reg_b["payment_deadline"] is not None

        # C registers -> waitlist
        res = await client_c.post(
            f"/events/{event.id}/register",
            json={"return_url": "http://localhost:5173/return", "cancel_url": "http://localhost:5173/cancel"},
        )
        assert res.status_code == 200
        reg_c = res.json()
        assert reg_c["status"] == "waitlist"
        assert reg_c["is_waitlisted"] is True
        reg_c_id = reg_c["registration_id"]

        # Availability: spots are occupied by manual_payment_required
        res = await client_a.get(f"/events/{event.id}/availability")
        assert res.status_code == 200
        avail = res.json()
        assert avail["max_participants"] == 2
        assert avail["confirmed_count"] == 0
        assert avail["waitlist_count"] == 1
        assert avail["available_spots"] == 0
        assert avail["is_available"] is False

        # A confirms manual payment -> verification
        res = await client_a.post(f"/registrations/{reg_a_id}/manual-payment/confirm")
        assert res.status_code == 200
        details_a = res.json()
        assert details_a["registration_id"] == reg_a_id
        assert details_a["status"] == "manual_payment_verification"
        assert details_a["can_confirm"] is False

        # Admin sees A in pending manual payments
        res = await admin_client.get("/admin/manual-payments/pending")
        assert res.status_code == 200
        pending = res.json()
        assert any(item["registration_id"] == reg_a_id for item in pending)

        # Admin approves A
        res = await admin_client.post(f"/admin/manual-payments/{reg_a_id}/approve")
        assert res.status_code == 200
        approved_a = res.json()
        assert approved_a["registration_id"] == reg_a_id
        assert approved_a["status"] == "confirmed"
        assert approved_a["payment_id"]

        # B cancels before cutoff -> should succeed, refund not processed automatically (manual event)
        res = await client_b.post(f"/registrations/{reg_b_id}/cancel")
        assert res.status_code == 200
        cancel_b = res.json()
        assert cancel_b["success"] is True
        assert cancel_b["refund_eligible"] is True
        assert cancel_b["refund_processed"] is False
        assert cancel_b["refund_task_id"]

        # C should now be promoted from waitlist to manual_payment_required
        res = await client_c.get(f"/registrations/{reg_c_id}/manual-payment")
        assert res.status_code == 200
        details_c = res.json()
        assert details_c["registration_id"] == reg_c_id
        assert details_c["status"] == "manual_payment_required"
        assert details_c["promoted_from_waitlist"] is True
        assert details_c["payment_deadline"] is not None
        assert details_c["can_confirm"] is True

        # C confirms manual payment -> verification
        res = await client_c.post(f"/registrations/{reg_c_id}/manual-payment/confirm")
        assert res.status_code == 200
        details_c_confirm = res.json()
        assert details_c_confirm["status"] == "manual_payment_verification"

        # Admin approves C
        res = await admin_client.post(f"/admin/manual-payments/{reg_c_id}/approve")
        assert res.status_code == 200
        approved_c = res.json()
        assert approved_c["registration_id"] == reg_c_id
        assert approved_c["status"] == "confirmed"
        assert approved_c["payment_id"]

        # Final participants: A and C
        res = await client_a.get(f"/events/{event.id}/participants")
        assert res.status_code == 200
        participants = res.json()
        participant_user_ids = {p["user_id"] for p in participants}
        assert participant_user_ids == {str(user_a.id), str(user_c.id)}

        # Refund tasks include B, but recommended refund is false because B has no payment_id
        res = await admin_client.get("/admin/manual-payments/refunds")
        assert res.status_code == 200
        tasks = res.json()
        b_task = next((t for t in tasks if t["registration_id"] == reg_b_id), None)
        assert b_task is not None
        assert b_task["refund_eligible"] is True
        assert b_task["recommended_should_refund"] is False
        assert b_task["should_refund"] is False
        assert b_task["payment_id"] is None

        # Payment stats reflect two completed manual payments
        res = await admin_client.get("/admin/stats/payments")
        assert res.status_code == 200
        stats = res.json()
        assert stats["completed_count"] == 2
        assert stats["refunded_count"] == 0
        assert stats["completed_amount"] == "100.00 PLN"

        # Event stats total_paid reflects only completed payments
        res = await admin_client.get("/admin/stats/events")
        assert res.status_code == 200
        events_stats = res.json()
        this = next((e for e in events_stats if e["event_id"] == str(event.id)), None)
        assert this is not None
        assert this["total_paid"] == "100.00 PLN"
    finally:
        await admin_client.aclose()
        await client_a.aclose()
        await client_b.aclose()
        await client_c.aclose()


@pytest.mark.asyncio
async def test_scenario_manual_payment_then_cancel_then_admin_marks_refund_paid(db_session):
    """
    Manual payment, cancellation, and admin-marked offline refund lifecycle.

    Covers the full cycle: user registers for a paid event (manual mode), declares
    a bank transfer, admin approves the payment, user cancels within the cutoff
    window, and admin marks the refund as paid offline via the refund-tasks module.

    Domain logic verified:
    - User declares transfer: Payment created as EVENT with status=processing.
    - Admin approves: Payment.status -> completed, Registration.status -> confirmed.
    - User cancels: Registration.status -> cancelled; RegistrationRefundTask created
      with refund_eligible=True (payment_id exists, so refund is recommended).
    - Admin marks refund paid: Payment.status -> refunded, Registration.status -> refunded.
    - Payment and event statistics reflect the refunded status.

    Endpoints:
    - POST /events/{id}/register
    - POST /registrations/{reg}/manual-payment/confirm
    - POST /admin/manual-payments/{reg}/approve
    - POST /registrations/{reg}/cancel
    - GET  /admin/manual-payments/refunds
    - PATCH /admin/manual-payments/refunds/{task_id}
    - GET  /admin/stats/payments
    - GET  /admin/stats/events
    """

    admin = await _create_user(
        db_session,
        role=UserRole.ADMIN,
        account_status=AccountStatus.ACTIVE,
        email_prefix="admin2",
        full_name="Admin 2",
    )
    user = await _create_user(
        db_session,
        role=UserRole.GUEST,
        account_status=AccountStatus.ACTIVE,
        email_prefix="payer",
        full_name="Payer",
    )
    event = await _create_paid_manual_event(
        db_session,
        title="Scenario 2 - Refund",
        max_participants=10,
        start_in=timedelta(days=4),
        cancel_cutoff_hours=24,
        manual_payment_due_hours=24,
    )

    admin_client = await _build_client(db_session, current_user=admin)
    client = await _build_client(db_session, current_user=user)

    try:
        # Register -> manual payment required
        res = await client.post(
            f"/events/{event.id}/register",
            json={"return_url": "http://localhost:5173/return", "cancel_url": "http://localhost:5173/cancel"},
        )
        assert res.status_code == 200
        payload = res.json()
        assert payload["status"] == "manual_payment_required"
        reg_id = payload["registration_id"]

        # Confirm manual payment -> verification + creates Payment record
        res = await client.post(f"/registrations/{reg_id}/manual-payment/confirm")
        assert res.status_code == 200
        assert res.json()["status"] == "manual_payment_verification"

        # Admin approves -> payment completed + registration confirmed
        res = await admin_client.post(f"/admin/manual-payments/{reg_id}/approve")
        assert res.status_code == 200
        approved = res.json()
        assert approved["status"] == "confirmed"
        payment_id = approved["payment_id"]
        assert isinstance(payment_id, str) and payment_id

        # Cancel registration -> should create refund task; no auto-refund (manual mode)
        res = await client.post(f"/registrations/{reg_id}/cancel")
        assert res.status_code == 200
        cancel = res.json()
        assert cancel["success"] is True
        assert cancel["refund_eligible"] is True
        assert cancel["refund_processed"] is False

        # Locate refund task
        res = await admin_client.get("/admin/manual-payments/refunds")
        assert res.status_code == 200
        tasks = res.json()
        task = next((t for t in tasks if t["registration_id"] == reg_id), None)
        assert task is not None
        assert task["recommended_should_refund"] is True
        assert task["should_refund"] is True
        assert task["refund_marked_paid"] is False
        task_id = task["task_id"]

        # Admin marks refund paid -> payment becomes refunded, registration becomes refunded
        res = await admin_client.patch(
            f"/admin/manual-payments/refunds/{task_id}",
            json={"refund_marked_paid": True},
        )
        assert res.status_code == 200
        updated = res.json()
        assert updated["refund_marked_paid"] is True
        assert updated["payment_id"] == payment_id

        # Stats: refunded_amount reflects the one payment, completed_amount goes to 0
        res = await admin_client.get("/admin/stats/payments")
        assert res.status_code == 200
        stats = res.json()
        assert stats["refunded_count"] == 1
        assert stats["refunded_amount"] == "50.00 PLN"
        assert stats["completed_count"] == 0
        assert stats["completed_amount"] == "0.00 PLN"

        # Event stats: total_paid should now be 0.00 PLN (since only completed payments are counted)
        res = await admin_client.get("/admin/stats/events")
        assert res.status_code == 200
        events_stats = res.json()
        this = next((e for e in events_stats if e["event_id"] == str(event.id)), None)
        assert this is not None
        assert this["total_paid"] == "0.00 PLN"
    finally:
        await admin_client.aclose()
        await client.aclose()
