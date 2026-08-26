"""Mercado Pago boundary with Decimal-safe contracts and deterministic fake."""

from __future__ import annotations

import hashlib
import hmac
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Any, Protocol
from urllib.parse import urlencode

import httpx
from django.conf import settings

from tenda.errors import DomainError


@dataclass(frozen=True, slots=True)
class PaymentPreferenceInput:
    external_reference: str
    title: str
    amount: Decimal
    currency: str
    payer_email: str
    success_url: str
    pending_url: str
    failure_url: str
    notification_url: str


@dataclass(frozen=True, slots=True)
class PaymentPreference:
    provider_id: str
    checkout_url: str


@dataclass(frozen=True, slots=True)
class PaymentSnapshot:
    provider_payment_id: str
    status: str
    status_detail: str
    external_reference: str
    amount: Decimal
    currency: str
    fee_amount: Decimal | None = None
    net_received: Decimal | None = None
    refunded_amount: Decimal | None = None
    approved_at: datetime | None = None


@dataclass(frozen=True, slots=True)
class NormalizedWebhook:
    event_id: str
    event_type: str
    resource_id: str
    provider_account_id: str = ""


@dataclass(frozen=True, slots=True)
class OAuthTokenSet:
    access_token: str
    refresh_token: str
    provider_account_id: str
    scopes: tuple[str, ...]
    expires_in_seconds: int


class PaymentProvider(Protocol):
    def authorization_url(self, *, state: str) -> str: ...

    def exchange_authorization_code(self, *, code: str) -> OAuthTokenSet: ...

    def create_preference(
        self,
        value: PaymentPreferenceInput,
        *,
        idempotency_key: str,
        access_token: str | None = None,
        marketplace_fee: Decimal = Decimal("0"),
    ) -> PaymentPreference: ...

    def payment(
        self,
        provider_payment_id: str,
        *,
        access_token: str | None = None,
    ) -> PaymentSnapshot: ...

    def refund_payment(
        self,
        provider_payment_id: str,
        *,
        amount: Decimal,
        idempotency_key: str,
        access_token: str | None = None,
    ) -> PaymentSnapshot: ...

    def verify_webhook(
        self,
        *,
        payload: dict[str, Any],
        signature: str,
        request_id: str,
        query_data_id: str,
    ) -> NormalizedWebhook: ...


class FakePaymentProvider:
    def __init__(self) -> None:
        self._payments: dict[str, PaymentSnapshot] = {}

    def authorization_url(self, *, state: str) -> str:
        query = urlencode(
            {
                "state": state,
                "redirect_uri": str(settings.MERCADO_PAGO_OAUTH_CALLBACK_URL),
            }
        )
        return f"https://payments.invalid/oauth/authorize?{query}"

    def exchange_authorization_code(self, *, code: str) -> OAuthTokenSet:
        if not code or code == "invalid":
            raise DomainError(
                "PAYMENT_OAUTH_CODE_INVALID",
                "No pudimos validar la autorización de Mercado Pago.",
                status=400,
            )
        digest = hashlib.sha256(code.encode()).hexdigest()
        return OAuthTokenSet(
            access_token=f"fake-access-{digest}",
            refresh_token=f"fake-refresh-{digest}",
            provider_account_id=f"fake-seller-{digest[:16]}",
            scopes=("offline_access", "read", "write"),
            expires_in_seconds=21600,
        )

    def create_preference(
        self,
        value: PaymentPreferenceInput,
        *,
        idempotency_key: str,
        access_token: str | None = None,
        marketplace_fee: Decimal = Decimal("0"),
    ) -> PaymentPreference:
        del access_token
        if marketplace_fee != Decimal("0"):
            raise DomainError(
                "PAYMENT_COMMISSION_NOT_ALLOWED",
                "La comisión configurada no es válida.",
                status=409,
            )
        digest = hashlib.sha256(
            f"{value.external_reference}:{idempotency_key}".encode()
        ).hexdigest()[:20]
        return PaymentPreference(
            provider_id=f"fake-pref-{digest}",
            checkout_url=f"https://payments.invalid/checkout/{digest}",
        )

    def set_payment(self, snapshot: PaymentSnapshot) -> None:
        self._payments[snapshot.provider_payment_id] = snapshot

    def clear_payments(self) -> None:
        self._payments.clear()

    def payment(
        self,
        provider_payment_id: str,
        *,
        access_token: str | None = None,
    ) -> PaymentSnapshot:
        del access_token
        return self._payments.get(
            provider_payment_id,
            PaymentSnapshot(
                provider_payment_id=provider_payment_id,
                status="approved",
                status_detail="accredited",
                external_reference="fake-order",
                amount=Decimal("1000"),
                currency="CLP",
            ),
        )

    def refund_payment(
        self,
        provider_payment_id: str,
        *,
        amount: Decimal,
        idempotency_key: str,
        access_token: str | None = None,
    ) -> PaymentSnapshot:
        del idempotency_key, access_token
        current = self.payment(provider_payment_id)
        refunded = PaymentSnapshot(
            provider_payment_id=current.provider_payment_id,
            status="refunded",
            status_detail="refunded",
            external_reference=current.external_reference,
            amount=current.amount,
            currency=current.currency,
            fee_amount=current.fee_amount,
            net_received=current.net_received,
            refunded_amount=amount,
            approved_at=current.approved_at,
        )
        self.set_payment(refunded)
        return refunded

    def verify_webhook(
        self,
        *,
        payload: dict[str, Any],
        signature: str,
        request_id: str,
        query_data_id: str,
    ) -> NormalizedWebhook:
        del request_id
        if signature != "fake-valid":
            raise DomainError(
                "INVALID_WEBHOOK_SIGNATURE",
                "La firma del webhook no es válida.",
                status=401,
            )
        resource = payload.get("data", {})
        resource_id = (
            str(resource.get("id", "") or query_data_id)
            if isinstance(resource, dict)
            else query_data_id
        )
        event_id = str(payload.get("id") or f"{payload.get('type', 'event')}:{resource_id}")
        return NormalizedWebhook(
            event_id=event_id,
            event_type=str(payload.get("type", "unknown")),
            resource_id=resource_id,
            provider_account_id=str(payload.get("user_id", "")),
        )


