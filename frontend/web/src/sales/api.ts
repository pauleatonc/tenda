import type { VariablesOf } from '@graphql-typed-document-node/core'
import {
  CancelOrderDocument,
  ConfirmManualPaymentDocument,
  CreateOrderDocument,
  DisconnectMercadoPagoConnectionDocument,
  InitiateMercadoPagoCheckoutDocument,
  OrderDocument,
  OrdersDocument,
  PublicOrderDocument,
  PublicOrderStatusDocument,
  PublishOrderLinkDocument,
  ReconciliationIssuesDocument,
  RefundPaymentDocument,
  RestoreOrderDocument,
  ReissueBankTransferOfferDocument,
  ResendOrderLinkDocument,
  SendOfferLinkDocument,
  RetryReconciliationDocument,
  ReviewPaymentProofDocument,
  SalesBalanceBreakdownDocument,
  SalesBalanceDocument,
  SalesDashboardDocument,
  SellerPaymentConnectionDocument,
  SetBuyerDetailsDocument,
  StartMercadoPagoConnectionDocument,
  mapBalanceBreakdownRow,
  mapOrderSummary,
  mapPublicOrder,
  mapPublicOrderStatus,
  mapReconciliationIssue,
  mapSalesBalance,
  mapSalesDashboard,
  mapSellerOrder,
  toBalanceFilter,
  toBuyerDetailsInput,
  toOrderFilter,
  type BalanceBreakdown,
  type CancelOrderRequest,
  type ConfirmManualPaymentRequest,
  type CreateOrderRequest,
  type InitiateCheckoutRequest,
  type OrderSummary,
  type PublicOrder,
  type PublicOrderStatus,
  type PublishOrderLinkRequest,
  type RefundPaymentRequest,
  type RestoreOrderRequest,
  type ReissueBankTransferOfferRequest,
  type ReconciliationIssue,
  type ResendOrderLinkRequest,
  type SendOfferLinkRequest,
  type RetryReconciliationRequest,
  type ReviewPaymentProofRequest,
  type SalesBalance,
  type SalesBalanceFilter,
  type SalesDashboard,
  type SalesOrderFilter,
  type SellerOrder,
  type SetBuyerDetailsRequest,
} from '@tenda/api-client'

import { graphqlRequest, request, uploadBinary } from '../lib/http'

export type {
  BalanceBreakdown,
  CancelOrderRequest as CancelOrderInput,
  ConfirmManualPaymentRequest as ConfirmManualPaymentInput,
  CreateOrderRequest as CreateOrderInput,
  OrderSummary,
  PublicOrder,
  PublicOrderStatus,
  PublishOrderLinkRequest as PublishOrderLinkInput,
  RefundPaymentRequest as RefundPaymentInput,
  ReconciliationIssue,
  ResendOrderLinkRequest as ResendOrderLinkInput,
  RetryReconciliationRequest as RetryReconciliationInput,
  ReviewPaymentProofRequest as ReviewPaymentProofInput,
  SalesBalance,
  SalesBalanceFilter,
  SalesDashboard,
  SellerOrder,
  SetBuyerDetailsRequest as SetBuyerDetailsInput,
}

export type PaymentConnection = Awaited<ReturnType<typeof fetchPaymentConnection>>

export async function fetchSalesDashboard(): Promise<SalesDashboard> {
  const data = await graphqlRequest(SalesDashboardDocument, {})
  return mapSalesDashboard(data.salesDashboard)
}

export async function fetchOrders(variables: {
  filter?: SalesOrderFilter | null
  first?: number | null
  after?: string | null
}) {
  const data = await graphqlRequest(OrdersDocument, {
    filter: toOrderFilter(variables.filter),
    first: variables.first ?? null,
    after: variables.after ?? null,
  })
  return {
    ...data.orders,
    nodes: data.orders.nodes.map(mapOrderSummary),
  }
}

export async function fetchOrder(id: string): Promise<SellerOrder | null> {
  const data = await graphqlRequest(OrderDocument, { id })
  return data.order ? mapSellerOrder(data.order) : null
}

export async function createOrder(input: CreateOrderRequest) {
  const data = await graphqlRequest(CreateOrderDocument, {
    input: {
      lines: input.lines,
      deliveryMode: input.deliveryMode,
      paymentMethod: input.paymentMethod,
    },
    idempotencyKey: input.idempotencyKey,
  })
  return {
    replayed: data.createOrder.replayed,
    order: mapSellerOrder(data.createOrder.order),
  }
}

