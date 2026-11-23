import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewerPayload } from '../../auth/api'
import * as salesApi from '../api'
import { PaymentsSettingsPage } from '../PaymentsSettingsPage'

vi.mock('../api', () => ({
  fetchPaymentConnection: vi.fn(),
  startMercadoPagoConnection: vi.fn(),
  disconnectMercadoPagoConnection: vi.fn(),
  salesKeys: {
    paymentConnection: () => ['sales', 'payment-connection'],
  },
}))

const mocked = vi.mocked(salesApi)

const viewer: ViewerPayload = {
  viewer: {
    id: 'user-1',
    email: 'ana@example.cl',
    emailVerified: true,
    isStaff: false,
    profile: {
      id: 'profile-1',
      fullName: 'Ana',
      phone: '',
      locale: 'es-CL',
      photoUrl: null,
    },
  },
  organisation: {
    id: 'org-1',
    name: 'Taller Ana',
    timezone: 'America/Santiago',
    phone: '',
    businessEmail: '',
    address: '',
    description: '',
    logoUrl: null,
  },
  inventory: { id: 'inv-1', name: 'Principal' },
  membership: {
    id: 'membership-1',
    role: 'owner',
    roleLabel: 'titular',
    permissions: {
      viewFinancials: true,
      manageMembers: true,
      manageSensitiveConfiguration: true,
      manageInventorySchema: true,
    },
  },
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/app/cuenta/pagos']}>
        <Routes>
          <Route element={<Outlet context={viewer} />}>
            <Route path="/app/cuenta/pagos" element={<PaymentsSettingsPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('PaymentsSettingsPage', () => {
  beforeEach(() => {
    mocked.fetchPaymentConnection.mockResolvedValue({
      sellerPaymentConnection: {
        id: 'connection-1',
        provider: 'mercado_pago',
        status: 'active',
        providerAccountId: '123',
        scopes: ['read', 'write'],
        tokenExpiresAt: '2026-12-01T00:00:00Z',
        connectedAt: '2026-11-01T00:00:00Z',
        disconnectedAt: null,
      },
      paymentCommissionConfiguration: {
        mode: 'disabled',
        rate: '0',
        minimum: '0',
        zeroFeeEnabled: false,
      },
    })
  })

  it('explica el cobro con links y no muestra los permisos de Mercado Pago', async () => {
    renderPage()

    expect(
      await screen.findByText(
        'Con esta integración puedes generar links de pago que cobran directo en tu Mercado Pago.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText('Permisos autorizados')).not.toBeInTheDocument()
    expect(screen.queryByText('read')).not.toBeInTheDocument()
  })
})
