import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useOutletContext, useSearchParams } from 'react-router-dom'

import type { ViewerPayload } from '../auth/api'
import { EmptyState, StatusChip } from '../components/ui'
import { fetchProducts, inventoryKeys } from '../inventory/api'
import { TendaApiError } from '../lib/http'
import { BalanceMixChart, BalanceTrendChart } from './BalanceCharts'
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
type MixTab = 'product' | 'payment_method'

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

function formatRangeLabel(dateFrom: string, dateTo: string): string {
  if (!dateFrom || !dateTo) return ''
  if (dateFrom === dateTo) return dateFrom
  return `${dateFrom} → ${dateTo}`
}

function amount(value: string | undefined): number {
  const numeric = Number(value ?? 0)
  return Number.isFinite(numeric) ? numeric : 0
}

export function BalancesPage() {
  const viewer = useOutletContext<ViewerPayload>()
  const allowed = viewer.membership.permissions.viewFinancials
  const [params, setParams] = useSearchParams()
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [mixTab, setMixTab] = useState<MixTab>('product')
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
  const groupBy = (params.get('agrupar') ?? 'period') as
    | 'period'
    | 'product'
    | 'payment_method'
    | 'status'
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

  const baseFilter = {
    dateFrom,
    dateTo,
    productIds: productId ? [productId] : null,
    paymentMethods: method ? [method] : null,
    statuses: status ? [status] : null,
  }
  const balance = useQuery({
    queryKey: salesKeys.balance({ ...baseFilter, groupBy }),
    queryFn: () => fetchSalesBalance({ ...baseFilter, groupBy }),
    enabled: allowed,
  })
  const breakdownVariables = {
    filter: { ...baseFilter, groupBy },
    first: 25,
    after: cursor,
  }
  const breakdown = useQuery({
    queryKey: salesKeys.balanceBreakdown(breakdownVariables),
    queryFn: () => fetchSalesBalanceBreakdown(breakdownVariables),
    enabled: allowed,
    placeholderData: keepPreviousData,
  })
  const trend = useQuery({
    queryKey: salesKeys.balanceBreakdown({
      filter: { ...baseFilter, groupBy: 'period' },
      first: 90,
      after: null,
    }),
    queryFn: () =>
      fetchSalesBalanceBreakdown({
        filter: { ...baseFilter, groupBy: 'period' },
        first: 90,
      }),
    enabled: allowed,
  })
  const mix = useQuery({
    queryKey: salesKeys.balanceBreakdown({
      filter: { ...baseFilter, groupBy: mixTab },
      first: 10,
      after: null,
    }),
    queryFn: () =>
      fetchSalesBalanceBreakdown({
        filter: { ...baseFilter, groupBy: mixTab },
        first: 10,
      }),
    enabled: allowed,
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
  const data = balance.data
  const pendingTotal = amount(data?.pendingAmount) + amount(data?.validationAmount)

  return (
    <>
      <header className="page-heading page-heading--split">
        <div>
          <p className="eyebrow">Solo uso comercial</p>
          <h1>Balance de ventas</h1>
          <p>
            Cómo van tus ventas en el período: neto, margen y lo que aún debes
            cobrar o validar.
          </p>
        </div>
        {data ? (
          <StatusChip
            status={data.marginComplete ? 'success' : 'warning'}
            label={data.marginComplete ? 'Costos completos' : 'Margen incompleto'}
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
            <button
              className="filter-chip"
              type="button"
              aria-expanded={advancedOpen}
              onClick={() => setAdvancedOpen((open) => !open)}
            >
              {advancedOpen ? 'Ocultar filtros' : 'Más filtros'}
            </button>
          </div>
        </fieldset>

        {preset === 'custom' || advancedOpen ? (
          <div className="balance-filters__advanced">
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
          </div>
        ) : null}
      </section>

      {balance.isPending ? (
        <section className="balance-hero balance-hero--loading" aria-busy="true">
          <span className="sr-only">Calculando balance…</span>
        </section>
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

      {data ? (
        <section className="balance-hero" aria-label="Resumen del período">
          <div className="balance-hero__main">
            <p className="balance-hero__eyebrow">Ventas netas · {formatRangeLabel(dateFrom, dateTo)}</p>
            <p className="balance-hero__value">
              <Link to={makeSalesFilterHref({ ...salesHrefBase, estado: 'paid' })}>
                {formatClp(data.netSales)}
              </Link>
            </p>
            <p className="balance-hero__meta">
              {data.operationCount} operaciones confirmadas
              {!data.marginComplete
                ? ` · cobertura de costo ${formatCoverage(data.costCoverage)}`
                : ''}
            </p>
          </div>
          <div className="balance-hero__support" aria-label="Detalle del neto">
            <Link to={makeSalesFilterHref({ ...salesHrefBase, estado: 'paid' })}>
              <span>Bruto</span>
              <strong>{formatClp(data.grossSales)}</strong>
            </Link>
            <Link to={makeSalesFilterHref({ ...salesHrefBase, estado: 'refunded' })}>
              <span>Reembolsos</span>
              <strong>{formatClp(data.refunds)}</strong>
            </Link>
            <Link to={makeSalesFilterHref(salesHrefBase)}>
              <span>Margen{data.marginComplete ? '' : '*'}</span>
              <strong>
                {data.marginComplete
                  ? formatClp(data.grossMargin)
                  : `${formatClp(data.grossMargin)}*`}
              </strong>
            </Link>
          </div>
          {pendingTotal > 0 ? (
            <div className="balance-hero__actions">
              {amount(data.validationAmount) > 0 ? (
                <Link
                  className="balance-action-pill"
                  to={makeSalesFilterHref({
                    ...salesHrefBase,
                    estado: 'purchase_validation',
                    corte: null,
                  })}
                >
                  Por validar · {formatClp(data.validationAmount)}
                </Link>
              ) : null}
              {amount(data.pendingAmount) > 0 ? (
                <Link
                  className="balance-action-pill"
                  to={makeSalesFilterHref({
                    ...salesHrefBase,
                    estado: 'purchase_in_progress',
                    corte: null,
                  })}
                >
                  Por cobrar · {formatClp(data.pendingAmount)}
                </Link>
              ) : null}
            </div>
          ) : null}
          {!data.marginComplete ? (
            <p className="balance-hero__note" role="status">
              Margen incompleto: los costos desconocidos no se interpretan como cero (
              {data.costedLineCount} de {data.recognizedLineCount} líneas).
            </p>
          ) : null}
        </section>
      ) : null}

      {data ? (
        <section className="balance-charts" aria-label="Gráficos del período">
          <BalanceTrendChart rows={trend.data?.nodes ?? []} loading={trend.isPending} />
          <div className="balance-charts__mix">
            <div className="chip-row" role="tablist" aria-label="Composición">
              <button
                type="button"
                role="tab"
                aria-selected={mixTab === 'product'}
                className={`filter-chip ${mixTab === 'product' ? 'filter-chip--active' : ''}`}
                onClick={() => setMixTab('product')}
              >
                Producto
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mixTab === 'payment_method'}
                className={`filter-chip ${mixTab === 'payment_method' ? 'filter-chip--active' : ''}`}
                onClick={() => setMixTab('payment_method')}
              >
                Método de pago
              </button>
            </div>
            <BalanceMixChart
              rows={mix.data?.nodes ?? []}
              loading={mix.isPending}
              title={
                mixTab === 'product' ? 'Top productos (neto)' : 'Mix por método (neto)'
              }
            />
          </div>
        </section>
      ) : null}

      {data ? (
        <section className="balance-inventory" aria-label="Stock actual">
          <div className="balance-inventory__intro">
            <h2>Stock actual</h2>
            <p>No corresponde al período filtrado; es la valoración del inventario hoy.</p>
          </div>
          <div className="balance-metrics">
            <Link to="/app/inventario">
              <span>Al costo</span>
              <strong>
                {data.inventoryValuationComplete === false
                  ? `${formatClp(data.inventoryAtCost)}*`
                  : formatClp(data.inventoryAtCost)}
              </strong>
            </Link>
            <Link to="/app/inventario">
              <span>A precio de venta</span>
              <strong>
                {data.inventoryValuationComplete === false
                  ? `${formatClp(data.inventoryAtSalePrice)}*`
                  : formatClp(data.inventoryAtSalePrice)}
              </strong>
            </Link>
            <Link to="/app/inventario">
              <span>Margen potencial</span>
              <strong>
                {data.inventoryValuationComplete === false
                  ? `${formatClp(data.inventoryPotentialMargin)}*`
                  : formatClp(data.inventoryPotentialMargin)}
              </strong>
            </Link>
          </div>
          {data.inventoryValuationComplete === false ? (
            <p className="balance-inventory__note" role="status">
              Hay unidades sin precio de compra o de venta; el margen potencial solo
              considera productos con ambos precios.
            </p>
          ) : null}
        </section>
      ) : null}

      {data && data.operationCount === 0 ? (
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

      {breakdown.isError && data ? (
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

      {breakdown.isPending && data?.operationCount ? (
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
                  <th scope="col">Margen</th>
                  <th scope="col">Pendiente</th>
                  <th scope="col">Unidades</th>
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

      {data ? (
        <footer className="balance-disclaimer">
          Corte según zona horaria <strong>{data.timezone}</strong>. El stock al costo,
          a precio de venta y el margen potencial reflejan el inventario actual. No
          incluye caja, impuestos, DTE, facturación ni conciliación bancaria.
        </footer>
      ) : null}
    </>
  )
}
