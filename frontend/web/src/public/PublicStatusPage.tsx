import { useQuery } from '@tanstack/react-query'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import { StatusChip } from '../components/ui'
import { TendaApiError } from '../lib/http'
import { fetchPublicOrderStatus, salesKeys } from '../sales/api'
import {
  formatDate,
  orderStatusLabels,
  paymentStatusLabels,
  statusTone,
  translated,
} from '../sales/model'
import { PublicOrderUnavailable, PublicPage } from './PublicOrderComponents'

function isTerminal(status: string, paymentStatus: string): boolean {
  return (
    ['paid', 'sold', 'cancelled', 'expired', 'refunded'].includes(status) ||
    ['paid', 'approved', 'refunded'].includes(paymentStatus)
  )
}

function stateCopy(status: string, paymentStatus: string, reason: string | null) {
  if (status === 'expired') {
    return {
      title: 'La reserva terminó',
      description:
        'Pasaron las 8 horas y el stock dejó de estar reservado. Contacta al vendedor para crear una nueva compra.',
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
        'El vendedor confirmó el pago. Ahora puede preparar la entrega sin volver a descontar stock.',
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
      'La reserva sigue activa. Si pagaste con Mercado Pago, Tenda espera la confirmación segura del proveedor.',
  }
}

export function PublicStatusPage() {
  const { token = '' } = useParams<{ token: string }>()
  const [params] = useSearchParams()
  const status = useQuery({
    queryKey: salesKeys.publicStatus(token),
    queryFn: () => fetchPublicOrderStatus(token),
    enabled: Boolean(token),
    retry: 3,
    retryDelay: (attempt) => Math.min(2_000 * 2 ** attempt, 30_000),
    refetchInterval: (query) => {
      const current = query.state.data
      if (current && isTerminal(current.status, current.paymentStatus)) return false
      const failures = query.state.fetchFailureCount
      return Math.min(20_000 * 2 ** failures, 60_000)
    },
    refetchIntervalInBackground: false,
  })

  if (status.isPending) {
    return (
      <PublicPage>
        <div className="public-skeleton" aria-live="polite" aria-busy="true">
          <span className="sr-only">Consultando estado de la compra…</span>
          <div />
          <div />
        </div>
      </PublicPage>
    )
  }

  if (status.isError) {
    const expired =
      status.error instanceof TendaApiError &&
      ['ORDER_EXPIRED', 'PUBLIC_TOKEN_EXPIRED'].includes(status.error.code)
    return (
      <PublicOrderUnavailable
        expired={expired}
        onRetry={expired ? undefined : () => void status.refetch()}
      />
    )
  }

  const current = status.data
  const copy = stateCopy(current.status, current.paymentStatus, current.rejectionReason)
  const terminal = isTerminal(current.status, current.paymentStatus)
  const returnedFromMercadoPago =
    params.get('retorno') === 'mercadopago' || params.has('collection_status')

  return (
    <PublicPage>
      <section className="public-status-card" aria-live="polite">
        <p className="eyebrow">Pedido {current.number}</p>
        <div className="public-status-card__icon" aria-hidden="true">
          {['paid', 'approved'].includes(current.paymentStatus) ? '✓' : '…'}
        </div>
        <StatusChip
          status={statusTone(current.status)}
          label={translated(orderStatusLabels, current.status)}
        />
        <h1>{copy.title}</h1>
        <p>{copy.description}</p>

        {returnedFromMercadoPago ? (
          <div className="public-provider-note" role="status">
            <strong>Volviste desde Mercado Pago</strong>
            <span>
              El retorno no confirma el pago. Este estado cambiará solo después de la
              verificación del proveedor.
            </span>
          </div>
        ) : null}

        <dl>
          <div>
            <dt>Compra</dt>
            <dd>{translated(orderStatusLabels, current.status)}</dd>
          </div>
          <div>
            <dt>Pago</dt>
            <dd>{translated(paymentStatusLabels, current.paymentStatus)}</dd>
          </div>
          <div>
            <dt>Reserva hasta</dt>
            <dd>{formatDate(current.expiresAt)}</dd>
          </div>
          <div>
            <dt>Última actualización</dt>
            <dd>{formatDate(current.updatedAt)}</dd>
          </div>
        </dl>

        {!terminal ? (
          <p className="public-polling-note">
            Actualizamos de forma moderada y reducimos la frecuencia si hay problemas de
            conexión. También puedes actualizar manualmente.
          </p>
        ) : null}

        <div className="public-status-actions">
          <button
            className="button button--primary"
            type="button"
            disabled={status.isFetching}
            onClick={() => void status.refetch()}
          >
            {status.isFetching ? 'Actualizando…' : 'Actualizar estado'}
          </button>
          {!terminal && current.status === 'purchase_in_progress' ? (
            <Link className="button button--secondary" to={`/p/${token}/comprobante`}>
              Subir comprobante
            </Link>
          ) : null}
          <Link className="button button--secondary" to={`/p/${token}`}>
            Ver pedido
          </Link>
        </div>
      </section>
    </PublicPage>
  )
}
