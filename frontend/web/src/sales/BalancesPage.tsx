import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useOutletContext, useSearchParams } from 'react-router-dom'

import type { ViewerPayload } from '../auth/api'
import { EmptyState, StatusChip } from '../components/ui'
import { fetchProducts, inventoryKeys } from '../inventory/api'
import { TendaApiError } from '../lib/http'
import {
  fetchSalesBalance,
  fetchSalesBalanceBreakdown,
  salesKeys,
  type BalanceBreakdown,
} from './api'
import {
  formatClp,
  makeSalesFilterHref,
  orderStatusLabels,
  paymentMethodLabels,
} from './model'

type RangePreset = 'today' | '7d' | 'month' | 'custom'

function inputDate(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}

function presetRange(
  preset: RangePreset,
  timezone: string,
): { dateFrom: string; dateTo: string } {
  const now = new Date()
  const to = inputDate(now, timezone)
  if (preset === 'today') return { dateFrom: to, dateTo: to }
  if (preset === '7d') {
    const from = new Date(now)
    from.setDate(from.getDate() - 6)
    return { dateFrom: inputDate(from, timezone), dateTo: to }
  }
  return { dateFrom: `${to.slice(0, 7)}-01`, dateTo: to }
}

function formatCoverage(value: string): string {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return value
  return `${Math.round((numeric <= 1 ? numeric * 100 : numeric) * 10) / 10}%`
}

