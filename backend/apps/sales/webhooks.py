"""Durable Mercado Pago inbox processing based only on provider truth."""

from __future__ import annotations

import uuid
from datetime import timedelta
from decimal import Decimal
from typing import Any

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from tenda.crypto import decrypt_credential
from tenda.errors import DomainError

from .models import (
    Order,
    Payment,
    PaymentWebhookEvent,
    ReconciliationIssue,
    SellerPaymentConnection,
)
from .order_services import (
    _mark_reconciliation_required,
    apply_provider_snapshot,
    resolve_order_reconciliation_if_clear,
)
from .payments import get_payment_provider


def _connection_for_event(
    event: PaymentWebhookEvent,
    payment: Payment | None,
) -> SellerPaymentConnection | None:
    if payment is not None:
        return SellerPaymentConnection.objects.filter(
            organisation=payment.organisation,
            provider=SellerPaymentConnection.Provider.MERCADO_PAGO,
            status=SellerPaymentConnection.Status.CONNECTED,
        ).first()
    provider_account_id = str((event.normalized_payload or {}).get("providerAccountId", ""))
    if not provider_account_id:
        return None
    return SellerPaymentConnection.objects.filter(
        provider=SellerPaymentConnection.Provider.MERCADO_PAGO,
        provider_account_id=provider_account_id,
        status=SellerPaymentConnection.Status.CONNECTED,
    ).first()


def _order_from_reference(reference: str) -> Order | None:
    prefix, separator, raw_id = reference.partition(":")
    if prefix != "order" or not separator:
        return None
    try:
        public_id = uuid.UUID(raw_id)
    except ValueError:
        return None
    return (
        Order.objects.select_related("organisation", "inventory", "created_by")
        .filter(public_id=public_id)
        .first()
    )


def _unknown_issue(
    *,
    event: PaymentWebhookEvent,
    summary: str,
    details: dict[str, str],
) -> None:
    ReconciliationIssue.objects.get_or_create(
        webhook_event=event,
        kind=ReconciliationIssue.Kind.UNKNOWN_PAYMENT,
        status=ReconciliationIssue.Status.OPEN,
        defaults={
            "organisation": event.organisation,
            "order": event.order,
            "payment": event.payment,
            "summary": summary,
            "details": details,
        },
    )


def _fail_event(event_id: int, error: Exception) -> None:
    with transaction.atomic():
        event = PaymentWebhookEvent.objects.select_for_update().get(pk=event_id)
        event.status = PaymentWebhookEvent.Status.FAILED
        event.last_error = (error.code if isinstance(error, DomainError) else type(error).__name__)[
            :500
        ]
        event.next_retry_at = timezone.now() + timedelta(
            seconds=min(3600, max(30, 2**event.attempts * 15))
        )
        event.save(update_fields=("status", "last_error", "next_retry_at"))
        _mark_reconciliation_required(
            order=event.order,
            payment=event.payment,
            kind=ReconciliationIssue.Kind.WEBHOOK_PENDING,
            summary="El webhook no pudo conciliarse con el proveedor.",
            details={"error": event.last_error},
            webhook_event=event,
            correlation_id=f"webhook:{event.public_id}",
        )


