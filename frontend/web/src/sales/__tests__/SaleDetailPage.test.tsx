import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as api from '../api'
import { SaleDetailPage } from '../SaleDetailPage'

vi.mock('../api', () => ({
  cancelOrder: vi.fn(),
  confirmManualPayment: vi.fn(),
  fetchOrder: vi.fn(),
  refundPayment: vi.fn(),
  resendOrderLink: vi.fn(),
  reviewPaymentProof: vi.fn(),
  salesKeys: {
    order: (id: string) => ['sales', 'order', id],
  },
}))

const mocked = vi.mocked(api)

const order = {
  id: 'order-1',
  number: 'V-100',
  status: 'purchase_validation',
  currency: 'CLP',
  subtotal: '10000',
  feeAmount: '0',
  total: '10000',
  paymentMethod: 'bank_transfer',
  deliveryMode: 'pickup',
  nextAction: 'review_proof',
  reconciliationRequired: false,
  reconciliationMessage: null,
  expiresAt: '2026-08-26T01:00:00Z',
  confirmedAt: null,
  createdAt: '2026-08-25T17:00:00Z',
  updatedAt: '2026-08-25T18:00:00Z',
  publicUrl: 'https://example.test/p/token',
  publishedAt: '2026-08-25T17:01:00Z',
  costsVisible: false,
  buyer: {
    fullName: 'Camila',
    email: 'camila@example.cl',
    phone: '',
    recipientName: '',
    deliveryAddress: '',
    deliveryCommune: '',
    deliveryCity: '',
    taxId: '',
    taxName: '',
    taxBusinessActivity: '',
    taxAddress: '',
    taxCommune: '',
    taxCity: '',
    taxEmail: '',
  },
  lines: [
    {
      id: 'line-1',
      productId: 'product-1',
      productName: 'Vela',
      productImageUrl: null,
      quantity: 1,
      unitSalePrice: '10000',
      unitCostSnapshot: null,
      currency: 'CLP',
      lineTotal: '10000',
    },
  ],
  payment: {
    id: 'payment-1',
    method: 'bank_transfer',
    status: 'proof_submitted',
    amount: '10000',
    currency: 'CLP',
    feeAmount: '0',
    refundedAmount: '0',
    provider: 'manual',
    providerReference: '',
    paidAt: null,
    rejectionReason: null,
    proof: {
      id: 'proof-1',
      fileName: 'comprobante.pdf',
      contentType: 'application/pdf',
      privatePreviewUrl: 'https://signed.example.test/proof',
      uploadedAt: '2026-08-25T17:30:00Z',
    },
  },
  timeline: [
    {
      id: 'event-1',
      eventType: 'proof_submitted',
      title: 'Comprobante recibido',
      detail: '',
      actorName: '',
      createdAt: '2026-08-25T17:30:00Z',
    },
  ],
  allowedActions: {
    approveProof: true,
    rejectProof: true,
    confirmManualPayment: false,
    cancel: false,
    refund: false,
    resendLink: false,
  },
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/app/ventas/order-1']}>
        <Routes>
          <Route path="/app/ventas/:id" element={<SaleDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('detalle de venta', () => {
  beforeEach(() => {
    mocked.fetchOrder.mockResolvedValue(order)
  })

  it('respeta guards y bloquea una aprobación doble', async () => {
    let finish: ((value: { replayed: boolean; order: typeof order }) => void) | undefined
    mocked.reviewPaymentProof.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )

    renderPage()
    expect(
      await screen.findByRole('button', { name: 'Aprobar comprobante' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Rechazar comprobante' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar pago manual' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Cancelar venta' })).toBeNull()
    expect(screen.queryByText('Costo snapshot')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Aprobar comprobante' }))
    const confirm = screen.getByRole('button', { name: 'Confirmar' })
    await userEvent.dblClick(confirm)

    await waitFor(() => expect(mocked.reviewPaymentProof).toHaveBeenCalledTimes(1))
    expect(confirm).toBeDisabled()

    finish?.({ replayed: false, order })
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Aprobar comprobante' })).toBeNull(),
    )
  })
})
