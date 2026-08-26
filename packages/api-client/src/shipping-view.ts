import type {
  OperationFollowUpFragment,
  OperationOpenPublicTicketInput,
  OperationPublicShipmentFragment,
  OperationReturnCaseFragment,
  OperationShipmentDetailFragment,
  OperationShipmentFilterInput,
  OperationShipmentSummaryFragment,
  OperationShippingDashboardQuery,
  OperationTicketDetailFragment,
  OperationUpdateShipmentInput,
} from './generated/graphql.js'

function asString(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) return fallback
  return String(value)
}

export type ShipmentAllowedActions = {
  updateShipment: boolean
  markShipmentDispatched: boolean
  generateShipmentLabel: boolean
  sendTicketMessage: boolean
  resolveTicket: boolean
  rescheduleFollowUp: boolean
  registerReturnCase: boolean
  confirmReturnToStock: boolean
}

export type ShippingDashboard = {
  totalCount: number
  pendingCount: number
  preparingCount: number
  dispatchedCount: number
  deliveryCheckCount: number
  issueCount: number
  attentionCount: number
}

export type ShipmentOrderRef = {
  id: string
  number: string
  status: string
}

export type ShipmentTimelineItem = {
  id: string
  eventType: string
  fromStatus: string
  toStatus: string
  title: string
  detail: string
  isPublic: boolean
  actorName: string
  createdAt: string
}

export type ShipmentLabel = {
  id: string
  downloadUrl: string | null
  expiresAt: string
  createdAt: string
  fileName: string
}

export type FollowUp = {
  id: string
  kind: string
  kindLabel: string
  status: string
  statusLabel: string
  dueAt: string
  sentAt: string | null
  parameterKey: string
  parameterSource: string
  parameterSourceLabel: string
  parameterLabel: string
}

export type ReturnCase = {
  id: string
  kind: string
  kindLabel: string
  notes: string
  stockConfirmedAt: string | null
  createdAt: string
}

export type ShipmentSummary = {
  id: string
  number: string
  status: string
  statusLabel: string
  deliveryMode: string
  recipientName: string
  municipality: string
  city: string
  carrier: string
  trackingCode: string
  trackingUrl: string
  nextAction: string
  allowedActions: ShipmentAllowedActions
  createdAt: string
  nextFollowUp: FollowUp | null
  order: ShipmentOrderRef
}

export type TicketMessage = {
  id: string
  authorKind: 'buyer' | 'seller' | 'system' | string
  body: string
  createdAt: string
}

export type ShipmentConfirmation = {
  outcome: 'received' | 'needs_help' | string
  comment: string
  createdAt: string
}

export type TicketSummary = {
  id: string
  number: string
  status: string
  statusLabel: string
  category: string
  categoryLabel: string
  createdAt: string
}

export type SellerTicket = TicketSummary & {
  contactName: string
  contactEmail: string
  contactPhone: string
  resolvedAt: string | null
  closedAt: string | null
  messages: TicketMessage[]
  shipment: {
    id: string
    number: string
    orderNumber: string
  }
}

export type PublicBuyerContact = {
  name: string
  email: string
  phone: string
}

export type SellerShipment = ShipmentSummary & {
  addressLine: string
  deliveryNotes: string
  dispatchedAt: string | null
  deliveredAt: string | null
  updatedAt: string
  publicUrl: string
  confirmation: ShipmentConfirmation | null
  latestLabel: ShipmentLabel | null
  timeline: ShipmentTimelineItem[]
  activeTicket: TicketSummary | null
  tickets: TicketSummary[]
  followUps: FollowUp[]
  returnCases: ReturnCase[]
}

export type PublicShipmentSeller = {
  displayName: string
  contactEmail: string
  contactPhone: string
}

export type PublicShipmentLine = {
  productName: string
  quantity: number
}

export type PublicShipmentEvent = {
  title: string
  detail: string
  createdAt: string
}

export type PublicShipment = {
  number: string
  publicStatus: string
  publicStatusLabel: string
  orderNumber: string
  seller: PublicShipmentSeller
  lines: PublicShipmentLine[]
  carrier: string
  trackingCode: string
  trackingUrl: string
  dispatchedAt: string | null
  timeline: PublicShipmentEvent[]
  confirmation: ShipmentConfirmation | null
  ticket: SellerTicket | null
  buyerContact: PublicBuyerContact
  allowedActions: {
    confirmReceived: boolean
    requestHelp: boolean
    openPublicTicket: boolean
    sendTicketMessage: boolean
  }
  canConfirm: boolean
  tokenExpiresAt: string
}

export type ConfirmPublicShipmentResult = {
  replayed: boolean
  outcome: string
  publicStatus: string
  publicStatusLabel: string
  nextAction: string
  allowedActions: string[]
}

export type ShipmentFilter = {
  search?: string | null
  statuses?: string[] | null
  attention?: boolean | null
  deliveryMode?: string | null
}

