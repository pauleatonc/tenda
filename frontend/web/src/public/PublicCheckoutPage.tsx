import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { FormErrorSummary } from '../components/ui'
import { TendaApiError } from '../lib/http'
import {
  fetchPublicOrder,
  initiateMercadoPagoCheckout,
  salesKeys,
  setBuyerDetails,
} from '../sales/api'
import {
  deliveryModeLabels,
  formatClp,
  paymentMethodLabels,
  translated,
} from '../sales/model'
import {
  loadPublicCheckoutDraft,
  savePublicCheckoutDraft,
  validateContactAndDelivery,
  type CheckoutErrors,
  type PublicCheckoutDraft,
} from './checkoutDraft'
import {
  PublicOrderSummary,
  PublicOrderUnavailable,
  PublicPage,
} from './PublicOrderComponents'

export function PublicCheckoutPage() {
  const { token = '' } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [draft, setDraft] = useState<PublicCheckoutDraft>(() =>
    loadPublicCheckoutDraft(token),
  )
  const [errors, setErrors] = useState<CheckoutErrors>({})
  const [submitError, setSubmitError] = useState<Error | null>(null)

  useEffect(() => {
    savePublicCheckoutDraft(token, draft)
  }, [draft, token])

  const order = useQuery({
    queryKey: salesKeys.publicOrder(token),
    queryFn: () => fetchPublicOrder(token),
    enabled: Boolean(token),
    retry: 1,
  })

  const availableMethods: readonly string[] = order.data?.availablePaymentMethods ?? []
  const selectedPaymentMethod = draft.paymentMethod || availableMethods[0] || ''

  const contactErrors = useMemo(
    () =>
      order.data
        ? validateContactAndDelivery(draft, order.data.deliveryMode)
        : ({} as CheckoutErrors),
    [draft, order.data],
  )

  const submit = useMutation({
    mutationFn: async () => {
      if (!navigator.onLine) {
        throw new Error(
          'Estás sin conexión. Conservamos tus datos, pero no enviaremos la compra hasta que vuelvas a estar en línea.',
        )
      }
      await setBuyerDetails({
        token,
        fullName: draft.fullName.trim(),
        email: draft.email.trim() || null,
        phone: draft.phone.trim() || null,
        recipientName: draft.recipientName.trim() || null,
        deliveryAddress: draft.deliveryAddress.trim() || null,
        deliveryCommune: draft.deliveryCommune.trim() || null,
        deliveryCity: draft.deliveryCity.trim() || null,
        taxId: draft.wantsTaxData ? draft.taxId.trim() : null,
        taxName: draft.wantsTaxData ? draft.taxName.trim() : null,
        taxBusinessActivity: draft.wantsTaxData
          ? draft.taxBusinessActivity.trim() || null
          : null,
        taxAddress: draft.wantsTaxData ? draft.taxAddress.trim() || null : null,
        taxCommune: draft.wantsTaxData ? draft.taxCommune.trim() || null : null,
        taxCity: draft.wantsTaxData ? draft.taxCity.trim() || null : null,
        taxEmail: draft.wantsTaxData ? draft.taxEmail.trim() || null : null,
        paymentMethod: selectedPaymentMethod,
        idempotencyKey: draft.detailsIdempotencyKey,
      })

      if (selectedPaymentMethod === 'mercado_pago') {
        return initiateMercadoPagoCheckout({
          token,
          idempotencyKey: draft.checkoutIdempotencyKey,
        })
      }
      return null
    },
    onSuccess: (checkout) => {
      setSubmitError(null)
      if (selectedPaymentMethod === 'mercado_pago' && checkout) {
        window.location.assign(checkout.checkoutUrl)
        return
      }
      navigate(
        selectedPaymentMethod === 'bank_transfer'
          ? `/p/${token}/comprobante`
          : `/p/${token}/estado`,
      )
    },
    onError: (error: Error) => setSubmitError(error),
  })

  function update<K extends keyof PublicCheckoutDraft>(
    key: K,
    value: PublicCheckoutDraft[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  function continueFromContact() {
    setErrors(contactErrors)
    if (Object.keys(contactErrors).length) return
    setDraft((current) => ({ ...current, step: 2 }))
  }

  if (order.isPending) {
    return (
      <PublicPage>
        <div className="public-skeleton" aria-live="polite" aria-busy="true">
          <span className="sr-only">Preparando checkout…</span>
          <div />
          <div />
        </div>
      </PublicPage>
    )
  }

  if (order.isError || !order.data) {
    const expired =
      order.error instanceof TendaApiError &&
      ['ORDER_EXPIRED', 'PUBLIC_TOKEN_EXPIRED'].includes(order.error.code)
    return (
      <PublicOrderUnavailable
        expired={expired}
        onRetry={expired ? undefined : () => void order.refetch()}
      />
    )
  }

  if (order.data.status === 'expired') return <PublicOrderUnavailable expired />

  const detail = order.data
  const paymentValid = availableMethods.includes(selectedPaymentMethod)

  return (
    <PublicPage seller={detail.seller}>
      <div className="public-checkout-heading">
        <Link to={`/p/${token}`}>← Volver al pedido</Link>
        <p className="eyebrow">Checkout sin cuenta</p>
        <h1>Completa tu compra</h1>
        <ol aria-label="Progreso">
          {['Datos y entrega', 'Pago', 'Revisión'].map((label, index) => (
            <li
              key={label}
              aria-current={draft.step === index + 1 ? 'step' : undefined}
              className={draft.step >= index + 1 ? 'is-active' : ''}
            >
              <span>{index + 1}</span>
              {label}
            </li>
          ))}
        </ol>
      </div>

      <div className="public-checkout-layout">
        <section className="public-checkout-card">
          {submitError ? (
            <div className="form-message form-message--error" role="alert">
              <strong>No pudimos continuar</strong>
              <span>
                {submitError instanceof TendaApiError
                  ? submitError.message
                  : submitError.message ||
                    'La conexión se interrumpió. Tus datos siguen guardados en esta sesión.'}
              </span>
            </div>
          ) : null}

          {draft.step === 1 ? (
            <>
              <header>
                <span>Paso 1 de 3</span>
                <h2>Contacto y entrega</h2>
                <p>
                  Usaremos estos datos solo para procesar esta compra y comunicar su
                  estado.
                </p>
              </header>
              <FormErrorSummary errors={errors} />
              <div className="public-form-grid">
                <div className="field public-form-grid__wide">
                  <label htmlFor="buyer-name">Nombre</label>
                  <input
                    id="buyer-name"
                    autoComplete="name"
                    value={draft.fullName}
                    aria-invalid={Boolean(errors.fullName)}
                    onChange={(event) => update('fullName', event.target.value)}
                  />
                  {errors.fullName ? (
                    <small className="field__error">{errors.fullName}</small>
                  ) : null}
                </div>
                <div className="field">
                  <label htmlFor="buyer-email">Email</label>
                  <input
                    id="buyer-email"
                    type="email"
                    autoComplete="email"
                    value={draft.email}
                    aria-invalid={Boolean(errors.contact)}
                    onChange={(event) => update('email', event.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="buyer-phone">Teléfono</label>
                  <input
                    id="buyer-phone"
                    type="tel"
                    autoComplete="tel"
                    value={draft.phone}
                    aria-invalid={Boolean(errors.contact)}
                    onChange={(event) => update('phone', event.target.value)}
                  />
                </div>
                {errors.contact ? (
                  <small className="field__error public-form-grid__wide">
                    {errors.contact}
                  </small>
                ) : null}

                <div className="public-form-grid__wide public-delivery-label">
                  <strong>
                    Entrega: {translated(deliveryModeLabels, detail.deliveryMode)}
                  </strong>
                </div>

                {detail.deliveryMode === 'shipping' ? (
                  <>
                    <div className="field public-form-grid__wide">
                      <label htmlFor="recipient">Destinatario</label>
                      <input
                        id="recipient"
                        autoComplete="shipping name"
                        value={draft.recipientName}
                        aria-invalid={Boolean(errors.recipientName)}
                        onChange={(event) => update('recipientName', event.target.value)}
                      />
                      {errors.recipientName ? (
                        <small className="field__error">{errors.recipientName}</small>
                      ) : null}
                    </div>
                    <div className="field public-form-grid__wide">
                      <label htmlFor="delivery-address">Dirección</label>
                      <input
                        id="delivery-address"
                        autoComplete="shipping street-address"
                        value={draft.deliveryAddress}
                        aria-invalid={Boolean(errors.deliveryAddress)}
                        onChange={(event) =>
                          update('deliveryAddress', event.target.value)
                        }
                      />
                      {errors.deliveryAddress ? (
                        <small className="field__error">{errors.deliveryAddress}</small>
                      ) : null}
                    </div>
                    <div className="field">
                      <label htmlFor="delivery-commune">Comuna</label>
                      <input
                        id="delivery-commune"
                        value={draft.deliveryCommune}
                        aria-invalid={Boolean(errors.deliveryCommune)}
                        onChange={(event) =>
                          update('deliveryCommune', event.target.value)
                        }
                      />
                      {errors.deliveryCommune ? (
                        <small className="field__error">{errors.deliveryCommune}</small>
                      ) : null}
                    </div>
                    <div className="field">
                      <label htmlFor="delivery-city">Ciudad</label>
                      <input
                        id="delivery-city"
                        autoComplete="shipping address-level2"
                        value={draft.deliveryCity}
                        aria-invalid={Boolean(errors.deliveryCity)}
                        onChange={(event) => update('deliveryCity', event.target.value)}
                      />
                      {errors.deliveryCity ? (
                        <small className="field__error">{errors.deliveryCity}</small>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </div>

              <details className="tax-details" open={draft.wantsTaxData}>
                <summary
                  onClick={(event) => {
                    event.preventDefault()
                    update('wantsTaxData', !draft.wantsTaxData)
                  }}
                >
                  Necesito datos tributarios en el registro (opcional)
                </summary>
                {draft.wantsTaxData ? (
                  <div className="public-form-grid">
                    <p className="public-form-grid__wide">
                      Se usan para identificar al comprador. Esta compra no constituye por
                      sí sola una factura o DTE.
                    </p>
                    <div className="field">
                      <label htmlFor="tax-id">RUT</label>
                      <input
                        id="tax-id"
                        value={draft.taxId}
                        aria-invalid={Boolean(errors.taxId)}
                        onChange={(event) => update('taxId', event.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="tax-name">Nombre o razón social</label>
                      <input
                        id="tax-name"
                        value={draft.taxName}
                        aria-invalid={Boolean(errors.taxName)}
                        onChange={(event) => update('taxName', event.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="tax-activity">Giro</label>
                      <input
                        id="tax-activity"
                        value={draft.taxBusinessActivity}
                        onChange={(event) =>
                          update('taxBusinessActivity', event.target.value)
                        }
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="tax-email">Email tributario</label>
                      <input
                        id="tax-email"
                        type="email"
                        value={draft.taxEmail}
                        aria-invalid={Boolean(errors.taxEmail)}
                        onChange={(event) => update('taxEmail', event.target.value)}
                      />
                    </div>
                    <div className="field public-form-grid__wide">
                      <label htmlFor="tax-address">Dirección tributaria</label>
                      <input
                        id="tax-address"
                        value={draft.taxAddress}
                        onChange={(event) => update('taxAddress', event.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="tax-commune">Comuna</label>
                      <input
                        id="tax-commune"
                        value={draft.taxCommune}
                        onChange={(event) => update('taxCommune', event.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="tax-city">Ciudad</label>
                      <input
                        id="tax-city"
                        value={draft.taxCity}
                        onChange={(event) => update('taxCity', event.target.value)}
                      />
                    </div>
                  </div>
                ) : null}
              </details>

              <div className="public-checkout-actions">
                <Link className="button button--secondary" to={`/p/${token}`}>
                  Volver
                </Link>
                <button
                  className="button button--primary"
                  type="button"
                  onClick={continueFromContact}
                >
                  Continuar al pago
                </button>
              </div>
            </>
          ) : null}

          {draft.step === 2 ? (
            <>
              <header>
                <span>Paso 2 de 3</span>
                <h2>Elige cómo pagar</h2>
                <p>Verás cualquier comisión no nula antes de confirmar.</p>
              </header>
              <fieldset className="choice-cards public-payment-methods">
                <legend>Métodos disponibles</legend>
                {availableMethods.map((method) => (
                  <label key={method}>
                    <input
                      type="radio"
                      name="public-payment"
                      value={method}
                      checked={selectedPaymentMethod === method}
                      onChange={() => update('paymentMethod', method)}
                    />
                    <span>
                      <strong>{translated(paymentMethodLabels, method)}</strong>
                      <small>
                        {method === 'bank_transfer'
                          ? 'Verás los datos bancarios y podrás cargar el comprobante.'
                          : method === 'cash'
                            ? 'El vendedor confirmará el pago cuando lo reciba.'
                            : 'Mercado Pago abrirá su checkout. Volver desde el proveedor no significa que el pago esté confirmado.'}
                      </small>
                    </span>
                  </label>
                ))}
              </fieldset>
              {!paymentValid ? (
                <p className="field__error" role="alert">
                  Selecciona un método de pago disponible.
                </p>
              ) : null}
              <div className="public-checkout-actions">
                <button
                  className="button button--secondary"
                  type="button"
                  onClick={() => setDraft((current) => ({ ...current, step: 1 }))}
                >
                  Volver
                </button>
                <button
                  className="button button--primary"
                  type="button"
                  disabled={!paymentValid}
                  onClick={() => setDraft((current) => ({ ...current, step: 3 }))}
                >
                  Revisar compra
                </button>
              </div>
            </>
          ) : null}

          {draft.step === 3 ? (
            <>
              <header>
                <span>Paso 3 de 3</span>
                <h2>Revisa y confirma</h2>
                <p>Tus datos no se borrarán si el envío falla.</p>
              </header>
              <dl className="public-review-details">
                <div>
                  <dt>Contacto</dt>
                  <dd>
                    {draft.fullName}
                    <small>
                      {[draft.email, draft.phone].filter(Boolean).join(' · ')}
                    </small>
                  </dd>
                </div>
                <div>
                  <dt>Entrega</dt>
                  <dd>
                    {translated(deliveryModeLabels, detail.deliveryMode)}
                    {detail.deliveryMode === 'shipping' ? (
                      <small>
                        {[
                          draft.recipientName,
                          draft.deliveryAddress,
                          draft.deliveryCommune,
                          draft.deliveryCity,
                        ]
                          .filter(Boolean)
                          .join(', ')}
                      </small>
                    ) : null}
                  </dd>
                </div>
                <div>
                  <dt>Pago</dt>
                  <dd>{translated(paymentMethodLabels, selectedPaymentMethod)}</dd>
                </div>
                {draft.wantsTaxData ? (
                  <div>
                    <dt>Datos tributarios</dt>
                    <dd>
                      {draft.taxName} · {draft.taxId}
                    </dd>
                  </div>
                ) : null}
              </dl>
              <div className="public-review-total">
                <span>Total efectivo</span>
                <strong>{formatClp(detail.total)}</strong>
                {Number(detail.feeAmount) > 0 ? (
                  <small>Incluye comisión {formatClp(detail.feeAmount)}</small>
                ) : null}
              </div>
              {selectedPaymentMethod === 'mercado_pago' ? (
                <p className="public-provider-note">
                  Te redirigiremos a Mercado Pago. Al volver, Tenda mostrará “verificando”
                  hasta recibir confirmación segura; el redirect no prueba el pago.
                </p>
              ) : null}
              <div className="public-checkout-actions">
                <button
                  className="button button--secondary"
                  type="button"
                  disabled={submit.isPending}
                  onClick={() => setDraft((current) => ({ ...current, step: 2 }))}
                >
                  Volver
                </button>
                <button
                  className="button button--primary"
                  type="button"
                  disabled={submit.isPending}
                  onClick={() => {
                    setSubmitError(null)
                    submit.mutate()
                  }}
                >
                  {submit.isPending
                    ? 'Confirmando…'
                    : selectedPaymentMethod === 'mercado_pago'
                      ? 'Ir a Mercado Pago'
                      : 'Confirmar datos'}
                </button>
              </div>
            </>
          ) : null}
        </section>

        <PublicOrderSummary order={detail} compact />
      </div>
    </PublicPage>
  )
}
