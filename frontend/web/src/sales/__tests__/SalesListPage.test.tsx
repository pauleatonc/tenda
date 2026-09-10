import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as api from '../api'
import { SalesListPage } from '../SalesListPage'

vi.mock('../api', () => ({
  fetchSalesDashboard: vi.fn(),
  fetchOrders: vi.fn(),
  salesKeys: {
    dashboard: () => ['sales', 'dashboard'],
    orders: (variables: unknown) => ['sales', 'orders', variables],
  },
}))

const mocked = vi.mocked(api)

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/app/ventas']}>
        <Routes>
          <Route path="/app/ventas" element={<SalesListPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('listado de ventas', () => {
  beforeEach(() => {
    mocked.fetchSalesDashboard.mockResolvedValue({
      totalOrders: 1,
      activeOrders: 1,
      awaitingBuyerCount: 0,
      awaitingPaymentCount: 0,
      awaitingValidationCount: 1,
      reconciliationRequiredCount: 0,
      confirmedThisMonthAmount: '0',
      confirmedThisMonthCount: 0,
      currency: 'CLP',
    })
    mocked.fetchOrders.mockResolvedValue({
      totalCount: 1,
      pageInfo: { hasNextPage: false, endCursor: '' },
      nodes: [
        {
          id: 'order-1',
          number: 'V-100',
          status: 'purchase_validation',
          currency: 'CLP',
          total: '10000',
          paymentMethod: 'bank_transfer',
          nextAction: 'review_proof',
          reconciliationRequired: false,
          hasProof: true,
          expiresAt: '2026-08-26T01:00:00Z',
          confirmedAt: null,
          createdAt: '2026-08-25T17:00:00Z',
          buyer: { fullName: 'Camila' },
        },
      ],
    })
  })

  it('muestra Ver comprobante cuando hay proof', async () => {
    renderPage()
    expect(await screen.findByRole('link', { name: 'V-100' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver comprobante' })).toHaveAttribute(
      'href',
      '/app/ventas/order-1',
    )
  })
})
