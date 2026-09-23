import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { BankDetailsRequiredNotice } from '../app/BankDetailsRequiredNotice'
import { Modal } from '../components/ui'
import { TendaApiError, newIdempotencyKey } from '../lib/http'
import {
  createOrder,
  publishOrderLink,
  sendOfferLink,
} from '../sales/api'
import { formatClp } from '../sales/model'
import type { ProductRow } from './api'
import { formatPrice, formatQuantity } from './format'

type SaleMethodId = 'deposit' | 'online' | 'cash'
type DeliveryMode = 'shipping' | 'pickup' | 'coordinated'

const SALE_METHODS: ReadonlyArray<{
  id: SaleMethodId
  label: string
  description: string
  enabled: boolean
}> = [
  {
    id: 'deposit',
    label: 'Depósito',
    description: 'El comprador transfiere y sube el comprobante.',
    enabled: true,
  },
  {
    id: 'online',
    label: 'Pago Online',
    description: 'Próximamente',
    enabled: false,
  },
  {
    id: 'cash',
    label: 'Efectivo',
    description: 'Abres la ficha para completar datos y registrar el pago.',
    enabled: true,
  },
]

const DELIVERY_MODES: ReadonlyArray<{
  id: DeliveryMode
  label: string
  description: string
}> = [
  {
    id: 'shipping',
    label: 'Despacho',
    description: 'El comprador completará destinatario y dirección.',
  },
  {
    id: 'pickup',
    label: 'Retiro',
    description: 'El retiro se coordina directamente con el vendedor.',
  },
  {
    id: 'coordinated',
    label: 'Entrega coordinada',
    description: 'La fecha y el lugar se acuerdan después de la compra.',
  },
]

