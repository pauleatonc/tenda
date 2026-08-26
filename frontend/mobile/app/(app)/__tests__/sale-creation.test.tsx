import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import * as SecureStore from 'expo-secure-store'
import type { ReactElement } from 'react'

import NewSaleScreen from '../ventas/nueva'
import { MobileApiError } from '../../../lib/auth-api'
import { NETWORK_UNAVAILABLE } from '../../../lib/graphql'
import * as inventoryApi from '../../../lib/inventory-api'
import * as salesApi from '../../../lib/sales-api'

jest.mock('../../../lib/inventory-api', () => ({
  ...jest.requireActual('../../../lib/inventory-api'),
  fetchProducts: jest.fn(),
}))

jest.mock('../../../lib/sales-api', () => ({
  createOrder: jest.fn(),
  publishOrderLink: jest.fn(),
  fetchSellerPaymentConnection: jest.fn(),
  salesKeys: {
    root: ['sales'],
    paymentConnection: () => ['sales', 'payment-connection'],
  },
}))

const inventory = inventoryApi as jest.Mocked<typeof inventoryApi>
const sales = salesApi as jest.Mocked<typeof salesApi>

function renderScreen(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

function productPage(available = 5) {
  return {
    totalCount: 1,
    hasNextPage: false,
    endCursor: '',
    products: [
      {
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
        stock: { onHand: 7, reserved: 2, available, activeFulfilment: 0 },
      },
    ],
  }
}

async function addOneProduct() {
  await screen.findByText('Velas de soya')
  await fireEvent.press(screen.getByRole('button', { name: 'Agregar Velas de soya' }))
}

async function reachReview() {
  await addOneProduct()
  await fireEvent.press(
    screen.getByRole('button', { name: 'Continuar a entrega y pago' }),
  )
  await fireEvent.press(screen.getByRole('button', { name: 'Revisar venta' }))
  expect(await screen.findByText('Revisión')).toBeOnTheScreen()
}

describe('Crear venta mobile', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null)
    inventory.fetchProducts.mockResolvedValue(productPage())
    sales.fetchSellerPaymentConnection.mockResolvedValue({
      sellerPaymentConnection: null,
      paymentCommissionConfiguration: {
        mode: 'percentage',
        rate: '0',
        minimum: 0,
        zeroFeeEnabled: true,
      },
    })
  })

  it('conserva líneas de precio distintas y valida stock agregado por producto', async () => {
    inventory.fetchProducts.mockResolvedValue(productPage(2))
    await renderScreen(<NewSaleScreen />)
    await addOneProduct()

    await fireEvent.press(
      screen.getByRole('button', { name: 'Agregar otra línea de precio' }),
    )
    const quantities = screen.getAllByLabelText('Cantidad de Velas de soya')
    const prices = screen.getAllByLabelText('Precio efectivo de Velas de soya')
    expect(quantities).toHaveLength(2)

    await fireEvent.changeText(quantities[0], '2')
    await fireEvent.changeText(prices[1], '4000')

    expect(
      await screen.findByText(
        'Velas de soya: seleccionaste 3, pero hay 2 disponibles entre todas sus líneas de precio.',
      ),
    ).toBeOnTheScreen()
    expect(
      screen.getByRole('button', { name: 'Continuar a entrega y pago' }),
    ).toBeDisabled()

    await fireEvent.changeText(quantities[0], '1')
    await fireEvent.press(
      screen.getByRole('button', { name: 'Continuar a entrega y pago' }),
    )
    await fireEvent.press(screen.getByRole('button', { name: 'Revisar venta' }))

    expect(await screen.findAllByText('Velas de soya')).toHaveLength(2)
    expect(screen.getByText('1 × $5.000 CLP')).toBeOnTheScreen()
    expect(screen.getByText('1 × $4.000 CLP')).toBeOnTheScreen()
  })

  it('sin red mantiene borrador y clave, y nunca encola ni publica', async () => {
    sales.createOrder.mockRejectedValue(
      new MobileApiError({
        code: NETWORK_UNAVAILABLE,
        message: 'Sin conexión. No enviamos nada; tus datos siguen en pantalla.',
        fieldErrors: {},
        correlationId: '',
        retryable: true,
      }),
    )
    await renderScreen(<NewSaleScreen />)
    await reachReview()

    await fireEvent.press(screen.getByRole('button', { name: 'Crear venta y enlace' }))

    expect(
      await screen.findByText(
        'Sin conexión. No enviamos nada; tus datos siguen en pantalla.',
      ),
    ).toBeOnTheScreen()
    expect(
      screen.getByText(/No encolamos la venta\. El borrador y su clave de reintento/),
    ).toBeOnTheScreen()
    expect(screen.getByText('Velas de soya')).toBeOnTheScreen()
    expect(sales.publishOrderLink).not.toHaveBeenCalled()

    const firstKey = sales.createOrder.mock.calls[0][0].idempotencyKey
    await fireEvent.press(screen.getByRole('button', { name: 'Crear venta y enlace' }))
    await waitFor(() => expect(sales.createOrder).toHaveBeenCalledTimes(2))
    expect(sales.createOrder.mock.calls[1][0].idempotencyKey).toBe(firstKey)
    expect(sales.publishOrderLink).not.toHaveBeenCalled()
    expect(SecureStore.setItemAsync).toHaveBeenCalled()
  })
})
