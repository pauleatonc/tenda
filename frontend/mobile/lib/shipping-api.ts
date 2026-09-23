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

import { graphqlRequest } from './graphql'

export type { GenerateShipmentLabelRequest, RegisterShipmentDispatchRequest, ShipmentFilter }

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

export type ShippingDashboard = Awaited<ReturnType<typeof fetchShippingDashboard>>
export type ShipmentListPage = Awaited<ReturnType<typeof fetchShipments>>
export type ShipmentCard = ShipmentListPage['nodes'][number]
export type SellerShipment = NonNullable<Awaited<ReturnType<typeof fetchShipment>>>

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
