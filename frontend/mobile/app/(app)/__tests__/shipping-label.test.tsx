import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { Alert } from 'react-native'
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

describe('Etiqueta interna de despacho', () => {
  it('advierte que el PDF es una etiqueta interna de Tenda', async () => {
    const label = {
      id: 'lab-1',
      downloadUrl: 'https://r2.invalid/download/label.pdf?expires=300',
      expiresAt: '2026-08-27T12:00:00Z',
      createdAt: '2026-08-26T14:00:00Z',
      fileName: 'etiqueta-interna-ENV-ABC.pdf',
    }
    mockedParams.mockReturnValue({ shipmentId: 'ship-1' })
    mocked.fetchShipment.mockResolvedValue({
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
      timeline: [],
    })
    mocked.generateShipmentLabel.mockResolvedValue({
      replayed: false,
      label,
      shipment: {
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
        latestLabel: label,
        activeTicket: null,
        tickets: [],
        followUps: [],
        returnCases: [],
        nextFollowUp: null,
        order: { id: 'order-1', number: 'VEN-001', status: 'paid' },
        timeline: [],
      },
    })
    const alert = jest.spyOn(Alert, 'alert')
    await renderScreen(<ShipmentDetailScreen />)
    expect(await screen.findByText('CX-99')).toBeOnTheScreen()
    fireEvent.press(screen.getByText('Generar etiqueta'))
    await waitFor(() =>
      expect(alert.mock.calls.some((call) => call[0] === 'Etiqueta interna Tenda')).toBe(
        true,
      ),
    )
    expect(String(alert.mock.calls.at(-1)?.[1])).toContain(
      'Este documento no es una etiqueta de transportista',
    )
    alert.mockRestore()
  })
})
