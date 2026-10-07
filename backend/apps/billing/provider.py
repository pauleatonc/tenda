"""Mercado Pago Preapproval adapter for Tenda SaaS billing (platform account)."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Any, Protocol
from urllib import error, request

from django.conf import settings

from tenda.errors import DomainError


@dataclass(frozen=True, slots=True)
class PreapprovalPlanSnapshot:
    provider_id: str
    reason: str
    amount: int
    currency: str


@dataclass(frozen=True, slots=True)
class PreapprovalSnapshot:
    provider_id: str
    status: str
    init_point: str
    external_reference: str
    preapproval_plan_id: str
    payer_email: str
    next_payment_date: str | None = None


@dataclass(frozen=True, slots=True)
class NormalizedBillingWebhook:
    event_id: str
    event_type: str
    resource_id: str
    raw: dict[str, Any]


class BillingProvider(Protocol):
    def ensure_preapproval_plan(
        self,
        *,
        reason: str,
        amount_clp: int,
        existing_id: str = "",
    ) -> PreapprovalPlanSnapshot: ...

    def create_preapproval(
        self,
        *,
        preapproval_plan_id: str,
        payer_email: str,
        external_reference: str,
        back_url: str,
    ) -> PreapprovalSnapshot: ...

    def get_preapproval(self, preapproval_id: str) -> PreapprovalSnapshot: ...

    def cancel_preapproval(self, preapproval_id: str) -> PreapprovalSnapshot: ...

    def pause_preapproval(self, preapproval_id: str) -> PreapprovalSnapshot: ...

    def resume_preapproval(self, preapproval_id: str) -> PreapprovalSnapshot: ...

    def verify_webhook(
        self,
        *,
        payload: dict[str, Any],
        signature: str,
        request_id: str,
        query_data_id: str,
    ) -> NormalizedBillingWebhook: ...


class FakeBillingProvider:
    def __init__(self) -> None:
        self.plans: dict[str, PreapprovalPlanSnapshot] = {}
        self.preapprovals: dict[str, PreapprovalSnapshot] = {}

    def ensure_preapproval_plan(
        self,
        *,
        reason: str,
        amount_clp: int,
        existing_id: str = "",
    ) -> PreapprovalPlanSnapshot:
        if existing_id and existing_id in self.plans:
            return self.plans[existing_id]
        digest = hashlib.sha256(f"{reason}:{amount_clp}".encode()).hexdigest()[:16]
        plan_id = existing_id or f"fake-plan-{digest}"
        snapshot = PreapprovalPlanSnapshot(
            provider_id=plan_id,
            reason=reason,
            amount=amount_clp,
            currency="CLP",
        )
        self.plans[plan_id] = snapshot
        return snapshot

    def create_preapproval(
        self,
        *,
        preapproval_plan_id: str,
        payer_email: str,
        external_reference: str,
        back_url: str,
    ) -> PreapprovalSnapshot:
        del back_url
        digest = hashlib.sha256(
            f"{preapproval_plan_id}:{external_reference}:{payer_email}".encode()
        ).hexdigest()[:16]
        snapshot = PreapprovalSnapshot(
            provider_id=f"fake-sub-{digest}",
            status="pending",
            init_point=f"https://billing.invalid/checkout/{digest}",
            external_reference=external_reference,
            preapproval_plan_id=preapproval_plan_id,
            payer_email=payer_email,
        )
        self.preapprovals[snapshot.provider_id] = snapshot
        return snapshot

    def get_preapproval(self, preapproval_id: str) -> PreapprovalSnapshot:
        if preapproval_id not in self.preapprovals:
            raise DomainError("NOT_FOUND", "No encontramos la suscripción.", status=404)
        return self.preapprovals[preapproval_id]

    def set_preapproval(self, snapshot: PreapprovalSnapshot) -> None:
        self.preapprovals[snapshot.provider_id] = snapshot

    def cancel_preapproval(self, preapproval_id: str) -> PreapprovalSnapshot:
        current = self.get_preapproval(preapproval_id)
        updated = PreapprovalSnapshot(
            provider_id=current.provider_id,
            status="cancelled",
            init_point=current.init_point,
            external_reference=current.external_reference,
            preapproval_plan_id=current.preapproval_plan_id,
            payer_email=current.payer_email,
            next_payment_date=current.next_payment_date,
        )
        self.set_preapproval(updated)
        return updated

    def pause_preapproval(self, preapproval_id: str) -> PreapprovalSnapshot:
        current = self.get_preapproval(preapproval_id)
        updated = PreapprovalSnapshot(
            provider_id=current.provider_id,
            status="paused",
            init_point=current.init_point,
            external_reference=current.external_reference,
            preapproval_plan_id=current.preapproval_plan_id,
            payer_email=current.payer_email,
            next_payment_date=current.next_payment_date,
        )
        self.set_preapproval(updated)
        return updated

    def resume_preapproval(self, preapproval_id: str) -> PreapprovalSnapshot:
        current = self.get_preapproval(preapproval_id)
        updated = PreapprovalSnapshot(
            provider_id=current.provider_id,
            status="authorized",
            init_point=current.init_point,
            external_reference=current.external_reference,
            preapproval_plan_id=current.preapproval_plan_id,
            payer_email=current.payer_email,
            next_payment_date=current.next_payment_date,
        )
        self.set_preapproval(updated)
        return updated

    def verify_webhook(
        self,
        *,
        payload: dict[str, Any],
        signature: str,
        request_id: str,
        query_data_id: str,
    ) -> NormalizedBillingWebhook:
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
        return NormalizedBillingWebhook(
            event_id=event_id,
            event_type=str(payload.get("type", "unknown")),
            resource_id=resource_id,
            raw=payload,
        )


class MercadoPagoBillingProvider:
    base_url = "https://api.mercadopago.com"

    def _access_token(self) -> str:
        token = str(
            getattr(settings, "MERCADO_PAGO_BILLING_ACCESS_TOKEN", "")
            or getattr(settings, "MERCADO_PAGO_ACCESS_TOKEN", "")
        ).strip()
        if not token:
            raise DomainError(
                "BILLING_PROVIDER_NOT_CONFIGURED",
                "El proveedor de facturación no está configurado.",
                status=503,
            )
        return token

    def _request(
        self,
        method: str,
        path: str,
        *,
        payload: dict[str, Any] | None = None,
        idempotency_key: str = "",
    ) -> dict[str, Any]:
        body = None if payload is None else json.dumps(payload).encode("utf-8")
        headers = {
            "Authorization": f"Bearer {self._access_token()}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        if idempotency_key:
            headers["X-Idempotency-Key"] = idempotency_key
        req = request.Request(
            f"{self.base_url}{path}",
            data=body,
            headers=headers,
            method=method,
        )
        try:
            with request.urlopen(req, timeout=30) as response:
                raw = response.read().decode("utf-8")
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")[:400]
            raise DomainError(
                "BILLING_PROVIDER_ERROR",
                "Mercado Pago rechazó la solicitud de facturación.",
                status=502,
                field_errors={"provider": [detail or str(exc.code)]},
            ) from exc
        except error.URLError as exc:
            raise DomainError(
                "BILLING_PROVIDER_UNAVAILABLE",
                "No pudimos contactar a Mercado Pago.",
                status=503,
                retryable=True,
            ) from exc
        if not raw:
            return {}
        data = json.loads(raw)
        if not isinstance(data, dict):
            raise DomainError(
                "BILLING_PROVIDER_ERROR",
                "Respuesta inesperada de Mercado Pago.",
                status=502,
            )
        return data

    def ensure_preapproval_plan(
        self,
        *,
        reason: str,
        amount_clp: int,
        existing_id: str = "",
    ) -> PreapprovalPlanSnapshot:
        if existing_id:
            data = self._request("GET", f"/preapproval_plan/{existing_id}")
            return PreapprovalPlanSnapshot(
                provider_id=str(data.get("id", existing_id)),
                reason=str(data.get("reason", reason)),
                amount=amount_clp,
                currency="CLP",
            )
        data = self._request(
            "POST",
            "/preapproval_plan",
            payload={
                "reason": reason,
                "auto_recurring": {
                    "frequency": 1,
                    "frequency_type": "months",
                    "transaction_amount": amount_clp,
                    "currency_id": "CLP",
                },
                "back_url": str(getattr(settings, "BILLING_BACK_URL", "")),
            },
            idempotency_key=hashlib.sha256(
                f"plan:{reason}:{amount_clp}".encode()
            ).hexdigest()[:32],
        )
        return PreapprovalPlanSnapshot(
            provider_id=str(data["id"]),
            reason=reason,
            amount=amount_clp,
            currency="CLP",
        )

    def create_preapproval(
        self,
        *,
        preapproval_plan_id: str,
        payer_email: str,
        external_reference: str,
        back_url: str,
    ) -> PreapprovalSnapshot:
        data = self._request(
            "POST",
            "/preapproval",
            payload={
                "preapproval_plan_id": preapproval_plan_id,
                "payer_email": payer_email,
                "external_reference": external_reference,
                "back_url": back_url,
                "status": "pending",
            },
            idempotency_key=hashlib.sha256(external_reference.encode()).hexdigest()[:32],
        )
        return self._map_preapproval(data)

    def get_preapproval(self, preapproval_id: str) -> PreapprovalSnapshot:
        return self._map_preapproval(self._request("GET", f"/preapproval/{preapproval_id}"))

    def cancel_preapproval(self, preapproval_id: str) -> PreapprovalSnapshot:
        return self._map_preapproval(
            self._request(
                "PUT",
                f"/preapproval/{preapproval_id}",
                payload={"status": "cancelled"},
            )
        )

    def pause_preapproval(self, preapproval_id: str) -> PreapprovalSnapshot:
        return self._map_preapproval(
            self._request(
                "PUT",
                f"/preapproval/{preapproval_id}",
                payload={"status": "paused"},
            )
        )

    def resume_preapproval(self, preapproval_id: str) -> PreapprovalSnapshot:
        return self._map_preapproval(
            self._request(
                "PUT",
                f"/preapproval/{preapproval_id}",
                payload={"status": "authorized"},
            )
        )

    def verify_webhook(
        self,
        *,
        payload: dict[str, Any],
        signature: str,
        request_id: str,
        query_data_id: str,
    ) -> NormalizedBillingWebhook:
        del request_id
        secret = str(
            getattr(settings, "MERCADO_PAGO_BILLING_WEBHOOK_SECRET", "")
            or getattr(settings, "MERCADO_PAGO_WEBHOOK_SECRET", "")
        ).strip()
        # Mirror seller webhook: when secret configured, require matching signature fragment.
        if secret and secret not in signature and signature != secret:
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
        return NormalizedBillingWebhook(
            event_id=event_id,
            event_type=str(payload.get("type", "unknown")),
            resource_id=resource_id,
            raw=payload,
        )

    def _map_preapproval(self, data: dict[str, Any]) -> PreapprovalSnapshot:
        return PreapprovalSnapshot(
            provider_id=str(data.get("id", "")),
            status=str(data.get("status", "pending")),
            init_point=str(data.get("init_point") or data.get("sandbox_init_point") or ""),
            external_reference=str(data.get("external_reference", "")),
            preapproval_plan_id=str(data.get("preapproval_plan_id", "")),
            payer_email=str((data.get("payer_email") or "")),
            next_payment_date=(
                str(data["next_payment_date"]) if data.get("next_payment_date") else None
            ),
        )


_fake_billing = FakeBillingProvider()


def get_billing_provider() -> BillingProvider:
    mode = str(getattr(settings, "BILLING_PROVIDER", "") or getattr(settings, "PAYMENT_PROVIDER", "fake"))
    if mode == "mercado_pago":
        return MercadoPagoBillingProvider()
    return _fake_billing


def reset_fake_billing_provider() -> FakeBillingProvider:
    global _fake_billing
    _fake_billing = FakeBillingProvider()
    return _fake_billing
