from abc import ABC, abstractmethod
from dataclasses import dataclass
from decimal import Decimal
from enum import Enum
from typing import Optional
from datetime import datetime


class PaymentStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"
    CANCELLED = "cancelled"


@dataclass
class PaymentRequest:
    """Request to create a new payment."""
    amount: Decimal
    currency: str
    description: str
    user_id: str
    user_email: str
    user_name: str
    return_url: str
    cancel_url: str
    metadata: dict | None = None


@dataclass
class PaymentResult:
    """Result of payment creation."""
    success: bool
    payment_id: str
    redirect_url: str | None = None
    status: PaymentStatus = PaymentStatus.PENDING
    error_message: str | None = None
    raw_response: dict | None = None


@dataclass
class PaymentVerificationResult:
    """Result of payment verification."""
    payment_id: str
    status: PaymentStatus
    amount: Decimal | None = None
    paid_at: datetime | None = None
    error_message: str | None = None
    raw_response: dict | None = None


@dataclass
class RefundRequest:
    """Request to refund a payment."""
    payment_id: str
    amount: Decimal | None = None  # None = full refund
    reason: str | None = None


@dataclass
class RefundResult:
    """Result of refund request."""
    success: bool
    refund_id: str | None = None
    status: PaymentStatus = PaymentStatus.PENDING
    error_message: str | None = None
    raw_response: dict | None = None


class PaymentGatewayPort(ABC):
    """
    Port (interface) for payment gateway.

    Implementations:
    - FakePaymentAdapter: For testing and development
    - TpayAdapter: For production with Tpay
    """

    @abstractmethod
    async def create_payment(self, request: PaymentRequest) -> PaymentResult:
        """
        Create a new payment and return a redirect URL for user checkout.

        Accepts a PaymentRequest with amount, user identifiers, and callback
        URLs. Returns a PaymentResult whose redirect_url points the user to
        the gateway checkout page when success is True.
        """
        pass

    @abstractmethod
    async def verify_payment(self, payment_id: str) -> PaymentVerificationResult:
        """
        Verify the current status of a payment from the gateway.

        Accepts the external payment ID assigned by the gateway and returns
        a PaymentVerificationResult reflecting the authoritative current state.
        """
        pass

    @abstractmethod
    async def process_webhook(self, payload: dict, signature: str | None = None) -> PaymentVerificationResult:
        """
        Process an incoming webhook notification from the payment gateway.

        Accepts the raw webhook payload and an optional signature string for
        HMAC verification. Returns a PaymentVerificationResult so callers can
        update internal payment state based on the gateway notification.
        """
        pass

    @abstractmethod
    async def refund(self, request: RefundRequest) -> RefundResult:
        """
        Request a refund for a previously completed payment.

        Accepts a RefundRequest identifying the payment and an optional partial
        amount; omitting amount triggers a full refund. Returns a RefundResult
        indicating success or failure.
        """
        pass

    @abstractmethod
    async def get_payment_status(self, payment_id: str) -> PaymentStatus:
        """
        Retrieve the current PaymentStatus for the given payment ID.

        Returns the authoritative status from the gateway so callers can
        synchronise internal state without triggering a full verification.
        """
        pass
