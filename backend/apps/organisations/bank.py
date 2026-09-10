"""Seller bank details used for deposit / bank-transfer offers."""

from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Any

from django.core.exceptions import ValidationError
from django.core.validators import validate_email

from tenda.errors import DomainError

from .models import Organisation

BANK_ACCOUNT_TYPES = {
    "cuenta_corriente": "Cuenta corriente",
    "cuenta_vista": "Cuenta vista",
    "cuenta_ahorro": "Cuenta de ahorro",
    "cuenta_rut": "CuentaRUT",
}

CHILEAN_BANKS = (
    "Banco de Chile",
    "BancoEstado",
    "Banco Santander",
    "BCI",
    "Itaú",
    "Scotiabank",
    "Banco Falabella",
    "Banco BICE",
    "Banco Security",
    "Banco Consorcio",
    "Banco Ripley",
    "Banco Internacional",
    "Coopeuch",
    "Tenpo",
    "Mercado Pago",
)

BANK_FIELDS = (
    "bank_name",
    "bank_account_type",
    "bank_account_number",
    "bank_holder_tax_id",
    "bank_confirmation_email",
)

_RUT_BODY = re.compile(r"^\d{7,8}$")
_ACCOUNT_NUMBER = re.compile(r"^\d{5,20}$")


def normalize_rut(value: str) -> str:
    return re.sub(r"[^0-9kK]", "", value).upper()


def format_rut(value: str) -> str:
    cleaned = normalize_rut(value)
    if len(cleaned) < 2:
        return value.strip()
    body, check = cleaned[:-1], cleaned[-1]
    groups: list[str] = []
    rest = body
    while rest:
        groups.append(rest[-3:])
        rest = rest[:-3]
    return f"{'.'.join(reversed(groups))}-{check}"


def rut_check_digit(body: str) -> str:
    total = 0
    factor = 2
    for digit in reversed(body):
        total += int(digit) * factor
        factor = 2 if factor == 7 else factor + 1
    remainder = 11 - (total % 11)
    if remainder == 11:
        return "0"
    if remainder == 10:
        return "K"
    return str(remainder)


def is_valid_rut(value: str) -> bool:
    cleaned = normalize_rut(value)
    if len(cleaned) < 8:
        return False
    body, check = cleaned[:-1], cleaned[-1]
    if not _RUT_BODY.fullmatch(body):
        return False
    return check == rut_check_digit(body)


def has_complete_bank_details(organisation: Organisation) -> bool:
    return all(
        [
            organisation.bank_name.strip(),
            organisation.bank_account_type in BANK_ACCOUNT_TYPES,
            _ACCOUNT_NUMBER.fullmatch(organisation.bank_account_number.strip() or ""),
            is_valid_rut(organisation.bank_holder_tax_id),
            bool(organisation.bank_confirmation_email.strip()),
        ]
    )


def public_bank_details(organisation: Organisation) -> dict[str, str] | None:
    if not has_complete_bank_details(organisation):
        return None
    account_type = organisation.bank_account_type
    return {
        "bank_name": organisation.bank_name.strip(),
        "account_type": account_type,
        "account_type_label": BANK_ACCOUNT_TYPES[account_type],
        "account_number": organisation.bank_account_number.strip(),
        "tax_id": format_rut(organisation.bank_holder_tax_id),
        "confirmation_email": organisation.bank_confirmation_email.strip().lower(),
    }


def format_bank_instructions(organisation: Organisation) -> str:
    details = public_bank_details(organisation)
    if details is None:
        return ""
    return "\n".join(
        [
            f"Banco: {details['bank_name']}",
            f"Tipo de cuenta: {details['account_type_label']}",
            f"Número de cuenta: {details['account_number']}",
            f"RUT: {details['tax_id']}",
            f"Correo: {details['confirmation_email']}",
        ]
    )


def require_bank_details_for_deposit(organisation: Organisation) -> None:
    if has_complete_bank_details(organisation):
        return
    raise DomainError(
        "BANK_DETAILS_REQUIRED",
        "Para poder pedir depósitos debe agregar sus datos bancarios.",
        status=409,
    )


def cleaned_bank_details(payload: Mapping[str, Any]) -> dict[str, str]:
    bank_name = str(payload.get("bank_name") or "").strip()
    account_type = str(payload.get("bank_account_type") or "").strip()
    account_number = re.sub(r"\s+", "", str(payload.get("bank_account_number") or ""))
    tax_id = str(payload.get("bank_holder_tax_id") or "").strip()
    email = str(payload.get("bank_confirmation_email") or "").strip().lower()
    values = {
        "bank_name": bank_name,
        "bank_account_type": account_type,
        "bank_account_number": account_number,
        "bank_holder_tax_id": tax_id,
        "bank_confirmation_email": email,
    }
    if not any(values.values()):
        return {field: "" for field in BANK_FIELDS}

    field_errors: dict[str, list[str]] = {}
    if not bank_name:
        field_errors["bankName"] = ["Indica el banco."]
    elif len(bank_name) > 80:
        field_errors["bankName"] = ["El banco no puede superar 80 caracteres."]
    if account_type not in BANK_ACCOUNT_TYPES:
        field_errors["bankAccountType"] = ["Selecciona un tipo de cuenta."]
    if not _ACCOUNT_NUMBER.fullmatch(account_number):
        field_errors["bankAccountNumber"] = ["Ingresa el número de cuenta, solo dígitos."]
    if not is_valid_rut(tax_id):
        field_errors["bankHolderTaxId"] = ["Ingresa un RUT válido."]
    else:
        values["bank_holder_tax_id"] = format_rut(tax_id)
    if not email:
        field_errors["bankConfirmationEmail"] = ["Ingresa el correo de confirmación."]
    else:
        try:
            validate_email(email)
        except ValidationError:
            field_errors["bankConfirmationEmail"] = ["Ingresa un correo válido."]
    if field_errors:
        raise DomainError(
            "VALIDATION_ERROR",
            "Revisa los datos bancarios ingresados.",
            field_errors=field_errors,
        )
    return values
