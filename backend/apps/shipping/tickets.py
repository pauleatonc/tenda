"""Public and seller ticket conversation for a shipment."""

from __future__ import annotations

import uuid
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.audit.idempotency import execute_idempotent
from apps.audit.services import record_audit_event
from apps.notifications.outbox import enqueue_outbox_event
from apps.organisations.models import Membership
from apps.organisations.selectors import TenantContext
from tenda.crypto import encrypt_outbox_value
from tenda.errors import DomainError, ResourceNotFound

from .models import Ticket, TicketMessage
from .selectors import OPEN_TICKET_STATUSES
from .services import (
    _context_for_shipment,
    public_shipment_for_token,
    public_shipment_url,
)

HUMAN_MESSAGE_MIN = 10
HUMAN_MESSAGE_MAX = 4000


@dataclass(frozen=True, slots=True)
class TicketCommandResult:
    ticket: Ticket
    replayed: bool


def _clean_text(value: object, *, maximum: int) -> str:
    return " ".join(str(value or "").split())[:maximum]


def _clean_email(value: object) -> str:
    text = str(value or "").strip().lower()
    if not text:
        return ""
    try:
        validate_email(text)
    except ValidationError as exc:
        raise DomainError(
            "VALIDATION_ERROR",
            "Revisa los datos ingresados.",
            field_errors={"contactEmail": ["Ingresa un correo válido."]},
        ) from exc
    return text[:254]


def _seller_email(ticket: Ticket) -> str:
    organisation = ticket.organisation
    if organisation.business_email:
        return organisation.business_email
    membership = (
        Membership.objects.filter(organisation=organisation)
        .select_related("user")
        .order_by("created_at")
        .first()
    )
    return membership.user.email if membership is not None else ""


def seller_ticket_url(ticket: Ticket) -> str:
    origin = str(getattr(settings, "WEB_ORIGIN", "")).rstrip("/")
    return f"{origin}/app/despachos/{ticket.shipment.public_id}/tickets/{ticket.public_id}"


def public_ticket_url(ticket: Ticket) -> str:
    return f"{public_shipment_url(ticket.shipment)}/consulta"


def _enqueue_ticket_notification(
    ticket: Ticket,
    *,
    template: str,
    recipient: str,
    link: str,
    link_parameter: str,
    deduplication_key: str,
) -> None:
    if not recipient:
        return
    enqueue_outbox_event(
        event_type="shipping.ticket_notification",
        payload={
            "recipient": recipient,
            "template": template,
            "linkCiphertext": encrypt_outbox_value(link),
            "linkParameter": link_parameter,
            "parameters": {
                "ticketNumber": ticket.number,
                "shipmentNumber": ticket.shipment.number,
                "orderNumber": ticket.shipment.order.number,
            },
        },
        organisation=ticket.organisation,
        aggregate_type="shipping.ticket",
        aggregate_public_id=str(ticket.public_id),
        deduplication_key=deduplication_key,
    )


def _append_message(
    ticket: Ticket,
    *,
    author_kind: str,
    body: str,
    actor: Any = None,
) -> TicketMessage:
    return TicketMessage.objects.create(
        ticket=ticket,
        author_kind=author_kind,
        body=body,
        actor=actor,
    )


def _set_status(ticket: Ticket, status: str) -> None:
    if ticket.status == status:
        return
    now = timezone.now()
    ticket.status = status
    update_fields = ["status", "updated_at"]
    if status == Ticket.Status.RESOLVED:
        ticket.resolved_at = now
        update_fields.append("resolved_at")
    elif status == Ticket.Status.CLOSED:
        ticket.closed_at = now
        update_fields.append("closed_at")
    ticket.save(update_fields=tuple(update_fields))
    from .cadences import sync_ticket_cadences

    sync_ticket_cadences(ticket)


def _contact_from_shipment(shipment: Any) -> dict[str, str]:
    buyer = getattr(shipment.order, "buyer", None)
    return {
        "contact_name": str(getattr(buyer, "name", "") or shipment.recipient_name or ""),
        "contact_email": str(getattr(buyer, "email", "") or ""),
        "contact_phone": str(getattr(buyer, "phone", "") or ""),
    }


