"""GraphQL sales/public checkout/BAL-01 contract over domain services."""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

import graphene
from graphql import GraphQLResolveInfo

from apps.inventory.models import CustomFieldDefinition, ProductMediaAttachment
from apps.media_assets.models import MediaAsset
from apps.media_assets.services import private_download_url
from apps.organisations.permissions import OrganisationPermission, require_permission
from apps.shipping.graphql import LabelDocumentType
from apps.shipping.models import LabelDocument, Shipment
from apps.users.services import enforce_auth_rate_limit
from tenda.antibot import verify_turnstile
from tenda.errors import DomainError, ResourceNotFound
from tenda.graphql import context_from_info, graphql_error, request_from_info

from .models import (
    BuyerSnapshot,
    Order,
    OrderEvent,
    OrderItem,
    Payment,
    PaymentProof,
    ReconciliationIssue,
    SellerPaymentConnection,
)
from .order_services import (
    cancel_order,
    confirm_manual_payment,
    create_order,
    initiate_mercado_pago_checkout,
    public_order_for_token,
    public_order_media_url,
    public_order_url,
    publish_order_link,
    refund_payment,
    reissue_bank_transfer_offer,
    resend_order_link,
    restore_order,
    review_payment_proof,
    send_offer_link,
    set_buyer_details,
    update_order_buyer,
)
from .selectors import (
    STATUS_LABELS,
    BalanceBreakdownRow,
    BalanceFilter,
    OrderListFilter,
    SalesBalance,
    SalesDashboard,
    can_view_costs,
    order_for_context,
    paginated_orders,
    paginated_reconciliation_issues,
    public_allowed_actions,
    sales_balance,
    sales_balance_breakdown,
    sales_dashboard,
    seller_allowed_actions,
    seller_next_action,
)
from .services import (
    PaymentCommissionConfiguration,
    disconnect_seller_payment_connection,
    payment_commission_configuration,
    seller_payment_connection,
    start_seller_payment_connection,
)


def _correlation_id(info: GraphQLResolveInfo) -> str:
    return str(getattr(info.context, "correlation_id", ""))


def _uuid_or_not_found(value: object) -> uuid.UUID:
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError) as exc:
        raise ResourceNotFound() from exc


def _money(value: Decimal | int | None) -> str | None:
    return None if value is None else format(Decimal(value), "f")


def _page_info(page: Any) -> dict[str, Any]:
    return {
        "has_next_page": page.has_next_page,
        "end_cursor": page.end_cursor,
    }


def _public_guard(
    info: GraphQLResolveInfo,
    *,
    token: str,
    action: str,
    turnstile_token: str = "",
) -> None:
    request = request_from_info(info)
    remote_ip = str(request.META.get("REMOTE_ADDR", ""))[:64]
    enforce_auth_rate_limit(
        action=f"public_order_{action}",
        identity=token,
        ip_address=remote_ip,
    )
    if turnstile_token:
        verify_turnstile(token=turnstile_token, remote_ip=remote_ip)


class PageInfoType(graphene.ObjectType):  # type: ignore[misc]
    has_next_page = graphene.Boolean(required=True)
    end_cursor = graphene.String(required=True)


class SellerPaymentConnectionType(graphene.ObjectType):  # type: ignore[misc]
    id = graphene.ID(required=True)
    provider = graphene.String(required=True)
    status = graphene.String(required=True)
    provider_account_id = graphene.String(required=True)
    scopes = graphene.List(graphene.NonNull(graphene.String), required=True)
    token_expires_at = graphene.DateTime()
    connected_at = graphene.DateTime()
    disconnected_at = graphene.DateTime()

    @staticmethod
    def resolve_id(root: SellerPaymentConnection, _info: GraphQLResolveInfo) -> str:
        return str(root.public_id)


class PaymentCommissionConfigurationType(graphene.ObjectType):  # type: ignore[misc]
    mode = graphene.String(required=True)
    rate = graphene.String(required=True)
    minimum = graphene.Int(required=True)
    zero_fee_enabled = graphene.Boolean(required=True)

    @staticmethod
    def resolve_mode(
        root: PaymentCommissionConfiguration,
        _info: GraphQLResolveInfo,
    ) -> str:
        return root.mode.value

    @staticmethod
    def resolve_rate(
        root: PaymentCommissionConfiguration,
        _info: GraphQLResolveInfo,
    ) -> str:
        return str(root.rate)


class PaymentConnectionStartType(graphene.ObjectType):  # type: ignore[misc]
    authorization_url = graphene.String(required=True)
    expires_at = graphene.DateTime(required=True)


class BuyerSnapshotType(graphene.ObjectType):  # type: ignore[misc]
    name = graphene.String(required=True)
    email = graphene.String(required=True)
    phone = graphene.String(required=True)
    recipient_name = graphene.String(required=True)
    recipient_tax_id = graphene.String(required=True)
    address_line = graphene.String(required=True)
    commune = graphene.String(required=True)
    region = graphene.String(required=True)
    delivery_notes = graphene.String(required=True)
    tax_id = graphene.String(required=True)
    tax_name = graphene.String(required=True)
    tax_activity = graphene.String(required=True)
    tax_address = graphene.String(required=True)
    tax_commune = graphene.String(required=True)
    tax_region = graphene.String(required=True)
    tax_email = graphene.String(required=True)
    completed_at = graphene.DateTime()


class OrderItemType(graphene.ObjectType):  # type: ignore[misc]
    id = graphene.ID(required=True)
    line_number = graphene.Int(required=True)
    product_id = graphene.ID(required=True)
    product_name = graphene.String(required=True)
    quantity = graphene.Int(required=True)
    unit_sale_price = graphene.String(required=True)
    unit_cost_snapshot = graphene.String()
    line_total = graphene.String(required=True)
    currency = graphene.String(required=True)

    @staticmethod
    def resolve_id(root: OrderItem, _info: GraphQLResolveInfo) -> str:
        return str(root.public_id)

    @staticmethod
    def resolve_product_id(root: OrderItem, _info: GraphQLResolveInfo) -> str:
        return str(root.product.public_id)

    @staticmethod
    def resolve_unit_sale_price(root: OrderItem, _info: GraphQLResolveInfo) -> str:
        return str(root.unit_sale_price)

    @staticmethod
    def resolve_unit_cost_snapshot(
        root: OrderItem,
        info: GraphQLResolveInfo,
    ) -> str | None:
        context = context_from_info(info)
        if not can_view_costs(context):
            return None
        return _money(root.unit_cost_snapshot)

    @staticmethod
    def resolve_line_total(root: OrderItem, _info: GraphQLResolveInfo) -> str:
        return str(root.line_total)


class PublicProductAttributeType(graphene.ObjectType):  # type: ignore[misc]
    label = graphene.String(required=True)
    value = graphene.String(required=True)


