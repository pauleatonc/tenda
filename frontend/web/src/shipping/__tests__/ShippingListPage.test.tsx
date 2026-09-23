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

function renderPage(path = '/app/despachos') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/app/despachos" element={<ShippingListPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const pendingShipment = {
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
}

const dispatchedShipment = {
  ...pendingShipment,
  id: 'ship-2',
  number: 'ENV-DEF',
  status: 'dispatched',
  statusLabel: 'Despachado',
  carrier: 'Chilexpress',
  trackingCode: 'CX-99',
  allowedActions: { registerShipmentDispatch: false, generateShipmentLabel: true },
  dispatchedAt: '2026-08-27T10:00:00Z',
}

describe('listado de despachos', () => {
  beforeEach(() => {
    mocked.fetchShippingDashboard.mockResolvedValue({
      totalCount: 2,
      pendingCount: 1,
      dispatchedCount: 1,
      deliveredCount: 0,
    })
    mocked.fetchShipments.mockResolvedValue({
      totalCount: 2,
      pageInfo: { hasNextPage: false, endCursor: '' },
      nodes: [pendingShipment, dispatchedShipment],
    })
  })

  it('muestra el resumen de tres estados y las filas sin seguimiento', async () => {
    renderPage()
    expect(await screen.findByText('ENV-ABC')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Despachos' })).toBeInTheDocument()
    expect(screen.getByText('Pendientes')).toBeInTheDocument()
    expect(screen.getByText('Despachados')).toBeInTheDocument()
    expect(screen.getByText('Entregados')).toBeInTheDocument()
    expect(screen.getAllByText('Camila Soto')).toHaveLength(2)
    expect(screen.getByText('Chilexpress · CX-99')).toBeInTheDocument()
    expect(screen.getByText('Transportista / Tracking')).toBeInTheDocument()
    expect(screen.queryByText('Vencimiento')).toBeNull()
    expect(screen.queryByText('Próxima acción')).toBeNull()
    expect(screen.queryByText('Chequeo de entrega')).toBeNull()
    expect(screen.queryByText('Incidencias')).toBeNull()
  })

  it('filtra por estado y modalidad desde la URL', async () => {
    renderPage('/app/despachos?estado=pending&modalidad=pickup')
    await screen.findByText('ENV-ABC')
    expect(mocked.fetchShipments).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: { search: null, statuses: ['pending'], deliveryMode: 'pickup' },
      }),
    )
    expect(screen.getByRole('button', { name: 'Limpiar filtros (2)' })).toBeInTheDocument()
  })
})
