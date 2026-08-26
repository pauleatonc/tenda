import type { VariablesOf } from '@graphql-typed-document-node/core'
import {
  ConfirmReturnToStockDocument,
  GenerateShipmentLabelDocument,
  MarkShipmentDispatchedDocument,
  OpenPublicTicketDocument,
  PublicShipmentDocument,
  RegisterReturnCaseDocument,
  RescheduleFollowUpDocument,
  ResolveTicketDocument,
  SendTicketMessageDocument,
  ShipmentDocument,
  ShipmentsDocument,
  ShippingDashboardDocument,
  TicketDocument,
  UpdateShipmentDocument,
  mapPublicShipment,
  mapSellerShipment,
  mapSellerTicket,
  mapShipmentSummary,
  mapShippingDashboard,
  toOpenPublicTicketInput,
  toShipmentFilter,
  toUpdateShipmentInput,
  type ConfirmPublicShipmentResult,
  type ConfirmReturnToStockRequest,
  type GenerateShipmentLabelRequest,
  type MarkShipmentDispatchedRequest,
  type OpenPublicTicketRequest,
  type RegisterReturnCaseRequest,
  type RescheduleFollowUpRequest,
  type ResolveTicketRequest,
  type SendTicketMessageRequest,
  type ShipmentFilter,
  type UpdateShipmentRequest,
} from '@tenda/api-client'

import { graphqlRequest, request } from '../lib/http'

export type {
  ConfirmPublicShipmentResult,
  ConfirmReturnToStockRequest,
  GenerateShipmentLabelRequest,
  MarkShipmentDispatchedRequest,
  OpenPublicTicketRequest,
  RegisterReturnCaseRequest,
  RescheduleFollowUpRequest,
  ResolveTicketRequest,
  SendTicketMessageRequest,
  ShipmentFilter,
  UpdateShipmentRequest,
}

export type ShippingDashboard = Awaited<ReturnType<typeof fetchShippingDashboard>>
export type ShipmentListPage = Awaited<ReturnType<typeof fetchShipments>>
export type ShipmentSummary = ShipmentListPage['nodes'][number]
export type SellerShipment = NonNullable<Awaited<ReturnType<typeof fetchShipment>>>
export type PublicShipment = NonNullable<Awaited<ReturnType<typeof fetchPublicShipment>>>
export type SellerTicket = NonNullable<Awaited<ReturnType<typeof fetchTicket>>>

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
  } satisfies VariablesOf<typeof ShipmentsDocument>)
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

export async function fetchPublicShipment(token: string) {
  const data = await graphqlRequest(PublicShipmentDocument, { token })
  return data.publicShipment ? mapPublicShipment(data.publicShipment) : null
}

export async function confirmPublicShipment(input: {
  token: string
  outcome: 'received' | 'needs_help'
  comment?: string
  turnstileToken: string
  idempotencyKey: string
}): Promise<ConfirmPublicShipmentResult> {
  return request<ConfirmPublicShipmentResult>(
    `/api/v1/public/shipments/${encodeURIComponent(input.token)}/confirm`,
    {
      method: 'POST',
      body: JSON.stringify({
        outcome: input.outcome,
        comment: input.comment ?? '',
        turnstileToken: input.turnstileToken,
        idempotencyKey: input.idempotencyKey,
      }),
    },
  )
}

export async function openPublicTicket(input: OpenPublicTicketRequest) {
  const data = await graphqlRequest(OpenPublicTicketDocument, {
    token: input.token,
    input: toOpenPublicTicketInput(input),
    idempotencyKey: input.idempotencyKey,
  })
  return {
    replayed: data.openPublicTicket.replayed,
    ticket: mapSellerTicket(data.openPublicTicket.ticket),
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
  publicShipment: (token: string) => ['public-shipment', token] as const,
}
