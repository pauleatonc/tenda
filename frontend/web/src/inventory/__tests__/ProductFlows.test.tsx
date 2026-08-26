import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ProductDetailPage } from '../ProductDetailPage'
import { ProductFormPage } from '../ProductFormPage'
import * as api from '../api'
import type { ProductRow } from '../api'

vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api')
  return {
    ...actual,
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
    archiveProduct: vi.fn(),
    restoreProduct: vi.fn(),
    fetchInventorySchema: vi.fn(),
    fetchProductDetail: vi.fn(),
    fetchProductMovements: vi.fn(),
  }
})

const mocked = vi.mocked(api)

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
  stock: { onHand: 12, reserved: 0, available: 12, activeFulfilment: 0 },
}

const schema = {
  inventoryId: 'inv-1',
  name: 'Inventario principal',
  lowStockThreshold: 5,
  maxActiveFields: 15,
  fields: [],
}

function renderWithRouter(ui: React.ReactElement, path: string, route: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={route} element={ui} />
          <Route path="/app/inventario/:productId" element={<p>Detalle</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ProductFormPage', () => {
  beforeEach(() => {
    mocked.fetchInventorySchema.mockResolvedValue(schema)
  })

  it('no duplica el producto cuando se envía dos veces seguidas', async () => {
    let resolveCreate: (() => void) | undefined
    mocked.createProduct.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = () => resolve({ product, movement: null, replayed: false })
        }),
    )

    renderWithRouter(
      <ProductFormPage mode="create" />,
      '/app/inventario/nuevo',
      '/app/inventario/nuevo',
    )

    await userEvent.type(screen.getByLabelText('Nombre'), 'Velas de soya')
    const submit = screen.getByRole('button', { name: 'Crear producto' })
    await userEvent.click(submit)
    await userEvent.click(submit)

    await waitFor(() => {
      expect(mocked.createProduct).toHaveBeenCalledTimes(1)
    })
    expect(submit).toBeDisabled()

    resolveCreate?.()
    expect(await screen.findByText('Detalle')).toBeInTheDocument()
    expect(mocked.createProduct).toHaveBeenCalledTimes(1)
  })

  it('exige nombre y montos enteros antes de llamar al backend', async () => {
    renderWithRouter(
      <ProductFormPage mode="create" />,
      '/app/inventario/nuevo',
      '/app/inventario/nuevo',
    )

    await userEvent.type(screen.getByLabelText('Precio de venta'), '1500,5')
    await userEvent.click(screen.getByRole('button', { name: 'Crear producto' }))

    expect(
      (await screen.findAllByText('Escribe el nombre del producto.')).length,
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByText('Usa un monto entero en pesos, sin decimales.').length,
    ).toBeGreaterThan(0)
    expect(mocked.createProduct).not.toHaveBeenCalled()
  })
})

describe('ProductDetailPage', () => {
  beforeEach(() => {
    mocked.fetchInventorySchema.mockResolvedValue(schema)
    mocked.fetchProductDetail.mockResolvedValue({
      product: {
        ...product,
        createdAt: '2026-08-01T12:00:00Z',
        updatedAt: '',
        media: [],
      },
      breakdown: {
        available: 12,
        totalCount: 0,
        pageInfo: { hasNextPage: false, endCursor: '' },
        lines: [],
      },
      orders: {
        totalCount: 0,
        availableFromStage: 'sales',
        nodes: [],
        pageInfo: { hasNextPage: false, endCursor: '' },
      },
      shipments: {
        totalCount: 0,
        availableFromStage: 'shipping',
        nodes: [],
        pageInfo: { hasNextPage: false, endCursor: '' },
      },
    } as unknown as Awaited<ReturnType<typeof api.fetchProductDetail>>)
    mocked.fetchProductMovements.mockResolvedValue({
      totalCount: 1,
      pageInfo: { hasNextPage: false, endCursor: '' },
      nodes: [
        {
          id: 'movement-1',
          productId: 'product-1',
          productName: 'Velas de soya',
          movementType: 'entry',
          quantity: 12,
          balanceAfter: 12,
          reason: 'Carga inicial',
          note: '',
          actorName: 'Ana',
          createdAt: '2026-08-01T12:00:00Z',
        },
      ],
    })
  })

  it('pide confirmación para archivar y conserva el historial', async () => {
    mocked.archiveProduct.mockResolvedValue({ ...product, catalogStatus: 'archived' })

    renderWithRouter(
      <ProductDetailPage />,
      '/app/inventario/product-1',
      '/app/inventario/:productId',
    )

    expect(
      await screen.findByRole('heading', { name: 'Velas de soya' }),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Archivar' }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAccessibleName('Archivar producto')
    expect(mocked.archiveProduct).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Archivar producto' }))
    await waitFor(() => {
      expect(mocked.archiveProduct).toHaveBeenCalledWith('product-1')
    })
    expect(screen.getByText('Carga inicial')).toBeInTheDocument()
  })

  it('registra un ajuste mostrando el saldo antes y después', async () => {
    renderWithRouter(
      <ProductDetailPage />,
      '/app/inventario/product-1',
      '/app/inventario/:productId',
    )

    await screen.findByRole('heading', { name: 'Velas de soya' })
    await userEvent.click(screen.getByRole('button', { name: 'Ajustar stock' }))

    await screen.findByRole('dialog')
    await userEvent.click(screen.getByRole('radio', { name: 'Merma' }))
    await userEvent.type(screen.getByLabelText('Cantidad'), '3')

    const confirm = screen.getByRole('button', { name: 'Confirmar ajuste' })
    expect(confirm).toBeDisabled()
    expect(
      screen.getByText('Las mermas y correcciones necesitan un motivo.'),
    ).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Motivo'), 'Rotura en bodega')
    expect(screen.getByText('9')).toBeInTheDocument()
    expect(confirm).toBeEnabled()
  })
})