export function GenerateSaleDialog({
  product,
  hasBankDetails,
  onClose,
}: {
  product: ProductRow
  hasBankDetails: boolean
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const available = product.stock.available
  const [method, setMethod] = useState<'deposit' | 'cash'>('deposit')
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('shipping')
  const [confirmCash, setConfirmCash] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [email, setEmail] = useState('')
  const [copied, setCopied] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [createKey] = useState(newIdempotencyKey)
  const [publishKey] = useState(newIdempotencyKey)
  const [emailKey, setEmailKey] = useState(newIdempotencyKey)
  const [result, setResult] = useState<{ orderId: string; publicUrl: string } | null>(
    null,
  )

  const publish = useMutation({
    mutationFn: async () => {
      const created = await createOrder({
        lines: [
          {
            productId: product.id,
            quantity,
            unitSalePrice: product.salePrice ?? '0',
          },
        ],
        deliveryMode,
        paymentMethod: 'bank_transfer',
        idempotencyKey: createKey,
      })
      const published = await publishOrderLink({
        orderId: created.order.id,
        idempotencyKey: publishKey,
      })
      return { orderId: created.order.id, publicUrl: published.publicUrl }
    },
    onSuccess: (published) => {
      setResult(published)
      setError(null)
      void queryClient.invalidateQueries({ queryKey: ['inventory'] })
      void queryClient.invalidateQueries({ queryKey: ['sales'] })
    },
    onError: (mutationError: Error) => setError(mutationError),
  })

  const createCash = useMutation({
    mutationFn: async () => {
      const created = await createOrder({
        lines: [
          {
            productId: product.id,
            quantity,
            unitSalePrice: product.salePrice ?? '0',
          },
        ],
        deliveryMode,
        paymentMethod: 'cash',
        idempotencyKey: createKey,
      })
      return created.order.id
    },
    onSuccess: (orderId) => {
      setError(null)
      void queryClient.invalidateQueries({ queryKey: ['inventory'] })
      void queryClient.invalidateQueries({ queryKey: ['sales'] })
      onClose()
      navigate(`/app/ventas/${orderId}`)
    },
    onError: (mutationError: Error) => setError(mutationError),
  })

  const sendEmail = useMutation({
    mutationFn: () => {
      if (!result) throw new Error('Falta el enlace publicado.')
      return sendOfferLink({
        orderId: result.orderId,
        email: email.trim(),
        idempotencyKey: emailKey,
      })
    },
    onSuccess: () => {
      setEmailSent(true)
      setError(null)
    },
    onError: (mutationError: Error) => {
      setError(mutationError)
      setEmailKey(newIdempotencyKey())
    },
  })

  async function copyUrl() {
    if (!result) return
    await navigator.clipboard.writeText(result.publicUrl)
    setCopied(true)
  }

  const showBankNotice = !result && !confirmCash && method === 'deposit' && !hasBankDetails

  return (
    <Modal
      title={
        result
          ? 'Enlace listo'
          : confirmCash
            ? 'Confirmar venta en efectivo'
            : `Generar venta · ${product.name}`
      }
      description={
        result
          ? 'Copia el enlace o envíalo por correo. El comprador abre la ficha en el navegador.'
          : confirmCash
            ? 'Se reservará el stock y abrirás la ficha para completar los datos y registrar el pago.'
            : 'Elige entrega y tipo de venta. Depósito comparte un enlace. Efectivo abre la ficha.'
      }
      onClose={onClose}
      footer={
        result ? (
          <button className="button button--secondary" type="button" onClick={onClose}>
            Cerrar
          </button>
        ) : confirmCash ? (
          <>
            <button
              className="button button--secondary"
              type="button"
              disabled={createCash.isPending}
              onClick={() => setConfirmCash(false)}
            >
              Volver
            </button>
            <button
              className="button button--primary"
              type="button"
              disabled={createCash.isPending}
              onClick={() => createCash.mutate()}
            >
              {createCash.isPending ? 'Creando…' : 'Crear venta'}
            </button>
          </>
        ) : (
          <>
            <button className="button button--secondary" type="button" onClick={onClose}>
              Cancelar
            </button>
            {method === 'deposit' && hasBankDetails ? (
              <button
                className="button button--primary"
                type="button"
                disabled={publish.isPending}
                onClick={() => publish.mutate()}
              >
                {publish.isPending ? 'Generando…' : 'Generar depósito'}
              </button>
            ) : null}
            {method === 'cash' ? (
              <button
                className="button button--primary"
                type="button"
                onClick={() => {
                  setError(null)
                  setConfirmCash(true)
                }}
              >
                Continuar
              </button>
            ) : null}
          </>
        )
      }
    >
      {error ? (
        <div className="form-message form-message--error" role="alert">
          <span>
            {error instanceof TendaApiError
              ? error.message
              : 'No pudimos completar la acción. Inténtalo nuevamente.'}
          </span>
        </div>
      ) : null}

      {showBankNotice ? <BankDetailsRequiredNotice /> : null}

      {result ? (
        <div className="generate-sale-ready">
          <label className="field">
            <span>Enlace público</span>
            <input readOnly value={result.publicUrl} />
          </label>
          <div className="row-actions">
            <button className="button button--primary" type="button" onClick={() => void copyUrl()}>
              {copied ? 'Copiado' : 'Copiar enlace'}
            </button>
            <a
              className="button button--secondary"
              href={result.publicUrl}
              target="_blank"
              rel="noreferrer"
            >
              Ver venta
            </a>
          </div>
          <form
            className="generate-sale-email"
            onSubmit={(event) => {
              event.preventDefault()
              if (email.trim()) sendEmail.mutate()
            }}
          >
            <label className="field">
              <span>Enviar por correo</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value)
                  setEmailSent(false)
                }}
                placeholder="correo@ejemplo.cl"
              />
            </label>
            <button
              className="button button--secondary"
              type="submit"
              disabled={!email.trim() || sendEmail.isPending}
            >
              {sendEmail.isPending ? 'Enviando…' : 'Enviar'}
            </button>
            {emailSent ? (
              <p className="field__hint" role="status">
                Correo enviado.
              </p>
            ) : null}
          </form>
        </div>
      ) : (
        <>
          {confirmCash ? (
            <p>
              {product.name} · {formatQuantity(quantity)} ·{' '}
              {formatClp(Number(product.salePrice ?? 0) * quantity)}
            </p>
          ) : (
            <>
              <fieldset className="choice-cards">
                <legend>Entrega</legend>
                {DELIVERY_MODES.map((item) => (
                  <label key={item.id}>
                    <input
                      type="radio"
                      name="generate-sale-delivery"
                      value={item.id}
                      checked={deliveryMode === item.id}
                      onChange={() => setDeliveryMode(item.id)}
                    />
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.description}</small>
                    </span>
                  </label>
                ))}
              </fieldset>
              <fieldset className="choice-cards">
                <legend>Tipo de venta</legend>
                {SALE_METHODS.map((item) => (
                  <label
                    key={item.id}
                    className={item.enabled ? undefined : 'is-disabled'}
                  >
                    <input
                      type="radio"
                      name="generate-sale-method"
                      value={item.id}
                      checked={method === item.id}
                      disabled={!item.enabled}
                      onChange={() => {
                        if (!item.enabled || item.id === 'online') return
                        setError(null)
                        setConfirmCash(false)
                        setMethod(item.id)
                      }}
                    />
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.description}</small>
                    </span>
                  </label>
                ))}
              </fieldset>
            </>
          )}
          {confirmCash ? null : (
            <p className="generate-sale-price">
              Precio de venta: <strong>{formatPrice(product.salePrice)}</strong>
            </p>
          )}
          {!confirmCash && available > 1 ? (
            <div className="field">
              <span id="generate-sale-qty">Cantidad</span>
              <div className="qty-stepper">
                <button
                  type="button"
                  aria-label="Quitar una unidad"
                  disabled={quantity <= 1}
                  onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                >
                  −
                </button>
                <output aria-labelledby="generate-sale-qty">{formatQuantity(quantity)}</output>
                <button
                  type="button"
                  aria-label="Agregar una unidad"
                  disabled={quantity >= available}
                  onClick={() =>
                    setQuantity((current) => Math.min(available, current + 1))
                  }
                >
                  +
                </button>
              </div>
              <small className="field__hint">
                Total {formatClp(Number(product.salePrice ?? 0) * quantity)} · hasta{' '}
                {formatQuantity(available)} disponibles
              </small>
            </div>
          ) : null}
        </>
      )}
    </Modal>
  )
}
