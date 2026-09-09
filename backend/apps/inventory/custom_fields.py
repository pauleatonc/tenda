"""Validation of the dynamic inventory schema and of product values.

The frontend can be manipulated, so every rule here is re-applied on the server
for products, imports and the agent-free API surface alike.
"""

from __future__ import annotations

import datetime as dt
import re
import unicodedata
from collections.abc import Iterable, Mapping, Sequence
from decimal import Decimal, InvalidOperation
from typing import Any

from tenda.errors import DomainError

from .models import CustomFieldDefinition

KEY_PATTERN = re.compile(r"^[a-z][a-z0-9_]{0,59}$")
MAX_TEXT_LENGTH = 500
MAX_OPTIONS = 50
CORE_FIELD_KEYS = frozenset(
    {
        "id",
        "name",
        "catalog_status",
        "purchase_price",
        "sale_price",
        "currency",
        "quantity",
        "extra_attributes",
        "created_at",
        "updated_at",
    }
)


def validation_error(field: str, message: str, *, code: str = "VALIDATION_ERROR") -> DomainError:
    return DomainError(
        code,
        "Revisa los datos ingresados.",
        field_errors={field: [message]},
    )


def slugify_key(value: str) -> str:
    normalised = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "_", normalised).strip("_").lower()
    slug = re.sub(r"_{2,}", "_", slug)
    if slug and not slug[0].isalpha():
        slug = f"campo_{slug}"
    return slug[:60].rstrip("_")


def clean_key(value: str) -> str:
    candidate = slugify_key(value)
    if not KEY_PATTERN.match(candidate):
        raise validation_error(
            "key",
            "Usa una clave con letras minúsculas, números y guion bajo.",
        )
    if candidate in CORE_FIELD_KEYS:
        raise validation_error("key", "Esa clave está reservada por un campo núcleo.")
    return candidate


def clean_label(value: str) -> str:
    label = " ".join(value.split())
    if not label:
        raise validation_error("label", "Ingresa el nombre de la columna.")
    if len(label) > 80:
        raise validation_error("label", "Usa un nombre de hasta 80 caracteres.")
    return label


def clean_field_type(value: str) -> str:
    valid = {choice for choice, _label in CustomFieldDefinition.FieldType.choices}
    if value not in valid:
        raise validation_error("fieldType", "Selecciona un tipo de columna válido.")
    return value


def clean_options(
    field_type: str,
    options: Sequence[Mapping[str, Any]] | None,
) -> list[dict[str, str]]:
    """Options are typed and carry a stable key, so renaming never loses data."""

    if field_type != CustomFieldDefinition.FieldType.SINGLE_SELECT:
        if options:
            raise validation_error("options", "Solo la selección única acepta opciones.")
        return []
    if not options:
        raise validation_error("options", "Agrega al menos una opción.")
    if len(options) > MAX_OPTIONS:
        raise validation_error("options", f"Usa hasta {MAX_OPTIONS} opciones.")
    cleaned: list[dict[str, str]] = []
    seen_keys: set[str] = set()
    seen_labels: set[str] = set()
    for option in options:
        raw_label = str(option.get("label", "")) if isinstance(option, Mapping) else ""
        label = " ".join(raw_label.split())
        if not label:
            raise validation_error("options", "Cada opción necesita un nombre.")
        raw_key = str(option.get("key", "")) if isinstance(option, Mapping) else ""
        key = slugify_key(raw_key or label)
        if not KEY_PATTERN.match(key):
            raise validation_error("options", "Cada opción necesita una clave válida.")
        if key in seen_keys or label.casefold() in seen_labels:
            raise validation_error("options", "Las opciones no pueden repetirse.")
        seen_keys.add(key)
        seen_labels.add(label.casefold())
        cleaned.append({"key": key, "label": label})
    return cleaned


def _field_error_key(definition: CustomFieldDefinition) -> str:
    return f"extraAttributes.{definition.key}"


def _is_blank(value: Any) -> bool:
    return value is None or (isinstance(value, str) and not value.strip())


def _clean_short_text(definition: CustomFieldDefinition, value: Any) -> str:
    if not isinstance(value, str):
        raise validation_error(_field_error_key(definition), "Ingresa un texto válido.")
    text = value.strip()
    if len(text) > MAX_TEXT_LENGTH:
        raise validation_error(
            _field_error_key(definition),
            f"Usa un texto de hasta {MAX_TEXT_LENGTH} caracteres.",
        )
    return text


