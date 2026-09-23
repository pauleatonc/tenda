import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { EmptyState, Modal, StatusChip, Timeline } from '../components/ui'
import { TendaApiError, newIdempotencyKey } from '../lib/http'
import { generateShipmentLabel } from '../shipping/api'
import {
  cancelOrder,
  confirmManualPayment,
  fetchOrder,
  refundPayment,
  reissueBankTransferOffer,
  restoreOrder,
  reviewPaymentProof,
  salesKeys,
  sendOfferLink,
  type SellerOrder,
} from './api'
import { SaleContactCards } from './SaleContactCards'
import {
  formatClp,
  formatDate,
  orderStatusLabels,
  paymentMethodLabels,
  paymentStatusLabels,
  statusTone,
  translated,
} from './model'

type ActionKind =
  | 'approve'
  | 'reject'
  | 'manual'
  | 'cancel'
  | 'restore'
  | 'refund'
  | 'resend'
  | 'reissue'

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
  | { kind: 'restore'; idempotencyKey: string }
  | { kind: 'refund'; reason: string; idempotencyKey: string }
  | { kind: 'resend'; email: string; idempotencyKey: string }
  | { kind: 'reissue'; idempotencyKey: string }

const actionTitles: Record<ActionKind, string> = {
  approve: 'Validar comprobante',
  reject: 'Rechazar comprobante',
  manual: 'Registrar pago manual',
  cancel: 'Cancelar venta',
  restore: 'Restaurar venta',
  refund: 'Reembolsar pago completo',
  resend: 'Reenviar enlace',
  reissue: 'Enviar de nuevo',
}

function isValidEmail(value: string) {
  const email = value.trim()
  return Boolean(email) && email.includes('@') && !email.includes(' ')
}

