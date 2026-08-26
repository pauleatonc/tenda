import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as salesApi from '../../sales/api'
import { PublicProofPage } from '../PublicProofPage'

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
  status: 'purchase_in_progress',
  statusLabel: 'Proceso de compra',
  paymentStatus: 'pending',
  currency: 'CLP',
  subtotal: '35000',
  feeAmount: '0',
  total: '35000',
  deliveryMode: 'pickup',
  paymentMethod: 'bank_transfer',
  availablePaymentMethods: ['bank_transfer'],
  bankTransferInstructions: 'Banco Estado\nCuenta corriente 123',
  expiresAt: '2026-08-26T01:00:00Z',
  createdAt: '2026-08-25T17:00:00Z',
  rejectionReason: null,
  isExpired: false,
  seller: {
    displayName: 'Taller Norte',
    contactEmail: '',
    contactPhone: '',
  },
  buyer: null,
  lines: [
    {
      id: 'line-1',
      name: 'Tazón',
      description: '',
      imageUrl: null,
      attributes: [],
      quantity: 1,
      unitSalePrice: '35000',
      currency: 'CLP',
      lineTotal: '35000',
    },
  ],
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/p/token-1/comprobante']}>
        <Routes>
          <Route path="/p/:token/comprobante" element={<PublicProofPage />} />
          <Route path="/p/:token/estado" element={<p>Estado público</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('carga pública de comprobante', () => {
  beforeEach(() => {
    mocked.fetchPublicOrder.mockResolvedValue(order)
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:preview'),
      revokeObjectURL: vi.fn(),
    })
  })

  it('muestra progreso entre preparar, PUT y completar', async () => {
    let finish:
      | ((value: { assetId: string; status: string; orderStatus: string }) => void)
      | undefined
    mocked.uploadPublicPaymentProof.mockImplementation(
      async (_token, _file, onProgress) => {
        onProgress?.(37)
        return new Promise((resolve) => {
          finish = resolve
        })
      },
    )

    renderPage()
    await screen.findByText('Envía tu comprobante')

    const file = new File(['receipt'], 'comprobante.png', { type: 'image/png' })
    await userEvent.upload(
      screen.getByLabelText('Selecciona una foto o PDF del comprobante'),
      file,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Enviar comprobante' }))

    expect(await screen.findByText('Carga 37%')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '37')
    expect(mocked.uploadPublicPaymentProof).toHaveBeenCalledWith(
      'token-1',
      file,
      expect.any(Function),
    )

    finish?.({
      assetId: 'asset-1',
      status: 'ready',
      orderStatus: 'purchase_validation',
    })
    expect(await screen.findByText('Comprobante enviado')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Ver estado' })).toBeEnabled(),
    )
  })
})