def _public_line_photos(item: OrderItem) -> list[str]:
    attachments = list(
        ProductMediaAttachment.objects.filter(
            product=item.product,
            asset__status=MediaAsset.Status.READY,
        )
        .select_related("asset")
        .order_by("position", "id")
    )
    primary_id = getattr(item.product, "primary_image_id", None)
    if primary_id:
        attachments.sort(
            key=lambda attachment: (
                0 if attachment.asset_id == primary_id else 1,
                attachment.position,
                attachment.id,
            )
        )
    return [
        public_order_media_url(item.order, attachment.asset.public_id)
        for attachment in attachments
    ]


def _public_line_attributes(item: OrderItem) -> list[dict[str, str]]:
    extras = dict(item.product.extra_attributes or {})
    fields = CustomFieldDefinition.objects.filter(
        inventory_id=item.product.inventory_id,
        is_active=True,
        is_visible=True,
    ).order_by("position", "id")
    attributes: list[dict[str, str]] = []
    for field in fields:
        value = extras.get(field.key)
        if value is None or value == "":
            continue
        if isinstance(value, bool):
            display = "Sí" if value else "No"
        else:
            display = str(value)
        attributes.append({"label": field.label, "value": display})
    return attributes


class PublicOrderItemType(graphene.ObjectType):  # type: ignore[misc]
    id = graphene.ID(required=True)
    line_number = graphene.Int(required=True)
    product_name = graphene.String(required=True)
    quantity = graphene.Int(required=True)
    unit_sale_price = graphene.String(required=True)
    line_total = graphene.String(required=True)
    currency = graphene.String(required=True)
    image_url = graphene.String()
    photos = graphene.List(graphene.NonNull(graphene.String), required=True)
    attributes = graphene.List(graphene.NonNull(PublicProductAttributeType), required=True)

    @staticmethod
    def resolve_id(root: OrderItem, _info: GraphQLResolveInfo) -> str:
        return str(root.public_id)

    @staticmethod
    def resolve_unit_sale_price(root: OrderItem, _info: GraphQLResolveInfo) -> str:
        return str(root.unit_sale_price)

    @staticmethod
    def resolve_line_total(root: OrderItem, _info: GraphQLResolveInfo) -> str:
        return str(root.line_total)

    @staticmethod
    def resolve_photos(root: OrderItem, _info: GraphQLResolveInfo) -> list[str]:
        return _public_line_photos(root)

    @staticmethod
    def resolve_image_url(root: OrderItem, _info: GraphQLResolveInfo) -> str | None:
        photos = _public_line_photos(root)
        return photos[0] if photos else None

    @staticmethod
    def resolve_attributes(
        root: OrderItem,
        _info: GraphQLResolveInfo,
    ) -> list[dict[str, str]]:
        return _public_line_attributes(root)


class PaymentProofType(graphene.ObjectType):  # type: ignore[misc]
    id = graphene.ID(required=True)
    status = graphene.String(required=True)
    file_name = graphene.String(required=True)
    content_type = graphene.String(required=True)
    signed_url = graphene.String()
    uploaded_at = graphene.DateTime()
    reviewed_at = graphene.DateTime()
    rejection_reason = graphene.String(required=True)

    @staticmethod
    def resolve_id(root: PaymentProof, _info: GraphQLResolveInfo) -> str:
        return str(root.public_id)

    @staticmethod
    def resolve_file_name(root: PaymentProof, _info: GraphQLResolveInfo) -> str:
        return root.asset.original_name

    @staticmethod
    def resolve_content_type(root: PaymentProof, _info: GraphQLResolveInfo) -> str:
        return root.asset.content_type

    @staticmethod
    def resolve_signed_url(
        root: PaymentProof,
        info: GraphQLResolveInfo,
    ) -> str | None:
        if root.asset.status != root.asset.Status.READY:
            return None
        return private_download_url(
            context=context_from_info(info),
            public_id=root.asset.public_id,
        )


class PaymentType(graphene.ObjectType):  # type: ignore[misc]
    id = graphene.ID(required=True)
    method = graphene.String(required=True)
    status = graphene.String(required=True)
    amount = graphene.String(required=True)
    currency = graphene.String(required=True)
    provider = graphene.String(required=True)
    provider_preference_id = graphene.String(required=True)
    provider_payment_id = graphene.String(required=True)
    provider_status = graphene.String(required=True)
    provider_status_detail = graphene.String(required=True)
    fee_requested = graphene.String(required=True)
    fee_reported = graphene.String()
    net_received = graphene.String()
    refunded_amount = graphene.String(required=True)
    paid_at = graphene.DateTime()
    refunded_at = graphene.DateTime()
    note = graphene.String(required=True)
    proof = graphene.Field(PaymentProofType)

    @staticmethod
    def resolve_id(root: Payment, _info: GraphQLResolveInfo) -> str:
        return str(root.public_id)

    @staticmethod
    def resolve_amount(root: Payment, _info: GraphQLResolveInfo) -> str:
        return str(root.amount)

    @staticmethod
    def resolve_fee_requested(root: Payment, _info: GraphQLResolveInfo) -> str:
        return str(root.fee_requested)

    @staticmethod
    def resolve_fee_reported(root: Payment, _info: GraphQLResolveInfo) -> str | None:
        return _money(root.fee_reported)

    @staticmethod
    def resolve_net_received(root: Payment, _info: GraphQLResolveInfo) -> str | None:
        return _money(root.net_received)

    @staticmethod
    def resolve_refunded_amount(root: Payment, _info: GraphQLResolveInfo) -> str:
        return str(root.refunded_amount)

    @staticmethod
    def resolve_note(root: Payment, _info: GraphQLResolveInfo) -> str:
        return root.manual_note

    @staticmethod
    def resolve_proof(
        root: Payment,
        _info: GraphQLResolveInfo,
    ) -> PaymentProof | None:
        try:
            return root.proof
        except PaymentProof.DoesNotExist:
            return None


class PublicPaymentType(graphene.ObjectType):  # type: ignore[misc]
    method = graphene.String(required=True)
    status = graphene.String(required=True)
    amount = graphene.String(required=True)
    currency = graphene.String(required=True)
    proof_status = graphene.String()

    @staticmethod
    def resolve_amount(root: Payment, _info: GraphQLResolveInfo) -> str:
        return str(root.amount)

    @staticmethod
    def resolve_proof_status(root: Payment, _info: GraphQLResolveInfo) -> str | None:
        try:
            return root.proof.status
        except PaymentProof.DoesNotExist:
            return None


class OrderEventType(graphene.ObjectType):  # type: ignore[misc]
    id = graphene.ID(required=True)
    event_type = graphene.String(required=True)
    from_status = graphene.String(required=True)
    to_status = graphene.String(required=True)
    title = graphene.String(required=True)
    detail = graphene.String(required=True)
    metadata = graphene.JSONString(required=True)
    created_at = graphene.DateTime(required=True)

    @staticmethod
    def resolve_id(root: OrderEvent, _info: GraphQLResolveInfo) -> str:
        return str(root.public_id)


