import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { TendaApiError, newIdempotencyKey } from '../lib/http'
import {
  fetchPublicShipment,
  openPublicTicket,
  sendTicketMessage,
  shippingKeys,
} from '../shipping/api'
import { ticketCategoryLabels, translated } from '../shipping/model'
import { TicketThread } from '../shipping/TicketThread'
import { PublicPage, PublicShipmentUnavailable } from './PublicOrderComponents'
import { TurnstileField } from './PublicShipmentConfirmPage'

const CATEGORIES = ['not_received', 'damaged', 'wrong_item', 'other'] as const

export function PublicShipmentHelpPage() {
  const { token = '' } = useParams<{ token: string }>()
  const queryClient = useQueryClient()
  const [category, setCategory] = useState('other')
  const [message, setMessage] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [openKey] = useState(newIdempotencyKey)
  const [replyKey, setReplyKey] = useState(newIdempotencyKey)
  const [actionError, setActionError] = useState<Error | null>(null)

  const shipment = useQuery({
    queryKey: shippingKeys.publicShipment(token),
    queryFn: () => fetchPublicShipment(token),
    enabled: Boolean(token),
    retry: 1,
  })

  useEffect(() => {
    if (!shipment.data) return
    const ticket = shipment.data.ticket
    setContactName(ticket?.contactName || shipment.data.buyerContact.name)
    setContactEmail(ticket?.contactEmail || shipment.data.buyerContact.email)
    setContactPhone(ticket?.contactPhone || shipment.data.buyerContact.phone)
    if (ticket?.category) setCategory(ticket.category)
  }, [shipment.data])

  const openTicket = useMutation({
    mutationFn: () =>
      openPublicTicket({
        token,
        category,
        message,
        contactName,
        contactEmail,
        contactPhone,
        turnstileToken: turnstileToken || 'local-development',
        idempotencyKey: openKey,
      }),
    onSuccess: () => {
      setMessage('')
      setActionError(null)
      void queryClient.invalidateQueries({ queryKey: shippingKeys.publicShipment(token) })
    },
    onError: (error: Error) => setActionError(error),
  })

  const reply = useMutation({
    mutationFn: (ticketId: string) =>
      sendTicketMessage({
        ticketId,
        body: message,
        token,
        turnstileToken: turnstileToken || 'local-development',
        idempotencyKey: replyKey,
      }),
    onSuccess: () => {
      setMessage('')
      setReplyKey(newIdempotencyKey())
      setActionError(null)
      void queryClient.invalidateQueries({ queryKey: shippingKeys.publicShipment(token) })
    },
    onError: (error: Error) => setActionError(error),
  })

  if (shipment.isPending) {
    return (
      <PublicPage>
        <div className="public-skeleton" aria-live="polite" aria-busy="true">
          <span className="sr-only">Cargando consulta…</span>
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
  const ticket = detail.ticket
  const open = Boolean(
    ticket && ['open', 'awaiting_seller', 'awaiting_buyer'].includes(ticket.status),
  )
  const busy = openTicket.isPending || reply.isPending

  return (
    <PublicPage seller={detail.seller}>
      <section className="public-order-intro">
        <p className="eyebrow">Consulta {ticket?.number ?? detail.number}</p>
        <h1>
          {ticket ? 'Conversación con el vendedor' : '¿Necesitas ayuda con este pedido?'}
        </h1>
        <p>
          {ticket
            ? 'El historial se conserva. El correo solo avisa que hay un mensaje nuevo, sin copiar el contenido.'
            : 'Cuéntale al vendedor qué ocurrió. Esto abre una consulta del envío, no una incidencia automática.'}
        </p>
      </section>

      {ticket ? <TicketThread ticket={ticket} perspective="buyer" /> : null}

      {open || !ticket ? (
        <form
          className="shipping-form"
          onSubmit={(event) => {
            event.preventDefault()
            if (busy) return
            if (ticket && open) {
              reply.mutate(ticket.id)
              return
            }
            openTicket.mutate()
          }}
        >
          {!ticket ? (
            <>
              <label>
                <span>Qué ocurrió</span>
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                >
                  {CATEGORIES.map((value) => (
                    <option key={value} value={value}>
                      {translated(ticketCategoryLabels, value)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Nombre</span>
                <input
                  value={contactName}
                  onChange={(event) => setContactName(event.target.value)}
                  autoComplete="name"
                />
              </label>
              <label>
                <span>Correo</span>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </label>
              <label>
                <span>Teléfono</span>
                <input
                  value={contactPhone}
                  onChange={(event) => setContactPhone(event.target.value)}
                  autoComplete="tel"
                />
              </label>
            </>
          ) : null}
          <label>
            <span>{ticket ? 'Tu respuesta' : 'Mensaje'}</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              minLength={10}
              required
            />
          </label>
          <TurnstileField onToken={setTurnstileToken} />
          {actionError ? (
            <div className="form-message form-message--error" role="alert">
              <strong>No pudimos enviar la consulta</strong>
              <span>
                {actionError instanceof TendaApiError
                  ? actionError.message
                  : 'Inténtalo nuevamente.'}
              </span>
            </div>
          ) : null}
          <div className="shipping-form__actions">
            <button className="button button--primary" type="submit" disabled={busy}>
              {busy ? 'Enviando…' : ticket ? 'Enviar mensaje' : 'Abrir consulta'}
            </button>
            <Link className="button button--secondary" to={`/s/${token}`}>
              Volver al seguimiento
            </Link>
          </div>
        </form>
      ) : (
        <div className="public-primary-action">
          <p>Esta consulta ya no admite mensajes.</p>
          <Link className="button button--primary" to={`/s/${token}`}>
            Volver al seguimiento
          </Link>
        </div>
      )}
    </PublicPage>
  )
}
