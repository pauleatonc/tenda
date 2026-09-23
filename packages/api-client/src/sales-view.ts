import type {
  OperationBuyerDetailsInput,
  OperationOrderFilterInput,
  OperationPublicOrderFragment,
  OperationReconciliationIssueFragment,
  OperationSalesBalanceBreakdownQuery,
  OperationSalesBalanceFilterInput,
  OperationSalesBalanceQuery,
  OperationSalesDashboardQuery,
  OperationSellerOrderFragment,
  OperationSellerOrderSummaryFragment,
} from './generated/graphql.js'
import { mapShipmentLabel, type ShipmentLabel } from './shipping-view.js'

function asString(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) return fallback
  return String(value)
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  if (typeof value !== 'string' || !value) return {}
  try {
    const parsed: unknown = JSON.parse(value)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    return {}
  }
  return {}
}

function mapPaymentStatus(status: string | null | undefined): string {
  if (!status) return ''
  if (status === 'validation') return 'proof_submitted'
  return status
}

function moneyFromDetails(details: Record<string, unknown>, key: string): string | null {
  const value = details[key]
  if (value === null || value === undefined || value === '') return null
  return String(value)
}

export type SalesDashboard = {
  totalOrders: number
  activeOrders: number
  awaitingBuyerCount: number
  awaitingPaymentCount: number
  awaitingValidationCount: number
  reconciliationRequiredCount: number
  confirmedThisMonthAmount: string
  confirmedThisMonthCount: number
  currency: string
}

export type OrderAllowedActions = {
  approveProof: boolean
  rejectProof: boolean
  confirmManualPayment: boolean
  cancel: boolean
  refund: boolean
  resendLink: boolean
  sendOfferLink: boolean
  reissueOffer: boolean
  restore: boolean
  updateBuyer: boolean
  viewShipmentLabel: boolean
}

export type BuyerView = {
  fullName: string
  email: string
  phone: string
  recipientName: string
  recipientTaxId: string
  deliveryAddress: string
  deliveryCommune: string
  deliveryRegion: string
  deliveryNotes: string
  taxId: string
  taxName: string
  taxBusinessActivity: string
  taxAddress: string
  taxCommune: string
  taxRegion: string
  taxEmail: string
}

export type OrderSummary = {
  id: string
  number: string
  status: string
  currency: string
  total: string
  paymentMethod: string
  nextAction: string
  reconciliationRequired: boolean
  hasProof: boolean
  expiresAt: string
  confirmedAt: string | null
  createdAt: string
  buyer: { fullName: string } | null
}

export type SellerOrderLine = {
  id: string
  productId: string
  productName: string
  productImageUrl: string | null
  quantity: number
  unitSalePrice: string
  unitCostSnapshot: string | null
  currency: string
  lineTotal: string
}

export type SellerPayment = {
  id: string
  method: string
  status: string
  amount: string
  currency: string
  feeAmount: string
  refundedAmount: string
  provider: string
  providerReference: string
  paidAt: string | null
  rejectionReason: string | null
  proof: {
    id: string
    fileName: string
    contentType: string
    privatePreviewUrl: string
    uploadedAt: string
  } | null
}

export type SellerOrder = OrderSummary & {
  subtotal: string
  feeAmount: string
  deliveryMode: string
  publicUrl: string
  publishedAt: string | null
  updatedAt: string
  costsVisible: boolean
  reconciliationMessage: string | null
  lines: SellerOrderLine[]
  buyer: BuyerView | null
  payment: SellerPayment | null
  timeline: Array<{
    id: string
    eventType: string
    title: string
    detail: string
    actorName: string
    createdAt: string
  }>
  allowedActions: OrderAllowedActions
  shipmentId: string | null
  latestLabel: ShipmentLabel | null
}

export type PublicOrder = {
  number: string
  status: string
  statusLabel: string
  paymentStatus: string
  currency: string
  subtotal: string
  feeAmount: string
  total: string
  deliveryMode: string
  paymentMethod: string
  availablePaymentMethods: string[]
  bankTransferInstructions: string
  bankDetails: {
    bankName: string
    accountType: string
    accountTypeLabel: string
    accountNumber: string
    taxId: string
    confirmationEmail: string
  } | null
  expiresAt: string
  createdAt: string
  rejectionReason: string | null
  isExpired: boolean
  seller: {
    displayName: string
    contactEmail: string
    contactPhone: string
    logoUrl: string | null
  }
  buyer: BuyerView | null
  lines: Array<{
    id: string
    name: string
    description: string
    imageUrl: string | null
    photos: string[]
    attributes: Array<{ label: string; value: string }>
    quantity: number
    unitSalePrice: string
    currency: string
    lineTotal: string
  }>
}

