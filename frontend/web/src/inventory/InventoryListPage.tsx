import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  columnVisibilityFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type ColumnVisibilityState,
} from '@tanstack/react-table'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext, useSearchParams } from 'react-router-dom'

import type { ViewerPayload } from '../auth/api'
import { EmptyState, SearchField, StatusChip } from '../components/ui'
import { TendaApiError } from '../lib/http'
import {
  fetchInventorySchema,
  fetchProducts,
  inventoryKeys,
  type CustomField,
  type ProductRow,
} from './api'
import { CustomFieldDialog } from './CustomFieldDialog'
import { ProductRowExpansion } from './ProductRowExpansion'
import { StockAdjustDialog } from './StockAdjustDialog'
import { InventoryThresholdSetting } from './StockThresholdSettings'
import {
  catalogStatusLabels,
  formatAttribute,
  formatPrice,
  formatQuantity,
} from './format'

const features = tableFeatures({ columnVisibilityFeature })
const PAGE_SIZE = 25
const VISIBILITY_STORAGE_KEY = 'tenda.inventory.columns'

const STOCK_STATES = [
  { value: 'available', label: 'Disponible' },
  { value: 'reserved', label: 'Reservado' },
  { value: 'out_of_stock', label: 'Sin unidades' },
] as const

const CATALOG_STATUSES = [
  { value: 'active', label: 'Activo' },
  { value: 'inactive', label: 'Inactivo' },
  { value: 'archived', label: 'Archivado' },
] as const

/** Mirrors `SORTABLE_FIELDS` in the inventory selectors. */
const SORTABLE_COLUMNS = new Set([
  'name',
  'available',
  'onHand',
  'salePrice',
  'createdAt',
])

function readList(params: URLSearchParams, key: string): string[] {
  const raw = params.get(key)
  return raw ? raw.split(',').filter(Boolean) : []
}

function toggleValue(values: string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value]
}

function loadVisibility(): ColumnVisibilityState {
  try {
    const raw = window.localStorage.getItem(VISIBILITY_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as ColumnVisibilityState) : {}
  } catch {
    return {}
  }
}

function StockChips({ product }: { product: ProductRow }) {
  const { available, reserved, activeFulfilment } = product.stock
  return (
    <div className="stock-chips">
      {available > 0 ? (
        <StatusChip status="available" label={`Disponible ${available}`} />
      ) : (
        <StatusChip status="error" label="Sin unidades disponibles" />
      )}
      {reserved > 0 ? (
        <StatusChip status="reserved" label={`Reservado ${reserved}`} />
      ) : null}
      {activeFulfilment > 0 ? (
        <StatusChip status="pending" label={`En proceso ${activeFulfilment}`} />
      ) : null}
      {product.catalogStatus !== 'active' ? (
        <StatusChip
          status="coming_soon"
          label={catalogStatusLabels[product.catalogStatus] ?? product.catalogStatus}
        />
      ) : null}
    </div>
  )
}

