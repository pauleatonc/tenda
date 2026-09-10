import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'

import { TendaApiError } from '../lib/http'
import { fetchPublicOrder, salesKeys } from '../sales/api'
import { formatClp } from '../sales/model'
import {
  PublicOrderSummary,
  PublicOrderUnavailable,
  PublicPage,
} from './PublicOrderComponents'
import { PublicProofUpload } from './PublicProofUpload'

export function PublicProofPage() {
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
        <div className="public-skeleton" aria-busy="true">
          <span className="sr-only">Cargando instrucciones de transferencia…</span>
          <div />
          <div />
        </div>
      </PublicPage>
    )
  }

  if (order.isError || !order.data) {
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

  if (order.data.status === 'expired') return <PublicOrderUnavailable expired />
  const detail = order.data

  return (
    <PublicPage seller={detail.seller}>
      <div className="public-proof-layout">
        <section className="public-proof-card">
          <Link to={`/p/${token}`}>← Volver al producto</Link>
          <p className="eyebrow">Transferencia bancaria</p>
          <h1>Envía tu comprobante</h1>
          <p>
            Transfiere exactamente <strong>{formatClp(detail.total)}</strong>. Subir el
            archivo no aprueba el pago: el vendedor debe validarlo.
          </p>
          <PublicProofUpload token={token} order={detail} showBankInstructions />
        </section>

        <PublicOrderSummary order={detail} compact />
      </div>
    </PublicPage>
  )
}
