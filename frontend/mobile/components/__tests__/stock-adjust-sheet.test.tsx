import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'

import { StockAdjustSheet } from '../stock-adjust-sheet'
import * as api from '../../lib/inventory-api'
import type { ProductCard } from '../../lib/inventory-api'

jest.mock('../../lib/inventory-api', () => ({
  ...jest.requireActual('../../lib/inventory-api'),
  recordStockMovement: jest.fn(),
}))

const mocked = api as jest.Mocked<typeof api>

const product: ProductCard = {
  id: 'product-1',
  name: 'Velas de soya',
  catalogStatus: 'active',
  purchasePrice: '2000',
  salePrice: '5000',
  currency: 'CLP',
  extraAttributes: {},
  lowStockThreshold: null,
  effectiveLowStockThreshold: 5,
  archivedAt: null,
  stock: { onHand: 12, reserved: 0, available: 12, activeFulfilment: 0 },
}

async function renderSheet() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await render(
    <QueryClientProvider client={client}>
      <StockAdjustSheet product={product} visible onClose={jest.fn()} />
    </QueryClientProvider>,
  )
}

describe('Ajustar stock en mobile', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('muestra el saldo antes y después y exige motivo en mermas', async () => {
    await renderSheet()

    await fireEvent.press(screen.getByLabelText('Merma'))
    await fireEvent.changeText(screen.getByLabelText('Cantidad'), '3')

    expect(screen.getByText('12')).toBeOnTheScreen()
    expect(screen.getByText('9')).toBeOnTheScreen()
    expect(
      screen.getByText('Las mermas y correcciones necesitan un motivo.'),
    ).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Confirmar ajuste' })).toBeDisabled()

    await fireEvent.changeText(screen.getByLabelText('Motivo'), 'Rotura en bodega')
    expect(screen.getByRole('button', { name: 'Confirmar ajuste' })).toBeEnabled()
  })

  it('impide dejar el saldo negativo', async () => {
    await renderSheet()

    await fireEvent.press(screen.getByLabelText('Salida'))
    await fireEvent.changeText(screen.getByLabelText('Cantidad'), '20')

    expect(
      screen.getByText('No hay unidades suficientes: el saldo quedaría en −8.'),
    ).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Confirmar ajuste' })).toBeDisabled()
    expect(mocked.recordStockMovement).not.toHaveBeenCalled()
  })

  it('envía el movimiento con una clave de idempotencia', async () => {
    mocked.recordStockMovement.mockResolvedValue({
      movement: {
        id: 'movement-1',
        productId: product.id,
        productName: product.name,
        movementType: 'entry',
        quantity: 5,
        balanceAfter: 17,
        reason: '',
        note: '',
        actorName: 'Ana',
        createdAt: '2026-08-24T12:00:00Z',
      },
      product,
      replayed: false,
    })

    await renderSheet()

    await fireEvent.changeText(screen.getByLabelText('Cantidad'), '5')
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar ajuste' }))

    await waitFor(() => {
      expect(mocked.recordStockMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 'product-1',
          movementType: 'entry',
          quantity: 5,
          idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
        }),
        expect.anything(),
      )
    })
  })
})
