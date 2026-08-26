import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as salesApi from '../../sales/api'
import { PublicCheckoutPage } from '../PublicCheckoutPage'

vi.mock('../../sales/api', () => ({
  fetchPublicOrder: vi.fn(),
  initiateMercadoPagoCheckout: vi.fn(),
  setBuyerDetails: vi.fn(),
  salesKeys: {
    publicOrder: (token: string) => ['public-order', token],
  },
}))

const mocked = vi.mocked(salesApi)

const publicOrder = {
  number: 'V-1024',
  status: 'reserved',
  statusLabel: 'Reservado',
  paymentStatus: 'pending',
  currency: 'CLP',
  subtotal: '10000',
  feeAmount: '0',
  total: '10000',
  deliveryMode: 'shipping',
  paymentMethod: 'bank_transfer',
  availablePaymentMethods: ['bank_transfer'],
  bankTransferInstructions: 'Banco Estado',
  expiresAt: '2026-08-26T01:00:00Z',
  createdAt: '2026-08-25T17:00:00Z',
  rejectionReason: null,
  isExpired: false,
  seller: {
    displayName: 'Taller Ana',
    contactEmail: 'ventas@example.cl',
    contactPhone: '+56911111111',
  },
  buyer: null,
  lines: [
    {
      id: 'line-1',
      name: 'Vela de soya',
      description: 'Lavanda',
      imageUrl: null,
      attributes: [],
      quantity: 2,
      unitSalePrice: '5000',
      currency: 'CLP',
      lineTotal: '10000',
    },
  ],
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/p/public-token/comprar']}>
        <Routes>
          <Route path="/p/:token/comprar" element={<PublicCheckoutPage />} />
          <Route path="/p/:token/estado" element={<p>Estado</p>} />
          <Route path="/p/:token/comprobante" element={<p>Comprobante</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function completeContact() {
  await userEvent.type(screen.getByLabelText('Nombre'), 'Camila Rojas')
  await userEvent.type(screen.getByLabelText('Email'), 'camila@example.cl')
  await userEvent.type(screen.getByLabelText('Destinatario'), 'Camila Rojas')
  await userEvent.type(screen.getByLabelText('Dirección'), 'Los Aromos 123')
  await userEvent.type(screen.getByLabelText('Comuna'), 'Ñuñoa')
  await userEvent.type(screen.getByLabelText('Ciudad'), 'Santiago')
  await userEvent.click(screen.getByRole('button', { name: 'Continuar al pago' }))
}

describe('checkout público', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    mocked.fetchPublicOrder.mockResolvedValue(publicOrder)
    mocked.setBuyerDetails.mockRejectedValue(new Error('Falla temporal del servicio'))
  })

  it('permite volver sin perder datos y conserva el formulario ante un error', async () => {
    renderPage()
    await screen.findByText('Completa tu compra')
    await completeContact()

    expect(await screen.findByText('Elige cómo pagar')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Revisar compra' }))
    expect(await screen.findByText('Revisa y confirma')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Volver' }))
    await userEvent.click(screen.getByRole('button', { name: 'Volver' }))
    expect(screen.getByLabelText('Nombre')).toHaveValue('Camila Rojas')
    expect(screen.getByLabelText('Dirección')).toHaveValue('Los Aromos 123')

    await userEvent.click(screen.getByRole('button', { name: 'Continuar al pago' }))
    await userEvent.click(screen.getByRole('button', { name: 'Revisar compra' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar datos' }))

    expect(await screen.findByText('Falla temporal del servicio')).toBeInTheDocument()
    await waitFor(() => expect(mocked.setBuyerDetails).toHaveBeenCalledTimes(1))

    await userEvent.click(screen.getByRole('button', { name: 'Volver' }))
    await userEvent.click(screen.getByRole('button', { name: 'Volver' }))
    expect(screen.getByLabelText('Email')).toHaveValue('camila@example.cl')
  })
})
