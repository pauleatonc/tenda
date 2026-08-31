import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { EmptyState, Modal, StatusChip, Timeline } from '../components/ui'
import { TendaApiError, newIdempotencyKey } from '../lib/http'
import {
  cancelOrder,
  confirmManualPayment,
  fetchOrder,
  refundPayment,
  resendOrderLink,
  reviewPaymentProof,
  salesKeys,
  type SellerOrder,
} from './api'
import {
  deliveryModeLabels,
  formatClp,
  formatDate,
  orderStatusLabels,
  paymentMethodLabels,
  paymentStatusLabels,
  statusTone,
  translated,
} from './model'

type ActionKind = 'approve' | 'reject' | 'manual' | 'cancel' | 'refund' | 'resend'

type ActionRequest =
  | { kind: 'approve'; reason: string; idempotencyKey: string }
  | { kind: 'reject'; reason: string; idempotencyKey: string }
  | {
      kind: 'manual'
      amount: string
      paidAt: string
      note: string
      idempotencyKey: string
    }
  | { kind: 'cancel'; reason: string; idempotencyKey: string }
  | { kind: 'refund'; reason: string; idempotencyKey: string }
  | { kind: 'resend'; idempotencyKey: string }

const actionTitles: Record<ActionKind, string> = {
  approve: 'Aprobar comprobante',
  reject: 'Rechazar comprobante',
  manual: 'Registrar pago manual',
  cancel: 'Cancelar venta',
  refund: 'Reembolsar pago completo',
  resend: 'Obtener enlace para reenviar',
}

