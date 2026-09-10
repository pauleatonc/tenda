import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'

import { TendaApiError } from '../lib/http'
import { fetchPublicOrder, salesKeys } from '../sales/api'
import { deliveryModeLabels, formatDate, translated } from '../sales/model'
import {
  PublicOrderStatusPanel,
  PublicOrderSummary,
  PublicOrderUnavailable,
  PublicPage,
} from './PublicOrderComponents'
import { BankTransferDetails } from './BankTransferDetails'
import { PublicDeliveryForm } from './PublicDeliveryForm'
import { PublicProofUpload } from './PublicProofUpload'

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
  const isBankOffer = detail.paymentMethod === 'bank_transfer'
  const awaitingProof =
    isBankOffer && ['reserved', 'purchase_in_progress'].includes(detail.status)
  const reviewingProof = isBankOffer && detail.status === 'purchase_validation'
  const confirmed = ['paid', 'sold'].includes(detail.status)

  if (isBankOffer) {
    return (
      <PublicPage seller={detail.seller}>
        <section className="public-order-intro public-order-intro--offer">
          <p className="eyebrow">{confirmed ? 'Compra confirmada' : 'Producto reservado'}</p>
          <p>
            {confirmed
              ? 'El vendedor confirmó el pago de este producto.'
              : `${detail.seller.displayName} te dejó este producto apartado.`}
          </p>
        </section>

        {awaitingProof ? (
          <aside className="public-deadline" role="status">
            <p className="eyebrow">Plazo para pagar</p>
            <p>
              Transfiere el total y sube el comprobante antes de{' '}
              <strong>{formatDate(detail.expiresAt)}</strong>.
            </p>
          </aside>
        ) : null}

        <PublicOrderSummary order={detail} />

        {awaitingProof || reviewingProof ? (
          <section className="public-proof-card">
            <p className="eyebrow">Transferencia</p>
            <h2>Paga por transferencia</h2>
            <div className="public-offer-split">
              <BankTransferDetails
                details={detail.bankDetails}
                instructions={detail.bankTransferInstructions}
              />
              <PublicDeliveryForm
                token={token}
                order={detail}
                readOnly={reviewingProof}
              />
            </div>
            <PublicProofUpload
              token={token}
              order={detail}
              showBankInstructions={false}
              requireDelivery
            />
          </section>
        ) : (
          <PublicOrderStatusPanel
            number={detail.number}
            status={detail.status}
            paymentStatus={detail.paymentStatus}
            expiresAt={detail.expiresAt}
            rejectionReason={detail.rejectionReason}
            embedded
          />
        )}
      </PublicPage>
    )
  }

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
            Podrás indicar destinatario, dirección, región y comuna al comprar.
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