class ReconciliationIssueType(graphene.ObjectType):  # type: ignore[misc]
    id = graphene.ID(required=True)
    kind = graphene.String(required=True)
    status = graphene.String(required=True)
    summary = graphene.String(required=True)
    details = graphene.JSONString(required=True)
    retry_count = graphene.Int(required=True)
    last_attempt_at = graphene.DateTime()
    created_at = graphene.DateTime(required=True)
    resolved_at = graphene.DateTime()
    order_id = graphene.ID()
    order_number = graphene.String()
    provider_reference = graphene.String()
    can_retry = graphene.Boolean(required=True)

    @staticmethod
    def resolve_id(root: ReconciliationIssue, _info: GraphQLResolveInfo) -> str:
        return str(root.public_id)

    @staticmethod
    def resolve_order_id(root: ReconciliationIssue, _info: GraphQLResolveInfo) -> str | None:
        order = root.order
        return str(order.public_id) if order is not None else None

    @staticmethod
    def resolve_order_number(
        root: ReconciliationIssue,
        _info: GraphQLResolveInfo,
    ) -> str | None:
        order = root.order
        return order.number if order is not None else None

    @staticmethod
    def resolve_provider_reference(
        root: ReconciliationIssue,
        _info: GraphQLResolveInfo,
    ) -> str:
        payment = root.payment
        if payment is not None:
            return payment.provider_payment_id
        event = root.webhook_event
        if event is not None:
            return event.provider_event_id
        return ""

    @staticmethod
    def resolve_can_retry(root: ReconciliationIssue, _info: GraphQLResolveInfo) -> bool:
        return root.status in {
            ReconciliationIssue.Status.OPEN,
            ReconciliationIssue.Status.RETRYING,
        }


class ReconciliationIssueConnectionType(graphene.ObjectType):  # type: ignore[misc]
    nodes = graphene.List(graphene.NonNull(ReconciliationIssueType), required=True)
    page_info = graphene.Field(PageInfoType, required=True)
    total_count = graphene.Int(required=True)


class OrderPermissionsType(graphene.ObjectType):  # type: ignore[misc]
    can_view_costs = graphene.Boolean(required=True)
    allowed_actions = graphene.List(graphene.NonNull(graphene.String), required=True)


class OrderShipmentType(graphene.ObjectType):  # type: ignore[misc]
    id = graphene.ID(required=True)
    latest_label = graphene.Field(LabelDocumentType)

    @staticmethod
    def resolve_id(root: Shipment, _info: GraphQLResolveInfo) -> str:
        return str(root.public_id)

    @staticmethod
    def resolve_latest_label(
        root: Shipment,
        _info: GraphQLResolveInfo,
    ) -> LabelDocument | None:
        prefetched = getattr(root, "_prefetched_objects_cache", {}).get("labels")
        if prefetched is not None:
            return prefetched[0] if prefetched else None
        return root.labels.select_related("asset").first()


class OrderType(graphene.ObjectType):  # type: ignore[misc]
    id = graphene.ID(required=True)
    number = graphene.String(required=True)
    status = graphene.String(required=True)
    status_label = graphene.String(required=True)
    delivery_mode = graphene.String(required=True)
    payment_method = graphene.String(required=True)
    currency = graphene.String(required=True)
    total = graphene.String(required=True)
    lines = graphene.List(graphene.NonNull(OrderItemType), required=True)
    buyer = graphene.Field(BuyerSnapshotType)
    payment = graphene.Field(PaymentType)
    timeline = graphene.List(graphene.NonNull(OrderEventType), required=True)
    reservation_expires_at = graphene.DateTime(required=True)
    public_token_expires_at = graphene.DateTime(required=True)
    public_url = graphene.String(required=True)
    published_at = graphene.DateTime()
    permissions = graphene.Field(OrderPermissionsType, required=True)
    allowed_actions = graphene.List(graphene.NonNull(graphene.String), required=True)
    next_action = graphene.String(required=True)
    reconciliation_status = graphene.String(required=True)
    reconciliation_required = graphene.Boolean(required=True)
    reconciliation_issues = graphene.List(
        graphene.NonNull(ReconciliationIssueType),
        required=True,
    )
    created_at = graphene.DateTime(required=True)
    updated_at = graphene.DateTime(required=True)
    paid_at = graphene.DateTime()
    refunded_at = graphene.DateTime()
    shipment = graphene.Field(OrderShipmentType)

    @staticmethod
    def resolve_id(root: Order, _info: GraphQLResolveInfo) -> str:
        return str(root.public_id)

    @staticmethod
    def resolve_status_label(root: Order, _info: GraphQLResolveInfo) -> str:
        return STATUS_LABELS[root.status]

    @staticmethod
    def resolve_total(root: Order, _info: GraphQLResolveInfo) -> str:
        return str(root.total_amount)

    @staticmethod
    def resolve_lines(root: Order, _info: GraphQLResolveInfo) -> list[OrderItem]:
        return list(root.items.all())

    @staticmethod
    def resolve_buyer(
        root: Order,
        _info: GraphQLResolveInfo,
    ) -> BuyerSnapshot | None:
        try:
            return root.buyer
        except BuyerSnapshot.DoesNotExist:
            return None

    @staticmethod
    def resolve_payment(
        root: Order,
        _info: GraphQLResolveInfo,
    ) -> Payment | None:
        try:
            return root.payment
        except Payment.DoesNotExist:
            return None

    @staticmethod
    def resolve_timeline(root: Order, _info: GraphQLResolveInfo) -> list[OrderEvent]:
        return list(root.timeline.all())

    @staticmethod
    def resolve_public_url(root: Order, _info: GraphQLResolveInfo) -> str:
        return public_order_url(root)

    @staticmethod
    def resolve_permissions(
        root: Order,
        info: GraphQLResolveInfo,
    ) -> dict[str, Any]:
        context = context_from_info(info)
        return {
            "can_view_costs": can_view_costs(context),
            "allowed_actions": list(seller_allowed_actions(root)),
        }

    @staticmethod
    def resolve_allowed_actions(
        root: Order,
        _info: GraphQLResolveInfo,
    ) -> list[str]:
        return list(seller_allowed_actions(root))

    @staticmethod
    def resolve_next_action(root: Order, _info: GraphQLResolveInfo) -> str:
        return seller_next_action(root)

    @staticmethod
    def resolve_reconciliation_required(root: Order, _info: GraphQLResolveInfo) -> bool:
        return root.reconciliation_status != Order.ReconciliationStatus.OK

    @staticmethod
    def resolve_reconciliation_issues(
        root: Order,
        _info: GraphQLResolveInfo,
    ) -> list[ReconciliationIssue]:
        return list(root.reconciliation_issues.all())

    @staticmethod
    def resolve_shipment(root: Order, _info: GraphQLResolveInfo) -> Shipment | None:
        try:
            return root.shipment
        except Shipment.DoesNotExist:
            return None


class OrderConnectionType(graphene.ObjectType):  # type: ignore[misc]
    nodes = graphene.List(graphene.NonNull(OrderType), required=True)
    page_info = graphene.Field(PageInfoType, required=True)
    total_count = graphene.Int(required=True)


