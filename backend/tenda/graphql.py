"""GraphQL adapter helpers with stable error extensions."""

from __future__ import annotations

from django.http import HttpRequest
from graphql import GraphQLError

from apps.organisations.selectors import TenantContext
from apps.users.middleware import get_correlation_id, get_tenant_context
from apps.users.models import User
from tenda.errors import AuthenticationRequired, DomainError, ResourceNotFound


def request_from_info(info: object) -> HttpRequest:
    request = getattr(info, "context", None)
    if not isinstance(request, HttpRequest):
        raise AuthenticationRequired()
    return request


def user_from_info(info: object) -> User:
    request = request_from_info(info)
    if not isinstance(request.user, User) or not request.user.is_authenticated:
        raise AuthenticationRequired()
    return request.user


def context_from_info(info: object) -> TenantContext:
    request = request_from_info(info)
    context = get_tenant_context(request)
    if context is None:
        if not isinstance(request.user, User) or not request.user.is_authenticated:
            raise AuthenticationRequired()
        raise ResourceNotFound()
    return context


def graphql_error(info: object, error: DomainError) -> GraphQLError:
    request = request_from_info(info)
    return GraphQLError(
        error.message,
        extensions={
            "code": error.code,
            "fieldErrors": error.field_errors,
            "correlationId": get_correlation_id(request),
            "retryable": error.retryable,
        },
    )
