import { newIdempotencyKey } from '../lib/http'

const clp = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
})

const dateTime = new Intl.DateTimeFormat('es-CL', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

export function formatClp(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  const amount = Number(value)
  return Number.isFinite(amount) ? clp.format(amount) : '—'
}

export function formatDate(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  const parsed = new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? '—' : dateTime.format(parsed)
}

export const orderStatusLabels: Record<string, string> = {
  draft: 'Borrador',
  reserved: 'Reservado',
  purchase_in_progress: 'Proceso de compra',
  purchase_validation: 'Validación de compra',
  paid: 'Pagado',
  sold: 'Vendido',
  cancelled: 'Cancelado',
  expired: 'Expirado',
  refunded: 'Reembolsado',
  reconciliation_required: 'Requiere conciliación',
}

export const paymentStatusLabels: Record<string, string> = {
  pending: 'Esperando pago',
  validation: 'Comprobante en validación',
  proof_submitted: 'Comprobante en validación',
  approved: 'Pago aprobado',
  paid: 'Pagado',
  rejected: 'Comprobante rechazado',
  refunded: 'Reembolsado',
  partially_refunded: 'Reembolso parcial',
  failed: 'Pago fallido',
}

export const paymentMethodLabels: Record<string, string> = {
  bank_transfer: 'Transferencia bancaria',
  cash: 'Efectivo / presencial',
  mercado_pago: 'Mercado Pago',
}

export const deliveryModeLabels: Record<string, string> = {
  shipping: 'Despacho',
  pickup: 'Retiro',
  coordinated: 'Entrega coordinada',
}

export const nextActionLabels: Record<string, string> = {
  share_link: 'Compartir enlace',
  await_buyer: 'Esperar datos',
  await_payment: 'Esperar pago',
  review_proof: 'Revisar comprobante',
  review_payment_proof: 'Revisar comprobante',
  prepare_delivery: 'Preparar entrega',
  prepare_shipment: 'Preparar entrega',
  reconcile: 'Conciliar',
  none: 'Sin acción pendiente',
}

export function translated(
  labels: Record<string, string>,
  value: string | null | undefined,
): string {
  if (!value) return '—'
  return labels[value] ?? value.replaceAll('_', ' ')
}

export function statusTone(status: string): string {
  if (['paid', 'sold', 'approved'].includes(status)) return 'success'
  if (['cancelled', 'expired', 'rejected', 'failed'].includes(status)) return 'error'
  if (['refunded'].includes(status)) return 'coming_soon'
  return 'warning'
}

export type SaleDraftLine = {
  clientId: string
  productId: string
  productName: string
  available: number
  reserved: number
  quantity: number
  referencePrice: string
  unitSalePrice: string
  discountPercent: string
}

export type SaleDraft = {
  version: 1
  step: 1 | 2 | 3 | 4
  lines: SaleDraftLine[]
  deliveryMode: 'shipping' | 'pickup' | 'coordinated'
  paymentMethod: 'bank_transfer' | 'cash' | 'mercado_pago'
  idempotencyKey: string
  publishIdempotencyKey: string
  createdOrderId: string | null
  publicUrl: string | null
  updatedAt: string
}

export const SALE_DRAFT_STORAGE_KEY = 'tenda.sales.new-draft.v1'

export function createEmptySaleDraft(): SaleDraft {
  return {
    version: 1,
    step: 1,
    lines: [],
    deliveryMode: 'shipping',
    paymentMethod: 'bank_transfer',
    idempotencyKey: newIdempotencyKey(),
    publishIdempotencyKey: newIdempotencyKey(),
    createdOrderId: null,
    publicUrl: null,
    updatedAt: new Date().toISOString(),
  }
}

function isSaleDraft(value: unknown): value is SaleDraft {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<SaleDraft>
  return (
    candidate.version === 1 &&
    typeof candidate.step === 'number' &&
    Array.isArray(candidate.lines) &&
    typeof candidate.idempotencyKey === 'string' &&
    typeof candidate.publishIdempotencyKey === 'string'
  )
}

export function loadSaleDraft(storage: Storage = window.localStorage): SaleDraft {
  try {
    const raw = storage.getItem(SALE_DRAFT_STORAGE_KEY)
    if (!raw) return createEmptySaleDraft()
    const parsed: unknown = JSON.parse(raw)
    return isSaleDraft(parsed) ? parsed : createEmptySaleDraft()
  } catch {
    return createEmptySaleDraft()
  }
}

export function saveSaleDraft(
  draft: SaleDraft,
  storage: Storage = window.localStorage,
): void {
  storage.setItem(
    SALE_DRAFT_STORAGE_KEY,
    JSON.stringify({ ...draft, updatedAt: new Date().toISOString() }),
  )
}

export function clearSaleDraft(storage: Storage = window.localStorage): void {
  storage.removeItem(SALE_DRAFT_STORAGE_KEY)
}

export type CompletedSaleNotice = {
  orderId: string
  publicUrl: string | null
}

export function isCompletedSaleDraft(draft: SaleDraft): boolean {
  return draft.step === 4 && Boolean(draft.createdOrderId)
}

export function resolveSaleDraftOnEnter(
  storage: Storage = window.localStorage,
): { draft: SaleDraft; completed: CompletedSaleNotice | null } {
  const draft = loadSaleDraft(storage)
  if (!isCompletedSaleDraft(draft) || !draft.createdOrderId) {
    return { draft, completed: null }
  }
  clearSaleDraft(storage)
  return {
    draft: createEmptySaleDraft(),
    completed: {
      orderId: draft.createdOrderId,
      publicUrl: draft.publicUrl,
    },
  }
}

export function aggregateQuantities(lines: SaleDraftLine[]): Map<string, number> {
  const quantities = new Map<string, number>()
  for (const line of lines) {
    quantities.set(line.productId, (quantities.get(line.productId) ?? 0) + line.quantity)
  }
  return quantities
}

export type LineValidation = {
  lineErrors: Record<string, string>
  productErrors: Record<string, string>
  valid: boolean
}

export function validateDraftLines(lines: SaleDraftLine[]): LineValidation {
  const lineErrors: Record<string, string> = {}
  const productErrors: Record<string, string> = {}
  const totals = aggregateQuantities(lines)

  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      lineErrors[line.clientId] = 'La cantidad debe ser un entero mayor que cero.'
    }
    const price = Number(line.unitSalePrice)
    if (!Number.isInteger(price) || price < 0) {
      lineErrors[line.clientId] = 'El precio debe ser un monto CLP entero.'
    }
    const selected = totals.get(line.productId) ?? 0
    if (selected > line.available) {
      productErrors[line.productId] =
        `${line.productName}: seleccionaste ${selected} y hay ${line.available} disponibles.`
    }
  }

  return {
    lineErrors,
    productErrors,
    valid:
      lines.length > 0 &&
      Object.keys(lineErrors).length === 0 &&
      Object.keys(productErrors).length === 0,
  }
}

export function discountedPrice(referencePrice: string, percent: string): string {
  const reference = Number(referencePrice)
  const discount = Number(percent)
  if (
    !Number.isInteger(reference) ||
    reference < 0 ||
    !Number.isFinite(discount) ||
    discount < 0 ||
    discount > 100
  ) {
    return referencePrice
  }
  return String(Math.round(reference * (1 - discount / 100)))
}

export function saleDraftTotal(lines: SaleDraftLine[]): number {
  return lines.reduce(
    (total, line) => total + line.quantity * Number(line.unitSalePrice || 0),
    0,
  )
}

export function makeSalesFilterHref(
  params: Record<string, string | null | undefined>,
): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value)
  }
  return `/app/ventas${search.size ? `?${search.toString()}` : ''}`
}
