import { createEmptySaleDraft, resolveSaleDraftOnEnter } from '../sales-draft'
import * as SecureStore from 'expo-secure-store'

const store = SecureStore as jest.Mocked<typeof SecureStore>

describe('borrador de venta mobile', () => {
  beforeEach(() => {
    store.getItemAsync.mockReset()
    store.setItemAsync.mockReset()
    store.deleteItemAsync.mockReset()
  })

  it('retoma un borrador incompleto', async () => {
    const incomplete = {
      ...createEmptySaleDraft(),
      step: 'terms' as const,
      idempotencyKey: 'stable-key',
    }
    store.getItemAsync.mockResolvedValue(JSON.stringify(incomplete))

    await expect(resolveSaleDraftOnEnter()).resolves.toEqual({
      draft: expect.objectContaining({ step: 'terms', idempotencyKey: 'stable-key' }),
      completed: null,
    })
    expect(store.deleteItemAsync).not.toHaveBeenCalled()
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
    store.getItemAsync.mockResolvedValue(JSON.stringify(completed))

    const resolved = await resolveSaleDraftOnEnter()
    expect(resolved.draft.step).toBe('products')
    expect(resolved.draft.result).toBeNull()
    expect(resolved.completed).toEqual(completed.result)
    expect(store.deleteItemAsync).toHaveBeenCalled()
  })
})
