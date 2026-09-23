import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as inventoryApi from '../../inventory/api'
import * as api from '../api'
import { NewSalePage } from '../NewSalePage'
import { createEmptySaleDraft, loadSaleDraft, saveSaleDraft } from '../model'

vi.mock('../../inventory/api', () => ({
  fetchProducts: vi.fn(),
  inventoryKeys: {
    products: (value: Record<string, unknown>) => ['inventory', 'products', value],
  },
}))

vi.mock('../api', () => ({
  createOrder: vi.fn(),
  fetchPaymentConnection: vi.fn(),
  publishOrderLink: vi.fn(),
  sendOfferLink: vi.fn(),
  salesKeys: {
    paymentConnection: () => ['sales', 'payment-connection'],
  },
}))

const mocked = vi.mocked(api)
const mockedInventory = vi.mocked(inventoryApi)

function seedReviewDraft() {
  const draft = {
    ...createEmptySaleDraft(),
    step: 3 as const,
    idempotencyKey: 'stable-create-key',
    publishIdempotencyKey: 'stable-publish-key',
    lines: [
      {
        clientId: 'line-1',
        productId: 'product-1',
        productName: 'Vela',
        available: 2,
        reserved: 0,
        quantity: 1,
        referencePrice: '5000',
        unitSalePrice: '4500',
        discountPercent: '10',
      },
    ],
  }
  saveSaleDraft(draft)
  return draft
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/app/ventas/nueva']}>
        <Routes>
          <Route path="/app/ventas/nueva" element={<NewSalePage />} />
          <Route path="/app/ventas/:id" element={<p>Ficha de venta</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('envío idempotente de nueva venta', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.clearAllMocks()
    mockedInventory.fetchProducts.mockResolvedValue({
      totalCount: 0,
      hasNextPage: false,
      endCursor: '',
      products: [],
    })
    mocked.fetchPaymentConnection.mockResolvedValue({
      sellerPaymentConnection: null,
      paymentCommissionConfiguration: {
        mode: 'percentage',
        rate: '0',
        minimum: 0,
        zeroFeeEnabled: true,
      },
    })
  })

  it('no encola offline y conserva el borrador y su clave', async () => {
    seedReviewDraft()
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    renderPage()

    await userEvent.click(
      await screen.findByRole('button', { name: 'Generar venta' }),
    )

    expect(
      await screen.findByText(/No enviaremos la venta sin conexión/),
    ).toBeInTheDocument()
    expect(mocked.createOrder).not.toHaveBeenCalled()
    expect(loadSaleDraft().idempotencyKey).toBe('stable-create-key')
    expect(loadSaleDraft().lines).toHaveLength(1)
  })

  it('reutiliza la misma clave al reintentar una falla de red', async () => {
    seedReviewDraft()
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    mocked.createOrder.mockRejectedValue(new TypeError('Failed to fetch'))
    renderPage()

    const submit = await screen.findByRole('button', {
      name: 'Generar venta',
    })
    await userEvent.click(submit)
    await screen.findByText(/Conservamos el borrador y la clave de envío/)
    await userEvent.click(submit)

    await waitFor(() => expect(mocked.createOrder).toHaveBeenCalledTimes(2))
    expect(mocked.createOrder.mock.calls[0][0].idempotencyKey).toBe('stable-create-key')
    expect(mocked.createOrder.mock.calls[1][0].idempotencyKey).toBe('stable-create-key')
  })

  it('pide confirmación en efectivo y abre la ficha sin publicar enlace', async () => {
    const draft = seedReviewDraft()
    saveSaleDraft({ ...draft, paymentMethod: 'cash' })
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    mocked.createOrder.mockResolvedValue({
      replayed: false,
      order: { id: 'order-cash', number: 'V-9' },
    } as never)

    renderPage()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Crear venta en efectivo' }),
    )
    expect(
      screen.getByRole('heading', { name: 'Confirmar venta en efectivo' }),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Crear venta' }))

    await waitFor(() => expect(mocked.createOrder).toHaveBeenCalledTimes(1))
    expect(mocked.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ paymentMethod: 'cash' }),
    )
    expect(mocked.publishOrderLink).not.toHaveBeenCalled()
    expect(await screen.findByText('Ficha de venta')).toBeInTheDocument()
  })

  it('envía el enlace por correo desde la pantalla de enlace listo', async () => {
    saveSaleDraft({
      ...seedReviewDraft(),
      step: 4,
      createdOrderId: 'order-1',
      publicUrl: 'https://shop.test/p/token',
    })
    mocked.sendOfferLink.mockResolvedValue({
      replayed: false,
      publicUrl: 'https://shop.test/p/token',
      order: { id: 'order-1' },
    } as never)

    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Enviar por correo' }))
    expect(
      screen.getByText('Ingresa el correo del comprador para enviarle el enlace.'),
    ).toBeInTheDocument()
    const confirm = screen.getByRole('button', { name: 'Enviar' })
    expect(confirm).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Correo del comprador'), 'camila@example.cl')
    await userEvent.click(confirm)

    await waitFor(() =>
      expect(mocked.sendOfferLink).toHaveBeenCalledWith({
        orderId: 'order-1',
        email: 'camila@example.cl',
        idempotencyKey: expect.any(String),
      }),
    )
    expect(await screen.findByText('Enlace enviado')).toBeInTheDocument()
  })
})
