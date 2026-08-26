import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as api from '../../shipping/api'
import { PublicShipmentConfirmPage } from '../PublicShipmentConfirmPage'
import { PublicShipmentHelpPage } from '../PublicShipmentHelpPage'
import { PublicShipmentPage } from '../PublicShipmentPage'

vi.mock('../../shipping/api', () => ({
  fetchPublicShipment: vi.fn(),
  confirmPublicShipment: vi.fn(),
  openPublicTicket: vi.fn(),
  sendTicketMessage: vi.fn(),
  shippingKeys: {
    publicShipment: (token: string) => ['public-shipment', token],
  },
}))

const mocked = vi.mocked(api)

const publicShipment = {
  number: 'ENV-ABC',
  publicStatus: 'dispatched',
  publicStatusLabel: 'Despachado',
  orderNumber: 'VEN-001',
  seller: {
    displayName: 'Taller Ana',
    contactEmail: 'ventas@example.cl',
    contactPhone: '+56911111111',
  },
  lines: [{ productName: 'Velón', quantity: 1 }],
  carrier: 'Chilexpress',
  trackingCode: 'CX-99',
  trackingUrl: 'https://chilexpress.cl/track/CX-99',
  dispatchedAt: '2026-08-26T14:00:00Z',
  timeline: [
    {
      title: 'Pedido despachado',
      detail: '',
      createdAt: '2026-08-26T14:00:00Z',
    },
  ],
  confirmation: null,
  allowedActions: {
    confirmReceived: true,
    requestHelp: true,
    openPublicTicket: true,
    sendTicketMessage: false,
  },
  canConfirm: true,
  tokenExpiresAt: '2026-11-24T12:00:00Z',
  ticket: null,
  buyerContact: { name: 'Camila Soto', email: 'camila@example.cl', phone: '' },
}

function renderTracking() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/s/public-token']}>
        <Routes>
          <Route path="/s/:token" element={<PublicShipmentPage />} />
          <Route path="/s/:token/confirmar" element={<PublicShipmentConfirmPage />} />
          <Route path="/s/:token/consulta" element={<PublicShipmentHelpPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function renderConfirm() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/s/public-token/confirmar']}>
        <Routes>
          <Route path="/s/:token" element={<p>Seguimiento</p>} />
          <Route path="/s/:token/confirmar" element={<PublicShipmentConfirmPage />} />
          <Route path="/s/:token/consulta" element={<p>Consulta</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('seguimiento público', () => {
  beforeEach(() => {
    mocked.fetchPublicShipment.mockResolvedValue(publicShipment)
    mocked.confirmPublicShipment.mockResolvedValue({
      replayed: false,
      outcome: 'received',
      publicStatus: 'received',
      publicStatusLabel: 'Recibido',
      nextAction: 'none',
      allowedActions: [],
    })
  })

  it('muestra vendedor, resumen, tracking y timeline sin datos internos', async () => {
    renderTracking()
    expect(await screen.findByText('Taller Ana despachó tu pedido')).toBeInTheDocument()
    expect(screen.getByText('Velón')).toBeInTheDocument()
    expect(screen.getByText('CX-99')).toBeInTheDocument()
    expect(screen.getByText('Pedido despachado')).toBeInTheDocument()
    expect(screen.queryByText('delivery_check')).toBeNull()
    expect(screen.getByRole('link', { name: '¿Recibiste tu pedido?' })).toHaveAttribute(
      'href',
      '/s/public-token/confirmar',
    )
  })

  it('pide un resumen antes de confirmar que sí lo recibió', async () => {
    renderConfirm()
    expect(
      await screen.findByRole('heading', { name: '¿Recibiste tu pedido?' }),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sí, lo recibí' }))
    expect(screen.getByText('Revisa el resumen antes de confirmar')).toBeInTheDocument()
    expect(screen.getByText('Velón')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar recepción' }))
    await waitFor(() =>
      expect(mocked.confirmPublicShipment).toHaveBeenCalledWith(
        expect.objectContaining({ token: 'public-token', outcome: 'received' }),
      ),
    )
    expect(await screen.findByText('Seguimiento')).toBeInTheDocument()
  })

  it('deriva a consulta cuando indica que necesita ayuda', async () => {
    mocked.confirmPublicShipment.mockResolvedValue({
      replayed: false,
      outcome: 'needs_help',
      publicStatus: 'needs_help',
      publicStatusLabel: 'Hay una consulta',
      nextAction: 'open_ticket',
      allowedActions: [],
    })
    renderConfirm()
    await userEvent.click(
      await screen.findByRole('button', { name: 'No, necesito ayuda' }),
    )
    await waitFor(() =>
      expect(mocked.confirmPublicShipment).toHaveBeenCalledWith(
        expect.objectContaining({ token: 'public-token', outcome: 'needs_help' }),
      ),
    )
    expect(await screen.findByText('Consulta')).toBeInTheDocument()
  })

  it('abre una consulta pública con categoría, mensaje y contacto prellenado', async () => {
    mocked.openPublicTicket.mockResolvedValue({
      replayed: false,
      ticket: {
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
      },
    })
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/s/public-token/consulta']}>
          <Routes>
            <Route path="/s/:token" element={<p>Seguimiento</p>} />
            <Route path="/s/:token/consulta" element={<PublicShipmentHelpPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(
      await screen.findByRole('heading', { name: '¿Necesitas ayuda con este pedido?' }),
    ).toBeInTheDocument()
    expect(screen.getByDisplayValue('Camila Soto')).toBeInTheDocument()
    expect(screen.getByDisplayValue('camila@example.cl')).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByRole('combobox'), 'damaged')
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Mensaje' }),
      'El velón llegó con la cera quebrada.',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Abrir consulta' }))
    await waitFor(() =>
      expect(mocked.openPublicTicket).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'public-token',
          category: 'damaged',
          contactEmail: 'camila@example.cl',
        }),
      ),
    )
  })
})