export function SaleDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [action, setAction] = useState<ActionKind | null>(null)
  const [reason, setReason] = useState('')
  const [amount, setAmount] = useState('')
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 16))
  const [note, setNote] = useState('')
  const [email, setEmail] = useState('')
  const [actionError, setActionError] = useState<Error | null>(null)
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey)
  const [resentUrl, setResentUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [labelOpen, setLabelOpen] = useState(false)
  const [previewLabel, setPreviewLabel] = useState<SellerOrder['latestLabel']>(null)
  const [labelKey, setLabelKey] = useState(newIdempotencyKey)

  const order = useQuery({
    queryKey: salesKeys.order(id),
    queryFn: () => fetchOrder(id),
    enabled: Boolean(id),
  })

  const generateLabel = useMutation({
    mutationFn: () =>
      generateShipmentLabel({
        shipmentId: order.data?.shipmentId ?? '',
        idempotencyKey: labelKey,
      }),
    onSuccess: (result) => {
      const nextLabel = result.label ?? result.shipment.latestLabel
      setPreviewLabel(nextLabel)
      setLabelOpen(true)
      setLabelKey(newIdempotencyKey())
      setActionError(null)
      if (order.data) {
        queryClient.setQueryData(salesKeys.order(id), {
          ...order.data,
          latestLabel: nextLabel,
        })
      }
      void queryClient.invalidateQueries({ queryKey: salesKeys.order(id) })
    },
    onError: (error: Error) => setActionError(error),
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
        case 'restore':
          return restoreOrder({
            orderId: id,
            idempotencyKey: request.idempotencyKey,
          })
        case 'refund':
          return refundPayment({
            orderId: id,
            reason: request.reason,
            idempotencyKey: request.idempotencyKey,
          })
        case 'resend':
          return sendOfferLink({
            orderId: id,
            email: request.email,
            idempotencyKey: request.idempotencyKey,
          })
        case 'reissue':
          return reissueBankTransferOffer({
            orderId: id,
            idempotencyKey: request.idempotencyKey,
          })
      }
    },
    onSuccess: (result, request) => {
      if (
        (request.kind === 'resend' || request.kind === 'reissue') &&
        'publicUrl' in result
      ) {
        setResentUrl(String(result.publicUrl))
        setCopied(false)
      }
      if (request.kind === 'reissue' && 'order' in result) {
        navigate(`/app/ventas/${result.order.id}`)
      }
      setAction(null)
      setReason('')
      setNote('')
      setActionError(null)
      setIdempotencyKey(newIdempotencyKey())
      void queryClient.invalidateQueries({ queryKey: ['sales'] })
      void queryClient.invalidateQueries({ queryKey: ['inventory'] })
    },
    onError: (error: Error, request) => {
      setActionError(error)
      if (request.kind === 'resend') setIdempotencyKey(newIdempotencyKey())
    },
  })

  const closeActionModal = useCallback(() => {
    if (!performAction.isPending) setAction(null)
  }, [performAction.isPending])

  function openAction(next: ActionKind) {
    setAction(next)
    setActionError(null)
    setReason('')
    setNote('')
    setCopied(false)
    setEmail(order.data?.buyer?.email ?? '')
    if (next === 'manual' && order.data) setAmount(order.data.total)
  }

  function submitAction() {
    if (!action) return
    if (['reject', 'cancel', 'refund'].includes(action) && !reason.trim()) return
    if (action === 'resend') {
      if (!isValidEmail(email)) return
      performAction.mutate({
        kind: 'resend',
        email: email.trim(),
        idempotencyKey,
      })
      return
    }
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
    if (action === 'reissue' || action === 'restore') {
      performAction.mutate({ kind: action, idempotencyKey })
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
  const canSendLink = guards.resendLink || guards.sendOfferLink
  const canViewLabel = guards.viewShipmentLabel || Boolean(detail.latestLabel)
  const savedLabel = previewLabel ?? detail.latestLabel

  function openLabel() {
    setActionError(null)
    if (detail.latestLabel?.downloadUrl) {
      setPreviewLabel(detail.latestLabel)
      setLabelOpen(true)
      return
    }
    if (detail.shipmentId) {
      generateLabel.mutate()
    }
  }

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
          <strong>Enlace enviado</strong>
          <span>Lo enviamos al correo indicado. También puedes copiarlo.</span>
          <label className="field">
            <span>Enlace público</span>
            <input readOnly value={resentUrl} aria-label="Enlace público" />
          </label>
          <button
            className="button button--secondary"
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(resentUrl).then(() => setCopied(true))
            }}
          >
            {copied ? 'Copiado' : 'Copiar enlace'}
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
            Validar
          </button>
        ) : null}
        {guards.rejectProof && detail.paymentMethod !== 'bank_transfer' ? (
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
        {guards.restore ? (
          <button
            className="button button--primary"
            type="button"
            disabled={performAction.isPending}
            onClick={() => openAction('restore')}
          >
            Restaurar venta
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
        {canSendLink ? (
          <button
            className="button button--secondary"
            type="button"
            disabled={performAction.isPending}
            onClick={() => openAction('resend')}
          >
            Reenviar enlace
          </button>
        ) : null}
        {guards.reissueOffer ? (
          <button
            className="button button--secondary"
            type="button"
            disabled={performAction.isPending}
            onClick={() => openAction('reissue')}
          >
            Enviar de nuevo
          </button>
        ) : null}
        {canViewLabel ? (
          <button
            className="button button--secondary"
            type="button"
            disabled={generateLabel.isPending}
            onClick={openLabel}
          >
            {generateLabel.isPending ? 'Generando…' : 'Ver etiqueta'}
          </button>
        ) : null}
        {!Object.values(guards).some(Boolean) && !canViewLabel ? (
          <p>No hay acciones disponibles para el estado actual.</p>
        ) : null}
      </section>

      <div className="sale-detail-grid">
        <SaleContactCards order={detail} />

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
            <h2>Comprobante de pago</h2>
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
              ? 'Validar confirma el pago y convierte la reserva en salida de stock una sola vez.'
              : action === 'refund'
                ? 'El MVP realiza un reembolso completo. No repone stock automáticamente.'
                : action === 'resend'
                  ? buyer?.email
                    ? 'Revisa el correo. Si lo anotaste mal, corrígelo antes de enviar el enlace.'
                    : 'Ingresa el correo del comprador para enviarle el enlace.'
                  : action === 'reissue'
                    ? 'Se cancela esta venta, se suelta el stock y se crea un enlace nuevo.'
                    : action === 'restore'
                      ? 'Se vuelve a reservar el stock y el enlace público queda activo.'
                      : undefined
          }
          onClose={closeActionModal}
          footer={
            <>
              <button
                className="button button--secondary"
                type="button"
                disabled={performAction.isPending}
                onClick={closeActionModal}
              >
                Volver
              </button>
              <button
                className="button button--primary"
                type="button"
                disabled={
                  performAction.isPending ||
                  (['reject', 'cancel', 'refund'].includes(action) && !reason.trim()) ||
                  (action === 'resend' && !isValidEmail(email)) ||
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

          {action === 'resend' ? (
            <>
              {detail.publicUrl || resentUrl ? (
                <div className="generate-sale-ready">
                  <label className="field">
                    <span>Enlace público</span>
                    <input
                      readOnly
                      value={resentUrl || detail.publicUrl}
                      aria-label="Enlace público"
                    />
                  </label>
                  <button
                    className="button button--secondary"
                    type="button"
                    onClick={() => {
                      const url = resentUrl || detail.publicUrl
                      void navigator.clipboard.writeText(url).then(() => setCopied(true))
                    }}
                  >
                    {copied ? 'Copiado' : 'Copiar enlace'}
                  </button>
                </div>
              ) : null}
              <div className="field">
                <label htmlFor="sale-resend-email">Correo del comprador</label>
                <input
                  id="sale-resend-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  placeholder="correo@ejemplo.cl"
                  onChange={(event) => setEmail(event.target.value)}
                />
                {!isValidEmail(email) ? (
                  <small className="field__hint">Ingresa un correo válido.</small>
                ) : null}
              </div>
            </>
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

      {labelOpen ? (
        <Modal
          title="Etiqueta interna Tenda"
          description="Este documento no es una etiqueta de transportista."
          size="large"
          onClose={() => setLabelOpen(false)}
          footer={
            <>
              <button
                className="button button--secondary"
                type="button"
                onClick={() => setLabelOpen(false)}
              >
                Cerrar
              </button>
              {savedLabel?.downloadUrl ? (
                <a
                  className="button button--primary"
                  href={savedLabel.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Descargar PDF
                </a>
              ) : detail.shipmentId ? (
                <button
                  className="button button--primary"
                  type="button"
                  disabled={generateLabel.isPending}
                  onClick={() => generateLabel.mutate()}
                >
                  {generateLabel.isPending ? 'Generando…' : 'Generar de nuevo'}
                </button>
              ) : null}
            </>
          }
        >
          <p className="shipping-warning">
            <strong>Etiqueta interna Tenda</strong>
            No simula un documento del transportista. El enlace de descarga expira.
          </p>
          {savedLabel?.downloadUrl ? (
            <>
              <iframe
                className="shipping-label-preview"
                title="Vista previa de la etiqueta interna"
                src={savedLabel.downloadUrl}
              />
              <p className="shipping-label-meta">
                Caduca {formatDate(savedLabel.expiresAt)} · {savedLabel.fileName}
              </p>
            </>
          ) : (
            <p>El enlace de esta etiqueta ya expiró. Genera una nueva para descargarla.</p>
          )}
        </Modal>
      ) : null}
    </>
  )
}
