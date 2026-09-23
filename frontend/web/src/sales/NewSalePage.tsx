import { organisationHasBankDetails } from '@tenda/api-client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'

import { BankDetailsRequiredNotice } from '../app/BankDetailsRequiredNotice'
import type { ViewerPayload } from '../auth/api'
import { Modal, SearchField, StatusChip } from '../components/ui'
import { fetchProducts, inventoryKeys, type ProductRow } from '../inventory/api'
import { TendaApiError, newIdempotencyKey } from '../lib/http'
import {
  createOrder,
  fetchPaymentConnection,
  publishOrderLink,
  salesKeys,
  sendOfferLink,
} from './api'
import {
  clearSaleDraft,
  createEmptySaleDraft,
  discountedPrice,
  formatClp,
  paymentMethodLabels,
  resolveSaleDraftOnEnter,
  saleDraftTotal,
  saveSaleDraft,
  type CompletedSaleNotice,
  type SaleDraft,
  type SaleDraftLine,
  validateDraftLines,
} from './model'

const steps = ['Productos y precios', 'Entrega y pago', 'Revisión', 'Enlace listo']

function isValidEmail(value: string) {
  const email = value.trim()
  return Boolean(email) && email.includes('@') && !email.includes(' ')
}

class OfflineSubmissionError extends Error {
  constructor() {
    super(
      'No enviaremos la venta sin conexión. El borrador quedó guardado en este equipo.',
    )
    this.name = 'OfflineSubmissionError'
  }
}

function lineFromProduct(product: ProductRow): SaleDraftLine {
  return {
    clientId: crypto.randomUUID(),
    productId: product.id,
    productName: product.name,
    available: product.stock.available,
    reserved: product.stock.reserved,
    quantity: 1,
    referencePrice: product.salePrice ?? '',
    unitSalePrice: product.salePrice ?? '',
    discountPercent: '',
  }
}