class PublicSellerType(graphene.ObjectType):  # type: ignore[misc]
    name = graphene.String(required=True)
    phone = graphene.String(required=True)
    business_email = graphene.String(required=True)
    logo_url = graphene.String()


class PublicBankDetailsType(graphene.ObjectType):  # type: ignore[misc]
    bank_name = graphene.String(required=True)
    account_type = graphene.String(required=True)
    account_type_label = graphene.String(required=True)
    account_number = graphene.String(required=True)
    tax_id = graphene.String(required=True)
    confirmation_email = graphene.String(required=True)


class PublicOrderType(graphene.ObjectType):  # type: ignore[misc]
    number = graphene.String(required=True)
    status = graphene.String(required=True)
    status_label = graphene.String(required=True)
    delivery_mode = graphene.String(required=True)
    payment_method = graphene.String(required=True)
    currency = graphene.String(required=True)
    total = graphene.String(required=True)
    lines = graphene.List(graphene.NonNull(PublicOrderItemType), required=True)
    buyer = graphene.Field(BuyerSnapshotType)
    payment = graphene.Field(PublicPaymentType)
    seller = graphene.Field(PublicSellerType, required=True)
    reservation_expires_at = graphene.DateTime(required=True)
    token_expires_at = graphene.DateTime(required=True)
    created_at = graphene.DateTime(required=True)
    is_expired = graphene.Boolean(required=True)
    allowed_actions = graphene.List(graphene.NonNull(graphene.String), required=True)
    reconciliation_status = graphene.String(required=True)
    payment_status = graphene.String()
    fee_amount = graphene.String()
    available_payment_methods = graphene.List(
        graphene.NonNull(graphene.String),
        required=True,
    )
    bank_transfer_instructions = graphene.String(required=True)
    bank_details = graphene.Field(PublicBankDetailsType)
    rejection_reason = graphene.String()

    @staticmethod
    def resolve_status_label(root: Order, _info: GraphQLResolveInfo) -> str:
        return STATUS_LABELS[root.status]

    @staticmethod
    def resolve_total(root: Order, _info: GraphQLResolveInfo) -> str:
        return str(root.total_amount)

    @staticmethod
    def resolve_lines(root: Order, _info: GraphQLResolveInfo) -> list[OrderItem]:
        return list(root.items.all())

    @staticmethod
    def resolve_buyer(
        root: Order,
        _info: GraphQLResolveInfo,
    ) -> BuyerSnapshot | None:
        try:
            return root.buyer
        except BuyerSnapshot.DoesNotExist:
            return None

    @staticmethod
    def resolve_payment(
        root: Order,
        _info: GraphQLResolveInfo,
    ) -> Payment | None:
        try:
            return root.payment
        except Payment.DoesNotExist:
            return None

    @staticmethod
    def resolve_seller(root: Order, _info: GraphQLResolveInfo) -> dict[str, str | None]:
        logo_id = root.organisation.logo_asset_id
        logo_url = None
        if logo_id is not None and MediaAsset.objects.filter(
            public_id=logo_id,
            organisation_id=root.organisation_id,
            purpose=MediaAsset.Purpose.ORGANISATION_LOGO,
            status=MediaAsset.Status.READY,
        ).exists():
            logo_url = public_order_media_url(root, logo_id, variant="thumbnail")
        return {
            "name": root.organisation.name,
            "phone": root.organisation.phone,
            "business_email": root.organisation.business_email,
            "logo_url": logo_url,
        }

    @staticmethod
    def resolve_token_expires_at(root: Order, _info: GraphQLResolveInfo) -> datetime:
        return root.public_token_expires_at

    @staticmethod
    def resolve_is_expired(root: Order, _info: GraphQLResolveInfo) -> bool:
        return root.status == Order.Status.EXPIRED

    @staticmethod
    def resolve_allowed_actions(
        root: Order,
        _info: GraphQLResolveInfo,
    ) -> list[str]:
        return list(public_allowed_actions(root))

    @staticmethod
    def resolve_payment_status(root: Order, _info: GraphQLResolveInfo) -> str | None:
        payment = getattr(root, "payment", None)
        return payment.status if payment is not None else None

    @staticmethod
    def resolve_fee_amount(root: Order, _info: GraphQLResolveInfo) -> str | None:
        payment = getattr(root, "payment", None)
        if payment is None:
            return None
        return str(payment.fee_requested)

    @staticmethod
    def resolve_available_payment_methods(
        root: Order,
        _info: GraphQLResolveInfo,
    ) -> list[str]:
        return [root.payment_method]

    @staticmethod
    def resolve_bank_details(
        root: Order,
        _info: GraphQLResolveInfo,
    ) -> dict[str, str] | None:
        from apps.organisations.bank import public_bank_details

        return public_bank_details(root.organisation)

    @staticmethod
    def resolve_bank_transfer_instructions(
        root: Order,
        _info: GraphQLResolveInfo,
    ) -> str:
        from apps.configuration.services import parameter_value
        from apps.organisations.bank import format_bank_instructions

        structured = format_bank_instructions(root.organisation)
        if structured:
            return structured
        configured = str(
            parameter_value(
                "bank_transfer_instructions",
                organisation=root.organisation,
                default="",
            )
            or ""
        ).strip()
        if configured:
            return configured
        contact = root.organisation.business_email or root.organisation.phone
        if contact:
            return (
                "Transfiere el total exacto al negocio y carga el comprobante. "
                f"Si necesitas los datos bancarios, escribe a {contact}."
            )
        return (
            "Transfiere el total exacto al negocio y carga el comprobante. "
            "El vendedor te compartirá los datos de la cuenta si aún no los tienes."
        )

    @staticmethod
    def resolve_rejection_reason(root: Order, _info: GraphQLResolveInfo) -> str | None:
        payment = getattr(root, "payment", None)
        if payment is None:
            return None
        try:
            return payment.proof.rejection_reason or None
        except PaymentProof.DoesNotExist:
            return None


class PublicOrderStatusType(graphene.ObjectType):  # type: ignore[misc]
    number = graphene.String(required=True)
    status = graphene.String(required=True)
    status_label = graphene.String(required=True)
    payment_status = graphene.String()
    reservation_expires_at = graphene.DateTime(required=True)
    is_expired = graphene.Boolean(required=True)
    reconciliation_status = graphene.String(required=True)
    updated_at = graphene.DateTime(required=True)
    rejection_reason = graphene.String()

    @staticmethod
    def resolve_status_label(root: Order, _info: GraphQLResolveInfo) -> str:
        return STATUS_LABELS[root.status]

    @staticmethod
    def resolve_is_expired(root: Order, _info: GraphQLResolveInfo) -> bool:
        return root.status == Order.Status.EXPIRED

    @staticmethod
    def resolve_payment_status(root: Order, _info: GraphQLResolveInfo) -> str | None:
        payment = getattr(root, "payment", None)
        return payment.status if payment is not None else None

    @staticmethod
    def resolve_rejection_reason(root: Order, _info: GraphQLResolveInfo) -> str | None:
        payment = getattr(root, "payment", None)
        if payment is None:
            return None
        try:
            return payment.proof.rejection_reason or None
        except PaymentProof.DoesNotExist:
            return None


