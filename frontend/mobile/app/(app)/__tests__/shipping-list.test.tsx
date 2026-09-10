import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react-native'
import type { ReactElement } from 'react'

import ShippingScreen from '../(tabs)/despachos'
import * as api from '../../../lib/shipping-api'

jest.mock('../../../lib/shipping-api', () => ({
  fetchShippingDashboard: jest.fn(),
  fetchShipments: jest.fn(),
  shippingKeys: {
    dashboard: () => ['shipping', 'dashboard'],
    shipments: (variables: unknown) => ['shipping', 'shipments', variables],
  },
}))

const mocked = api as jest.Mocked<typeof api>

function renderScreen(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('Listado de despachos mobile', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mocked.fetchShippingDashboard.mockResolvedValue({
      totalCount: 1,
      pendingCount: 1,
      preparingCount: 0,
      dispatchedCount: 0,
      deliveryCheckCount: 0,
      issueCount: 0,
      attentionCount: 1,
    })
    mocked.fetchShipments.mockResolvedValue({
      totalCount: 1,
      pageInfo: { hasNextPage: false, endCursor: '' },
      nodes: [
        {
          id: 'ship-1',
          number: 'ENV-ABC',
          status: 'pending',
          statusLabel: 'Pendiente',
          deliveryMode: 'shipping',
          recipientName: 'Camila Soto',
          commune: 'Ñuñoa',
          region: 'Región Metropolitana de Santiago',
          carrier: '',
          trackingCode: '',
          trackingUrl: '',
          nextAction: 'prepare',
          allowedActions: {
            updateShipment: true,
            markShipmentDispatched: true,
            generateShipmentLabel: true,
            sendTicketMessage: false,
            resolveTicket: false,
            rescheduleFollowUp: false,
            registerReturnCase: false,
            confirmReturnToStock: false,
          },
          createdAt: '2026-08-26T12:00:00Z',
          nextFollowUp: {
            id: 'fu-1',
            kind: 'delivery_check',
            kindLabel: 'Chequeo de entrega',
            status: 'scheduled',
            statusLabel: 'Programado',
            dueAt: '2026-08-29T12:00:00Z',
            sentAt: null,
            parameterKey: 'shipping.delivery_check_hours',
            parameterSource: 'global',
            parameterSourceLabel: 'Parámetro global',
            parameterLabel: '72 h',
          },
          order: { id: 'order-1', number: 'VEN-001', status: 'paid' },
        },
      ],
    })
  })

  it('muestra tarjetas verticales y ninguna tabla', async () => {
    await renderScreen(<ShippingScreen />)

    expect(await screen.findByText('Envío ENV-ABC')).toBeOnTheScreen()
    expect(screen.getByText('Camila Soto')).toBeOnTheScreen()
    expect(screen.getByText('Preparar envío')).toBeOnTheScreen()
    expect(screen.queryByText('Número')).toBeNull()
    expect(screen.queryByText('Coming soon', { exact: false })).toBeNull()
    expect(
      screen.queryByText('Aquí acompañarás cada entrega', { exact: false }),
    ).toBeNull()
  })
})
