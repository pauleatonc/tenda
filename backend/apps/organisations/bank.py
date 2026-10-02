"""Seller bank details used for deposit / bank-transfer offers."""

from __future__ import annotations

import re
from collections.abc import Mapping, Sequence
from typing import Any

from django.core.exceptions import ValidationError
from django.core.validators import validate_email

from tenda.errors import DomainError

from .models import Organisation, OrganisationBankAccount

BANK_ACCOUNT_TYPES = {
    "cuenta_corriente": "Cuenta corriente",
    "cuenta_vista": "Cuenta vista",
    "cuenta_ahorro": "Cuenta de ahorro",
    "cuenta_rut": "CuentaRUT",
}

BANK_FIELDS = (
    "bank_name",
    "bank_account_type",
    "bank_account_number",
    "bank_holder_tax_id",
    "bank_confirmation_email",
)

MAX_BANK_ACCOUNTS = OrganisationBankAccount.MAX_PER_ORGANISATION

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


def _account_is_complete(account: OrganisationBankAccount | Mapping[str, Any]) -> bool:
    if isinstance(account, OrganisationBankAccount):
        values = {
            "bank_name": account.bank_name,
            "bank_account_type": account.bank_account_type,
            "bank_account_number": account.bank_account_number,
            "bank_holder_tax_id": account.bank_holder_tax_id,
            "bank_confirmation_email": account.bank_confirmation_email,
        }
    else:
        values = {
            "bank_name": str(account.get("bank_name") or ""),
            "bank_account_type": str(account.get("bank_account_type") or ""),
            "bank_account_number": str(account.get("bank_account_number") or ""),
            "bank_holder_tax_id": str(account.get("bank_holder_tax_id") or ""),
            "bank_confirmation_email": str(account.get("bank_confirmation_email") or ""),
        }
    return all(
        [
            values["bank_name"].strip(),
            values["bank_account_type"] in BANK_ACCOUNT_TYPES,
            _ACCOUNT_NUMBER.fullmatch(values["bank_account_number"].strip() or ""),
            is_valid_rut(values["bank_holder_tax_id"]),
            bool(values["bank_confirmation_email"].strip()),
        ]
    )


def organisation_bank_accounts(organisation: Organisation) -> list[OrganisationBankAccount]:
    return list(organisation.bank_accounts.all())


def has_complete_bank_details(organisation: Organisation) -> bool:
    accounts = organisation_bank_accounts(organisation)
    if accounts:
        return any(_account_is_complete(account) for account in accounts)
    return all(
        [
            organisation.bank_name.strip(),
            organisation.bank_account_type in BANK_ACCOUNT_TYPES,
            _ACCOUNT_NUMBER.fullmatch(organisation.bank_account_number.strip() or ""),
            is_valid_rut(organisation.bank_holder_tax_id),
            bool(organisation.bank_confirmation_email.strip()),
        ]
    )


def public_details_from_values(values: Mapping[str, str]) -> dict[str, str] | None:
    if not _account_is_complete(values):
        return None
    account_type = values["bank_account_type"]
    return {
        "bank_name": values["bank_name"].strip(),
        "account_type": account_type,
        "account_type_label": BANK_ACCOUNT_TYPES[account_type],
        "account_number": values["bank_account_number"].strip(),
        "tax_id": format_rut(values["bank_holder_tax_id"]),
        "confirmation_email": values["bank_confirmation_email"].strip().lower(),
    }


def public_details_from_account(account: OrganisationBankAccount) -> dict[str, str] | None:
    return public_details_from_values(
        {
            "bank_name": account.bank_name,
            "bank_account_type": account.bank_account_type,
            "bank_account_number": account.bank_account_number,
            "bank_holder_tax_id": account.bank_holder_tax_id,
            "bank_confirmation_email": account.bank_confirmation_email,
        }
    )


def public_bank_details(
    organisation: Organisation,
    *,
    account: OrganisationBankAccount | None = None,
    snapshot: Mapping[str, Any] | None = None,
) -> dict[str, str] | None:
    if snapshot:
        mapped = {
            "bank_name": str(snapshot.get("bank_name") or snapshot.get("bankName") or ""),
            "bank_account_type": str(
                snapshot.get("bank_account_type")
                or snapshot.get("account_type")
                or snapshot.get("accountType")
                or ""
            ),
            "bank_account_number": str(
                snapshot.get("bank_account_number")
                or snapshot.get("account_number")
                or snapshot.get("accountNumber")
                or ""
            ),
            "bank_holder_tax_id": str(
                snapshot.get("bank_holder_tax_id")
                or snapshot.get("tax_id")
                or snapshot.get("taxId")
                or ""
            ),
            "bank_confirmation_email": str(
                snapshot.get("bank_confirmation_email")
                or snapshot.get("confirmation_email")
                or snapshot.get("confirmationEmail")
                or ""
            ),
        }
        return public_details_from_values(mapped)
    if account is not None:
        return public_details_from_account(account)
    accounts = organisation_bank_accounts(organisation)
    for item in accounts:
        details = public_details_from_account(item)
        if details is not None:
            return details
    if not has_complete_bank_details(organisation):
        return None
    return public_details_from_values(
        {
            "bank_name": organisation.bank_name,
            "bank_account_type": organisation.bank_account_type,
            "bank_account_number": organisation.bank_account_number,
            "bank_holder_tax_id": organisation.bank_holder_tax_id,
            "bank_confirmation_email": organisation.bank_confirmation_email,
        }
    )