class SalesDashboardType(graphene.ObjectType):  # type: ignore[misc]
    total_orders = graphene.Int(required=True)
    active_orders = graphene.Int(required=True)
    awaiting_buyer = graphene.Int(required=True)
    awaiting_payment = graphene.Int(required=True)
    awaiting_validation = graphene.Int(required=True)
    paid_orders = graphene.Int(required=True)
    reconciliation_required = graphene.Int(required=True)
    confirmed_gross = graphene.String(required=True)

    @staticmethod
    def resolve_confirmed_gross(
        root: SalesDashboard,
        _info: GraphQLResolveInfo,
    ) -> str:
        return str(root.confirmed_gross)


class SalesBalanceType(graphene.ObjectType):  # type: ignore[misc]
    confirmed_gross = graphene.String(required=True)
    refunds = graphene.String(required=True)
    net_sales = graphene.String(required=True)
    known_cogs = graphene.String(required=True)
    gross_margin = graphene.String(required=True)
    pending_amount = graphene.String(required=True)
    validation_amount = graphene.String(required=True)
    operations = graphene.Int(required=True)
    recognized_lines = graphene.Int(required=True)
    known_cost_lines = graphene.Int(required=True)
    cost_coverage = graphene.String(required=True)
    cost_incomplete = graphene.Boolean(required=True)
    currency = graphene.String(required=True)
    timezone = graphene.String(required=True)

    @staticmethod
    def resolve_confirmed_gross(root: SalesBalance, _info: GraphQLResolveInfo) -> str:
        return str(root.confirmed_gross)

    @staticmethod
    def resolve_refunds(root: SalesBalance, _info: GraphQLResolveInfo) -> str:
        return str(root.refunds)

    @staticmethod
    def resolve_net_sales(root: SalesBalance, _info: GraphQLResolveInfo) -> str:
        return str(root.net_sales)

    @staticmethod
    def resolve_known_cogs(root: SalesBalance, _info: GraphQLResolveInfo) -> str:
        return str(root.known_cogs)

    @staticmethod
    def resolve_gross_margin(root: SalesBalance, _info: GraphQLResolveInfo) -> str:
        return str(root.gross_margin)

    @staticmethod
    def resolve_pending_amount(root: SalesBalance, _info: GraphQLResolveInfo) -> str:
        return str(root.pending_amount)

    @staticmethod
    def resolve_validation_amount(root: SalesBalance, _info: GraphQLResolveInfo) -> str:
        return str(root.validation_amount)

    @staticmethod
    def resolve_cost_coverage(root: SalesBalance, _info: GraphQLResolveInfo) -> str:
        return format(root.cost_coverage, "f")

    @staticmethod
    def resolve_currency(_root: SalesBalance, _info: GraphQLResolveInfo) -> str:
        return "CLP"

    @staticmethod
    def resolve_timezone(_root: SalesBalance, info: GraphQLResolveInfo) -> str:
        return context_from_info(info).organisation.timezone


class SalesBalanceBreakdownNodeType(graphene.ObjectType):  # type: ignore[misc]
    period = graphene.Date(required=True)
    product_id = graphene.ID(required=True)
    product_name = graphene.String(required=True)
    payment_method = graphene.String(required=True)
    status = graphene.String(required=True)
    quantity = graphene.Int(required=True)
    confirmed_gross = graphene.String(required=True)
    refunds = graphene.String(required=True)
    net_sales = graphene.String(required=True)
    known_cogs = graphene.String(required=True)
    gross_margin = graphene.String(required=True)
    recognized_lines = graphene.Int(required=True)
    known_cost_lines = graphene.Int(required=True)
    cost_incomplete = graphene.Boolean(required=True)

    @staticmethod
    def resolve_product_id(
        root: BalanceBreakdownRow,
        _info: GraphQLResolveInfo,
    ) -> str:
        return str(root.product_id)

    @staticmethod
    def resolve_confirmed_gross(
        root: BalanceBreakdownRow,
        _info: GraphQLResolveInfo,
    ) -> str:
        return str(root.confirmed_gross)

    @staticmethod
    def resolve_refunds(root: BalanceBreakdownRow, _info: GraphQLResolveInfo) -> str:
        return str(root.refunds)

    @staticmethod
    def resolve_net_sales(root: BalanceBreakdownRow, _info: GraphQLResolveInfo) -> str:
        return str(root.net_sales)

    @staticmethod
    def resolve_known_cogs(root: BalanceBreakdownRow, _info: GraphQLResolveInfo) -> str:
        return str(root.known_cogs)

    @staticmethod
    def resolve_gross_margin(
        root: BalanceBreakdownRow,
        _info: GraphQLResolveInfo,
    ) -> str:
        return str(root.gross_margin)


class SalesBalanceBreakdownConnectionType(graphene.ObjectType):  # type: ignore[misc]
    nodes = graphene.List(
        graphene.NonNull(SalesBalanceBreakdownNodeType),
        required=True,
    )
    page_info = graphene.Field(PageInfoType, required=True)
    total_count = graphene.Int(required=True)


class OrderFilterInput(graphene.InputObjectType):  # type: ignore[misc]
    search = graphene.String()
    status = graphene.String()
    statuses = graphene.List(graphene.NonNull(graphene.String))
    payment_method = graphene.String()
    payment_methods = graphene.List(graphene.NonNull(graphene.String))
    product_id = graphene.ID()
    date_from = graphene.Date()
    date_to = graphene.Date()


class SalesBalanceFilterInput(graphene.InputObjectType):  # type: ignore[misc]
    date_from = graphene.Date()
    date_to = graphene.Date()
    product_id = graphene.ID()
    payment_method = graphene.String()
    payment_methods = graphene.List(graphene.NonNull(graphene.String))
    status = graphene.String()
    statuses = graphene.List(graphene.NonNull(graphene.String))


def _order_list_filter(
    value: dict[str, Any] | None,
    *,
    status: str = "",
    search: str = "",
) -> OrderListFilter:
    payload = value or {}
    statuses = tuple(payload.get("statuses") or ())
    if payload.get("status"):
        statuses = (*statuses, str(payload["status"]))
    if status:
        statuses = (*statuses, status)
    methods = tuple(payload.get("payment_methods") or ())
    if payload.get("payment_method"):
        methods = (*methods, str(payload["payment_method"]))
    product = payload.get("product_id")
    return OrderListFilter(
        search=str(payload.get("search") or search or ""),
        statuses=tuple(dict.fromkeys(str(item) for item in statuses if item)),
        payment_methods=tuple(dict.fromkeys(str(item) for item in methods if item)),
        product_id=_uuid_or_not_found(product) if product else None,
        date_from=payload.get("date_from"),
        date_to=payload.get("date_to"),
    )


