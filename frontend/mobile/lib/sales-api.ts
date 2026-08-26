import {
  CancelOrderDocument,
  ConfirmManualPaymentDocument,
  CreateOrderDocument,
  DisconnectMercadoPagoConnectionDocument,
  OrderDocument,
  OrdersDocument,
  PublishOrderLinkDocument,
  RefundPaymentDocument,
  ResendOrderLinkDocument,
  ReviewPaymentProofDocument,
  SalesBalanceBreakdownDocument,
  SalesBalanceDocument,
  SalesDashboardDocument,
  SellerPaymentConnectionDocument,
  StartMercadoPagoConnectionDocument,
  mapBalanceBreakdownRow,
  mapOrderSummary,
  mapSalesBalance,
  mapSalesDashboard,
  mapSellerOrder,
  toBalanceFilter,
  toOrderFilter,
  type CancelOrderRequest,
  type ConfirmManualPaymentRequest,
  type CreateOrderRequest,
  type PublishOrderLinkRequest,
  type RefundPaymentRequest,
  type ResendOrderLinkRequest,
  type ReviewPaymentProofRequest,
  type SalesBalanceFilter,
  type SalesOrderFilter,
} from '@tenda/api-client'

import { graphqlRequest } from './graphql'

export async function fetchSalesDashboard() {
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

export async function fetchOrder(id: string) {
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
  return {
    ...data.salesBalanceBreakdown,
    nodes: data.salesBalanceBreakdown.nodes.map((row) => mapBalanceBreakdownRow(row)),
  }
}

export async function fetchSellerPaymentConnection() {
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

export type SalesDashboard = Awaited<ReturnType<typeof fetchSalesDashboard>>
export type SalesOrderPage = Awaited<ReturnType<typeof fetchOrders>>
export type SalesOrderCard = SalesOrderPage['nodes'][number]
export type SellerOrder = NonNullable<Awaited<ReturnType<typeof fetchOrder>>>
export type SalesBalance = Awaited<ReturnType<typeof fetchSalesBalance>>
export type SalesBalanceBreakdownPage = Awaited<
  ReturnType<typeof fetchSalesBalanceBreakdown>
>
export type SalesBalanceBreakdownRow = SalesBalanceBreakdownPage['nodes'][number]
export type SellerPaymentData = Awaited<ReturnType<typeof fetchSellerPaymentConnection>>

export const salesKeys = {
  root: ['sales'] as const,
  dashboard: () => ['sales', 'dashboard'] as const,
  orders: (variables: {
    filter?: SalesOrderFilter | null
    first?: number | null
    after?: string | null
  }) => ['sales', 'orders', variables] as const,
  order: (id: string) => ['sales', 'order', id] as const,
  balance: (filter: SalesBalanceFilter) => ['sales', 'balance', filter] as const,
  breakdown: (filter: SalesBalanceFilter) =>
    ['sales', 'balance-breakdown', filter] as const,
  paymentConnection: () => ['sales', 'payment-connection'] as const,
}