export type PublicOrderStatus = {
  number: string
  status: string
  statusLabel: string
  paymentStatus: string
  expiresAt: string
  updatedAt: string
  rejectionReason: string | null
  isExpired: boolean
}

export type SalesBalance = {
  currency: string
  timezone: string
  grossSales: string
  refunds: string
  netSales: string
  knownCostOfGoods: string
  grossMargin: string
  pendingAmount: string
  operationCount: number
  recognizedLineCount: number
  costedLineCount: number
  costCoverage: string
  marginComplete: boolean
  inventoryAtCost: string
  inventoryAtSalePrice: string
  inventoryPotentialMargin: string
  inventoryValuationComplete: boolean
  isPartial: boolean
  warnings: string[]
}

export type BalanceBreakdown = {
  key: string
  label: string
  periodStart: string | null
  periodEnd: string | null
  productId: string | null
  paymentMethod: string | null
  status: string | null
  grossSales: string
  refunds: string
  netSales: string
  knownCostOfGoods: string
  grossMargin: string
  pendingAmount: string
  operationCount: number
  costCoverage: string
  marginComplete: boolean
}

export type ReconciliationIssue = {
  id: string
  kind: string
  status: string
  message: string
  orderId: string | null
  orderNumber: string | null
  providerReference: string
  expectedAmount: string | null
  actualAmount: string | null
  feeDifference: string | null
  attempts: number
  lastAttemptAt: string | null
  createdAt: string
  canRetry: boolean
}

export type SalesOrderFilter = {
  search?: string | null
  statuses?: string[] | null
  paymentMethods?: string[] | null
  productId?: string | null
  productIds?: string[] | null
  dateFrom?: string | null
  dateTo?: string | null
}

export type SalesBalanceFilter = {
  dateFrom?: string | null
  dateTo?: string | null
  productId?: string | null
  productIds?: string[] | null
  paymentMethods?: string[] | null
  statuses?: string[] | null
  groupBy?: string | null
}

export type CreateOrderRequest = {
  lines: Array<{ productId: string; quantity: number; unitSalePrice: string }>
  deliveryMode: string
  paymentMethod: string
  idempotencyKey: string
}

export type PublishOrderLinkRequest = {
  orderId: string
  idempotencyKey: string
}

export type SetBuyerDetailsRequest = {
  token: string
  fullName: string
  email?: string | null
  phone?: string | null
  recipientName?: string | null
  recipientTaxId?: string | null
  deliveryAddress?: string | null
  deliveryCommune?: string | null
  deliveryRegion?: string | null
  deliveryNotes?: string | null
  taxId?: string | null
  taxName?: string | null
  taxBusinessActivity?: string | null
  taxAddress?: string | null
  taxCommune?: string | null
  taxRegion?: string | null
  taxEmail?: string | null
  paymentMethod?: string | null
  idempotencyKey?: string | null
  turnstileToken?: string | null
}

export type UpdateOrderBuyerRequest = Omit<SetBuyerDetailsRequest, 'token'> & {
  orderId: string
  idempotencyKey: string
}

export type ReviewPaymentProofRequest = {
  orderId: string
  decision: 'approve' | 'reject'
  reason?: string | null
  idempotencyKey: string
}

export type ConfirmManualPaymentRequest = {
  orderId: string
  amount: string
  paidAt: string
  note?: string | null
  idempotencyKey: string
}

export type CancelOrderRequest = {
  orderId: string
  reason: string
  idempotencyKey: string
}

export type RestoreOrderRequest = {
  orderId: string
  idempotencyKey: string
}

export type RefundPaymentRequest = {
  orderId: string
  reason: string
  idempotencyKey: string
}

export type ResendOrderLinkRequest = {
  orderId: string
  idempotencyKey: string
}

export type SendOfferLinkRequest = {
  orderId: string
  email: string
  idempotencyKey: string
}

export type ReissueBankTransferOfferRequest = {
  orderId: string
  idempotencyKey: string
}

export type RetryReconciliationRequest = {
  issueId: string
  idempotencyKey: string
}

export type InitiateCheckoutRequest = {
  token: string
  idempotencyKey: string
}