def _clean_decimal(definition: CustomFieldDefinition, value: Any) -> str:
    if isinstance(value, bool):
        raise validation_error(_field_error_key(definition), "Ingresa un número válido.")
    try:
        number = Decimal(str(value).strip())
    except (InvalidOperation, ValueError) as exc:
        raise validation_error(
            _field_error_key(definition),
            "Ingresa un número válido.",
        ) from exc
    if not number.is_finite():
        raise validation_error(_field_error_key(definition), "Ingresa un número válido.")
    exponent = number.as_tuple().exponent
    if isinstance(exponent, int) and exponent < -4:
        raise validation_error(
            _field_error_key(definition),
            "Usa hasta cuatro decimales.",
        )
    if abs(number) >= Decimal("1000000000000"):
        raise validation_error(_field_error_key(definition), "El número es demasiado grande.")
    return format(number.normalize(), "f")


def _clean_date(definition: CustomFieldDefinition, value: Any) -> str:
    if isinstance(value, dt.datetime):
        return value.date().isoformat()
    if isinstance(value, dt.date):
        return value.isoformat()
    if isinstance(value, str):
        try:
            return dt.date.fromisoformat(value.strip()).isoformat()
        except ValueError as exc:
            raise validation_error(
                _field_error_key(definition),
                "Usa una fecha con formato AAAA-MM-DD.",
            ) from exc
    raise validation_error(_field_error_key(definition), "Usa una fecha con formato AAAA-MM-DD.")


def _clean_boolean(definition: CustomFieldDefinition, value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)) and value in (0, 1):
        return bool(value)
    if isinstance(value, str):
        normalised = value.strip().casefold()
        if normalised in {"true", "1", "sí", "si", "yes"}:
            return True
        if normalised in {"false", "0", "no"}:
            return False
    raise validation_error(_field_error_key(definition), "Selecciona sí o no.")


def _clean_single_select(definition: CustomFieldDefinition, value: Any) -> str:
    if not isinstance(value, str):
        raise validation_error(_field_error_key(definition), "Selecciona una opción válida.")
    candidate = value.strip()
    if candidate in definition.option_keys:
        return candidate
    for option in definition.options or []:
        if not isinstance(option, Mapping):
            continue
        label = str(option.get("label", "")).strip()
        key = str(option.get("key", "")).strip()
        if key and label.casefold() == candidate.casefold():
            return key
    raise validation_error(_field_error_key(definition), "Selecciona una opción válida.")


def clean_value(definition: CustomFieldDefinition, value: Any) -> Any:
    if definition.field_type == CustomFieldDefinition.FieldType.SHORT_TEXT:
        return _clean_short_text(definition, value)
    if definition.field_type == CustomFieldDefinition.FieldType.DECIMAL:
        return _clean_decimal(definition, value)
    if definition.field_type == CustomFieldDefinition.FieldType.DATE:
        return _clean_date(definition, value)
    if definition.field_type == CustomFieldDefinition.FieldType.BOOLEAN:
        return _clean_boolean(definition, value)
    if definition.field_type == CustomFieldDefinition.FieldType.SINGLE_SELECT:
        return _clean_single_select(definition, value)
    raise validation_error(_field_error_key(definition), "Tipo de columna no soportado.")


def validate_extra_attributes(
    definitions: Iterable[CustomFieldDefinition],
    values: Mapping[str, Any] | None,
    *,
    preserved: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Return the stored representation for one product.

    Values of inactive definitions are preserved untouched: deactivating a
    column frees a slot but never destroys history.
    """

    submitted = dict(values or {})
    active = [definition for definition in definitions if definition.is_active]
    active_keys = {definition.key for definition in active}
    unknown = sorted(set(submitted) - active_keys)
    if unknown:
        raise DomainError(
            "UNKNOWN_CUSTOM_FIELD",
            "Hay columnas que no existen en este inventario.",
            field_errors={f"extraAttributes.{key}": ["Esta columna no existe."] for key in unknown},
        )

    stored: dict[str, Any] = {
        key: item
        for key, item in (preserved or {}).items()
        if key not in active_keys and key not in submitted
    }
    for definition in active:
        raw = submitted.get(definition.key)
        if _is_blank(raw):
            if definition.is_required:
                raise validation_error(
                    _field_error_key(definition),
                    "Completa este campo obligatorio.",
                    code="CUSTOM_FIELD_REQUIRED",
                )
            continue
        stored[definition.key] = clean_value(definition, raw)
    return stored
