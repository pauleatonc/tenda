import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'

import { TendaApiError } from '../lib/http'
import { fetchPublicOrder, salesKeys } from '../sales/api'
import { deliveryModeLabels, translated } from '../sales/model'
import {
  PublicOrderSummary,
  PublicOrderUnavailable,
  PublicPage,
} from './PublicOrderComponents'

export function PublicOrderPage() {
  const { token = '' } = useParams<{ token: string }>()
  const order = useQuery({
    queryKey: salesKeys.publicOrder(token),
    queryFn: () => fetchPublicOrder(token),
    enabled: Boolean(token),
    retry: 1,
  })

  if (order.isPending) {
    return (
      <PublicPage>
        <div className="public-skeleton" aria-live="polite" aria-busy="true">
          <span className="sr-only">Cargando detalle de compra…</span>
          <div />
          <div />
          <div />
        </div>
      </PublicPage>
    )
  }

  if (order.isError) {
    const expired =
      order.error instanceof TendaApiError &&
      ['ORDER_EXPIRED', 'PUBLIC_TOKEN_EXPIRED'].includes(order.error.code)
    return (
      <PublicOrderUnavailable
        expired={expired}
        onRetry={expired ? undefined : () => void order.refetch()}
      />
    )
  }

  if (!order.data) return <PublicOrderUnavailable />
  if (order.data.status === 'expired') return <PublicOrderUnavailable expired />

  const detail = order.data
  const terminal = ['paid', 'sold', 'cancelled', 'refunded'].includes(detail.status)

  return (
    <PublicPage seller={detail.seller}>
      <section className="public-order-intro">
        <p className="eyebrow">Compra segura y sin cuenta</p>
        <h1>{detail.seller.displayName} preparó este pedido para ti</h1>
        <p>
          Revisa productos, cantidades y total efectivo antes de completar tus datos.
          Tenda no muestra stock privado ni costos del vendedor.
        </p>
      </section>

      <PublicOrderSummary order={detail} />

      <section className="public-delivery-card">
        <h2>Entrega</h2>
        <p>{translated(deliveryModeLabels, detail.deliveryMode)}</p>
        {detail.deliveryMode === 'shipping' ? (
          <small>
            Podrás indicar destinatario, dirección, comuna y ciudad al comprar.
          </small>
        ) : (
          <small>El vendedor coordinará contigo los detalles de la entrega.</small>
        )}
      </section>

      <div className="public-primary-action">
        {terminal ? (
          <Link className="button button--primary" to={`/p/${token}/estado`}>
            Ver estado de la compra
          </Link>
        ) : (
          <Link className="button button--primary" to={`/p/${token}/comprar`}>
            Comprar
          </Link>
        )}
        <span>No necesitas crear una cuenta.</span>
      </div>
    </PublicPage>
  )
}
