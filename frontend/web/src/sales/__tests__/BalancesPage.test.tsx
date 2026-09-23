import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewerPayload } from '../../auth/api'
import * as inventoryApi from '../../inventory/api'
import * as salesApi from '../api'
import { BalancesPage } from '../BalancesPage'

vi.mock('../../inventory/api', () => ({
  fetchProducts: vi.fn(),
  inventoryKeys: {
    products: (value: Record<string, unknown>) => ['inventory', 'products', value],
  },
}))

vi.mock('../api', () => ({
  fetchSalesBalance: vi.fn(),
  fetchSalesBalanceBreakdown: vi.fn(),
  salesKeys: {
    balance: (value: Record<string, unknown>) => ['sales', 'balance', value],
    balanceBreakdown: (value: Record<string, unknown>) => [
      'sales',
      'balance-breakdown',
      value,
    ],
  },
}))

const mockedSales = vi.mocked(salesApi)
const mockedInventory = vi.mocked(inventoryApi)

function viewer(viewFinancials: boolean): ViewerPayload {
  return {
    viewer: {
      id: 'user-1',
      email: 'ana@example.cl',
      emailVerified: true,
      profile: { id: 'profile-1', fullName: 'Ana', phone: '', locale: 'es-CL', photoUrl: null },
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
    inventory: { id: 'inventory-1', name: 'Principal' },
    membership: {
      id: 'membership-1',
      role: viewFinancials ? 'owner' : 'operator',
      roleLabel: viewFinancials ? 'titular' : 'equipo',
      permissions: {
        viewFinancials,
        manageMembers: false,
        manageSensitiveConfiguration: false,
        manageInventorySchema: false,
      },
    },
  }
}

function renderPage(context: ViewerPayload) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  function Shell() {
    return <Outlet context={context} />
  }
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/app/balances']}>
        <Routes>
          <Route path="/app" element={<Shell />}>
            <Route path="balances" element={<BalancesPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('balance comercial', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedInventory.fetchProducts.mockResolvedValue({
      totalCount: 0,
      hasNextPage: false,
      endCursor: '',
      products: [],
    })
    mockedSales.fetchSalesBalanceBreakdown.mockResolvedValue({
      totalCount: 0,
      pageInfo: { hasNextPage: false, endCursor: '' },
      nodes: [],
    })
  })

  it('deniega el acceso sin consultar cifras financieras', async () => {
    renderPage(viewer(false))

    expect(
      await screen.findByText('No tienes acceso a información financiera'),
    ).toBeInTheDocument()
    expect(mockedSales.fetchSalesBalance).not.toHaveBeenCalled()
    expect(mockedSales.fetchSalesBalanceBreakdown).not.toHaveBeenCalled()
  })

  it('advierte que costos nulos dejan el margen incompleto', async () => {
    mockedSales.fetchSalesBalance.mockResolvedValue({
      currency: 'CLP',
      timezone: 'America/Santiago',
      grossSales: '100000',
      refunds: '10000',
      netSales: '90000',
      knownCostOfGoods: '42000',
      grossMargin: '48000',
      pendingAmount: '15000',
      operationCount: 3,
      recognizedLineCount: 5,
      costedLineCount: 3,
      costCoverage: '0.6',
      marginComplete: false,
      inventoryAtCost: '200000',
      inventoryAtSalePrice: '350000',
      inventoryPotentialMargin: '150000',
      inventoryValuationComplete: true,
      isPartial: false,
      warnings: [],
    })

    renderPage(viewer(true))

    expect(await screen.findByText('El margen está incompleto')).toBeInTheDocument()
    expect(screen.getByText(/Cobertura de costo: 60%/)).toBeInTheDocument()
    expect(
      screen.getByText(/Los costos desconocidos no se interpretan como cero/),
    ).toBeInTheDocument()
    expect(screen.getByText('$48.000*')).toBeInTheDocument()
    expect(screen.getByText('Inventario al costo')).toBeInTheDocument()
    expect(screen.getByText('Inventario a precio de venta')).toBeInTheDocument()
    expect(screen.getByText('Margen potencial del stock')).toBeInTheDocument()
    expect(screen.getByText('$200.000')).toBeInTheDocument()
    expect(screen.getByText('$350.000')).toBeInTheDocument()
    expect(screen.getByText('$150.000')).toBeInTheDocument()
  })
})
