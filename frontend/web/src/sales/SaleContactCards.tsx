import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'

import {
  formatChileAddress,
  formatRutInput,
  type BuyerView,
  type SellerOrder,
} from '@tenda/api-client'

import { ChileLocationFields } from '../components/ChileLocationFields'
import { TendaApiError, newIdempotencyKey } from '../lib/http'
import { salesKeys, updateOrderBuyer } from './api'
import { deliveryModeLabels, formatDate, translated } from './model'

type BuyerDraft = {
  fullName: string
  email: string
  phone: string
}

type DeliveryDraft = {
  recipientName: string
  recipientTaxId: string
  phone: string
  deliveryAddress: string
  deliveryCommune: string
  deliveryRegion: string
  deliveryNotes: string
}

function emptyBuyer(buyer?: BuyerView | null): BuyerDraft {
  return {
    fullName: buyer?.fullName ?? '',
    email: buyer?.email ?? '',
    phone: buyer?.phone ?? '',
  }
}

function emptyDelivery(buyer?: BuyerView | null): DeliveryDraft {
  return {
    recipientName: buyer?.recipientName ?? '',
    recipientTaxId: buyer?.recipientTaxId ?? '',
    phone: buyer?.phone ?? '',
    deliveryAddress: buyer?.deliveryAddress ?? '',
    deliveryCommune: buyer?.deliveryCommune ?? '',
    deliveryRegion: buyer?.deliveryRegion ?? '',
    deliveryNotes: buyer?.deliveryNotes ?? '',
  }
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Zm17.71-10.21a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z"
      />
    </svg>
  )
}

function payloadFrom(order: SellerOrder, buyer: BuyerDraft, delivery: DeliveryDraft) {
  const current = order.buyer
  return {
    orderId: order.id,
    fullName: buyer.fullName.trim() || delivery.recipientName.trim() || 'Comprador',
    email: buyer.email.trim() || null,
    phone: buyer.phone.trim() || delivery.phone.trim() || null,
    recipientName: delivery.recipientName.trim() || null,
    recipientTaxId: delivery.recipientTaxId.trim() || null,
    deliveryAddress: delivery.deliveryAddress.trim() || null,
    deliveryCommune: delivery.deliveryCommune.trim() || null,
    deliveryRegion: delivery.deliveryRegion.trim() || null,
    deliveryNotes: delivery.deliveryNotes.trim() || null,
    taxId: current?.taxId || null,
    taxName: current?.taxName || null,
    taxBusinessActivity: current?.taxBusinessActivity || null,
    taxAddress: current?.taxAddress || null,
    taxCommune: current?.taxCommune || null,
    taxRegion: current?.taxRegion || null,
    taxEmail: current?.taxEmail || null,
  }
}

