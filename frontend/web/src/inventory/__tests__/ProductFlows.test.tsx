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
    fetchProducts: vi.fn(),
    uploadPrivateFile: vi.fn(),
    attachProductMedia: vi.fn(),
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
          <Route path="/app/inventario" element={<p>Listado</p>} />
          <Route path="/app/inventario/:productId" element={<p>Detalle</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ProductFormPage', () => {
  beforeEach(() => {
    mocked.fetchInventorySchema.mockResolvedValue(schema)
    URL.createObjectURL = vi.fn(() => 'blob:photo')
    URL.revokeObjectURL = vi.fn()
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
    expect(await screen.findByText('Listado')).toBeInTheDocument()
    expect(mocked.createProduct).toHaveBeenCalledTimes(1)
  })

  it('tras crear redirige al inventario y no a la ficha', async () => {
    mocked.createProduct.mockResolvedValue({ product, movement: null, replayed: false })

    renderWithRouter(
      <ProductFormPage mode="create" origin="manual" />,
      '/app/inventario/nuevo/manual',
      '/app/inventario/nuevo/manual',
    )

    await userEvent.type(screen.getByLabelText('Nombre'), 'Velas de soya')
    await userEvent.click(screen.getByRole('button', { name: 'Crear producto' }))

    expect(await screen.findByText('Listado')).toBeInTheDocument()
    expect(screen.queryByText('Detalle')).not.toBeInTheDocument()
  })

  it('en editar muestra un botón para volver al inventario', async () => {
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

    renderWithRouter(
      <ProductFormPage mode="edit" />,
      '/app/inventario/product-1/editar',
      '/app/inventario/:productId/editar',
    )

    expect(
      await screen.findByRole('heading', { name: 'Editar producto' }),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Volver al inventario' }))
    expect(await screen.findByText('Listado')).toBeInTheDocument()
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

  it('adjunta las fotos después de crear el producto', async () => {
    mocked.createProduct.mockResolvedValue({ product, movement: null, replayed: false })
    mocked.uploadPrivateFile.mockResolvedValue('asset-1')
    mocked.attachProductMedia.mockResolvedValue({
      assetId: 'asset-1',
      fileName: 'vela.png',
      contentType: 'image/png',
      byteSize: 3,
      isPrimary: true,
      createdAt: '2026-09-08T12:00:00Z',
    } as Awaited<ReturnType<typeof api.attachProductMedia>>)

    renderWithRouter(
      <ProductFormPage mode="create" origin="manual" />,
      '/app/inventario/nuevo/manual',
      '/app/inventario/nuevo/manual',
    )

    await userEvent.type(screen.getByLabelText('Nombre'), 'Velas de soya')
    const file = new File(['img'], 'vela.png', { type: 'image/png' })
    await userEvent.upload(screen.getByLabelText(/Subir fotos|Agregar fotos/), file)
    await userEvent.click(screen.getByRole('button', { name: 'Crear producto' }))

    await waitFor(() => {
      expect(mocked.createProduct).toHaveBeenCalled()
    })
    expect(mocked.uploadPrivateFile).toHaveBeenCalled()
    expect(mocked.attachProductMedia).toHaveBeenCalledWith(
      'product-1',
      'asset-1',
      true,
    )
  })

  it('bloquea una variante idéntica y no llama al API', async () => {
    mocked.fetchProducts.mockResolvedValue({
      totalCount: 1,
      hasNextPage: false,
      endCursor: '',
      products: [product],
    })

    renderWithRouter(
      <ProductFormPage mode="create" origin="variant" />,
      '/app/inventario/nuevo/variante',
      '/app/inventario/nuevo/variante',
    )

    await userEvent.click(await screen.findByRole('button', { name: 'Velas de soya' }))
    await userEvent.click(screen.getByRole('button', { name: 'Crear producto' }))

    expect(
      (await screen.findAllByText(/Cambia al menos un dato respecto de Velas de soya/))
        .length,
    ).toBeGreaterThan(0)
    expect(mocked.createProduct).not.toHaveBeenCalled()
  })

  it('permite crear la variante si cambian nombre y un dato', async () => {
    mocked.fetchProducts.mockResolvedValue({
      totalCount: 1,
      hasNextPage: false,
      endCursor: '',
      products: [product],
    })
    mocked.createProduct.mockResolvedValue({
      product: { ...product, id: 'product-2', name: 'Velas de soya · grande' },
      movement: null,
      replayed: false,
    })

    renderWithRouter(
      <ProductFormPage mode="create" origin="variant" />,
      '/app/inventario/nuevo/variante',
      '/app/inventario/nuevo/variante',
    )

    await userEvent.click(await screen.findByRole('button', { name: 'Velas de soya' }))
    const name = screen.getByLabelText('Nombre')
    await userEvent.clear(name)
    await userEvent.type(name, 'Velas de soya · grande')
    await userEvent.clear(screen.getByLabelText('Precio de venta'))
    await userEvent.type(screen.getByLabelText('Precio de venta'), '7000')
    await userEvent.click(screen.getByRole('button', { name: 'Crear producto' }))

    await waitFor(() => {
      expect(mocked.createProduct).toHaveBeenCalled()
    })
  })

  it('en creación asistida no sigue sin foto y no llama a un agente', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    renderWithRouter(
      <ProductFormPage mode="create" origin="assisted" />,
      '/app/inventario/nuevo/asistida',
      '/app/inventario/nuevo/asistida',
    )

    expect(screen.getByRole('heading', { name: 'Nuevo producto' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Nombre')).not.toBeInTheDocument()
    expect(screen.getByText(/Sube al menos una foto/)).toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()
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

  it('permite volver al inventario desde la ficha', async () => {
    renderWithRouter(
      <ProductDetailPage />,
      '/app/inventario/product-1',
      '/app/inventario/:productId',
    )

    expect(
      await screen.findByRole('heading', { name: 'Velas de soya' }),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: 'Volver al inventario' }))
    expect(await screen.findByText('Listado')).toBeInTheDocument()
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
