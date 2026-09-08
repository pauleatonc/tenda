import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewerPayload } from '../../auth/api'
import * as inventoryApi from '../../inventory/api'
import * as salesApi from '../../sales/api'
import * as shippingApi from '../../shipping/api'
import { DashboardPage } from '../AppShell'

vi.mock('../../inventory/api', () => ({
  fetchDashboard: vi.fn(),
  inventoryKeys: {
    dashboard: () => ['inventory', 'dashboard'],
  },
}))

vi.mock('../../sales/api', () => ({
  fetchSalesDashboard: vi.fn(),
  salesKeys: {
    dashboard: () => ['sales', 'dashboard'],
  },
}))

vi.mock('../../shipping/api', () => ({
  fetchShippingDashboard: vi.fn(),
  shippingKeys: {
    dashboard: () => ['shipping', 'dashboard'],
  },
}))

const inventory = vi.mocked(inventoryApi)
const sales = vi.mocked(salesApi)
const shipping = vi.mocked(shippingApi)

function viewer(overrides: Partial<ViewerPayload['viewer']> = {}): ViewerPayload {
  return {
    viewer: {
      id: 'user-1',
      email: 'ana@tenda.cl',
      emailVerified: true,
      profile: {
        id: 'profile-1',
        fullName: 'Ana Pérez',
        phone: '',
        locale: 'es-CL',
        photoUrl: null,
      },
      ...overrides,
    },
    organisation: {
      id: 'org-1',
      name: 'Taller Ana',
      timezone: 'America/Santiago',
      phone: '',
      businessEmail: 'ana@tenda.cl',
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
}

function renderPage(context: ViewerPayload) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Shell({ children }: { children?: ReactNode }) {
    return <>{children ?? <Outlet context={context} />}</>
  }
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/app']}>
        <Routes>
          <Route element={<Shell />}>
            <Route path="/app" element={<DashboardPage />} />
            <Route path="/app/inventario" element={<p>Inventario</p>} />
            <Route path="/app/ventas" element={<p>Ventas</p>} />
            <Route path="/app/despachos" element={<p>Despachos</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('DashboardPage', () => {
  beforeEach(() => {
    inventory.fetchDashboard.mockResolvedValue({
      productCount: 4,
      archivedCount: 0,
      onHand: 12,
      reserved: 2,
      available: 10,
      outOfStockCount: 1,
      lowStockCount: 1,
      alerts: [],
      recentMovements: [],
    })
    sales.fetchSalesDashboard.mockResolvedValue({
      totalOrders: 3,
      activeOrders: 2,
      awaitingBuyerCount: 0,
      awaitingPaymentCount: 2,
      awaitingValidationCount: 1,
      reconciliationRequiredCount: 0,
      confirmedThisMonthCount: 2,
      confirmedThisMonthAmount: '15000',
      currency: 'CLP',
    })
    shipping.fetchShippingDashboard.mockResolvedValue({
      totalCount: 3,
      pendingCount: 1,
      preparingCount: 1,
      dispatchedCount: 0,
      deliveryCheckCount: 1,
      issueCount: 0,
      attentionCount: 3,
    })
  })

  it('muestra inventario, ventas y despachos con enlace a cada sección', async () => {
    renderPage(viewer())

    expect(await screen.findByRole('link', { name: 'Ir a inventario' })).toHaveAttribute(
      'href',
      '/app/inventario',
    )
    expect(screen.getByRole('link', { name: 'Ir a ventas' })).toHaveAttribute(
      'href',
      '/app/ventas',
    )
    expect(screen.getByRole('link', { name: 'Ir a despachos' })).toHaveAttribute(
      'href',
      '/app/despachos',
    )

    expect(screen.getByText('Inventario')).toBeInTheDocument()
    expect(screen.getByText('Atención de ventas')).toBeInTheDocument()
    expect(screen.getByText('Despachos')).toBeInTheDocument()
    expect(screen.getByText('Esperando pago')).toBeInTheDocument()
    expect(screen.getByText('Pendientes')).toBeInTheDocument()

    expect(screen.queryByText('Todo listo para comenzar')).not.toBeInTheDocument()
    expect(screen.queryByText('Tu contexto')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Agregar producto' })).not.toBeInTheDocument()
  })

  it('muestra la advertencia de correo si la cuenta no está verificada', async () => {
    renderPage(viewer({ emailVerified: false }))

    expect(await screen.findByText('Verifica tu correo')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Verificar ahora' })).toHaveAttribute(
      'href',
      '/verificar-email',
    )
  })
})