export async function publishOrderLink(input: PublishOrderLinkRequest) {
  const data = await graphqlRequest(PublishOrderLinkDocument, {
    orderId: input.orderId,
    idempotencyKey: input.idempotencyKey,
  })
  return {
    replayed: data.publishOrderLink.replayed,
    publicUrl: data.publishOrderLink.publicUrl,
    order: mapSellerOrder(data.publishOrderLink.order),
  }
}

export async function fetchPublicOrder(token: string): Promise<PublicOrder | null> {
  const data = await graphqlRequest(PublicOrderDocument, { token })
  return data.publicOrder ? mapPublicOrder(data.publicOrder) : null
}

export async function setBuyerDetails(input: SetBuyerDetailsRequest) {
  const data = await graphqlRequest(SetBuyerDetailsDocument, {
    token: input.token,
    input: toBuyerDetailsInput(input),
  })
  return mapPublicOrder(data.setBuyerDetails.order)
}

export async function initiateMercadoPagoCheckout(input: InitiateCheckoutRequest) {
  const data = await graphqlRequest(InitiateMercadoPagoCheckoutDocument, {
    token: input.token,
    idempotencyKey: input.idempotencyKey,
  })
  return data.initiateMercadoPagoCheckout
}

export async function fetchPublicOrderStatus(token: string): Promise<PublicOrderStatus> {
  const data = await graphqlRequest(PublicOrderStatusDocument, { token })
  if (!data.publicOrderStatus) {
    throw new Error('No encontramos el estado de esta compra.')
  }
  return mapPublicOrderStatus(data.publicOrderStatus)
}

export async function reviewPaymentProof(input: ReviewPaymentProofRequest) {
  const data = await graphqlRequest(ReviewPaymentProofDocument, {
    orderId: input.orderId,
    approved: input.decision === 'approve',
    rejectionReason: input.reason ?? null,
    idempotencyKey: input.idempotencyKey,
  })
  return {
    replayed: data.reviewPaymentProof.replayed,
    order: mapSellerOrder(data.reviewPaymentProof.order),
  }
}

export async function confirmManualPayment(input: ConfirmManualPaymentRequest) {
  const data = await graphqlRequest(ConfirmManualPaymentDocument, {
    orderId: input.orderId,
    amount: input.amount,
    paidAt: input.paidAt,
    note: input.note ?? null,
    idempotencyKey: input.idempotencyKey,
  })
  return {
    replayed: data.confirmManualPayment.replayed,
    order: mapSellerOrder(data.confirmManualPayment.order),
  }
}

export async function cancelOrder(input: CancelOrderRequest) {
  const data = await graphqlRequest(CancelOrderDocument, {
    orderId: input.orderId,
    reason: input.reason,
    idempotencyKey: input.idempotencyKey,
  })
  return {
    replayed: data.cancelOrder.replayed,
    order: mapSellerOrder(data.cancelOrder.order),
  }
}

export async function restoreOrder(input: RestoreOrderRequest) {
  const data = await graphqlRequest(RestoreOrderDocument, {
    orderId: input.orderId,
    idempotencyKey: input.idempotencyKey,
  })
  return {
    replayed: data.restoreOrder.replayed,
    order: mapSellerOrder(data.restoreOrder.order),
  }
}

export async function refundPayment(input: RefundPaymentRequest) {
  const data = await graphqlRequest(RefundPaymentDocument, {
    orderId: input.orderId,
    reason: input.reason,
    idempotencyKey: input.idempotencyKey,
  })
  return {
    replayed: data.refundPayment.replayed,
    order: mapSellerOrder(data.refundPayment.order),
  }
}

export async function resendOrderLink(input: ResendOrderLinkRequest) {
  const data = await graphqlRequest(ResendOrderLinkDocument, {
    orderId: input.orderId,
    idempotencyKey: input.idempotencyKey,
  })
  return {
    replayed: data.resendOrderLink.replayed,
    publicUrl: data.resendOrderLink.order.publicUrl,
    order: mapSellerOrder(data.resendOrderLink.order),
  }
}

export async function sendOfferLink(input: SendOfferLinkRequest) {
  const data = await graphqlRequest(SendOfferLinkDocument, {
    orderId: input.orderId,
    email: input.email,
    idempotencyKey: input.idempotencyKey,
  })
  return {
    replayed: data.sendOfferLink.replayed,
    order: mapSellerOrder(data.sendOfferLink.order),
  }
}

