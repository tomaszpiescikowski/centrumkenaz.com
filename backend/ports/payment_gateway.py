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
        Create a new payment and return redirect URL for user.

        Args:
            request: Payment details including amount, user info, and callbacks

        Returns:
            PaymentResult with payment_id and redirect_url if successful
        """
        pass

    @abstractmethod
    async def verify_payment(self, payment_id: str) -> PaymentVerificationResult:
        """
        Verify payment status.

        Args:
            payment_id: External payment ID from gateway

        Returns:
            PaymentVerificationResult with current status
        """
        pass

    @abstractmethod
    async def process_webhook(self, payload: dict, signature: str | None = None) -> PaymentVerificationResult:
        """
        Process webhook notification from payment gateway.

        Args:
            payload: Raw webhook payload
            signature: Optional signature for verification

        Returns:
            PaymentVerificationResult with payment status
        """
        pass

    @abstractmethod
    async def refund(self, request: RefundRequest) -> RefundResult:
        """
        Request a refund for a payment.

        Args:
            request: Refund details including payment_id and optional partial amount

        Returns:
            RefundResult with refund status
        """
        pass

    @abstractmethod
    async def get_payment_status(self, payment_id: str) -> PaymentStatus:
        """
        Get current payment status.

        Args:
            payment_id: External payment ID

        Returns:
            Current PaymentStatus
        """
        pass
