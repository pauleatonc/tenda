"""Small envelope encryption helper for short-lived outbox secrets."""

from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings

from tenda.errors import DomainError


def _fernet() -> Fernet:
    configured = str(getattr(settings, "OUTBOX_ENCRYPTION_KEY", ""))
    seed = configured or settings.SECRET_KEY
    key = base64.urlsafe_b64encode(hashlib.sha256(seed.encode()).digest())
    return Fernet(key)


def _credential_fernet() -> Fernet:
    configured = str(getattr(settings, "CREDENTIAL_ENCRYPTION_KEY", ""))
    seed = configured or settings.SECRET_KEY
    key = base64.urlsafe_b64encode(hashlib.sha256(f"credential:{seed}".encode()).digest())
    return Fernet(key)


def encrypt_outbox_value(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode()


def decrypt_outbox_value(value: str) -> str:
    try:
        return _fernet().decrypt(value.encode()).decode()
    except (InvalidToken, ValueError) as exc:
        raise DomainError(
            "OUTBOX_DECRYPTION_FAILED",
            "No se pudo procesar un evento interno.",
            status=500,
        ) from exc


def encrypt_credential(value: str) -> str:
    return _credential_fernet().encrypt(value.encode()).decode()


def decrypt_credential(value: str) -> str:
    try:
        return _credential_fernet().decrypt(value.encode()).decode()
    except (InvalidToken, ValueError) as exc:
        raise DomainError(
            "CREDENTIAL_DECRYPTION_FAILED",
            "No se pudo leer una credencial protegida.",
            status=500,
        ) from exc