function mapBuyer(
  buyer: {
    name: string
    email: string
    phone: string
    recipientName: string
    recipientTaxId: string
    addressLine: string
    commune: string
    region: string
    deliveryNotes: string
    taxId: string
    taxName: string
    taxActivity: string
    taxAddress: string
    taxCommune: string
    taxRegion: string
    taxEmail: string
  } | null,
): BuyerView | null {
  if (!buyer) return null
  return {
    fullName: buyer.name,
    email: buyer.email,
    phone: buyer.phone,
    recipientName: buyer.recipientName,
    recipientTaxId: buyer.recipientTaxId,
    deliveryAddress: buyer.addressLine,
    deliveryCommune: buyer.commune,
    deliveryRegion: buyer.region,
    deliveryNotes: buyer.deliveryNotes,
    taxId: buyer.taxId,
    taxName: buyer.taxName,
    taxBusinessActivity: buyer.taxActivity,
    taxAddress: buyer.taxAddress,
    taxCommune: buyer.taxCommune,
    taxRegion: buyer.taxRegion,
    taxEmail: buyer.taxEmail,
  }
}

function mapAllowedActions(actions: readonly string[]): OrderAllowedActions {
  const set = new Set(actions)
  const canReview = set.has('reviewPaymentProof')
  return {
    approveProof: canReview,
    rejectProof: canReview,
    confirmManualPayment: set.has('confirmManualPayment'),
    cancel: set.has('cancelOrder'),
    refund: set.has('refundPayment'),
    resendLink: set.has('resendOrderLink'),
    sendOfferLink: set.has('sendOfferLink'),
    reissueOffer: set.has('reissueBankTransferOffer'),
    restore: set.has('restoreOrder'),
    updateBuyer: set.has('updateOrderBuyer'),
    viewShipmentLabel: set.has('viewShipmentLabel'),
  }
}

export function mapSalesDashboard(
  dashboard: OperationSalesDashboardQuery['salesDashboard'],
): SalesDashboard {
  return {
    totalOrders: dashboard.totalOrders,
    activeOrders: dashboard.activeOrders,
    awaitingBuyerCount: dashboard.awaitingBuyer,
    awaitingPaymentCount: dashboard.awaitingPayment,
    awaitingValidationCount: dashboard.awaitingValidation,
    reconciliationRequiredCount: dashboard.reconciliationRequired,
    confirmedThisMonthAmount: dashboard.confirmedGross,
    confirmedThisMonthCount: dashboard.paidOrders,
    currency: 'CLP',
  }
}

export function mapOrderSummary(
  order: OperationSellerOrderSummaryFragment,
): OrderSummary {
  return {
    id: order.id,
    number: order.number,
    status: order.status,
    currency: order.currency,
    total: order.total,
    paymentMethod: order.paymentMethod,
    nextAction: order.nextAction,
    reconciliationRequired: order.reconciliationRequired,
    hasProof: Boolean(order.payment?.proof?.id),
    expiresAt: asString(order.reservationExpiresAt),
    confirmedAt: order.paidAt ? asString(order.paidAt) : null,
    createdAt: asString(order.createdAt),
    buyer: order.buyer ? { fullName: order.buyer.name } : null,
  }
}

export function mapSellerOrder(order: OperationSellerOrderFragment): SellerOrder {
  const summary = mapOrderSummary(order)
  const firstIssue = order.reconciliationIssues[0]
  return {
    ...summary,
    subtotal: order.total,
    feeAmount: order.payment?.feeReported ?? order.payment?.feeRequested ?? '0',
    deliveryMode: order.deliveryMode,
    publicUrl: order.publicUrl,
    publishedAt: order.publishedAt ? asString(order.publishedAt) : null,
    updatedAt: asString(order.updatedAt),
    costsVisible: order.permissions.canViewCosts,
    reconciliationMessage: firstIssue?.summary ?? null,
    lines: order.lines.map((line) => ({
      id: line.id,
      productId: line.productId,
      productName: line.productName,
      productImageUrl: null,
      quantity: line.quantity,
      unitSalePrice: line.unitSalePrice,
      unitCostSnapshot: line.unitCostSnapshot,
      currency: line.currency,
      lineTotal: line.lineTotal,
    })),
    buyer: mapBuyer(order.buyer),
    payment: order.payment
      ? {
          id: order.payment.id,
          method: order.payment.method,
          status: mapPaymentStatus(order.payment.status),
          amount: order.payment.amount,
          currency: order.payment.currency,
          feeAmount: order.payment.feeReported ?? order.payment.feeRequested,
          refundedAmount: order.payment.refundedAmount,
          provider: order.payment.provider,
          providerReference: order.payment.providerPaymentId,
          paidAt: order.payment.paidAt ? asString(order.payment.paidAt) : null,
          rejectionReason: order.payment.proof?.rejectionReason || null,
          proof: order.payment.proof
            ? {
                id: order.payment.proof.id,
                fileName: order.payment.proof.fileName,
                contentType: order.payment.proof.contentType,
                privatePreviewUrl: order.payment.proof.signedUrl ?? '',
                uploadedAt: asString(order.payment.proof.uploadedAt),
              }
            : null,
        }
      : null,
    timeline: order.timeline.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      title: event.title,
      detail: event.detail,
      actorName: '',
      createdAt: asString(event.createdAt),
    })),
    allowedActions: mapAllowedActions(order.allowedActions),
    shipmentId: order.shipment?.id ?? null,
    latestLabel: order.shipment?.latestLabel
      ? mapShipmentLabel(order.shipment.latestLabel)
      : null,
  }
}

