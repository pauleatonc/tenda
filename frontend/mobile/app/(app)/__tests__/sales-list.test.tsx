import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react-native'
import type { ReactElement } from 'react'

import SalesScreen from '../(tabs)/ventas'
import * as api from '../../../lib/sales-api'

jest.mock('../../../lib/sales-api', () => ({
  fetchSalesDashboard: jest.fn(),
  fetchOrders: jest.fn(),
  salesKeys: {
    dashboard: () => ['sales', 'dashboard'],
    orders: (variables: unknown) => ['sales', 'orders', variables],
  },
}))

const mocked = api as jest.Mocked<typeof api>

function renderScreen(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('Listado de ventas mobile', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mocked.fetchSalesDashboard.mockResolvedValue({
      totalOrders: 1,
      activeOrders: 1,
      awaitingBuyerCount: 0,
      awaitingPaymentCount: 1,
      awaitingValidationCount: 1,
      reconciliationRequiredCount: 0,
      confirmedThisMonthCount: 2,
      confirmedThisMonthAmount: '15000',
      currency: 'CLP',
    })
    mocked.fetchOrders.mockResolvedValue({
      totalCount: 1,
      pageInfo: { hasNextPage: false, endCursor: '' },
      nodes: [
        {
          id: 'order-1',
          number: 'V-0001',
          status: 'purchase_validation',
          currency: 'CLP',
          total: '10000',
          paymentMethod: 'bank_transfer',
          nextAction: 'review_payment_proof',
          reconciliationRequired: false,
          expiresAt: '2026-08-25T20:00:00Z',
          confirmedAt: null,
          createdAt: '2026-08-25T12:00:00Z',
          buyer: { fullName: 'Camila Soto' },
        },
      ],
    })
  })

  it('muestra tarjetas legibles y ninguna tabla horizontal', async () => {
    await renderScreen(<SalesScreen />)

    expect(await screen.findByText('Venta V-0001')).toBeOnTheScreen()
    expect(screen.getByText('Camila Soto')).toBeOnTheScreen()
    expect(screen.getByText('$10.000 CLP')).toBeOnTheScreen()
    expect(screen.getByText('Transferencia')).toBeOnTheScreen()
    expect(screen.getByText('Revisar comprobante')).toBeOnTheScreen()

    // A phone gets one vertical card, not desktop column headers or horizontal scroll.
    expect(screen.queryByText('Número')).toBeNull()
    expect(screen.queryByText('Comprador', { exact: true })).toBeNull()
  })
})
