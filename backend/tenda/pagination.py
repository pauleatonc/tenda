"""Cursor pagination shared by every list contract.

Deep offsets are not offered on purpose: a client cannot ask for page 5000 and
force the database to walk the whole table.
"""

from __future__ import annotations

import base64
import binascii
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from django.db.models import F, Model, Q, QuerySet

from tenda.errors import DomainError

DEFAULT_PAGE_SIZE = 25
MAX_PAGE_SIZE = 100
NULL_MARKER = "\x00"


@dataclass(frozen=True, slots=True)
class Page[T: Model]:
    items: list[T]
    has_next_page: bool
    end_cursor: str
    total_count: int


def _invalid_cursor() -> DomainError:
    return DomainError(
        "INVALID_CURSOR",
        "El cursor de paginación no es válido.",
        field_errors={"after": ["Vuelve a cargar la lista."]},
    )


def _serialise(value: Any) -> str:
    if value is None:
        return NULL_MARKER
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return format(value, "f")
    return str(value)


def encode_cursor(sort_value: Any, identifier: int) -> str:
    raw = f"{_serialise(sort_value)}::{identifier}"
    return base64.urlsafe_b64encode(raw.encode("utf-8")).decode("ascii")


def decode_cursor(cursor: str) -> tuple[str | None, int]:
    try:
        raw = base64.urlsafe_b64decode(cursor.encode("ascii")).decode("utf-8")
    except (binascii.Error, UnicodeDecodeError, ValueError) as exc:
        raise _invalid_cursor() from exc
    value, separator, identifier = raw.rpartition("::")
    if not separator or not identifier.isdigit():
        raise _invalid_cursor()
    return (None if value == NULL_MARKER else value), int(identifier)


def clean_page_size(first: int | None) -> int:
    if first is None:
        return DEFAULT_PAGE_SIZE
    if first <= 0:
        raise DomainError(
            "VALIDATION_ERROR",
            "Revisa los datos ingresados.",
            field_errors={"first": ["Solicita al menos un elemento."]},
        )
    return min(int(first), MAX_PAGE_SIZE)


def _keyset_filter(field: str, value: str | None, identifier: int, *, descending: bool) -> Q:
    """Rows strictly after the cursor, with NULLs always ordered last."""

    if value is None:
        return Q(**{f"{field}__isnull": True, "pk__gt": identifier})
    comparison = "lt" if descending else "gt"
    return (
        Q(**{f"{field}__{comparison}": value})
        | Q(**{field: value, "pk__gt": identifier})
        | Q(**{f"{field}__isnull": True})
    )


def paginate[T: Model](
    queryset: QuerySet[T],
    *,
    cursor_field: str,
    after: str | None = None,
    first: int | None = None,
    descending: bool = False,
) -> Page[T]:
    """Keyset pagination over one sortable column plus the primary key."""

    size = clean_page_size(first)
    total = queryset.count()
    expression = F(cursor_field)
    order = (
        expression.desc(nulls_last=True) if descending else expression.asc(nulls_last=True),
        "pk",
    )
    if after:
        value, identifier = decode_cursor(after)
        try:
            queryset = queryset.filter(
                _keyset_filter(cursor_field, value, identifier, descending=descending)
            )
        except (ValueError, TypeError) as exc:
            raise _invalid_cursor() from exc
    window = list(queryset.order_by(*order)[: size + 1])
    has_next = len(window) > size
    items = window[:size]
    end_cursor = ""
    if items:
        last = items[-1]
        end_cursor = encode_cursor(getattr(last, cursor_field, None), last.pk)
    return Page(items=items, has_next_page=has_next, end_cursor=end_cursor, total_count=total)
