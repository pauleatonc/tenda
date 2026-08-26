import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react-native'
import type { ReactElement } from 'react'

import MoreScreen from '../(tabs)/mas'
import BalancesScreen from '../balances'
import * as authApi from '../../../lib/auth-api'
import * as inventoryApi from '../../../lib/inventory-api'
import * as salesApi from '../../../lib/sales-api'

jest.mock('../../../lib/auth-api', () => ({
  ...jest.requireActual('../../../lib/auth-api'),
  getMobileViewer: jest.fn(),
  mobileLogout: jest.fn(),
}))

jest.mock('../../../lib/inventory-api', () => ({
  ...jest.requireActual('../../../lib/inventory-api'),
  fetchProducts: jest.fn(),
}))

jest.mock('../../../lib/sales-api', () => ({
  fetchSalesBalance: jest.fn(),
  salesKeys: {
    balance: (filter: unknown) => ['sales', 'balance', filter],
  },
}))

const auth = authApi as jest.Mocked<typeof authApi>
const inventory = inventoryApi as jest.Mocked<typeof inventoryApi>
const sales = salesApi as jest.Mocked<typeof salesApi>

function renderScreen(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

function viewer(viewFinancials: boolean) {
  return {
    viewer: {
      id: 'user-1',
      email: 'seller@example.com',
      emailVerified: true,
      profile: { id: 'profile-1', fullName: 'Seller', phone: '', locale: 'es-CL' },
    },
    organisation: { id: 'org-1', name: 'Tienda', timezone: 'America/Santiago' },
    inventory: { id: 'inventory-1', name: 'Principal' },
    membership: {
      id: 'membership-1',
      role: viewFinancials ? ('owner' as const) : ('operator' as const),
      permissions: {
        viewFinancials,
        manageMembers: viewFinancials,
        manageSensitiveConfiguration: viewFinancials,
        manageInventorySchema: false,
      },
    },
  }
}

describe('Balance mobile y permisos', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    inventory.fetchProducts.mockResolvedValue({
      totalCount: 0,
      hasNextPage: false,
      endCursor: '',
      products: [],
    })
  })

  it('oculta el enlace de balance cuando viewer no tiene permiso', async () => {
    auth.getMobileViewer.mockResolvedValue(viewer(false))

    await renderScreen(<MoreScreen />)

    expect(await screen.findByText('seller@example.com')).toBeOnTheScreen()
    expect(screen.queryByText('Balances')).toBeNull()
  })

  it('advierte que el margen está incompleto y nunca trata costo null como cero', async () => {
    auth.getMobileViewer.mockResolvedValue(viewer(true))
    sales.fetchSalesBalance.mockResolvedValue({
      currency: 'CLP',
      timezone: 'America/Santiago',
      grossSales: '20000',
      refunds: '0',
      netSales: '20000',
      knownCostOfGoods: '3000',
      grossMargin: '17000',
      pendingAmount: '5000',
      operationCount: 2,
      recognizedLineCount: 4,
      costedLineCount: 1,
      costCoverage: '0.25',
      marginComplete: false,
      isPartial: false,
      warnings: [],
    })

    await renderScreen(<BalancesScreen />)

    expect(await screen.findByText('Margen con costos incompletos')).toBeOnTheScreen()
    expect(
      screen.getByText(
        'Cobertura de costo 25%: 1 de 4 líneas tienen costo snapshot. Los costos faltantes no se cuentan como cero.',
      ),
    ).toBeOnTheScreen()
    expect(
      screen.getByText(/No es contabilidad legal, tributaria ni conciliación bancaria/),
    ).toBeOnTheScreen()
  })
})