class MercadoPagoProvider:
    base_url = "https://api.mercadopago.com"
    authorization_base_url = "https://auth.mercadopago.com/authorization"

    def _application_credentials(self) -> tuple[str, str]:
        client_id = str(getattr(settings, "MERCADO_PAGO_CLIENT_ID", ""))
        client_secret = str(getattr(settings, "MERCADO_PAGO_CLIENT_SECRET", ""))
        if not client_id or not client_secret:
            raise DomainError(
                "PAYMENT_PROVIDER_NOT_CONFIGURED",
                "El proveedor de pagos no está configurado.",
                status=503,
            )
        return client_id, client_secret

    def authorization_url(self, *, state: str) -> str:
        client_id, _client_secret = self._application_credentials()
        query = urlencode(
            {
                "client_id": client_id,
                "response_type": "code",
                "platform_id": "mp",
                "state": state,
                "redirect_uri": str(settings.MERCADO_PAGO_OAUTH_CALLBACK_URL),
            }
        )
        return f"{self.authorization_base_url}?{query}"

    def exchange_authorization_code(self, *, code: str) -> OAuthTokenSet:
        client_id, client_secret = self._application_credentials()
        if not code:
            raise DomainError(
                "PAYMENT_OAUTH_CODE_INVALID",
                "No pudimos validar la autorización de Mercado Pago.",
                status=400,
            )
        try:
            response = httpx.post(
                f"{self.base_url}/oauth/token",
                json={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": str(settings.MERCADO_PAGO_OAUTH_CALLBACK_URL),
                },
                timeout=8,
            )
            response.raise_for_status()
            payload = response.json()
            access_token = str(payload["access_token"])
            provider_account_id = str(payload["user_id"])
        except (httpx.HTTPError, ValueError, KeyError) as exc:
            raise DomainError(
                "PAYMENT_PROVIDER_UNAVAILABLE",
                "No pudimos completar la conexión con Mercado Pago.",
                status=503,
                retryable=True,
            ) from exc
        raw_scopes = payload.get("scope", "")
        scopes = tuple(
            item
            for item in (
                str(value).strip()
                for value in (
                    raw_scopes.split()
                    if isinstance(raw_scopes, str)
                    else raw_scopes
                    if isinstance(raw_scopes, list)
                    else []
                )
            )
            if item
        )
        return OAuthTokenSet(
            access_token=access_token,
            refresh_token=str(payload.get("refresh_token", "")),
            provider_account_id=provider_account_id,
            scopes=scopes,
            expires_in_seconds=max(int(payload.get("expires_in", 0)), 0),
        )

    def _seller_token(self, access_token: str | None) -> str:
        token = str(access_token or "")
        if not token:
            raise DomainError(
                "PAYMENT_CONNECTION_REQUIRED",
                "La cuenta del vendedor no está conectada.",
                status=409,
                retryable=True,
            )
        return token

    def create_preference(
        self,
        value: PaymentPreferenceInput,
        *,
        idempotency_key: str,
        access_token: str | None = None,
        marketplace_fee: Decimal = Decimal("0"),
    ) -> PaymentPreference:
        try:
            response = httpx.post(
                f"{self.base_url}/checkout/preferences",
                headers={
                    "Authorization": f"Bearer {self._seller_token(access_token)}",
                    "X-Idempotency-Key": idempotency_key,
                },
                json={
                    "external_reference": value.external_reference,
                    "items": [
                        {
                            "title": value.title,
                            "quantity": 1,
                            "currency_id": value.currency,
                            "unit_price": str(value.amount),
                        }
                    ],
                    "payer": {"email": value.payer_email},
                    "back_urls": {
                        "success": value.success_url,
                        "pending": value.pending_url,
                        "failure": value.failure_url,
                    },
                    "auto_return": "approved",
                    "notification_url": value.notification_url,
                    "marketplace_fee": int(marketplace_fee),
                },
                timeout=8,
            )
            response.raise_for_status()
            payload = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise DomainError(
                "PAYMENT_PROVIDER_UNAVAILABLE",
                "No pudimos iniciar el pago.",
                status=503,
                retryable=True,
            ) from exc
        return PaymentPreference(
            provider_id=str(payload["id"]),
            checkout_url=str(payload["init_point"]),
        )

    @staticmethod
    def _provider_datetime(value: object) -> datetime | None:
        if not value:
            return None
        try:
            return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except ValueError:
            return None

    def payment(
        self,
        provider_payment_id: str,
        *,
        access_token: str | None = None,
    ) -> PaymentSnapshot:
        try:
            response = httpx.get(
                f"{self.base_url}/v1/payments/{provider_payment_id}",
                headers={"Authorization": f"Bearer {self._seller_token(access_token)}"},
                timeout=8,
            )
            response.raise_for_status()
            payload = response.json()
        except (httpx.HTTPError, ValueError, KeyError) as exc:
            raise DomainError(
                "PAYMENT_PROVIDER_UNAVAILABLE",
                "No pudimos consultar el pago.",
                status=503,
                retryable=True,
            ) from exc
        fee_details = payload.get("fee_details", [])
        # Provider processing charges are not the marketplace commission requested by Tenda.
        fee = sum(
            (
                Decimal(str(item.get("amount", "0")))
                for item in fee_details
                if isinstance(item, dict)
                and str(item.get("type", "")).lower() in {"application_fee", "marketplace_fee"}
            ),
            Decimal("0"),
        )
        transaction_details = payload.get("transaction_details", {})
        net_received = (
            Decimal(str(transaction_details.get("net_received_amount")))
            if isinstance(transaction_details, dict)
            and transaction_details.get("net_received_amount") is not None
            else None
        )
        return PaymentSnapshot(
            provider_payment_id=str(payload["id"]),
            status=str(payload["status"]),
            status_detail=str(payload.get("status_detail", "")),
            external_reference=str(payload.get("external_reference", "")),
            amount=Decimal(str(payload["transaction_amount"])),
            currency=str(payload["currency_id"]),
            fee_amount=fee,
            net_received=net_received,
            refunded_amount=Decimal(str(payload.get("transaction_amount_refunded", "0"))),
            approved_at=self._provider_datetime(payload.get("date_approved")),
        )

    def refund_payment(
        self,
        provider_payment_id: str,
        *,
        amount: Decimal,
        idempotency_key: str,
        access_token: str | None = None,
    ) -> PaymentSnapshot:
        try:
            response = httpx.post(
                f"{self.base_url}/v1/payments/{provider_payment_id}/refunds",
                headers={
                    "Authorization": f"Bearer {self._seller_token(access_token)}",
                    "X-Idempotency-Key": idempotency_key,
                },
                json={"amount": int(amount)},
                timeout=8,
            )
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise DomainError(
                "PAYMENT_PROVIDER_UNAVAILABLE",
                "No pudimos completar el reembolso.",
                status=503,
                retryable=True,
            ) from exc
        return self.payment(provider_payment_id, access_token=access_token)

    def verify_webhook(
        self,
        *,
        payload: dict[str, Any],
        signature: str,
        request_id: str,
        query_data_id: str,
    ) -> NormalizedWebhook:
        secret = str(getattr(settings, "MERCADO_PAGO_WEBHOOK_SECRET", ""))
        parts = dict(part.split("=", maxsplit=1) for part in signature.split(",") if "=" in part)
        timestamp = parts.get("ts", "")
        supplied = parts.get("v1", "")
        resource = payload.get("data", {})
        resource_id = str(resource.get("id", "")) if isinstance(resource, dict) else query_data_id
        data_id = (query_data_id or resource_id).lower()
        manifest_parts: list[str] = []
        if data_id:
            manifest_parts.append(f"id:{data_id};")
        if request_id:
            manifest_parts.append(f"request-id:{request_id};")
        if timestamp:
            manifest_parts.append(f"ts:{timestamp};")
        manifest = "".join(manifest_parts)
        expected = hmac.new(
            secret.encode(),
            manifest.encode(),
            hashlib.sha256,
        ).hexdigest()
        if not secret or not supplied or not hmac.compare_digest(expected, supplied):
            raise DomainError(
                "INVALID_WEBHOOK_SIGNATURE",
                "La firma del webhook no es válida.",
                status=401,
            )
        event_id = str(payload.get("id") or f"{payload.get('type', 'event')}:{data_id}")
        return NormalizedWebhook(
            event_id=event_id,
            event_type=str(payload.get("type", "unknown")),
            resource_id=resource_id,
            provider_account_id=str(payload.get("user_id", "")),
        )


fake_payment_provider = FakePaymentProvider()


def get_payment_provider() -> PaymentProvider:
    provider = str(getattr(settings, "PAYMENT_PROVIDER", "fake"))
    if provider == "fake":
        return fake_payment_provider
    if provider == "mercado_pago":
        return MercadoPagoProvider()
    raise DomainError(
        "PAYMENT_PROVIDER_NOT_CONFIGURED",
        "El proveedor de pagos no es válido.",
        status=503,
    )
