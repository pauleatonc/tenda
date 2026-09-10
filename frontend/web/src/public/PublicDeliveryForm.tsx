import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { formatChileAddress } from '@tenda/api-client'

import { ChileLocationFields } from '../components/ChileLocationFields'
import { TendaApiError, newIdempotencyKey } from '../lib/http'
import { salesKeys, setBuyerDetails, type PublicOrder } from '../sales/api'
import {
  buyerDisplayName,
  deliveryDraftFromBuyer,
  formatDeliveryRut,
  hasRequiredDelivery,
  validateDeliveryDraft,
  type DeliveryDraft,
  type DeliveryErrors,
} from './publicDelivery'

function DeliverySummary({
  order,
  onEdit,
}: {
  order: PublicOrder
  onEdit?: () => void
}) {
  const buyer = order.buyer
  if (!buyer) return null
  return (
    <section className="public-delivery-panel">
      <header>
        <h2>Datos de despacho</h2>
        <p>El vendedor usará estos datos para enviar el pedido.</p>
      </header>
      <dl className="public-delivery-summary">
        <div>
          <dt>Quién recibe</dt>
          <dd>{buyer.recipientName}</dd>
        </div>
        <div>
          <dt>RUT de quien recibe</dt>
          <dd>{buyer.recipientTaxId}</dd>
        </div>
        <div>
          <dt>Teléfono</dt>
          <dd>{buyer.phone}</dd>
        </div>
        <div>
          <dt>Dirección</dt>
          <dd>
            {formatChileAddress(
              buyer.deliveryAddress,
              buyer.deliveryCommune,
              buyer.deliveryRegion,
            )}
          </dd>
        </div>
        {buyer.deliveryNotes ? (
          <div>
            <dt>Indicaciones</dt>
            <dd>{buyer.deliveryNotes}</dd>
          </div>
        ) : null}
      </dl>
      {onEdit ? (
        <button className="button button--secondary button--wide" type="button" onClick={onEdit}>
          Corregir datos
        </button>
      ) : null}
    </section>
  )
}

export function PublicDeliveryForm({
  token,
  order,
  readOnly = false,
}: {
  token: string
  order: PublicOrder
  readOnly?: boolean
}) {
  const queryClient = useQueryClient()
  const complete = hasRequiredDelivery(order.buyer)
  const [editing, setEditing] = useState(!complete)
  const [draft, setDraft] = useState<DeliveryDraft>(() => deliveryDraftFromBuyer(order.buyer))
  const [errors, setErrors] = useState<DeliveryErrors>({})
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey)

  useEffect(() => {
    setDraft(deliveryDraftFromBuyer(order.buyer))
    setEditing(!hasRequiredDelivery(order.buyer))
  }, [order.buyer])

  const save = useMutation({
    mutationFn: () =>
      setBuyerDetails({
        token,
        fullName: buyerDisplayName(order.buyer, draft.recipientName),
        email: order.buyer?.email.trim() || null,
        phone: draft.phone.trim(),
        recipientName: draft.recipientName.trim(),
        recipientTaxId: draft.recipientTaxId.trim(),
        deliveryAddress: draft.deliveryAddress.trim(),
        deliveryCommune: draft.deliveryCommune.trim(),
        deliveryRegion: draft.deliveryRegion.trim(),
        deliveryNotes: draft.deliveryNotes.trim() || null,
        paymentMethod: order.paymentMethod,
        idempotencyKey,
      }),
    onSuccess: () => {
      setIdempotencyKey(newIdempotencyKey())
      setEditing(false)
      void queryClient.invalidateQueries({ queryKey: salesKeys.publicOrder(token) })
    },
  })

  function update<K extends keyof DeliveryDraft>(key: K, value: DeliveryDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  if (readOnly || (complete && !editing)) {
    return (
      <DeliverySummary
        order={order}
        onEdit={readOnly ? undefined : () => setEditing(true)}
      />
    )
  }

  return (
    <section className="public-delivery-panel">
      <header>
        <h2>Datos de despacho</h2>
        <p>Obligatorios para coordinar el envío. El comprobante se habilita al guardarlos.</p>
      </header>
      {save.isError ? (
        <div className="form-message form-message--error" role="alert">
          <strong>No pudimos guardar el despacho</strong>
          <span>
            {save.error instanceof TendaApiError
              ? save.error.message
              : save.error.message || 'Inténtalo nuevamente.'}
          </span>
        </div>
      ) : null}
      <div className="public-delivery-fields">
        <div className="field">
          <label htmlFor="offer-recipient">Quién recibe</label>
          <input
            id="offer-recipient"
            autoComplete="shipping name"
            value={draft.recipientName}
            aria-invalid={Boolean(errors.recipientName)}
            onChange={(event) => update('recipientName', event.target.value)}
          />
          {errors.recipientName ? (
            <small className="field__error">{errors.recipientName}</small>
          ) : null}
        </div>
        <div className="field">
          <label htmlFor="offer-recipient-tax-id">RUT de quien recibe</label>
          <input
            id="offer-recipient-tax-id"
            autoComplete="off"
            inputMode="text"
            value={draft.recipientTaxId}
            aria-invalid={Boolean(errors.recipientTaxId)}
            onChange={(event) => update('recipientTaxId', formatDeliveryRut(event.target.value))}
          />
          {errors.recipientTaxId ? (
            <small className="field__error">{errors.recipientTaxId}</small>
          ) : null}
        </div>
        <div className="field">
          <label htmlFor="offer-phone">Teléfono de contacto</label>
          <input
            id="offer-phone"
            type="tel"
            autoComplete="tel"
            value={draft.phone}
            aria-invalid={Boolean(errors.phone)}
            onChange={(event) => update('phone', event.target.value)}
          />
          {errors.phone ? <small className="field__error">{errors.phone}</small> : null}
        </div>
        <div className="field">
          <label htmlFor="offer-address">Dirección</label>
          <input
            id="offer-address"
            autoComplete="shipping street-address"
            value={draft.deliveryAddress}
            aria-invalid={Boolean(errors.deliveryAddress)}
            onChange={(event) => update('deliveryAddress', event.target.value)}
          />
          {errors.deliveryAddress ? (
            <small className="field__error">{errors.deliveryAddress}</small>
          ) : null}
        </div>
        <ChileLocationFields
          regionId="offer-region"
          communeId="offer-commune"
          region={draft.deliveryRegion}
          commune={draft.deliveryCommune}
          regionError={errors.deliveryRegion}
          communeError={errors.deliveryCommune}
          onChange={({ region, commune }) => {
            update('deliveryRegion', region)
            update('deliveryCommune', commune)
          }}
        />
        <div className="field">
          <label htmlFor="offer-notes">Indicaciones (opcional)</label>
          <input
            id="offer-notes"
            value={draft.deliveryNotes}
            onChange={(event) => update('deliveryNotes', event.target.value)}
          />
        </div>
      </div>
      <button
        className="button button--primary button--wide"
        type="button"
        disabled={save.isPending}
        onClick={() => {
          const nextErrors = validateDeliveryDraft(draft)
          setErrors(nextErrors)
          if (Object.keys(nextErrors).length) return
          save.mutate()
        }}
      >
        {save.isPending ? 'Guardando…' : 'Guardar datos de despacho'}
      </button>
    </section>
  )
}