def ensure_open_ticket(
    shipment: Any,
    *,
    category: str,
    message: str,
    author_kind: str,
    actor: Any = None,
    contact_name: str = "",
    contact_email: str = "",
    contact_phone: str = "",
    correlation_id: str = "",
) -> TicketCommandResult:
    existing = (
        Ticket.objects.select_for_update()
        .filter(shipment=shipment, status__in=OPEN_TICKET_STATUSES)
        .order_by("created_at")
        .first()
    )
    if existing is not None:
        if message:
            _append_message(existing, author_kind=author_kind, body=message, actor=actor)
            if author_kind == TicketMessage.AuthorKind.BUYER:
                _set_status(existing, Ticket.Status.AWAITING_SELLER)
            elif author_kind == TicketMessage.AuthorKind.SELLER:
                _set_status(existing, Ticket.Status.AWAITING_BUYER)
        if category and existing.category == Ticket.Category.OTHER:
            existing.category = category
            existing.save(update_fields=("category", "updated_at"))
        if contact_name:
            existing.contact_name = contact_name[:160]
        if contact_email:
            existing.contact_email = contact_email
        if contact_phone:
            existing.contact_phone = contact_phone[:32]
        if contact_name or contact_email or contact_phone:
            existing.save(
                update_fields=(
                    "contact_name",
                    "contact_email",
                    "contact_phone",
                    "updated_at",
                )
            )
        if message and author_kind == TicketMessage.AuthorKind.BUYER:
            _enqueue_ticket_notification(
                existing,
                template="ticket.buyer_reply",
                recipient=_seller_email(existing),
                link=seller_ticket_url(existing),
                link_parameter="ticketUrl",
                deduplication_key=(
                    f"shipping.ticket:{existing.public_id}:buyer:{existing.messages.count()}"
                ),
            )
        return TicketCommandResult(ticket=existing, replayed=True)

    snapshot = _contact_from_shipment(shipment)
    public_id = uuid.uuid4()
    ticket = Ticket.objects.create(
        public_id=public_id,
        organisation=shipment.organisation,
        inventory=shipment.inventory,
        shipment=shipment,
        number=f"CON-{public_id.hex[:10].upper()}",
        status=Ticket.Status.AWAITING_SELLER
        if author_kind != TicketMessage.AuthorKind.SELLER
        else Ticket.Status.AWAITING_BUYER,
        category=category or Ticket.Category.OTHER,
        contact_name=(contact_name or snapshot["contact_name"])[:160],
        contact_email=contact_email or snapshot["contact_email"],
        contact_phone=(contact_phone or snapshot["contact_phone"])[:32],
    )
    if message:
        _append_message(ticket, author_kind=author_kind, body=message, actor=actor)
    record_audit_event(
        action="shipping.ticket_opened",
        organisation=ticket.organisation,
        actor=actor,
        object_type="shipping.ticket",
        object_public_id=str(ticket.public_id),
        correlation_id=correlation_id,
        metadata={"shipmentId": str(shipment.public_id), "category": ticket.category},
    )
    if author_kind in {TicketMessage.AuthorKind.BUYER, TicketMessage.AuthorKind.SYSTEM}:
        _enqueue_ticket_notification(
            ticket,
            template="ticket.opened",
            recipient=_seller_email(ticket),
            link=seller_ticket_url(ticket),
            link_parameter="ticketUrl",
            deduplication_key=f"shipping.ticket:{ticket.public_id}:opened:seller",
        )
    from .cadences import sync_ticket_cadences

    sync_ticket_cadences(ticket)
    return TicketCommandResult(ticket=ticket, replayed=False)


def load_ticket(ticket_id: uuid.UUID) -> Ticket:
    ticket = (
        Ticket.objects.select_related("shipment", "shipment__order", "organisation", "inventory")
        .prefetch_related("messages", "messages__actor")
        .filter(public_id=ticket_id)
        .first()
    )
    if ticket is None:
        raise ResourceNotFound()
    return ticket