def _balance_filter(value: dict[str, Any] | None) -> BalanceFilter:
    payload = value or {}
    product = payload.get("product_id")
    methods = tuple(payload.get("payment_methods") or ())
    if payload.get("payment_method"):
        methods = (*methods, str(payload["payment_method"]))
    statuses = tuple(payload.get("statuses") or ())
    if payload.get("status"):
        statuses = (*statuses, str(payload["status"]))
    return BalanceFilter(
        date_from=payload.get("date_from"),
        date_to=payload.get("date_to"),
        product_id=_uuid_or_not_found(product) if product else None,
        payment_methods=tuple(dict.fromkeys(str(item) for item in methods)),
        statuses=tuple(dict.fromkeys(str(item) for item in statuses)),
    )


class CreateOrderLineInput(graphene.InputObjectType):  # type: ignore[misc]
    product_id = graphene.ID(required=True)
    quantity = graphene.Int(required=True)
    unit_sale_price = graphene.String(required=True)


class CreateOrderInput(graphene.InputObjectType):  # type: ignore[misc]
    lines = graphene.List(graphene.NonNull(CreateOrderLineInput), required=True)
    delivery_mode = graphene.String(required=True)
    payment_method = graphene.String(required=True)


class BuyerDetailsInput(graphene.InputObjectType):  # type: ignore[misc]
    name = graphene.String(required=True)
    email = graphene.String()
    phone = graphene.String()
    recipient_name = graphene.String()
    recipient_tax_id = graphene.String()
    address_line = graphene.String()
    commune = graphene.String()
    region = graphene.String()
    delivery_notes = graphene.String()
    tax_id = graphene.String()
    tax_name = graphene.String()
    tax_activity = graphene.String()
    tax_address = graphene.String()
    tax_commune = graphene.String()
    tax_region = graphene.String()
    tax_email = graphene.String()
    turnstile_token = graphene.String()


class StartMercadoPagoConnection(graphene.Mutation):  # type: ignore[misc]
    connection = graphene.Field(PaymentConnectionStartType, required=True)

    @staticmethod
    def mutate(
        _root: object,
        info: GraphQLResolveInfo,
    ) -> StartMercadoPagoConnection:
        try:
            result = start_seller_payment_connection(
                context=context_from_info(info),
                correlation_id=_correlation_id(info),
            )
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return StartMercadoPagoConnection(connection=result)


class DisconnectMercadoPagoConnection(graphene.Mutation):  # type: ignore[misc]
    connection = graphene.Field(SellerPaymentConnectionType, required=True)

    @staticmethod
    def mutate(
        _root: object,
        info: GraphQLResolveInfo,
    ) -> DisconnectMercadoPagoConnection:
        try:
            connection = disconnect_seller_payment_connection(
                context=context_from_info(info),
                correlation_id=_correlation_id(info),
            )
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return DisconnectMercadoPagoConnection(connection=connection)


class CreateOrder(graphene.Mutation):  # type: ignore[misc]
    class Arguments:
        input = graphene.Argument(CreateOrderInput, required=True)
        idempotency_key = graphene.String(required=True)

    order = graphene.Field(OrderType, required=True)
    replayed = graphene.Boolean(required=True)

    @staticmethod
    def mutate(
        _root: object,
        info: GraphQLResolveInfo,
        input: dict[str, Any],
        idempotency_key: str,
    ) -> CreateOrder:
        try:
            result = create_order(
                context=context_from_info(info),
                lines=input.get("lines") or [],
                delivery_mode=str(input.get("delivery_mode", "")),
                payment_method=str(input.get("payment_method", "")),
                idempotency_key=idempotency_key,
                correlation_id=_correlation_id(info),
            )
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return CreateOrder(order=result.order, replayed=result.replayed)


class PublishOrderLink(graphene.Mutation):  # type: ignore[misc]
    class Arguments:
        order_id = graphene.ID(required=True)
        idempotency_key = graphene.String(required=True)

    order = graphene.Field(OrderType, required=True)
    public_url = graphene.String(required=True)
    replayed = graphene.Boolean(required=True)

    @staticmethod
    def mutate(
        _root: object,
        info: GraphQLResolveInfo,
        order_id: str,
        idempotency_key: str,
    ) -> PublishOrderLink:
        try:
            result = publish_order_link(
                context=context_from_info(info),
                order_id=_uuid_or_not_found(order_id),
                idempotency_key=idempotency_key,
                correlation_id=_correlation_id(info),
            )
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return PublishOrderLink(
            order=result.order,
            public_url=public_order_url(result.order),
            replayed=result.replayed,
        )


class SetBuyerDetails(graphene.Mutation):  # type: ignore[misc]
    class Arguments:
        token = graphene.String(required=True)
        input = graphene.Argument(BuyerDetailsInput, required=True)

    order = graphene.Field(PublicOrderType, required=True)

    @staticmethod
    def mutate(
        _root: object,
        info: GraphQLResolveInfo,
        token: str,
        input: dict[str, Any],
    ) -> SetBuyerDetails:
        try:
            _public_guard(
                info,
                token=token,
                action="buyer_details",
                turnstile_token=str(input.get("turnstile_token") or ""),
            )
            order = set_buyer_details(
                token=token,
                details=input,
                correlation_id=_correlation_id(info),
            )
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return SetBuyerDetails(order=order)


class UpdateOrderBuyer(graphene.Mutation):  # type: ignore[misc]
    class Arguments:
        order_id = graphene.ID(required=True)
        input = graphene.Argument(BuyerDetailsInput, required=True)
        idempotency_key = graphene.String(required=True)

    order = graphene.Field(OrderType, required=True)
    replayed = graphene.Boolean(required=True)

    @staticmethod
    def mutate(
        _root: object,
        info: GraphQLResolveInfo,
        order_id: str,
        input: dict[str, Any],
        idempotency_key: str,
    ) -> UpdateOrderBuyer:
        try:
            result = update_order_buyer(
                context=context_from_info(info),
                order_id=_uuid_or_not_found(order_id),
                details=input,
                idempotency_key=idempotency_key,
                correlation_id=_correlation_id(info),
            )
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return UpdateOrderBuyer(order=result.order, replayed=result.replayed)


class InitiateMercadoPagoCheckout(graphene.Mutation):  # type: ignore[misc]
    class Arguments:
        token = graphene.String(required=True)
        idempotency_key = graphene.String(required=True)

    order = graphene.Field(PublicOrderType, required=True)
    checkout_url = graphene.String(required=True)
    replayed = graphene.Boolean(required=True)

    @staticmethod
    def mutate(
        _root: object,
        info: GraphQLResolveInfo,
        token: str,
        idempotency_key: str,
    ) -> InitiateMercadoPagoCheckout:
        try:
            _public_guard(info, token=token, action="checkout")
            result = initiate_mercado_pago_checkout(
                token=token,
                idempotency_key=idempotency_key,
                correlation_id=_correlation_id(info),
            )
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return InitiateMercadoPagoCheckout(
            order=result.order,
            checkout_url=result.checkout_url,
            replayed=result.replayed,
        )


