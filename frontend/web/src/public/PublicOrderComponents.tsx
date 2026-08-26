import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { StatusChip } from '../components/ui'
import type { PublicOrder } from '../sales/api'
import {
  formatClp,
  formatDate,
  orderStatusLabels,
  statusTone,
  translated,
} from '../sales/model'

export function PublicPage({
  children,
  seller,
}: {
  children: ReactNode
  seller?: PublicOrder['seller']
}) {
  return (
    <div className="public-order-page">
      <header className="public-order-header">
        <Link className="wordmark" to="/" aria-label="Tenda, inicio">
          tenda
        </Link>
        {seller ? <span>Venta de {seller.displayName}</span> : null}
      </header>
      <main>{children}</main>
      <footer className="public-order-footer">
        <span>Compra compartida mediante Tenda</span>
        {seller ? (
          <div>
            {seller.contactEmail ? (
              <a href={`mailto:${seller.contactEmail}`}>{seller.contactEmail}</a>
            ) : null}
            {seller.contactPhone ? (
              <a href={`tel:${seller.contactPhone}`}>{seller.contactPhone}</a>
            ) : null}
          </div>
        ) : null}
      </footer>
    </div>
  )
}

export function PublicOrderSummary({
  order,
  compact = false,
}: {
  order: PublicOrder
  compact?: boolean
}) {
  return (
    <section className={`public-summary ${compact ? 'public-summary--compact' : ''}`}>
      <header>
        <div>
          <span>Pedido {order.number}</span>
          <h2>Tu compra</h2>
        </div>
        <StatusChip
          status={statusTone(order.status)}
          label={translated(orderStatusLabels, order.status)}
        />
      </header>
      <ul className="public-lines">
        {order.lines.map((line: PublicOrder['lines'][number]) => (
          <li key={line.id}>
            {line.imageUrl ? (
              <img src={line.imageUrl} alt="" />
            ) : (
              <span aria-hidden="true">◇</span>
            )}
            <div>
              <strong>{line.name}</strong>
              {!compact && line.description ? <p>{line.description}</p> : null}
              {!compact && line.attributes.length ? (
                <dl>
                  {line.attributes.map(
                    (attribute: PublicOrder['lines'][number]['attributes'][number]) => (
                      <div key={`${attribute.label}:${attribute.value}`}>
                        <dt>{attribute.label}</dt>
                        <dd>{attribute.value}</dd>
                      </div>
                    ),
                  )}
                </dl>
              ) : null}
              <small>
                {line.quantity} × {formatClp(line.unitSalePrice)}
              </small>
            </div>
            <strong>{formatClp(line.lineTotal)}</strong>
          </li>
        ))}
      </ul>
      <dl className="public-totals">
        <div>
          <dt>Subtotal</dt>
          <dd>{formatClp(order.subtotal)}</dd>
        </div>
        {Number(order.feeAmount) > 0 ? (
          <div>
            <dt>Comisión de pago</dt>
            <dd>{formatClp(order.feeAmount)}</dd>
          </div>
        ) : null}
        <div>
          <dt>Total CLP</dt>
          <dd>{formatClp(order.total)}</dd>
        </div>
      </dl>
      <p className="public-summary__expiry">
        Reserva disponible hasta {formatDate(order.expiresAt)}.
      </p>
    </section>
  )
}

export function PublicOrderUnavailable({
  expired = false,
  onRetry,
}: {
  expired?: boolean
  onRetry?: () => void
}) {
  return (
    <PublicPage>
      <section className="public-state-card" role={expired ? undefined : 'alert'}>
        <span aria-hidden="true">{expired ? '⌛' : '!'}</span>
        <h1>{expired ? 'La reserva terminó' : 'No pudimos abrir esta compra'}</h1>
        <p>
          {expired
            ? 'Pasaron las 8 horas de reserva. El stock ya no está apartado; contacta al vendedor para consultar disponibilidad.'
            : 'El enlace puede ser incorrecto o la conexión se interrumpió. No mostramos información privada.'}
        </p>
        {onRetry ? (
          <button className="button button--primary" type="button" onClick={onRetry}>
            Reintentar
          </button>
        ) : null}
      </section>
    </PublicPage>
  )
}

export function PublicShipmentUnavailable({
  expired = false,
  onRetry,
}: {
  expired?: boolean
  onRetry?: () => void
}) {
  return (
    <PublicPage>
      <section className="public-state-card" role={expired ? undefined : 'alert'}>
        <span aria-hidden="true">{expired ? '⌛' : '!'}</span>
        <h1>{expired ? 'Este seguimiento ya no está disponible' : 'No pudimos abrir este envío'}</h1>
        <p>
          {expired
            ? 'El enlace de seguimiento caducó. Pide uno actualizado al vendedor.'
            : 'El enlace puede ser incorrecto o la conexión se interrumpió. No mostramos información privada.'}
        </p>
        {onRetry ? (
          <button className="button button--primary" type="button" onClick={onRetry}>
            Reintentar
          </button>
        ) : null}
      </section>
    </PublicPage>
  )
}
