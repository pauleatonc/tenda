"""GraphQL transport policy shared by every domain resolver."""

from __future__ import annotations

from typing import Any

from graphene_django.views import GraphQLView
from graphql import GraphQLError

from apps.users.middleware import get_correlation_id
from tenda.errors import DomainError


class TendaGraphQLView(GraphQLView):  # type: ignore[misc]
    def format_error(self, error: Exception) -> dict[str, Any]:
        original = getattr(error, "original_error", None)
        if isinstance(original, DomainError):
            formatted: dict[str, Any] = {
                "message": original.message,
                "extensions": {
                    "code": original.code,
                    "fieldErrors": original.field_errors,
                },
            }
        elif isinstance(error, GraphQLError):
            formatted = dict(error.formatted)
        else:
            formatted = {"message": "No pudimos completar la consulta."}

        extensions = dict(formatted.get("extensions") or {})
        extensions.setdefault(
            "code",
            "GRAPHQL_VALIDATION_FAILED" if not getattr(error, "path", None) else "INTERNAL_ERROR",
        )
        extensions.setdefault("fieldErrors", {})
        extensions.setdefault(
            "correlationId",
            get_correlation_id(self.request),
        )
        extensions.setdefault("retryable", False)
        formatted["extensions"] = extensions
        return formatted
