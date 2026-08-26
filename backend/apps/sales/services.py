"""Tenant-safe seller payment connection commands and configuration."""

from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation
from enum import StrEnum

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.audit.services import record_audit_event
from apps.configuration.services import feature_enabled, parameter_value
from apps.organisations.permissions import (
    OrganisationPermission,
    require_permission,
)
from apps.organisations.selectors import TenantContext
from tenda.crypto import decrypt_credential, encrypt_credential
from tenda.errors import DomainError

from .models import PaymentOAuthState, SellerPaymentConnection
from .order_services import (
    CheckoutResult,
    OrderCommandResult,
    cancel_order,
    confirm_manual_payment,
    create_order,
    expire_due_orders,
    initiate_mercado_pago_checkout,
    public_order_for_token,
    publish_order_link,
    refund_payment,
    resend_order_link,
    review_payment_proof,
    set_buyer_details,
)
from .payments import get_payment_provider

__all__ = (
    "CheckoutResult",
    "OrderCommandResult",
    "cancel_order",
    "confirm_manual_payment",
    "create_order",
    "expire_due_orders",
    "initiate_mercado_pago_checkout",
    "public_order_for_token",
    "publish_order_link",
    "refund_payment",
    "resend_order_link",
    "review_payment_proof",
    "set_buyer_details",
)


class CommissionMode(StrEnum):
    DISABLED = "disabled"
    PERCENTAGE = "percentage"


@dataclass(frozen=True, slots=True)
class PaymentCommissionConfiguration:
    mode: CommissionMode
    rate: Decimal
    minimum: int
    zero_fee_enabled: bool


@dataclass(frozen=True, slots=True)
class PaymentConnectionStart:
    authorization_url: str
    expires_at: datetime


def _decimal_setting(value: object, *, key: str) -> Decimal:
    try:
        result = Decimal(str(value))
    except (InvalidOperation, ValueError) as exc:
        raise DomainError(
            "PAYMENT_CONFIGURATION_INVALID",
            "La configuración de comisión no es válida.",
            status=503,
        ) from exc
    if not result.is_finite() or result < 0:
        raise DomainError(
            "PAYMENT_CONFIGURATION_INVALID",
            "La configuración de comisión no es válida.",
            status=503,
            field_errors={key: ["Debe ser un valor no negativo."]},
        )
    return result


def payment_commission_configuration(
    context: TenantContext,
) -> PaymentCommissionConfiguration:
    raw_mode = parameter_value(
        "commission_mode",
        organisation=context.organisation,
        default=settings.MERCADO_PAGO_COMMISSION_MODE,
    )
    try:
        mode = CommissionMode(str(raw_mode))
    except ValueError as exc:
        raise DomainError(
            "PAYMENT_CONFIGURATION_INVALID",
            "La configuración de comisión no es válida.",
            status=503,
        ) from exc
    rate = _decimal_setting(
        parameter_value(
            "commission_rate",
            organisation=context.organisation,
            default=settings.MERCADO_PAGO_COMMISSION_RATE,
        ),
        key="commissionRate",
    )
    minimum_value = _decimal_setting(
        parameter_value(
            "commission_minimum",
            organisation=context.organisation,
            default=settings.MERCADO_PAGO_COMMISSION_MINIMUM,
        ),
        key="commissionMinimum",
    )
    if minimum_value != minimum_value.to_integral_value() or rate > Decimal("100"):
        raise DomainError(
            "PAYMENT_CONFIGURATION_INVALID",
            "La configuración de comisión no es válida.",
            status=503,
        )
    return PaymentCommissionConfiguration(
        mode=mode,
        rate=rate,
        minimum=int(minimum_value),
        zero_fee_enabled=feature_enabled(
            "mercado_pago_zero_fee",
            organisation=context.organisation,
            default=False,
        ),
    )


def seller_payment_connection(
    context: TenantContext,
) -> SellerPaymentConnection | None:
    require_permission(
        context.membership,
        OrganisationPermission.MANAGE_SENSITIVE_CONFIGURATION,
    )
    return SellerPaymentConnection.objects.filter(
        organisation=context.organisation,
        provider=SellerPaymentConnection.Provider.MERCADO_PAGO,
    ).first()


def _state_digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


@transaction.atomic
def start_seller_payment_connection(
    *,
    context: TenantContext,
    correlation_id: str = "",
) -> PaymentConnectionStart:
    require_permission(
        context.membership,
        OrganisationPermission.MANAGE_SENSITIVE_CONFIGURATION,
    )
    existing = (
        SellerPaymentConnection.objects.select_for_update()
        .filter(
            organisation=context.organisation,
            provider=SellerPaymentConnection.Provider.MERCADO_PAGO,
        )
        .first()
    )
    if existing is not None and existing.status == SellerPaymentConnection.Status.CONNECTED:
        raise DomainError(
            "PAYMENT_CONNECTION_ALREADY_ACTIVE",
            "Mercado Pago ya está conectado.",
            status=409,
        )

    state = secrets.token_urlsafe(32)
    authorization_url = get_payment_provider().authorization_url(state=state)
    now = timezone.now()
    expires_at = now + timedelta(seconds=settings.PAYMENT_OAUTH_STATE_TTL_SECONDS)
    PaymentOAuthState.objects.filter(
        organisation=context.organisation,
        provider=SellerPaymentConnection.Provider.MERCADO_PAGO,
        consumed_at__isnull=True,
    ).update(consumed_at=now)
    PaymentOAuthState.objects.create(
        organisation=context.organisation,
        initiated_by=context.user,
        provider=SellerPaymentConnection.Provider.MERCADO_PAGO,
        state_hash=_state_digest(state),
        expires_at=expires_at,
    )
    connection, _created = SellerPaymentConnection.objects.get_or_create(
        organisation=context.organisation,
        provider=SellerPaymentConnection.Provider.MERCADO_PAGO,
    )
    connection.status = SellerPaymentConnection.Status.PENDING
    connection.last_error_code = ""
    connection.save(update_fields=("status", "last_error_code", "updated_at"))
    record_audit_event(
        action="payments.connection_started",
        organisation=context.organisation,
        actor=context.user,
        object_type="SellerPaymentConnection",
        object_public_id=str(connection.public_id),
        correlation_id=correlation_id,
        metadata={"provider": connection.provider},
    )
    return PaymentConnectionStart(
        authorization_url=authorization_url,
        expires_at=expires_at,
    )