@transaction.atomic
def open_public_ticket(
    *,
    token: str,
    payload: Mapping[str, Any],
    idempotency_key: str,
    correlation_id: str = "",
) -> TicketCommandResult:
    shipment = public_shipment_for_token(token)
    category = str(payload.get("category") or Ticket.Category.OTHER).strip()
    if category not in {value for value, _label in Ticket.Category.choices}:
        raise DomainError(
            "VALIDATION_ERROR",
            "Revisa los datos ingresados.",
            field_errors={"category": ["Selecciona una categoría válida."]},
        )
    message = _clean_text(payload.get("message"), maximum=HUMAN_MESSAGE_MAX)
    if len(message) < HUMAN_MESSAGE_MIN:
        raise DomainError(
            "VALIDATION_ERROR",
            "Revisa los datos ingresados.",
            field_errors={"message": ["Cuéntanos un poco más para poder ayudarte."]},
        )
    contact_name = _clean_text(
        payload.get("contact_name", payload.get("contactName")),
        maximum=160,
    )
    contact_email = _clean_email(payload.get("contact_email", payload.get("contactEmail")))
    if not contact_email:
        raise DomainError(
            "VALIDATION_ERROR",
            "Revisa los datos ingresados.",
            field_errors={"contactEmail": ["Ingresa un correo para avisarte."]},
        )
    contact_phone = _clean_text(
        payload.get("contact_phone", payload.get("contactPhone")),
        maximum=32,
    )
    canonical = {
        "token": token,
        "category": category,
        "message": message,
        "contactName": contact_name,
        "contactEmail": contact_email,
        "contactPhone": contact_phone,
    }

    def command() -> tuple[dict[str, Any], int]:
        locked = (
            type(shipment)
            .objects.select_for_update()
            .select_related("order", "order__buyer", "organisation", "inventory")
            .filter(pk=shipment.pk)
            .first()
        )
        if locked is None:
            raise ResourceNotFound()
        try:
            result = ensure_open_ticket(
                locked,
                category=category,
                message=message,
                author_kind=TicketMessage.AuthorKind.BUYER,
                contact_name=contact_name,
                contact_email=contact_email,
                contact_phone=contact_phone,
                correlation_id=correlation_id,
            )
        except IntegrityError:
            result = ensure_open_ticket(
                locked,
                category=category,
                message=message,
                author_kind=TicketMessage.AuthorKind.BUYER,
                contact_name=contact_name,
                contact_email=contact_email,
                contact_phone=contact_phone,
                correlation_id=correlation_id,
            )
        return {"ticketId": str(result.ticket.public_id), "replayed": result.replayed}, 200

    stored = execute_idempotent(
        context=_context_for_shipment(shipment),
        scope="shipping.open_public_ticket",
        key=idempotency_key,
        request_payload=canonical,
        command=command,
    )
    return TicketCommandResult(
        ticket=load_ticket(uuid.UUID(str(stored.payload["ticketId"]))),
        replayed=stored.replayed,
    )


@transaction.atomic
def send_ticket_message(
    *,
    ticket_id: uuid.UUID,
    body: str,
    idempotency_key: str,
    context: TenantContext | None = None,
    token: str = "",
    correlation_id: str = "",
) -> TicketCommandResult:
    message = _clean_text(body, maximum=HUMAN_MESSAGE_MAX)
    if len(message) < HUMAN_MESSAGE_MIN:
        raise DomainError(
            "VALIDATION_ERROR",
            "Revisa los datos ingresados.",
            field_errors={"body": ["Escribe un mensaje un poco más largo."]},
        )
    if token:
        shipment = public_shipment_for_token(token)
        ticket = (
            Ticket.objects.select_for_update()
            .select_related("shipment", "shipment__order", "organisation")
            .filter(public_id=ticket_id, shipment=shipment)
            .first()
        )
        author_kind = TicketMessage.AuthorKind.BUYER
        actor = None
        next_status = Ticket.Status.AWAITING_SELLER
        notify_seller = True
        tenant = _context_for_shipment(shipment)
    else:
        if context is None:
            raise ResourceNotFound()
        ticket = (
            Ticket.objects.select_for_update()
            .select_related("shipment", "shipment__order", "organisation")
            .filter(
                public_id=ticket_id,
                organisation=context.organisation,
                inventory=context.inventory,
            )
            .first()
        )
        author_kind = TicketMessage.AuthorKind.SELLER
        actor = context.user
        next_status = Ticket.Status.AWAITING_BUYER
        notify_seller = False
        tenant = context
    if ticket is None:
        raise ResourceNotFound()
    if ticket.status not in OPEN_TICKET_STATUSES:
        raise DomainError(
            "TICKET_NOT_OPEN",
            "Esta consulta ya no admite mensajes.",
            status=409,
        )

    def command() -> tuple[dict[str, Any], int]:
        _append_message(ticket, author_kind=author_kind, body=message, actor=actor)
        _set_status(ticket, next_status)
        from .cadences import sync_ticket_cadences

        sync_ticket_cadences(ticket)
        record_audit_event(
            action="shipping.ticket_message_sent",
            organisation=ticket.organisation,
            actor=actor,
            object_type="shipping.ticket",
            object_public_id=str(ticket.public_id),
            correlation_id=correlation_id,
            metadata={"authorKind": author_kind},
        )
        if notify_seller:
            _enqueue_ticket_notification(
                ticket,
                template="ticket.buyer_reply",
                recipient=_seller_email(ticket),
                link=seller_ticket_url(ticket),
                link_parameter="ticketUrl",
                deduplication_key=(
                    f"shipping.ticket:{ticket.public_id}:buyer:{ticket.messages.count()}"
                ),
            )
        else:
            _enqueue_ticket_notification(
                ticket,
                template="ticket.seller_reply",
                recipient=ticket.contact_email,
                link=public_ticket_url(ticket),
                link_parameter="ticketUrl",
                deduplication_key=(
                    f"shipping.ticket:{ticket.public_id}:seller:{ticket.messages.count()}"
                ),
            )
        return {"ticketId": str(ticket.public_id)}, 200

    stored = execute_idempotent(
        context=tenant,
        scope="shipping.send_ticket_message",
        key=idempotency_key,
        request_payload={"ticketId": str(ticket_id), "body": message, "authorKind": author_kind},
        command=command,
    )
    return TicketCommandResult(
        ticket=load_ticket(uuid.UUID(str(stored.payload["ticketId"]))),
        replayed=stored.replayed,
    )


