"""GraphQL shipping operations: dashboard, list, detail, dispatch registration and label."""

from __future__ import annotations

import uuid
from typing import Any

import graphene
from django.utils import timezone
from graphql import GraphQLResolveInfo

from apps.media_assets.services import private_download_url
from tenda.errors import DomainError, ResourceNotFound
from tenda.graphql import context_from_info, graphql_error

from .models import LabelDocument, Shipment
from .selectors import (
    STATUS_LABELS,
    ShipmentListFilter,
    ShippingDashboard,
    buyer_email_for,
    paginated_shipments,
    seller_allowed_actions,
    shipment_for_context,
    shipping_dashboard,
)
from .services import generate_shipment_label, register_shipment_dispatch


def _correlation_id(info: GraphQLResolveInfo) -> str:
    return str(getattr(info.context, "correlation_id", ""))


def _uuid_or_not_found(value: object) -> uuid.UUID:
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError) as exc:
        raise ResourceNotFound() from exc


def _page_info(page: Any) -> dict[str, Any]:
    return {
        "has_next_page": page.has_next_page,
        "end_cursor": page.end_cursor,
    }


def _shipment_filter(raw: dict[str, Any] | None) -> ShipmentListFilter:
    data = raw or {}
    statuses = tuple(str(item) for item in (data.get("statuses") or ()) if item)
    return ShipmentListFilter(
        search=str(data.get("search") or ""),
        statuses=statuses,
        delivery_mode=str(data.get("delivery_mode") or ""),
    )


def _dispatch_payload(raw: dict[str, Any] | None) -> dict[str, Any]:
    data = raw or {}
    return {
        "carrier": data.get("carrier"),
        "tracking_code": data.get("tracking_code"),
        "tracking_url": data.get("tracking_url"),
        "note": data.get("note"),
    }


class PageInfoType(graphene.ObjectType):  # type: ignore[misc]
    has_next_page = graphene.Boolean(required=True)
    end_cursor = graphene.String(required=True)


class ShippingDashboardType(graphene.ObjectType):  # type: ignore[misc]
    total = graphene.Int(required=True)
    pending = graphene.Int(required=True)
    dispatched = graphene.Int(required=True)
    delivered = graphene.Int(required=True)


class ShipmentOrderType(graphene.ObjectType):  # type: ignore[misc]
    id = graphene.ID(required=True)
    number = graphene.String(required=True)
    status = graphene.String(required=True)

    @staticmethod
    def resolve_id(root: Any, _info: GraphQLResolveInfo) -> str:
        return str(root.public_id)


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


class ShipmentType(graphene.ObjectType):  # type: ignore[misc]
    id = graphene.ID(required=True)
    number = graphene.String(required=True)
    status = graphene.String(required=True)
    status_label = graphene.String(required=True)
    delivery_mode = graphene.String(required=True)
    recipient_name = graphene.String(required=True)
    recipient_tax_id = graphene.String(required=True)
    address_line = graphene.String(required=True)
    commune = graphene.String(required=True)
    region = graphene.String(required=True)
    delivery_notes = graphene.String(required=True)
    carrier = graphene.String(required=True)
    tracking_code = graphene.String(required=True)
    tracking_url = graphene.String(required=True)
    dispatch_note = graphene.String(required=True)
    buyer_email = graphene.String(required=True)
    allowed_actions = graphene.List(graphene.NonNull(graphene.String), required=True)
    dispatched_at = graphene.DateTime()
    delivered_at = graphene.DateTime()
    created_at = graphene.DateTime(required=True)
    updated_at = graphene.DateTime(required=True)
    order = graphene.Field(ShipmentOrderType, required=True)
    latest_label = graphene.Field(LabelDocumentType)

    @staticmethod
    def resolve_id(root: Shipment, _info: GraphQLResolveInfo) -> str:
        return str(root.public_id)

    @staticmethod
    def resolve_status_label(root: Shipment, _info: GraphQLResolveInfo) -> str:
        return STATUS_LABELS.get(root.status, root.status)

    @staticmethod
    def resolve_buyer_email(root: Shipment, _info: GraphQLResolveInfo) -> str:
        return buyer_email_for(root)

    @staticmethod
    def resolve_allowed_actions(
        root: Shipment,
        _info: GraphQLResolveInfo,
    ) -> list[str]:
        return list(seller_allowed_actions(root))

    @staticmethod
    def resolve_latest_label(
        root: Shipment,
        _info: GraphQLResolveInfo,
    ) -> LabelDocument | None:
        prefetched = getattr(root, "_prefetched_objects_cache", {}).get("labels")
        if prefetched is not None:
            return prefetched[0] if prefetched else None
        return root.labels.select_related("asset").first()


class ShipmentConnectionType(graphene.ObjectType):  # type: ignore[misc]
    nodes = graphene.List(graphene.NonNull(ShipmentType), required=True)
    page_info = graphene.Field(PageInfoType, required=True)
    total_count = graphene.Int(required=True)


class ShipmentFilterInput(graphene.InputObjectType):  # type: ignore[misc]
    search = graphene.String()
    statuses = graphene.List(graphene.NonNull(graphene.String))
    delivery_mode = graphene.String()


class RegisterShipmentDispatchInput(graphene.InputObjectType):  # type: ignore[misc]
    carrier = graphene.String()
    tracking_code = graphene.String()
    tracking_url = graphene.String()
    note = graphene.String()


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


class RegisterShipmentDispatch(graphene.Mutation):  # type: ignore[misc]
    class Arguments:
        shipment_id = graphene.ID(required=True)
        input = graphene.Argument(RegisterShipmentDispatchInput, required=True)
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
    ) -> RegisterShipmentDispatch:
        try:
            result = register_shipment_dispatch(
                context=context_from_info(info),
                shipment_id=_uuid_or_not_found(shipment_id),
                payload=_dispatch_payload(input),
                idempotency_key=idempotency_key,
                correlation_id=_correlation_id(info),
            )
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return RegisterShipmentDispatch(shipment=result.shipment, replayed=result.replayed)


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


class ShippingMutation(graphene.ObjectType):  # type: ignore[misc]
    register_shipment_dispatch = RegisterShipmentDispatch.Field(required=True)
    generate_shipment_label = GenerateShipmentLabel.Field(required=True)
