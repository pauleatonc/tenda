import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react-native'
import { useLocalSearchParams } from 'expo-router'
import type { ReactElement } from 'react'

import ShipmentDetailScreen from '../despachos/[shipmentId]'
import * as api from '../../../lib/shipping-api'

jest.mock('../../../lib/shipping-api', () => ({
  fetchShipment: jest.fn(),
  updateShipment: jest.fn(),
  markShipmentDispatched: jest.fn(),
  generateShipmentLabel: jest.fn(),
  rescheduleFollowUp: jest.fn(),
  registerReturnCase: jest.fn(),
  confirmReturnToStock: jest.fn(),
  shippingKeys: {
    root: ['shipping'],
    shipment: (id: string) => ['shipping', 'shipment', id],
  },
}))

const mocked = api as jest.Mocked<typeof api>
const mockedParams = useLocalSearchParams as jest.Mock

function renderScreen(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('Detalle de despacho ya despachado', () => {
  it('no ofrece edición cuando el envío ya salió', async () => {
    mockedParams.mockReturnValue({ shipmentId: 'ship-1' })
    mocked.fetchShipment.mockResolvedValue({
      id: 'ship-1',
      number: 'ENV-ABC',
      status: 'dispatched',
      statusLabel: 'Despachado',
      deliveryMode: 'shipping',
      recipientName: 'Camila Soto',
      recipientTaxId: '11.111.111-1',
      commune: 'Ñuñoa',
      region: 'Región Metropolitana de Santiago',
      addressLine: 'Los Aromos 123',
      deliveryNotes: '',
      carrier: 'Chilexpress',
      trackingCode: 'CX-99',
      trackingUrl: 'https://chilexpress.cl/track/CX-99',
      nextAction: 'check_delivery',
      allowedActions: {
        updateShipment: false,
        markShipmentDispatched: false,
        generateShipmentLabel: true,
        sendTicketMessage: false,
        resolveTicket: false,
        rescheduleFollowUp: false,
        registerReturnCase: false,
        confirmReturnToStock: false,
      },
      createdAt: '2026-08-26T12:00:00Z',
      updatedAt: '2026-08-26T13:00:00Z',
      dispatchedAt: '2026-08-26T14:00:00Z',
      deliveredAt: null,
      publicUrl: 'https://shop.example.test/s/public-token',
      confirmation: null,
      latestLabel: null,
      activeTicket: null,
      tickets: [],
      followUps: [],
      returnCases: [],
      nextFollowUp: null,
      order: { id: 'order-1', number: 'VEN-001', status: 'paid' },
      timeline: [],
    })
    await renderScreen(<ShipmentDetailScreen />)

    expect(await screen.findByText('CX-99')).toBeOnTheScreen()
    expect(screen.getByText('Chequear entrega')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Guardar seguimiento' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Marcar despachado' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Generar etiqueta' })).toBeOnTheScreen()
  })
})
