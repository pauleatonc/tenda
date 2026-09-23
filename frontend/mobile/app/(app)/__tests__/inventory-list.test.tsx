import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'
import type { ReactElement } from 'react'

import InventoryScreen from '../(tabs)/inventario'
import * as api from '../../../lib/inventory-api'
import * as sales from '../../../lib/sales-api'
import type { ProductCard } from '../../../lib/inventory-api'

jest.mock('../../../lib/inventory-api', () => ({
  ...jest.requireActual('../../../lib/inventory-api'),
  fetchProducts: jest.fn(),
  fetchProductBreakdown: jest.fn(),
}))

jest.mock('../../../lib/sales-api', () => ({
  createOrder: jest.fn(),
  publishOrderLink: jest.fn(),
  sendOfferLink: jest.fn(),
}))

const mocked = api as jest.Mocked<typeof api>
const mockedSales = sales as jest.Mocked<typeof sales>

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

  it('abre las tres formas de agregar un producto', async () => {
    mocked.fetchProducts.mockResolvedValue({
      totalCount: 1,
      hasNextPage: false,
      endCursor: '',
      products: [makeProduct()],
    })

    await renderScreen(<InventoryScreen />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Agregar' }))

    expect(screen.getByText('Carga manual')).toBeOnTheScreen()
    expect(screen.getByText('Agregar variante a un producto existente')).toBeOnTheScreen()
    expect(screen.getByText('Creación asistida')).toBeOnTheScreen()

    await fireEvent.press(screen.getByText('Carga manual'))
    expect(router.push).toHaveBeenCalledWith('/inventario/producto')
  })

  it('abre el sheet de depósito y deja Online como próximamente', async () => {
    mocked.fetchProducts.mockResolvedValue({
      totalCount: 1,
      hasNextPage: false,
      endCursor: '',
      products: [makeProduct()],
    })

    await renderScreen(<InventoryScreen />)
    mockedSales.createOrder.mockResolvedValue({
      replayed: false,
      order: { id: 'order-1' },
    } as never)
    mockedSales.publishOrderLink.mockResolvedValue({
      replayed: false,
      publicUrl: 'https://tenda.test/p/token',
      order: { id: 'order-1' },
    } as never)

    await fireEvent.press(await screen.findByRole('button', { name: 'Generar venta' }))

    expect(screen.getByText('Depósito')).toBeOnTheScreen()
    expect(screen.getByText('Pago Online')).toBeOnTheScreen()
    expect(screen.getByText('Efectivo')).toBeOnTheScreen()
    expect(screen.getByText('Próximamente')).toBeOnTheScreen()
    expect(mockedSales.createOrder).not.toHaveBeenCalled()

    await fireEvent.press(screen.getByRole('button', { name: 'Generar depósito' }))
    await waitFor(() => expect(mockedSales.createOrder).toHaveBeenCalledTimes(1))
    expect(mockedSales.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        deliveryMode: 'coordinated',
        paymentMethod: 'bank_transfer',
      }),
    )
  })

  it('confirma efectivo y abre la ficha de la venta', async () => {
    mocked.fetchProducts.mockResolvedValue({
      totalCount: 1,
      hasNextPage: false,
      endCursor: '',
      products: [makeProduct()],
    })
    mockedSales.createOrder.mockResolvedValue({
      replayed: false,
      order: { id: 'order-cash' },
    } as never)

    await renderScreen(<InventoryScreen />)
    await fireEvent.press(await screen.findByRole('button', { name: 'Generar venta' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Efectivo' }))
    expect(await screen.findByText('Confirmar venta en efectivo')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Crear venta' }))

    await waitFor(() => expect(mockedSales.createOrder).toHaveBeenCalledTimes(1))
    expect(mockedSales.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        deliveryMode: 'coordinated',
        paymentMethod: 'cash',
      }),
    )
    expect(mockedSales.publishOrderLink).not.toHaveBeenCalled()
    expect(router.push).toHaveBeenCalledWith('/ventas/order-cash')
  })
})
