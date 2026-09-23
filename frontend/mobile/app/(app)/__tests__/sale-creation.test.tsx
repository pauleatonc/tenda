import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'
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
  sendOfferLink: jest.fn(),
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

  it('confirma efectivo y abre la ficha sin publicar enlace', async () => {
    sales.createOrder.mockResolvedValue({
      replayed: false,
      order: { id: 'order-cash', number: 'V-9' },
    } as never)
    await renderScreen(<NewSaleScreen />)
    await addOneProduct()
    await fireEvent.press(
      screen.getByRole('button', { name: 'Continuar a entrega y pago' }),
    )
    await fireEvent.press(screen.getByRole('radio', { name: 'Efectivo / presencial' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Revisar venta' }))
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Crear venta en efectivo' }),
    )
    expect(await screen.findByText('Confirmar venta en efectivo')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Crear venta' }))

    await waitFor(() =>
      expect(sales.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({ paymentMethod: 'cash' }),
      ),
    )
    expect(sales.publishOrderLink).not.toHaveBeenCalled()
    expect(router.replace).toHaveBeenCalledWith('/ventas/order-cash')
  })

  it('abre una venta nueva si el resultado anterior quedó guardado', async () => {
    ;(SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
      JSON.stringify({
        version: 1,
        step: 'result',
        idempotencyKey: 'used-key',
        lines: [],
        deliveryMode: 'shipping',
        paymentMethod: 'bank_transfer',
        result: {
          orderId: 'order-ready',
          orderNumber: 'V-1042',
          publicUrl: 'https://tenda.test/p/token',
        },
        updatedAt: '2026-09-23T12:00:00.000Z',
      }),
    )
    await renderScreen(<NewSaleScreen />)

    expect(
      await screen.findByText('La venta V-1042 ya está creada'),
    ).toBeOnTheScreen()
    expect(screen.getByText('Productos y precios')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Ver ficha' })).toBeOnTheScreen()
    expect(screen.queryByText('Tu enlace está listo')).not.toBeOnTheScreen()
  })

  it('envía el enlace por correo desde el resultado', async () => {
    sales.createOrder.mockResolvedValue({
      replayed: false,
      order: { id: 'order-1', number: 'V-0001' },
    } as never)
    sales.publishOrderLink.mockResolvedValue({
      replayed: false,
      publicUrl: 'https://tenda.test/p/token',
      order: { id: 'order-1', number: 'V-0001' },
    } as never)
    sales.sendOfferLink.mockResolvedValue({
      replayed: false,
      publicUrl: 'https://tenda.test/p/token',
      order: { id: 'order-1' },
    } as never)

    await renderScreen(<NewSaleScreen />)
    await reachReview()
    await fireEvent.press(screen.getByRole('button', { name: 'Crear venta y enlace' }))
    await fireEvent.press(await screen.findByRole('button', { name: 'Enviar por correo' }))
    const email = await screen.findByLabelText('Correo del comprador')
    await fireEvent.changeText(email, 'camila@example.cl')
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar' }))

    await waitFor(() =>
      expect(sales.sendOfferLink).toHaveBeenCalledWith({
        orderId: 'order-1',
        email: 'camila@example.cl',
        idempotencyKey: expect.any(String),
      }),
    )
    expect(await screen.findByText('Correo enviado.')).toBeOnTheScreen()
  })
})
