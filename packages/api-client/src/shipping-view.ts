import type {
  OperationRegisterShipmentDispatchInput,
  OperationShipmentDetailFragment,
  OperationShipmentFilterInput,
  OperationShipmentSummaryFragment,
  OperationShippingDashboardQuery,
} from './generated/graphql.js'

function asString(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) return fallback
  return String(value)
}

export type ShipmentStatus = 'pending' | 'dispatched' | 'delivered'

export type ShipmentAllowedActions = {
  registerShipmentDispatch: boolean
  generateShipmentLabel: boolean
}

export type ShippingDashboard = {
  totalCount: number
  pendingCount: number
  dispatchedCount: number
  deliveredCount: number
}

export type ShipmentOrderRef = {
  id: string
  number: string
  status: string
}

export type ShipmentLabel = {
  id: string
  downloadUrl: string | null
  expiresAt: string
  createdAt: string
  fileName: string
}

export type ShipmentSummary = {
  id: string
  number: string
  status: ShipmentStatus | string
  statusLabel: string
  deliveryMode: string
  recipientName: string
  commune: string
  region: string
  carrier: string
  trackingCode: string
  trackingUrl: string
  allowedActions: ShipmentAllowedActions
  dispatchedAt: string | null
  deliveredAt: string | null
  createdAt: string
  order: ShipmentOrderRef
}

export type SellerShipment = ShipmentSummary & {
  recipientTaxId: string
  addressLine: string
  deliveryNotes: string
  dispatchNote: string
  buyerEmail: string
  updatedAt: string
  latestLabel: ShipmentLabel | null
}

export type ShipmentFilter = {
  search?: string | null
  statuses?: string[] | null
  deliveryMode?: string | null
}

export type RegisterShipmentDispatchRequest = {
  shipmentId: string
  carrier?: string | null
  trackingCode?: string | null
  trackingUrl?: string | null
  note?: string | null
  idempotencyKey: string
}

export type GenerateShipmentLabelRequest = {
  shipmentId: string
  idempotencyKey: string
}

function mapAllowedActions(actions: readonly string[]): ShipmentAllowedActions {
  const set = new Set(actions)
  return {
    registerShipmentDispatch: set.has('registerShipmentDispatch'),
    generateShipmentLabel: set.has('generateShipmentLabel'),
  }
}

function mapOrder(order: OperationShipmentSummaryFragment['order']): ShipmentOrderRef {
  return {
    id: asString(order.id),
    number: asString(order.number),
    status: asString(order.status),
  }
}

export function mapShippingDashboard(
  dashboard: OperationShippingDashboardQuery['shippingDashboard'],
): ShippingDashboard {
  return {
    totalCount: dashboard.total,
    pendingCount: dashboard.pending,
    dispatchedCount: dashboard.dispatched,
    deliveredCount: dashboard.delivered,
  }
}

export function mapShipmentSummary(
  shipment: OperationShipmentSummaryFragment,
): ShipmentSummary {
  return {
    id: asString(shipment.id),
    number: asString(shipment.number),
    status: asString(shipment.status),
    statusLabel: asString(shipment.statusLabel),
    deliveryMode: asString(shipment.deliveryMode),
    recipientName: asString(shipment.recipientName),
    commune: asString(shipment.commune),
    region: asString(shipment.region),
    carrier: asString(shipment.carrier),
    trackingCode: asString(shipment.trackingCode),
    trackingUrl: asString(shipment.trackingUrl),
    allowedActions: mapAllowedActions(shipment.allowedActions),
    dispatchedAt: shipment.dispatchedAt ? asString(shipment.dispatchedAt) : null,
    deliveredAt: shipment.deliveredAt ? asString(shipment.deliveredAt) : null,
    createdAt: asString(shipment.createdAt),
    order: mapOrder(shipment.order),
  }
}

export function mapShipmentLabel(label: {
  id: string
  downloadUrl?: string | null
  expiresAt: unknown
  createdAt: unknown
  fileName: string
}): ShipmentLabel {
  return {
    id: asString(label.id),
    downloadUrl: label.downloadUrl ? asString(label.downloadUrl) : null,
    expiresAt: asString(label.expiresAt),
    createdAt: asString(label.createdAt),
    fileName: asString(label.fileName),
  }
}

export function mapSellerShipment(
  shipment: OperationShipmentDetailFragment,
): SellerShipment {
  return {
    ...mapShipmentSummary(shipment),
    recipientTaxId: asString(shipment.recipientTaxId),
    addressLine: asString(shipment.addressLine),
    deliveryNotes: asString(shipment.deliveryNotes),
    dispatchNote: asString(shipment.dispatchNote),
    buyerEmail: asString(shipment.buyerEmail),
    updatedAt: asString(shipment.updatedAt),
    latestLabel: shipment.latestLabel ? mapShipmentLabel(shipment.latestLabel) : null,
  }
}

export function toShipmentFilter(
  filter?: ShipmentFilter | null,
): OperationShipmentFilterInput | null {
  if (!filter) return null
  return {
    search: filter.search ?? null,
    statuses: filter.statuses ?? null,
    deliveryMode: filter.deliveryMode ?? null,
  }
}

export function toRegisterShipmentDispatchInput(
  input: RegisterShipmentDispatchRequest,
): OperationRegisterShipmentDispatchInput {
  return {
    carrier: input.carrier ?? null,
    trackingCode: input.trackingCode ?? null,
    trackingUrl: input.trackingUrl ?? null,
    note: input.note ?? null,
  }
}
