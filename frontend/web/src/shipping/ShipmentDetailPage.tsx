import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { EmptyState, Modal, StatusChip, Timeline } from '../components/ui'
import { TendaApiError, newIdempotencyKey } from '../lib/http'
import {
  confirmReturnToStock,
  fetchShipment,
  generateShipmentLabel,
  markShipmentDispatched,
  registerReturnCase,
  rescheduleFollowUp,
  shippingKeys,
  updateShipment,
  type SellerShipment,
} from './api'
import {
  deliveryModeLabels,
  destinationLine,
  followUpKindLabels,
  formatDate,
  fromDateTimeLocal,
  returnCaseKindLabels,
  shipmentStatusLabels,
  statusTone,
  toDateTimeLocal,
  translated,
} from './model'

export function ShipmentDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [carrier, setCarrier] = useState('')
  const [trackingCode, setTrackingCode] = useState('')
  const [trackingUrl, setTrackingUrl] = useState('')
  const [comment, setComment] = useState('')
  const [internalNote, setInternalNote] = useState(false)
  const [copied, setCopied] = useState<'tracking' | 'public' | null>(null)
  const [externalOpen, setExternalOpen] = useState(false)
  const [dispatchOpen, setDispatchOpen] = useState(false)
  const [labelOpen, setLabelOpen] = useState(false)
  const [previewLabel, setPreviewLabel] = useState<SellerShipment['latestLabel']>(null)
  const [actionError, setActionError] = useState<Error | null>(null)
  const [updateKey, setUpdateKey] = useState(newIdempotencyKey)
  const [dispatchKey, setDispatchKey] = useState(newIdempotencyKey)
  const [labelKey, setLabelKey] = useState(newIdempotencyKey)
  const [dueAt, setDueAt] = useState('')
  const [rescheduleReason, setRescheduleReason] = useState('')
  const [rescheduleKey, setRescheduleKey] = useState(newIdempotencyKey)
  const [returnKind, setReturnKind] = useState('returned')
  const [returnNotes, setReturnNotes] = useState('')
  const [returnKey, setReturnKey] = useState(newIdempotencyKey)
  const [stockKey, setStockKey] = useState(newIdempotencyKey)

  const shipment = useQuery({
    queryKey: shippingKeys.shipment(id),
    queryFn: () => fetchShipment(id),
    enabled: Boolean(id),
  })

  useEffect(() => {
    if (!shipment.data) return
    setCarrier(shipment.data.carrier)
    setTrackingCode(shipment.data.trackingCode)
    setTrackingUrl(shipment.data.trackingUrl)
    if (shipment.data.nextFollowUp) {
      setDueAt(toDateTimeLocal(shipment.data.nextFollowUp.dueAt))
    }
  }, [shipment.data])

  const saveTracking = useMutation({
    mutationFn: () =>
      updateShipment({
        shipmentId: id,
        carrier,
        trackingCode,
        trackingUrl,
        comment: comment || null,
        internalNote,
        idempotencyKey: updateKey,
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(shippingKeys.shipment(id), result.shipment)
      void queryClient.invalidateQueries({ queryKey: shippingKeys.root })
      setComment('')
      setInternalNote(false)
      setUpdateKey(newIdempotencyKey())
      setActionError(null)
    },
    onError: (error: Error) => setActionError(error),
  })

  const dispatch = useMutation({
    mutationFn: () =>
      markShipmentDispatched({
        shipmentId: id,
        comment: comment || null,
        idempotencyKey: dispatchKey,
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(shippingKeys.shipment(id), result.shipment)
      void queryClient.invalidateQueries({ queryKey: shippingKeys.root })
      setDispatchOpen(false)
      setComment('')
      setDispatchKey(newIdempotencyKey())
      setActionError(null)
    },
    onError: (error: Error) => setActionError(error),
  })

  const generateLabel = useMutation({
    mutationFn: () =>
      generateShipmentLabel({
        shipmentId: id,
        idempotencyKey: labelKey,
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(shippingKeys.shipment(id), result.shipment)
      void queryClient.invalidateQueries({ queryKey: shippingKeys.root })
      setLabelKey(newIdempotencyKey())
      setPreviewLabel(result.shipment.latestLabel)
      setLabelOpen(true)
      setActionError(null)
    },
    onError: (error: Error) => setActionError(error),
  })

  const reschedule = useMutation({
    mutationFn: () =>
      rescheduleFollowUp({
        followUpId: shipment.data?.nextFollowUp?.id ?? '',
        dueAt: fromDateTimeLocal(dueAt),
        reason: rescheduleReason,
        idempotencyKey: rescheduleKey,
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(shippingKeys.shipment(id), result.shipment)
      void queryClient.invalidateQueries({ queryKey: shippingKeys.root })
      setRescheduleReason('')
      setRescheduleKey(newIdempotencyKey())
      setActionError(null)
    },
    onError: (error: Error) => setActionError(error),
  })

  const registerCase = useMutation({
    mutationFn: () =>
      registerReturnCase({
        shipmentId: id,
        kind: returnKind,
        notes: returnNotes || null,
        idempotencyKey: returnKey,
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(shippingKeys.shipment(id), result.shipment)
      void queryClient.invalidateQueries({ queryKey: shippingKeys.root })
      setReturnNotes('')
      setReturnKey(newIdempotencyKey())
      setActionError(null)
    },
    onError: (error: Error) => setActionError(error),
  })

  const confirmStock = useMutation({
    mutationFn: (returnCaseId: string) =>
      confirmReturnToStock({
        returnCaseId,
        idempotencyKey: stockKey,
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(shippingKeys.shipment(id), result.shipment)
      void queryClient.invalidateQueries({ queryKey: shippingKeys.root })
      setStockKey(newIdempotencyKey())
      setActionError(null)
    },
    onError: (error: Error) => setActionError(error),
  })

  async function copyValue(kind: 'tracking' | 'public', value: string) {
    await navigator.clipboard.writeText(value)
    setCopied(kind)
    window.setTimeout(() => setCopied(null), 2000)
  }

  if (shipment.isError) {
    return (
      <div className="form-message form-message--error" role="alert">
        <strong>No pudimos cargar el despacho</strong>
        <span>
          {shipment.error instanceof TendaApiError
            ? shipment.error.message
            : 'Revisa tu conexión e inténtalo nuevamente.'}
        </span>
        <button
          className="button button--secondary"
          type="button"
          onClick={() => void shipment.refetch()}
        >
          Reintentar
        </button>
      </div>
    )
  }

  if (shipment.isPending) {
    return (
      <div className="detail-skeleton" aria-busy="true">
        <span className="sr-only">Cargando despacho…</span>
        <div />
        <div />
      </div>
    )
  }

  if (!shipment.data) {
    return (
      <EmptyState
        title="Despacho no encontrado"
        description="El envío no existe o no pertenece a tu Tienda."
        action={
          <Link className="button button--secondary" to="/app/despachos">
            Volver a despachos
          </Link>
        }
      />
    )
  }

  const detail: SellerShipment = shipment.data
  const canUpdate = detail.allowedActions.updateShipment
  const canDispatch = detail.allowedActions.markShipmentDispatched
  const canGenerateLabel = detail.allowedActions.generateShipmentLabel
  const canReschedule =
    Boolean(detail.nextFollowUp) && detail.allowedActions.rescheduleFollowUp
  const canRegisterReturn = detail.allowedActions.registerReturnCase
  const destination = destinationLine(detail)
  const busy =
    saveTracking.isPending ||
    dispatch.isPending ||
    generateLabel.isPending ||
    reschedule.isPending ||
    registerCase.isPending ||
    confirmStock.isPending
  const savedLabel = detail.latestLabel

  return (
    <>
      <header className="page-heading page-heading--split">
        <div>
          <p className="eyebrow">Envío {detail.number}</p>
          <h1>{translated(shipmentStatusLabels, detail.status)}</h1>
          <p>
            Venta {detail.order.number} · {formatDate(detail.createdAt)}
          </p>
        </div>
        <div className="page-heading__actions">
          <StatusChip
            status={statusTone(detail.status)}
            label={translated(shipmentStatusLabels, detail.status)}
          />
          <Link className="button button--secondary" to="/app/despachos">
            Volver
          </Link>
          {savedLabel ? (
            <button
              className="button button--secondary"
              type="button"
              onClick={() => {
                setPreviewLabel(savedLabel)
                setLabelOpen(true)
              }}
            >
              Ver etiqueta
            </button>
          ) : null}
          {canGenerateLabel ? (
            <button
              className="button button--secondary"
              type="button"
              disabled={busy}
              onClick={() => generateLabel.mutate()}
            >
              {generateLabel.isPending ? 'Generando…' : 'Generar etiqueta'}
            </button>
          ) : null}
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

      <div className="sale-detail-grid">
        <article className="detail-card">
          <h2>Destino</h2>
          <dl>
            <div>
              <dt>Destinatario</dt>
              <dd>{detail.recipientName || '—'}</dd>
            </div>
            <div>
              <dt>Dirección</dt>
              <dd>{destination || '—'}</dd>
            </div>
            <div>
              <dt>Modalidad</dt>
              <dd>{translated(deliveryModeLabels, detail.deliveryMode)}</dd>
            </div>
            {detail.deliveryNotes ? (
              <div>
                <dt>Notas de entrega</dt>
                <dd>{detail.deliveryNotes}</dd>
              </div>
            ) : null}
          </dl>
          <p>
            <Link to={`/app/ventas/${detail.order.id}`}>Abrir venta asociada</Link>
          </p>
        </article>

        <article className="detail-card">
          <h2>Seguimiento</h2>
          {detail.trackingCode ? (
            <div className="shipping-tracking">
              <code>{detail.trackingCode}</code>
              <button
                className="button button--secondary"
                type="button"
                onClick={() => void copyValue('tracking', detail.trackingCode)}
              >
                {copied === 'tracking' ? 'Copiado' : 'Copiar tracking'}
              </button>
              {detail.trackingUrl ? (
                <button
                  className="button button--secondary"
                  type="button"
                  onClick={() => setExternalOpen(true)}
                >
                  Abrir seguimiento
                </button>
              ) : null}
            </div>
          ) : (
            <p>Todavía no hay un código de tracking.</p>
          )}
          <div className="shipping-tracking">
            <button
              className="button button--secondary"
              type="button"
              onClick={() => void copyValue('public', detail.publicUrl)}
            >
              {copied === 'public' ? 'Copiado' : 'Copiar enlace de seguimiento'}
            </button>
            <a
              className="button button--secondary"
              href={detail.publicUrl}
              target="_blank"
              rel="noreferrer"
            >
              Abrir seguimiento público
            </a>
          </div>
          {detail.confirmation ? (
            <p>
              El comprador respondió:{' '}
              {detail.confirmation.outcome === 'received'
                ? 'Sí, lo recibí'
                : 'No, necesito ayuda'}
              .
            </p>
          ) : null}
          {detail.activeTicket ? (
            <p>
              <Link
                className="button button--primary"
                to={`/app/despachos/${detail.id}/tickets/${detail.activeTicket.id}`}
              >
                Abrir consulta {detail.activeTicket.number}
              </Link>
            </p>
          ) : null}
          {canUpdate ? (
            <form
              className="shipping-form"
              onSubmit={(event) => {
                event.preventDefault()
                if (!saveTracking.isPending) saveTracking.mutate()
              }}
            >
              <label htmlFor="shipment-carrier">
                <span>Transportista</span>
                <input
                  id="shipment-carrier"
                  value={carrier}
                  onChange={(event) => setCarrier(event.target.value)}
                />
              </label>
              <label htmlFor="shipment-tracking-code">
                <span>Código de tracking</span>
                <input
                  id="shipment-tracking-code"
                  value={trackingCode}
                  onChange={(event) => setTrackingCode(event.target.value)}
                />
              </label>
              <label htmlFor="shipment-tracking-url">
                <span>URL de seguimiento</span>
                <input
                  id="shipment-tracking-url"
                  value={trackingUrl}
                  onChange={(event) => setTrackingUrl(event.target.value)}
                  placeholder="https://"
                />
              </label>
              <label>
                <span>Comentario en la línea de tiempo</span>
                <textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                />
              </label>
              <label className="shipping-note-flag">
                <input
                  type="checkbox"
                  checked={internalNote}
                  onChange={(event) => setInternalNote(event.target.checked)}
                />
                <span>Nota interna (no visible en el seguimiento público)</span>
              </label>
              <div className="shipping-form__actions">
                <button className="button button--primary" type="submit" disabled={busy}>
                  {saveTracking.isPending ? 'Guardando…' : 'Guardar seguimiento'}
                </button>
                {canDispatch ? (
                  <button
                    className="button button--secondary"
                    type="button"
                    disabled={busy}
                    onClick={() => setDispatchOpen(true)}
                  >
                    Marcar despachado
                  </button>
                ) : null}
              </div>
            </form>
          ) : (
            <dl>
              <div>
                <dt>Transportista</dt>
                <dd>{detail.carrier || '—'}</dd>
              </div>
              {canDispatch ? (
                <div className="shipping-form__actions">
                  <button
                    className="button button--primary"
                    type="button"
                    disabled={busy}
                    onClick={() => setDispatchOpen(true)}
                  >
                    Marcar despachado
                  </button>
                </div>
              ) : null}
            </dl>
          )}
        </article>
      </div>

      <section className="detail-section">
        <article className="detail-card">
          <h2>Cadencias</h2>
          {detail.nextFollowUp ? (
            <>
              <dl>
                <div>
                  <dt>Próximo vencimiento</dt>
                  <dd>
                    {translated(followUpKindLabels, detail.nextFollowUp.kind)} ·{' '}
                    {formatDate(detail.nextFollowUp.dueAt)}
                  </dd>
                </div>
                <div>
                  <dt>Origen del parámetro</dt>
                  <dd>
                    {detail.nextFollowUp.parameterSourceLabel} ·{' '}
                    {detail.nextFollowUp.parameterKey} (
                    {detail.nextFollowUp.parameterLabel})
                  </dd>
                </div>
              </dl>
              {canReschedule ? (
                <form
                  className="shipping-form"
                  onSubmit={(event) => {
                    event.preventDefault()
                    if (!reschedule.isPending) reschedule.mutate()
                  }}
                >
                  <label>
                    <span>Nueva fecha</span>
                    <input
                      type="datetime-local"
                      value={dueAt}
                      onChange={(event) => setDueAt(event.target.value)}
                    />
                  </label>
                  <label>
                    <span>Motivo</span>
                    <textarea
                      value={rescheduleReason}
                      onChange={(event) => setRescheduleReason(event.target.value)}
                      placeholder="Por qué se reprograma esta cadencia"
                    />
                  </label>
                  <button
                    className="button button--secondary"
                    type="submit"
                    disabled={busy}
                  >
                    {reschedule.isPending ? 'Reprogramando…' : 'Reprogramar seguimiento'}
                  </button>
                </form>
              ) : null}
            </>
          ) : (
            <p>No hay una cadencia programada para este envío.</p>
          )}
        </article>
      </section>

      <section className="detail-section">
        <article className="detail-card">
          <h2>Incidencia o devolución</h2>
          <p>
            Registrar un caso no repone stock. La reposición pide una confirmación aparte
            después de inspeccionar el bulto.
          </p>
          {canRegisterReturn ? (
            <form
              className="shipping-form"
              onSubmit={(event) => {
                event.preventDefault()
                if (!registerCase.isPending) registerCase.mutate()
              }}
            >
              <label>
                <span>Resultado</span>
                <select
                  value={returnKind}
                  onChange={(event) => setReturnKind(event.target.value)}
                >
                  {Object.entries(returnCaseKindLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Notas</span>
                <textarea
                  value={returnNotes}
                  onChange={(event) => setReturnNotes(event.target.value)}
                />
              </label>
              <button className="button button--primary" type="submit" disabled={busy}>
                {registerCase.isPending ? 'Registrando…' : 'Registrar incidencia'}
              </button>
            </form>
          ) : null}
          {detail.returnCases.length === 0 ? (
            <p>Todavía no hay un caso de incidencia o devolución.</p>
          ) : (
            <ul className="shipping-return-list">
              {detail.returnCases.map((item) => (
                <li key={item.id}>
                  <strong>{translated(returnCaseKindLabels, item.kind)}</strong>
                  <span>
                    {item.stockConfirmedAt
                      ? `Stock repuesto ${formatDate(item.stockConfirmedAt)}`
                      : 'Sin reposición de stock'}
                  </span>
                  {item.notes ? <span>{item.notes}</span> : null}
                  {!item.stockConfirmedAt ? (
                    <button
                      className="button button--secondary"
                      type="button"
                      disabled={busy}
                      onClick={() => confirmStock.mutate(item.id)}
                    >
                      {confirmStock.isPending ? 'Confirmando…' : 'Confirmar reposición'}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <section className="detail-section">
        <h2>Línea de tiempo</h2>
        <Timeline
          items={detail.timeline.map((item: SellerShipment['timeline'][number]) => ({
            id: item.id,
            title: item.title,
            detail: [
              item.detail,
              item.isPublic ? 'Visible al comprador' : 'Nota interna',
              item.actorName,
            ]
              .filter(Boolean)
              .join(' · '),
            date: formatDate(item.createdAt),
          }))}
        />
      </section>

      {externalOpen && detail.trackingUrl ? (
        <Modal
          title="Abrir seguimiento externo"
          description="Tenda no consulta el estado con el transportista. Vas a salir a un sitio externo."
          onClose={() => setExternalOpen(false)}
          footer={
            <>
              <button
                className="button button--secondary"
                type="button"
                onClick={() => setExternalOpen(false)}
              >
                Cancelar
              </button>
              <a
                className="button button--primary"
                href={detail.trackingUrl}
                target="_blank"
                rel="noreferrer"
                onClick={() => setExternalOpen(false)}
              >
                Abrir sitio del transportista
              </a>
            </>
          }
        >
          <p className="shipping-warning">
            <strong>Este enlace no está verificado por Tenda.</strong>
            El estado que veas allí lo publica el transportista, no esta plataforma.
          </p>
        </Modal>
      ) : null}

      {dispatchOpen ? (
        <Modal
          title="Marcar despachado"
          description="El envío dejará de admitir cambios de tracking."
          onClose={() => !dispatch.isPending && setDispatchOpen(false)}
          footer={
            <>
              <button
                className="button button--secondary"
                type="button"
                disabled={dispatch.isPending}
                onClick={() => setDispatchOpen(false)}
              >
                Cancelar
              </button>
              <button
                className="button button--primary"
                type="button"
                disabled={dispatch.isPending}
                onClick={() => dispatch.mutate()}
              >
                {dispatch.isPending ? 'Despachando…' : 'Confirmar despacho'}
              </button>
            </>
          }
        >
          <p>
            Confirma que el pedido ya salió. Esta acción es idempotente si se reintenta.
          </p>
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
              {previewLabel?.downloadUrl ? (
                <a
                  className="button button--primary"
                  href={previewLabel.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Descargar PDF
                </a>
              ) : canGenerateLabel ? (
                <button
                  className="button button--primary"
                  type="button"
                  disabled={busy}
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
          {previewLabel?.downloadUrl ? (
            <>
              <iframe
                className="shipping-label-preview"
                title="Vista previa de la etiqueta interna"
                src={previewLabel.downloadUrl}
              />
              <p className="shipping-label-meta">
                Caduca {formatDate(previewLabel.expiresAt)} · {previewLabel.fileName}
              </p>
            </>
          ) : (
            <p>
              El enlace de esta etiqueta ya expiró. Genera una nueva para descargarla.
            </p>
          )}
        </Modal>
      ) : null}
    </>
  )
}
