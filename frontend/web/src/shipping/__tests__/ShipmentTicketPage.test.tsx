import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as api from '../api'
import { ShipmentTicketPage } from '../ShipmentTicketPage'

vi.mock('../api', () => ({
  fetchTicket: vi.fn(),
  sendTicketMessage: vi.fn(),
  resolveTicket: vi.fn(),
  shippingKeys: {
    ticket: (id: string) => ['shipping', 'ticket', id],
    shipment: (id: string) => ['shipping', 'shipment', id],
  },
}))

const mocked = vi.mocked(api)

const ticket = {
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
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/app/despachos/ship-1/tickets/tic-1']}>
        <Routes>
          <Route
            path="/app/despachos/:id/tickets/:ticketId"
            element={<ShipmentTicketPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('consulta del despacho', () => {
  beforeEach(() => {
    mocked.fetchTicket.mockResolvedValue(ticket)
    mocked.sendTicketMessage.mockResolvedValue({
      replayed: false,
      ticket: {
        ...ticket,
        status: 'awaiting_buyer',
        messages: [
          ...ticket.messages,
          {
            id: 'msg-2',
            authorKind: 'seller',
            body: 'Lamento el daño, te envío un reemplazo esta semana.',
            createdAt: '2026-08-26T16:00:00Z',
          },
        ],
      },
    })
  })

  it('muestra el hilo y permite responder', async () => {
    renderPage()
    expect(await screen.findByText('CON-ABC', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('El velón llegó con la cera quebrada.')).toBeInTheDocument()
    expect(screen.getByText('Camila Soto')).toBeInTheDocument()
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Respuesta al comprador' }),
      'Lamento el daño, te envío un reemplazo esta semana.',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }))
    await waitFor(() =>
      expect(mocked.sendTicketMessage).toHaveBeenCalledWith(
        expect.objectContaining({ ticketId: 'tic-1' }),
      ),
    )
  })
})
