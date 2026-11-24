import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewerPayload } from '../../auth/api'
import type { OrganisationBilling } from '../api'
import { BillingPlanPage } from '../BillingPlanPage'

vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api')
  return {
    ...actual,
    fetchOrganisationBilling: vi.fn(),
    startPlanCheckout: vi.fn(),
    cancelSubscription: vi.fn(),
    resumeSubscription: vi.fn(),
  }
})

const billing: OrganisationBilling = {
  planCode: 'free',
  planName: 'Gratis',
  priceClp: 0,
  productLimit: 5,
  productCount: 1,
  remainingSlots: 4,
  aiAssistedEnabled: false,
  canCreateProduct: true,
  subscriptionStatus: 'active',
  cancelAtPeriodEnd: false,
  currentPeriodEnd: null,
  needsPlanSelection: false,
  plans: [
    {
      code: 'free',
      name: 'Gratis',
      priceClp: 0,
      productLimit: 5,
      aiAssistedEnabled: false,
      isCurrent: true,
    },
    {
      code: 'starter',
      name: 'Starter',
      priceClp: 4990,
      productLimit: 15,
      aiAssistedEnabled: true,
      isCurrent: false,
    },
  ],
}

function viewer(): ViewerPayload {
  return {
    viewer: {
      id: 'user-1',
      email: 'duena@tenda.cl',
      emailVerified: true,
      isStaff: false,
      profile: {
        id: 'profile-1',
        fullName: 'Dueña',
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

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/app/cuenta/plan']}>
        <Routes>
          <Route element={<Outlet context={viewer()} />}>
            <Route path="/app/cuenta/plan" element={<BillingPlanPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('BillingPlanPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deja el cambio de plan disponible sin volver a pedir los términos', async () => {
    const api = await import('../api')
    vi.mocked(api.fetchOrganisationBilling).mockResolvedValue(billing)
    renderPage()

    expect(await screen.findByRole('button', { name: 'Mejorar a Starter' })).toBeEnabled()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.queryByText(/para suscribirme/)).not.toBeInTheDocument()
  })
})
