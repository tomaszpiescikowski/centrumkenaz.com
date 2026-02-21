"""
Tests for Payment Gateway (Port/Adapter pattern).

These tests verify the FakePaymentAdapter implementation
which is used for development and testing.
"""
import pytest
from decimal import Decimal

from adapters.fake_payment_adapter import FakePaymentAdapter, FakePayment
from ports.payment_gateway import (
    PaymentRequest,
    PaymentResult,
    PaymentStatus,
    RefundRequest,
)


class TestFakePaymentAdapterCreation:
    """Tests for payment creation."""

    @pytest.mark.asyncio
    async def test_create_payment_success(self, payment_gateway: FakePaymentAdapter):
        """Test successful payment creation."""
        request = PaymentRequest(
            amount=Decimal("100.00"),
            currency="PLN",
            description="Test payment",
            user_id=1,
            user_email="test@example.com",
            user_name="Test User",
            return_url="http://localhost/success",
            cancel_url="http://localhost/cancel",
        )

        result = await payment_gateway.create_payment(request)

        assert result.success is True
        assert result.payment_id.startswith("FAKE_")
        assert result.redirect_url is not None
        assert result.status == PaymentStatus.PENDING
        assert result.error_message is None

    @pytest.mark.asyncio
    async def test_create_payment_generates_unique_ids(self, payment_gateway: FakePaymentAdapter):
        """Test that each payment gets a unique ID."""
        request = PaymentRequest(
            amount=Decimal("50.00"),
            currency="PLN",
            description="Test",
            user_id=1,
            user_email="test@example.com",
            user_name="Test User",
            return_url="http://localhost/success",
            cancel_url="http://localhost/cancel",
        )

        result1 = await payment_gateway.create_payment(request)
        result2 = await payment_gateway.create_payment(request)

        assert result1.payment_id != result2.payment_id

    @pytest.mark.asyncio
    async def test_create_payment_stores_metadata(self, payment_gateway: FakePaymentAdapter):
        """Test that metadata is stored with payment."""
        metadata = {"event_id": 123, "type": "event"}
        request = PaymentRequest(
            amount=Decimal("75.00"),
            currency="PLN",
            description="Event registration",
            user_id=1,
            user_email="test@example.com",
            user_name="Test User",
            return_url="http://localhost/success",
            cancel_url="http://localhost/cancel",
            metadata=metadata,
        )

        result = await payment_gateway.create_payment(request)
        payment = payment_gateway.get_payment(result.payment_id)

        assert payment is not None
        assert payment.metadata == metadata

    @pytest.mark.asyncio
    async def test_auto_complete_mode(self, auto_complete_payment_gateway: FakePaymentAdapter):
        """Test that auto_complete mode immediately completes payments."""
        request = PaymentRequest(
            amount=Decimal("100.00"),
            currency="PLN",
            description="Auto-complete test",
            user_id=1,
            user_email="test@example.com",
            user_name="Test User",
            return_url="http://localhost/success",
            cancel_url="http://localhost/cancel",
        )

        result = await auto_complete_payment_gateway.create_payment(request)

        assert result.success is True
        assert result.status == PaymentStatus.COMPLETED


class TestFakePaymentAdapterVerification:
    """Tests for payment verification."""

    @pytest.mark.asyncio
    async def test_verify_pending_payment(self, payment_gateway: FakePaymentAdapter):
        """Test verifying a pending payment."""
        request = PaymentRequest(
            amount=Decimal("100.00"),
            currency="PLN",
            description="Test",
            user_id=1,
            user_email="test@example.com",
            user_name="Test User",
            return_url="http://localhost/success",
            cancel_url="http://localhost/cancel",
        )
        create_result = await payment_gateway.create_payment(request)

        verify_result = await payment_gateway.verify_payment(create_result.payment_id)

        assert verify_result.payment_id == create_result.payment_id
        assert verify_result.status == PaymentStatus.PENDING
        assert verify_result.amount == Decimal("100.00")

    @pytest.mark.asyncio
    async def test_verify_completed_payment(self, payment_gateway: FakePaymentAdapter):
        """Test verifying a completed payment."""
        request = PaymentRequest(
            amount=Decimal("100.00"),
            currency="PLN",
            description="Test",
            user_id=1,
            user_email="test@example.com",
            user_name="Test User",
            return_url="http://localhost/success",
            cancel_url="http://localhost/cancel",
        )
        create_result = await payment_gateway.create_payment(request)

        payment_gateway.complete_payment(create_result.payment_id)

        verify_result = await payment_gateway.verify_payment(create_result.payment_id)

        assert verify_result.status == PaymentStatus.COMPLETED
        assert verify_result.paid_at is not None

    @pytest.mark.asyncio
    async def test_verify_nonexistent_payment(self, payment_gateway: FakePaymentAdapter):
        """Test verifying a payment that doesn't exist."""
        verify_result = await payment_gateway.verify_payment("FAKE_NONEXISTENT")

        assert verify_result.status == PaymentStatus.FAILED
        assert verify_result.error_message is not None