export async function reissueBankTransferOffer(input: ReissueBankTransferOfferRequest) {
  const data = await graphqlRequest(ReissueBankTransferOfferDocument, {
    orderId: input.orderId,
    idempotencyKey: input.idempotencyKey,
  })
  return {
    replayed: data.reissueBankTransferOffer.replayed,
    publicUrl: data.reissueBankTransferOffer.publicUrl,
    order: mapSellerOrder(data.reissueBankTransferOffer.order),
  }
}

export async function fetchSalesBalance(filter: SalesBalanceFilter) {
  const data = await graphqlRequest(SalesBalanceDocument, {
    filter: toBalanceFilter(filter),
  })
  return mapSalesBalance(data.salesBalance)
}

export async function fetchSalesBalanceBreakdown(variables: {
  filter?: SalesBalanceFilter | null
  first?: number | null
  after?: string | null
}) {
  const data = await graphqlRequest(SalesBalanceBreakdownDocument, {
    filter: toBalanceFilter(variables.filter),
    first: variables.first ?? null,
    after: variables.after ?? null,
  })
  const groupBy = variables.filter?.groupBy ?? 'period'
  return {
    ...data.salesBalanceBreakdown,
    nodes: data.salesBalanceBreakdown.nodes.map((row) =>
      mapBalanceBreakdownRow(row, groupBy),
    ),
  }
}

export async function fetchReconciliationIssues(
  variables: VariablesOf<typeof ReconciliationIssuesDocument>,
) {
  const data = await graphqlRequest(ReconciliationIssuesDocument, variables)
  return {
    ...data.reconciliationIssues,
    nodes: data.reconciliationIssues.nodes.map(mapReconciliationIssue),
  }
}

export async function retryReconciliation(input: RetryReconciliationRequest) {
  const data = await graphqlRequest(RetryReconciliationDocument, {
    issueId: input.issueId,
    idempotencyKey: input.idempotencyKey,
  })
  return {
    replayed: data.retryReconciliation.replayed,
    issue: mapReconciliationIssue(data.retryReconciliation.issue),
  }
}

export async function fetchPaymentConnection() {
  return graphqlRequest(SellerPaymentConnectionDocument, {})
}

export async function startMercadoPagoConnection() {
  const data = await graphqlRequest(StartMercadoPagoConnectionDocument, {})
  return data.startMercadoPagoConnection.connection
}

export async function disconnectMercadoPagoConnection() {
  const data = await graphqlRequest(DisconnectMercadoPagoConnectionDocument, {})
  return data.disconnectMercadoPagoConnection.connection
}

type PublicUploadPreparation = {
  assetId: string
  uploadUrl: string
  headers: Record<string, string>
  expiresIn: number
}

export type PublicUploadCompletion = {
  assetId: string
  status: string
  orderStatus: string
}

export async function uploadPublicPaymentProof(
  token: string,
  file: File,
  onProgress?: (percentage: number) => void,
): Promise<PublicUploadCompletion> {
  const base =
    `/api/v1/public/orders/${encodeURIComponent(token)}` + '/payment-proof/uploads'
  const prepared = await request<PublicUploadPreparation>(`${base}/prepare`, {
    method: 'POST',
    body: JSON.stringify({
      purpose: 'payment_proof',
      fileName: file.name,
      contentType: file.type,
      size: file.size,
    }),
  })
  await uploadBinary(prepared.uploadUrl, file, prepared.headers, onProgress)
  return request<PublicUploadCompletion>(`${base}/complete`, {
    method: 'POST',
    body: JSON.stringify({ assetId: prepared.assetId }),
  })
}

export const salesKeys = {
  dashboard: () => ['sales', 'dashboard'] as const,
  orders: (variables: Record<string, unknown>) => ['sales', 'orders', variables] as const,
  order: (id: string) => ['sales', 'order', id] as const,
  balance: (filter: Record<string, unknown>) => ['sales', 'balance', filter] as const,
  balanceBreakdown: (variables: Record<string, unknown>) =>
    ['sales', 'balance-breakdown', variables] as const,
  reconciliation: (variables: Record<string, unknown>) =>
    ['sales', 'reconciliation', variables] as const,
  paymentConnection: () => ['sales', 'payment-connection'] as const,
  publicOrder: (token: string) => ['public-order', token] as const,
  publicStatus: (token: string) => ['public-order', token, 'status'] as const,
}
