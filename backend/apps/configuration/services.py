"""Typed reads for database-backed operational configuration."""

from __future__ import annotations

from typing import Any, cast

from django.db import transaction

from apps.organisations.models import Organisation
from tenda.crypto import decrypt_credential, encrypt_credential
from tenda.errors import DomainError

from .models import EncryptedCredential, FeatureFlag, OperationalParameter


def parameter_value[T](
    key: str,
    *,
    organisation: Organisation | None = None,
    default: T,
) -> T:
    queryset = OperationalParameter.objects.filter(key=key, is_active=True)
    parameter = None
    if organisation is not None:
        parameter = queryset.filter(organisation=organisation).first()
    if parameter is None:
        parameter = queryset.filter(organisation__isnull=True).first()
    return cast(T, parameter.value) if parameter is not None else default


def feature_enabled(
    key: str,
    *,
    organisation: Organisation | None = None,
    default: bool = False,
) -> bool:
    queryset = FeatureFlag.objects.filter(key=key)
    flag = None
    if organisation is not None:
        flag = queryset.filter(organisation=organisation).first()
    if flag is None:
        flag = queryset.filter(organisation__isnull=True).first()
    return bool(flag.enabled) if flag is not None else default


def public_operational_snapshot(organisation: Organisation | None = None) -> dict[str, Any]:
    """Expose only intentionally public, non-sensitive parameters."""
    global_parameters = OperationalParameter.objects.filter(
        is_active=True,
        sensitive=False,
        organisation__isnull=True,
    )
    snapshot = {parameter.key: parameter.value for parameter in global_parameters}
    if organisation is not None:
        tenant_parameters = OperationalParameter.objects.filter(
            is_active=True,
            sensitive=False,
            organisation=organisation,
        )
        snapshot.update({parameter.key: parameter.value for parameter in tenant_parameters})
    return snapshot


@transaction.atomic
def store_credential(
    *,
    organisation: Organisation,
    provider: str,
    secret: str,
    metadata: dict[str, Any] | None = None,
) -> EncryptedCredential:
    if not secret:
        raise DomainError("VALIDATION_ERROR", "La credencial no puede estar vacía.")
    EncryptedCredential.objects.filter(
        organisation=organisation,
        provider=provider,
        is_active=True,
    ).update(is_active=False)
    return EncryptedCredential.objects.create(
        organisation=organisation,
        provider=provider,
        ciphertext=encrypt_credential(secret),
        metadata=metadata or {},
    )


def credential_secret(*, organisation: Organisation, provider: str) -> str:
    credential = EncryptedCredential.objects.filter(
        organisation=organisation,
        provider=provider,
        is_active=True,
    ).first()
    if credential is None:
        raise DomainError(
            "CREDENTIAL_NOT_CONFIGURED",
            "La integración no está configurada.",
            status=503,
        )
    return decrypt_credential(credential.ciphertext)