def process_payment_webhook_event(event_id: int) -> bool:
    with transaction.atomic():
        event = PaymentWebhookEvent.objects.select_for_update().filter(pk=event_id).first()
        if event is None:
            return False
        if event.status == PaymentWebhookEvent.Status.PROCESSED:
            return False
        if not event.signature_valid or not event.provider_resource_id:
            event.status = PaymentWebhookEvent.Status.IGNORED
            event.processed_at = timezone.now()
            event.save(update_fields=("status", "processed_at"))
            return False
        if event.status == PaymentWebhookEvent.Status.PROCESSING:
            return False
        event.status = PaymentWebhookEvent.Status.PROCESSING
        event.attempts += 1
        event.last_error = ""
        event.next_retry_at = timezone.now() + timedelta(minutes=5)
        event.save(update_fields=("status", "attempts", "last_error", "next_retry_at"))

    try:
        known_payment = (
            Payment.objects.select_related("order", "organisation")
            .filter(
                provider="mercado_pago",
                provider_payment_id=event.provider_resource_id,
            )
            .first()
        )
        connection = _connection_for_event(event, known_payment)
        provider_name = str(getattr(settings, "PAYMENT_PROVIDER", "fake"))
        if connection is None and provider_name != "fake":
            raise DomainError(
                "PAYMENT_CONNECTION_REQUIRED",
                "No encontramos la cuenta vendedora del webhook.",
                status=409,
                retryable=True,
            )
        access_token = (
            decrypt_credential(connection.access_token_ciphertext)
            if connection is not None and connection.access_token_ciphertext
            else None
        )
        snapshot = get_payment_provider().payment(
            event.provider_resource_id,
            access_token=access_token,
        )
    except Exception as exc:
        _fail_event(event_id, exc)
        return False

    order = _order_from_reference(snapshot.external_reference)
    if order is None:
        with transaction.atomic():
            locked_event = PaymentWebhookEvent.objects.select_for_update().get(pk=event_id)
            if connection is not None:
                locked_event.organisation = connection.organisation
            _unknown_issue(
                event=locked_event,
                summary="El pago consultado no referencia un pedido conocido.",
                details={
                    "providerPaymentId": snapshot.provider_payment_id,
                    "externalReference": snapshot.external_reference,
                },
            )
            locked_event.status = PaymentWebhookEvent.Status.PROCESSED
            locked_event.processed_at = timezone.now()
            locked_event.last_error = ""
            locked_event.save(
                update_fields=(
                    "organisation",
                    "status",
                    "processed_at",
                    "last_error",
                )
            )
        return True

    if connection is not None and connection.organisation_id != order.organisation_id:
        with transaction.atomic():
            locked_event = PaymentWebhookEvent.objects.select_for_update().get(pk=event_id)
            locked_event.organisation = connection.organisation
            _unknown_issue(
                event=locked_event,
                summary="La cuenta vendedora del webhook no coincide con el pedido.",
                details={
                    "providerPaymentId": snapshot.provider_payment_id,
                    "externalReference": snapshot.external_reference,
                },
            )
            locked_event.status = PaymentWebhookEvent.Status.PROCESSED
            locked_event.processed_at = timezone.now()
            locked_event.save(
                update_fields=(
                    "organisation",
                    "status",
                    "processed_at",
                )
            )
        return True

    try:
        with transaction.atomic():
            locked_event = PaymentWebhookEvent.objects.select_for_update().get(pk=event_id)
            locked_order = (
                Order.objects.select_for_update(of=("self",))
                .select_related("organisation", "inventory", "created_by")
                .get(pk=order.pk)
            )
            payment, _created = Payment.objects.select_for_update().get_or_create(
                order=locked_order,
                defaults={
                    "organisation": locked_order.organisation,
                    "method": locked_order.payment_method,
                    "amount": locked_order.total_amount,
                    "provider": "mercado_pago",
                    "provider_account_id": (
                        connection.provider_account_id if connection is not None else ""
                    ),
                    "external_reference": f"order:{locked_order.public_id}",
                    "fee_requested": Decimal("0"),
                },
            )
            locked_event.organisation = locked_order.organisation
            locked_event.order = locked_order
            locked_event.payment = payment
            correlation_id = f"webhook:{locked_event.public_id}"
            if payment.provider and payment.provider != "mercado_pago":
                _mark_reconciliation_required(
                    order=locked_order,
                    payment=payment,
                    kind=ReconciliationIssue.Kind.PAYMENT_MISMATCH,
                    summary="El proveedor del pago no coincide con el pedido.",
                    details={"paymentProvider": payment.provider},
                    webhook_event=locked_event,
                    correlation_id=correlation_id,
                )
            else:
                payment.provider = "mercado_pago"
                payment.provider_account_id = (
                    connection.provider_account_id if connection is not None else ""
                )
                payment.save(update_fields=("provider", "provider_account_id", "updated_at"))
                apply_provider_snapshot(
                    order=locked_order,
                    payment=payment,
                    snapshot=snapshot,
                    webhook_event=locked_event,
                    correlation_id=correlation_id,
                )
            locked_event.status = PaymentWebhookEvent.Status.PROCESSED
            locked_event.processed_at = timezone.now()
            locked_event.last_error = ""
            locked_event.next_retry_at = None
            locked_event.save(
                update_fields=(
                    "organisation",
                    "order",
                    "payment",
                    "status",
                    "processed_at",
                    "last_error",
                    "next_retry_at",
                )
            )
            ReconciliationIssue.objects.filter(
                webhook_event=locked_event,
                kind=ReconciliationIssue.Kind.WEBHOOK_PENDING,
                status__in={
                    ReconciliationIssue.Status.OPEN,
                    ReconciliationIssue.Status.RETRYING,
                },
            ).update(
                status=ReconciliationIssue.Status.RESOLVED,
                resolved_at=timezone.now(),
            )
            resolve_order_reconciliation_if_clear(
                locked_order,
                correlation_id=correlation_id,
            )
    except Exception as exc:
        _fail_event(event_id, exc)
        return False
    return True