@transaction.atomic
def _claim_oauth_state(state: str) -> PaymentOAuthState:
    value = (
        PaymentOAuthState.objects.select_for_update()
        .filter(
            provider=SellerPaymentConnection.Provider.MERCADO_PAGO,
            state_hash=_state_digest(state),
        )
        .first()
    )
    now = timezone.now()
    if value is None or value.consumed_at is not None or value.expires_at <= now:
        raise DomainError(
            "PAYMENT_OAUTH_STATE_INVALID",
            "La autorización expiró o ya fue utilizada.",
            status=400,
        )
    value.consumed_at = now
    value.save(update_fields=("consumed_at",))
    return value


def complete_seller_payment_connection(
    *,
    state: str,
    code: str,
    correlation_id: str = "",
) -> SellerPaymentConnection:
    if not state:
        raise DomainError(
            "PAYMENT_OAUTH_STATE_INVALID",
            "La autorización expiró o ya fue utilizada.",
            status=400,
        )
    oauth_state = _claim_oauth_state(state)
    try:
        token_set = get_payment_provider().exchange_authorization_code(code=code)
    except DomainError as exc:
        SellerPaymentConnection.objects.filter(
            organisation=oauth_state.organisation,
            provider=SellerPaymentConnection.Provider.MERCADO_PAGO,
        ).update(
            status=SellerPaymentConnection.Status.ERROR,
            last_error_code=exc.code,
        )
        record_audit_event(
            action="payments.connection_failed",
            organisation=oauth_state.organisation,
            actor=oauth_state.initiated_by,
            object_type="SellerPaymentConnection",
            outcome="failure",
            correlation_id=correlation_id,
            metadata={"provider": SellerPaymentConnection.Provider.MERCADO_PAGO},
        )
        raise

    now = timezone.now()
    expires_at = (
        now + timedelta(seconds=token_set.expires_in_seconds)
        if token_set.expires_in_seconds
        else None
    )
    with transaction.atomic():
        connection, _created = SellerPaymentConnection.objects.select_for_update().get_or_create(
            organisation=oauth_state.organisation,
            provider=SellerPaymentConnection.Provider.MERCADO_PAGO,
        )
        connection.status = SellerPaymentConnection.Status.CONNECTED
        connection.provider_account_id = token_set.provider_account_id
        connection.scopes = list(token_set.scopes)
        connection.access_token_ciphertext = encrypt_credential(token_set.access_token)
        connection.refresh_token_ciphertext = (
            encrypt_credential(token_set.refresh_token) if token_set.refresh_token else ""
        )
        connection.token_expires_at = expires_at
        connection.connected_at = now
        connection.disconnected_at = None
        connection.last_error_code = ""
        connection.save()
        record_audit_event(
            action="payments.connection_completed",
            organisation=oauth_state.organisation,
            actor=oauth_state.initiated_by,
            object_type="SellerPaymentConnection",
            object_public_id=str(connection.public_id),
            correlation_id=correlation_id,
            metadata={
                "provider": connection.provider,
                "providerAccountId": connection.provider_account_id,
                "scopes": connection.scopes,
            },
        )
    return connection


@transaction.atomic
def disconnect_seller_payment_connection(
    *,
    context: TenantContext,
    correlation_id: str = "",
) -> SellerPaymentConnection:
    require_permission(
        context.membership,
        OrganisationPermission.MANAGE_SENSITIVE_CONFIGURATION,
    )
    connection, _created = SellerPaymentConnection.objects.select_for_update().get_or_create(
        organisation=context.organisation,
        provider=SellerPaymentConnection.Provider.MERCADO_PAGO,
    )
    if connection.status == SellerPaymentConnection.Status.DISCONNECTED:
        return connection
    connection.status = SellerPaymentConnection.Status.DISCONNECTED
    connection.provider_account_id = ""
    connection.scopes = []
    connection.access_token_ciphertext = ""
    connection.refresh_token_ciphertext = ""
    connection.token_expires_at = None
    connection.disconnected_at = timezone.now()
    connection.last_error_code = ""
    connection.save()
    PaymentOAuthState.objects.filter(
        organisation=context.organisation,
        provider=SellerPaymentConnection.Provider.MERCADO_PAGO,
        consumed_at__isnull=True,
    ).update(consumed_at=timezone.now())
    record_audit_event(
        action="payments.connection_disconnected",
        organisation=context.organisation,
        actor=context.user,
        object_type="SellerPaymentConnection",
        object_public_id=str(connection.public_id),
        correlation_id=correlation_id,
        metadata={"provider": connection.provider},
    )
    return connection


def seller_access_token(connection: SellerPaymentConnection) -> str:
    """Internal-only token accessor for the T2 checkout service."""
    if (
        connection.status != SellerPaymentConnection.Status.CONNECTED
        or not connection.access_token_ciphertext
    ):
        raise DomainError(
            "PAYMENT_CONNECTION_REQUIRED",
            "Conecta Mercado Pago antes de iniciar un cobro.",
            status=409,
        )
    return decrypt_credential(connection.access_token_ciphertext)
