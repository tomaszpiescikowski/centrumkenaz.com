from datetime import datetime
from decimal import Decimal
from types import SimpleNamespace

import pytest

from routers.admin import get_event_stats, get_registration_stats, get_user_stats
from services.payment_service import PaymentService
from services.registration_service import RegistrationService


class _ScalarsResult:
    def __init__(self, items):
        self._items = items

    def all(self):
        return self._items


class _ExecuteResult:
    def __init__(self, *, scalars_items=None, rows=None, one_value=None, scalar_value=None):
        self._scalars_items = scalars_items or []
        self._rows = rows or []
        self._one_value = one_value
        self._scalar_value = scalar_value

    def scalars(self):
        return _ScalarsResult(self._scalars_items)

    def all(self):
        return self._rows

    def one(self):
        return self._one_value

    def scalar_one_or_none(self):
        return self._scalar_value


class _QueueSession:
    def __init__(self, results):
        self._results = list(results)

    async def execute(self, _statement):
        if not self._results:
            raise AssertionError("Unexpected execute() call in test")
        return self._results.pop(0)


class _CaptureSession:
    def __init__(self, result: _ExecuteResult | None = None):
        self.statement = None
        self._result = result or _ExecuteResult()

    async def execute(self, statement):
        self.statement = statement
        return self._result


class TestAdminLegacyIdCompat:
    @pytest.mark.asyncio
    async def test_event_stats_coerces_legacy_integer_event_id_to_string(self):
        legacy_event = SimpleNamespace(
            id=170,
            title="Legacy Event",
            start_date=datetime(2026, 3, 14, 10, 0, 0),
            event_type="mors",
            city="Poznań",
            price_guest=Decimal("40.00"),
            price_member=Decimal("20.00"),
            requires_subscription=False,
            max_participants=5,
        )
        db = _QueueSession(
            [
                _ExecuteResult(scalars_items=[legacy_event]),
                _ExecuteResult(rows=[(170, 2)]),
                _ExecuteResult(rows=[(170, Decimal("40.00"))]),
            ]
        )

        payload = await get_event_stats(db=db, _admin=SimpleNamespace(), month=None)

        assert payload[0].event_id == "170"

    @pytest.mark.asyncio
    async def test_user_stats_coerces_legacy_integer_user_id_to_string(self):
        legacy_user = SimpleNamespace(
            id=357,
            full_name="Legacy User",
            email="legacy@example.com",
            role=SimpleNamespace(value="member"),
            account_status=SimpleNamespace(value="active"),
        )
        legacy_subscription = SimpleNamespace(end_date=None, points=12)
        db = _QueueSession(
            [
                _ExecuteResult(rows=[(legacy_user, legacy_subscription)]),
                _ExecuteResult(rows=[(357, Decimal("60.00"))]),
                _ExecuteResult(rows=[(357, datetime(2026, 2, 9, 17, 0, 0))]),
                _ExecuteResult(rows=[(357, 3)]),
            ]
        )

        payload = await get_user_stats(db=db, _admin=SimpleNamespace())

        assert payload[0].user_id == "357"

    @pytest.mark.asyncio
    async def test_registration_stats_coerces_top_event_id_to_string(self):
        db = _QueueSession(
            [
                _ExecuteResult(one_value=(4, 2, 2)),
                _ExecuteResult(
                    rows=[
                        ("confirmed", 2),
                        ("pending", 1),
                        ("cancelled", 1),
                    ]
                ),
                _ExecuteResult(rows=[(170, "Legacy Event", "Poznań", 5, 2)]),
            ]
        )

        payload = await get_registration_stats(db=db, _admin=SimpleNamespace(), month=None)

        assert payload.top_events[0].event_id == "170"


class TestServiceLegacyIdQueries:
    @pytest.mark.asyncio
    async def test_registration_service_get_event_by_id_uses_cast(self):
        capture = _CaptureSession(result=_ExecuteResult(scalar_value=None))
        service = RegistrationService(capture, None)  # type: ignore[arg-type]

        result = await service.get_event_with_registrations("170")

        assert result is None
        compiled = str(capture.statement.compile(compile_kwargs={"literal_binds": True}))
        assert "CAST(events.id AS VARCHAR)" in compiled
        assert "'170'" in compiled

    @pytest.mark.asyncio
    async def test_registration_service_owned_registration_lookup_uses_casts(self):
        capture = _CaptureSession(result=_ExecuteResult(scalar_value=None))
        service = RegistrationService(capture, None)  # type: ignore[arg-type]

        result = await service._load_owned_registration_with_context("2225", "357")

        assert result is None
        compiled = str(capture.statement.compile(compile_kwargs={"literal_binds": True}))
        assert "CAST(registrations.id AS VARCHAR)" in compiled
        assert "CAST(registrations.user_id AS VARCHAR)" in compiled
        assert "'2225'" in compiled
        assert "'357'" in compiled

    @pytest.mark.asyncio
    async def test_payment_service_user_payments_lookup_uses_cast(self):
        capture = _CaptureSession(result=_ExecuteResult(scalars_items=[]))
        service = PaymentService(capture, object())  # type: ignore[arg-type]

        result = await service.get_user_payments("357")

        assert result == []
        compiled = str(capture.statement.compile(compile_kwargs={"literal_binds": True}))
        assert "CAST(payments.user_id AS VARCHAR)" in compiled
        assert "'357'" in compiled

