import { useQuery } from '@tanstack/react-query'
import { Link, useParams, useSearchParams } from 'react-router-dom'

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
  const terminal = isTerminal(current.status, current.paymentStatus)
  const returnedFromMercadoPago =
    params.get('retorno') === 'mercadopago' || params.has('collection_status')

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
        {returnedFromMercadoPago ? (
          <div className="public-provider-note" role="status">
            <strong>Volviste desde Mercado Pago</strong>
            <span>
              El retorno no confirma el pago. Este estado cambiará solo después de la
              verificación del proveedor.
            </span>
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
