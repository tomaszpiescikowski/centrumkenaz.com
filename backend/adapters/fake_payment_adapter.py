import uuid
import asyncio
from datetime import datetime
from decimal import Decimal
from typing import Optional
from dataclasses import dataclass, field

from ports.payment_gateway import (
    PaymentGatewayPort,
    PaymentRequest,
    PaymentResult,
    PaymentVerificationResult,
    RefundRequest,
    RefundResult,
    PaymentStatus,
)


@dataclass
class FakePayment:
    """Internal representation of a fake payment."""
    payment_id: str
    amount: Decimal
    currency: str
    description: str
    user_id: str
    user_email: str
    user_name: str
    return_url: str = ""
    cancel_url: str = ""
    status: PaymentStatus = PaymentStatus.PENDING
    created_at: datetime = field(default_factory=datetime.now)
    paid_at: datetime | None = None
    refunded_at: datetime | None = None
    metadata: dict | None = None
    dev_token: str = field(default_factory=lambda: uuid.uuid4().hex)


class FakePaymentAdapter(PaymentGatewayPort):
    """
    Fake payment adapter for testing and development.

    Features:
    - In-memory storage of payments
    - Configurable behavior (auto-complete, delays, failures)
    - Simulation of various payment scenarios
    """

    def __init__(
        self,
        auto_complete: bool = True,
        simulate_delay: float = 0.0,
        failure_rate: float = 0.0,
        base_url: str = "http://localhost:8000"
    ):
        """
        Initialize the fake payment adapter with configurable behaviour.

        When auto_complete is True every created payment is immediately marked
        COMPLETED so tests that do not need the redirect flow work without
        extra steps. failure_rate accepts a value between 0.0 and 1.0 and
        causes that fraction of operations to return an error response.
        """
        self._payments: dict[str, FakePayment] = {}
        self._refunds: dict[str, dict] = {}
        self._auto_complete = auto_complete
        self._simulate_delay = simulate_delay
        self._failure_rate = failure_rate
        self._base_url = base_url

    async def _simulate_network(self):
        """
        Pause execution for the configured simulated network delay.

        Does nothing when simulate_delay was set to 0, making the no-delay
        path a no-op so callers need no conditional logic.
        """
        if self._simulate_delay > 0:
            await asyncio.sleep(self._simulate_delay)

    def _should_fail(self) -> bool:
        """
        Decide randomly whether the current operation should simulate a failure.

        Returns True with probability equal to failure_rate. When failure_rate
        is 0.0 this always returns False, providing reliable test behaviour.
        """
        import random
        return random.random() < self._failure_rate

    async def create_payment(self, request: PaymentRequest) -> PaymentResult:
        """
        Create a new in-memory payment and return a redirect URL for checkout.

        When auto_complete is enabled the payment is immediately marked
        COMPLETED and the redirect URL points directly at the return URL.
        """
        await self._simulate_network()

        if self._should_fail():
            return PaymentResult(
                success=False,
                payment_id="",
                error_message="Simulated payment gateway error",
            )

        payment_id = f"FAKE_{uuid.uuid4().hex[:12].upper()}"

        payment = FakePayment(
            payment_id=payment_id,
            amount=request.amount,
            currency=request.currency,
            description=request.description,
            user_id=request.user_id,
            user_email=request.user_email,
            user_name=request.user_name,
            return_url=request.return_url,
            cancel_url=request.cancel_url,
            metadata=request.metadata,
        )

        if self._auto_complete:
            payment.status = PaymentStatus.COMPLETED
            payment.paid_at = datetime.now()

        self._payments[payment_id] = payment

        if self._auto_complete and request.return_url:
            redirect_url = request.return_url
        else:
            redirect_url = f"{self._base_url}/payments/fake/{payment_id}?token={payment.dev_token}"

        return PaymentResult(
            success=True,
            payment_id=payment_id,
            redirect_url=redirect_url,
            status=payment.status,
            raw_response={
                "fake_payment_id": payment_id,
                "amount": str(request.amount),
                "currency": request.currency,
            }
        )

    async def verify_payment(self, payment_id: str) -> PaymentVerificationResult:
        """
        Return the current status of an in-memory payment.

        Returns a FAILED result when the payment ID is not found so callers
        can treat unknown IDs uniformly without branching on None.
        """
        await self._simulate_network()

        payment = self._payments.get(payment_id)
        if not payment:
            return PaymentVerificationResult(
                payment_id=payment_id,
                status=PaymentStatus.FAILED,
                error_message=f"Payment {payment_id} not found",
            )

        return PaymentVerificationResult(
            payment_id=payment_id,
            status=payment.status,
            amount=payment.amount,
            paid_at=payment.paid_at,
            raw_response={
                "payment_id": payment_id,
                "status": payment.status.value,
                "amount": str(payment.amount),
            }
        )

    async def process_webhook(self, payload: dict, signature: str | None = None) -> PaymentVerificationResult:
        """
        Apply a webhook status update to the targeted in-memory payment.

        Reads payment_id and status from the payload, updates the stored
        payment state, and returns the resulting verification result.
        """
        await self._simulate_network()

        payment_id = payload.get("payment_id")
        new_status = payload.get("status")

        if not payment_id:
            return PaymentVerificationResult(
                payment_id="",
                status=PaymentStatus.FAILED,
                error_message="Missing payment_id in webhook payload",
            )

        payment = self._payments.get(payment_id)
        if not payment:
            return PaymentVerificationResult(
                payment_id=payment_id,
                status=PaymentStatus.FAILED,
                error_message=f"Payment {payment_id} not found",
            )

        if new_status:
            try:
                payment.status = PaymentStatus(new_status)
                if payment.status == PaymentStatus.COMPLETED:
                    payment.paid_at = datetime.now()
            except ValueError:
                pass

        return PaymentVerificationResult(
            payment_id=payment_id,
            status=payment.status,
            amount=payment.amount,
            paid_at=payment.paid_at,
        )

    async def refund(self, request: RefundRequest) -> RefundResult:
        """
        Mark a completed in-memory payment as refunded and record the refund.

        Rejects the operation when the target payment is not in COMPLETED
        status. Supports partial refunds via request.amount; omitting amount
        refunds the full original payment amount.
        """
        await self._simulate_network()

        if self._should_fail():
            return RefundResult(
                success=False,
                error_message="Simulated refund error",
            )

        payment = self._payments.get(request.payment_id)
        if not payment:
            return RefundResult(
                success=False,
                error_message=f"Payment {request.payment_id} not found",
            )

        if payment.status != PaymentStatus.COMPLETED:
            return RefundResult(
                success=False,
                error_message=f"Cannot refund payment with status {payment.status.value}",
            )

        refund_id = f"REFUND_{uuid.uuid4().hex[:12].upper()}"
        refund_amount = request.amount or payment.amount

        payment.status = PaymentStatus.REFUNDED
        payment.refunded_at = datetime.now()

        self._refunds[refund_id] = {
            "refund_id": refund_id,
            "payment_id": request.payment_id,
            "amount": refund_amount,
            "reason": request.reason,
            "created_at": datetime.now(),
        }

        return RefundResult(
            success=True,
            refund_id=refund_id,
            status=PaymentStatus.REFUNDED,
            raw_response={
                "refund_id": refund_id,
                "payment_id": request.payment_id,
                "amount": str(refund_amount),
            }
        )

    async def get_payment_status(self, payment_id: str) -> PaymentStatus:
        """
        Return the current PaymentStatus for the given payment ID.

        Returns FAILED for unknown payment IDs so callers receive a
        safe sentinel value instead of None.
        """
        await self._simulate_network()

        payment = self._payments.get(payment_id)
        if not payment:
            return PaymentStatus.FAILED

        return payment.status

    def get_payment(self, payment_id: str) -> FakePayment | None:
        """
        Retrieve the internal FakePayment record by ID for the developer UI.

        Returns None when the payment ID does not exist in the in-memory store.
        """
        return self._payments.get(payment_id)

    def get_all_payments(self) -> list[FakePayment]:
        """
        Return a snapshot of all payments currently held in the in-memory store.

        Intended for test assertions and developer tooling, not for production use.
        """
        return list(self._payments.values())

    def clear_payments(self) -> None:
        """
        Discard all stored payments and refunds from the in-memory store.

        Intended for test teardown so each test case starts with a clean slate.
        """
        self._payments.clear()
        self._refunds.clear()

    def complete_payment(self, payment_id: str) -> bool:
        """
        Transition an in-memory payment to COMPLETED status.

        Sets paid_at to the current time and returns False when the payment ID
        is not found, allowing callers to detect missing payments.
        """
        payment = self._payments.get(payment_id)
        if not payment:
            return False
        payment.status = PaymentStatus.COMPLETED
        payment.paid_at = datetime.now()
        return True

    def fail_payment(self, payment_id: str) -> bool:
        """
        Transition an in-memory payment to FAILED status.

        Returns False when the payment ID is not found so callers can
        distinguish a successful status change from an unknown ID.
        """
        payment = self._payments.get(payment_id)
        if not payment:
            return False
        payment.status = PaymentStatus.FAILED
        return True


_shared_fake_adapter: FakePaymentAdapter | None = None


def get_shared_fake_payment_adapter(base_url: str = "http://localhost:8000") -> FakePaymentAdapter:
    """
    Return the process-wide singleton FakePaymentAdapter instance.

    Initialises the shared adapter on first call with auto_complete enabled.
    Subsequent calls return the same instance so all in-process code shares
    one in-memory payment store without explicit dependency injection.
    """
    global _shared_fake_adapter
    if _shared_fake_adapter is None:
        _shared_fake_adapter = FakePaymentAdapter(auto_complete=True, base_url=base_url)
    return _shared_fake_adapter
