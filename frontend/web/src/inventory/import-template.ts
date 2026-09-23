export type ImportColumn = {
  destination: string
  header: string
  required: boolean
}

const CORE_IMPORT_COLUMNS: ImportColumn[] = [
  { destination: 'name', header: 'Nombre', required: true },
  { destination: 'initialQuantity', header: 'Cantidad inicial', required: false },
  { destination: 'catalogStatus', header: 'Estado de catálogo', required: false },
  { destination: 'purchasePrice', header: 'Precio de compra', required: false },
  { destination: 'salePrice', header: 'Precio de venta', required: false },
]

export function importColumnsForFields(
  fields: { key: string; label: string }[],
): ImportColumn[] {
  const used = new Set(CORE_IMPORT_COLUMNS.map((column) => column.header.toLocaleLowerCase('es-CL')))
  const extra: ImportColumn[] = []
  for (const field of fields) {
    let header = field.label.trim()
    if (used.has(header.toLocaleLowerCase('es-CL'))) {
      header = `${field.label.trim()} (${field.key})`
    }
    used.add(header.toLocaleLowerCase('es-CL'))
    extra.push({
      destination: `extraAttributes.${field.key}`,
      header,
      required: false,
    })
  }
  return [...CORE_IMPORT_COLUMNS, ...extra]
}

const HEADER_ALIASES: Record<string, string[]> = {
  name: ['nombre', 'producto', 'name'],
  initialQuantity: [
    'cantidad',
    'cantidad inicial',
    'stock',
    'stock inicial',
    'initial quantity',
  ],
  catalogStatus: ['estado', 'estado de catálogo', 'estado catálogo', 'catalog status'],
  purchasePrice: ['precio de compra', 'precio compra', 'costo', 'purchase price'],
  salePrice: ['precio de venta', 'precio venta', 'precio', 'sale price'],
}

export function mappingFromImportHeaders(
  headers: string[],
  columns: ImportColumn[],
): Record<string, string> {
  const folded = new Map(
    headers
      .map((header) => header.trim())
      .filter(Boolean)
      .map((header) => [header.toLocaleLowerCase('es-CL'), header] as const),
  )
  const mapping: Record<string, string> = {}
  for (const column of columns) {
    const source = folded.get(column.header.toLocaleLowerCase('es-CL'))
    if (source) mapping[column.destination] = source
  }
  const used = new Set(Object.values(mapping).map((header) => header.toLocaleLowerCase('es-CL')))
  for (const [destination, aliases] of Object.entries(HEADER_ALIASES)) {
    if (mapping[destination]) continue
    const source = aliases
      .map((alias) => folded.get(alias))
      .find((header) => header && !used.has(header.toLocaleLowerCase('es-CL')))
    if (source) {
      mapping[destination] = source
      used.add(source.toLocaleLowerCase('es-CL'))
    }
  }
  return mapping
}

const INVALID_IMPORT_FILE_MESSAGE =
  'No se pudo reconocer el formato de la planilla. Por favor descargue el formato indicado e intente de nuevo.'

export function humanImportFailure(code?: string | null, fallback?: string): string {
  if (code === 'INVALID_IMPORT_FILE' || fallback === 'INVALID_IMPORT_FILE') {
    return INVALID_IMPORT_FILE_MESSAGE
  }
  return fallback ?? 'No pudimos procesar la planilla. Inténtalo de nuevo.'
}

export function downloadBase64File(
  fileName: string,
  contentType: string,
  contentBase64: string,
): void {
  const binary = atob(contentBase64)
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  const blob = new Blob([bytes], { type: contentType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
