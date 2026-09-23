import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { TendaApiError } from '../lib/http'
import {
  updateInventoryLowStockThreshold,
  updateProductLowStockThreshold,
} from './api'

function errorMessage(error: unknown): string {
  return error instanceof TendaApiError
    ? error.message
    : 'No pudimos guardar el umbral.'
}

export function InventoryThresholdSetting({ current }: { current: number }) {
  const queryClient = useQueryClient()
  const [value, setValue] = useState(String(current))
  const save = useMutation({
    mutationFn: () => updateInventoryLowStockThreshold(Number(value)),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['inventory'] }),
  })
  const numeric = Number(value)
  const valid = Number.isInteger(numeric) && numeric >= 0

  return (
    <form
      className="threshold-setting"
      onSubmit={(event) => {
        event.preventDefault()
        if (valid) save.mutate()
      }}
    >
      <label htmlFor="inventory-low-stock-threshold">
        Se genera alerta cuando el stock disponible es menor a:
      </label>
      <div>
        <input
          id="inventory-low-stock-threshold"
          type="number"
          min={0}
          step={1}
          value={value}
          aria-invalid={!valid}
          onChange={(event) => setValue(event.target.value)}
        />
        <button
          className="button button--secondary button--compact"
          type="submit"
          disabled={!valid || save.isPending}
        >
          Guardar
        </button>
      </div>
      <small>Se crea una sola alerta cuando el disponible llega a este valor.</small>
      {save.error ? <span role="alert">{errorMessage(save.error)}</span> : null}
    </form>
  )
}

export function ProductThresholdSetting({
  productId,
  value: current,
  effective,
}: {
  productId: string
  value: number | null
  effective: number
}) {
  const queryClient = useQueryClient()
  const [value, setValue] = useState(current === null ? '' : String(current))
  const save = useMutation({
    mutationFn: () =>
      updateProductLowStockThreshold(productId, value === '' ? null : Number(value)),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['inventory'] }),
  })
  const numeric = value === '' ? null : Number(value)
  const valid = numeric === null || (Number.isInteger(numeric) && numeric >= 0)

  return (
    <form
      className="threshold-setting"
      onSubmit={(event) => {
        event.preventDefault()
        if (valid) save.mutate()
      }}
    >
      <label htmlFor="product-low-stock-threshold">Alerta de stock bajo</label>
      <div>
        <input
          id="product-low-stock-threshold"
          type="number"
          min={0}
          step={1}
          value={value}
          placeholder={`General: ${effective}`}
          aria-invalid={!valid}
          onChange={(event) => setValue(event.target.value)}
        />
        <button
          className="button button--secondary button--compact"
          type="submit"
          disabled={!valid || save.isPending}
        >
          Guardar
        </button>
      </div>
      <small>
        Déjalo vacío para usar el umbral general ({effective} unidades).
      </small>
      {save.error ? <span role="alert">{errorMessage(save.error)}</span> : null}
    </form>
  )
}
