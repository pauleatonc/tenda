import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import type { ViewerPayload } from '../../auth/api'
import { StaffOverviewPage } from '../StaffOverviewPage'
import type { StaffPlatformOverview } from '../api'

vi.mock('../api', () => ({
  fetchStaffPlatformOverview: vi.fn(),
  staffKeys: { overview: () => ['staff', 'platform-overview'] },
}))

const overview: StaffPlatformOverview = {
  generatedAt: '2026-11-23T12:00:00.000Z',
  organisationCount: 2,
  organisationsLast30Days: 1,
  organisationsWithSales: 1,
  plans: [
    {
      code: 'free',
      name: 'Gratis',
      organisationCount: 1,
      priceClp: 0,
      monthlyRevenue: 0,
    },
    {
      code: 'pro',
      name: 'Pro',
      organisationCount: 1,
      priceClp: 14990,
      monthlyRevenue: 14990,
    },
  ],
  estimatedMonthlyRevenue: 14990,
  activeProductCount: 8,
  archivedProductCount: 2,
  productsMissingCost: 1,
  inventoryUnits: 40,
  inventoryReservedUnits: 3,
  inventoryAtCost: '120000',
  inventoryAtSalePrice: '240000',
  inventoryCostComplete: false,
  confirmedSalesAmount: '500000',
  confirmedSalesCount: 6,
  refundedAmount: '10000',
  netSalesAmount: '490000',
  knownCogs: '200000',
  grossMargin: '290000',
  salesCostComplete: false,
  pendingSalesAmount: '15000',
  pendingSalesCount: 2,
  pendingShipmentCount: 1,
}

function viewer(isStaff: boolean): ViewerPayload {
  return {
    viewer: {
      id: 'user-1',
      email: 'interno@tenda.cl',
      emailVerified: true,
      isStaff,
      profile: {
        id: 'profile-1',
        fullName: 'Interno',
        phone: '',
        locale: 'es-CL',
        photoUrl: null,
      },
    },
    organisation: {
      id: 'org-1',
      name: 'Tienda',
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
        manageMembers: true,
        manageSensitiveConfiguration: true,
        manageInventorySchema: true,
        viewFinancials: true,
      },
    },
  }
}

function renderPage(isStaff: boolean) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/app/plataforma']}>
        <Routes>
          <Route path="/app" element={<p>Inicio</p>} />
          <Route element={<Outlet context={viewer(isStaff)} />}>
            <Route path="/app/plataforma" element={<StaffOverviewPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('StaffOverviewPage', () => {
  it('keeps the platform view away from people who are not staff', async () => {
    renderPage(false)
    expect(await screen.findByText('Inicio')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Plataforma' })).not.toBeInTheDocument()
  })

  it('shows coarse platform figures for staff', async () => {
    const api = await import('../api')
    vi.mocked(api.fetchStaffPlatformOverview).mockResolvedValue(overview)
    renderPage(true)

    expect(await screen.findByRole('heading', { name: 'Plataforma' })).toBeInTheDocument()
    expect(await screen.findByText('Tiendas por plan')).toBeInTheDocument()
    expect(screen.getAllByText('Gratis')).toHaveLength(2)
    expect(screen.getAllByText('Pro')).toHaveLength(2)
    const revenue = screen.getByRole('heading', {
      name: 'Ingreso mensual estimado',
    }).parentElement
    expect(revenue).toHaveTextContent('1 tienda × $0')
    expect(revenue).toHaveTextContent('1 tienda × $14.990')
    expect(revenue).toHaveTextContent('Total')
    expect(revenue).toHaveTextContent('$14.990')
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(
      screen.getByText(/El margen usa solo líneas con costo registrado/),
    ).toBeInTheDocument()
  })
})
