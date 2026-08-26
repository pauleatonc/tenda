import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { Alert, Share } from 'react-native'
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

function sellerShipment() {
  return {
    id: 'ship-1',
    number: 'ENV-ABC',
    status: 'preparing',
    statusLabel: 'En preparación',
    deliveryMode: 'shipping',
    recipientName: 'Camila Soto',
    municipality: 'Ñuñoa',
    city: 'Santiago',
    addressLine: 'Los Aromos 123',
    deliveryNotes: '',
    carrier: 'Chilexpress',
    trackingCode: 'CX-99',
    trackingUrl: 'https://chilexpress.cl/track/CX-99',
    nextAction: 'dispatch',
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
      updatedAt: '2026-08-26T13:00:00Z',
      dispatchedAt: null,
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
    timeline: [
      {
        id: 'evt-1',
        eventType: 'shipment.updated',
        fromStatus: 'preparing',
        toStatus: 'preparing',
        title: 'Datos de seguimiento actualizados',
        detail: '',
        isPublic: false,
        actorName: 'ana@tenda.cl',
        createdAt: '2026-08-26T13:00:00Z',
      },
    ],
  }
}

describe('Detalle de despacho mobile', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedParams.mockReturnValue({ shipmentId: 'ship-1' })
    mocked.fetchShipment.mockResolvedValue(sellerShipment())
  })

  it('advierte antes de abrir el tracking externo y permite despachar', async () => {
    const alert = jest.spyOn(Alert, 'alert')
    await renderScreen(<ShipmentDetailScreen />)

    expect(await screen.findByText('CX-99')).toBeOnTheScreen()

    fireEvent.press(screen.getByText('Abrir seguimiento'))
    expect(alert).toHaveBeenCalled()
    expect(String(alert.mock.calls[0]?.[1])).toContain(
      'Tenda no consulta el estado con el transportista',
    )

    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction })
    fireEvent.press(screen.getByText('Compartir enlace público'))
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'https://shop.example.test/s/public-token' }),
    )
    share.mockRestore()

    await fireEvent.press(screen.getByRole('button', { name: 'Marcar despachado' }))
    expect(
      await screen.findByRole('button', { name: 'Confirmar despacho' }),
    ).toBeOnTheScreen()
    alert.mockRestore()
  })
})
