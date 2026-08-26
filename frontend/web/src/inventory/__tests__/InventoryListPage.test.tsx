import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewerPayload } from '../../auth/api'
import { TendaApiError } from '../../lib/http'
import { InventoryListPage } from '../InventoryListPage'
import * as api from '../api'
import type { ProductRow } from '../api'

vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api')
  return {
    ...actual,
    fetchProducts: vi.fn(),
    fetchInventorySchema: vi.fn(),
    fetchProductBreakdown: vi.fn(),
  }
})

const mocked = vi.mocked(api)

function makeProduct(overrides: Partial<ProductRow> = {}): ProductRow {
  return {
    id: 'product-1',
    name: 'Velas de soya',
    catalogStatus: 'active',
    purchasePrice: '2000',
    salePrice: '5000',
    currency: 'CLP',
    extraAttributes: { aroma: 'Lavanda' },
    lowStockThreshold: null,
    effectiveLowStockThreshold: 5,
    archivedAt: null,
    stock: { onHand: 12, reserved: 2, available: 10, activeFulfilment: 0 },
    ...overrides,
  }
}

function makeViewer(manageInventorySchema: boolean): ViewerPayload {
  return {
    viewer: {
      id: 'user-1',
      email: 'ana@tenda.cl',
      emailVerified: true,
      profile: { id: 'profile-1', fullName: 'Ana', phone: '', locale: 'es-CL' },
    },
    organisation: {
      id: 'org-1',
      name: 'Taller Ana',
      timezone: 'America/Santiago',
      phone: '',
      businessEmail: '',
    },
    inventory: { id: 'inv-1', name: 'Inventario principal' },
    membership: {
      id: 'membership-1',
      role: manageInventorySchema ? 'owner' : 'operator',
      permissions: {
        viewFinancials: true,
        manageMembers: manageInventorySchema,
        manageSensitiveConfiguration: manageInventorySchema,
        manageInventorySchema,
      },
    },
  }
}

function renderPage(viewer: ViewerPayload, initialEntry = '/app/inventario') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  function Shell({ children }: { children?: ReactNode }) {
    return <>{children ?? <Outlet context={viewer} />}</>
  }
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/app" element={<Shell />}>
            <Route path="inventario" element={<InventoryListPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const emptySchema = {
  inventoryId: 'inv-1',
  name: 'Inventario principal',
  lowStockThreshold: 5,
  maxActiveFields: 15,
  fields: [],
}

describe('InventoryListPage', () => {
  beforeEach(() => {
    mocked.fetchInventorySchema.mockResolvedValue(emptySchema)
  })

  it('anuncia la carga y luego lista los productos con su disponibilidad', async () => {
    mocked.fetchProducts.mockResolvedValue({
      totalCount: 1,
      hasNextPage: false,
      endCursor: '',
      products: [makeProduct()],
    })

    renderPage(makeViewer(true))

    expect(screen.getAllByText('Cargando productos…').length).toBeGreaterThan(0)
    expect(await screen.findByRole('link', { name: 'Velas de soya' })).toBeInTheDocument()
    expect(screen.getByText('Disponible 10')).toBeInTheDocument()
    expect(screen.getByText('Reservado 2')).toBeInTheDocument()
  })

  it('ofrece crear el primer producto cuando el inventario está vacío', async () => {
    mocked.fetchProducts.mockResolvedValue({
      totalCount: 0,
      hasNextPage: false,
      endCursor: '',
      products: [],
    })

    renderPage(makeViewer(true))

    expect(await screen.findByText('Aún no tienes productos')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Crear producto' })).toBeInTheDocument()
  })

  it('distingue cero resultados de inventario vacío y permite limpiar filtros', async () => {
    mocked.fetchProducts.mockResolvedValue({
      totalCount: 0,
      hasNextPage: false,
      endCursor: '',
      products: [],
    })

    renderPage(makeViewer(true), '/app/inventario?q=taza&stock=available')

    expect(await screen.findByText('Sin resultados')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    expect(await screen.findByText('Aún no tienes productos')).toBeInTheDocument()
  })

  it('muestra un error reintentable cuando la consulta falla', async () => {
    mocked.fetchProducts.mockRejectedValue(
      new TendaApiError(
        {
          code: 'UNEXPECTED_ERROR',
          message: 'No fue posible consultar el inventario.',
          fieldErrors: {},
          correlationId: 'abc-123',
        },
        500,
      ),
    )

    renderPage(makeViewer(true))

    expect(
      await screen.findByText('No fue posible consultar el inventario.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })

  it('oculta la gestión de columnas a quien no administra el esquema', async () => {
    mocked.fetchProducts.mockResolvedValue({
      totalCount: 1,
      hasNextPage: false,
      endCursor: '',
      products: [makeProduct()],
    })

    renderPage(makeViewer(false))

    await screen.findByRole('link', { name: 'Velas de soya' })
    expect(screen.queryByRole('button', { name: 'Agregar columna' })).toBeNull()
  })

  it('mantiene el asistente desactivado, sin navegación ni peticiones', async () => {
    mocked.fetchProducts.mockResolvedValue({
      totalCount: 1,
      hasNextPage: false,
      endCursor: '',
      products: [makeProduct()],
    })
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    renderPage(makeViewer(true))
    await screen.findByRole('link', { name: 'Velas de soya' })

    const assistant = screen.getByRole('button', { name: 'Agregar con asistente' })
    expect(assistant).toBeDisabled()
    expect(assistant.closest('a')).toBeNull()
    expect(
      screen.getByText('Próximamente: el asistente con foto aún no está disponible.'),
    ).toBeInTheDocument()

    await userEvent.click(assistant)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('expande el desglose anunciando aria-expanded y carga solo al abrir', async () => {
    mocked.fetchProducts.mockResolvedValue({
      totalCount: 1,
      hasNextPage: false,
      endCursor: '',
      products: [makeProduct()],
    })
    mocked.fetchProductBreakdown.mockResolvedValue({
      available: 10,
      totalCount: 1,
      pageInfo: { hasNextPage: false, endCursor: '' },
      lines: [
        {
          kind: 'reservation',
          label: 'Reserva #12',
          quantity: 2,
          effectivePrice: '4500',
          buyerName: 'Camila',
          status: 'reserved',
          referenceId: 'order-12',
        },
      ],
    })

    renderPage(makeViewer(true))
    await screen.findByRole('link', { name: 'Velas de soya' })
    expect(mocked.fetchProductBreakdown).not.toHaveBeenCalled()

    const toggle = screen.getByRole('button', {
      name: 'Expandir desglose de Velas de soya',
    })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    await userEvent.click(toggle)

    expect(
      await screen.findByRole('button', { name: 'Contraer desglose de Velas de soya' }),
    ).toHaveAttribute('aria-expanded', 'true')
    await waitFor(() => {
      expect(mocked.fetchProductBreakdown).toHaveBeenCalledWith('product-1')
    })
    expect(await screen.findByText('Reserva #12')).toBeInTheDocument()
  })
})
