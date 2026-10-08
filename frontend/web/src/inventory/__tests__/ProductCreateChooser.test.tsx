import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as billingApi from '../../billing/api'
import { ProductCreateChooser } from '../ProductCreateChooser'

vi.mock('../../billing/api', async () => {
  const actual =
    await vi.importActual<typeof import('../../billing/api')>('../../billing/api')
  return {
    ...actual,
    fetchOrganisationBilling: vi.fn(),
  }
})

const mocked = vi.mocked(billingApi)

function renderChooser(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ProductCreateChooser', () => {
  beforeEach(() => {
    mocked.fetchOrganisationBilling.mockResolvedValue({
      planCode: 'starter',
      planName: 'Starter',
      priceClp: 4990,
      productLimit: 15,
      productCount: 2,
      remainingSlots: 13,
      aiAssistedEnabled: true,
      canCreateProduct: true,
      subscriptionStatus: 'active',
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
      needsPlanSelection: false,
      plans: [],
    })
  })

  it('ofrece las tres formas de agregar un producto en plan de pago', async () => {
    renderChooser(<ProductCreateChooser />)

    expect(screen.getByRole('heading', { name: 'Agregar producto' })).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /Creación asistida/ })).toHaveAttribute(
        'href',
        '/app/inventario/nuevo/asistida',
      ),
    )
    expect(screen.getByRole('link', { name: /Carga manual/ })).toHaveAttribute(
      'href',
      '/app/inventario/nuevo/manual',
    )
    expect(
      screen.getByRole('link', { name: /Agregar variante a un producto existente/ }),
    ).toHaveAttribute('href', '/app/inventario/nuevo/variante')
  })

  it('bloquea creación asistida en plan gratis', async () => {
    mocked.fetchOrganisationBilling.mockResolvedValue({
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
      plans: [],
    })
    renderChooser(<ProductCreateChooser />)
    await waitFor(() =>
      expect(screen.getByText(/Disponible desde Starter/)).toBeInTheDocument(),
    )
    expect(
      screen.queryByRole('link', { name: /Creación asistida/ }),
    ).not.toBeInTheDocument()
  })
})