class ReviewPaymentProof(graphene.Mutation):  # type: ignore[misc]
    class Arguments:
        order_id = graphene.ID(required=True)
        approved = graphene.Boolean(required=True)
        rejection_reason = graphene.String()
        idempotency_key = graphene.String(required=True)

    order = graphene.Field(OrderType, required=True)
    replayed = graphene.Boolean(required=True)

    @staticmethod
    def mutate(
        _root: object,
        info: GraphQLResolveInfo,
        order_id: str,
        approved: bool,
        idempotency_key: str,
        rejection_reason: str = "",
    ) -> ReviewPaymentProof:
        try:
            result = review_payment_proof(
                context=context_from_info(info),
                order_id=_uuid_or_not_found(order_id),
                approved=approved,
                rejection_reason=rejection_reason,
                idempotency_key=idempotency_key,
                correlation_id=_correlation_id(info),
            )
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return ReviewPaymentProof(order=result.order, replayed=result.replayed)


class ConfirmManualPayment(graphene.Mutation):  # type: ignore[misc]
    class Arguments:
        order_id = graphene.ID(required=True)
        amount = graphene.String(required=True)
        paid_at = graphene.DateTime(required=True)
        note = graphene.String()
        idempotency_key = graphene.String(required=True)

    order = graphene.Field(OrderType, required=True)
    replayed = graphene.Boolean(required=True)

    @staticmethod
    def mutate(
        _root: object,
        info: GraphQLResolveInfo,
        order_id: str,
        amount: str,
        paid_at: datetime,
        idempotency_key: str,
        note: str = "",
    ) -> ConfirmManualPayment:
        try:
            result = confirm_manual_payment(
                context=context_from_info(info),
                order_id=_uuid_or_not_found(order_id),
                amount=amount,
                paid_at=paid_at,
                note=note,
                idempotency_key=idempotency_key,
                correlation_id=_correlation_id(info),
            )
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return ConfirmManualPayment(order=result.order, replayed=result.replayed)


class CancelOrder(graphene.Mutation):  # type: ignore[misc]
    class Arguments:
        order_id = graphene.ID(required=True)
        reason = graphene.String(required=True)
        idempotency_key = graphene.String(required=True)

    order = graphene.Field(OrderType, required=True)
    replayed = graphene.Boolean(required=True)

    @staticmethod
    def mutate(
        _root: object,
        info: GraphQLResolveInfo,
        order_id: str,
        reason: str,
        idempotency_key: str,
    ) -> CancelOrder:
        try:
            result = cancel_order(
                context=context_from_info(info),
                order_id=_uuid_or_not_found(order_id),
                reason=reason,
                idempotency_key=idempotency_key,
                correlation_id=_correlation_id(info),
            )
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return CancelOrder(order=result.order, replayed=result.replayed)


class RestoreOrder(graphene.Mutation):  # type: ignore[misc]
    class Arguments:
        order_id = graphene.ID(required=True)
        idempotency_key = graphene.String(required=True)

    order = graphene.Field(OrderType, required=True)
    replayed = graphene.Boolean(required=True)

    @staticmethod
    def mutate(
        _root: object,
        info: GraphQLResolveInfo,
        order_id: str,
        idempotency_key: str,
    ) -> RestoreOrder:
        try:
            result = restore_order(
                context=context_from_info(info),
                order_id=_uuid_or_not_found(order_id),
                idempotency_key=idempotency_key,
                correlation_id=_correlation_id(info),
            )
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return RestoreOrder(order=result.order, replayed=result.replayed)


class RefundPayment(graphene.Mutation):  # type: ignore[misc]
    class Arguments:
        order_id = graphene.ID(required=True)
        reason = graphene.String(required=True)
        idempotency_key = graphene.String(required=True)

    order = graphene.Field(OrderType, required=True)
    replayed = graphene.Boolean(required=True)

    @staticmethod
    def mutate(
        _root: object,
        info: GraphQLResolveInfo,
        order_id: str,
        reason: str,
        idempotency_key: str,
    ) -> RefundPayment:
        try:
            result = refund_payment(
                context=context_from_info(info),
                order_id=_uuid_or_not_found(order_id),
                reason=reason,
                idempotency_key=idempotency_key,
                correlation_id=_correlation_id(info),
            )
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return RefundPayment(order=result.order, replayed=result.replayed)


class ResendOrderLink(graphene.Mutation):  # type: ignore[misc]
    class Arguments:
        order_id = graphene.ID(required=True)
        idempotency_key = graphene.String(required=True)

    order = graphene.Field(OrderType, required=True)
    replayed = graphene.Boolean(required=True)

    @staticmethod
    def mutate(
        _root: object,
        info: GraphQLResolveInfo,
        order_id: str,
        idempotency_key: str,
    ) -> ResendOrderLink:
        try:
            result = resend_order_link(
                context=context_from_info(info),
                order_id=_uuid_or_not_found(order_id),
                idempotency_key=idempotency_key,
                correlation_id=_correlation_id(info),
            )
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return ResendOrderLink(order=result.order, replayed=result.replayed)


class SendOfferLink(graphene.Mutation):  # type: ignore[misc]
    class Arguments:
        order_id = graphene.ID(required=True)
        email = graphene.String(required=True)
        idempotency_key = graphene.String(required=True)

    order = graphene.Field(OrderType, required=True)
    replayed = graphene.Boolean(required=True)

    @staticmethod
    def mutate(
        _root: object,
        info: GraphQLResolveInfo,
        order_id: str,
        email: str,
        idempotency_key: str,
    ) -> SendOfferLink:
        try:
            result = send_offer_link(
                context=context_from_info(info),
                order_id=_uuid_or_not_found(order_id),
                email=email,
                idempotency_key=idempotency_key,
                correlation_id=_correlation_id(info),
            )
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return SendOfferLink(order=result.order, replayed=result.replayed)


class ReissueBankTransferOffer(graphene.Mutation):  # type: ignore[misc]
    class Arguments:
        order_id = graphene.ID(required=True)
        idempotency_key = graphene.String(required=True)

    order = graphene.Field(OrderType, required=True)
    public_url = graphene.String(required=True)
    replayed = graphene.Boolean(required=True)

    @staticmethod
    def mutate(
        _root: object,
        info: GraphQLResolveInfo,
        order_id: str,
        idempotency_key: str,
    ) -> ReissueBankTransferOffer:
        try:
            result = reissue_bank_transfer_offer(
                context=context_from_info(info),
                order_id=_uuid_or_not_found(order_id),
                idempotency_key=idempotency_key,
                correlation_id=_correlation_id(info),
            )
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return ReissueBankTransferOffer(
            order=result.order,
            public_url=public_order_url(result.order),
            replayed=result.replayed,
        )


