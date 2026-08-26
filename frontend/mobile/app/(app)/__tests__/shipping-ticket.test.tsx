import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { useLocalSearchParams } from 'expo-router'
import type { ReactElement } from 'react'

import ShipmentTicketScreen from '../despachos/ticket/[ticketId]'
import * as api from '../../../lib/shipping-api'

jest.mock('../../../lib/shipping-api', () => ({
  fetchTicket: jest.fn(),
  sendTicketMessage: jest.fn(),
  resolveTicket: jest.fn(),
  shippingKeys: {
    root: ['shipping'],
    ticket: (id: string) => ['shipping', 'ticket', id],
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

describe('Consulta del despacho mobile', () => {
  it('muestra el hilo y envía una respuesta', async () => {
    mockedParams.mockReturnValue({ ticketId: 'tic-1' })
    mocked.fetchTicket.mockResolvedValue({
      id: 'tic-1',
      number: 'CON-ABC',
      status: 'awaiting_seller',
      statusLabel: 'Espera al vendedor',
      category: 'damaged',
      categoryLabel: 'Llegó dañado',
      contactName: 'Camila Soto',
      contactEmail: 'camila@example.cl',
      contactPhone: '',
      resolvedAt: null,
      closedAt: null,
      createdAt: '2026-08-26T15:00:00Z',
      messages: [
        {
          id: 'msg-1',
          authorKind: 'buyer',
          body: 'El velón llegó con la cera quebrada.',
          createdAt: '2026-08-26T15:00:00Z',
        },
      ],
      shipment: { id: 'ship-1', number: 'ENV-ABC', orderNumber: 'VEN-001' },
    })
    mocked.sendTicketMessage.mockResolvedValue({
      replayed: false,
      ticket: {
        id: 'tic-1',
        number: 'CON-ABC',
        status: 'awaiting_buyer',
        statusLabel: 'Espera al comprador',
        category: 'damaged',
        categoryLabel: 'Llegó dañado',
        contactName: 'Camila Soto',
        contactEmail: 'camila@example.cl',
        contactPhone: '',
        resolvedAt: null,
        closedAt: null,
        createdAt: '2026-08-26T15:00:00Z',
        messages: [
          {
            id: 'msg-1',
            authorKind: 'buyer',
            body: 'El velón llegó con la cera quebrada.',
            createdAt: '2026-08-26T15:00:00Z',
          },
          {
            id: 'msg-2',
            authorKind: 'seller',
            body: 'Te envío un reemplazo esta semana.',
            createdAt: '2026-08-26T16:00:00Z',
          },
        ],
        shipment: { id: 'ship-1', number: 'ENV-ABC', orderNumber: 'VEN-001' },
      },
    })
    await renderScreen(<ShipmentTicketScreen />)
    expect(await screen.findByText('Consulta CON-ABC')).toBeOnTheScreen()
    expect(screen.getByText('El velón llegó con la cera quebrada.')).toBeOnTheScreen()
    fireEvent.changeText(screen.getByLabelText('Mensaje'), 'Te envío un reemplazo esta semana.')
    fireEvent.press(screen.getByRole('button', { name: 'Enviar mensaje' }))
    await waitFor(() =>
      expect(mocked.sendTicketMessage).toHaveBeenCalledWith(
        expect.objectContaining({ ticketId: 'tic-1' }),
      ),
    )
  })
})
