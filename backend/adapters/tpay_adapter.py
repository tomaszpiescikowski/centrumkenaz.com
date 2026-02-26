import httpx
from datetime import datetime
from decimal import Decimal
from typing import Optional
import hashlib
import json

from ports.payment_gateway import (
    PaymentGatewayPort,
    PaymentRequest,
    PaymentResult,
    PaymentVerificationResult,
    RefundRequest,
    RefundResult,
    PaymentStatus,
)


class TpayAdapter(PaymentGatewayPort):
    """
    Tpay payment gateway adapter.

    Placeholder implementation pending production integration with the Tpay API.
    All methods raise NotImplementedError until the integration is completed.
    """

    TPAY_API_URL = "https://api.tpay.com"

    def __init__(
        self,
        client_id: str,
        client_secret: str,
        merchant_id: str,
        security_code: str,
        sandbox: bool = True,
    ):
        """
        Initialize the Tpay adapter with credentials and environment settings.

        When sandbox is True the adapter points at the Tpay sandbox base URL
        instead of the production endpoint. The access token state is held
        in instance variables and refreshed on demand.
        """
        self._client_id = client_id
        self._client_secret = client_secret
        self._merchant_id = merchant_id
        self._security_code = security_code
        self._sandbox = sandbox
        self._access_token: str | None = None
        self._token_expires_at: datetime | None = None

        if sandbox:
            self.TPAY_API_URL = "https://openapi.sandbox.tpay.com"

    async def _get_access_token(self) -> str:
        """
        Retrieve or refresh the OAuth access token for authenticating API requests.

        Not yet implemented; will call the Tpay token endpoint and cache the
        result until expiry.
        """
        raise NotImplementedError("Tpay integration not yet implemented")

    async def _make_request(self, method: str, endpoint: str, data: dict | None = None) -> dict:
        """
        Execute an authenticated HTTP request against the Tpay API.

        Obtains a fresh access token, sends the request with JSON body, and
        raises for non-2xx responses before returning the parsed JSON payload.
        """
        token = await self._get_access_token()

        async with httpx.AsyncClient() as client:
            response = await client.request(
                method=method,
                url=f"{self.TPAY_API_URL}{endpoint}",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                json=data,
            )
            response.raise_for_status()
            return response.json()

    async def create_payment(self, request: PaymentRequest) -> PaymentResult:
        """
        Create a new payment transaction via the Tpay API.

        Not yet implemented; will map request data to the Tpay transaction
        creation endpoint and return a redirect URL for user checkout.
        """
        raise NotImplementedError("Tpay integration not yet implemented")

    async def verify_payment(self, payment_id: str) -> PaymentVerificationResult:
        """
        Verify the current status of a payment with the Tpay API.

        Not yet implemented; will query the transaction status endpoint
        and return a normalised verification result.
        """
        raise NotImplementedError("Tpay integration not yet implemented")

    async def process_webhook(self, payload: dict, signature: str | None = None) -> PaymentVerificationResult:
        """
        Process an incoming Tpay webhook notification.

        Not yet implemented; will verify the notification signature and
        return a payment verification result reflecting the new status.
        """
        raise NotImplementedError("Tpay integration not yet implemented")

    async def refund(self, request: RefundRequest) -> RefundResult:
        """
        Request a refund for a completed payment via the Tpay API.

        Not yet implemented; will call the Tpay refund endpoint and return
        a result indicating success or failure.
        """
        raise NotImplementedError("Tpay integration not yet implemented")

    async def get_payment_status(self, payment_id: str) -> PaymentStatus:
        """
        Retrieve the current status of a payment from the Tpay API.

        Not yet implemented; will map the Tpay status response to the
        internal PaymentStatus enum.
        """
        raise NotImplementedError("Tpay integration not yet implemented")

    def _verify_webhook_signature(self, payload: dict, signature: str) -> bool:
        """
        Verify the HMAC signature on an incoming Tpay webhook payload.

        Not yet implemented; will compute the expected signature from specific
        payload fields plus the security code and compare against the provided value.
        """
        raise NotImplementedError("Tpay integration not yet implemented")