export function SaleDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [action, setAction] = useState<ActionKind | null>(null)
  const [reason, setReason] = useState('')
  const [amount, setAmount] = useState('')
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 16))
  const [note, setNote] = useState('')
  const [actionError, setActionError] = useState<Error | null>(null)
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey)
  const [resentUrl, setResentUrl] = useState('')

  const order = useQuery({
    queryKey: salesKeys.order(id),
    queryFn: () => fetchOrder(id),
    enabled: Boolean(id),
  })

  const performAction = useMutation({
    mutationFn: async (request: ActionRequest) => {
      switch (request.kind) {
        case 'approve':
        case 'reject':
          return reviewPaymentProof({
            orderId: id,
            decision: request.kind,
            reason: request.reason || null,
            idempotencyKey: request.idempotencyKey,
          })
        case 'manual':
          return confirmManualPayment({
            orderId: id,
            amount: request.amount,
            paidAt: new Date(request.paidAt).toISOString(),
            note: request.note || null,
            idempotencyKey: request.idempotencyKey,
          })
        case 'cancel':
          return cancelOrder({
            orderId: id,
            reason: request.reason,
            idempotencyKey: request.idempotencyKey,
          })
        case 'refund':
          return refundPayment({
            orderId: id,
            reason: request.reason,
            idempotencyKey: request.idempotencyKey,
          })
        case 'resend':
          return resendOrderLink({
            orderId: id,
            idempotencyKey: request.idempotencyKey,
          })
      }
    },
    onSuccess: (result, request) => {
      if (request.kind === 'resend' && 'publicUrl' in result) {
        setResentUrl(String(result.publicUrl))
      }
      setAction(null)
      setReason('')
      setNote('')
      setActionError(null)
      setIdempotencyKey(newIdempotencyKey())
      void queryClient.invalidateQueries({ queryKey: ['sales'] })
      void queryClient.invalidateQueries({ queryKey: ['inventory'] })
    },
    onError: (error: Error) => setActionError(error),
  })

  function openAction(next: ActionKind) {
    setAction(next)
    setActionError(null)
    setReason('')
    setNote('')
    if (next === 'manual' && order.data) setAmount(order.data.total)
  }

  function submitAction() {
    if (!action) return
    if (['reject', 'cancel', 'refund'].includes(action) && !reason.trim()) return
    if (action === 'manual') {
      const numericAmount = Number(amount)
      if (!Number.isInteger(numericAmount) || numericAmount < 0 || !paidAt) return
      performAction.mutate({
        kind: 'manual',
        amount: String(numericAmount),
        paidAt,
        note: note.trim(),
        idempotencyKey,
      })
      return
    }
    if (action === 'resend') {
      performAction.mutate({ kind: 'resend', idempotencyKey })
      return
    }
    performAction.mutate({
      kind: action,
      reason: reason.trim(),
      idempotencyKey,
    })
  }

  if (order.isPending) {
    return (
      <div className="detail-skeleton" aria-live="polite" aria-busy="true">
        <span className="sr-only">Cargando detalle de venta…</span>
        <div />
        <div />
        <div />
      </div>
    )
  }

  if (order.isError) {
    return (
      <>
        <header className="page-heading">
          <div>
            <p className="eyebrow">Venta</p>
            <h1>No pudimos cargar la venta</h1>
          </div>
        </header>
        <div className="form-message form-message--error" role="alert">
          <span>
            {order.error instanceof TendaApiError
              ? order.error.message
              : 'Revisa tu conexión e inténtalo nuevamente.'}
          </span>
          <button
            className="button button--secondary"
            type="button"
            onClick={() => void order.refetch()}
          >
            Reintentar
          </button>
        </div>
      </>
    )
  }

  if (!order.data) {
    return (
      <EmptyState
        title="Venta no encontrada"
        description="La venta no existe o no pertenece a tu Tienda."
        action={
          <Link className="button button--secondary" to="/app/ventas">
            Volver a ventas
          </Link>
        }
      />
    )
  }

  const detail = order.data
  const buyer = detail.buyer
  const payment = detail.payment
  const guards = detail.allowedActions

  return (
    <>
      <header className="page-heading page-heading--split">
        <div>
          <p className="eyebrow">Venta {detail.number}</p>
          <h1>{translated(orderStatusLabels, detail.status)}</h1>
          <p>
            Creada {formatDate(detail.createdAt)} · Total {formatClp(detail.total)}
          </p>
        </div>
        <div className="page-heading__actions">
          <StatusChip
            status={statusTone(detail.status)}
            label={translated(orderStatusLabels, detail.status)}
          />
          <Link className="button button--secondary" to="/app/ventas">
            Volver
          </Link>
        </div>
      </header>

      {detail.reconciliationRequired ? (
        <div className="sales-notice sales-notice--warning" role="alert">
          <strong>Esta venta requiere conciliación</strong>
          <span>
            {detail.reconciliationMessage ||
              'Existe una diferencia entre el pago y el movimiento operacional.'}
          </span>
          <Link to="/app/ventas/reconciliaciones">Abrir cola de conciliación</Link>
        </div>
      ) : null}

      {resentUrl ? (
        <div className="form-message form-message--success" role="status">
          <strong>Enlace listo para reenviar</strong>
          <span>Tenda no contactó automáticamente al comprador.</span>
          <button
            className="button button--secondary"
            type="button"
            onClick={() => void navigator.clipboard.writeText(resentUrl)}
          >
            Copiar enlace
          </button>
        </div>
      ) : null}

      <section className="sale-actions" aria-label="Acciones permitidas">
        {guards.approveProof ? (
          <button
            className="button button--primary"
            type="button"
            disabled={performAction.isPending}
            onClick={() => openAction('approve')}
          >
            Aprobar comprobante
          </button>
        ) : null}
        {guards.rejectProof ? (
          <button
            className="button button--secondary"
            type="button"
            disabled={performAction.isPending}
            onClick={() => openAction('reject')}
          >
            Rechazar comprobante
          </button>
        ) : null}
        {guards.confirmManualPayment ? (
          <button
            className="button button--primary"
            type="button"
            disabled={performAction.isPending}
            onClick={() => openAction('manual')}
          >
            Registrar pago manual
          </button>
        ) : null}
        {guards.cancel ? (
          <button
            className="button button--secondary"
            type="button"
            disabled={performAction.isPending}
            onClick={() => openAction('cancel')}
          >
            Cancelar venta
          </button>
        ) : null}
        {guards.refund ? (
          <button
            className="button button--secondary"
            type="button"
            disabled={performAction.isPending}
            onClick={() => openAction('refund')}
          >
            Reembolso completo
          </button>
        ) : null}
        {guards.resendLink ? (
          <button
            className="button button--secondary"
            type="button"
            disabled={performAction.isPending}
            onClick={() => openAction('resend')}
          >
            Reenviar enlace
          </button>
        ) : null}
        {!Object.values(guards).some(Boolean) ? (
          <p>No hay acciones disponibles para el estado actual.</p>
        ) : null}
      </section>

      <div className="sale-detail-grid">
        <article className="detail-card">
          <h2>Comprador</h2>
          {buyer ? (
            <dl>
              <div>
                <dt>Nombre</dt>
                <dd>{buyer.fullName}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{buyer.email || '—'}</dd>
              </div>
              <div>
                <dt>Teléfono</dt>
                <dd>{buyer.phone || '—'}</dd>
              </div>
              {buyer.taxId ? (
                <>
                  <div>
                    <dt>RUT tributario</dt>
                    <dd>{buyer.taxId}</dd>
                  </div>
                  <div>
                    <dt>Razón social</dt>
                    <dd>{buyer.taxName || '—'}</dd>
                  </div>
                  <div>
                    <dt>Giro</dt>
                    <dd>{buyer.taxBusinessActivity || '—'}</dd>
                  </div>
                </>
              ) : null}
            </dl>
          ) : (
            <p className="detail-card__empty">El comprador aún no completa sus datos.</p>
          )}
        </article>

        <article className="detail-card">
          <h2>Entrega</h2>
          <dl>
            <div>
              <dt>Modalidad</dt>
              <dd>{translated(deliveryModeLabels, detail.deliveryMode)}</dd>
            </div>
            {buyer?.recipientName ? (
              <div>
                <dt>Recibe</dt>
                <dd>{buyer.recipientName}</dd>
              </div>
            ) : null}
            {buyer?.deliveryAddress ? (
              <div>
                <dt>Dirección</dt>
                <dd>
                  {[buyer.deliveryAddress, buyer.deliveryCommune, buyer.deliveryCity]
                    .filter(Boolean)
                    .join(', ')}
                </dd>
              </div>
            ) : null}
            <div>
              <dt>Reserva hasta</dt>
              <dd>{formatDate(detail.expiresAt)}</dd>
            </div>
          </dl>
        </article>

        <article className="detail-card">
          <h2>Pago</h2>
          <dl>
            <div>
              <dt>Método</dt>
              <dd>{translated(paymentMethodLabels, detail.paymentMethod)}</dd>
            </div>
            <div>
              <dt>Estado</dt>
              <dd>
                {payment
                  ? translated(paymentStatusLabels, payment.status)
                  : 'Aún sin pago'}
              </dd>
            </div>
            <div>
              <dt>Monto</dt>
              <dd>{formatClp(payment?.amount)}</dd>
            </div>
            {payment?.feeAmount ? (
              <div>
                <dt>Comisión</dt>
                <dd>{formatClp(payment.feeAmount)}</dd>
              </div>
            ) : null}
            {payment?.refundedAmount ? (
              <div>
                <dt>Reembolsado</dt>
                <dd>{formatClp(payment.refundedAmount)}</dd>
              </div>
            ) : null}
          </dl>
        </article>

        {payment?.proof ? (
          <article className="detail-card payment-proof">
            <h2>Comprobante privado</h2>
            {payment.proof.contentType.startsWith('image/') ? (
              <img
                src={payment.proof.privatePreviewUrl}
                alt={`Comprobante ${payment.proof.fileName}`}
              />
            ) : null}
            <p>{payment.proof.fileName}</p>
            <time>{formatDate(payment.proof.uploadedAt)}</time>
            <a
              className="button button--secondary"
              href={payment.proof.privatePreviewUrl}
              target="_blank"
              rel="noreferrer"
            >
              Abrir vista segura
            </a>
          </article>
        ) : null}
      </div>

      <section className="detail-section">
        <h2>Productos y precios efectivos</h2>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Producto</th>
                <th scope="col">Cantidad</th>
                <th scope="col">Precio unitario</th>
                <th scope="col">Total</th>
                {detail.costsVisible ? <th scope="col">Costo snapshot</th> : null}
              </tr>
            </thead>
            <tbody>
              {detail.lines.map((line: SellerOrder['lines'][number]) => (
                <tr key={line.id}>
                  <td>{line.productName}</td>
                  <td>{line.quantity}</td>
                  <td>{formatClp(line.unitSalePrice)}</td>
                  <td>{formatClp(line.lineTotal)}</td>
                  {detail.costsVisible ? (
                    <td>
                      {line.unitCostSnapshot === null
                        ? 'Sin costo conocido'
                        : formatClp(line.unitCostSnapshot)}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan={detail.costsVisible ? 4 : 3} scope="row">
                  Total
                </th>
                <td>{formatClp(detail.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="detail-section">
        <h2>Línea de tiempo</h2>
        <Timeline
          items={detail.timeline.map((event: SellerOrder['timeline'][number]) => ({
            id: event.id,
            title: event.title,
            detail: [event.detail, event.actorName].filter(Boolean).join(' · '),
            date: formatDate(event.createdAt),
            status: event.eventType,
          }))}
        />
      </section>

      {action ? (
        <Modal
          title={actionTitles[action]}
          description={
            action === 'approve'
              ? 'Aprobar confirma el pago y convierte la reserva en salida de stock una sola vez.'
              : action === 'refund'
                ? 'El MVP realiza un reembolso completo. No repone stock automáticamente.'
                : action === 'resend'
                  ? 'Tenda preparará el enlace, pero no enviará un mensaje automáticamente.'
                  : undefined
          }
          onClose={() => {
            if (!performAction.isPending) setAction(null)
          }}
          footer={
            <>
              <button
                className="button button--secondary"
                type="button"
                disabled={performAction.isPending}
                onClick={() => setAction(null)}
              >
                Volver
              </button>
              <button
                className="button button--primary"
                type="button"
                disabled={
                  performAction.isPending ||
                  (['reject', 'cancel', 'refund'].includes(action) && !reason.trim()) ||
                  (action === 'manual' &&
                    (!amount ||
                      !paidAt ||
                      !Number.isInteger(Number(amount)) ||
                      Number(amount) < 0))
                }
                onClick={submitAction}
              >
                {performAction.isPending ? 'Procesando…' : 'Confirmar'}
              </button>
            </>
          }
        >
          {actionError ? (
            <div className="form-message form-message--error" role="alert">
              <span>
                {actionError instanceof TendaApiError
                  ? actionError.message
                  : 'No pudimos completar la acción. Inténtalo nuevamente.'}
              </span>
            </div>
          ) : null}

          {['reject', 'cancel', 'refund'].includes(action) ? (
            <div className="field">
              <label htmlFor="sale-action-reason">
                Motivo {action === 'reject' ? 'del rechazo' : ''}
              </label>
              <textarea
                id="sale-action-reason"
                required
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
              {!reason.trim() ? (
                <small className="field__hint">El motivo es obligatorio.</small>
              ) : null}
            </div>
          ) : null}

          {action === 'manual' ? (
            <>
              <div className="field">
                <label htmlFor="manual-amount">Monto recibido (CLP)</label>
                <input
                  id="manual-amount"
                  inputMode="numeric"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="manual-date">Fecha y hora del pago</label>
                <input
                  id="manual-date"
                  type="datetime-local"
                  value={paidAt}
                  onChange={(event) => setPaidAt(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="manual-note">Nota (opcional)</label>
                <textarea
                  id="manual-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </div>
            </>
          ) : null}
        </Modal>
      ) : null}
    </>
  )
}
