import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react-native'
import type { ReactElement } from 'react'

import DashboardScreen from '../(tabs)/index'
import * as authApi from '../../../lib/auth-api'
import * as inventoryApi from '../../../lib/inventory-api'
import * as salesApi from '../../../lib/sales-api'
import * as shippingApi from '../../../lib/shipping-api'

jest.mock('../../../lib/auth-api', () => ({
  ...jest.requireActual('../../../lib/auth-api'),
  getMobileViewer: jest.fn(),
}))

jest.mock('../../../lib/inventory-api', () => ({
  fetchDashboard: jest.fn(),
  inventoryKeys: {
    dashboard: () => ['inventory', 'dashboard'],
  },
}))

jest.mock('../../../lib/sales-api', () => ({
  fetchSalesDashboard: jest.fn(),
  salesKeys: {
    dashboard: () => ['sales', 'dashboard'],
  },
}))

jest.mock('../../../lib/shipping-api', () => ({
  fetchShippingDashboard: jest.fn(),
  shippingKeys: {
    dashboard: () => ['shipping', 'dashboard'],
  },
}))

const auth = authApi as jest.Mocked<typeof authApi>
const inventory = inventoryApi as jest.Mocked<typeof inventoryApi>
const sales = salesApi as jest.Mocked<typeof salesApi>
const shipping = shippingApi as jest.Mocked<typeof shippingApi>

function renderScreen(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

function viewer(emailVerified = true) {
  return {
    viewer: {
      id: 'user-1',
      email: 'ana@tenda.cl',
      emailVerified,
      profile: {
        id: 'profile-1',
        fullName: 'Ana Pérez',
        phone: '',
        locale: 'es-CL',
        photoUrl: null,
      },
    },
    organisation: {
      id: 'org-1',
      name: 'Taller Ana',
      timezone: 'America/Santiago',
      address: '',
      description: '',
      logoUrl: null,
    },
    inventory: { id: 'inv-1', name: 'Principal' },
    membership: {
      id: 'membership-1',
      role: 'owner' as const,
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

describe('Inicio mobile', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    auth.getMobileViewer.mockResolvedValue(viewer())
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
      dispatchedCount: 1,
      deliveredCount: 1,
    })
  })

  it('muestra inventario, ventas y despachos con botón a cada sección', async () => {
    await renderScreen(<DashboardScreen />)

    expect(await screen.findByText('Ir a inventario')).toBeOnTheScreen()
    expect(screen.getByText('Ir a ventas')).toBeOnTheScreen()
    expect(screen.getByText('Ir a despachos')).toBeOnTheScreen()
    expect(screen.getByText('Inventario')).toBeOnTheScreen()
    expect(screen.getByText('Ventas')).toBeOnTheScreen()
    expect(screen.getByText('Despachos')).toBeOnTheScreen()
    expect(screen.getByText('Esperando pago')).toBeOnTheScreen()
    expect(screen.getByText('Pendientes')).toBeOnTheScreen()
    expect(screen.queryByText('Todo listo para comenzar')).toBeNull()
    expect(screen.queryByText('Tu contexto')).toBeNull()
    expect(screen.queryByText('Agregar producto')).toBeNull()
  })

  it('muestra la advertencia de correo si la cuenta no está verificada', async () => {
    auth.getMobileViewer.mockResolvedValue(viewer(false))
    await renderScreen(<DashboardScreen />)

    expect(await screen.findByText('Verifica tu correo electrónico')).toBeOnTheScreen()
  })
})