function buildColumns(
  customFields: CustomField[],
  onAdjust: (product: ProductRow) => void,
): ColumnDef<typeof features, ProductRow, unknown>[] {
  const base: ColumnDef<typeof features, ProductRow, unknown>[] = [
    {
      id: 'name',
      header: 'Producto',
      accessorFn: (row) => row.name,
      enableHiding: false,
      cell: ({ row }) => (
        <div className="product-cell">
          <Link to={`/app/inventario/${row.original.id}`}>{row.original.name}</Link>
          <StockChips product={row.original} />
        </div>
      ),
    },
    {
      id: 'available',
      header: 'Disponible',
      accessorFn: (row) => row.stock.available,
      cell: ({ row }) => formatQuantity(row.original.stock.available),
    },
    {
      id: 'reserved',
      header: 'Reservado',
      accessorFn: (row) => row.stock.reserved,
      cell: ({ row }) => formatQuantity(row.original.stock.reserved),
    },
    {
      id: 'onHand',
      header: 'Total',
      accessorFn: (row) => row.stock.onHand,
      cell: ({ row }) => formatQuantity(row.original.stock.onHand),
    },
    {
      id: 'sale_price',
      header: 'Precio venta ref.',
      accessorFn: (row) => row.salePrice,
      cell: ({ row }) => formatPrice(row.original.salePrice),
    },
    {
      id: 'purchase_price',
      header: 'Precio compra ref.',
      accessorFn: (row) => row.purchasePrice,
      cell: ({ row }) => formatPrice(row.original.purchasePrice),
    },
  ]

  const dynamic: ColumnDef<typeof features, ProductRow, unknown>[] = customFields.map(
    (field) => ({
      id: `custom:${field.key}`,
      header: field.label,
      accessorFn: (row: ProductRow) => row.extraAttributes[field.key],
      cell: ({ row }) => formatAttribute(row.original.extraAttributes[field.key]),
    }),
  )

  const actions: ColumnDef<typeof features, ProductRow, unknown> = {
    id: 'actions',
    header: 'Acciones',
    enableHiding: false,
    cell: ({ row }) => (
      <div className="row-actions">
        <button
          className="button button--secondary button--compact"
          type="button"
          onClick={() => onAdjust(row.original)}
        >
          Ajustar stock
        </button>
        <Link className="text-link" to={`/app/inventario/${row.original.id}/editar`}>
          Editar
        </Link>
      </div>
    ),
  }

  return [...base, ...dynamic, actions]
}

