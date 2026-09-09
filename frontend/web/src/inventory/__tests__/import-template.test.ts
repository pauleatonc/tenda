import { describe, expect, it } from 'vitest'

import {
  humanImportFailure,
  importColumnsForFields,
  mappingFromImportHeaders,
} from '../import-template'

describe('planilla de importación', () => {
  it('mapea los encabezados canónicos y las columnas propias', () => {
    const columns = importColumnsForFields([{ key: 'aroma', label: 'Aroma' }])
    expect(mappingFromImportHeaders(
      [
        'Nombre',
        'Cantidad inicial',
        'Estado de catálogo',
        'Precio de compra',
        'Precio de venta',
        'Aroma',
      ],
      columns,
    )).toEqual({
      name: 'Nombre',
      initialQuantity: 'Cantidad inicial',
      catalogStatus: 'Estado de catálogo',
      purchasePrice: 'Precio de compra',
      salePrice: 'Precio de venta',
      'extraAttributes.aroma': 'Aroma',
    })
  })

  it('reconoce alias de archivos antiguos sin pisar la planilla', () => {
    const columns = importColumnsForFields([])
    expect(mappingFromImportHeaders(['Nombre', 'Cantidad'], columns)).toEqual({
      name: 'Nombre',
      initialQuantity: 'Cantidad',
    })
  })

  it('explica INVALID_IMPORT_FILE sin mostrar el código técnico', () => {
    expect(humanImportFailure('INVALID_IMPORT_FILE')).toBe(
      'No se pudo reconocer el formato de la planilla. Por favor descargue el formato indicado e intente de nuevo.',
    )
  })
})
