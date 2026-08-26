import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import type { ReactElement } from 'react'

import InventoryScreen from '../(tabs)/inventario'
import * as api from '../../../lib/inventory-api'
import type { ProductCard } from '../../../lib/inventory-api'

jest.mock('../../../lib/inventory-api', () => ({
  ...jest.requireActual('../../../lib/inventory-api'),
  fetchProducts: jest.fn(),
  fetchProductBreakdown: jest.fn(),
}))

const mocked = api as jest.Mocked<typeof api>

function makeProduct(overrides: Partial<ProductCard> = {}): ProductCard {
  return {
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
    stock: { onHand: 12, reserved: 2, available: 10, activeFulfilment: 0 },
    ...overrides,
  }
}

function renderScreen(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('Inventario mobile', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('muestra tarjetas con disponibilidad en vez de una tabla ancha', async () => {
    mocked.fetchProducts.mockResolvedValue({
      totalCount: 1,
      hasNextPage: false,
      endCursor: '',
      products: [makeProduct()],
    })

    await renderScreen(<InventoryScreen />)

    expect(await screen.findByText('Velas de soya')).toBeOnTheScreen()
    expect(screen.getByText('Disponible 10')).toBeOnTheScreen()
    expect(screen.getByText('Reservado 2')).toBeOnTheScreen()
    // Everything a phone needs is on the card: no horizontal scroll container.
    expect(screen.queryByText('Producto')).toBeNull()
  })

  it('carga el desglose solo al expandir y lo anuncia', async () => {
    mocked.fetchProducts.mockResolvedValue({
      totalCount: 1,
      hasNextPage: false,
      endCursor: '',
      products: [makeProduct()],
    })
    mocked.fetchProductBreakdown.mockResolvedValue({
      productId: 'product-1',
      available: 10,
      totalCount: 1,
      pageInfo: { hasNextPage: false, endCursor: '' },
      lines: [
        {
          kind: 'reservation',
          label: 'Reserva #12',
          quantity: 2,
          effectivePrice: '4500',
          buyerName: 'Camila',
          status: 'reserved',
          referenceId: 'order-12',
        },
      ],
    } as Awaited<ReturnType<typeof api.fetchProductBreakdown>>)

    await renderScreen(<InventoryScreen />)
    await screen.findByText('Velas de soya')
    expect(mocked.fetchProductBreakdown).not.toHaveBeenCalled()

    const toggle = screen.getByLabelText('Expandir desglose de Velas de soya')
    expect(toggle).toBeCollapsed()

    await fireEvent.press(toggle)

    expect(await screen.findByText('Reserva #12')).toBeOnTheScreen()
    await waitFor(() => {
      expect(mocked.fetchProductBreakdown).toHaveBeenCalledWith('product-1')
    })
    expect(screen.getByLabelText('Contraer desglose de Velas de soya')).toBeExpanded()
  })

  it('distingue el inventario vacío de una búsqueda sin resultados', async () => {
    mocked.fetchProducts.mockResolvedValue({
      totalCount: 0,
      hasNextPage: false,
      endCursor: '',
      products: [],
    })

    await renderScreen(<InventoryScreen />)

    expect(await screen.findByText('Aún no tienes productos')).toBeOnTheScreen()

    await fireEvent.changeText(screen.getByLabelText('Buscar productos'), 'taza')

    expect(await screen.findByText('Sin resultados')).toBeOnTheScreen()
    await fireEvent.press(screen.getByText('Limpiar filtros'))
    expect(await screen.findByText('Aún no tienes productos')).toBeOnTheScreen()
  })
})