class TestFakePaymentAdapterWebhook:
    """Tests for webhook processing."""

    @pytest.mark.asyncio
    async def test_process_webhook_complete(self, payment_gateway: FakePaymentAdapter):
        """Test processing webhook to complete payment."""
        request = PaymentRequest(
            amount=Decimal("100.00"),
            currency="PLN",
            description="Test",
            user_id=1,
            user_email="test@example.com",
            user_name="Test User",
            return_url="http://localhost/success",
            cancel_url="http://localhost/cancel",
        )
        create_result = await payment_gateway.create_payment(request)

        webhook_result = await payment_gateway.process_webhook({
            "payment_id": create_result.payment_id,
            "status": "completed",
        })

        assert webhook_result.status == PaymentStatus.COMPLETED
        assert webhook_result.paid_at is not None

    @pytest.mark.asyncio
    async def test_process_webhook_fail(self, payment_gateway: FakePaymentAdapter):
        """Test processing webhook to fail payment."""
        request = PaymentRequest(
            amount=Decimal("100.00"),
            currency="PLN",
            description="Test",
            user_id=1,
            user_email="test@example.com",
            user_name="Test User",
            return_url="http://localhost/success",
            cancel_url="http://localhost/cancel",
        )
        create_result = await payment_gateway.create_payment(request)

        webhook_result = await payment_gateway.process_webhook({
            "payment_id": create_result.payment_id,
            "status": "failed",
        })

        assert webhook_result.status == PaymentStatus.FAILED

    @pytest.mark.asyncio
    async def test_process_webhook_missing_payment_id(self, payment_gateway: FakePaymentAdapter):
        """Test webhook with missing payment_id."""
        webhook_result = await payment_gateway.process_webhook({
            "status": "completed",
        })

        assert webhook_result.status == PaymentStatus.FAILED
        assert webhook_result.error_message is not None


class TestFakePaymentAdapterRefund:
    """Tests for refund processing."""

    @pytest.mark.asyncio
    async def test_refund_completed_payment(self, payment_gateway: FakePaymentAdapter):
        """Test refunding a completed payment."""
        request = PaymentRequest(
            amount=Decimal("100.00"),
            currency="PLN",
            description="Test",
            user_id=1,
            user_email="test@example.com",
            user_name="Test User",
            return_url="http://localhost/success",
            cancel_url="http://localhost/cancel",
        )
        create_result = await payment_gateway.create_payment(request)
        payment_gateway.complete_payment(create_result.payment_id)

        refund_result = await payment_gateway.refund(RefundRequest(
            payment_id=create_result.payment_id,
            reason="User cancelled",
        ))

        assert refund_result.success is True
        assert refund_result.refund_id is not None
        assert refund_result.status == PaymentStatus.REFUNDED

    @pytest.mark.asyncio
    async def test_refund_pending_payment_fails(self, payment_gateway: FakePaymentAdapter):
        """Test that refunding a pending payment fails."""
        request = PaymentRequest(
            amount=Decimal("100.00"),
            currency="PLN",
            description="Test",
            user_id=1,
            user_email="test@example.com",
            user_name="Test User",
            return_url="http://localhost/success",
            cancel_url="http://localhost/cancel",
        )
        create_result = await payment_gateway.create_payment(request)

        refund_result = await payment_gateway.refund(RefundRequest(
            payment_id=create_result.payment_id,
        ))

        assert refund_result.success is False
        assert "cannot refund" in refund_result.error_message.lower()

    @pytest.mark.asyncio
    async def test_refund_nonexistent_payment(self, payment_gateway: FakePaymentAdapter):
        """Test refunding a payment that doesn't exist."""
        refund_result = await payment_gateway.refund(RefundRequest(
            payment_id="FAKE_NONEXISTENT",
        ))

        assert refund_result.success is False
        assert "not found" in refund_result.error_message.lower()


