import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as salesApi from '../../sales/api'
import type { ProductRow } from '../api'
import { GenerateSaleDialog } from '../GenerateSaleDialog'

vi.mock('../../sales/api', () => ({
  createOrder: vi.fn(),
  publishOrderLink: vi.fn(),
  sendOfferLink: vi.fn(),
}))

const mocked = vi.mocked(salesApi)

const product: ProductRow = {
  id: 'product-1',
  name: 'Velas de soya',
  catalogStatus: 'active',
  purchasePrice: '2000',
  salePrice: '5000',
  currency: 'CLP',
  extraAttributes: {},
  lowStockThreshold: null,
  effectiveLowStockThreshold: 5,
  archivedAt: null,
  stock: { onHand: 12, reserved: 2, available: 10, activeFulfilment: 0 },
}

function renderDialog() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Routes>
          <Route
            path="/"
            element={
              <GenerateSaleDialog
                product={product}
                hasBankDetails
                onClose={vi.fn()}
              />
            }
          />
          <Route path="/app/ventas/:id" element={<p>Ficha de venta</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('GenerateSaleDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  it('genera una venta por depósito y no muta los otros medios', async () => {
    mocked.createOrder.mockResolvedValue({
      replayed: false,
      order: { id: 'order-1' },
    } as never)
    mocked.publishOrderLink.mockResolvedValue({
      replayed: false,
      publicUrl: 'https://shop.test/p/token',
      order: { id: 'order-1' },
    } as never)

    renderDialog()

    expect(screen.getByText('Depósito')).toBeInTheDocument()
    expect(screen.getByText('Pago Online')).toBeInTheDocument()
    expect(screen.getByText('Efectivo')).toBeInTheDocument()
    expect(screen.getAllByText('Próximamente')).toHaveLength(1)
    expect(mocked.createOrder).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Generar depósito' }))

    await waitFor(() => expect(mocked.createOrder).toHaveBeenCalledTimes(1))
    expect(mocked.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        deliveryMode: 'shipping',
        paymentMethod: 'bank_transfer',
        lines: [
          expect.objectContaining({
            productId: 'product-1',
            quantity: 1,
            unitSalePrice: '5000',
          }),
        ],
      }),
    )
    expect(mocked.publishOrderLink).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'order-1' }),
    )
    expect(await screen.findByDisplayValue('https://shop.test/p/token')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver venta' })).toHaveAttribute(
      'href',
      'https://shop.test/p/token',
    )
    expect(screen.getByRole('link', { name: 'Ver venta' })).toHaveAttribute('target', '_blank')
  })

  it('pide completar datos bancarios antes de generar un depósito', () => {
    render(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
          })
        }
      >
        <MemoryRouter>
          <GenerateSaleDialog
            product={product}
            hasBankDetails={false}
            onClose={vi.fn()}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(
      screen.getByText('Para poder pedir depósitos debe agregar sus datos bancarios.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Agregar datos bancarios' })).toHaveAttribute(
      'href',
      '/app/configuracion',
    )
    expect(screen.queryByRole('button', { name: 'Generar depósito' })).toBeNull()
    expect(mocked.createOrder).not.toHaveBeenCalled()
  })

  it('confirma efectivo y abre la ficha de la venta', async () => {
    mocked.createOrder.mockResolvedValue({
      replayed: false,
      order: { id: 'order-cash' },
    } as never)

    renderDialog()
    await userEvent.click(screen.getByRole('radio', { name: /Efectivo/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(
      screen.getByRole('heading', { name: 'Confirmar venta en efectivo' }),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Crear venta' }))

    await waitFor(() => expect(mocked.createOrder).toHaveBeenCalledTimes(1))
    expect(mocked.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        deliveryMode: 'shipping',
        paymentMethod: 'cash',
      }),
    )
    expect(mocked.publishOrderLink).not.toHaveBeenCalled()
    expect(await screen.findByText('Ficha de venta')).toBeInTheDocument()
  })

  it('permite elegir depósito y efectivo como métodos', async () => {
    renderDialog()

    const deposit = screen.getByRole('radio', { name: /Depósito/ })
    const cash = screen.getByRole('radio', { name: /Efectivo/ })
    expect(deposit).toBeChecked()
    expect(cash).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Generar depósito' })).toBeInTheDocument()

    await userEvent.click(cash)
    expect(deposit).not.toBeChecked()
    expect(cash).toBeChecked()
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Generar depósito' })).toBeNull()

    await userEvent.click(deposit)
    expect(deposit).toBeChecked()
    expect(screen.getByRole('button', { name: 'Generar depósito' })).toBeInTheDocument()
  })

  it('permite elegir el tipo de entrega', async () => {
    mocked.createOrder.mockResolvedValue({
      replayed: false,
      order: { id: 'order-1' },
    } as never)
    mocked.publishOrderLink.mockResolvedValue({
      replayed: false,
      publicUrl: 'https://shop.test/p/token',
      order: { id: 'order-1' },
    } as never)

    renderDialog()
    expect(screen.getByRole('radio', { name: /Despacho/ })).toBeChecked()
    await userEvent.click(screen.getByRole('radio', { name: /Retiro/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Generar depósito' }))

    await waitFor(() => expect(mocked.createOrder).toHaveBeenCalledTimes(1))
    expect(mocked.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        deliveryMode: 'pickup',
        paymentMethod: 'bank_transfer',
      }),
    )
  })
})
