import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'

import { StatusChip, Timeline } from '../components/ui'
import { TendaApiError } from '../lib/http'
import { fetchPublicShipment, shippingKeys, type PublicShipment } from '../shipping/api'
import { formatDate } from '../shipping/model'
import { PublicPage, PublicShipmentUnavailable } from './PublicOrderComponents'

function publicTone(status: string): string {
  if (status === 'received') return 'success'
  if (status === 'needs_help' || status === 'cancelled') return 'error'
  if (status === 'dispatched') return 'success'
  return 'warning'
}

export function PublicShipmentSummary({ shipment }: { shipment: PublicShipment }) {
  return (
    <section className="public-summary public-summary--compact">
      <header>
        <div>
          <span>Pedido {shipment.orderNumber}</span>
          <h2>Resumen del envío {shipment.number}</h2>
        </div>
        <StatusChip
          status={publicTone(shipment.publicStatus)}
          label={shipment.publicStatusLabel}
        />
      </header>
      <ul className="public-lines">
        {shipment.lines.map((line) => (
          <li key={`${line.productName}-${line.quantity}`}>
            <span aria-hidden="true">◇</span>
            <div>
              <strong>{line.productName}</strong>
              <small>
                {line.quantity} unidad{line.quantity === 1 ? '' : 'es'}
              </small>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function PublicShipmentPage() {
  const { token = '' } = useParams<{ token: string }>()
  const shipment = useQuery({
    queryKey: shippingKeys.publicShipment(token),
    queryFn: () => fetchPublicShipment(token),
    enabled: Boolean(token),
    retry: 1,
  })

  if (shipment.isPending) {
    return (
      <PublicPage>
        <div className="public-skeleton" aria-live="polite" aria-busy="true">
          <span className="sr-only">Cargando seguimiento…</span>
          <div />
          <div />
          <div />
        </div>
      </PublicPage>
    )
  }

  if (shipment.isError) {
    const expired =
      shipment.error instanceof TendaApiError &&
      shipment.error.code === 'PUBLIC_TOKEN_EXPIRED'
    return (
      <PublicShipmentUnavailable
        expired={expired}
        onRetry={expired ? undefined : () => void shipment.refetch()}
      />
    )
  }

  if (!shipment.data) return <PublicShipmentUnavailable />

  const detail = shipment.data
  const canConfirm = detail.canConfirm
  const needsHelp = detail.publicStatus === 'needs_help'
  const received = detail.publicStatus === 'received'

  return (
    <PublicPage seller={detail.seller}>
      <section className="public-order-intro">
        <p className="eyebrow">Seguimiento sin cuenta</p>
        <h1>{detail.seller.displayName} despachó tu pedido</h1>
        <p>
          Aquí ves el estado público del envío. No mostramos notas internas ni otros
          pedidos.
        </p>
      </section>

      <PublicShipmentSummary shipment={detail} />

      <section className="public-delivery-card">
        <h2>Transporte</h2>
        <p>{detail.carrier || 'Todavía no hay transportista informado.'}</p>
        {detail.trackingCode ? (
          <p>
            Tracking <strong>{detail.trackingCode}</strong>
          </p>
        ) : (
          <small>Cuando el vendedor agregue el tracking, aparecerá aquí.</small>
        )}
        {detail.dispatchedAt ? (
          <small>Despachado el {formatDate(detail.dispatchedAt)}.</small>
        ) : null}
        {detail.trackingUrl ? (
          <p>
            <a href={detail.trackingUrl} target="_blank" rel="noreferrer">
              Abrir seguimiento del transportista
            </a>
          </p>
        ) : null}
      </section>

      <section className="detail-section">
        <h2>Línea de tiempo</h2>
        <Timeline
          items={detail.timeline.map((item, index) => ({
            id: `${item.createdAt}-${index}`,
            title: item.title,
            detail: item.detail,
            date: formatDate(item.createdAt),
          }))}
        />
      </section>

      <div className="public-primary-action">
        {received ? (
          <p>Ya confirmaste que recibiste este pedido.</p>
        ) : canConfirm ? (
          <Link className="button button--primary" to={`/s/${token}/confirmar`}>
            ¿Recibiste tu pedido?
          </Link>
        ) : needsHelp ? null : (
          <p>Cuando el pedido salga, podrás confirmar la recepción aquí.</p>
        )}
        {needsHelp || detail.ticket ? (
          <Link className="button button--secondary" to={`/s/${token}/consulta`}>
            Ver consulta
          </Link>
        ) : (
          <Link className="button button--secondary" to={`/s/${token}/consulta`}>
            ¿Necesitas ayuda con el envío?
          </Link>
        )}
      </div>
    </PublicPage>
  )
}
