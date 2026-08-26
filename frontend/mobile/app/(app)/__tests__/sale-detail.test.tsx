import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { useLocalSearchParams } from 'expo-router'
import type { ReactElement } from 'react'

import SaleDetailScreen from '../ventas/[orderId]'
import * as api from '../../../lib/sales-api'

jest.mock('../../../lib/sales-api', () => ({
  fetchOrder: jest.fn(),
  reviewPaymentProof: jest.fn(),
  confirmManualPayment: jest.fn(),
  cancelOrder: jest.fn(),
  refundPayment: jest.fn(),
  resendOrderLink: jest.fn(),
  salesKeys: {
    root: ['sales'],
    order: (id: string) => ['sales', 'order', id],
  },
}))

const mocked = api as jest.Mocked<typeof api>
const mockedParams = useLocalSearchParams as jest.Mock

function renderScreen(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

function sellerOrder() {
  return {
    id: 'order-1',
    number: 'V-0001',
    status: 'purchase_validation',
    currency: 'CLP',
    total: '10000',
    paymentMethod: 'bank_transfer',
    nextAction: 'review_payment_proof',
    reconciliationRequired: false,
    expiresAt: '2026-08-26T00:00:00Z',
    confirmedAt: null,
    createdAt: '2026-08-25T12:00:00Z',
    subtotal: '10000',
    feeAmount: '0',
    deliveryMode: 'pickup',
    publicUrl: 'https://tenda.test/p/token',
    publishedAt: '2026-08-25T12:01:00Z',
    updatedAt: '2026-08-25T13:00:00Z',
    costsVisible: false,
    reconciliationMessage: '',
    lines: [
      {
        id: 'line-1',
        productId: 'product-1',
        productName: 'Velas de soya',
        productImageUrl: null,
        quantity: 2,
        unitSalePrice: '5000',
        unitCostSnapshot: '2000',
        currency: 'CLP',
        lineTotal: '10000',
      },
    ],
    buyer: {
      fullName: 'Camila Soto',
      email: 'camila@example.com',
      phone: '+56911111111',
      recipientName: '',
      deliveryAddress: '',
      deliveryCommune: '',
      deliveryCity: '',
      taxId: '',
      taxName: '',
      taxBusinessActivity: '',
      taxAddress: '',
      taxCommune: '',
      taxCity: '',
      taxEmail: '',
    },
    payment: {
      id: 'payment-1',
      method: 'bank_transfer',
      status: 'validation',
      amount: '10000',
      currency: 'CLP',
      feeAmount: '0',
      refundedAmount: '0',
      provider: '',
      providerReference: '',
      paidAt: null,
      rejectionReason: '',
      proof: null,
    },
    timeline: [
      {
        id: 'event-1',
        eventType: 'order.created',
        title: 'Venta creada',
        detail: '',
        actorName: 'Owner',
        createdAt: '2026-08-25T12:00:00Z',
      },
    ],
    allowedActions: {
      approveProof: true,
      rejectProof: true,
      confirmManualPayment: false,
      cancel: false,
      refund: false,
      resendLink: true,
    },
  }
}

describe('Detalle de venta mobile', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedParams.mockReturnValue({ orderId: 'order-1' })
    mocked.fetchOrder.mockResolvedValue(sellerOrder())
  })

  it('solo muestra acciones permitidas, oculta costos y bloquea doble aprobación', async () => {
    mocked.reviewPaymentProof.mockImplementation(
      () =>
        new Promise<Awaited<ReturnType<typeof api.reviewPaymentProof>>>(() => {
          // Deliberately pending: both presses happen while the first request is active.
        }),
    )

    await renderScreen(<SaleDetailScreen />)
    expect(await screen.findByText('Venta V-0001')).toBeOnTheScreen()

    expect(screen.getByRole('button', { name: 'Aprobar comprobante' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Rechazar comprobante' })).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Cancelar venta' })).toBeNull()
    expect(screen.queryByText(/Costo snapshot/)).toBeNull()

    await fireEvent.press(
      screen.getByRole('button', { name: 'Aprobar comprobante' }),
    )
    const confirm = await screen.findByRole('button', {
      name: 'Aprobar y descontar stock',
    })
    await fireEvent.press(confirm)
    await fireEvent.press(confirm)

    expect(mocked.reviewPaymentProof).toHaveBeenCalledTimes(1)
    expect(mocked.reviewPaymentProof).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-1',
        decision: 'approve',
      }),
    )
  })

  it('exige motivo antes de rechazar un comprobante', async () => {
    await renderScreen(<SaleDetailScreen />)
    await screen.findByText('Venta V-0001')

    await fireEvent.press(
      screen.getByRole('button', { name: 'Rechazar comprobante' }),
    )
    const rejectButtons = await screen.findAllByRole('button', {
      name: 'Rechazar comprobante',
    })
    await fireEvent.press(rejectButtons[rejectButtons.length - 1])

    expect(await screen.findByText('Escribe el motivo del rechazo.')).toBeOnTheScreen()
    expect(mocked.reviewPaymentProof).not.toHaveBeenCalled()
  })
})
