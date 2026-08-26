import type { SellerTicket } from './api'
import { formatDate, translated } from './model'

const buyerLabels: Record<string, string> = {
  buyer: 'Tú',
  seller: 'Vendedor',
  system: 'Tenda',
}

const sellerLabels: Record<string, string> = {
  buyer: 'Comprador',
  seller: 'Tú',
  system: 'Tenda',
}

export function TicketThread({
  ticket,
  perspective,
}: {
  ticket: Pick<SellerTicket, 'messages'>
  perspective: 'buyer' | 'seller'
}) {
  const labels = perspective === 'buyer' ? buyerLabels : sellerLabels
  if (ticket.messages.length === 0) {
    return <p>Todavía no hay mensajes en esta consulta.</p>
  }
  return (
    <ol className="ticket-thread">
      {ticket.messages.map((item) => (
        <li
          key={item.id}
          className={`ticket-thread__item ticket-thread__item--${item.authorKind}`}
        >
          <header>
            <strong>{translated(labels, item.authorKind)}</strong>
            <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
          </header>
          <p>{item.body}</p>
        </li>
      ))}
    </ol>
  )
}