def format_bank_instructions(
    organisation: Organisation,
    *,
    account: OrganisationBankAccount | None = None,
    snapshot: Mapping[str, Any] | None = None,
) -> str:
    details = public_bank_details(organisation, account=account, snapshot=snapshot)
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
    label = str(payload.get("label") or "").strip()
    values = {
        "bank_name": bank_name,
        "bank_account_type": account_type,
        "bank_account_number": account_number,
        "bank_holder_tax_id": tax_id,
        "bank_confirmation_email": email,
    }
    if not any(values.values()) and not label:
        return {**{field: "" for field in BANK_FIELDS}, "label": ""}

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
    if len(label) > 80:
        field_errors["label"] = ["La etiqueta no puede superar 80 caracteres."]
    if field_errors:
        raise DomainError(
            "VALIDATION_ERROR",
            "Revisa los datos bancarios ingresados.",
            field_errors=field_errors,
        )
    return {**values, "label": label}


def cleaned_bank_accounts(payloads: Sequence[Mapping[str, Any]]) -> list[dict[str, str]]:
    if len(payloads) > MAX_BANK_ACCOUNTS:
        raise DomainError(
            "VALIDATION_ERROR",
            f"Puedes registrar hasta {MAX_BANK_ACCOUNTS} cuentas para depósitos.",
            field_errors={"bankAccounts": [f"Máximo {MAX_BANK_ACCOUNTS} cuentas."]},
        )
    cleaned: list[dict[str, str]] = []
    for index, payload in enumerate(payloads):
        try:
            cleaned.append(cleaned_bank_details(payload))
        except DomainError as exc:
            prefixed = {
                f"bankAccounts.{index}.{key}": messages
                for key, messages in (exc.field_errors or {}).items()
            }
            raise DomainError(
                "VALIDATION_ERROR",
                "Revisa los datos bancarios ingresados.",
                field_errors=prefixed,
            ) from exc
    if any(not any(item[field] for field in BANK_FIELDS) for item in cleaned):
        raise DomainError(
            "VALIDATION_ERROR",
            "Cada cuenta debe estar completa.",
            field_errors={"bankAccounts": ["Completa o elimina las cuentas vacías."]},
        )
    return cleaned


def sync_primary_bank_fields(organisation: Organisation) -> None:
    """Keep legacy Organisation columns aligned with the first account."""

    primary = organisation.bank_accounts.order_by("position", "created_at").first()
    if primary is None:
        for field in BANK_FIELDS:
            setattr(organisation, field, "")
        return
    organisation.bank_name = primary.bank_name
    organisation.bank_account_type = primary.bank_account_type
    organisation.bank_account_number = primary.bank_account_number
    organisation.bank_holder_tax_id = primary.bank_holder_tax_id
    organisation.bank_confirmation_email = primary.bank_confirmation_email


def snapshot_from_account(account: OrganisationBankAccount) -> dict[str, str]:
    details = public_details_from_account(account)
    if details is None:
        raise DomainError(
            "VALIDATION_ERROR",
            "La cuenta seleccionada no está completa.",
            field_errors={"bankAccountId": ["Selecciona una cuenta válida."]},
        )
    return {
        "id": str(account.public_id),
        "label": account.label,
        **details,
    }


def resolve_deposit_account(
    organisation: Organisation,
    *,
    bank_account_id: str | None,
) -> OrganisationBankAccount | None:
    accounts = [
        account
        for account in organisation_bank_accounts(organisation)
        if _account_is_complete(account)
    ]
    require_bank_details_for_deposit(organisation)
    if bank_account_id:
        for account in accounts:
            if str(account.public_id) == str(bank_account_id):
                return account
        raise DomainError(
            "VALIDATION_ERROR",
            "Selecciona una cuenta válida para el depósito.",
            field_errors={"bankAccountId": ["La cuenta no pertenece a esta tienda."]},
        )
    if len(accounts) == 1:
        return accounts[0]
    if not accounts:
        # Legacy organisations with only denormalised columns.
        return None
    raise DomainError(
        "VALIDATION_ERROR",
        "Selecciona la cuenta a la que debe hacerse el depósito.",
        field_errors={"bankAccountId": ["Selecciona una cuenta."]},
    )