export function mapPublicOrder(order: OperationPublicOrderFragment): PublicOrder {
  return {
    number: order.number,
    status: order.status,
    statusLabel: order.statusLabel,
    paymentStatus: mapPaymentStatus(order.paymentStatus),
    currency: order.currency,
    subtotal: order.total,
    feeAmount: order.feeAmount ?? '0',
    total: order.total,
    deliveryMode: order.deliveryMode,
    paymentMethod: order.paymentMethod,
    availablePaymentMethods: order.availablePaymentMethods,
    bankTransferInstructions: order.bankTransferInstructions,
    bankDetails: order.bankDetails
      ? {
          bankName: order.bankDetails.bankName,
          accountType: order.bankDetails.accountType,
          accountTypeLabel: order.bankDetails.accountTypeLabel,
          accountNumber: order.bankDetails.accountNumber,
          taxId: order.bankDetails.taxId,
          confirmationEmail: order.bankDetails.confirmationEmail,
        }
      : null,
    expiresAt: asString(order.reservationExpiresAt),
    createdAt: asString(order.createdAt),
    rejectionReason: order.rejectionReason,
    isExpired: order.isExpired,
    seller: {
      displayName: order.seller.name,
      contactEmail: order.seller.businessEmail,
      contactPhone: order.seller.phone,
      logoUrl: order.seller.logoUrl ?? null,
    },
    buyer: mapBuyer(order.buyer),
    lines: order.lines.map((line) => ({
      id: line.id,
      name: line.productName,
      description: '',
      imageUrl: line.imageUrl ?? line.photos[0] ?? null,
      photos: line.photos,
      attributes: line.attributes.map((attribute) => ({
        label: attribute.label,
        value: attribute.value,
      })),
      quantity: line.quantity,
      unitSalePrice: line.unitSalePrice,
      currency: line.currency,
      lineTotal: line.lineTotal,
    })),
  }
}

export function mapPublicOrderStatus(status: {
  number: string
  status: string
  statusLabel: string
  paymentStatus: string | null
  reservationExpiresAt: unknown
  updatedAt: unknown
  rejectionReason: string | null
  isExpired: boolean
}): PublicOrderStatus {
  return {
    number: status.number,
    status: status.status,
    statusLabel: status.statusLabel,
    paymentStatus: mapPaymentStatus(status.paymentStatus),
    expiresAt: asString(status.reservationExpiresAt),
    updatedAt: asString(status.updatedAt),
    rejectionReason: status.rejectionReason,
    isExpired: status.isExpired,
  }
}

export function mapSalesBalance(
  balance: OperationSalesBalanceQuery['salesBalance'],
): SalesBalance {
  return {
    currency: balance.currency,
    timezone: balance.timezone,
    grossSales: balance.confirmedGross,
    refunds: balance.refunds,
    netSales: balance.netSales,
    knownCostOfGoods: balance.knownCogs,
    grossMargin: balance.grossMargin,
    pendingAmount: balance.pendingAmount,
    operationCount: balance.operations,
    recognizedLineCount: balance.recognizedLines,
    costedLineCount: balance.knownCostLines,
    costCoverage: balance.costCoverage,
    marginComplete: !balance.costIncomplete,
    inventoryAtCost: balance.inventoryAtCost,
    inventoryAtSalePrice: balance.inventoryAtSalePrice,
    inventoryPotentialMargin: balance.inventoryPotentialMargin,
    inventoryValuationComplete: balance.inventoryValuationIncomplete !== true,
    isPartial: false,
    warnings: [],
  }
}

