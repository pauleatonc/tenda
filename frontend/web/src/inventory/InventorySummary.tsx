import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { fetchDashboard, inventoryKeys } from './api'
import {
  formatDate,
  formatQuantity,
  formatSignedQuantity,
  movementLabels,
} from './format'

/** V1-INV-01: read-only summary; opening it never triggers alerts or emails. */
export function InventorySummary() {
  const dashboard = useQuery({
    queryKey: inventoryKeys.dashboard(),
    queryFn: fetchDashboard,
  })

  if (dashboard.isPending) {
    return (
      <section className="inventory-summary" aria-busy="true">
        <p aria-live="polite">Cargando resumen de inventario…</p>
      </section>
    )
  }

  if (dashboard.isError) {
    return (
      <section className="inventory-summary">
        <p role="alert">
          No pudimos cargar el resumen de inventario.{' '}
          <button type="button" onClick={() => void dashboard.refetch()}>
            Reintentar
          </button>
        </p>
      </section>
    )
  }

  const data = dashboard.data

  return (
    <section className="inventory-summary" aria-label="Resumen de inventario">
      <header>
        <h2>Inventario</h2>
        <Link className="button button--primary" to="/app/inventario/nuevo">
          Agregar producto
        </Link>
      </header>

      <div className="inventory-summary__metrics">
        <div>
          <span>Productos</span>
          <strong>{formatQuantity(data.productCount)}</strong>
        </div>
        <div>
          <span>Disponible</span>
          <strong>{formatQuantity(data.available)}</strong>
        </div>
        <div>
          <span>Reservado</span>
          <strong>{formatQuantity(data.reserved)}</strong>
        </div>
        <div>
          <span>Sin unidades</span>
          <strong>{formatQuantity(data.outOfStockCount)}</strong>
        </div>
        <div>
          <span>Stock bajo</span>
          <strong>{formatQuantity(data.lowStockCount)}</strong>
        </div>
      </div>

      {data.alerts.length ? (
        <>
          <h3>Requiere atención</h3>
          <ul className="inventory-summary__alerts">
            {data.alerts.map((alert) => (
              <li key={alert.id}>
                <Link to={`/app/inventario/${alert.productId}`}>{alert.productName}</Link>
                <span>
                  {alert.alertType === 'out_of_stock'
                    ? 'Sin unidades disponibles'
                    : `${formatQuantity(alert.availableQuantity)} disponibles · umbral ${formatQuantity(alert.threshold)}`}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <h3>Actividad reciente</h3>
      {data.recentMovements.length ? (
        <ul className="inventory-summary__activity">
          {data.recentMovements.map((movement) => (
            <li key={movement.id}>
              <Link to={`/app/inventario/${movement.productId}`}>
                {movement.productName}
              </Link>
              <span>
                {movementLabels[movement.movementType] ?? movement.movementType}{' '}
                {formatSignedQuantity(movement.quantity)}
              </span>
              <time>{formatDate(movement.createdAt)}</time>
            </li>
          ))}
        </ul>
      ) : (
        <p className="inventory-summary__empty">
          Cuando registres productos y movimientos, verás aquí la actividad reciente.
        </p>
      )}
    </section>
  )
}