export function SaleContactCards({ order }: { order: SellerOrder }) {
  const queryClient = useQueryClient()
  const buyer = order.buyer
  const canEdit = order.allowedActions.updateBuyer
  const [editing, setEditing] = useState<'buyer' | 'delivery' | null>(null)
  const [buyerDraft, setBuyerDraft] = useState(() => emptyBuyer(buyer))
  const [deliveryDraft, setDeliveryDraft] = useState(() => emptyDelivery(buyer))
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey)

  const save = useMutation({
    mutationFn: (section: 'buyer' | 'delivery') =>
      updateOrderBuyer({
        ...payloadFrom(
          order,
          section === 'buyer' ? buyerDraft : emptyBuyer(order.buyer),
          section === 'delivery' ? deliveryDraft : emptyDelivery(order.buyer),
        ),
        idempotencyKey,
      }),
    onSuccess: () => {
      setEditing(null)
      setIdempotencyKey(newIdempotencyKey())
      void queryClient.invalidateQueries({ queryKey: salesKeys.order(order.id) })
      void queryClient.invalidateQueries({ queryKey: ['sales'] })
    },
  })

  function startEdit(section: 'buyer' | 'delivery') {
    setBuyerDraft(emptyBuyer(order.buyer))
    setDeliveryDraft(emptyDelivery(order.buyer))
    setEditing(section)
    save.reset()
  }

  return (
    <>
      <article className="detail-card">
        <header className="detail-card__header">
          <h2>Comprador</h2>
          {canEdit ? (
            <button
              className="detail-card__edit"
              type="button"
              aria-label="Editar comprador"
              disabled={save.isPending}
              onClick={() =>
                editing === 'buyer' ? setEditing(null) : startEdit('buyer')
              }
            >
              <PencilIcon />
            </button>
          ) : null}
        </header>
        {editing === 'buyer' ? (
          <ContactEditForm
            error={save.error}
            pending={save.isPending}
            onCancel={() => setEditing(null)}
            onSave={() => save.mutate('buyer')}
          >
            <div className="field">
              <label htmlFor="sale-buyer-name">Nombre</label>
              <input
                id="sale-buyer-name"
                value={buyerDraft.fullName}
                onChange={(event) =>
                  setBuyerDraft((current) => ({ ...current, fullName: event.target.value }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="sale-buyer-email">Email</label>
              <input
                id="sale-buyer-email"
                type="email"
                value={buyerDraft.email}
                onChange={(event) =>
                  setBuyerDraft((current) => ({ ...current, email: event.target.value }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="sale-buyer-phone">Teléfono</label>
              <input
                id="sale-buyer-phone"
                type="tel"
                value={buyerDraft.phone}
                onChange={(event) =>
                  setBuyerDraft((current) => ({ ...current, phone: event.target.value }))
                }
              />
            </div>
          </ContactEditForm>
        ) : buyer ? (
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
        <header className="detail-card__header">
          <h2>Entrega</h2>
          {canEdit ? (
            <button
              className="detail-card__edit"
              type="button"
              aria-label="Editar entrega"
              disabled={save.isPending}
              onClick={() =>
                editing === 'delivery' ? setEditing(null) : startEdit('delivery')
              }
            >
              <PencilIcon />
            </button>
          ) : null}
        </header>
        {editing === 'delivery' ? (
          <ContactEditForm
            error={save.error}
            pending={save.isPending}
            onCancel={() => setEditing(null)}
            onSave={() => save.mutate('delivery')}
          >
            <div className="field">
              <label htmlFor="sale-recipient">Quién recibe</label>
              <input
                id="sale-recipient"
                value={deliveryDraft.recipientName}
                onChange={(event) =>
                  setDeliveryDraft((current) => ({
                    ...current,
                    recipientName: event.target.value,
                  }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="sale-recipient-tax-id">RUT de quien recibe</label>
              <input
                id="sale-recipient-tax-id"
                value={deliveryDraft.recipientTaxId}
                onChange={(event) =>
                  setDeliveryDraft((current) => ({
                    ...current,
                    recipientTaxId: formatRutInput(event.target.value),
                  }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="sale-delivery-phone">Teléfono de contacto</label>
              <input
                id="sale-delivery-phone"
                type="tel"
                value={deliveryDraft.phone}
                onChange={(event) =>
                  setDeliveryDraft((current) => ({ ...current, phone: event.target.value }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="sale-delivery-address">Dirección</label>
              <input
                id="sale-delivery-address"
                value={deliveryDraft.deliveryAddress}
                onChange={(event) =>
                  setDeliveryDraft((current) => ({
                    ...current,
                    deliveryAddress: event.target.value,
                  }))
                }
              />
            </div>
            <ChileLocationFields
              regionId="sale-delivery-region"
              communeId="sale-delivery-commune"
              region={deliveryDraft.deliveryRegion}
              commune={deliveryDraft.deliveryCommune}
              onChange={({ region, commune }) =>
                setDeliveryDraft((current) => ({
                  ...current,
                  deliveryRegion: region,
                  deliveryCommune: commune,
                }))
              }
            />
            <div className="field">
              <label htmlFor="sale-delivery-notes">Indicaciones</label>
              <input
                id="sale-delivery-notes"
                value={deliveryDraft.deliveryNotes}
                onChange={(event) =>
                  setDeliveryDraft((current) => ({
                    ...current,
                    deliveryNotes: event.target.value,
                  }))
                }
              />
            </div>
          </ContactEditForm>
        ) : (
          <dl>
            <div>
              <dt>Modalidad</dt>
              <dd>{translated(deliveryModeLabels, order.deliveryMode)}</dd>
            </div>
            {buyer?.recipientName ? (
              <div>
                <dt>Recibe</dt>
                <dd>{buyer.recipientName}</dd>
              </div>
            ) : null}
            {buyer?.recipientTaxId ? (
              <div>
                <dt>RUT de quien recibe</dt>
                <dd>{buyer.recipientTaxId}</dd>
              </div>
            ) : null}
            {buyer?.deliveryAddress ? (
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
            ) : null}
            {buyer?.deliveryNotes ? (
              <div>
                <dt>Indicaciones</dt>
                <dd>{buyer.deliveryNotes}</dd>
              </div>
            ) : null}
            <div>
              <dt>Reserva hasta</dt>
              <dd>{formatDate(order.expiresAt)}</dd>
            </div>
          </dl>
        )}
      </article>
    </>
  )
}

function ContactEditForm({
  children,
  error,
  pending,
  onCancel,
  onSave,
}: {
  children: ReactNode
  error: Error | null
  pending: boolean
  onCancel: () => void
  onSave: () => void
}) {
  return (
    <div className="detail-card__form">
      {error ? (
        <div className="form-message form-message--error" role="alert">
          <span>
            {error instanceof TendaApiError
              ? error.message
              : 'No pudimos guardar los cambios. Inténtalo nuevamente.'}
          </span>
        </div>
      ) : null}
      {children}
      <div className="detail-card__form-actions">
        <button className="button button--secondary" type="button" disabled={pending} onClick={onCancel}>
          Cancelar
        </button>
        <button className="button button--primary" type="button" disabled={pending} onClick={onSave}>
          {pending ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}
