export const shipmentStatusLabels: Record<string, string> = {
  pending: 'Pendiente',
  preparing: 'En preparación',
  dispatched: 'Despachado',
  delivery_check: 'Chequeo de entrega',
  delivered: 'Entregado',
  issue: 'Incidencia',
  returned: 'Devuelto',
  cancelled: 'Cancelado',
  closed: 'Cerrado',
}

export const deliveryModeLabels: Record<string, string> = {
  shipping: 'Despacho',
  pickup: 'Retiro',
  coordinated: 'Entrega coordinada',
}

export const nextActionLabels: Record<string, string> = {
  prepare: 'Preparar envío',
  dispatch: 'Marcar despachado',
  check_delivery: 'Chequear entrega',
  confirm_delivery: 'Confirmar entrega',
  review_issue: 'Revisar incidencia',
  reply_ticket: 'Responder consulta',
  close: 'Cerrar envío',
  none: 'Sin acción pendiente',
}

export const ticketStatusLabels: Record<string, string> = {
  open: 'Abierta',
  awaiting_seller: 'Espera tu respuesta',
  awaiting_buyer: 'Espera al comprador',
  resolved: 'Resuelta',
  closed: 'Cerrada',
}

export const ticketCategoryLabels: Record<string, string> = {
  not_received: 'No llegó',
  damaged: 'Llegó dañado',
  wrong_item: 'Producto equivocado',
  other: 'Otra consulta',
}

export const followUpKindLabels: Record<string, string> = {
  delivery_check: 'Chequeo de entrega',
  reminder: 'Recordatorio',
  autoclose: 'Autocierre',
}

export const returnCaseKindLabels: Record<string, string> = {
  lost: 'Pérdida',
  rejected: 'Rechazo',
  returned: 'Devolución',
  other: 'Otro',
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

export function toDateTimeLocal(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`
}

export function fromDateTimeLocal(value: string): string {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString()
}

export function translated(
  labels: Record<string, string>,
  value: string | null | undefined,
): string {
  if (!value) return '—'
  return labels[value] ?? value.replaceAll('_', ' ')
}

export function statusTone(status: string): string {
  if (['dispatched', 'delivered', 'closed'].includes(status)) return 'success'
  if (['cancelled', 'returned', 'issue'].includes(status)) return 'error'
  return 'warning'
}

export function destinationLine(shipment: {
  addressLine?: string
  municipality: string
  city: string
}): string {
  return [shipment.addressLine, shipment.municipality, shipment.city]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(', ')
}
