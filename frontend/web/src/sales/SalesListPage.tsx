import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'

import { EmptyState, SearchField, StatusChip } from '../components/ui'
import { TendaApiError } from '../lib/http'
import { fetchOrders, fetchSalesDashboard, salesKeys, type OrderSummary } from './api'
import {
  formatClp,
  formatDate,
  nextActionLabels,
  orderStatusLabels,
  paymentMethodLabels,
  statusTone,
  translated,
} from './model'

const PAGE_SIZE = 25

const orderStatuses = [
  'reserved',
  'purchase_in_progress',
  'purchase_validation',
  'paid',
  'sold',
  'cancelled',
  'expired',
  'refunded',
] as const

const paymentMethods = ['bank_transfer', 'cash', 'mercado_pago'] as const

function ErrorMessage({
  title,
  error,
  onRetry,
}: {
  title: string
  error: Error
  onRetry: () => void
}) {
  return (
    <div className="form-message form-message--error" role="alert">
      <strong>{title}</strong>
      <span>
        {error instanceof TendaApiError
          ? error.message
          : 'Revisa tu conexión e inténtalo nuevamente.'}
      </span>
      <button className="button button--secondary" type="button" onClick={onRetry}>
        Reintentar
      </button>
    </div>
  )
}

function SalesDashboardCards() {
  const dashboard = useQuery({
    queryKey: salesKeys.dashboard(),
    queryFn: fetchSalesDashboard,
  })

  if (dashboard.isPending) {
    return (
      <section className="sales-metrics sales-metrics--loading" aria-busy="true">
        <span className="sr-only">Cargando resumen de ventas…</span>
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} />
        ))}
      </section>
    )
  }

  if (dashboard.isError) {
    return (
      <ErrorMessage
        title="No pudimos cargar el resumen"
        error={dashboard.error}
        onRetry={() => void dashboard.refetch()}
      />
    )
  }

  const summary = dashboard.data
  return (
    <section className="sales-metrics" aria-label="Resumen de ventas">
      <article>
        <span>Por compartir o completar</span>
        <strong>{summary.awaitingBuyerCount}</strong>
        <Link to="/app/ventas?estado=reserved">Ver pedidos</Link>
      </article>
      <article>
        <span>Esperando pago</span>
        <strong>{summary.awaitingPaymentCount}</strong>
        <Link to="/app/ventas?estado=purchase_in_progress">Ver pedidos</Link>
      </article>
      <article>
        <span>Comprobantes por revisar</span>
        <strong>{summary.awaitingValidationCount}</strong>
        <Link to="/app/ventas?estado=purchase_validation">Revisar</Link>
      </article>
      <article className={summary.reconciliationRequiredCount ? 'is-warning' : ''}>
        <span>Requieren conciliación</span>
        <strong>{summary.reconciliationRequiredCount}</strong>
        <Link to="/app/ventas/reconciliaciones">Abrir cola</Link>
      </article>
      <article>
        <span>Confirmadas este mes</span>
        <strong>{formatClp(summary.confirmedThisMonthAmount)}</strong>
        <small>{summary.confirmedThisMonthCount} operaciones</small>
      </article>
    </section>
  )
}

