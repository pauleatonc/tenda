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
      totalCount: 2,
      pendingCount: 1,
      dispatchedCount: 1,
      deliveredCount: 0,
    })
    mocked.fetchShipments.mockResolvedValue({
      totalCount: 2,
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
          allowedActions: { registerShipmentDispatch: true, generateShipmentLabel: true },
          dispatchedAt: null,
          deliveredAt: null,
          createdAt: '2026-08-26T12:00:00Z',
          order: { id: 'order-1', number: 'VEN-001', status: 'paid' },
        },
        {
          id: 'ship-2',
          number: 'ENV-DEF',
          status: 'dispatched',
          statusLabel: 'Despachado',
          deliveryMode: 'shipping',
          recipientName: 'Pedro Pérez',
          commune: 'Providencia',
          region: 'Región Metropolitana de Santiago',
          carrier: 'Chilexpress',
          trackingCode: 'CX-99',
          trackingUrl: '',
          allowedActions: { registerShipmentDispatch: false, generateShipmentLabel: true },
          dispatchedAt: '2026-08-27T10:00:00Z',
          deliveredAt: null,
          createdAt: '2026-08-26T12:00:00Z',
          order: { id: 'order-2', number: 'VEN-002', status: 'paid' },
        },
      ],
    })
  })

  it('muestra tarjetas con estado, transportista y sin seguimiento', async () => {
    await renderScreen(<ShippingScreen />)

    expect(await screen.findByText('Envío ENV-ABC')).toBeOnTheScreen()
    expect(screen.getByText('Camila Soto')).toBeOnTheScreen()
    expect(screen.getByText('Registrar despacho')).toBeOnTheScreen()
    expect(screen.getByText('Chilexpress · CX-99')).toBeOnTheScreen()
    expect(screen.getByText('Entregados')).toBeOnTheScreen()
    expect(screen.queryByText('Requieren atención')).toBeNull()
    expect(screen.queryByText('En preparación')).toBeNull()
    expect(screen.queryByText('Incidencias')).toBeNull()
    expect(screen.queryByText('Siguiente acción')).toBeNull()
  })
})
