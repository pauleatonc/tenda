import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as api from '../api'
import { ShippingListPage } from '../ShippingListPage'

vi.mock('../api', () => ({
  fetchShippingDashboard: vi.fn(),
  fetchShipments: vi.fn(),
  shippingKeys: {
    dashboard: () => ['shipping', 'dashboard'],
    shipments: (variables: unknown) => ['shipping', 'shipments', variables],
  },
}))

const mocked = vi.mocked(api)

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/app/despachos']}>
        <Routes>
          <Route path="/app/despachos" element={<ShippingListPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('listado de despachos', () => {
  beforeEach(() => {
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
          municipality: 'Ñuñoa',
          city: 'Santiago',
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

  it('muestra el resumen y la fila operativa en español', async () => {
    renderPage()
    expect(await screen.findByText('ENV-ABC')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Despachos' })).toBeInTheDocument()
    expect(screen.getByText('Pendientes')).toBeInTheDocument()
    expect(screen.getByText('Camila Soto')).toBeInTheDocument()
    expect(screen.getByText('Preparar envío')).toBeInTheDocument()
    expect(screen.getByText('Vencimiento')).toBeInTheDocument()
    expect(screen.queryByText('Seguimiento, entregas y consultas.')).toBeNull()
  })
})
