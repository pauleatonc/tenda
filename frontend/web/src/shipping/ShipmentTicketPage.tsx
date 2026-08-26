import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { EmptyState, StatusChip } from '../components/ui'
import { TendaApiError, newIdempotencyKey } from '../lib/http'
import {
  fetchTicket,
  resolveTicket,
  sendTicketMessage,
  shippingKeys,
  type SellerTicket,
} from './api'
import { formatDate, ticketCategoryLabels, ticketStatusLabels, translated } from './model'
import { TicketThread } from './TicketThread'

function ticketTone(status: string): string {
  if (status === 'resolved' || status === 'closed') return 'success'
  if (status === 'awaiting_seller' || status === 'open') return 'warning'
  return 'neutral'
}

export function ShipmentTicketPage() {
  const { id = '', ticketId = '' } = useParams<{ id: string; ticketId: string }>()
  const queryClient = useQueryClient()
  const [body, setBody] = useState('')
  const [replyKey, setReplyKey] = useState(newIdempotencyKey)
  const [resolveKey, setResolveKey] = useState(newIdempotencyKey)
  const [actionError, setActionError] = useState<Error | null>(null)

  const ticket = useQuery({
    queryKey: shippingKeys.ticket(ticketId),
    queryFn: () => fetchTicket(ticketId),
    enabled: Boolean(ticketId),
  })

  const reply = useMutation({
    mutationFn: () =>
      sendTicketMessage({
        ticketId,
        body,
        idempotencyKey: replyKey,
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(shippingKeys.ticket(ticketId), result.ticket)
      void queryClient.invalidateQueries({ queryKey: shippingKeys.shipment(id) })
      setBody('')
      setReplyKey(newIdempotencyKey())
      setActionError(null)
    },
    onError: (error: Error) => setActionError(error),
  })

  const resolve = useMutation({
    mutationFn: () =>
      resolveTicket({
        ticketId,
        comment: body || null,
        idempotencyKey: resolveKey,
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(shippingKeys.ticket(ticketId), result.ticket)
      void queryClient.invalidateQueries({ queryKey: shippingKeys.shipment(id) })
      setBody('')
      setResolveKey(newIdempotencyKey())
      setActionError(null)
    },
    onError: (error: Error) => setActionError(error),
  })

  if (ticket.isError) {
    return (
      <div className="form-message form-message--error" role="alert">
        <strong>No pudimos cargar la consulta</strong>
        <span>
          {ticket.error instanceof TendaApiError
            ? ticket.error.message
            : 'Revisa tu conexión e inténtalo nuevamente.'}
        </span>
        <button
          className="button button--secondary"
          type="button"
          onClick={() => void ticket.refetch()}
        >
          Reintentar
        </button>
      </div>
    )
  }

  if (ticket.isPending) {
    return (
      <div className="detail-skeleton" aria-busy="true">
        <span className="sr-only">Cargando consulta…</span>
        <div />
        <div />
      </div>
    )
  }

  if (!ticket.data) {
    return (
      <EmptyState
        title="Consulta no encontrada"
        description="El ticket no existe o no pertenece a tu organización."
        action={
          <Link className="button button--secondary" to={`/app/despachos/${id}`}>
            Volver al despacho
          </Link>
        }
      />
    )
  }

  const detail: SellerTicket = ticket.data
  const open = ['open', 'awaiting_seller', 'awaiting_buyer'].includes(detail.status)
  const busy = reply.isPending || resolve.isPending

  return (
    <>
      <header className="page-heading page-heading--split">
        <div>
          <p className="eyebrow">Consulta {detail.number}</p>
          <h1>{translated(ticketStatusLabels, detail.status)}</h1>
          <p>
            Envío {detail.shipment.number} · Venta {detail.shipment.orderNumber} ·{' '}
            {translated(ticketCategoryLabels, detail.category)}
          </p>
        </div>
        <div className="page-heading__actions">
          <StatusChip
            status={ticketTone(detail.status)}
            label={translated(ticketStatusLabels, detail.status)}
          />
          <Link className="button button--secondary" to={`/app/despachos/${id}`}>
            Volver al despacho
          </Link>
        </div>
      </header>

      {actionError ? (
        <div className="form-message form-message--error" role="alert">
          <strong>No se pudo completar la acción</strong>
          <span>
            {actionError instanceof TendaApiError
              ? actionError.message
              : 'Inténtalo nuevamente.'}
          </span>
        </div>
      ) : null}

      <article className="detail-card">
        <h2>Contexto</h2>
        <dl>
          <div>
            <dt>Contacto</dt>
            <dd>{detail.contactName || '—'}</dd>
          </div>
          <div>
            <dt>Correo</dt>
            <dd>{detail.contactEmail || '—'}</dd>
          </div>
          <div>
            <dt>Teléfono</dt>
            <dd>{detail.contactPhone || '—'}</dd>
          </div>
          {detail.resolvedAt ? (
            <div>
              <dt>Resuelta</dt>
              <dd>{formatDate(detail.resolvedAt)}</dd>
            </div>
          ) : null}
        </dl>
      </article>

      <section className="detail-section">
        <h2>Conversación</h2>
        <TicketThread ticket={detail} perspective="seller" />
      </section>

      {open ? (
        <form
          className="shipping-form"
          onSubmit={(event) => {
            event.preventDefault()
            if (!busy) reply.mutate()
          }}
        >
          <label>
            <span>Respuesta al comprador</span>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              minLength={10}
              required
            />
          </label>
          <div className="shipping-form__actions">
            <button className="button button--primary" type="submit" disabled={busy}>
              {reply.isPending ? 'Enviando…' : 'Enviar mensaje'}
            </button>
            <button
              className="button button--secondary"
              type="button"
              disabled={busy}
              onClick={() => resolve.mutate()}
            >
              {resolve.isPending ? 'Resolviendo…' : 'Marcar como resuelta'}
            </button>
          </div>
        </form>
      ) : (
        <p>Esta consulta ya quedó resuelta. El historial se conserva.</p>
      )}
    </>
  )
}
