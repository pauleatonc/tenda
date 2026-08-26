import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { Modal } from '../components/ui'
import { TendaApiError, newIdempotencyKey } from '../lib/http'
import { recordStockMovement, type ProductRow } from './api'
import { formatQuantity, movementLabels } from './format'

const MOVEMENT_TYPES = ['entry', 'exit', 'shrinkage', 'correction'] as const
type MovementType = (typeof MOVEMENT_TYPES)[number]

function projectedBalance(
  current: number,
  movementType: MovementType,
  quantity: number,
): number {
  if (!Number.isFinite(quantity)) return current
  if (movementType === 'entry') return current + Math.abs(quantity)
  if (movementType === 'correction') return current + quantity
  return current - Math.abs(quantity)
}

export function StockAdjustDialog({
  product,
  onClose,
  onDone,
}: {
  product: ProductRow
  onClose: () => void
  onDone?: (product: ProductRow) => void
}) {
  const queryClient = useQueryClient()
  const [movementType, setMovementType] = useState<MovementType>('entry')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<TendaApiError | null>(null)
  /** One key per open dialog: resubmitting the same adjustment stays a no-op. */
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey)

  const parsedQuantity = Number(quantity)
  const before = product.stock.onHand
  const after = useMemo(
    () => projectedBalance(before, movementType, parsedQuantity),
    [before, movementType, parsedQuantity],
  )

  const reasonRequired = movementType === 'shrinkage' || movementType === 'correction'
  const invalidQuantity =
    quantity.trim() === '' ||
    !Number.isInteger(parsedQuantity) ||
    (movementType !== 'correction' && parsedQuantity <= 0) ||
    (movementType === 'correction' && parsedQuantity === 0)
  const wouldGoNegative = after < 0

  const submit = useMutation({
    mutationFn: recordStockMovement,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['inventory'] })
      onDone?.(result.product)
      onClose()
    },
    onError: (mutationError: unknown) => {
      setError(mutationError instanceof TendaApiError ? mutationError : null)
      // A rejected attempt gets a new key so a corrected retry is accepted.
      setIdempotencyKey(newIdempotencyKey())
    },
  })

  const blocked = invalidQuantity || wouldGoNegative || (reasonRequired && !reason.trim())

  return (
    <Modal
      title={`Ajustar stock · ${product.name}`}
      description="El movimiento queda registrado en el historial y no se puede editar ni borrar."
      onClose={onClose}
      footer={
        <>
          <button className="button button--secondary" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="button button--primary"
            type="submit"
            form="stock-adjust-form"
            disabled={blocked || submit.isPending}
          >
            {submit.isPending ? 'Registrando…' : 'Confirmar ajuste'}
          </button>
        </>
      }
    >
      {error ? (
        <div className="form-message form-message--error" role="alert">
          <strong>No pudimos registrar el movimiento</strong>
          <span>{error.message}</span>
          {error.correlationId ? <small>Referencia: {error.correlationId}</small> : null}
        </div>
      ) : null}

      <form
        id="stock-adjust-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (blocked) return
          submit.mutate({
            productId: product.id,
            movementType,
            quantity:
              movementType === 'correction' ? parsedQuantity : Math.abs(parsedQuantity),
            reason: reason.trim() || null,
            note: note.trim() || null,
            idempotencyKey,
          })
        }}
      >
        <fieldset className="movement-type">
          <legend>Tipo de movimiento</legend>
          {MOVEMENT_TYPES.map((type) => (
            <label key={type}>
              <input
                type="radio"
                name="movementType"
                value={type}
                checked={movementType === type}
                onChange={() => setMovementType(type)}
              />
              {movementLabels[type]}
            </label>
          ))}
        </fieldset>

        <div className="field">
          <label htmlFor="movement-quantity">
            {movementType === 'correction'
              ? 'Cantidad (usa signo negativo para descontar)'
              : 'Cantidad'}
          </label>
          <input
            id="movement-quantity"
            type="number"
            inputMode="numeric"
            step={1}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            aria-invalid={quantity !== '' && invalidQuantity}
          />
        </div>

        <div className="field">
          <label htmlFor="movement-reason">
            Motivo {reasonRequired ? '' : '(opcional)'}
          </label>
          <input
            id="movement-reason"
            value={reason}
            maxLength={120}
            onChange={(event) => setReason(event.target.value)}
            aria-invalid={reasonRequired && !reason.trim()}
          />
          {reasonRequired && !reason.trim() ? (
            <small className="field__error">
              Las mermas y correcciones necesitan un motivo.
            </small>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="movement-note">Nota (opcional)</label>
          <textarea
            id="movement-note"
            rows={2}
            maxLength={280}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>

        <div className="balance-preview" aria-live="polite">
          <div>
            <span>Saldo actual</span>
            <strong>{formatQuantity(before)}</strong>
          </div>
          <span aria-hidden="true">→</span>
          <div>
            <span>Saldo después</span>
            <strong>{invalidQuantity ? '—' : formatQuantity(after)}</strong>
          </div>
        </div>
        {wouldGoNegative && !invalidQuantity ? (
          <p className="field__error" role="alert">
            No hay unidades suficientes: el saldo quedaría en {formatQuantity(after)}.
          </p>
        ) : null}
        {product.stock.reserved > 0 ? (
          <p className="field__hint">
            {formatQuantity(product.stock.reserved)} unidades están reservadas y no pueden
            descontarse con un ajuste.
          </p>
        ) : null}
      </form>
    </Modal>
  )
}
