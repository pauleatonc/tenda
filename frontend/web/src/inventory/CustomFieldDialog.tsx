import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { TendaApiError } from '../lib/http'
import { Modal } from '../components/ui'
import {
  createCustomField,
  fetchInventorySchema,
  inventoryKeys,
  reorderCustomFields,
  updateCustomField,
  type CustomField,
} from './api'
import { fieldTypeLabels } from './format'

const FIELD_TYPES = ['short_text', 'decimal', 'date', 'boolean', 'single_select'] as const

/** Mirrors `slugify_key` in the backend so the preview matches what is stored. */
function previewKey(label: string): string {
  return label
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60)
}

type Props = {
  onClose: () => void
  onFieldCreated?: (field: CustomField) => void
}

export function CustomFieldDialog({ onClose, onFieldCreated }: Props) {
  const queryClient = useQueryClient()
  const [label, setLabel] = useState('')
  const [fieldType, setFieldType] = useState<(typeof FIELD_TYPES)[number]>('short_text')
  const [helpText, setHelpText] = useState('')
  const [optionsText, setOptionsText] = useState('')
  const [isRequired, setIsRequired] = useState(false)
  const [isVisible, setIsVisible] = useState(true)
  const [isFilterable, setIsFilterable] = useState(false)
  const [defaultValue, setDefaultValue] = useState('')
  const [error, setError] = useState<TendaApiError | null>(null)

  const schema = useQuery({
    queryKey: inventoryKeys.schema(true),
    queryFn: () => fetchInventorySchema(true),
  })

  const fields = useMemo(() => schema.data?.fields ?? [], [schema.data])
  const activeFields = fields.filter((field) => field.isActive)
  const maxActive = schema.data?.maxActiveFields ?? 15
  const remaining = maxActive - activeFields.length

  function invalidateSchema() {
    void queryClient.invalidateQueries({ queryKey: ['inventory'] })
  }

  const create = useMutation({
    mutationFn: createCustomField,
    onSuccess: (field) => {
      invalidateSchema()
      setLabel('')
      setHelpText('')
      setOptionsText('')
      setIsRequired(false)
      setIsFilterable(false)
      setDefaultValue('')
      setError(null)
      onFieldCreated?.(field)
    },
    onError: (mutationError: unknown) => {
      setError(mutationError instanceof TendaApiError ? mutationError : null)
    },
  })

  const update = useMutation({
    mutationFn: updateCustomField,
    onSuccess: invalidateSchema,
    onError: (mutationError: unknown) => {
      setError(mutationError instanceof TendaApiError ? mutationError : null)
    },
  })

  const reorder = useMutation({
    mutationFn: reorderCustomFields,
    onSuccess: invalidateSchema,
  })

  function move(index: number, direction: -1 | 1) {
    const ordered = [...fields]
    const target = index + direction
    if (target < 0 || target >= ordered.length) return
    const [moved] = ordered.splice(index, 1)
    ordered.splice(target, 0, moved)
    reorder.mutate(ordered.map((field) => field.id))
  }

  const options = optionsText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const needsOptions = fieldType === 'single_select'
  const canSubmit =
    label.trim().length > 0 && (!needsOptions || options.length > 0) && remaining > 0

  return (
    <Modal
      title="Columnas del inventario"
      description={`Puedes tener hasta ${maxActive} columnas activas. Desactivar libera un cupo y conserva los valores guardados.`}
      onClose={onClose}
      size="large"
      footer={
        <button className="button button--secondary" type="button" onClick={onClose}>
          Cerrar
        </button>
      }
    >
      {error ? (
        <div className="form-message form-message--error" role="alert">
          <strong>No pudimos guardar la columna</strong>
          <span>{error.message}</span>
          {error.correlationId ? <small>Referencia: {error.correlationId}</small> : null}
        </div>
      ) : null}

      <section aria-label="Columnas existentes" className="column-manager">
        <div className="column-manager__head">
          <strong>Columnas actuales</strong>
          <span>
            {activeFields.length} de {maxActive} activas
          </span>
        </div>
        {schema.isPending ? <p>Cargando columnas…</p> : null}
        {!schema.isPending && !fields.length ? (
          <p className="column-manager__empty">
            Aún no defines columnas propias. Crea la primera abajo.
          </p>
        ) : null}
        <ul>
          {fields.map((field, index) => (
            <li key={field.id} className={field.isActive ? '' : 'is-inactive'}>
              <div>
                <strong>{field.label}</strong>
                <small>
                  {fieldTypeLabels[field.fieldType] ?? field.fieldType} · {field.key}
                  {field.isRequired ? ' · obligatorio' : ''}
                  {field.isActive ? '' : ' · desactivada'}
                </small>
              </div>
              <div className="column-manager__actions">
                <button
                  type="button"
                  aria-label={`Subir ${field.label}`}
                  disabled={index === 0 || reorder.isPending}
                  onClick={() => move(index, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`Bajar ${field.label}`}
                  disabled={index === fields.length - 1 || reorder.isPending}
                  onClick={() => move(index, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  disabled={update.isPending || (!field.isActive && remaining <= 0)}
                  onClick={() =>
                    update.mutate({ fieldId: field.id, isActive: !field.isActive })
                  }
                >
                  {field.isActive ? 'Desactivar' : 'Reactivar'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <form
        className="column-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (!canSubmit) return
          create.mutate({
            label: label.trim(),
            fieldType,
            helpText: helpText.trim() || null,
            isRequired,
            isVisible,
            isFilterable,
            options: needsOptions ? options.map((value) => ({ label: value })) : null,
            defaultValue: defaultValue.trim() || null,
          })
        }}
      >
        <h3>Nueva columna</h3>
        {remaining <= 0 ? (
          <p className="column-form__limit" role="status">
            Alcanzaste el máximo de {maxActive} columnas activas. Desactiva una para
            liberar cupo.
          </p>
        ) : null}

        <div className="field">
          <label htmlFor="column-label">Etiqueta</label>
          <input
            id="column-label"
            value={label}
            maxLength={80}
            onChange={(event) => setLabel(event.target.value)}
            aria-describedby="column-key-hint"
          />
          <small id="column-key-hint" className="field__hint">
            Identificador estable: {previewKey(label) || '—'}
          </small>
        </div>

        <div className="field">
          <label htmlFor="column-type">Tipo</label>
          <select
            id="column-type"
            value={fieldType}
            onChange={(event) =>
              setFieldType(event.target.value as (typeof FIELD_TYPES)[number])
            }
          >
            {FIELD_TYPES.map((type) => (
              <option key={type} value={type}>
                {fieldTypeLabels[type]}
              </option>
            ))}
          </select>
        </div>

        {needsOptions ? (
          <div className="field">
            <label htmlFor="column-options">Opciones (una por línea)</label>
            <textarea
              id="column-options"
              rows={3}
              value={optionsText}
              onChange={(event) => setOptionsText(event.target.value)}
            />
          </div>
        ) : null}

        <div className="field">
          <label htmlFor="column-help">Ayuda (opcional)</label>
          <input
            id="column-help"
            value={helpText}
            maxLength={160}
            onChange={(event) => setHelpText(event.target.value)}
          />
        </div>

        <div className="column-form__toggles">
          <label>
            <input
              type="checkbox"
              checked={isRequired}
              onChange={(event) => setIsRequired(event.target.checked)}
            />
            Obligatoria
          </label>
          <label>
            <input
              type="checkbox"
              checked={isVisible}
              onChange={(event) => setIsVisible(event.target.checked)}
            />
            Visible en la tabla
          </label>
          <label>
            <input
              type="checkbox"
              checked={isFilterable}
              onChange={(event) => setIsFilterable(event.target.checked)}
            />
            Se puede filtrar
          </label>
        </div>

        {isRequired ? (
          <div className="field">
            <label htmlFor="column-default">Valor para productos existentes</label>
            <input
              id="column-default"
              value={defaultValue}
              onChange={(event) => setDefaultValue(event.target.value)}
            />
            <small className="field__hint">
              Una columna obligatoria necesita un valor para completar los productos ya
              creados.
            </small>
          </div>
        ) : null}

        <button
          className="button button--primary"
          type="submit"
          disabled={!canSubmit || create.isPending}
        >
          {create.isPending ? 'Guardando…' : 'Guardar columna'}
        </button>
      </form>
    </Modal>
  )
}
