"""Incident and return cases. Creating a case never restocks."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any

from django.db import transaction
from django.utils import timezone

from apps.audit.idempotency import execute_idempotent
from apps.audit.services import record_audit_event
from apps.inventory.models import StockMovement
from apps.inventory.services import record_stock_movement
from apps.organisations.selectors import TenantContext
from tenda.errors import DomainError, ResourceNotFound

from .cadences import cancel_follow_ups
from .models import FollowUpSchedule, ReturnCase, Shipment
from .services import transition_shipment

KIND_STATUS: dict[str, str] = {
    ReturnCase.Kind.LOST: Shipment.Status.ISSUE,
    ReturnCase.Kind.OTHER: Shipment.Status.ISSUE,
    ReturnCase.Kind.REJECTED: Shipment.Status.RETURNED,
    ReturnCase.Kind.RETURNED: Shipment.Status.RETURNED,
}

REGISTERABLE_STATUSES = frozenset(
    {
        Shipment.Status.DISPATCHED,
        Shipment.Status.DELIVERY_CHECK,
        Shipment.Status.DELIVERED,
        Shipment.Status.ISSUE,
    }
)


@dataclass(frozen=True, slots=True)
class ReturnCaseResult:
    return_case: ReturnCase
    replayed: bool


def _clean_text(value: object, *, maximum: int) -> str:
    return " ".join(str(value or "").split())[:maximum]


def load_return_case(context: TenantContext, return_case_id: uuid.UUID) -> ReturnCase:
    case = (
        ReturnCase.objects.select_related("shipment", "shipment__order")
        .filter(
            public_id=return_case_id,
            organisation=context.organisation,
            inventory=context.inventory,
        )
        .first()
    )
    if case is None:
        raise ResourceNotFound()
    return case


@transaction.atomic
def register_return_case(
    *,
    context: TenantContext,
    shipment_id: uuid.UUID,
    kind: str,
    notes: str = "",
    idempotency_key: str,
    correlation_id: str = "",
) -> ReturnCaseResult:
    clean_kind = str(kind or "").strip()
    if clean_kind not in {value for value, _label in ReturnCase.Kind.choices}:
        raise DomainError(
            "VALIDATION_ERROR",
            "Revisa los datos ingresados.",
            field_errors={"kind": ["Selecciona un resultado válido."]},
        )
    note = _clean_text(notes, maximum=500)

    def command() -> tuple[dict[str, Any], int]:
        shipment = (
            Shipment.objects.select_for_update()
            .select_related("order")
            .filter(
                public_id=shipment_id,
                organisation=context.organisation,
                inventory=context.inventory,
            )
            .first()
        )
        if shipment is None:
            raise ResourceNotFound()
        if shipment.status not in REGISTERABLE_STATUSES:
            raise DomainError(
                "RETURN_CASE_NOT_ALLOWED",
                "Este envío ya no admite registrar una incidencia o devolución.",
                status=409,
            )
        target = KIND_STATUS[clean_kind]
        if shipment.status != target:
            transition_shipment(
                context,
                shipment_id=shipment.public_id,
                target=target,
                comment=note or f"Resultado registrado: {clean_kind}.",
                actor=context.user,
                correlation_id=correlation_id,
                internal_note=True,
            )
            shipment.refresh_from_db()
        cancel_follow_ups(
            shipment,
            kinds=frozenset({FollowUpSchedule.Kind.DELIVERY_CHECK}),
        )
        case = ReturnCase.objects.create(
            organisation=shipment.organisation,
            inventory=shipment.inventory,
            shipment=shipment,
            kind=clean_kind,
            notes=note,
            actor=context.user,
        )
        record_audit_event(
            action="shipping.return_case_registered",
            organisation=shipment.organisation,
            actor=context.user,
            object_type="shipping.return_case",
            object_public_id=str(case.public_id),
            correlation_id=correlation_id,
            metadata={
                "shipmentId": str(shipment.public_id),
                "kind": clean_kind,
                "stockMoved": False,
            },
        )
        return {"returnCaseId": str(case.public_id)}, 200

    stored = execute_idempotent(
        context=context,
        scope="shipping.register_return_case",
        key=idempotency_key,
        request_payload={
            "shipmentId": str(shipment_id),
            "kind": clean_kind,
            "notes": note,
        },
        command=command,
    )
    return ReturnCaseResult(
        return_case=load_return_case(
            context,
            uuid.UUID(str(stored.payload["returnCaseId"])),
        ),
        replayed=stored.replayed,
    )


def _restock_quantities(shipment: Shipment) -> list[tuple[uuid.UUID, int]]:
    aggregated: dict[uuid.UUID, int] = {}
    for item in shipment.order.items.select_related("product"):
        aggregated[item.product.public_id] = (
            aggregated.get(item.product.public_id, 0) + item.quantity
        )
    return list(aggregated.items())


@transaction.atomic
def confirm_return_to_stock(
    *,
    context: TenantContext,
    return_case_id: uuid.UUID,
    idempotency_key: str,
    correlation_id: str = "",
) -> ReturnCaseResult:
    def command() -> tuple[dict[str, Any], int]:
        case = (
            ReturnCase.objects.select_for_update()
            .select_related("shipment", "shipment__order")
            .filter(
                public_id=return_case_id,
                organisation=context.organisation,
                inventory=context.inventory,
            )
            .first()
        )
        if case is None:
            raise ResourceNotFound()
        if case.stock_confirmed_at is not None:
            return {"returnCaseId": str(case.public_id), "replayed": True}, 200
        existing = StockMovement.objects.filter(
            inventory=case.inventory,
            reference_type="shipping.return_case",
            reference_public_id=str(case.public_id),
        )
        if existing.exists() or case.stock_confirmed_at is not None:
            now = timezone.now()
            case.stock_confirmed_at = case.stock_confirmed_at or now
            case.stock_confirmed_by = case.stock_confirmed_by or context.user
            case.save(update_fields=("stock_confirmed_at", "stock_confirmed_by", "updated_at"))
            return {"returnCaseId": str(case.public_id), "replayed": True}, 200
        for product_id, quantity in _restock_quantities(case.shipment):
            record_stock_movement(
                context=context,
                product_id=product_id,
                movement_type=StockMovement.MovementType.ENTRY,
                quantity=quantity,
                reason="Reposición confirmada de devolución",
                note=case.notes,
                reference_type="shipping.return_case",
                reference_public_id=str(case.public_id),
                idempotency_key=f"{idempotency_key}:{product_id}",
                correlation_id=correlation_id,
            )
        now = timezone.now()
        case.stock_confirmed_at = now
        case.stock_confirmed_by = context.user
        case.save(update_fields=("stock_confirmed_at", "stock_confirmed_by", "updated_at"))
        record_audit_event(
            action="shipping.return_to_stock_confirmed",
            organisation=case.organisation,
            actor=context.user,
            object_type="shipping.return_case",
            object_public_id=str(case.public_id),
            correlation_id=correlation_id,
            metadata={"shipmentId": str(case.shipment.public_id)},
        )
        return {"returnCaseId": str(case.public_id), "replayed": False}, 200

    stored = execute_idempotent(
        context=context,
        scope="shipping.confirm_return_to_stock",
        key=idempotency_key,
        request_payload={"returnCaseId": str(return_case_id)},
        command=command,
    )
    return ReturnCaseResult(
        return_case=load_return_case(
            context,
            uuid.UUID(str(stored.payload["returnCaseId"])),
        ),
        replayed=stored.replayed or bool(stored.payload.get("replayed")),
    )