export type UpdateShipmentRequest = {
  shipmentId: string
  carrier?: string | null
  trackingCode?: string | null
  trackingUrl?: string | null
  comment?: string | null
  internalNote?: boolean | null
  idempotencyKey: string
}

export type MarkShipmentDispatchedRequest = {
  shipmentId: string
  comment?: string | null
  idempotencyKey: string
}

export type GenerateShipmentLabelRequest = {
  shipmentId: string
  idempotencyKey: string
}

export type OpenPublicTicketRequest = {
  token: string
  category: string
  message: string
  contactName?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  turnstileToken: string
  idempotencyKey: string
}

export type SendTicketMessageRequest = {
  ticketId: string
  body: string
  idempotencyKey: string
  token?: string | null
  turnstileToken?: string | null
}

export type ResolveTicketRequest = {
  ticketId: string
  comment?: string | null
  idempotencyKey: string
}

export type RescheduleFollowUpRequest = {
  followUpId: string
  dueAt: string
  reason: string
  idempotencyKey: string
}

export type RegisterReturnCaseRequest = {
  shipmentId: string
  kind: string
  notes?: string | null
  idempotencyKey: string
}

export type ConfirmReturnToStockRequest = {
  returnCaseId: string
  idempotencyKey: string
}

function mapAllowedActions(actions: readonly string[]): ShipmentAllowedActions {
  const set = new Set(actions)
  return {
    updateShipment: set.has('updateShipment'),
    markShipmentDispatched: set.has('markShipmentDispatched'),
    generateShipmentLabel: set.has('generateShipmentLabel'),
    sendTicketMessage: set.has('sendTicketMessage'),
    resolveTicket: set.has('resolveTicket'),
    rescheduleFollowUp: set.has('rescheduleFollowUp'),
    registerReturnCase: set.has('registerReturnCase'),
    confirmReturnToStock: set.has('confirmReturnToStock'),
  }
}

export function mapFollowUp(followUp: OperationFollowUpFragment): FollowUp {
  return {
    id: asString(followUp.id),
    kind: asString(followUp.kind),
    kindLabel: asString(followUp.kindLabel),
    status: asString(followUp.status),
    statusLabel: asString(followUp.statusLabel),
    dueAt: asString(followUp.dueAt),
    sentAt: followUp.sentAt ? asString(followUp.sentAt) : null,
    parameterKey: asString(followUp.parameterKey),
    parameterSource: asString(followUp.parameterSource),
    parameterSourceLabel: asString(followUp.parameterSourceLabel),
    parameterLabel: asString(followUp.parameterLabel),
  }
}

export function mapReturnCase(item: OperationReturnCaseFragment): ReturnCase {
  return {
    id: asString(item.id),
    kind: asString(item.kind),
    kindLabel: asString(item.kindLabel),
    notes: asString(item.notes),
    stockConfirmedAt: item.stockConfirmedAt ? asString(item.stockConfirmedAt) : null,
    createdAt: asString(item.createdAt),
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
    preparingCount: dashboard.preparing,
    dispatchedCount: dashboard.dispatched,
    deliveryCheckCount: dashboard.deliveryCheck,
    issueCount: dashboard.issue,
    attentionCount: dashboard.attention,
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
    municipality: asString(shipment.municipality),
    city: asString(shipment.city),
    carrier: asString(shipment.carrier),
    trackingCode: asString(shipment.trackingCode),
    trackingUrl: asString(shipment.trackingUrl),
    nextAction: asString(shipment.nextAction),
    allowedActions: mapAllowedActions(shipment.allowedActions),
    createdAt: asString(shipment.createdAt),
    nextFollowUp: shipment.nextFollowUp ? mapFollowUp(shipment.nextFollowUp) : null,
    order: mapOrder(shipment.order),
  }
}

function mapLabel(
  label: NonNullable<OperationShipmentDetailFragment['latestLabel']>,
): ShipmentLabel {
  return {
    id: asString(label.id),
    downloadUrl: label.downloadUrl ? asString(label.downloadUrl) : null,
    expiresAt: asString(label.expiresAt),
    createdAt: asString(label.createdAt),
    fileName: asString(label.fileName),
  }
}

function mapConfirmation(
  confirmation: NonNullable<OperationShipmentDetailFragment['confirmation']>,
): ShipmentConfirmation {
  return {
    outcome: asString(confirmation.outcome),
    comment: asString(confirmation.comment),
    createdAt: asString(confirmation.createdAt),
  }
}

function mapTicketSummary(
  ticket: OperationShipmentDetailFragment['tickets'][number],
): TicketSummary {
  return {
    id: asString(ticket.id),
    number: asString(ticket.number),
    status: asString(ticket.status),
    statusLabel: asString(ticket.statusLabel),
    category: asString(ticket.category),
    categoryLabel: asString(ticket.categoryLabel),
    createdAt: asString(ticket.createdAt),
  }
}