export function BalancesPage() {
  const viewer = useOutletContext<ViewerPayload>()
  const allowed = viewer.membership.permissions.viewFinancials
  const [params, setParams] = useSearchParams()
  const preset = (params.get('rango') as RangePreset | null) ?? 'month'
  const automaticRange = presetRange(
    preset === 'custom' ? 'month' : preset,
    viewer.organisation.timezone,
  )
  const dateFrom = params.get('desde') ?? automaticRange.dateFrom
  const dateTo = params.get('hasta') ?? automaticRange.dateTo
  const productId = params.get('producto') ?? ''
  const method = params.get('metodo') ?? ''
  const status = params.get('estado') ?? ''
  const groupBy = params.get('agrupar') ?? 'period'
  const cursor = params.get('cursor')

  function updateParams(values: Record<string, string | null>) {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    next.delete('cursor')
    setParams(next, { replace: true })
  }

  const products = useQuery({
    queryKey: inventoryKeys.products({
      balances: true,
      includeArchived: true,
    }),
    queryFn: () =>
      fetchProducts({
        filter: { includeArchived: true },
        sort: 'name',
        first: 100,
      }),
    enabled: allowed,
  })

  const filter = {
    dateFrom,
    dateTo,
    productIds: productId ? [productId] : null,
    paymentMethods: method ? [method] : null,
    statuses: status ? [status] : null,
    groupBy,
  }
  const balance = useQuery({
    queryKey: salesKeys.balance(filter),
    queryFn: () => fetchSalesBalance(filter),
    enabled: allowed,
  })
  const breakdownVariables = { filter, first: 25, after: cursor }
  const breakdown = useQuery({
    queryKey: salesKeys.balanceBreakdown(breakdownVariables),
    queryFn: () => fetchSalesBalanceBreakdown(breakdownVariables),
    enabled: allowed,
    placeholderData: keepPreviousData,
  })

  if (!allowed) {
    return (
      <>
        <header className="page-heading">
          <div>
            <p className="eyebrow">Permiso requerido</p>
            <h1>Balances</h1>
          </div>
        </header>
        <EmptyState
          title="No tienes acceso a información financiera"
          description="Solo un Owner o una membresía con view_financials puede consultar ventas, costos y margen."
        />
      </>
    )
  }

  const salesHrefBase = {
    desde: dateFrom,
    hasta: dateTo,
    metodo: method || null,
    producto: productId || null,
    estado: status || null,
  }

  return (
    <>
      <header className="page-heading page-heading--split">
        <div>
          <p className="eyebrow">Solo uso comercial</p>
          <h1>Balance de ventas</h1>
          <p>
            Lectura operativa de ingresos, reembolsos y costos conocidos. No es
            contabilidad legal ni conciliación bancaria.
          </p>
        </div>
        {balance.data ? (
          <StatusChip
            status={balance.data.marginComplete ? 'success' : 'warning'}
            label={balance.data.marginComplete ? 'Costos completos' : 'Margen incompleto'}
          />
        ) : null}
      </header>

      <section className="balance-filters" aria-label="Filtros del balance">
        <fieldset>
          <legend>Rango por fecha de confirmación del pago</legend>
          <div className="chip-row">
            {[
              ['today', 'Hoy'],
              ['7d', '7 días'],
              ['month', 'Mes'],
              ['custom', 'Personalizado'],
            ].map(([value, label]) => (
              <button
                key={value}
                className={`filter-chip ${preset === value ? 'filter-chip--active' : ''}`}
                type="button"
                aria-pressed={preset === value}
                onClick={() => {
                  const nextPreset = value as RangePreset
                  const range =
                    nextPreset === 'custom'
                      ? { dateFrom, dateTo }
                      : presetRange(nextPreset, viewer.organisation.timezone)
                  updateParams({
                    rango: nextPreset,
                    desde: range.dateFrom,
                    hasta: range.dateTo,
                  })
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <label>
          <span>Desde</span>
          <input
            type="date"
            value={dateFrom}
            max={dateTo}
            disabled={preset !== 'custom'}
            onChange={(event) => updateParams({ desde: event.target.value })}
          />
        </label>
        <label>
          <span>Hasta</span>
          <input
            type="date"
            value={dateTo}
            min={dateFrom}
            disabled={preset !== 'custom'}
            onChange={(event) => updateParams({ hasta: event.target.value })}
          />
        </label>
        <label>
          <span>Producto</span>
          <select
            value={productId}
            onChange={(event) => updateParams({ producto: event.target.value })}
          >
            <option value="">Todos</option>
            {products.data?.products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Método de pago</span>
          <select
            value={method}
            onChange={(event) => updateParams({ metodo: event.target.value })}
          >
            <option value="">Todos</option>
            {Object.entries(paymentMethodLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Estado</span>
          <select
            value={status}
            onChange={(event) => updateParams({ estado: event.target.value })}
          >
            <option value="">Todos</option>
            {['purchase_validation', 'paid', 'sold', 'refunded'].map((value) => (
              <option key={value} value={value}>
                {orderStatusLabels[value]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Desglose</span>
          <select
            value={groupBy}
            onChange={(event) => updateParams({ agrupar: event.target.value })}
          >
            <option value="period">Por período</option>
            <option value="product">Por producto</option>
            <option value="payment_method">Por método</option>
            <option value="status">Por estado</option>
          </select>
        </label>
      </section>

      {balance.isPending ? (
        <div className="balance-metrics-stack" aria-busy="true">
          <section className="balance-metrics balance-metrics--loading">
            <span className="sr-only">Calculando balance…</span>
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={`inventory-${index}`} />
            ))}
          </section>
          <section className="balance-metrics balance-metrics--loading">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={`sales-${index}`} />
            ))}
          </section>
        </div>
      ) : null}

      {balance.isError ? (
        <div className="form-message form-message--error" role="alert">
          <strong>No pudimos calcular el balance</strong>
          <span>
            {balance.error instanceof TendaApiError
              ? balance.error.message
              : 'Revisa tu conexión e inténtalo nuevamente.'}
          </span>
          <button
            className="button button--secondary"
            type="button"
            onClick={() => void balance.refetch()}
          >
            Reintentar
          </button>
        </div>
      ) : null}

      {balance.data?.isPartial ? (
        <div className="sales-notice sales-notice--warning" role="alert">
          <strong>Balance parcial</strong>
          <span>
            {balance.data.warnings.join(' ') ||
              'Hay operaciones que requieren conciliación; las cifras disponibles siguen visibles.'}
          </span>
        </div>
      ) : null}

      {balance.data && !balance.data.marginComplete ? (
        <div className="sales-notice sales-notice--warning" role="alert">
          <strong>El margen está incompleto</strong>
          <span>
            Cobertura de costo: {formatCoverage(balance.data.costCoverage)} (
            {balance.data.costedLineCount} de {balance.data.recognizedLineCount} líneas).
            Los costos desconocidos no se interpretan como cero.
          </span>
        </div>
      ) : null}

      {balance.data && balance.data.inventoryValuationComplete === false ? (
        <div className="sales-notice sales-notice--warning" role="status">
          <strong>La valoración del inventario está incompleta</strong>
          <span>
            Hay unidades sin precio de compra o de venta. El margen potencial solo
            considera productos con ambos precios.
          </span>
        </div>
      ) : null}

      {balance.data ? (
        <div className="balance-metrics-stack">
          <section className="balance-metrics" aria-label="Valoración del inventario">
            <Link to="/app/inventario">
              <span>Inventario al costo</span>
              <strong>
                {balance.data.inventoryValuationComplete === false
                  ? `${formatClp(balance.data.inventoryAtCost)}*`
                  : formatClp(balance.data.inventoryAtCost)}
              </strong>
            </Link>
            <Link to="/app/inventario">
              <span>Inventario a precio de venta</span>
              <strong>
                {balance.data.inventoryValuationComplete === false
                  ? `${formatClp(balance.data.inventoryAtSalePrice)}*`
                  : formatClp(balance.data.inventoryAtSalePrice)}
              </strong>
            </Link>
            <Link to="/app/inventario">
              <span>Margen potencial del stock</span>
              <strong>
                {balance.data.inventoryValuationComplete === false
                  ? `${formatClp(balance.data.inventoryPotentialMargin)}*`
                  : formatClp(balance.data.inventoryPotentialMargin)}
              </strong>
            </Link>
          </section>
          <section className="balance-metrics" aria-label="Métricas comerciales">
            <Link to={makeSalesFilterHref({ ...salesHrefBase, estado: 'paid' })}>
              <span>Ventas brutas confirmadas</span>
              <strong>{formatClp(balance.data.grossSales)}</strong>
            </Link>
            <Link to={makeSalesFilterHref(salesHrefBase)}>
              <span>Costo conocido</span>
              <strong>{formatClp(balance.data.knownCostOfGoods)}</strong>
            </Link>
            <Link to={makeSalesFilterHref(salesHrefBase)}>
              <span>Margen bruto</span>
              <strong>
                {balance.data.marginComplete
                  ? formatClp(balance.data.grossMargin)
                  : `${formatClp(balance.data.grossMargin)}*`}
              </strong>
            </Link>
            <Link
              to={makeSalesFilterHref({
                ...salesHrefBase,
                estado: 'purchase_validation',
              })}
            >
              <span>Por cobrar / validar</span>
              <strong>{formatClp(balance.data.pendingAmount)}</strong>
            </Link>
          </section>
        </div>
      ) : null}

      {balance.data && balance.data.operationCount === 0 ? (
        <EmptyState
          title="Sin operaciones confirmadas"
          description="No hay pagos confirmados que reconocer como ingreso en este rango."
          action={
            <Link
              className="button button--secondary"
              to={makeSalesFilterHref(salesHrefBase)}
            >
              Ver ventas del período
            </Link>
          }
        />
      ) : null}

      {breakdown.isError && balance.data ? (
        <div className="sales-notice sales-notice--warning" role="alert">
          <strong>Resumen disponible, desglose temporalmente incompleto</strong>
          <span>
            No pudimos cargar las filas. Las métricas superiores siguen vigentes.
          </span>
          <button
            className="button button--secondary"
            type="button"
            onClick={() => void breakdown.refetch()}
          >
            Reintentar desglose
          </button>
        </div>
      ) : null}

      {breakdown.isPending && balance.data?.operationCount ? (
        <div className="table-skeleton" aria-busy="true">
          <span className="sr-only">Cargando desglose…</span>
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} />
          ))}
        </div>
      ) : null}

      {breakdown.data?.nodes.length ? (
        <section className="balance-breakdown">
          <h2>Desglose</h2>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Grupo</th>
                  <th scope="col">Bruto</th>
                  <th scope="col">Reembolsos</th>
                  <th scope="col">Neto</th>
                  <th scope="col">Costo conocido</th>
                  <th scope="col">Margen</th>
                  <th scope="col">Pendiente</th>
                  <th scope="col">Artículos vendidos</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.data.nodes.map((row: BalanceBreakdown) => {
                  const href = makeSalesFilterHref({
                    desde: row.periodStart ?? dateFrom,
                    hasta: row.periodEnd ?? dateTo,
                    producto: row.productId ?? productId,
                    metodo: row.paymentMethod ?? method,
                    estado: row.status ?? status,
                  })
                  return (
                    <tr key={row.key}>
                      <th scope="row">
                        <Link to={href}>{row.label}</Link>
                        {!row.marginComplete ? (
                          <small> Cobertura {formatCoverage(row.costCoverage)}</small>
                        ) : null}
                      </th>
                      <td>
                        <Link to={href}>{formatClp(row.grossSales)}</Link>
                      </td>
                      <td>
                        <Link to={href}>{formatClp(row.refunds)}</Link>
                      </td>
                      <td>
                        <Link to={href}>{formatClp(row.netSales)}</Link>
                      </td>
                      <td>
                        <Link to={href}>{formatClp(row.knownCostOfGoods)}</Link>
                      </td>
                      <td>
                        <Link to={href}>{formatClp(row.grossMargin)}</Link>
                      </td>
                      <td>
                        <Link to={href}>{formatClp(row.pendingAmount)}</Link>
                      </td>
                      <td>
                        <Link to={href}>{row.operationCount}</Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {breakdown.data?.pageInfo.hasNextPage ? (
        <div className="table-pagination">
          <button
            className="button button--secondary"
            type="button"
            disabled={breakdown.isFetching}
            onClick={() => {
              const next = new URLSearchParams(params)
              next.set('cursor', breakdown.data.pageInfo.endCursor)
              setParams(next)
            }}
          >
            {breakdown.isFetching ? 'Cargando…' : 'Ver más filas'}
          </button>
        </div>
      ) : null}

      {balance.data ? (
        <footer className="balance-disclaimer">
          Corte según zona horaria <strong>{balance.data.timezone}</strong>. El
          inventario al costo, a precio de venta y el margen potencial reflejan el
          stock actual (no el período). No incluye caja, impuestos, DTE, facturación
          ni conciliación bancaria.
        </footer>
      ) : null}
    </>
  )
}
