import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TendaApiError } from '../../lib/http'
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
    suggestProductsFromImage: vi.fn(),
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
      url: '/media/vela.png',
      thumbnailUrl: '/media/vela-thumb.png',
      mediumUrl: '/media/vela-medium.png',
      largeUrl: '/media/vela-large.png',
      contentType: 'image/png',
      originalName: 'vela.png',
      isPrimary: true,
      position: 0,
      createdAt: '2026-09-08T12:00:00Z',
    })

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
    expect(mocked.attachProductMedia).toHaveBeenCalledWith('product-1', 'asset-1', true)
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

  it('en creación asistida no sigue sin foto', async () => {
    renderWithRouter(
      <ProductFormPage mode="create" origin="assisted" />,
      '/app/inventario/nuevo/asistida',
      '/app/inventario/nuevo/asistida',
    )

    expect(screen.getByRole('heading', { name: 'Nuevo producto' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Nombre')).not.toBeInTheDocument()
    expect(screen.getByText(/Sube al menos una foto/)).toBeInTheDocument()
    expect(mocked.uploadPrivateFile).not.toHaveBeenCalled()
    expect(mocked.suggestProductsFromImage).not.toHaveBeenCalled()
  })

  it('en creación asistida sube la foto, muestra candidatos y rellena el formulario', async () => {
    mocked.uploadPrivateFile.mockResolvedValue('asset-1')
    mocked.suggestProductsFromImage.mockResolvedValue({
      replayed: false,
      candidates: [
        {
          name: 'Vela de soya aroma lavanda',
          salePrice: 12990,
          purchasePrice: 4500,
          extraAttributes: { aroma: 'Lavanda' },
          sourceUrl: 'https://example.com/productos/vela-lavanda',
          imageUrl: 'https://example.com/img/vela-lavanda.jpg',
          confidence: 0.92,
        },
        {
          name: 'Set de velas artesanales',
          salePrice: 15990,
          purchasePrice: 5200,
          extraAttributes: {},
          sourceUrl: 'https://example.com/productos/set-velas',
          imageUrl: null,
          confidence: 0.84,
        },
        {
          name: 'Vela de cera de soya 200 g',
          salePrice: 9990,
          purchasePrice: 3800,
          extraAttributes: {},
          sourceUrl: 'https://example.com/productos/vela-200g',
          imageUrl: null,
          confidence: 0.77,
        },
      ],
    })

    renderWithRouter(
      <ProductFormPage mode="create" origin="assisted" />,
      '/app/inventario/nuevo/asistida',
      '/app/inventario/nuevo/asistida',
    )

    const file = new File(['img'], 'vela.png', { type: 'image/png' })
    await userEvent.upload(screen.getByLabelText(/Subir fotos|Agregar fotos/), file)

    const firstCard = await screen.findByRole('button', {
      name: /Vela de soya aroma lavanda/,
    })
    expect(
      firstCard.querySelector('img[src="https://example.com/img/vela-lavanda.jpg"]'),
    ).toBeInTheDocument()
    expect(firstCard.querySelector('img[src="blob:photo"]')).not.toBeInTheDocument()
    expect(screen.getAllByText('Sin foto del anuncio').length).toBe(2)
    expect(mocked.uploadPrivateFile).toHaveBeenCalled()
    expect(mocked.suggestProductsFromImage).toHaveBeenCalledWith(
      expect.objectContaining({ assetId: 'asset-1' }),
    )
    expect(screen.queryByLabelText('Nombre')).not.toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: /Vela de soya aroma lavanda/ }),
    )
    expect(screen.getByLabelText('Nombre')).toHaveValue('Vela de soya aroma lavanda')
    expect(screen.getByLabelText('Precio de venta')).toHaveValue('12990')
  })

  it('si la búsqueda falla deja el formulario vacío y usable', async () => {
    mocked.uploadPrivateFile.mockResolvedValue('asset-1')
    mocked.suggestProductsFromImage.mockRejectedValue(
      new TendaApiError(
        {
          code: 'PRODUCT_IMAGE_SEARCH_NOT_CONFIGURED',
          message: 'La búsqueda por imagen no está configurada.',
          fieldErrors: {},
          correlationId: '',
        },
        503,
      ),
    )

    renderWithRouter(
      <ProductFormPage mode="create" origin="assisted" />,
      '/app/inventario/nuevo/asistida',
      '/app/inventario/nuevo/asistida',
    )

    const file = new File(['img'], 'vela.png', { type: 'image/png' })
    await userEvent.upload(screen.getByLabelText(/Subir fotos|Agregar fotos/), file)

    expect(
      await screen.findByText('La búsqueda por imagen no está configurada.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre')).toHaveValue('')
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
