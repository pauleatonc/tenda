import { describe, expect, it } from 'vitest'

import {
  aggregateQuantities,
  createEmptySaleDraft,
  loadSaleDraft,
  resolveSaleDraftOnEnter,
  saleDraftTotal,
  saveSaleDraft,
  type SaleDraftLine,
  validateDraftLines,
} from '../model'

function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  }
}

function line(overrides: Partial<SaleDraftLine>): SaleDraftLine {
  return {
    clientId: crypto.randomUUID(),
    productId: 'product-1',
    productName: 'Vela',
    available: 3,
    reserved: 1,
    quantity: 1,
    referencePrice: '5000',
    unitSalePrice: '5000',
    discountPercent: '',
    ...overrides,
  }
}

describe('borrador de nueva venta', () => {
  it('conserva líneas del mismo producto con precios distintos', () => {
    const lines = [
      line({ clientId: 'line-a', unitSalePrice: '4500' }),
      line({ clientId: 'line-b', unitSalePrice: '4000' }),
    ]

    expect(validateDraftLines(lines).valid).toBe(true)
    expect(aggregateQuantities(lines).get('product-1')).toBe(2)
    expect(saleDraftTotal(lines)).toBe(8500)
    expect(lines.map((item) => item.unitSalePrice)).toEqual(['4500', '4000'])
  })

  it('valida disponibilidad agregada entre líneas repetidas', () => {
    const lines = [
      line({ clientId: 'line-a', quantity: 2 }),
      line({ clientId: 'line-b', quantity: 2 }),
    ]

    const result = validateDraftLines(lines)

    expect(result.valid).toBe(false)
    expect(result.productErrors['product-1']).toContain('seleccionaste 4')
    expect(result.productErrors['product-1']).toContain('hay 3 disponibles')
  })

  it('persiste las mismas claves idempotentes durante un fallo o recarga', () => {
    const storage = memoryStorage()
    const original = {
      ...createEmptySaleDraft(),
      lines: [line({ clientId: 'line-stable' })],
      step: 3 as const,
    }

    saveSaleDraft(original, storage)
    const restoredAfterNetworkFailure = loadSaleDraft(storage)

    expect(restoredAfterNetworkFailure.idempotencyKey).toBe(original.idempotencyKey)
    expect(restoredAfterNetworkFailure.publishIdempotencyKey).toBe(
      original.publishIdempotencyKey,
    )
    expect(restoredAfterNetworkFailure.lines).toEqual(original.lines)
    expect(restoredAfterNetworkFailure.step).toBe(3)
  })

  it('retoma un borrador incompleto y descarta un resultado ya creado', () => {
    const storage = memoryStorage()
    const incomplete = {
      ...createEmptySaleDraft(),
      lines: [line({ clientId: 'line-open' })],
      step: 2 as const,
    }
    saveSaleDraft(incomplete, storage)
    expect(resolveSaleDraftOnEnter(storage)).toEqual({
      draft: expect.objectContaining({ step: 2, lines: incomplete.lines }),
      completed: null,
    })

    saveSaleDraft(
      {
        ...createEmptySaleDraft(),
        step: 4,
        createdOrderId: 'order-ready',
        publicUrl: 'https://shop.test/p/token',
      },
      storage,
    )
    const resolved = resolveSaleDraftOnEnter(storage)
    expect(resolved.completed).toEqual({
      orderId: 'order-ready',
      publicUrl: 'https://shop.test/p/token',
    })
    expect(resolved.draft.step).toBe(1)
    expect(resolved.draft.createdOrderId).toBeNull()
    expect(loadSaleDraft(storage).step).toBe(1)
  })
})
