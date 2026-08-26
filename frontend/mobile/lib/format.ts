/**
 * Formatting is done by hand instead of `Intl` because Hermes builds ship with
 * a trimmed ICU: CLP has no decimals and Chile groups thousands with a dot, so
 * the rules are short enough to keep identical on every device.
 */
export function formatQuantity(value: number): string {
  const rounded = Math.round(value)
  const digits = Math.abs(rounded).toString()
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return rounded < 0 ? `−${grouped}` : grouped
}

/**
 * `null` means "sin precio de referencia" and `0` means "gratis"; the spec asks
 * for those two to look different, so `—` is reserved for the null case.
 */
export function formatPrice(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  const amount = Number(value)
  return Number.isFinite(amount) ? `$${formatQuantity(amount)}` : '—'
}

export function formatSignedQuantity(value: number): string {
  return value < 0 ? formatQuantity(value) : `+${formatQuantity(value)}`
}

const MONTHS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
]

export function formatDate(value: unknown): string {
  if (typeof value !== 'string' || !value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'
  const day = parsed.getDate()
  const month = MONTHS[parsed.getMonth()]
  const hours = parsed.getHours().toString().padStart(2, '0')
  const minutes = parsed.getMinutes().toString().padStart(2, '0')
  return `${day} ${month} ${parsed.getFullYear()}, ${hours}:${minutes}`
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
