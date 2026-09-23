export const shipmentStatuses = ['pending', 'dispatched', 'delivered'] as const

export const shipmentStatusLabels: Record<string, string> = {
  pending: 'Pendiente',
  dispatched: 'Despachado',
  delivered: 'Entregado',
}

export const deliveryModes = ['shipping', 'pickup', 'coordinated'] as const

export const deliveryModeLabels: Record<string, string> = {
  shipping: 'Despacho',
  pickup: 'Retiro',
  coordinated: 'Entrega coordinada',
}

const dateTime = new Intl.DateTimeFormat('es-CL', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

export function formatDate(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  const parsed = new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? '—' : dateTime.format(parsed)
}

export function translated(
  labels: Record<string, string>,
  value: string | null | undefined,
): string {
  if (!value) return '—'
  return labels[value] ?? value.replaceAll('_', ' ')
}

export function statusTone(status: string): string {
  return status === 'pending' ? 'warning' : 'success'
}

export function requiresCarrier(deliveryMode: string): boolean {
  return deliveryMode === 'shipping'
}

export function registrationLabel(deliveryMode: string): string {
  return requiresCarrier(deliveryMode) ? 'Registrar despacho' : 'Registrar entrega'
}

export function registeredAt(shipment: {
  status: string
  dispatchedAt: string | null
  deliveredAt: string | null
}): string | null {
  if (shipment.status === 'dispatched') return shipment.dispatchedAt
  if (shipment.status === 'delivered') return shipment.deliveredAt
  return null
}

export function destinationLine(shipment: {
  addressLine?: string
  commune: string
  region: string
}): string {
  return [shipment.addressLine, shipment.commune, shipment.region]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(', ')
}
