import type { VariablesOf } from '@graphql-typed-document-node/core'
import {
  GenerateShipmentLabelDocument,
  RegisterShipmentDispatchDocument,
  ShipmentDocument,
  ShipmentsDocument,
  ShippingDashboardDocument,
  mapSellerShipment,
  mapShipmentSummary,
  mapShippingDashboard,
  toRegisterShipmentDispatchInput,
  toShipmentFilter,
  type GenerateShipmentLabelRequest,
  type RegisterShipmentDispatchRequest,
  type ShipmentFilter,
} from '@tenda/api-client'

import { graphqlRequest } from '../lib/http'

export type { GenerateShipmentLabelRequest, RegisterShipmentDispatchRequest, ShipmentFilter }

type ShipmentListPage = Awaited<ReturnType<typeof fetchShipments>>
export type ShipmentSummary = ShipmentListPage['nodes'][number]
export type SellerShipment = NonNullable<Awaited<ReturnType<typeof fetchShipment>>>

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

export async function registerShipmentDispatch(input: RegisterShipmentDispatchRequest) {
  const data = await graphqlRequest(RegisterShipmentDispatchDocument, {
    shipmentId: input.shipmentId,
    input: toRegisterShipmentDispatchInput(input),
    idempotencyKey: input.idempotencyKey,
  })
  return {
    replayed: data.registerShipmentDispatch.replayed,
    shipment: mapSellerShipment(data.registerShipmentDispatch.shipment),
  }
}

export async function generateShipmentLabel(input: GenerateShipmentLabelRequest) {
  const data = await graphqlRequest(GenerateShipmentLabelDocument, {
    shipmentId: input.shipmentId,
    idempotencyKey: input.idempotencyKey,
  })
  const shipment = mapSellerShipment(data.generateShipmentLabel.shipment)
  return {
    replayed: data.generateShipmentLabel.replayed,
    label: shipment.latestLabel,
    shipment,
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
}