export function mapSellerTicket(ticket: OperationTicketDetailFragment): SellerTicket {
  return {
    ...mapTicketSummary(ticket),
    contactName: asString(ticket.contactName),
    contactEmail: asString(ticket.contactEmail),
    contactPhone: asString(ticket.contactPhone),
    resolvedAt: ticket.resolvedAt ? asString(ticket.resolvedAt) : null,
    closedAt: ticket.closedAt ? asString(ticket.closedAt) : null,
    messages: ticket.messages.map((item) => ({
      id: asString(item.id),
      authorKind: asString(item.authorKind),
      body: asString(item.body),
      createdAt: asString(item.createdAt),
    })),
    shipment: {
      id: asString(ticket.shipment.id),
      number: asString(ticket.shipment.number),
      orderNumber: asString(ticket.shipment.orderNumber),
    },
  }
}

export function mapSellerShipment(
  shipment: OperationShipmentDetailFragment,
): SellerShipment {
  return {
    ...mapShipmentSummary(shipment),
    addressLine: asString(shipment.addressLine),
    deliveryNotes: asString(shipment.deliveryNotes),
    dispatchedAt: shipment.dispatchedAt ? asString(shipment.dispatchedAt) : null,
    deliveredAt: shipment.deliveredAt ? asString(shipment.deliveredAt) : null,
    updatedAt: asString(shipment.updatedAt),
    publicUrl: asString(shipment.publicUrl),
    confirmation: shipment.confirmation ? mapConfirmation(shipment.confirmation) : null,
    latestLabel: shipment.latestLabel ? mapLabel(shipment.latestLabel) : null,
    timeline: shipment.timeline.map((item) => ({
      id: asString(item.id),
      eventType: asString(item.eventType),
      fromStatus: asString(item.fromStatus),
      toStatus: asString(item.toStatus),
      title: asString(item.title),
      detail: asString(item.detail),
      isPublic: Boolean(item.isPublic),
      actorName: asString(item.actorName),
      createdAt: asString(item.createdAt),
    })),
    activeTicket: shipment.activeTicket ? mapTicketSummary(shipment.activeTicket) : null,
    tickets: shipment.tickets.map(mapTicketSummary),
    followUps: shipment.followUps.map(mapFollowUp),
    returnCases: shipment.returnCases.map(mapReturnCase),
  }
}

export function mapPublicShipment(
  shipment: OperationPublicShipmentFragment,
): PublicShipment {
  const actions = new Set(shipment.allowedActions)
  return {
    number: asString(shipment.number),
    publicStatus: asString(shipment.publicStatus),
    publicStatusLabel: asString(shipment.publicStatusLabel),
    orderNumber: asString(shipment.orderNumber),
    seller: {
      displayName: asString(shipment.seller.name),
      contactEmail: asString(shipment.seller.businessEmail),
      contactPhone: asString(shipment.seller.phone),
    },
    lines: shipment.lines.map((line) => ({
      productName: asString(line.productName),
      quantity: line.quantity,
    })),
    carrier: asString(shipment.carrier),
    trackingCode: asString(shipment.trackingCode),
    trackingUrl: asString(shipment.trackingUrl),
    dispatchedAt: shipment.dispatchedAt ? asString(shipment.dispatchedAt) : null,
    timeline: shipment.timeline.map((item) => ({
      title: asString(item.title),
      detail: asString(item.detail),
      createdAt: asString(item.createdAt),
    })),
    confirmation: shipment.confirmation ? mapConfirmation(shipment.confirmation) : null,
    ticket: shipment.ticket ? mapSellerTicket(shipment.ticket) : null,
    buyerContact: {
      name: asString(shipment.buyerContact.name),
      email: asString(shipment.buyerContact.email),
      phone: asString(shipment.buyerContact.phone),
    },
    allowedActions: {
      confirmReceived: actions.has('confirmReceived'),
      requestHelp: actions.has('requestHelp'),
      openPublicTicket: actions.has('openPublicTicket'),
      sendTicketMessage: actions.has('sendTicketMessage'),
    },
    canConfirm: Boolean(shipment.canConfirm),
    tokenExpiresAt: asString(shipment.tokenExpiresAt),
  }
}

export function toShipmentFilter(
  filter?: ShipmentFilter | null,
): OperationShipmentFilterInput | null {
  if (!filter) return null
  return {
    search: filter.search ?? null,
    statuses: filter.statuses ?? null,
    attention: filter.attention ?? null,
    deliveryMode: filter.deliveryMode ?? null,
  }
}

export function toUpdateShipmentInput(
  input: UpdateShipmentRequest,
): OperationUpdateShipmentInput {
  return {
    carrier: input.carrier ?? null,
    trackingCode: input.trackingCode ?? null,
    trackingUrl: input.trackingUrl ?? null,
    comment: input.comment ?? null,
    internalNote: input.internalNote ?? null,
  }
}

export function toOpenPublicTicketInput(
  input: OpenPublicTicketRequest,
): OperationOpenPublicTicketInput {
  return {
    category: input.category,
    message: input.message,
    contactName: input.contactName ?? null,
    contactEmail: input.contactEmail ?? null,
    contactPhone: input.contactPhone ?? null,
    turnstileToken: input.turnstileToken,
  }
}
