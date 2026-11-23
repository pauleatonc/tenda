import { useQuery } from '@tanstack/react-query'
import { Navigate, useOutletContext } from 'react-router-dom'

import type { ViewerPayload } from '../auth/api'
import { formatClp } from '../sales/model'
import { fetchStaffPlatformOverview, staffKeys, type StaffPlatformOverview } from './api'
import './platform.css'

export function StaffOverviewPage() {
  const viewer = useOutletContext<ViewerPayload>()
  const overview = useQuery({
    queryKey: staffKeys.overview(),
    queryFn: fetchStaffPlatformOverview,
    enabled: viewer.viewer.isStaff,
    staleTime: 60_000,
  })

  if (!viewer.viewer.isStaff) {
    return <Navigate to="/app" replace />
  }

  const data = overview.data

  return (
    <section className="staff-page">
      <header className="staff-page__banner">
        <div>
          <p className="staff-kicker">Uso interno</p>
          <h1>Plataforma</h1>
          <p>
            Cifras de todas las tiendas de Tenda. No describen el negocio que tienes
            abierto en esta sesión.
          </p>
        </div>
      </header>

      {overview.isError ? (
        <p className="form-message form-message--error" role="alert">
          No pudimos cargar las cifras internas.
        </p>
      ) : overview.isLoading || !data ? (
        <p>Cargando cifras de la plataforma…</p>
      ) : (
        <StaffFigures data={data} />
      )}
    </section>
  )
}

function StaffFigures({ data }: { data: StaffPlatformOverview }) {
  const totalStores = Math.max(data.organisationCount, 1)

  return (
    <>
      <section className="staff-kpis" aria-label="Cifras principales">
        <article>
          <p>Tiendas</p>
          <strong>{data.organisationCount}</strong>
          <small>
            {data.organisationsLast30Days} nuevas en 30 días ·{' '}
            {data.organisationsWithSales} con al menos una venta pagada
          </small>
        </article>
        <article>
          <p>Productos</p>
          <strong>{data.activeProductCount}</strong>
          <small>{data.archivedProductCount} archivados, fuera de este total</small>
        </article>
        <article>
          <p>Ventas confirmadas</p>
          <strong>{formatClp(data.confirmedSalesAmount)}</strong>
          <small>
            {data.confirmedSalesCount} operaciones pagadas, antes de reembolsos
          </small>
        </article>
        <article>
          <p>Inventario a costo</p>
          <strong>{formatClp(data.inventoryAtCost)}</strong>
          <small>
            {data.inventoryCostComplete
              ? 'Todas las unidades tienen precio de compra'
              : `${data.productsMissingCost} productos activos no tienen costo`}
          </small>
        </article>
      </section>

      <section className="staff-panel" aria-labelledby="staff-plans-title">
        <div>
          <h2 id="staff-plans-title">Tiendas por plan</h2>
          <p>Cada tienda cuenta en el plan que tiene vigente ahora.</p>
        </div>
        <ul className="staff-plans">
          {data.plans.map((plan) => {
            const share = Math.round((plan.organisationCount / totalStores) * 100)
            return (
              <li key={plan.code}>
                <div className="staff-plans__label">
                  <span>{plan.name}</span>
                  <strong>
                    {plan.organisationCount}
                    <small> · {data.organisationCount === 0 ? 0 : share}%</small>
                  </strong>
                </div>
                <div className="staff-plans__track" aria-hidden="true">
                  <span
                    style={{ width: `${data.organisationCount === 0 ? 0 : share}%` }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <div className="staff-split">
        <section className="staff-panel" aria-labelledby="staff-stock-title">
          <h2 id="staff-stock-title">Inventario</h2>
          <dl>
            <div>
              <dt>Unidades en existencia</dt>
              <dd>{data.inventoryUnits}</dd>
            </div>
            <div>
              <dt>Unidades reservadas</dt>
              <dd>{data.inventoryReservedUnits}</dd>
            </div>
            <div>
              <dt>Valor a precio de venta</dt>
              <dd>{formatClp(data.inventoryAtSalePrice)}</dd>
            </div>
            <div>
              <dt>Productos sin costo</dt>
              <dd>{data.productsMissingCost}</dd>
            </div>
          </dl>
        </section>

        <section className="staff-panel" aria-labelledby="staff-sales-title">
          <h2 id="staff-sales-title">Ventas</h2>
          <dl>
            <div>
              <dt>Neto confirmado</dt>
              <dd>{formatClp(data.netSalesAmount)}</dd>
            </div>
            <div>
              <dt>Reembolsos</dt>
              <dd>{formatClp(data.refundedAmount)}</dd>
            </div>
            <div>
              <dt>Costo conocido</dt>
              <dd>{formatClp(data.knownCogs)}</dd>
            </div>
            <div>
              <dt>Margen bruto</dt>
              <dd>{formatClp(data.grossMargin)}</dd>
            </div>
          </dl>
          {data.salesCostComplete ? null : (
            <p className="staff-note">
              El margen usa solo líneas con costo registrado. Hay ventas confirmadas sin
              ese dato.
            </p>
          )}
        </section>
      </div>

      <section className="staff-panel" aria-labelledby="staff-activity-title">
        <h2 id="staff-activity-title">En curso</h2>
        <dl className="staff-activity">
          <div>
            <dt>Ventas sin confirmar</dt>
            <dd>
              {formatClp(data.pendingSalesAmount)}
              <small>{data.pendingSalesCount} operaciones</small>
            </dd>
          </div>
          <div>
            <dt>Despachos pendientes</dt>
            <dd>{data.pendingShipmentCount}</dd>
          </div>
        </dl>
      </section>

      <footer className="staff-footnote">
        <p>
          Actualizado{' '}
          {new Intl.DateTimeFormat('es-CL', {
            dateStyle: 'medium',
            timeStyle: 'short',
          }).format(new Date(data.generatedAt))}
          . Las ventas confirmadas son pedidos pagados. El neto resta reembolsos. El
          inventario suma existencias de productos no archivados.
        </p>
      </footer>
    </>
  )
}