@transaction.atomic
def resolve_ticket(
    *,
    context: TenantContext,
    ticket_id: uuid.UUID,
    comment: str = "",
    idempotency_key: str,
    correlation_id: str = "",
) -> TicketCommandResult:
    ticket = (
        Ticket.objects.select_for_update()
        .select_related("shipment", "shipment__order", "organisation")
        .filter(
            public_id=ticket_id,
            organisation=context.organisation,
            inventory=context.inventory,
        )
        .first()
    )
    if ticket is None:
        raise ResourceNotFound()
    note = _clean_text(comment, maximum=HUMAN_MESSAGE_MAX)

    def command() -> tuple[dict[str, Any], int]:
        if ticket.status in {Ticket.Status.RESOLVED, Ticket.Status.CLOSED}:
            return {"ticketId": str(ticket.public_id), "replayed": True}, 200
        if ticket.status not in OPEN_TICKET_STATUSES:
            raise DomainError(
                "TICKET_NOT_OPEN",
                "Esta consulta ya no se puede resolver.",
                status=409,
            )
        if note:
            _append_message(
                ticket,
                author_kind=TicketMessage.AuthorKind.SELLER,
                body=note,
                actor=context.user,
            )
        _append_message(
            ticket,
            author_kind=TicketMessage.AuthorKind.SYSTEM,
            body="El vendedor marcó la consulta como resuelta.",
        )
        _set_status(ticket, Ticket.Status.RESOLVED)
        record_audit_event(
            action="shipping.ticket_resolved",
            organisation=ticket.organisation,
            actor=context.user,
            object_type="shipping.ticket",
            object_public_id=str(ticket.public_id),
            correlation_id=correlation_id,
            metadata={},
        )
        _enqueue_ticket_notification(
            ticket,
            template="ticket.resolved",
            recipient=ticket.contact_email,
            link=public_ticket_url(ticket),
            link_parameter="ticketUrl",
            deduplication_key=f"shipping.ticket:{ticket.public_id}:resolved",
        )
        return {"ticketId": str(ticket.public_id), "replayed": False}, 200

    stored = execute_idempotent(
        context=context,
        scope="shipping.resolve_ticket",
        key=idempotency_key,
        request_payload={"ticketId": str(ticket_id), "comment": note},
        command=command,
    )
    return TicketCommandResult(
        ticket=load_ticket(uuid.UUID(str(stored.payload["ticketId"]))),
        replayed=stored.replayed or bool(stored.payload.get("replayed")),
    )


def autoclose_ticket(ticket: Ticket, *, correlation_id: str = "") -> Ticket:
    if ticket.status not in OPEN_TICKET_STATUSES:
        return ticket
    _append_message(
        ticket,
        author_kind=TicketMessage.AuthorKind.SYSTEM,
        body="La consulta se cerró automáticamente porque no hubo respuesta a tiempo.",
    )
    _set_status(ticket, Ticket.Status.CLOSED)
    record_audit_event(
        action="shipping.ticket_autoclose",
        organisation=ticket.organisation,
        actor=None,
        object_type="shipping.ticket",
        object_public_id=str(ticket.public_id),
        correlation_id=correlation_id,
        metadata={"shipmentId": str(ticket.shipment.public_id)},
    )
    _enqueue_ticket_notification(
        ticket,
        template="ticket.autoclose",
        recipient=ticket.contact_email,
        link=public_ticket_url(ticket),
        link_parameter="ticketUrl",
        deduplication_key=f"shipping.ticket:{ticket.public_id}:autoclose",
    )
    return ticket


def public_ticket_for_token(token: str, ticket_id: uuid.UUID) -> Ticket:
    shipment = public_shipment_for_token(token)
    ticket = (
        Ticket.objects.select_related("shipment", "shipment__order", "organisation")
        .prefetch_related("messages", "messages__actor")
        .filter(public_id=ticket_id, shipment=shipment)
        .first()
    )
    if ticket is None:
        raise ResourceNotFound()
    return ticket
