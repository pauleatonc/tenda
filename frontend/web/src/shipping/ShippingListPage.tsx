import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'

import { EmptyState, SearchField, StatusChip } from '../components/ui'
import { TendaApiError } from '../lib/http'
import {
  fetchShipments,
  fetchShippingDashboard,
  shippingKeys,
  type ShipmentSummary,
} from './api'
import {
  deliveryModeLabels,
  destinationLine,
  formatDate,
  nextActionLabels,
  shipmentStatusLabels,
  statusTone,
  translated,
} from './model'

const PAGE_SIZE = 25

const shipmentStatuses = [
  'pending',
  'preparing',
  'dispatched',
  'delivery_check',
  'delivered',
  'issue',
  'returned',
  'cancelled',
  'closed',
] as const

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

function ShippingDashboardCards() {
  const dashboard = useQuery({
    queryKey: shippingKeys.dashboard(),
    queryFn: fetchShippingDashboard,
  })

  if (dashboard.isPending) {
    return (
      <section className="sales-metrics sales-metrics--loading" aria-busy="true">
        <span className="sr-only">Cargando resumen de despachos…</span>
        {Array.from({ length: 5 }).map((_, index) => (
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
    <section className="sales-metrics" aria-label="Resumen de despachos">
      <article className={summary.pendingCount ? 'is-warning' : ''}>
        <span>Pendientes</span>
        <strong>{summary.pendingCount}</strong>
        <Link to="/app/despachos?estado=pending">Preparar</Link>
      </article>
      <article className={summary.preparingCount ? 'is-warning' : ''}>
        <span>En preparación</span>
        <strong>{summary.preparingCount}</strong>
        <Link to="/app/despachos?estado=preparing">Despachar</Link>
      </article>
      <article>
        <span>Despachados</span>
        <strong>{summary.dispatchedCount}</strong>
        <Link to="/app/despachos?estado=dispatched">Ver envíos</Link>
      </article>
      <article className={summary.deliveryCheckCount ? 'is-warning' : ''}>
        <span>Chequeo de entrega</span>
        <strong>{summary.deliveryCheckCount}</strong>
        <Link to="/app/despachos?estado=delivery_check">Revisar</Link>
      </article>
      <article className={summary.issueCount ? 'is-warning' : ''}>
        <span>Incidencias</span>
        <strong>{summary.issueCount}</strong>
        <Link to="/app/despachos?estado=issue">Atender</Link>
      </article>
    </section>
  )
}

export function ShippingListPage() {
  const [params, setParams] = useSearchParams()
  const search = params.get('q') ?? ''
  const status = params.get('estado') ?? ''
  const attention = params.get('atencion') === '1'
  const cursor = params.get('cursor')
  const activeFilters = [search, status, attention ? '1' : ''].filter(Boolean).length

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
      attention: attention || null,
    },
    first: PAGE_SIZE,
    after: cursor,
  }
  const shipments = useQuery({
    queryKey: shippingKeys.shipments(variables),
    queryFn: () => fetchShipments(variables),
    placeholderData: keepPreviousData,
  })
  const rows = shipments.data?.nodes ?? []

  return (
    <>
      <header className="page-heading page-heading--split">
        <div>
          <p className="eyebrow">Operación de entrega</p>
          <h1>Despachos</h1>
          <p>
            {shipments.isPending
              ? 'Cargando envíos…'
              : `${shipments.data?.totalCount ?? 0} envíos registrados`}
          </p>
        </div>
      </header>

      <ShippingDashboardCards />

      <section className="sales-toolbar" aria-label="Buscar y filtrar despachos">
        <SearchField
          value={search}
          label="Buscar despachos"
          placeholder="Número, destinatario o tracking…"
          onChange={(value) => updateParam('q', value)}
        />
        <label>
          <span>Estado</span>
          <select
            value={status}
            onChange={(event) => updateParam('estado', event.target.value)}
          >
            <option value="">Todos</option>
            {shipmentStatuses.map((value) => (
              <option key={value} value={value}>
                {shipmentStatusLabels[value]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Atención</span>
          <select
            value={attention ? '1' : ''}
            onChange={(event) => updateParam('atencion', event.target.value)}
          >
            <option value="">Todos</option>
            <option value="1">Requieren atención</option>
          </select>
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

      {shipments.isError ? (
        <ErrorMessage
          title="No pudimos cargar los despachos"
          error={shipments.error}
          onRetry={() => void shipments.refetch()}
        />
      ) : null}

      {shipments.isPending ? (
        <div className="table-skeleton" aria-live="polite" aria-busy="true">
          <span className="sr-only">Cargando despachos…</span>
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} />
          ))}
        </div>
      ) : null}

      {!shipments.isPending && !shipments.isError && rows.length === 0 ? (
        activeFilters ? (
          <EmptyState
            title="No encontramos envíos"
            description="Ningún despacho coincide con los filtros aplicados."
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
            title="Aún no tienes despachos"
            description="Cuando una venta se pague, Tenda crea el envío para que prepares y despaches."
          />
        )
      ) : null}

      {!shipments.isPending && rows.length > 0 ? (
        <div className="table-wrapper">
          <table className="data-table sales-table">
            <thead>
              <tr>
                <th scope="col">Envío</th>
                <th scope="col">Destinatario</th>
                <th scope="col">Destino</th>
                <th scope="col">Tracking</th>
                <th scope="col">Estado</th>
                <th scope="col">Vencimiento</th>
                <th scope="col">Fecha</th>
                <th scope="col">Próxima acción</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((shipment: ShipmentSummary) => (
                <tr key={shipment.id}>
                  <td>
                    <Link
                      className="sales-table__number"
                      to={`/app/despachos/${shipment.id}`}
                    >
                      {shipment.number}
                    </Link>
                    <small>{shipment.order.number}</small>
                  </td>
                  <td>{shipment.recipientName || 'Sin destinatario'}</td>
                  <td>
                    {destinationLine(shipment) ||
                      translated(deliveryModeLabels, shipment.deliveryMode)}
                  </td>
                  <td>{shipment.trackingCode || '—'}</td>
                  <td>
                    <StatusChip
                      status={statusTone(shipment.status)}
                      label={translated(shipmentStatusLabels, shipment.status)}
                    />
                  </td>
                  <td>
                    {shipment.nextFollowUp
                      ? formatDate(shipment.nextFollowUp.dueAt)
                      : '—'}
                  </td>
                  <td>{formatDate(shipment.createdAt)}</td>
                  <td>
                    <Link to={`/app/despachos/${shipment.id}`}>
                      {translated(nextActionLabels, shipment.nextAction)}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {shipments.data?.pageInfo.hasNextPage ? (
        <div className="table-pagination">
          <button
            className="button button--secondary"
            type="button"
            disabled={shipments.isFetching}
            onClick={() => {
              const next = new URLSearchParams(params)
              next.set('cursor', shipments.data.pageInfo.endCursor)
              setParams(next)
            }}
          >
            {shipments.isFetching ? 'Cargando…' : 'Ver más despachos'}
          </button>
        </div>
      ) : null}
    </>
  )
}
