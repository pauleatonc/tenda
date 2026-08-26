"""GraphQL shipping operations: dashboard, list, tracking and dispatch."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

import graphene
from django.utils import timezone
from graphql import GraphQLResolveInfo

from apps.media_assets.services import private_download_url
from apps.users.services import enforce_auth_rate_limit
from tenda.antibot import verify_turnstile
from tenda.errors import DomainError, ResourceNotFound
from tenda.graphql import context_from_info, graphql_error, request_from_info

from .cadences import CadenceMeta, cadence_meta, reschedule_follow_up
from .models import (
    DeliveryConfirmation,
    FollowUpSchedule,
    LabelDocument,
    ReturnCase,
    Shipment,
    ShipmentEvent,
    Ticket,
    TicketMessage,
)
from .returns import confirm_return_to_stock, register_return_case
from .selectors import (
    FOLLOW_UP_KIND_LABELS,
    FOLLOW_UP_STATUS_LABELS,
    RETURN_KIND_LABELS,
    STATUS_LABELS,
    TICKET_CATEGORY_LABELS,
    TICKET_STATUS_LABELS,
    ShipmentListFilter,
    ShippingDashboard,
    active_ticket,
    follow_ups_for,
    next_follow_up,
    paginated_shipments,
    public_allowed_actions,
    public_can_confirm,
    public_event_title,
    public_status_for,
    public_status_label,
    public_ticket_for,
    public_timeline,
    return_cases_for,
    seller_allowed_actions,
    seller_next_action,
    shipment_confirmation,
    shipment_for_context,
    shipment_timeline,
    shipping_dashboard,
    ticket_for_context,
)
from .services import (
    generate_shipment_label,
    mark_shipment_dispatched,
    public_shipment_for_token,
    public_shipment_url,
    update_shipment,
)
from .tickets import open_public_ticket, resolve_ticket, send_ticket_message


def _correlation_id(info: GraphQLResolveInfo) -> str:
    return str(getattr(info.context, "correlation_id", ""))


def _uuid_or_not_found(value: object) -> uuid.UUID:
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError) as exc:
        raise ResourceNotFound() from exc


def _public_guard(
    info: GraphQLResolveInfo,
    *,
    token: str,
    action: str,
    turnstile_token: str = "",
    require_turnstile: bool = False,
) -> None:
    request = request_from_info(info)
    remote_ip = str(request.META.get("REMOTE_ADDR", ""))[:64]
    enforce_auth_rate_limit(
        action=f"public_shipment_{action}",
        identity=token,
        ip_address=remote_ip,
    )
    if require_turnstile or turnstile_token:
        verify_turnstile(token=turnstile_token, remote_ip=remote_ip)


def _page_info(page: Any) -> dict[str, Any]:
    return {
        "has_next_page": page.has_next_page,
        "end_cursor": page.end_cursor,
    }


def _shipment_filter(raw: dict[str, Any] | None) -> ShipmentListFilter:
    data = raw or {}
    statuses = tuple(str(item) for item in (data.get("statuses") or ()) if item)
    attention = data.get("attention")
    return ShipmentListFilter(
        search=str(data.get("search") or ""),
        statuses=statuses,
        attention=None if attention is None else bool(attention),
        delivery_mode=str(data.get("delivery_mode") or ""),
    )


def _update_payload(raw: dict[str, Any] | None) -> dict[str, Any]:
    data = raw or {}
    return {
        "carrier": data.get("carrier"),
        "tracking_code": data.get("tracking_code"),
        "tracking_url": data.get("tracking_url"),
        "comment": data.get("comment") or "",
        "internal_note": bool(data.get("internal_note")),
    }


class PageInfoType(graphene.ObjectType):  # type: ignore[misc]
    has_next_page = graphene.Boolean(required=True)
    end_cursor = graphene.String(required=True)


class ShippingDashboardType(graphene.ObjectType):  # type: ignore[misc]
    total = graphene.Int(required=True)
    pending = graphene.Int(required=True)
    preparing = graphene.Int(required=True)
    dispatched = graphene.Int(required=True)
    delivery_check = graphene.Int(required=True)
    issue = graphene.Int(required=True)
    attention = graphene.Int(required=True)


class ShipmentOrderType(graphene.ObjectType):  # type: ignore[misc]
    id = graphene.ID(required=True)
    number = graphene.String(required=True)
    status = graphene.String(required=True)

    @staticmethod
    def resolve_id(root: Any, _info: GraphQLResolveInfo) -> str:
        return str(root.public_id)


class ShipmentEventType(graphene.ObjectType):  # type: ignore[misc]
    id = graphene.ID(required=True)
    event_type = graphene.String(required=True)
    from_status = graphene.String(required=True)
    to_status = graphene.String(required=True)
    title = graphene.String(required=True)
    detail = graphene.String(required=True)
    is_public = graphene.Boolean(required=True)
    actor_name = graphene.String(required=True)
    created_at = graphene.DateTime(required=True)

    @staticmethod
    def resolve_id(root: ShipmentEvent, _info: GraphQLResolveInfo) -> str:
        return str(root.public_id)

    @staticmethod
    def resolve_actor_name(root: ShipmentEvent, _info: GraphQLResolveInfo) -> str:
        actor = root.actor
        return actor.email if actor is not None else "Sistema"


class LabelDocumentType(graphene.ObjectType):  # type: ignore[misc]
    id = graphene.ID(required=True)
    download_url = graphene.String()
    expires_at = graphene.DateTime(required=True)
    created_at = graphene.DateTime(required=True)
    file_name = graphene.String(required=True)

    @staticmethod
    def resolve_id(root: LabelDocument, _info: GraphQLResolveInfo) -> str:
        return str(root.public_id)

    @staticmethod
    def resolve_download_url(root: LabelDocument, info: GraphQLResolveInfo) -> str | None:
        if root.expires_at <= timezone.now():
            return None
        try:
            return private_download_url(
                context=context_from_info(info),
                public_id=root.asset.public_id,
            )
        except DomainError:
            return None

    @staticmethod
    def resolve_file_name(root: LabelDocument, _info: GraphQLResolveInfo) -> str:
        return root.asset.original_name


class DeliveryConfirmationType(graphene.ObjectType):  # type: ignore[misc]
    outcome = graphene.String(required=True)
    comment = graphene.String(required=True)
    created_at = graphene.DateTime(required=True)


class FollowUpType(graphene.ObjectType):  # type: ignore[misc]
    id = graphene.ID(required=True)
    kind = graphene.String(required=True)
    kind_label = graphene.String(required=True)
    status = graphene.String(required=True)
    status_label = graphene.String(required=True)
    due_at = graphene.DateTime(required=True)
    sent_at = graphene.DateTime()
    parameter_key = graphene.String(required=True)
    parameter_source = graphene.String(required=True)
    parameter_source_label = graphene.String(required=True)
    parameter_label = graphene.String(required=True)

    @staticmethod
    def resolve_id(root: FollowUpSchedule, _info: GraphQLResolveInfo) -> str:
        return str(root.public_id)

    @staticmethod
    def resolve_kind_label(root: FollowUpSchedule, _info: GraphQLResolveInfo) -> str:
        return FOLLOW_UP_KIND_LABELS.get(root.kind, root.kind)

    @staticmethod
    def resolve_status_label(root: FollowUpSchedule, _info: GraphQLResolveInfo) -> str:
        return FOLLOW_UP_STATUS_LABELS.get(root.status, root.status)

    @staticmethod
    def _cadence_meta(root: FollowUpSchedule) -> CadenceMeta:
        return cadence_meta(root.kind, root.organisation)

    @staticmethod
    def resolve_parameter_key(root: FollowUpSchedule, _info: GraphQLResolveInfo) -> str:
        return FollowUpType._cadence_meta(root).key

    @staticmethod
    def resolve_parameter_source(root: FollowUpSchedule, _info: GraphQLResolveInfo) -> str:
        return FollowUpType._cadence_meta(root).source

    @staticmethod
    def resolve_parameter_source_label(
        root: FollowUpSchedule,
        _info: GraphQLResolveInfo,
    ) -> str:
        return FollowUpType._cadence_meta(root).source_label

    @staticmethod
    def resolve_parameter_label(root: FollowUpSchedule, _info: GraphQLResolveInfo) -> str:
        return FollowUpType._cadence_meta(root).display


class ReturnCaseType(graphene.ObjectType):  # type: ignore[misc]
    id = graphene.ID(required=True)
    kind = graphene.String(required=True)
    kind_label = graphene.String(required=True)
    notes = graphene.String(required=True)
    stock_confirmed_at = graphene.DateTime()
    created_at = graphene.DateTime(required=True)

    @staticmethod
    def resolve_id(root: ReturnCase, _info: GraphQLResolveInfo) -> str:
        return str(root.public_id)

    @staticmethod
    def resolve_kind_label(root: ReturnCase, _info: GraphQLResolveInfo) -> str:
        return RETURN_KIND_LABELS.get(root.kind, root.kind)


class PublicBuyerContactType(graphene.ObjectType):  # type: ignore[misc]
    name = graphene.String(required=True)
    email = graphene.String(required=True)
    phone = graphene.String(required=True)


class TicketMessageType(graphene.ObjectType):  # type: ignore[misc]
    id = graphene.ID(required=True)
    author_kind = graphene.String(required=True)
    body = graphene.String(required=True)
    created_at = graphene.DateTime(required=True)

    @staticmethod
    def resolve_id(root: TicketMessage, _info: GraphQLResolveInfo) -> str:
        return str(root.public_id)


class TicketShipmentRefType(graphene.ObjectType):  # type: ignore[misc]
    id = graphene.ID(required=True)
    number = graphene.String(required=True)
    order_number = graphene.String(required=True)

    @staticmethod
    def resolve_id(root: Shipment, _info: GraphQLResolveInfo) -> str:
        return str(root.public_id)

    @staticmethod
    def resolve_order_number(root: Shipment, _info: GraphQLResolveInfo) -> str:
        return root.order.number


class TicketType(graphene.ObjectType):  # type: ignore[misc]
    id = graphene.ID(required=True)
    number = graphene.String(required=True)
    status = graphene.String(required=True)
    status_label = graphene.String(required=True)
    category = graphene.String(required=True)
    category_label = graphene.String(required=True)
    contact_name = graphene.String(required=True)
    contact_email = graphene.String(required=True)
    contact_phone = graphene.String(required=True)
    resolved_at = graphene.DateTime()
    closed_at = graphene.DateTime()
    created_at = graphene.DateTime(required=True)
    messages = graphene.List(graphene.NonNull(TicketMessageType), required=True)
    shipment = graphene.Field(TicketShipmentRefType, required=True)

    @staticmethod
    def resolve_id(root: Ticket, _info: GraphQLResolveInfo) -> str:
        return str(root.public_id)

    @staticmethod
    def resolve_status_label(root: Ticket, _info: GraphQLResolveInfo) -> str:
        return TICKET_STATUS_LABELS.get(root.status, root.status)

    @staticmethod
    def resolve_category_label(root: Ticket, _info: GraphQLResolveInfo) -> str:
        return TICKET_CATEGORY_LABELS.get(root.category, root.category)

    @staticmethod
    def resolve_messages(root: Ticket, _info: GraphQLResolveInfo) -> list[TicketMessage]:
        return list(root.messages.all())

    @staticmethod
    def resolve_shipment(root: Ticket, _info: GraphQLResolveInfo) -> Shipment:
        return root.shipment


class PublicShipmentSellerType(graphene.ObjectType):  # type: ignore[misc]
    name = graphene.String(required=True)
    phone = graphene.String(required=True)
    business_email = graphene.String(required=True)


class PublicShipmentLineType(graphene.ObjectType):  # type: ignore[misc]
    product_name = graphene.String(required=True)
    quantity = graphene.Int(required=True)


class PublicShipmentEventType(graphene.ObjectType):  # type: ignore[misc]
    title = graphene.String(required=True)
    detail = graphene.String(required=True)
    created_at = graphene.DateTime(required=True)

    @staticmethod
    def resolve_title(root: ShipmentEvent, _info: GraphQLResolveInfo) -> str:
        return public_event_title(root)


class PublicShipmentType(graphene.ObjectType):  # type: ignore[misc]
    number = graphene.String(required=True)
    public_status = graphene.String(required=True)
    public_status_label = graphene.String(required=True)
    order_number = graphene.String(required=True)
    seller = graphene.Field(PublicShipmentSellerType, required=True)
    lines = graphene.List(graphene.NonNull(PublicShipmentLineType), required=True)
    carrier = graphene.String(required=True)
    tracking_code = graphene.String(required=True)
    tracking_url = graphene.String(required=True)
    dispatched_at = graphene.DateTime()
    timeline = graphene.List(graphene.NonNull(PublicShipmentEventType), required=True)
    confirmation = graphene.Field(DeliveryConfirmationType)
    ticket = graphene.Field(TicketType)
    buyer_contact = graphene.Field(PublicBuyerContactType, required=True)
    allowed_actions = graphene.List(graphene.NonNull(graphene.String), required=True)
    can_confirm = graphene.Boolean(required=True)
    token_expires_at = graphene.DateTime(required=True)

    @staticmethod
    def resolve_public_status(root: Shipment, _info: GraphQLResolveInfo) -> str:
        return public_status_for(root)

    @staticmethod
    def resolve_public_status_label(root: Shipment, _info: GraphQLResolveInfo) -> str:
        return public_status_label(root)

    @staticmethod
    def resolve_order_number(root: Shipment, _info: GraphQLResolveInfo) -> str:
        return root.order.number

    @staticmethod
    def resolve_seller(root: Shipment, _info: GraphQLResolveInfo) -> dict[str, str]:
        organisation = root.organisation
        return {
            "name": organisation.name,
            "phone": organisation.phone,
            "business_email": organisation.business_email,
        }

    @staticmethod
    def resolve_lines(root: Shipment, _info: GraphQLResolveInfo) -> list[Any]:
        return list(root.order.items.all())

    @staticmethod
    def resolve_timeline(root: Shipment, _info: GraphQLResolveInfo) -> list[ShipmentEvent]:
        return public_timeline(root)

    @staticmethod
    def resolve_confirmation(
        root: Shipment,
        _info: GraphQLResolveInfo,
    ) -> DeliveryConfirmation | None:
        return shipment_confirmation(root)

    @staticmethod
    def resolve_ticket(root: Shipment, _info: GraphQLResolveInfo) -> Ticket | None:
        return public_ticket_for(root)

    @staticmethod
    def resolve_buyer_contact(root: Shipment, _info: GraphQLResolveInfo) -> dict[str, str]:
        buyer = getattr(root.order, "buyer", None)
        return {
            "name": str(getattr(buyer, "name", "") or root.recipient_name or ""),
            "email": str(getattr(buyer, "email", "") or ""),
            "phone": str(getattr(buyer, "phone", "") or ""),
        }

    @staticmethod
    def resolve_allowed_actions(root: Shipment, _info: GraphQLResolveInfo) -> list[str]:
        return list(public_allowed_actions(root))

    @staticmethod
    def resolve_can_confirm(root: Shipment, _info: GraphQLResolveInfo) -> bool:
        return public_can_confirm(root)

    @staticmethod
    def resolve_token_expires_at(root: Shipment, _info: GraphQLResolveInfo) -> Any:
        return root.public_token_expires_at


class ShipmentType(graphene.ObjectType):  # type: ignore[misc]
    id = graphene.ID(required=True)
    number = graphene.String(required=True)
    status = graphene.String(required=True)
    status_label = graphene.String(required=True)
    delivery_mode = graphene.String(required=True)
    recipient_name = graphene.String(required=True)
    address_line = graphene.String(required=True)
    municipality = graphene.String(required=True)
    city = graphene.String(required=True)
    delivery_notes = graphene.String(required=True)
    carrier = graphene.String(required=True)
    tracking_code = graphene.String(required=True)
    tracking_url = graphene.String(required=True)
    next_action = graphene.String(required=True)
    allowed_actions = graphene.List(graphene.NonNull(graphene.String), required=True)
    dispatched_at = graphene.DateTime()
    delivered_at = graphene.DateTime()
    created_at = graphene.DateTime(required=True)
    updated_at = graphene.DateTime(required=True)
    order = graphene.Field(ShipmentOrderType, required=True)
    timeline = graphene.List(graphene.NonNull(ShipmentEventType), required=True)
    latest_label = graphene.Field(LabelDocumentType)
    public_url = graphene.String(required=True)
    confirmation = graphene.Field(DeliveryConfirmationType)
    active_ticket = graphene.Field(TicketType)
    tickets = graphene.List(graphene.NonNull(TicketType), required=True)
    follow_ups = graphene.List(graphene.NonNull(FollowUpType), required=True)
    next_follow_up = graphene.Field(FollowUpType)
    return_cases = graphene.List(graphene.NonNull(ReturnCaseType), required=True)

    @staticmethod
    def resolve_id(root: Shipment, _info: GraphQLResolveInfo) -> str:
        return str(root.public_id)

    @staticmethod
    def resolve_status_label(root: Shipment, _info: GraphQLResolveInfo) -> str:
        return STATUS_LABELS.get(root.status, root.status)

    @staticmethod
    def resolve_next_action(root: Shipment, _info: GraphQLResolveInfo) -> str:
        return seller_next_action(root)

    @staticmethod
    def resolve_allowed_actions(
        root: Shipment,
        _info: GraphQLResolveInfo,
    ) -> list[str]:
        return list(seller_allowed_actions(root))

    @staticmethod
    def resolve_timeline(
        root: Shipment,
        _info: GraphQLResolveInfo,
    ) -> list[ShipmentEvent]:
        return list(root.timeline.select_related("actor").all())

    @staticmethod
    def resolve_latest_label(
        root: Shipment,
        _info: GraphQLResolveInfo,
    ) -> LabelDocument | None:
        prefetched = getattr(root, "_prefetched_objects_cache", {}).get("labels")
        if prefetched is not None:
            return prefetched[0] if prefetched else None
        return root.labels.select_related("asset").first()

    @staticmethod
    def resolve_public_url(root: Shipment, _info: GraphQLResolveInfo) -> str:
        return public_shipment_url(root)

    @staticmethod
    def resolve_confirmation(
        root: Shipment,
        _info: GraphQLResolveInfo,
    ) -> DeliveryConfirmation | None:
        return shipment_confirmation(root)

    @staticmethod
    def resolve_active_ticket(root: Shipment, _info: GraphQLResolveInfo) -> Ticket | None:
        return active_ticket(root)

    @staticmethod
    def resolve_tickets(root: Shipment, _info: GraphQLResolveInfo) -> list[Ticket]:
        return list(root.tickets.all())

    @staticmethod
    def resolve_follow_ups(
        root: Shipment,
        _info: GraphQLResolveInfo,
    ) -> list[FollowUpSchedule]:
        return follow_ups_for(root)

    @staticmethod
    def resolve_next_follow_up(
        root: Shipment,
        _info: GraphQLResolveInfo,
    ) -> FollowUpSchedule | None:
        return next_follow_up(root)

    @staticmethod
    def resolve_return_cases(root: Shipment, _info: GraphQLResolveInfo) -> list[ReturnCase]:
        return return_cases_for(root)


class ShipmentConnectionType(graphene.ObjectType):  # type: ignore[misc]
    nodes = graphene.List(graphene.NonNull(ShipmentType), required=True)
    page_info = graphene.Field(PageInfoType, required=True)
    total_count = graphene.Int(required=True)


class ShipmentFilterInput(graphene.InputObjectType):  # type: ignore[misc]
    search = graphene.String()
    statuses = graphene.List(graphene.NonNull(graphene.String))
    attention = graphene.Boolean()
    delivery_mode = graphene.String()


class UpdateShipmentInput(graphene.InputObjectType):  # type: ignore[misc]
    carrier = graphene.String()
    tracking_code = graphene.String()
    tracking_url = graphene.String()
    comment = graphene.String()
    internal_note = graphene.Boolean()


class ShippingQuery(graphene.ObjectType):  # type: ignore[misc]
    shipping_dashboard = graphene.Field(ShippingDashboardType, required=True)
    shipments = graphene.Field(
        ShipmentConnectionType,
        required=True,
        first=graphene.Int(),
        after=graphene.String(),
        filter=graphene.Argument(ShipmentFilterInput),
    )
    shipment = graphene.Field(ShipmentType, id=graphene.ID(required=True))
    ticket = graphene.Field(TicketType, id=graphene.ID(required=True))
    shipment_timeline = graphene.List(
        graphene.NonNull(ShipmentEventType),
        required=True,
        id=graphene.ID(required=True),
    )
    public_shipment = graphene.Field(
        PublicShipmentType,
        token=graphene.String(required=True),
    )

    @staticmethod
    def resolve_shipping_dashboard(
        _root: object,
        info: GraphQLResolveInfo,
    ) -> ShippingDashboard:
        try:
            return shipping_dashboard(context_from_info(info))
        except DomainError as exc:
            raise graphql_error(info, exc) from exc

    @staticmethod
    def resolve_shipments(
        _root: object,
        info: GraphQLResolveInfo,
        first: int | None = None,
        after: str | None = None,
        filter: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        try:
            page = paginated_shipments(
                context_from_info(info),
                first=first,
                after=after,
                filters=_shipment_filter(filter),
            )
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return {
            "nodes": page.items,
            "page_info": _page_info(page),
            "total_count": page.total_count,
        }

    @staticmethod
    def resolve_shipment(
        _root: object,
        info: GraphQLResolveInfo,
        id: str,
    ) -> Shipment:
        try:
            return shipment_for_context(context_from_info(info), _uuid_or_not_found(id))
        except DomainError as exc:
            raise graphql_error(info, exc) from exc

    @staticmethod
    def resolve_ticket(
        _root: object,
        info: GraphQLResolveInfo,
        id: str,
    ) -> Ticket:
        try:
            return ticket_for_context(context_from_info(info), _uuid_or_not_found(id))
        except DomainError as exc:
            raise graphql_error(info, exc) from exc

    @staticmethod
    def resolve_shipment_timeline(
        _root: object,
        info: GraphQLResolveInfo,
        id: str,
    ) -> list[ShipmentEvent]:
        try:
            return shipment_timeline(context_from_info(info), _uuid_or_not_found(id))
        except DomainError as exc:
            raise graphql_error(info, exc) from exc

    @staticmethod
    def resolve_public_shipment(
        _root: object,
        info: GraphQLResolveInfo,
        token: str,
    ) -> Shipment:
        try:
            _public_guard(info, token=token, action="read")
            return public_shipment_for_token(token)
        except DomainError as exc:
            raise graphql_error(info, exc) from exc


class UpdateShipment(graphene.Mutation):  # type: ignore[misc]
    class Arguments:
        shipment_id = graphene.ID(required=True)
        input = graphene.Argument(UpdateShipmentInput, required=True)
        idempotency_key = graphene.String(required=True)

    shipment = graphene.Field(ShipmentType, required=True)
    replayed = graphene.Boolean(required=True)

    @staticmethod
    def mutate(
        _root: object,
        info: GraphQLResolveInfo,
        shipment_id: str,
        input: dict[str, Any],
        idempotency_key: str,
    ) -> UpdateShipment:
        try:
            result = update_shipment(
                context=context_from_info(info),
                shipment_id=_uuid_or_not_found(shipment_id),
                payload=_update_payload(input),
                idempotency_key=idempotency_key,
                correlation_id=_correlation_id(info),
            )
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return UpdateShipment(shipment=result.shipment, replayed=result.replayed)


class MarkShipmentDispatched(graphene.Mutation):  # type: ignore[misc]
    class Arguments:
        shipment_id = graphene.ID(required=True)
        comment = graphene.String()
        idempotency_key = graphene.String(required=True)

    shipment = graphene.Field(ShipmentType, required=True)
    replayed = graphene.Boolean(required=True)

    @staticmethod
    def mutate(
        _root: object,
        info: GraphQLResolveInfo,
        shipment_id: str,
        idempotency_key: str,
        comment: str = "",
    ) -> MarkShipmentDispatched:
        try:
            result = mark_shipment_dispatched(
                context=context_from_info(info),
                shipment_id=_uuid_or_not_found(shipment_id),
                comment=comment,
                idempotency_key=idempotency_key,
                correlation_id=_correlation_id(info),
            )
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return MarkShipmentDispatched(
            shipment=result.shipment,
            replayed=result.replayed,
        )


class GenerateShipmentLabel(graphene.Mutation):  # type: ignore[misc]
    class Arguments:
        shipment_id = graphene.ID(required=True)
        idempotency_key = graphene.String(required=True)

    label = graphene.Field(LabelDocumentType, required=True)
    shipment = graphene.Field(ShipmentType, required=True)
    replayed = graphene.Boolean(required=True)

    @staticmethod
    def mutate(
        _root: object,
        info: GraphQLResolveInfo,
        shipment_id: str,
        idempotency_key: str,
    ) -> GenerateShipmentLabel:
        try:
            result = generate_shipment_label(
                context=context_from_info(info),
                shipment_id=_uuid_or_not_found(shipment_id),
                idempotency_key=idempotency_key,
                correlation_id=_correlation_id(info),
            )
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return GenerateShipmentLabel(
            label=result.label,
            shipment=result.shipment,
            replayed=result.replayed,
        )


class OpenPublicTicketInput(graphene.InputObjectType):  # type: ignore[misc]
    category = graphene.String(required=True)
    message = graphene.String(required=True)
    contact_name = graphene.String()
    contact_email = graphene.String()
    contact_phone = graphene.String()
    turnstile_token = graphene.String()


class OpenPublicTicket(graphene.Mutation):  # type: ignore[misc]
    class Arguments:
        token = graphene.String(required=True)
        input = graphene.Argument(OpenPublicTicketInput, required=True)
        idempotency_key = graphene.String(required=True)

    ticket = graphene.Field(TicketType, required=True)
    replayed = graphene.Boolean(required=True)

    @staticmethod
    def mutate(
        _root: object,
        info: GraphQLResolveInfo,
        token: str,
        input: dict[str, Any],
        idempotency_key: str,
    ) -> OpenPublicTicket:
        try:
            _public_guard(
                info,
                token=token,
                action="ticket",
                turnstile_token=str(input.get("turnstile_token") or ""),
                require_turnstile=True,
            )
            result = open_public_ticket(
                token=token,
                payload=input,
                idempotency_key=idempotency_key,
                correlation_id=_correlation_id(info),
            )
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return OpenPublicTicket(ticket=result.ticket, replayed=result.replayed)


class SendTicketMessage(graphene.Mutation):  # type: ignore[misc]
    class Arguments:
        ticket_id = graphene.ID(required=True)
        body = graphene.String(required=True)
        idempotency_key = graphene.String(required=True)
        token = graphene.String()
        turnstile_token = graphene.String()

    ticket = graphene.Field(TicketType, required=True)
    replayed = graphene.Boolean(required=True)

    @staticmethod
    def mutate(
        _root: object,
        info: GraphQLResolveInfo,
        ticket_id: str,
        body: str,
        idempotency_key: str,
        token: str = "",
        turnstile_token: str = "",
    ) -> SendTicketMessage:
        try:
            if token:
                _public_guard(
                    info,
                    token=token,
                    action="ticket",
                    turnstile_token=turnstile_token,
                    require_turnstile=True,
                )
                result = send_ticket_message(
                    ticket_id=_uuid_or_not_found(ticket_id),
                    body=body,
                    idempotency_key=idempotency_key,
                    token=token,
                    correlation_id=_correlation_id(info),
                )
            else:
                result = send_ticket_message(
                    ticket_id=_uuid_or_not_found(ticket_id),
                    body=body,
                    idempotency_key=idempotency_key,
                    context=context_from_info(info),
                    correlation_id=_correlation_id(info),
                )
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return SendTicketMessage(ticket=result.ticket, replayed=result.replayed)


class ResolveTicket(graphene.Mutation):  # type: ignore[misc]
    class Arguments:
        ticket_id = graphene.ID(required=True)
        comment = graphene.String()
        idempotency_key = graphene.String(required=True)

    ticket = graphene.Field(TicketType, required=True)
    replayed = graphene.Boolean(required=True)

    @staticmethod
    def mutate(
        _root: object,
        info: GraphQLResolveInfo,
        ticket_id: str,
        idempotency_key: str,
        comment: str = "",
    ) -> ResolveTicket:
        try:
            result = resolve_ticket(
                context=context_from_info(info),
                ticket_id=_uuid_or_not_found(ticket_id),
                comment=comment,
                idempotency_key=idempotency_key,
                correlation_id=_correlation_id(info),
            )
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return ResolveTicket(ticket=result.ticket, replayed=result.replayed)


class RescheduleFollowUp(graphene.Mutation):  # type: ignore[misc]
    class Arguments:
        follow_up_id = graphene.ID(required=True)
        due_at = graphene.DateTime(required=True)
        reason = graphene.String(required=True)
        idempotency_key = graphene.String(required=True)

    follow_up = graphene.Field(FollowUpType, required=True)
    shipment = graphene.Field(ShipmentType, required=True)
    replayed = graphene.Boolean(required=True)

    @staticmethod
    def mutate(
        _root: object,
        info: GraphQLResolveInfo,
        follow_up_id: str,
        due_at: datetime,
        reason: str,
        idempotency_key: str,
    ) -> RescheduleFollowUp:
        try:
            context = context_from_info(info)
            result = reschedule_follow_up(
                context=context,
                follow_up_id=_uuid_or_not_found(follow_up_id),
                due_at=due_at,
                reason=reason,
                idempotency_key=idempotency_key,
                correlation_id=_correlation_id(info),
            )
            shipment = shipment_for_context(context, result.follow_up.shipment.public_id)
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return RescheduleFollowUp(
            follow_up=result.follow_up,
            shipment=shipment,
            replayed=result.replayed,
        )


class RegisterReturnCase(graphene.Mutation):  # type: ignore[misc]
    class Arguments:
        shipment_id = graphene.ID(required=True)
        kind = graphene.String(required=True)
        notes = graphene.String()
        idempotency_key = graphene.String(required=True)

    return_case = graphene.Field(ReturnCaseType, required=True)
    shipment = graphene.Field(ShipmentType, required=True)
    replayed = graphene.Boolean(required=True)

    @staticmethod
    def mutate(
        _root: object,
        info: GraphQLResolveInfo,
        shipment_id: str,
        kind: str,
        idempotency_key: str,
        notes: str = "",
    ) -> RegisterReturnCase:
        try:
            context = context_from_info(info)
            result = register_return_case(
                context=context,
                shipment_id=_uuid_or_not_found(shipment_id),
                kind=kind,
                notes=notes,
                idempotency_key=idempotency_key,
                correlation_id=_correlation_id(info),
            )
            shipment = shipment_for_context(context, result.return_case.shipment.public_id)
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return RegisterReturnCase(
            return_case=result.return_case,
            shipment=shipment,
            replayed=result.replayed,
        )


class ConfirmReturnToStock(graphene.Mutation):  # type: ignore[misc]
    class Arguments:
        return_case_id = graphene.ID(required=True)
        idempotency_key = graphene.String(required=True)

    return_case = graphene.Field(ReturnCaseType, required=True)
    shipment = graphene.Field(ShipmentType, required=True)
    replayed = graphene.Boolean(required=True)

    @staticmethod
    def mutate(
        _root: object,
        info: GraphQLResolveInfo,
        return_case_id: str,
        idempotency_key: str,
    ) -> ConfirmReturnToStock:
        try:
            context = context_from_info(info)
            result = confirm_return_to_stock(
                context=context,
                return_case_id=_uuid_or_not_found(return_case_id),
                idempotency_key=idempotency_key,
                correlation_id=_correlation_id(info),
            )
            shipment = shipment_for_context(context, result.return_case.shipment.public_id)
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return ConfirmReturnToStock(
            return_case=result.return_case,
            shipment=shipment,
            replayed=result.replayed,
        )


class ShippingMutation(graphene.ObjectType):  # type: ignore[misc]
    update_shipment = UpdateShipment.Field(required=True)
    mark_shipment_dispatched = MarkShipmentDispatched.Field(required=True)
    generate_shipment_label = GenerateShipmentLabel.Field(required=True)
    open_public_ticket = OpenPublicTicket.Field(required=True)
    send_ticket_message = SendTicketMessage.Field(required=True)
    resolve_ticket = ResolveTicket.Field(required=True)
    reschedule_follow_up = RescheduleFollowUp.Field(required=True)
    register_return_case = RegisterReturnCase.Field(required=True)
    confirm_return_to_stock = ConfirmReturnToStock.Field(required=True)
