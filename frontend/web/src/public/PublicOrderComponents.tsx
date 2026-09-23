import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { StatusChip } from '../components/ui'
import type { PublicOrder } from '../sales/api'
import {
  formatClp,
  formatDate,
  orderStatusLabels,
  paymentStatusLabels,
  statusTone,
  translated,
} from '../sales/model'

function publicStateCopy(status: string, paymentStatus: string, reason: string | null) {
  if (status === 'expired') {
    return {
      title: 'La reserva terminó',
      description:
        'El plazo de reserva terminó. El stock ya no está apartado; contacta al vendedor para consultar disponibilidad.',
    }
  }
  if (status === 'cancelled') {
    return {
      title: 'La compra fue cancelada',
      description: reason || 'Esta compra ya no puede continuar.',
    }
  }
  if (paymentStatus === 'rejected') {
    return {
      title: 'El comprobante fue rechazado',
      description:
        reason ||
        'El vendedor no pudo validar el archivo. Revisa la transferencia y vuelve a cargar un comprobante válido.',
    }
  }
  if (['paid', 'approved'].includes(paymentStatus) || ['paid', 'sold'].includes(status)) {
    return {
      title: 'Pago confirmado',
      description:
        'El vendedor confirmó el pago y preparará la entrega.',
    }
  }
  if (status === 'purchase_validation' || paymentStatus === 'proof_submitted') {
    return {
      title: 'Comprobante en validación',
      description:
        'El archivo fue recibido. El pago todavía no está aprobado; el vendedor debe revisarlo.',
    }
  }
  return {
    title: 'Esperando confirmación de pago',
    description:
      'La reserva sigue activa. Completa el pago para que el vendedor pueda confirmar la compra.',
  }
}

export function PublicOrderStatusPanel({
  number,
  status,
  paymentStatus,
  expiresAt,
  updatedAt,
  rejectionReason,
  heading: Heading = 'h2',
  embedded = false,
  children,
}: {
  number: string
  status: string
  paymentStatus: string
  expiresAt: string
  updatedAt?: string
  rejectionReason: string | null
  heading?: 'h1' | 'h2'
  embedded?: boolean
  children?: ReactNode
}) {
  const copy = publicStateCopy(status, paymentStatus, rejectionReason)
  const confirmed =
    ['paid', 'approved'].includes(paymentStatus) || ['paid', 'sold'].includes(status)

  return (
    <section
      className={`public-status-card${embedded ? ' public-status-card--embedded' : ''}`}
      aria-live="polite"
    >
      <p className="eyebrow">Pedido {number}</p>
      <div
        className={`public-status-card__icon${confirmed ? ' public-status-card__icon--ok' : ''}`}
        aria-hidden="true"
      >
        {confirmed ? '✓' : '…'}
      </div>
      <StatusChip
        status={statusTone(status)}
        label={translated(orderStatusLabels, status)}
      />
      <Heading>{copy.title}</Heading>
      <p>{copy.description}</p>
      <dl>
        <div>
          <dt>Compra</dt>
          <dd>{translated(orderStatusLabels, status)}</dd>
        </div>
        <div>
          <dt>Pago</dt>
          <dd>{translated(paymentStatusLabels, paymentStatus)}</dd>
        </div>
        <div>
          <dt>Reserva hasta</dt>
          <dd>{formatDate(expiresAt)}</dd>
        </div>
        {updatedAt ? (
          <div>
            <dt>Última actualización</dt>
            <dd>{formatDate(updatedAt)}</dd>
          </div>
        ) : null}
      </dl>
      {children}
    </section>
  )
}

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

function linePhotos(line: PublicOrder['lines'][number]): string[] {
  if (line.photos.length) return line.photos
  return line.imageUrl ? [line.imageUrl] : []
}

function prefersReducedMotion() {
  return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
}

function storeInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase()
}

function PublicStoreMark({ seller }: { seller: PublicOrder['seller'] }) {
  return (
    <div className="public-store">
      {seller.logoUrl ? (
        <img src={seller.logoUrl} alt="" />
      ) : (
        <span aria-hidden="true">{storeInitials(seller.displayName)}</span>
      )}
      <strong>{seller.displayName}</strong>
    </div>
  )
}

function PublicProductCard({
  line,
  seller,
}: {
  line: PublicOrder['lines'][number]
  seller: PublicOrder['seller']
}) {
  const photos = linePhotos(line)
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (photos.length < 2 || paused || prefersReducedMotion()) return
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % photos.length)
    }, 5000)
    return () => window.clearInterval(timer)
  }, [photos.length, paused, active])

  return (
    <article className="public-product">
      <div
        className="public-product__media"
        aria-roledescription="carrusel"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {photos.length ? (
          <div className="public-product__stage">
            {photos.map((src, index) => (
              <img
                key={src}
                className={index === active ? 'is-active' : undefined}
                src={src}
                alt={index === active ? line.name : ''}
              />
            ))}
          </div>
        ) : (
          <div className="public-product__photo public-product__photo--empty" aria-hidden="true">
            ◇
          </div>
        )}
        {photos.length > 1 ? (
          <ul className="public-product__thumbs">
            {photos.map((src, index) => (
              <li key={src}>
                <button
                  type="button"
                  aria-label={`Ver foto ${index + 1} de ${line.name}`}
                  aria-pressed={index === active}
                  onClick={() => setActive(index)}
                >
                  <img src={src} alt="" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="public-product__info">
        <PublicStoreMark seller={seller} />
        <h2>{line.name}</h2>
        {line.description ? <p className="public-product__copy">{line.description}</p> : null}
        {line.attributes.length ? (
          <dl className="public-product__attrs">
            {line.attributes.map((attribute) => (
              <div key={`${attribute.label}:${attribute.value}`}>
                <dt>{attribute.label}</dt>
                <dd>{attribute.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        <p className="public-product__price">{formatClp(line.unitSalePrice)}</p>
        <div className="public-product__qty" aria-label={`Cantidad reservada: ${line.quantity}`}>
          <span aria-hidden="true">−</span>
          <strong>{line.quantity}</strong>
          <span aria-hidden="true">+</span>
        </div>
      </div>
    </article>
  )
}

function PublicOrderTotals({ order }: { order: PublicOrder }) {
  return (
    <>
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
    </>
  )
}

export function PublicOrderSummary({
  order,
  compact = false,
}: {
  order: PublicOrder
  compact?: boolean
}) {
  if (!compact) {
    const showTotals = order.lines.length > 1 || Number(order.feeAmount) > 0
    return (
      <section className="public-summary public-summary--product" aria-label="Tu compra">
        {order.lines.map((line) => (
          <PublicProductCard
            key={line.id}
            line={line}
            seller={order.seller}
          />
        ))}
        {showTotals ? <PublicOrderTotals order={order} /> : (
          <p className="public-summary__expiry">
            Reserva disponible hasta {formatDate(order.expiresAt)}.
          </p>
        )}
      </section>
    )
  }

  return (
    <section className="public-summary public-summary--compact">
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
              <small>
                {line.quantity} × {formatClp(line.unitSalePrice)}
              </small>
            </div>
            <strong>{formatClp(line.lineTotal)}</strong>
          </li>
        ))}
      </ul>
      <PublicOrderTotals order={order} />
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
            ? 'El plazo de reserva terminó. El stock ya no está apartado; contacta al vendedor para consultar disponibilidad.'
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