export function SalesListPage() {
  const [params, setParams] = useSearchParams()
  const search = params.get('q') ?? ''
  const status = params.get('estado') ?? ''
  const method = params.get('metodo') ?? ''
  const dateFrom = params.get('desde') ?? ''
  const dateTo = params.get('hasta') ?? ''
  const productId = params.get('producto') ?? ''
  const cursor = params.get('cursor')
  const activeFilters = [search, status, method, dateFrom, dateTo, productId].filter(
    Boolean,
  ).length

  function updateParam(name: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(name, value)
    else next.delete(name)
    next.delete('cursor')
    setParams(next, { replace: true })
  }

  const variables = {
    filter: {
      search: search || null,
      statuses: status ? [status] : null,
      paymentMethods: method ? [method] : null,
      productIds: productId ? [productId] : null,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
    },
    first: PAGE_SIZE,
    after: cursor,
  }
  const orders = useQuery({
    queryKey: salesKeys.orders(variables),
    queryFn: () => fetchOrders(variables),
    placeholderData: keepPreviousData,
  })

  const rows = orders.data?.nodes ?? []
  const reconciliationCount = rows.filter(
    (order: OrderSummary) => order.reconciliationRequired,
  ).length

  return (
    <>
      <header className="page-heading page-heading--split">
        <div>
          <p className="eyebrow">Operación comercial</p>
          <h1>Ventas</h1>
          <p>
            {orders.isPending
              ? 'Cargando pedidos…'
              : `${orders.data?.totalCount ?? 0} ventas registradas`}
          </p>
        </div>
        <div className="page-heading__actions">
          <Link className="button button--primary" to="/app/ventas/nueva">
            Venta de múltiples artículos
          </Link>
          <Link className="button button--secondary" to="/app/ventas/reconciliaciones">
            Reconciliaciones
          </Link>
        </div>
      </header>

      <SalesDashboardCards />

      {reconciliationCount > 0 ? (
        <div className="sales-notice sales-notice--warning" role="status">
          <strong>Hay ventas con conciliación pendiente</strong>
          <span>
            No las mostramos como resueltas. Revisa la cola antes de cerrar la operación.
          </span>
          <Link to="/app/ventas/reconciliaciones">Revisar incidencias</Link>
        </div>
      ) : null}

      <section className="sales-toolbar" aria-label="Buscar y filtrar ventas">
        <SearchField
          value={search}
          label="Buscar ventas"
          placeholder="Número, comprador o contacto…"
          onChange={(value) => updateParam('q', value)}
        />
        <label>
          <span>Estado</span>
          <select
            value={status}
            onChange={(event) => updateParam('estado', event.target.value)}
          >
            <option value="">Todos</option>
            {orderStatuses.map((value) => (
              <option key={value} value={value}>
                {orderStatusLabels[value]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Método</span>
          <select
            value={method}
            onChange={(event) => updateParam('metodo', event.target.value)}
          >
            <option value="">Todos</option>
            {paymentMethods.map((value) => (
              <option key={value} value={value}>
                {paymentMethodLabels[value]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Desde</span>
          <input
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(event) => updateParam('desde', event.target.value)}
          />
        </label>
        <label>
          <span>Hasta</span>
          <input
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(event) => updateParam('hasta', event.target.value)}
          />
        </label>
        {activeFilters ? (
          <button
            className="button button--secondary"
            type="button"
            onClick={() => setParams(new URLSearchParams(), { replace: true })}
          >
            Limpiar filtros ({activeFilters})
          </button>
        ) : null}
      </section>

      {productId ? (
        <div className="sales-notice" role="status">
          <strong>Filtro de producto aplicado desde Balances</strong>
          <span>La lista conserva el mismo alcance comercial del desglose.</span>
          <button type="button" onClick={() => updateParam('producto', '')}>
            Quitar filtro de producto
          </button>
        </div>
      ) : null}

      {orders.isError ? (
        <ErrorMessage
          title="No pudimos cargar las ventas"
          error={orders.error}
          onRetry={() => void orders.refetch()}
        />
      ) : null}

      {orders.isPending ? (
        <div className="table-skeleton" aria-live="polite" aria-busy="true">
          <span className="sr-only">Cargando ventas…</span>
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} />
          ))}
        </div>
      ) : null}

      {!orders.isPending && !orders.isError && rows.length === 0 ? (
        activeFilters ? (
          <EmptyState
            title="No encontramos ventas"
            description="Ninguna venta coincide con los filtros aplicados."
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
            title="Aún no tienes ventas"
            description="Crea una venta para reservar stock y compartir un enlace de compra."
            action={
              <Link className="button button--primary" to="/app/ventas/nueva">
                Crear primera venta
              </Link>
            }
          />
        )
      ) : null}

      {!orders.isPending && rows.length > 0 ? (
        <div className="table-wrapper">
          <table className="data-table sales-table">
            <thead>
              <tr>
                <th scope="col">Venta</th>
                <th scope="col">Comprador</th>
                <th scope="col">Total</th>
                <th scope="col">Método</th>
                <th scope="col">Estado</th>
                <th scope="col">Fecha</th>
                <th scope="col">Próxima acción</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((order: OrderSummary) => (
                <tr key={order.id}>
                  <td>
                    <Link className="sales-table__number" to={`/app/ventas/${order.id}`}>
                      {order.number}
                    </Link>
                    {order.reconciliationRequired ? (
                      <StatusChip status="error" label="Conciliación pendiente" />
                    ) : null}
                  </td>
                  <td>{order.buyer?.fullName || 'Aún sin datos'}</td>
                  <td>{formatClp(order.total)}</td>
                  <td>{translated(paymentMethodLabels, order.paymentMethod)}</td>
                  <td>
                    <StatusChip
                      status={statusTone(order.status)}
                      label={translated(orderStatusLabels, order.status)}
                    />
                  </td>
                  <td>{formatDate(order.confirmedAt ?? order.createdAt)}</td>
                  <td>
                    <Link to={`/app/ventas/${order.id}`}>
                      {translated(nextActionLabels, order.nextAction)}
                    </Link>
                  </td>
                  <td>
                    {order.hasProof ? (
                      <Link
                        className="button button--secondary button--compact"
                        to={`/app/ventas/${order.id}`}
                      >
                        Ver comprobante
                      </Link>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {orders.data?.pageInfo.hasNextPage ? (
        <div className="table-pagination">
          <button
            className="button button--secondary"
            type="button"
            disabled={orders.isFetching}
            onClick={() => {
              const next = new URLSearchParams(params)
              next.set('cursor', orders.data.pageInfo.endCursor)
              setParams(next)
            }}
          >
            {orders.isFetching ? 'Cargando…' : 'Ver más ventas'}
          </button>
        </div>
      ) : null}
    </>
  )
}