def retry_reconciliation_issue(
    *,
    context: Any,
    issue_id: uuid.UUID,
    idempotency_key: str,
    correlation_id: str = "",
) -> tuple[ReconciliationIssue, bool]:
    from apps.audit.idempotency import execute_idempotent
    from tenda.errors import ResourceNotFound

    from .selectors import can_manage_reconciliation

    if not can_manage_reconciliation(context):
        raise DomainError(
            "PERMISSION_DENIED",
            "No tienes acceso a la cola de conciliación.",
            status=403,
        )

    def command() -> tuple[dict[str, Any], int]:
        issue = (
            ReconciliationIssue.objects.select_for_update()
            .filter(public_id=issue_id, organisation=context.organisation)
            .first()
        )
        if issue is None:
            raise ResourceNotFound()
        if issue.status != ReconciliationIssue.Status.RESOLVED:
            issue.status = ReconciliationIssue.Status.RETRYING
            issue.retry_count += 1
            issue.last_attempt_at = timezone.now()
            issue.save(
                update_fields=(
                    "status",
                    "retry_count",
                    "last_attempt_at",
                    "updated_at",
                )
            )
            order = issue.order
            if order is not None:
                order.reconciliation_status = Order.ReconciliationStatus.RETRYING
                order.save(update_fields=("reconciliation_status", "updated_at"))
        return {
            "issueId": str(issue.public_id),
            "eventId": issue.webhook_event_id,
        }, 200

    outcome = execute_idempotent(
        context=context,
        scope="sales.retry_reconciliation",
        key=idempotency_key,
        request_payload={"issueId": str(issue_id), "correlationId": correlation_id},
        command=command,
    )
    payload = outcome.payload
    if payload.get("eventId"):
        process_payment_webhook_event(int(payload["eventId"]))
    issue = ReconciliationIssue.objects.get(public_id=payload["issueId"])
    return issue, outcome.replayed


def retry_reconciliation(*, limit: int = 100) -> int:
    event_ids = list(
        PaymentWebhookEvent.objects.filter(
            Q(status=PaymentWebhookEvent.Status.FAILED)
            | Q(status=PaymentWebhookEvent.Status.PROCESSING),
            next_retry_at__lte=timezone.now(),
        )
        .order_by("next_retry_at", "pk")
        .values_list("pk", flat=True)[: max(1, min(limit, 500))]
    )
    if event_ids:
        PaymentWebhookEvent.objects.filter(pk__in=event_ids).update(
            status=PaymentWebhookEvent.Status.RECEIVED
        )
    return sum(1 for event_id in event_ids if process_payment_webhook_event(event_id))
