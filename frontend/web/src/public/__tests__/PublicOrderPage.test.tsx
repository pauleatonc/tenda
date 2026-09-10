import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as salesApi from '../../sales/api'
import { PublicOrderPage } from '../PublicOrderPage'

vi.mock('../../sales/api', () => ({
  fetchPublicOrder: vi.fn(),
  uploadPublicPaymentProof: vi.fn(),
  salesKeys: {
    publicOrder: (token: string) => ['public-order', token],
    publicStatus: (token: string) => ['public-order', token, 'status'],
  },
}))

const mocked = vi.mocked(salesApi)

const order = {
  number: 'V-88',
  status: 'reserved',
  statusLabel: 'Reservado',
  paymentStatus: 'pending',
  currency: 'CLP',
  subtotal: '12000',
  feeAmount: '0',
  total: '12000',
  deliveryMode: 'coordinated',
  paymentMethod: 'bank_transfer',
  availablePaymentMethods: ['bank_transfer'],
  bankTransferInstructions: 'Banco: BancoEstado\nNúmero de cuenta: 12345678',
  bankDetails: {
    bankName: 'BancoEstado',
    accountType: 'cuenta_corriente',
    accountTypeLabel: 'Cuenta corriente',
    accountNumber: '12345678',
    taxId: '11.111.111-1',
    confirmationEmail: 'pagos@taller.cl',
  },
  expiresAt: '2026-08-26T01:00:00Z',
  createdAt: '2026-08-25T17:00:00Z',
  rejectionReason: null,
  isExpired: false,
  seller: {
    displayName: 'Taller Norte',
    contactEmail: '',
    contactPhone: '',
    logoUrl: 'https://cdn.test/logo.png',
  },
  buyer: null,
  lines: [
    {
      id: 'line-1',
      name: 'Vela de soya',
      description: '',
      imageUrl: 'https://cdn.test/vela.jpg',
      photos: ['https://cdn.test/vela.jpg', 'https://cdn.test/vela-2.jpg'],
      attributes: [{ label: 'Aroma', value: 'Lavanda' }],
      quantity: 1,
      unitSalePrice: '12000',
      currency: 'CLP',
      lineTotal: '12000',
    },
  ],
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/p/token-1']}>
        <Routes>
          <Route path="/p/:token" element={<PublicOrderPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ficha pública de depósito', () => {
  beforeEach(() => {
    mocked.fetchPublicOrder.mockResolvedValue(order)
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('muestra galería, atributos y carga de comprobante', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Vela de soya' })).toBeInTheDocument()
    expect(screen.getByText('Taller Norte')).toBeInTheDocument()
    expect(document.querySelector('.public-store img')).toHaveAttribute(
      'src',
      'https://cdn.test/logo.png',
    )
    expect(screen.getByText('Plazo para pagar')).toBeInTheDocument()
    expect(
      screen.getByText(/Transfiere el total y sube el comprobante antes de/),
    ).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Vela de soya' })).toHaveAttribute(
      'src',
      'https://cdn.test/vela.jpg',
    )
    expect(screen.getByLabelText('Ver foto 2 de Vela de soya')).toBeInTheDocument()
    expect(screen.getByText('Aroma')).toBeInTheDocument()
    expect(screen.getByText('Lavanda')).toBeInTheDocument()
    expect(screen.getByLabelText('Cantidad reservada: 1')).toBeInTheDocument()
    expect(screen.getByText('BancoEstado')).toBeInTheDocument()
    expect(screen.getByText('12345678')).toBeInTheDocument()
    expect(screen.getByText('11.111.111-1')).toBeInTheDocument()
    expect(screen.getByText('pagos@taller.cl')).toBeInTheDocument()
    expect(
      screen.getByLabelText('Selecciona una foto o PDF del comprobante'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Comprar' })).toBeNull()
  })

  it('oculta el plazo cuando la venta ya fue confirmada', async () => {
    mocked.fetchPublicOrder.mockResolvedValue({
      ...order,
      status: 'paid',
      statusLabel: 'Pagada',
      paymentStatus: 'approved',
    })
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Vela de soya' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Pago confirmado' })).toBeInTheDocument()
    expect(screen.getByText('El vendedor confirmó el pago de este producto.')).toBeInTheDocument()
    expect(screen.queryByText('Plazo para pagar')).toBeNull()
    expect(screen.queryByRole('link', { name: 'Ver estado de la compra' })).toBeNull()
    expect(
      screen.queryByText(/Transfiere el total y sube el comprobante antes de/),
    ).toBeNull()
  })

  it('avanza el carrusel de fotos cada 5 segundos', async () => {
    vi.useFakeTimers({ toFake: ['setInterval'] })
    renderPage()

    expect(await screen.findByRole('img', { name: 'Vela de soya' })).toHaveAttribute(
      'src',
      'https://cdn.test/vela.jpg',
    )
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(screen.getByRole('img', { name: 'Vela de soya' })).toHaveAttribute(
      'src',
      'https://cdn.test/vela-2.jpg',
    )
  })
})