function coverage(known: number, recognized: number): string {
  if (recognized <= 0) return '1'
  return String(known / recognized)
}

function breakdownLabel(
  row: OperationSalesBalanceBreakdownQuery['salesBalanceBreakdown']['nodes'][number],
  groupBy: string,
): string {
  if (groupBy === 'product') return row.productName
  if (groupBy === 'payment_method') return row.paymentMethod
  if (groupBy === 'status') return row.status
  return asString(row.period)
}

export function mapBalanceBreakdownRow(
  row: OperationSalesBalanceBreakdownQuery['salesBalanceBreakdown']['nodes'][number],
  groupBy = 'period',
): BalanceBreakdown {
  const period = asString(row.period)
  return {
    key: `${period}:${row.productId}:${row.paymentMethod}:${row.status}`,
    label: breakdownLabel(row, groupBy),
    periodStart: period || null,
    periodEnd: period || null,
    productId: row.productId,
    paymentMethod: row.paymentMethod,
    status: row.status,
    grossSales: row.confirmedGross,
    refunds: row.refunds,
    netSales: row.netSales,
    knownCostOfGoods: row.knownCogs,
    grossMargin: row.grossMargin,
    pendingAmount: '0',
    operationCount: row.quantity,
    costCoverage: coverage(row.knownCostLines, row.recognizedLines),
    marginComplete: !row.costIncomplete,
  }
}

export function mapReconciliationIssue(
  issue: OperationReconciliationIssueFragment,
): ReconciliationIssue {
  const details = parseJsonObject(issue.details)
  return {
    id: issue.id,
    kind: issue.kind,
    status: issue.status,
    message: issue.summary,
    orderId: issue.orderId,
    orderNumber: issue.orderNumber,
    providerReference: issue.providerReference ?? '',
    expectedAmount: moneyFromDetails(details, 'expectedAmount'),
    actualAmount: moneyFromDetails(details, 'actualAmount'),
    feeDifference: moneyFromDetails(details, 'feeDifference'),
    attempts: issue.retryCount,
    lastAttemptAt: issue.lastAttemptAt ? asString(issue.lastAttemptAt) : null,
    createdAt: asString(issue.createdAt),
    canRetry: issue.canRetry,
  }
}

function normalizeStatuses(statuses?: string[] | null): string[] | null {
  if (!statuses) return null
  return statuses.map((status) => (status === 'sold' ? 'paid' : status))
}

export function toOrderFilter(
  filter?: SalesOrderFilter | null,
): OperationOrderFilterInput | null {
  if (!filter) return null
  const productId = filter.productId ?? filter.productIds?.[0] ?? null
  return {
    search: filter.search ?? null,
    statuses: normalizeStatuses(filter.statuses),
    paymentMethods: filter.paymentMethods ?? null,
    productId,
    dateFrom: filter.dateFrom ?? null,
    dateTo: filter.dateTo ?? null,
  }
}

export function toBalanceFilter(
  filter?: SalesBalanceFilter | null,
): OperationSalesBalanceFilterInput | null {
  if (!filter) return null
  const productId = filter.productId ?? filter.productIds?.[0] ?? null
  return {
    dateFrom: filter.dateFrom ?? null,
    dateTo: filter.dateTo ?? null,
    productId,
    paymentMethods: filter.paymentMethods ?? null,
    statuses: normalizeStatuses(filter.statuses),
  }
}

export function toBuyerDetailsInput(
  input: SetBuyerDetailsRequest,
): OperationBuyerDetailsInput {
  return {
    name: input.fullName,
    email: input.email ?? null,
    phone: input.phone ?? null,
    recipientName: input.recipientName ?? null,
    recipientTaxId: input.recipientTaxId ?? null,
    addressLine: input.deliveryAddress ?? null,
    commune: input.deliveryCommune ?? null,
    region: input.deliveryRegion ?? null,
    deliveryNotes: input.deliveryNotes ?? null,
    taxId: input.taxId ?? null,
    taxName: input.taxName ?? null,
    taxActivity: input.taxBusinessActivity ?? null,
    taxAddress: input.taxAddress ?? null,
    taxCommune: input.taxCommune ?? null,
    taxRegion: input.taxRegion ?? null,
    taxEmail: input.taxEmail ?? null,
    turnstileToken: input.turnstileToken ?? null,
  }
}