class TestFakePaymentAdapterHelpers:
    """Tests for helper methods."""

    @pytest.mark.asyncio
    async def test_complete_payment_helper(self, payment_gateway: FakePaymentAdapter):
        """Test manual payment completion."""
        request = PaymentRequest(
            amount=Decimal("100.00"),
            currency="PLN",
            description="Test",
            user_id=1,
            user_email="test@example.com",
            user_name="Test User",
            return_url="http://localhost/success",
            cancel_url="http://localhost/cancel",
        )
        create_result = await payment_gateway.create_payment(request)

        success = payment_gateway.complete_payment(create_result.payment_id)

        assert success is True
        payment = payment_gateway.get_payment(create_result.payment_id)
        assert payment.status == PaymentStatus.COMPLETED

    @pytest.mark.asyncio
    async def test_fail_payment_helper(self, payment_gateway: FakePaymentAdapter):
        """Test manual payment failure."""
        request = PaymentRequest(
            amount=Decimal("100.00"),
            currency="PLN",
            description="Test",
            user_id=1,
            user_email="test@example.com",
            user_name="Test User",
            return_url="http://localhost/success",
            cancel_url="http://localhost/cancel",
        )
        create_result = await payment_gateway.create_payment(request)

        success = payment_gateway.fail_payment(create_result.payment_id)

        assert success is True
        payment = payment_gateway.get_payment(create_result.payment_id)
        assert payment.status == PaymentStatus.FAILED

    @pytest.mark.asyncio
    async def test_get_all_payments(self, payment_gateway: FakePaymentAdapter):
        """Test getting all payments."""
        request = PaymentRequest(
            amount=Decimal("100.00"),
            currency="PLN",
            description="Test",
            user_id=1,
            user_email="test@example.com",
            user_name="Test User",
            return_url="http://localhost/success",
            cancel_url="http://localhost/cancel",
        )

        await payment_gateway.create_payment(request)
        await payment_gateway.create_payment(request)
        await payment_gateway.create_payment(request)

        all_payments = payment_gateway.get_all_payments()

        assert len(all_payments) == 3

    @pytest.mark.asyncio
    async def test_clear_payments(self, payment_gateway: FakePaymentAdapter):
        """Test clearing all payments."""
        request = PaymentRequest(
            amount=Decimal("100.00"),
            currency="PLN",
            description="Test",
            user_id=1,
            user_email="test@example.com",
            user_name="Test User",
            return_url="http://localhost/success",
            cancel_url="http://localhost/cancel",
        )

        await payment_gateway.create_payment(request)
        await payment_gateway.create_payment(request)

        payment_gateway.clear_payments()

        assert len(payment_gateway.get_all_payments()) == 0


class TestFakePaymentAdapterSimulation:
    """Tests for simulation features."""

    @pytest.mark.asyncio
    async def test_failure_rate(self):
        """Test that failure rate causes random failures."""
        gateway = FakePaymentAdapter(failure_rate=1.0)

        request = PaymentRequest(
            amount=Decimal("100.00"),
            currency="PLN",
            description="Test",
            user_id=1,
            user_email="test@example.com",
            user_name="Test User",
            return_url="http://localhost/success",
            cancel_url="http://localhost/cancel",
        )

        result = await gateway.create_payment(request)

        assert result.success is False
        assert result.error_message is not None

    @pytest.mark.asyncio
    async def test_get_payment_status(self, payment_gateway: FakePaymentAdapter):
        """Test getting payment status directly."""
        request = PaymentRequest(
            amount=Decimal("100.00"),
            currency="PLN",
            description="Test",
            user_id=1,
            user_email="test@example.com",
            user_name="Test User",
            return_url="http://localhost/success",
            cancel_url="http://localhost/cancel",
        )
        create_result = await payment_gateway.create_payment(request)

        status = await payment_gateway.get_payment_status(create_result.payment_id)
        assert status == PaymentStatus.PENDING

        payment_gateway.complete_payment(create_result.payment_id)

        status = await payment_gateway.get_payment_status(create_result.payment_id)
        assert status == PaymentStatus.COMPLETED
