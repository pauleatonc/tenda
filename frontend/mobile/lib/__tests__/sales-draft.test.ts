import AsyncStorage from '@react-native-async-storage/async-storage'

import { createEmptySaleDraft, resolveSaleDraftOnEnter } from '../sales-draft'

const store = AsyncStorage as jest.Mocked<typeof AsyncStorage>

describe('borrador de venta mobile', () => {
  beforeEach(() => {
    store.getItem.mockReset()
    store.setItem.mockReset()
    store.removeItem.mockReset()
  })

  it('retoma un borrador incompleto', async () => {
    const incomplete = {
      ...createEmptySaleDraft(),
      step: 'terms' as const,
      idempotencyKey: 'stable-key',
    }
    store.getItem.mockResolvedValue(JSON.stringify(incomplete))

    await expect(resolveSaleDraftOnEnter()).resolves.toEqual({
      draft: expect.objectContaining({ step: 'terms', idempotencyKey: 'stable-key' }),
      completed: null,
    })
    expect(store.removeItem).not.toHaveBeenCalled()
  })

  it('descarta un resultado ya creado y lo expone como aviso', async () => {
    const completed = {
      ...createEmptySaleDraft(),
      step: 'result' as const,
      result: {
        orderId: 'order-ready',
        orderNumber: 'V-1042',
        publicUrl: 'https://tenda.test/p/token',
      },
    }
    store.getItem.mockResolvedValue(JSON.stringify(completed))

    const resolved = await resolveSaleDraftOnEnter()
    expect(resolved.draft.step).toBe('products')
    expect(resolved.draft.result).toBeNull()
    expect(resolved.completed).toEqual(completed.result)
    expect(store.removeItem).toHaveBeenCalled()
  })
})