export function InventoryListPage() {
  const viewer = useOutletContext<ViewerPayload>()
  const [params, setParams] = useSearchParams()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [adjusting, setAdjusting] = useState<ProductRow | null>(null)
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [showColumnDialog, setShowColumnDialog] = useState(false)
  const [columnVisibility, setColumnVisibility] =
    useState<ColumnVisibilityState>(loadVisibility)

  useEffect(() => {
    window.localStorage.setItem(VISIBILITY_STORAGE_KEY, JSON.stringify(columnVisibility))
  }, [columnVisibility])

  const search = params.get('q') ?? ''
  const stockStates = readList(params, 'stock')
  const catalogStatuses = readList(params, 'estado')
  const sort = params.get('orden') ?? 'name'
  const descending = params.get('desc') === '1'
  const cursor = params.get('cursor')
  const activeFilters = stockStates.length + catalogStatuses.length + (search ? 1 : 0)

  function updateParams(mutate: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(params)
    mutate(next)
    // Any filter change invalidates the cursor: keyset pages are not comparable.
    next.delete('cursor')
    setParams(next, { replace: true })
    setExpanded(null)
  }

  const schema = useQuery({
    queryKey: inventoryKeys.schema(false),
    queryFn: () => fetchInventorySchema(false),
  })

  // React Query hashes the key structurally, so rebuilding these objects on
  // every render is safe and keeps the URL as the single source of truth.
  const queryVariables = {
    filter: {
      search: search || null,
      stockStates: stockStates.length ? stockStates : null,
      catalogStatuses: catalogStatuses.length ? catalogStatuses : null,
      includeArchived: catalogStatuses.includes('archived'),
    },
    sort: SORTABLE_COLUMNS.has(sort) ? sort : 'name',
    descending,
    first: PAGE_SIZE,
    after: cursor,
  }

  const products = useQuery({
    queryKey: inventoryKeys.products(queryVariables),
    queryFn: () => fetchProducts(queryVariables),
    placeholderData: keepPreviousData,
  })

  const visibleFields = useMemo(
    () => (schema.data?.fields ?? []).filter((field) => field.isVisible),
    [schema.data],
  )

  const rows = products.data?.products ?? []
  const columns = useMemo(
    () => buildColumns(visibleFields, setAdjusting),
    [visibleFields],
  )

  const table = useTable({
    features,
    columns,
    data: rows,
    getRowId: (row) => row.id,
    state: { columnVisibility },
    onColumnVisibilityChange: setColumnVisibility,
  })

  const headerColumnCount = table.getVisibleLeafColumns().length + 1
  const canManageSchema = viewer.membership.permissions.manageInventorySchema
  const hasFilters = activeFilters > 0

  return (
    <>
      <header className="page-heading page-heading--split">
        <div>
          <p className="eyebrow">{viewer.inventory.name}</p>
          <h1>Inventario</h1>
          <p>
            {products.isPending
              ? 'Cargando productos…'
              : `${formatQuantity(products.data?.totalCount ?? 0)} productos en catálogo`}
          </p>
        </div>
        <div className="page-heading__actions">
          <Link className="button button--primary" to="/app/inventario/nuevo">
            Agregar producto
          </Link>
          <Link className="button button--secondary" to="/app/inventario/importar">
            Importar
          </Link>
          <Link
            className="button button--secondary"
            to={`/app/inventario/exportaciones?${params.toString()}`}
          >
            Exportar
          </Link>
          <button
            className="button button--secondary"
            type="button"
            disabled
            aria-describedby="assistant-hint"
          >
            Agregar con asistente
          </button>
          <p id="assistant-hint" className="assistant-hint">
            Próximamente: el asistente con foto aún no está disponible.
          </p>
        </div>
      </header>

      {schema.data ? (
        <details className="alert-settings">
          <summary>Configurar alertas de stock</summary>
          <InventoryThresholdSetting current={schema.data.lowStockThreshold} />
        </details>
      ) : null}

      <section className="inventory-toolbar" aria-label="Búsqueda y filtros">
        <SearchField
          value={search}
          label="Buscar productos"
          placeholder="Buscar por nombre…"
          onChange={(value) =>
            updateParams((next) => {
              if (value) next.set('q', value)
              else next.delete('q')
            })
          }
        />

        <div className="chip-row" role="group" aria-label="Estado de stock">
          {STOCK_STATES.map((state) => {
            const active = stockStates.includes(state.value)
            return (
              <button
                key={state.value}
                type="button"
                className={`filter-chip ${active ? 'filter-chip--active' : ''}`}
                aria-pressed={active}
                onClick={() =>
                  updateParams((next) => {
                    const values = toggleValue(stockStates, state.value)
                    if (values.length) next.set('stock', values.join(','))
                    else next.delete('stock')
                  })
                }
              >
                {state.label}
              </button>
            )
          })}
          {CATALOG_STATUSES.map((status) => {
            const active = catalogStatuses.includes(status.value)
            return (
              <button
                key={status.value}
                type="button"
                className={`filter-chip ${active ? 'filter-chip--active' : ''}`}
                aria-pressed={active}
                onClick={() =>
                  updateParams((next) => {
                    const values = toggleValue(catalogStatuses, status.value)
                    if (values.length) next.set('estado', values.join(','))
                    else next.delete('estado')
                  })
                }
              >
                {status.label}
              </button>
            )
          })}
        </div>

        <div className="toolbar-actions">
          <label className="sr-only" htmlFor="inventory-sort">
            Ordenar por
          </label>
          <select
            id="inventory-sort"
            value={`${sort}:${descending ? 'desc' : 'asc'}`}
            onChange={(event) => {
              const [nextSort, direction] = event.target.value.split(':')
              updateParams((next) => {
                next.set('orden', nextSort)
                if (direction === 'desc') next.set('desc', '1')
                else next.delete('desc')
              })
            }}
          >
            <option value="name:asc">Nombre (A-Z)</option>
            <option value="name:desc">Nombre (Z-A)</option>
            <option value="available:desc">Más disponibles</option>
            <option value="available:asc">Menos disponibles</option>
            <option value="salePrice:desc">Precio de venta mayor</option>
            <option value="createdAt:desc">Más recientes</option>
          </select>

          <div className="column-picker">
            <button
              type="button"
              className="button button--secondary"
              aria-expanded={columnsOpen}
              onClick={() => setColumnsOpen((value) => !value)}
            >
              Columnas
            </button>
            {columnsOpen ? (
              <div className="column-picker__menu">
                {table.getAllLeafColumns().map((column) => (
                  <label key={column.id}>
                    <input
                      type="checkbox"
                      checked={column.getIsVisible()}
                      disabled={!column.getCanHide()}
                      onChange={column.getToggleVisibilityHandler()}
                    />
                    {typeof column.columnDef.header === 'string'
                      ? column.columnDef.header
                      : column.id}
                  </label>
                ))}
              </div>
            ) : null}
          </div>

          {canManageSchema ? (
            <button
              className="button button--secondary"
              type="button"
              onClick={() => setShowColumnDialog(true)}
            >
              Agregar columna
            </button>
          ) : null}
        </div>
      </section>

      {products.isError ? (
        <div className="form-message form-message--error" role="alert">
          <strong>No pudimos cargar el inventario</strong>
          <span>
            {products.error instanceof TendaApiError
              ? products.error.message
              : 'Revisa tu conexión e inténtalo nuevamente.'}
          </span>
          <button
            className="button button--secondary"
            type="button"
            onClick={() => void products.refetch()}
          >
            Reintentar
          </button>
        </div>
      ) : null}

      {products.isPending ? (
        <div className="table-skeleton" aria-live="polite" aria-busy="true">
          <span className="sr-only">Cargando productos…</span>
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} />
          ))}
        </div>
      ) : null}

      {!products.isPending && !products.isError && rows.length === 0 ? (
        hasFilters ? (
          <EmptyState
            title="Sin resultados"
            description="Ningún producto coincide con la búsqueda y los filtros aplicados."
            action={
              <button
                className="button button--secondary"
                type="button"
                onClick={() => setParams(new URLSearchParams(), { replace: true })}
              >
                Limpiar filtros
              </button>
            }
          />
        ) : (
          <EmptyState
            title="Aún no tienes productos"
            description="Crea tu primer producto para llevar control de disponibilidad y movimientos."
            action={
              <Link className="button button--primary" to="/app/inventario/nuevo">
                Crear producto
              </Link>
            }
          />
        )
      ) : null}

      {!products.isPending && rows.length > 0 ? (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  <th scope="col" className="data-table__toggle">
                    <span className="sr-only">Desglose</span>
                  </th>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} scope="col">
                      <table.FlexRender header={header} />
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => {
                const isExpanded = expanded === row.original.id
                return (
                  <Fragment key={row.id}>
                    <tr>
                      <td className="data-table__toggle">
                        <button
                          type="button"
                          aria-expanded={isExpanded}
                          aria-controls={`breakdown-${row.original.id}`}
                          aria-label={`${isExpanded ? 'Contraer' : 'Expandir'} desglose de ${row.original.name}`}
                          onClick={() => setExpanded(isExpanded ? null : row.original.id)}
                        >
                          {isExpanded ? '⌄' : '›'}
                        </button>
                      </td>
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id}>
                          <table.FlexRender cell={cell} />
                        </td>
                      ))}
                    </tr>
                    {isExpanded ? (
                      <tr id={`breakdown-${row.original.id}`}>
                        <td colSpan={headerColumnCount}>
                          <ProductRowExpansion
                            productId={row.original.id}
                            productName={row.original.name}
                          />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {products.data?.hasNextPage ? (
        <div className="table-pagination">
          <button
            className="button button--secondary"
            type="button"
            disabled={products.isFetching}
            onClick={() => {
              const next = new URLSearchParams(params)
              next.set('cursor', products.data.endCursor)
              setParams(next, { replace: false })
              setExpanded(null)
            }}
          >
            {products.isFetching ? 'Cargando…' : 'Ver más productos'}
          </button>
        </div>
      ) : null}

      {adjusting ? (
        <StockAdjustDialog product={adjusting} onClose={() => setAdjusting(null)} />
      ) : null}
      {showColumnDialog ? (
        <CustomFieldDialog onClose={() => setShowColumnDialog(false)} />
      ) : null}
    </>
  )
}
