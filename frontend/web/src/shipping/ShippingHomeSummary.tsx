import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { StatusChip } from '../components/ui'
import { fetchShippingDashboard, shippingKeys } from './api'

export function ShippingHomeSummary() {
  const summary = useQuery({
    queryKey: shippingKeys.dashboard(),
    queryFn: fetchShippingDashboard,
  })

  if (summary.isPending) {
    return (
      <article className="sales-attention sales-attention--loading" aria-busy="true">
        <span className="sr-only">Cargando resumen de despachos…</span>
      </article>
    )
  }

  if (summary.isError) return null

  const data = summary.data
  const pending = data.pendingCount

  return (
    <article className="sales-attention">
      <header>
        <div>
          <StatusChip
            status={pending ? 'warning' : 'success'}
            label={
              pending
                ? `${pending} ${pending === 1 ? 'envío por registrar' : 'envíos por registrar'}`
                : 'Despachos al día'
            }
          />
          <h2>Despachos</h2>
        </div>
        <Link className="button button--secondary" to="/app/despachos">
          Ir a despachos
        </Link>
      </header>
      <dl>
        <div>
          <dt>Pendientes</dt>
          <dd>{data.pendingCount}</dd>
        </div>
        <div>
          <dt>Despachados</dt>
          <dd>{data.dispatchedCount}</dd>
        </div>
        <div>
          <dt>Entregados</dt>
          <dd>{data.deliveredCount}</dd>
        </div>
      </dl>
    </article>
  )
}
