import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import { AnalyticsEvents, getAnalytics } from '../analytics'
import { TendaApiError } from '../lib/http'
import { fetchPublicOrderStatus, salesKeys } from '../sales/api'
import {
  PublicOrderStatusPanel,
  PublicOrderUnavailable,
  PublicPage,
} from './PublicOrderComponents'

function isTerminal(status: string, paymentStatus: string): boolean {
  return (
    ['paid', 'sold', 'cancelled', 'expired', 'refunded'].includes(status) ||
    ['paid', 'approved', 'refunded'].includes(paymentStatus)
  )
}

function mercadoPagoReturnCopy(resultado: string | null): {
  title: string
  body: string
} {
  if (resultado === 'pending') {
    return {
      title: 'Pago pendiente en Mercado Pago',
      body: 'Tu pago quedó pendiente en Mercado Pago. Este estado cambiará cuando el proveedor lo confirme.',
    }
  }
  if (resultado === 'failure') {
    return {
      title: 'El pago no se completó',
      body: 'El pago no se completó. Puedes intentarlo de nuevo.',
    }
  }
  return {
    title: 'Volviste desde Mercado Pago',
    body: 'Estamos verificando el pago; el estado cambiará cuando el proveedor lo confirme.',
  }
}

export function PublicStatusPage() {
  const { token = '' } = useParams<{ token: string }>()
  const [params] = useSearchParams()
  const trackedStatus = useRef(false)
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

  useEffect(() => {
    if (!status.data || trackedStatus.current) return
    trackedStatus.current = true
    getAnalytics().track(AnalyticsEvents.buyerStatusViewed)
  }, [status.data])

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
  const terminal = isTerminal(current.status, current.paymentStatus)
  const returnedFromMercadoPago =
    params.get('retorno') === 'mercadopago' || params.has('collection_status')
  const resultado = params.get('resultado')
  const mercadoPagoNote = returnedFromMercadoPago
    ? mercadoPagoReturnCopy(resultado)
    : null

  return (
    <PublicPage>
      <PublicOrderStatusPanel
        number={current.number}
        status={current.status}
        paymentStatus={current.paymentStatus}
        expiresAt={current.expiresAt}
        updatedAt={current.updatedAt}
        rejectionReason={current.rejectionReason}
        heading="h1"
      >
        {mercadoPagoNote ? (
          <div className="public-provider-note" role="status">
            <strong>{mercadoPagoNote.title}</strong>
            <span>{mercadoPagoNote.body}</span>
            {resultado === 'failure' ? (
              <Link className="button button--primary" to={`/p/${token}/comprar`}>
                Intentar de nuevo
              </Link>
            ) : null}
          </div>
        ) : null}

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
      </PublicOrderStatusPanel>
    </PublicPage>
  )
}
