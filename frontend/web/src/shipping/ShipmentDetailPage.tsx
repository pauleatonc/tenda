import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { EmptyState, Modal, StatusChip } from '../components/ui'
import { TendaApiError, newIdempotencyKey } from '../lib/http'
import {
  fetchShipment,
  generateShipmentLabel,
  registerShipmentDispatch,
  shippingKeys,
  type SellerShipment,
} from './api'
import {
  deliveryModeLabels,
  destinationLine,
  formatDate,
  registeredAt,
  registrationLabel,
  requiresCarrier,
  shipmentStatusLabels,
  statusTone,
  translated,
} from './model'

function fieldError(error: Error | null, field: string): string | null {
  if (!(error instanceof TendaApiError)) return null
  return error.fieldErrors[field]?.[0] ?? null
}

export function ShipmentDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [carrier, setCarrier] = useState('')
  const [trackingCode, setTrackingCode] = useState('')
  const [trackingUrl, setTrackingUrl] = useState('')
  const [note, setNote] = useState('')
  const [copied, setCopied] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [labelOpen, setLabelOpen] = useState(false)
  const [previewLabel, setPreviewLabel] = useState<SellerShipment['latestLabel']>(null)
  const [actionError, setActionError] = useState<Error | null>(null)
  const [registerKey, setRegisterKey] = useState(newIdempotencyKey)
  const [labelKey, setLabelKey] = useState(newIdempotencyKey)

  const shipment = useQuery({
    queryKey: shippingKeys.shipment(id),
    queryFn: () => fetchShipment(id),
    enabled: Boolean(id),
  })

  const register = useMutation({
    mutationFn: () =>
      registerShipmentDispatch({
        shipmentId: id,
        carrier: carrier.trim() || null,
        trackingCode: trackingCode.trim() || null,
        trackingUrl: trackingUrl.trim() || null,
        note: note.trim() || null,
        idempotencyKey: registerKey,
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(shippingKeys.shipment(id), result.shipment)
      void queryClient.invalidateQueries({ queryKey: shippingKeys.root })
      setConfirmOpen(false)
      setRegisterKey(newIdempotencyKey())
      setActionError(null)
    },
    onError: (error: Error) => {
      setConfirmOpen(false)
      setActionError(error)
    },
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

  async function copyTracking(value: string) {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
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
  const canRegister = detail.allowedActions.registerShipmentDispatch
  const canGenerateLabel = detail.allowedActions.generateShipmentLabel
  const needsCarrier = requiresCarrier(detail.deliveryMode)
  const actionLabel = registrationLabel(detail.deliveryMode)
  const destination = destinationLine(detail)
  const busy = register.isPending || generateLabel.isPending
  const savedLabel = detail.latestLabel
  const carrierError = fieldError(actionError, 'carrier')
  const trackingUrlError = fieldError(actionError, 'trackingUrl')
  const registeredOn = registeredAt(detail)
  const formValid = !needsCarrier || carrier.trim().length > 0

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

      {actionError && !carrierError && !trackingUrlError ? (
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
            {detail.recipientTaxId ? (
              <div>
                <dt>RUT de quien recibe</dt>
                <dd>{detail.recipientTaxId}</dd>
              </div>
            ) : null}
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
            <div>
              <dt>Correo del comprador</dt>
              <dd>{detail.buyerEmail || 'Sin correo registrado'}</dd>
            </div>
          </dl>
          <p>
            <Link to={`/app/ventas/${detail.order.id}`}>Abrir venta asociada</Link>
          </p>
        </article>

        <article className="detail-card">
          <h2>{canRegister ? actionLabel : 'Registro'}</h2>
          {canRegister ? (
            <>
              <p className="shipping-notice">
                {detail.buyerEmail ? (
                  <>
                    Al registrar, enviaremos un correo a <strong>{detail.buyerEmail}</strong>{' '}
                    con estos datos. No se hace seguimiento posterior.
                  </>
                ) : (
                  <>
                    <strong>El comprador no dejó correo.</strong> Registraremos el envío sin
                    enviar notificación.
                  </>
                )}
              </p>
              <form
                className="shipping-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  if (!busy && formValid) setConfirmOpen(true)
                }}
              >
                {needsCarrier ? (
                  <>
                    <label htmlFor="shipment-carrier">
                      <span>Transportista</span>
                      <input
                        id="shipment-carrier"
                        value={carrier}
                        required
                        aria-invalid={carrierError ? true : undefined}
                        aria-describedby={carrierError ? 'shipment-carrier-error' : undefined}
                        onChange={(event) => setCarrier(event.target.value)}
                        placeholder="Chilexpress, Starken, Blue Express…"
                      />
                    </label>
                    {carrierError ? (
                      <small id="shipment-carrier-error" className="field-error" role="alert">
                        {carrierError}
                      </small>
                    ) : null}
                    <label htmlFor="shipment-tracking-code">
                      <span>Código de tracking (opcional)</span>
                      <input
                        id="shipment-tracking-code"
                        value={trackingCode}
                        onChange={(event) => setTrackingCode(event.target.value)}
                      />
                    </label>
                    <label htmlFor="shipment-tracking-url">
                      <span>URL de seguimiento (opcional)</span>
                      <input
                        id="shipment-tracking-url"
                        value={trackingUrl}
                        aria-invalid={trackingUrlError ? true : undefined}
                        aria-describedby={
                          trackingUrlError ? 'shipment-tracking-url-error' : undefined
                        }
                        onChange={(event) => setTrackingUrl(event.target.value)}
                        placeholder="https://"
                      />
                    </label>
                    {trackingUrlError ? (
                      <small
                        id="shipment-tracking-url-error"
                        className="field-error"
                        role="alert"
                      >
                        {trackingUrlError}
                      </small>
                    ) : null}
                  </>
                ) : null}
                <label htmlFor="shipment-note">
                  <span>Nota para el comprador (opcional)</span>
                  <textarea
                    id="shipment-note"
                    value={note}
                    maxLength={500}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder={
                      needsCarrier
                        ? 'Ej: sale hoy en la tarde, llega en 2 días hábiles.'
                        : 'Ej: entregado en mano a las 18:00.'
                    }
                  />
                </label>
                <div className="shipping-form__actions">
                  <button
                    className="button button--primary"
                    type="submit"
                    disabled={busy || !formValid}
                  >
                    {actionLabel}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <dl>
              <div>
                <dt>{detail.status === 'delivered' ? 'Entregado' : 'Despachado'}</dt>
                <dd>{formatDate(registeredOn)}</dd>
              </div>
              {needsCarrier ? (
                <div>
                  <dt>Transportista</dt>
                  <dd>{detail.carrier || '—'}</dd>
                </div>
              ) : null}
              {detail.trackingCode ? (
                <div>
                  <dt>Tracking</dt>
                  <dd>
                    <div className="shipping-tracking">
                      <code>{detail.trackingCode}</code>
                      <button
                        className="button button--secondary"
                        type="button"
                        onClick={() => void copyTracking(detail.trackingCode)}
                      >
                        {copied ? 'Copiado' : 'Copiar tracking'}
                      </button>
                    </div>
                  </dd>
                </div>
              ) : null}
              {detail.dispatchNote ? (
                <div>
                  <dt>Nota</dt>
                  <dd>{detail.dispatchNote}</dd>
                </div>
              ) : null}
              <div>
                <dt>Correo al comprador</dt>
                <dd>
                  {detail.buyerEmail
                    ? `Enviado a ${detail.buyerEmail}`
                    : 'No se envió (sin correo registrado)'}
                </dd>
              </div>
            </dl>
          )}
        </article>
      </div>

      {confirmOpen ? (
        <Modal
          title={actionLabel}
          description={
            needsCarrier
              ? 'El envío quedará como despachado y no admite cambios posteriores.'
              : 'El envío quedará como entregado y no admite cambios posteriores.'
          }
          onClose={() => !register.isPending && setConfirmOpen(false)}
          footer={
            <>
              <button
                className="button button--secondary"
                type="button"
                disabled={register.isPending}
                onClick={() => setConfirmOpen(false)}
              >
                Cancelar
              </button>
              <button
                className="button button--primary"
                type="button"
                disabled={register.isPending}
                onClick={() => register.mutate()}
              >
                {register.isPending ? 'Registrando…' : 'Confirmar y notificar'}
              </button>
            </>
          }
        >
          <dl>
            {needsCarrier ? (
              <>
                <div>
                  <dt>Transportista</dt>
                  <dd>{carrier.trim()}</dd>
                </div>
                <div>
                  <dt>Tracking</dt>
                  <dd>{trackingCode.trim() || '—'}</dd>
                </div>
              </>
            ) : null}
            {note.trim() ? (
              <div>
                <dt>Nota</dt>
                <dd>{note.trim()}</dd>
              </div>
            ) : null}
          </dl>
          <p>
            {detail.buyerEmail
              ? `Se enviará un correo a ${detail.buyerEmail}.`
              : 'No se enviará correo porque el comprador no dejó uno.'}
          </p>
        </Modal>
      ) : null}

      {labelOpen ? (
        <Modal
          title="Etiqueta interna Tenda"
          description="Este documento no es una etiqueta de transportista."
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
            <p className="shipping-label-meta">
              Caduca {formatDate(previewLabel.expiresAt)} · {previewLabel.fileName}
            </p>
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
