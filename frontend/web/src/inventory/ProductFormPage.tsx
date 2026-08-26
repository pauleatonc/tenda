import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { FormErrorSummary } from '../components/ui'
import { TendaApiError, newIdempotencyKey } from '../lib/http'
import {
  createProduct,
  fetchInventorySchema,
  fetchProductDetail,
  inventoryKeys,
  updateProduct,
  type CustomField,
} from './api'
import { CustomFieldDialog } from './CustomFieldDialog'
import { catalogStatusLabels } from './format'

type DraftValues = Record<string, string>

function isBlank(value: string | undefined): boolean {
  return value === undefined || value.trim() === ''
}

/** Prices are CLP: integral, non-negative and `null` when left empty. */
function parsePrice(value: string): { ok: boolean; value: string | null } {
  if (isBlank(value)) return { ok: true, value: null }
  const numeric = Number(value)
  if (!Number.isInteger(numeric) || numeric < 0) return { ok: false, value: null }
  return { ok: true, value: String(numeric) }
}

function coerceAttribute(field: CustomField, raw: string): unknown {
  if (isBlank(raw)) return null
  if (field.fieldType === 'boolean') return raw === 'true'
  if (field.fieldType === 'decimal') return raw.trim()
  return raw.trim()
}

function attributeToDraft(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

export function ProductFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { productId } = useParams<{ productId: string }>()
  const isEdit = mode === 'edit'

  const [name, setName] = useState('')
  const [catalogStatus, setCatalogStatus] = useState('active')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [initialQuantity, setInitialQuantity] = useState('')
  const [attributes, setAttributes] = useState<DraftValues>({})
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [apiError, setApiError] = useState<TendaApiError | null>(null)
  const [showColumnDialog, setShowColumnDialog] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey)
  const summaryRef = useRef<HTMLDivElement>(null)

  const schema = useQuery({
    queryKey: inventoryKeys.schema(false),
    queryFn: () => fetchInventorySchema(false),
  })

  const product = useQuery({
    queryKey: inventoryKeys.product(productId ?? ''),
    queryFn: () => fetchProductDetail(productId ?? ''),
    enabled: isEdit && Boolean(productId),
  })

  // Hydrate the form once the product arrives; the draft wins afterwards.
  const loaded = useRef(false)
  useEffect(() => {
    if (!isEdit || loaded.current || !product.data) return
    const detail = product.data.product
    loaded.current = true
    setName(detail.name)
    setCatalogStatus(detail.catalogStatus)
    setPurchasePrice(detail.purchasePrice ?? '')
    setSalePrice(detail.salePrice ?? '')
    setAttributes(
      Object.fromEntries(
        Object.entries(detail.extraAttributes).map(([key, value]) => [
          key,
          attributeToDraft(value),
        ]),
      ),
    )
  }, [isEdit, product.data])

  useEffect(() => {
    if (!dirty) return
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const fields = useMemo(
    () => (schema.data?.fields ?? []).filter((field) => field.isActive),
    [schema.data],
  )

  const save = useMutation({
    mutationFn: async () => {
      const extraAttributes: Record<string, unknown> = {}
      for (const field of fields) {
        const value = coerceAttribute(field, attributes[field.key] ?? '')
        if (value !== null) extraAttributes[field.key] = value
      }
      const purchase = parsePrice(purchasePrice)
      const sale = parsePrice(salePrice)
      if (isEdit && productId) {
        return updateProduct({
          productId,
          name: name.trim(),
          catalogStatus,
          purchasePrice: purchase.value,
          salePrice: sale.value,
          clearPurchasePrice: purchase.value === null,
          clearSalePrice: sale.value === null,
          extraAttributes,
        })
      }
      const created = await createProduct({
        name: name.trim(),
        catalogStatus,
        purchasePrice: purchase.value,
        salePrice: sale.value,
        initialQuantity: isBlank(initialQuantity) ? 0 : Number(initialQuantity),
        reason: 'Carga inicial',
        extraAttributes,
        idempotencyKey,
      })
      return created.product
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ['inventory'] })
      setDirty(false)
      navigate(`/app/inventario/${saved.id}`, { replace: true })
    },
    onError: (error: unknown) => {
      if (error instanceof TendaApiError) {
        setApiError(error)
        setErrors(
          Object.fromEntries(
            Object.entries(error.fieldErrors).map(([field, messages]) => [
              field,
              messages[0],
            ]),
          ),
        )
        // A rejected submission gets a fresh key so the retry is not replayed.
        setIdempotencyKey(newIdempotencyKey())
      } else {
        setApiError(null)
      }
      summaryRef.current?.focus()
    },
  })

  function validate(): boolean {
    const nextErrors: Record<string, string | undefined> = {}
    if (isBlank(name)) nextErrors.name = 'Escribe el nombre del producto.'
    if (!parsePrice(purchasePrice).ok) {
      nextErrors.purchasePrice = 'Usa un monto entero en pesos, sin decimales.'
    }
    if (!parsePrice(salePrice).ok) {
      nextErrors.salePrice = 'Usa un monto entero en pesos, sin decimales.'
    }
    if (!isEdit && !isBlank(initialQuantity)) {
      const quantity = Number(initialQuantity)
      if (!Number.isInteger(quantity) || quantity < 0) {
        nextErrors.initialQuantity = 'Ingresa una cantidad entera de 0 o más.'
      }
    }
    for (const field of fields) {
      if (field.isRequired && isBlank(attributes[field.key])) {
        nextErrors[`extraAttributes.${field.key}`] = `Completa ${field.label}.`
      }
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) summaryRef.current?.focus()
    return Object.keys(nextErrors).length === 0
  }

  function leave() {
    if (dirty && !window.confirm('Tienes cambios sin guardar. ¿Quieres salir?')) return
    navigate(isEdit && productId ? `/app/inventario/${productId}` : '/app/inventario')
  }

  if (isEdit && product.isPending) {
    return <p aria-live="polite">Cargando producto…</p>
  }

  if (isEdit && !product.isPending && !product.data) {
    return (
      <>
        <header className="page-heading">
          <div>
            <h1>Producto no encontrado</h1>
            <p>El producto no existe o pertenece a otra organización.</p>
          </div>
        </header>
        <Link className="button button--secondary" to="/app/inventario">
          Volver al inventario
        </Link>
      </>
    )
  }

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">Inventario</p>
          <h1>{isEdit ? 'Editar producto' : 'Nuevo producto'}</h1>
          <p>
            {isEdit
              ? 'Editar no cambia el stock: cualquier ajuste de cantidad se registra como movimiento.'
              : 'Registra el mínimo necesario. Puedes ampliar la ficha con columnas propias.'}
          </p>
        </div>
      </header>

      <div ref={summaryRef} tabIndex={-1}>
        <FormErrorSummary errors={errors} />
      </div>
      {apiError ? (
        <div className="form-message form-message--error" role="alert">
          <strong>No pudimos guardar el producto</strong>
          <span>{apiError.message}</span>
          {apiError.correlationId ? (
            <small>Referencia: {apiError.correlationId}</small>
          ) : null}
        </div>
      ) : null}

      <form
        className="product-form"
        onSubmit={(event) => {
          event.preventDefault()
          setApiError(null)
          if (!validate()) return
          save.mutate()
        }}
      >
        <fieldset>
          <legend>Datos básicos</legend>

          <div className="field">
            <label htmlFor="name">Nombre</label>
            <input
              id="name"
              value={name}
              maxLength={160}
              aria-invalid={Boolean(errors.name)}
              onChange={(event) => {
                setName(event.target.value)
                setDirty(true)
              }}
            />
            {errors.name ? <small className="field__error">{errors.name}</small> : null}
          </div>

          {!isEdit ? (
            <div className="field">
              <label htmlFor="initialQuantity">Cantidad inicial</label>
              <input
                id="initialQuantity"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={initialQuantity}
                aria-invalid={Boolean(errors.initialQuantity)}
                onChange={(event) => {
                  setInitialQuantity(event.target.value)
                  setDirty(true)
                }}
              />
              {errors.initialQuantity ? (
                <small className="field__error">{errors.initialQuantity}</small>
              ) : (
                <small className="field__hint">
                  Se registra como una entrada inicial en el historial.
                </small>
              )}
            </div>
          ) : null}

          <div className="field">
            <label htmlFor="catalogStatus">Estado de catálogo</label>
            <select
              id="catalogStatus"
              value={catalogStatus}
              onChange={(event) => {
                setCatalogStatus(event.target.value)
                setDirty(true)
              }}
            >
              {['active', 'inactive'].map((status) => (
                <option key={status} value={status}>
                  {catalogStatusLabels[status]}
                </option>
              ))}
            </select>
          </div>
        </fieldset>

        <fieldset>
          <legend>Precios de referencia</legend>
          <p className="fieldset-hint">
            Son referencias del producto. El precio efectivo se define en cada venta y
            puede variar entre unidades. Moneda: CLP.
          </p>

          <div className="field">
            <label htmlFor="purchasePrice">Precio de compra</label>
            <input
              id="purchasePrice"
              inputMode="numeric"
              value={purchasePrice}
              aria-invalid={Boolean(errors.purchasePrice)}
              onChange={(event) => {
                setPurchasePrice(event.target.value)
                setDirty(true)
              }}
            />
            {errors.purchasePrice ? (
              <small className="field__error">{errors.purchasePrice}</small>
            ) : (
              <small className="field__hint">Déjalo vacío si aún no lo defines.</small>
            )}
          </div>

          <div className="field">
            <label htmlFor="salePrice">Precio de venta</label>
            <input
              id="salePrice"
              inputMode="numeric"
              value={salePrice}
              aria-invalid={Boolean(errors.salePrice)}
              onChange={(event) => {
                setSalePrice(event.target.value)
                setDirty(true)
              }}
            />
            {errors.salePrice ? (
              <small className="field__error">{errors.salePrice}</small>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="currency">Moneda</label>
            <input id="currency" value="CLP" readOnly disabled />
          </div>
        </fieldset>

        <fieldset>
          <legend>Datos adicionales</legend>
          {!fields.length ? (
            <p className="fieldset-hint">
              Todavía no defines columnas propias para este inventario.
            </p>
          ) : null}
          {fields.map((field) => {
            const errorKey = `extraAttributes.${field.key}`
            const value = attributes[field.key] ?? ''
            const update = (next: string) => {
              setAttributes((current) => ({ ...current, [field.key]: next }))
              setDirty(true)
            }
            return (
              <div className="field" key={field.id}>
                <label htmlFor={errorKey}>
                  {field.label}
                  {field.isRequired ? ' *' : ''}
                </label>
                {field.fieldType === 'single_select' ? (
                  <select
                    id={errorKey}
                    value={value}
                    onChange={(event) => update(event.target.value)}
                  >
                    <option value="">Sin definir</option>
                    {field.options.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : field.fieldType === 'boolean' ? (
                  <select
                    id={errorKey}
                    value={value}
                    onChange={(event) => update(event.target.value)}
                  >
                    <option value="">Sin definir</option>
                    <option value="true">Sí</option>
                    <option value="false">No</option>
                  </select>
                ) : (
                  <input
                    id={errorKey}
                    type={field.fieldType === 'date' ? 'date' : 'text'}
                    inputMode={field.fieldType === 'decimal' ? 'decimal' : undefined}
                    value={value}
                    aria-invalid={Boolean(errors[errorKey])}
                    onChange={(event) => update(event.target.value)}
                  />
                )}
                {errors[errorKey] ? (
                  <small className="field__error">{errors[errorKey]}</small>
                ) : field.helpText ? (
                  <small className="field__hint">{field.helpText}</small>
                ) : null}
              </div>
            )
          })}

          <button
            className="button button--secondary"
            type="button"
            onClick={() => setShowColumnDialog(true)}
          >
            Agregar columna
          </button>
        </fieldset>

        <fieldset>
          <legend>Fotos</legend>
          <p className="fieldset-hint">
            {isEdit
              ? 'Guarda los cambios y administra la galería privada desde el detalle del producto.'
              : 'Después de crear el producto podrás cargar hasta 10 fotos y elegir una principal.'}
          </p>
        </fieldset>

        <div className="form-row">
          <button
            className="button button--primary"
            type="submit"
            disabled={save.isPending}
          >
            {save.isPending
              ? 'Guardando…'
              : isEdit
                ? 'Guardar cambios'
                : 'Crear producto'}
          </button>
          <button className="button button--secondary" type="button" onClick={leave}>
            Cancelar
          </button>
        </div>
      </form>

      {showColumnDialog ? (
        <CustomFieldDialog
          onClose={() => setShowColumnDialog(false)}
          onFieldCreated={(field) => {
            // The draft survives: only the new key is seeded, by key not position.
            setAttributes((current) => ({ ...current, [field.key]: '' }))
          }}
        />
      ) : null}
    </>
  )
}
