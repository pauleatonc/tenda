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
  const pending = data.attentionCount

  return (
    <article className="sales-attention">
      <header>
        <div>
          <StatusChip
            status={pending ? 'warning' : 'success'}
            label={pending ? `${pending} acciones pendientes` : 'Despachos al día'}
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
          <dt>En preparación</dt>
          <dd>{data.preparingCount}</dd>
        </div>
        <div>
          <dt>Chequeo de entrega</dt>
          <dd>{data.deliveryCheckCount}</dd>
        </div>
        <div>
          <dt>Incidencias</dt>
          <dd>{data.issueCount}</dd>
        </div>
      </dl>
    </article>
  )
}