class SalesQuery(graphene.ObjectType):  # type: ignore[misc]
    seller_payment_connection = graphene.Field(SellerPaymentConnectionType)
    payment_commission_configuration = graphene.Field(
        PaymentCommissionConfigurationType,
        required=True,
    )
    sales_dashboard = graphene.Field(SalesDashboardType, required=True)
    orders = graphene.Field(
        OrderConnectionType,
        required=True,
        first=graphene.Int(),
        after=graphene.String(),
        status=graphene.String(),
        search=graphene.String(),
        filter=graphene.Argument(OrderFilterInput),
    )
    order = graphene.Field(OrderType, id=graphene.ID(required=True))
    public_order = graphene.Field(
        PublicOrderType,
        token=graphene.String(required=True),
    )
    public_order_status = graphene.Field(
        PublicOrderStatusType,
        token=graphene.String(required=True),
    )
    sales_balance = graphene.Field(
        SalesBalanceType,
        required=True,
        filter=graphene.Argument(SalesBalanceFilterInput),
    )
    sales_balance_breakdown = graphene.Field(
        SalesBalanceBreakdownConnectionType,
        required=True,
        filter=graphene.Argument(SalesBalanceFilterInput),
        first=graphene.Int(),
        after=graphene.String(),
    )
    reconciliation_issues = graphene.Field(
        ReconciliationIssueConnectionType,
        required=True,
        status=graphene.String(),
        first=graphene.Int(),
        after=graphene.String(),
    )

    @staticmethod
    def resolve_seller_payment_connection(
        _root: object,
        info: GraphQLResolveInfo,
    ) -> SellerPaymentConnection | None:
        try:
            return seller_payment_connection(context_from_info(info))
        except DomainError as exc:
            raise graphql_error(info, exc) from exc

    @staticmethod
    def resolve_payment_commission_configuration(
        _root: object,
        info: GraphQLResolveInfo,
    ) -> PaymentCommissionConfiguration:
        try:
            return payment_commission_configuration(context_from_info(info))
        except DomainError as exc:
            raise graphql_error(info, exc) from exc

    @staticmethod
    def resolve_sales_dashboard(
        _root: object,
        info: GraphQLResolveInfo,
    ) -> SalesDashboard:
        try:
            return sales_dashboard(context_from_info(info))
        except DomainError as exc:
            raise graphql_error(info, exc) from exc

    @staticmethod
    def resolve_orders(
        _root: object,
        info: GraphQLResolveInfo,
        first: int | None = None,
        after: str | None = None,
        status: str = "",
        search: str = "",
        filter: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        try:
            page = paginated_orders(
                context_from_info(info),
                first=first,
                after=after,
                status=status,
                search=search,
                filters=_order_list_filter(filter, status=status, search=search),
            )
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return {
            "nodes": page.items,
            "page_info": _page_info(page),
            "total_count": page.total_count,
        }

    @staticmethod
    def resolve_order(
        _root: object,
        info: GraphQLResolveInfo,
        id: str,
    ) -> Order:
        try:
            return order_for_context(context_from_info(info), _uuid_or_not_found(id))
        except DomainError as exc:
            raise graphql_error(info, exc) from exc

    @staticmethod
    def resolve_public_order(
        _root: object,
        info: GraphQLResolveInfo,
        token: str,
    ) -> Order:
        try:
            _public_guard(info, token=token, action="read")
            return public_order_for_token(token)
        except DomainError as exc:
            raise graphql_error(info, exc) from exc

    @staticmethod
    def resolve_public_order_status(
        _root: object,
        info: GraphQLResolveInfo,
        token: str,
    ) -> Order:
        try:
            _public_guard(info, token=token, action="status")
            return public_order_for_token(token)
        except DomainError as exc:
            raise graphql_error(info, exc) from exc

    @staticmethod
    def resolve_sales_balance(
        _root: object,
        info: GraphQLResolveInfo,
        filter: dict[str, Any] | None = None,
    ) -> SalesBalance:
        try:
            context = context_from_info(info)
            require_permission(
                context.membership,
                OrganisationPermission.VIEW_FINANCIALS,
            )
            return sales_balance(context, filters=_balance_filter(filter))
        except DomainError as exc:
            raise graphql_error(info, exc) from exc

    @staticmethod
    def resolve_sales_balance_breakdown(
        _root: object,
        info: GraphQLResolveInfo,
        filter: dict[str, Any] | None = None,
        first: int | None = None,
        after: str | None = None,
    ) -> dict[str, Any]:
        try:
            context = context_from_info(info)
            page = sales_balance_breakdown(
                context,
                filters=_balance_filter(filter),
                first=first,
                after=after,
            )
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return {
            "nodes": page.items,
            "page_info": _page_info(page),
            "total_count": page.total_count,
        }

    @staticmethod
    def resolve_reconciliation_issues(
        _root: object,
        info: GraphQLResolveInfo,
        status: str = "",
        first: int | None = None,
        after: str | None = None,
    ) -> dict[str, Any]:
        try:
            page = paginated_reconciliation_issues(
                context_from_info(info),
                status=status,
                first=first,
                after=after,
            )
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return {
            "nodes": page.items,
            "page_info": _page_info(page),
            "total_count": page.total_count,
        }


class RetryReconciliation(graphene.Mutation):  # type: ignore[misc]
    class Arguments:
        issue_id = graphene.ID(required=True)
        idempotency_key = graphene.String(required=True)

    issue = graphene.Field(ReconciliationIssueType, required=True)
    replayed = graphene.Boolean(required=True)

    @staticmethod
    def mutate(
        _root: object,
        info: GraphQLResolveInfo,
        issue_id: str,
        idempotency_key: str,
    ) -> RetryReconciliation:
        from .webhooks import retry_reconciliation_issue

        try:
            issue, replayed = retry_reconciliation_issue(
                context=context_from_info(info),
                issue_id=_uuid_or_not_found(issue_id),
                idempotency_key=idempotency_key,
                correlation_id=_correlation_id(info),
            )
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return RetryReconciliation(issue=issue, replayed=replayed)


class SalesMutation(graphene.ObjectType):  # type: ignore[misc]
    start_mercado_pago_connection = StartMercadoPagoConnection.Field(required=True)
    disconnect_mercado_pago_connection = DisconnectMercadoPagoConnection.Field(required=True)
    create_order = CreateOrder.Field(required=True)
    publish_order_link = PublishOrderLink.Field(required=True)
    set_buyer_details = SetBuyerDetails.Field(required=True)
    update_order_buyer = UpdateOrderBuyer.Field(required=True)
    initiate_mercado_pago_checkout = InitiateMercadoPagoCheckout.Field(required=True)
    review_payment_proof = ReviewPaymentProof.Field(required=True)
    confirm_manual_payment = ConfirmManualPayment.Field(required=True)
    cancel_order = CancelOrder.Field(required=True)
    restore_order = RestoreOrder.Field(required=True)
    refund_payment = RefundPayment.Field(required=True)
    resend_order_link = ResendOrderLink.Field(required=True)
    send_offer_link = SendOfferLink.Field(required=True)
    reissue_bank_transfer_offer = ReissueBankTransferOffer.Field(required=True)
    retry_reconciliation = RetryReconciliation.Field(required=True)
