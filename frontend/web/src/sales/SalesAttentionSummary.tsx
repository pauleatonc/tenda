import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { StatusChip } from '../components/ui'
import { fetchSalesDashboard, salesKeys } from './api'
import { formatClp } from './model'

export function SalesAttentionSummary() {
  const summary = useQuery({
    queryKey: salesKeys.dashboard(),
    queryFn: fetchSalesDashboard,
  })

  if (summary.isPending) {
    return (
      <article className="sales-attention sales-attention--loading" aria-busy="true">
        <span className="sr-only">Cargando atención de ventas…</span>
      </article>
    )
  }

  if (summary.isError) return null

  const data = summary.data
  const pending =
    data.awaitingBuyerCount +
    data.awaitingPaymentCount +
    data.awaitingValidationCount +
    data.reconciliationRequiredCount

  return (
    <article className="sales-attention">
      <header>
        <div>
          <StatusChip
            status={pending ? 'warning' : 'success'}
            label={pending ? `${pending} acciones pendientes` : 'Ventas al día'}
          />
          <h2>Atención de ventas</h2>
        </div>
        <Link className="button button--secondary" to="/app/ventas">
          Ir a ventas
        </Link>
      </header>
      <dl>
        <div>
          <dt>Esperando pago</dt>
          <dd>{data.awaitingPaymentCount}</dd>
        </div>
        <div>
          <dt>Por validar</dt>
          <dd>{data.awaitingValidationCount}</dd>
        </div>
        <div>
          <dt>Conciliación</dt>
          <dd>{data.reconciliationRequiredCount}</dd>
        </div>
        <div>
          <dt>Mes confirmado</dt>
          <dd>{formatClp(data.confirmedThisMonthAmount)}</dd>
        </div>
      </dl>
    </article>
  )
}
