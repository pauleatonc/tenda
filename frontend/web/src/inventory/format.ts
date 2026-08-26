const clpFormatter = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
})

const dateFormatter = new Intl.DateTimeFormat('es-CL', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

/**
 * `null` means "sin precio de referencia" and `0` means "gratis"; the spec asks
 * for those two to look different, so `—` is reserved for the null case.
 */
export function formatPrice(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  const amount = Number(value)
  return Number.isFinite(amount) ? clpFormatter.format(amount) : '—'
}

export function formatDate(value: unknown): string {
  if (typeof value !== 'string' || !value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '—' : dateFormatter.format(parsed)
}

export function formatQuantity(value: number): string {
  return new Intl.NumberFormat('es-CL').format(value)
}

export function formatSignedQuantity(value: number): string {
  const formatted = formatQuantity(Math.abs(value))
  return value < 0 ? `−${formatted}` : `+${formatted}`
}

export const movementLabels: Record<string, string> = {
  entry: 'Entrada',
  exit: 'Salida',
  shrinkage: 'Merma',
  correction: 'Corrección',
}

export const catalogStatusLabels: Record<string, string> = {
  active: 'Activo',
  inactive: 'Inactivo',
  archived: 'Archivado',
}

export const fieldTypeLabels: Record<string, string> = {
  short_text: 'Texto corto',
  decimal: 'Número decimal',
  date: 'Fecha',
  boolean: 'Sí / No',
  single_select: 'Selección única',
}

export function formatAttribute(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  return String(value)
}