export function NewSalePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const viewer = useOutletContext<ViewerPayload | undefined>()
  const hasBankDetails = viewer
    ? organisationHasBankDetails(viewer.organisation)
    : true
  const [entry] = useState(resolveSaleDraftOnEnter)
  const [draft, setDraft] = useState<SaleDraft>(entry.draft)
  const [completedNotice, setCompletedNotice] = useState<CompletedSaleNotice | null>(
    entry.completed,
  )
  const [search, setSearch] = useState('')
  const [submitError, setSubmitError] = useState<Error | null>(null)
  const [copied, setCopied] = useState(false)
  const [confirmCash, setConfirmCash] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [emailError, setEmailError] = useState<Error | null>(null)
  const [emailKey, setEmailKey] = useState(newIdempotencyKey)

  useEffect(() => {
    saveSaleDraft(draft)
  }, [draft])

  const products = useQuery({
    queryKey: inventoryKeys.products({
      filter: { search, catalogStatuses: ['active'], includeArchived: false },
      first: 10,
    }),
    queryFn: () =>
      fetchProducts({
        filter: {
          search: search || null,
          catalogStatuses: ['active'],
          includeArchived: false,
        },
        first: 10,
      }),
    enabled: draft.step === 1,
  })

  const paymentConnection = useQuery({
    queryKey: salesKeys.paymentConnection(),
    queryFn: fetchPaymentConnection,
  })

  const validation = useMemo(() => validateDraftLines(draft.lines), [draft.lines])
  const total = saleDraftTotal(draft.lines)
  const mercadoPagoActive = ['active', 'connected'].includes(
    paymentConnection.data?.sellerPaymentConnection?.status ?? '',
  )
  const selectedPaymentMethod =
    draft.paymentMethod === 'mercado_pago' && !mercadoPagoActive
      ? 'bank_transfer'
      : draft.paymentMethod
  const depositBlocked =
    selectedPaymentMethod === 'bank_transfer' && !hasBankDetails
  const isCash = selectedPaymentMethod === 'cash'

  function replaceDraft(update: (current: SaleDraft) => SaleDraft) {
    setDraft((current) => {
      const next = update(current)
      saveSaleDraft(next)
      return next
    })
  }

  function updateLine(clientId: string, update: Partial<SaleDraftLine>) {
    replaceDraft((current) => ({
      ...current,
      lines: current.lines.map((line) =>
        line.clientId === clientId ? { ...line, ...update } : line,
      ),
    }))
  }

  const submit = useMutation({
    mutationFn: async () => {
      if (!navigator.onLine) throw new OfflineSubmissionError()

      let orderId = draft.createdOrderId
      if (!orderId) {
        const created = await createOrder({
          lines: draft.lines.map((line) => ({
            productId: line.productId,
            quantity: line.quantity,
            unitSalePrice: line.unitSalePrice,
          })),
          deliveryMode: draft.deliveryMode,
          paymentMethod: selectedPaymentMethod,
          idempotencyKey: draft.idempotencyKey,
        })
        orderId = created.order.id
        const withOrder: SaleDraft = {
          ...draft,
          createdOrderId: orderId,
          updatedAt: new Date().toISOString(),
        }
        saveSaleDraft(withOrder)
        setDraft(withOrder)
      }

      if (selectedPaymentMethod === 'cash') {
        return { orderId, publicUrl: null }
      }

      const published = await publishOrderLink({
        orderId,
        idempotencyKey: draft.publishIdempotencyKey,
      })
      return { orderId, publicUrl: published.publicUrl }
    },
    onSuccess: ({ orderId, publicUrl }) => {
      setSubmitError(null)
      setConfirmCash(false)
      void queryClient.invalidateQueries({ queryKey: ['sales'] })
      void queryClient.invalidateQueries({ queryKey: ['inventory'] })
      if (selectedPaymentMethod === 'cash' || !publicUrl) {
        clearSaleDraft()
        navigate(`/app/ventas/${orderId}`)
        return
      }
      const complete: SaleDraft = {
        ...draft,
        step: 4,
        createdOrderId: orderId,
        publicUrl,
        updatedAt: new Date().toISOString(),
      }
      setDraft(complete)
      saveSaleDraft(complete)
    },
    onError: (error: Error) => {
      setSubmitError(error)
    },
  })

  const sendEmail = useMutation({
    mutationFn: () => {
      if (!draft.createdOrderId) throw new Error('Falta la venta publicada.')
      return sendOfferLink({
        orderId: draft.createdOrderId,
        email: email.trim(),
        idempotencyKey: emailKey,
      })
    },
    onSuccess: () => {
      setEmailSent(true)
      setEmailError(null)
      setEmailOpen(false)
    },
    onError: (error: Error) => {
      setEmailError(error)
      setEmailKey(newIdempotencyKey())
    },
  })

  function goToStep(step: SaleDraft['step']) {
    if (step > 1 && !validation.valid) return
    setSubmitError(null)
    replaceDraft((current) => ({ ...current, step }))
  }

  function reset() {
    clearSaleDraft()
    const empty = createEmptySaleDraft()
    setDraft(empty)
    setCompletedNotice(null)
    setSubmitError(null)
    setCopied(false)
    setEmailOpen(false)
    setEmail('')
    setEmailSent(false)
    setEmailError(null)
    setEmailKey(newIdempotencyKey())
  }

  function leaveToSales() {
    if (draft.step === 4) {
      clearSaleDraft()
      setDraft(createEmptySaleDraft())
      setCompletedNotice(null)
    }
    navigate('/app/ventas')
  }

  return (
    <>
      <header className="page-heading page-heading--split">
        <div>
          <p className="eyebrow">Venta con reserva</p>
          <h1>Nueva venta</h1>
          <p>
            El borrador se guarda en este equipo hasta que completes o descartes la venta.
          </p>
        </div>
        <button className="button button--secondary" type="button" onClick={leaveToSales}>
          Volver a ventas
        </button>
      </header>

      {completedNotice ? (
        <div className="sales-notice" role="status">
          <strong>La venta ya está creada</strong>
          <span>Ábrela para copiar el enlace o sigue con una venta nueva.</span>
          <Link to={`/app/ventas/${completedNotice.orderId}`}>Ver ficha</Link>
        </div>
      ) : null}

      <nav className="sale-steps" aria-label="Pasos de la venta">
        {steps.map((label, index) => {
          const step = (index + 1) as SaleDraft['step']
          const current = step === draft.step
          return (
            <button
              key={label}
              type="button"
              aria-current={current ? 'step' : undefined}
              disabled={step > draft.step || draft.step === 4}
              onClick={() => goToStep(step)}
            >
              <span>{step}</span>
              {label}
            </button>
          )
        })}
      </nav>

      {submitError ? (
        <div className="form-message form-message--error" role="alert">
          <strong>No pudimos crear y publicar la venta</strong>
          <span>
            {submitError instanceof TendaApiError ||
            submitError instanceof OfflineSubmissionError
              ? submitError.message
              : 'La conexión se interrumpió. Conservamos el borrador y la clave de envío para reintentar sin duplicar la reserva.'}
          </span>
          <small>
            Puedes reintentar: Tenda reutilizará la misma clave idempotente y no pondrá la
            operación en una cola offline.
          </small>
        </div>
      ) : null}

      {draft.step === 1 ? (
        <section className="sale-wizard-card">
          <div className="sale-wizard-card__heading">
            <div>
              <span>Paso 1 de 4</span>
              <h2>Productos, cantidades y precios efectivos</h2>
              <p>
                Puedes agregar el mismo producto en líneas separadas para aplicar precios
                distintos.
              </p>
            </div>
          </div>

          <div className="product-search">
            <SearchField
              value={search}
              onChange={setSearch}
              label="Buscar productos activos"
              placeholder="Buscar producto activo…"
            />
            {products.isPending ? <p aria-live="polite">Buscando productos…</p> : null}
            {products.isError ? (
              <div className="form-message form-message--error" role="alert">
                <span>No pudimos buscar productos.</span>
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => void products.refetch()}
                >
                  Reintentar
                </button>
              </div>
            ) : null}
            {products.data ? (
              <ul className="product-search__results">
                {products.data.products.map((product) => (
                  <li key={product.id}>
                    <div>
                      <strong>{product.name}</strong>
                      <span>
                        Disponible {product.stock.available} · Reservado{' '}
                        {product.stock.reserved}
                      </span>
                      <small>Precio de referencia: {formatClp(product.salePrice)}</small>
                    </div>
                    <button
                      className="button button--secondary button--compact"
                      type="button"
                      disabled={product.stock.available < 1}
                      onClick={() =>
                        replaceDraft((current) => ({
                          ...current,
                          lines: [...current.lines, lineFromProduct(product)],
                        }))
                      }
                    >
                      {product.stock.available < 1
                        ? 'Sin disponibilidad'
                        : 'Agregar artículo'}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="sale-lines">
            <h3>Artículos en venta</h3>
            {!draft.lines.length ? (
              <p className="sale-lines__empty">
                Busca un producto activo y agrega al menos una línea.
              </p>
            ) : (
              <ol>
                {draft.lines.map((line, index) => (
                  <li key={line.clientId}>
                    <header>
                      <div>
                        <strong>
                          {line.productName} · línea {index + 1}
                        </strong>
                        <span>
                          Disponible agregado {line.available} · ya reservado{' '}
                          {line.reserved}
                        </span>
                      </div>
                      <button
                        type="button"
                        aria-label={`Eliminar línea ${index + 1} de ${line.productName}`}
                        onClick={() =>
                          replaceDraft((current) => ({
                            ...current,
                            lines: current.lines.filter(
                              (candidate) => candidate.clientId !== line.clientId,
                            ),
                          }))
                        }
                      >
                        Eliminar
                      </button>
                    </header>
                    <div className="sale-line-fields">
                      <label>
                        <span>Cantidad</span>
                        <input
                          aria-label={`Cantidad línea ${index + 1} de ${line.productName}`}
                          type="number"
                          inputMode="numeric"
                          min={1}
                          step={1}
                          value={line.quantity}
                          onChange={(event) =>
                            updateLine(line.clientId, {
                              quantity: Number(event.target.value),
                            })
                          }
                        />
                      </label>
                      <label>
                        <span>Precio unitario efectivo (CLP)</span>
                        <input
                          aria-label={`Precio línea ${index + 1} de ${line.productName}`}
                          inputMode="numeric"
                          value={line.unitSalePrice}
                          onChange={(event) =>
                            updateLine(line.clientId, {
                              unitSalePrice: event.target.value,
                              discountPercent: '',
                            })
                          }
                        />
                        <small>Referencia: {formatClp(line.referencePrice)}</small>
                      </label>
                      <label>
                        <span>Descuento % (opcional)</span>
                        <input
                          aria-label={`Descuento línea ${index + 1} de ${line.productName}`}
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={100}
                          value={line.discountPercent}
                          onChange={(event) => {
                            const discountPercent = event.target.value
                            updateLine(line.clientId, {
                              discountPercent,
                              unitSalePrice: discountedPrice(
                                line.referencePrice,
                                discountPercent,
                              ),
                            })
                          }}
                        />
                        <small>
                          Solo calcula el precio; no se guarda como descuento.
                        </small>
                      </label>
                      <div>
                        <span>Total</span>
                        <strong>
                          {formatClp(line.quantity * Number(line.unitSalePrice || 0))}
                        </strong>
                      </div>
                    </div>
                    {validation.lineErrors[line.clientId] ? (
                      <p className="field__error">
                        {validation.lineErrors[line.clientId]}
                      </p>
                    ) : null}
                    {validation.productErrors[line.productId] ? (
                      <p className="field__error">
                        {validation.productErrors[line.productId]}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </div>

          <footer className="sale-wizard-footer">
            <strong>Total: {formatClp(total)}</strong>
            <button
              className="button button--primary"
              type="button"
              disabled={!validation.valid}
              onClick={() => goToStep(2)}
            >
              Continuar
            </button>
          </footer>
        </section>
      ) : null}

      {draft.step === 2 ? (
        <section className="sale-wizard-card">
          <div className="sale-wizard-card__heading">
            <div>
              <span>Paso 2 de 4</span>
              <h2>Entrega y método de pago</h2>
              <p>
                Al crear la venta, las unidades quedarán reservadas por 8 horas mientras
                el comprador completa el pago.
              </p>
            </div>
          </div>

          <fieldset className="choice-cards">
            <legend>Entrega</legend>
            {[
              [
                'shipping',
                'Despacho',
                'El comprador completará destinatario y dirección.',
              ],
              ['pickup', 'Retiro', 'El retiro se coordina directamente con el vendedor.'],
              [
                'coordinated',
                'Entrega coordinada',
                'La fecha y el lugar se acuerdan después de la compra.',
              ],
            ].map(([value, label, description]) => (
              <label key={value}>
                <input
                  type="radio"
                  name="delivery"
                  value={value}
                  checked={draft.deliveryMode === value}
                  onChange={() =>
                    replaceDraft((current) => ({
                      ...current,
                      deliveryMode: value as SaleDraft['deliveryMode'],
                    }))
                  }
                />
                <span>
                  <strong>{label}</strong>
                  <small>{description}</small>
                </span>
              </label>
            ))}
          </fieldset>

          <fieldset className="choice-cards">
            <legend>Pago</legend>
            {(['bank_transfer', 'cash', 'mercado_pago'] as const).map((method) => {
              const disabled = method === 'mercado_pago' && !mercadoPagoActive
              return (
                <label key={method} className={disabled ? 'is-disabled' : ''}>
                  <input
                    type="radio"
                    name="payment"
                    value={method}
                    checked={selectedPaymentMethod === method}
                    disabled={disabled}
                    onChange={() =>
                      replaceDraft((current) => ({
                        ...current,
                        paymentMethod: method,
                      }))
                    }
                  />
                  <span>
                    <strong>{paymentMethodLabels[method]}</strong>
                    <small>
                      {method === 'bank_transfer'
                        ? 'El comprador verá instrucciones y podrá subir su comprobante.'
                        : method === 'cash'
                          ? 'Registra el pago manualmente cuando lo recibas.'
                          : disabled
                            ? 'Conecta una cuenta activa en Configuración de pagos para habilitarlo.'
                            : 'El comprador será redirigido al checkout seguro de Mercado Pago.'}
                    </small>
                  </span>
                </label>
              )
            })}
          </fieldset>

          {!mercadoPagoActive ? (
            <p className="sales-notice">
              Mercado Pago está deshabilitado porque no hay una conexión activa.{' '}
              <Link to="/app/configuracion/pagos">Configurar pagos</Link>
            </p>
          ) : null}

          {depositBlocked ? <BankDetailsRequiredNotice /> : null}

          <footer className="sale-wizard-footer">
            <button
              className="button button--secondary"
              type="button"
              onClick={() => goToStep(1)}
            >
              Volver
            </button>
            <button
              className="button button--primary"
              type="button"
              disabled={depositBlocked}
              onClick={() => goToStep(3)}
            >
              Continuar
            </button>
          </footer>
        </section>
      ) : null}

      {draft.step === 3 ? (
        <section className="sale-wizard-card">
          <div className="sale-wizard-card__heading">
            <div>
              <span>Paso 3 de 4</span>
              <h2>{isCash ? 'Revisa antes de crear' : 'Revisa antes de generar venta'}</h2>
              <p>
                {isCash
                  ? 'Crear reserva el stock. Luego abrirás la ficha para completar los datos y registrar el pago.'
                  : 'Crear reserva el stock por 8 horas y genera un enlace. Tenda no lo enviará automáticamente a ningún contacto.'}
              </p>
            </div>
          </div>

          <div className="sale-review">
            <dl>
              <div>
                <dt>Entrega</dt>
                <dd>
                  {draft.deliveryMode === 'shipping'
                    ? 'Despacho'
                    : draft.deliveryMode === 'pickup'
                      ? 'Retiro'
                      : 'Entrega coordinada'}
                </dd>
              </div>
              <div>
                <dt>Pago</dt>
                <dd>{paymentMethodLabels[selectedPaymentMethod]}</dd>
              </div>
              <div>
                <dt>Reserva</dt>
                <dd>8 horas desde la creación</dd>
              </div>
            </dl>
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Producto</th>
                  <th scope="col">Cantidad</th>
                  <th scope="col">Precio efectivo</th>
                  <th scope="col">Total</th>
                </tr>
              </thead>
              <tbody>
                {draft.lines.map((line) => (
                  <tr key={line.clientId}>
                    <td>{line.productName}</td>
                    <td>{line.quantity}</td>
                    <td>{formatClp(line.unitSalePrice)}</td>
                    <td>{formatClp(line.quantity * Number(line.unitSalePrice))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="sale-review__total">Total {formatClp(total)}</p>
          </div>

          {depositBlocked ? <BankDetailsRequiredNotice /> : null}

          <footer className="sale-wizard-footer">
            <button
              className="button button--secondary"
              type="button"
              disabled={submit.isPending}
              onClick={() => goToStep(2)}
            >
              Volver
            </button>
            <button
              className="button button--primary"
              type="button"
              disabled={submit.isPending || !validation.valid || depositBlocked}
              onClick={() => {
                setSubmitError(null)
                if (isCash) {
                  setConfirmCash(true)
                  return
                }
                submit.mutate()
              }}
            >
              {submit.isPending
                ? isCash
                  ? 'Creando…'
                  : 'Creando y publicando…'
                : isCash
                  ? 'Crear venta en efectivo'
                  : 'Generar venta'}
            </button>
          </footer>
        </section>
      ) : null}

      {draft.step === 4 && draft.createdOrderId && draft.publicUrl ? (
        <section className="sale-result">
          <StatusChip status="success" label="Venta creada y stock reservado" />
          <h2>Tu enlace está listo</h2>
          <p>
            La reserva dura 8 horas. Compártelo solo cuando quieras: no enviamos mensajes
            automáticamente.
          </p>
          <label>
            <span>Enlace público</span>
            <input value={draft.publicUrl} readOnly />
          </label>
          <div className="sale-result__actions">
            <button
              className="button button--primary"
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(draft.publicUrl ?? '')
                setCopied(true)
              }}
            >
              {copied ? 'Copiado' : 'Copiar enlace'}
            </button>
            {'share' in navigator ? (
              <button
                className="button button--secondary"
                type="button"
                onClick={() =>
                  void navigator
                    .share({
                      title: 'Tu compra en Tenda',
                      text: 'Te comparto el detalle de tu compra.',
                      url: draft.publicUrl ?? '',
                    })
                    .catch(() => undefined)
                }
              >
                Compartir
              </button>
            ) : null}
            <a
              className="button button--secondary"
              href={draft.publicUrl}
              target="_blank"
              rel="noreferrer"
            >
              Vista previa
            </a>
            <Link
              className="button button--secondary"
              to={`/app/ventas/${draft.createdOrderId}`}
            >
              Ver detalle
            </Link>
            <button
              className="button button--secondary"
              type="button"
              onClick={() => {
                setEmailError(null)
                setEmailOpen(true)
              }}
            >
              Enviar por correo
            </button>
          </div>
          {emailSent ? (
            <div className="form-message form-message--success" role="status">
              <strong>Enlace enviado</strong>
              <span>Lo enviamos al correo indicado.</span>
            </div>
          ) : null}
          <div className="sale-result__new">
            <button className="text-link" type="button" onClick={reset}>
              Crear otra venta
            </button>
            <button className="text-link" type="button" onClick={leaveToSales}>
              Volver al listado
            </button>
          </div>
        </section>
      ) : null}

      {emailOpen ? (
        <Modal
          title="Enviar por correo"
          description="Ingresa el correo del comprador para enviarle el enlace."
          onClose={() => {
            if (!sendEmail.isPending) setEmailOpen(false)
          }}
          footer={
            <>
              <button
                className="button button--secondary"
                type="button"
                disabled={sendEmail.isPending}
                onClick={() => setEmailOpen(false)}
              >
                Volver
              </button>
              <button
                className="button button--primary"
                type="button"
                disabled={sendEmail.isPending || !isValidEmail(email)}
                onClick={() => sendEmail.mutate()}
              >
                {sendEmail.isPending ? 'Enviando…' : 'Enviar'}
              </button>
            </>
          }
        >
          {emailError ? (
            <div className="form-message form-message--error" role="alert">
              <span>
                {emailError instanceof TendaApiError
                  ? emailError.message
                  : 'No pudimos enviar el correo. Inténtalo nuevamente.'}
              </span>
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="new-sale-email">Correo del comprador</label>
            <input
              id="new-sale-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              placeholder="correo@ejemplo.cl"
              onChange={(event) => {
                setEmail(event.target.value)
                setEmailSent(false)
              }}
            />
            {!isValidEmail(email) ? (
              <small className="field__hint">Ingresa un correo válido.</small>
            ) : null}
          </div>
        </Modal>
      ) : null}

      {confirmCash ? (
        <Modal
          title="Confirmar venta en efectivo"
          description="Se reservará el stock y abrirás la ficha para completar los datos y registrar el pago."
          onClose={() => {
            if (!submit.isPending) setConfirmCash(false)
          }}
          footer={
            <>
              <button
                className="button button--secondary"
                type="button"
                disabled={submit.isPending}
                onClick={() => setConfirmCash(false)}
              >
                Volver
              </button>
              <button
                className="button button--primary"
                type="button"
                disabled={submit.isPending}
                onClick={() => submit.mutate()}
              >
                {submit.isPending ? 'Creando…' : 'Crear venta'}
              </button>
            </>
          }
        >
          <p>
            Total {formatClp(total)} ·{' '}
            {draft.deliveryMode === 'shipping'
              ? 'Despacho'
              : draft.deliveryMode === 'pickup'
                ? 'Retiro'
                : 'Entrega coordinada'}
          </p>
        </Modal>
      ) : null}
    </>
  )
}
