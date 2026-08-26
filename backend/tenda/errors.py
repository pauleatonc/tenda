"""Stable domain errors shared by thin HTTP and GraphQL adapters."""

from __future__ import annotations

from collections.abc import Mapping


class DomainError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        *,
        field_errors: Mapping[str, list[str]] | None = None,
        status: int = 400,
        retryable: bool = False,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.field_errors = dict(field_errors or {})
        self.status = status
        self.retryable = retryable


class AuthenticationRequired(DomainError):
    def __init__(self) -> None:
        super().__init__(
            "AUTHENTICATION_REQUIRED",
            "Debes iniciar sesión para continuar.",
            status=401,
        )


class PermissionDenied(DomainError):
    def __init__(self) -> None:
        super().__init__(
            "PERMISSION_DENIED",
            "No tienes permiso para realizar esta acción.",
            status=403,
        )


class ResourceNotFound(DomainError):
    def __init__(self) -> None:
        super().__init__(
            "NOT_FOUND",
            "No encontramos el recurso solicitado.",
            status=404,
        )
