import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { TendaApiError, newIdempotencyKey } from '../lib/http'
import {
  confirmPublicShipment,
  fetchPublicShipment,
  shippingKeys,
} from '../shipping/api'
import { TurnstileField } from '../components/TurnstileField'
import { PublicPage, PublicShipmentUnavailable } from './PublicOrderComponents'
import { PublicShipmentSummary } from './PublicShipmentPage'

export function PublicShipmentConfirmPage() {
  const { token = '' } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [choice, setChoice] = useState<'received' | 'needs_help' | null>(null)
  const [turnstileToken, setTurnstileToken] = useState('')
  const [confirmKey] = useState(newIdempotencyKey)
  const [actionError, setActionError] = useState<Error | null>(null)

  const shipment = useQuery({
    queryKey: shippingKeys.publicShipment(token),
    queryFn: () => fetchPublicShipment(token),
    enabled: Boolean(token),
    retry: 1,
  })

  const confirm = useMutation({
    mutationFn: (outcome: 'received' | 'needs_help') =>
      confirmPublicShipment({
        token,
        outcome,
        turnstileToken: turnstileToken || 'local-development',
        idempotencyKey: confirmKey,
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: shippingKeys.publicShipment(token) })
      setActionError(null)
      if (result.nextAction === 'open_ticket' || result.outcome === 'needs_help') {
        void navigate(`/s/${token}/consulta`)
        return
      }
      void navigate(`/s/${token}`)
    },
    onError: (error: Error) => setActionError(error),
  })

  if (shipment.isPending) {
    return (
      <PublicPage>
        <div className="public-skeleton" aria-live="polite" aria-busy="true">
          <span className="sr-only">Cargando confirmación…</span>
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
  if (!detail.canConfirm) {
    return (
      <PublicPage seller={detail.seller}>
        <section className="public-order-intro">
          <p className="eyebrow">Confirmación de recepción</p>
          <h1>
            {detail.confirmation?.outcome === 'received'
              ? 'Ya confirmaste que lo recibiste'
              : detail.publicStatus === 'needs_help'
                ? 'Ya registramos que necesitas ayuda'
                : 'Todavía no puedes confirmar este envío'}
          </h1>
          <p>El estado público actual es {detail.publicStatusLabel}.</p>
        </section>
        <div className="public-primary-action">
          <Link className="button button--primary" to={`/s/${token}`}>
            Volver al seguimiento
          </Link>
          {detail.publicStatus === 'needs_help' ? (
            <Link className="button button--secondary" to={`/s/${token}/consulta`}>
              Ver ayuda
            </Link>
          ) : null}
        </div>
      </PublicPage>
    )
  }

  return (
    <PublicPage seller={detail.seller}>
      <section className="public-order-intro">
        <p className="eyebrow">Confirmación de recepción</p>
        <h1>¿Recibiste tu pedido?</h1>
        <p>
          Confirma solo si el paquete ya llegó. Si algo no está bien, indícalo y el
          vendedor verá que necesitas ayuda. No se abre una incidencia automática.
        </p>
      </section>

      <TurnstileField onToken={setTurnstileToken} />

      <div className="public-confirm-choices">
        <button
          className="button button--primary"
          type="button"
          disabled={confirm.isPending}
          onClick={() => setChoice('received')}
        >
          Sí, lo recibí
        </button>
        <button
          className="button button--secondary"
          type="button"
          disabled={confirm.isPending}
          onClick={() => confirm.mutate('needs_help')}
        >
          No, necesito ayuda
        </button>
      </div>

      {choice === 'received' ? (
        <section className="public-delivery-card">
          <h2>Revisa el resumen antes de confirmar</h2>
          <PublicShipmentSummary shipment={detail} />
          <p>
            Al confirmar, el envío pasará a Recibido y dejará de aparecer en las
            operaciones activas del vendedor.
          </p>
          {actionError ? (
            <div className="form-message form-message--error" role="alert">
              <strong>No pudimos registrar la confirmación</strong>
              <span>
                {actionError instanceof TendaApiError
                  ? actionError.message
                  : 'Inténtalo nuevamente.'}
              </span>
            </div>
          ) : null}
          <div className="public-primary-action">
            <button
              className="button button--primary"
              type="button"
              disabled={confirm.isPending}
              onClick={() => confirm.mutate('received')}
            >
              {confirm.isPending ? 'Confirmando…' : 'Confirmar recepción'}
            </button>
            <button
              className="button button--secondary"
              type="button"
              disabled={confirm.isPending}
              onClick={() => setChoice(null)}
            >
              Volver
            </button>
          </div>
        </section>
      ) : actionError ? (
        <div className="form-message form-message--error" role="alert">
          <strong>No pudimos registrar la respuesta</strong>
          <span>
            {actionError instanceof TendaApiError
              ? actionError.message
              : 'Inténtalo nuevamente.'}
          </span>
        </div>
      ) : null}

      <p>
        <Link to={`/s/${token}`}>Volver al seguimiento</Link>
      </p>
    </PublicPage>
  )
}
