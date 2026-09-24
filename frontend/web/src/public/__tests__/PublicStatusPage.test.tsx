import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as salesApi from '../../sales/api'
import { PublicStatusPage } from '../PublicStatusPage'

vi.mock('../../sales/api', () => ({
  fetchPublicOrderStatus: vi.fn(),
  salesKeys: {
    publicStatus: (token: string) => ['public-order', token, 'status'],
  },
}))

const mocked = vi.mocked(salesApi)

const status = {
  number: 'V-88',
  status: 'purchase_in_progress',
  statusLabel: 'Compra en curso',
  paymentStatus: 'pending',
  expiresAt: '2026-08-26T01:00:00Z',
  updatedAt: '2026-08-25T17:30:00Z',
  rejectionReason: null,
  isExpired: false,
}

function renderPage(search = '') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/p/token-1/estado${search}`]}>
        <Routes>
          <Route path="/p/:token/estado" element={<PublicStatusPage />} />
          <Route path="/p/:token/comprar" element={<p>Checkout</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('PublicStatusPage', () => {
  beforeEach(() => {
    mocked.fetchPublicOrderStatus.mockResolvedValue(status)
  })

  it('explica el retorno exitoso desde Mercado Pago', async () => {
    renderPage('?retorno=mercadopago&resultado=success')

    expect(await screen.findByText('Volviste desde Mercado Pago')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Estamos verificando el pago; el estado cambiará cuando el proveedor lo confirme.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Intentar de nuevo' })).toBeNull()
  })

  it('explica un pago pendiente en Mercado Pago', async () => {
    renderPage('?retorno=mercadopago&resultado=pending')

    expect(await screen.findByText('Pago pendiente en Mercado Pago')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Tu pago quedó pendiente en Mercado Pago. Este estado cambiará cuando el proveedor lo confirme.',
      ),
    ).toBeInTheDocument()
  })

  it('permite reintentar cuando el pago falla', async () => {
    renderPage('?retorno=mercadopago&resultado=failure')

    expect(await screen.findByText('El pago no se completó')).toBeInTheDocument()
    expect(
      screen.getByText('El pago no se completó. Puedes intentarlo de nuevo.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Intentar de nuevo' })).toHaveAttribute(
      'href',
      '/p/token-1/comprar',
    )
  })
})
