import {
  ConfirmReturnToStockDocument,
  GenerateShipmentLabelDocument,
  MarkShipmentDispatchedDocument,
  RegisterReturnCaseDocument,
  RescheduleFollowUpDocument,
  ResolveTicketDocument,
  SendTicketMessageDocument,
  ShipmentDocument,
  ShipmentsDocument,
  ShippingDashboardDocument,
  TicketDocument,
  UpdateShipmentDocument,
  mapSellerShipment,
  mapSellerTicket,
  mapShipmentSummary,
  mapShippingDashboard,
  toShipmentFilter,
  toUpdateShipmentInput,
  type ConfirmReturnToStockRequest,
  type GenerateShipmentLabelRequest,
  type MarkShipmentDispatchedRequest,
  type RegisterReturnCaseRequest,
  type RescheduleFollowUpRequest,
  type ResolveTicketRequest,
  type SendTicketMessageRequest,
  type ShipmentFilter,
  type UpdateShipmentRequest,
} from '@tenda/api-client'

import { graphqlRequest } from './graphql'

export type {
  ConfirmReturnToStockRequest,
  GenerateShipmentLabelRequest,
  MarkShipmentDispatchedRequest,
  RegisterReturnCaseRequest,
  RescheduleFollowUpRequest,
  ResolveTicketRequest,
  SendTicketMessageRequest,
  ShipmentFilter,
  UpdateShipmentRequest,
}

export async function fetchShippingDashboard() {
  const data = await graphqlRequest(ShippingDashboardDocument, {})
  return mapShippingDashboard(data.shippingDashboard)
}

export async function fetchShipments(variables: {
  filter?: ShipmentFilter | null
  first?: number | null
  after?: string | null
}) {
  const data = await graphqlRequest(ShipmentsDocument, {
    filter: toShipmentFilter(variables.filter),
    first: variables.first ?? null,
    after: variables.after ?? null,
  })
  return {
    ...data.shipments,
    nodes: data.shipments.nodes.map(mapShipmentSummary),
  }
}

export async function fetchShipment(id: string) {
  const data = await graphqlRequest(ShipmentDocument, { id })
  return data.shipment ? mapSellerShipment(data.shipment) : null
}

export async function fetchTicket(id: string) {
  const data = await graphqlRequest(TicketDocument, { id })
  return data.ticket ? mapSellerTicket(data.ticket) : null
}

export async function updateShipment(input: UpdateShipmentRequest) {
  const data = await graphqlRequest(UpdateShipmentDocument, {
    shipmentId: input.shipmentId,
    input: toUpdateShipmentInput(input),
    idempotencyKey: input.idempotencyKey,
  })
  return {
    replayed: data.updateShipment.replayed,
    shipment: mapSellerShipment(data.updateShipment.shipment),
  }
}

export async function markShipmentDispatched(input: MarkShipmentDispatchedRequest) {
  const data = await graphqlRequest(MarkShipmentDispatchedDocument, {
    shipmentId: input.shipmentId,
    comment: input.comment ?? null,
    idempotencyKey: input.idempotencyKey,
  })
  return {
    replayed: data.markShipmentDispatched.replayed,
    shipment: mapSellerShipment(data.markShipmentDispatched.shipment),
  }
}

export async function generateShipmentLabel(input: GenerateShipmentLabelRequest) {
  const data = await graphqlRequest(GenerateShipmentLabelDocument, {
    shipmentId: input.shipmentId,
    idempotencyKey: input.idempotencyKey,
  })
  return {
    replayed: data.generateShipmentLabel.replayed,
    label: mapSellerShipment(data.generateShipmentLabel.shipment).latestLabel,
    shipment: mapSellerShipment(data.generateShipmentLabel.shipment),
  }
}

export async function sendTicketMessage(input: SendTicketMessageRequest) {
  const data = await graphqlRequest(SendTicketMessageDocument, {
    ticketId: input.ticketId,
    body: input.body,
    idempotencyKey: input.idempotencyKey,
    token: input.token ?? null,
    turnstileToken: input.turnstileToken ?? null,
  })
  return {
    replayed: data.sendTicketMessage.replayed,
    ticket: mapSellerTicket(data.sendTicketMessage.ticket),
  }
}

export async function resolveTicket(input: ResolveTicketRequest) {
  const data = await graphqlRequest(ResolveTicketDocument, {
    ticketId: input.ticketId,
    comment: input.comment ?? null,
    idempotencyKey: input.idempotencyKey,
  })
  return {
    replayed: data.resolveTicket.replayed,
    ticket: mapSellerTicket(data.resolveTicket.ticket),
  }
}

export async function rescheduleFollowUp(input: RescheduleFollowUpRequest) {
  const data = await graphqlRequest(RescheduleFollowUpDocument, {
    followUpId: input.followUpId,
    dueAt: input.dueAt,
    reason: input.reason,
    idempotencyKey: input.idempotencyKey,
  })
  return {
    replayed: data.rescheduleFollowUp.replayed,
    shipment: mapSellerShipment(data.rescheduleFollowUp.shipment),
  }
}

export async function registerReturnCase(input: RegisterReturnCaseRequest) {
  const data = await graphqlRequest(RegisterReturnCaseDocument, {
    shipmentId: input.shipmentId,
    kind: input.kind,
    notes: input.notes ?? null,
    idempotencyKey: input.idempotencyKey,
  })
  return {
    replayed: data.registerReturnCase.replayed,
    shipment: mapSellerShipment(data.registerReturnCase.shipment),
  }
}

export async function confirmReturnToStock(input: ConfirmReturnToStockRequest) {
  const data = await graphqlRequest(ConfirmReturnToStockDocument, {
    returnCaseId: input.returnCaseId,
    idempotencyKey: input.idempotencyKey,
  })
  return {
    replayed: data.confirmReturnToStock.replayed,
    shipment: mapSellerShipment(data.confirmReturnToStock.shipment),
  }
}

export type ShippingDashboard = Awaited<ReturnType<typeof fetchShippingDashboard>>
export type ShipmentListPage = Awaited<ReturnType<typeof fetchShipments>>
export type ShipmentCard = ShipmentListPage['nodes'][number]
export type SellerShipment = NonNullable<Awaited<ReturnType<typeof fetchShipment>>>
export type SellerTicket = NonNullable<Awaited<ReturnType<typeof fetchTicket>>>

export const shippingKeys = {
  root: ['shipping'] as const,
  dashboard: () => ['shipping', 'dashboard'] as const,
  shipments: (variables: {
    filter?: ShipmentFilter | null
    first?: number | null
    after?: string | null
  }) => ['shipping', 'shipments', variables] as const,
  shipment: (id: string) => ['shipping', 'shipment', id] as const,
  ticket: (id: string) => ['shipping', 'ticket', id] as const,
}
