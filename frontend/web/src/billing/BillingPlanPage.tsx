import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Link, useOutletContext, useSearchParams } from 'react-router-dom'

import type { ViewerPayload } from '../auth/api'
import { EmptyState, Modal, StatusChip } from '../components/ui'
import { TendaApiError } from '../lib/http'
import {
  type BillingPlan,
  type OrganisationBilling,
  billingKeys,
  cancelSubscription,
  fetchOrganisationBilling,
  formatPlanPrice,
  formatProductLimit,
  resumeSubscription,
  startPlanCheckout,
} from './api'
import { SIGNUP_PLAN_STORAGE_KEY } from './planCatalog'

const statusLabels: Record<string, string> = {
  active: 'Activo',
  pending: 'Pago pendiente',
  past_due: 'Pago atrasado',
  paused: 'Pausado',
  canceled: 'Cancelado',
}

const statusTone: Record<string, string> = {
  active: 'active',
  pending: 'warning',
  past_due: 'warning',
  paused: 'warning',
  canceled: 'error',
}

const planRank: Record<string, number> = {
  free: 0,
  starter: 1,
  growth: 2,
  pro: 3,
}

function formatPeriodEnd(value: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('es-CL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function usagePercent(count: number, limit: number | null): number | null {
  if (limit == null || limit <= 0) return null
  return Math.min(100, Math.round((count / limit) * 100))
}

function isFreePlan(plan: { code: string; priceClp: number }): boolean {
  return plan.code === 'free' || plan.priceClp <= 0
}

function onFreePlan(billing: OrganisationBilling): boolean {
  if (isFreePlan({ code: billing.planCode, priceClp: billing.priceClp })) return true
  const current = billing.plans.find((plan) => plan.isCurrent)
  return current != null && isFreePlan(current)
}

export function BillingPlanPage() {
  const viewer = useOutletContext<ViewerPayload>()
  const [params] = useSearchParams()
  const queryClient = useQueryClient()
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [notice, setNotice] = useState('')
  const canManage =
    viewer.membership.role === 'owner' ||
    viewer.membership.permissions.manageSensitiveConfiguration

  const billing = useQuery({
    queryKey: billingKeys.organisation(),
    queryFn: fetchOrganisationBilling,
    staleTime: 60_000,
  })

  const checkout = useMutation({
    mutationFn: (planCode: string) =>
      startPlanCheckout({
        planCode,
        payerEmail: viewer.viewer.email,
        acceptedTerms: true,
      }),
    onSuccess: (result) => {
      sessionStorage.removeItem(SIGNUP_PLAN_STORAGE_KEY)
      window.location.assign(result.initPoint)
    },
  })

  const autoCheckoutStarted = useRef(false)
  const checkoutPlan = params.get('checkout')
  useEffect(() => {
    if (autoCheckoutStarted.current || !canManage || !acceptedTerms) return
    if (!checkoutPlan || checkoutPlan === 'free') return
    autoCheckoutStarted.current = true
    checkout.mutate(checkoutPlan)
    // Intentionally run once when the return/signup query asks for checkout.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- checkout.mutate is stable enough for one-shot
  }, [canManage, checkoutPlan, acceptedTerms])

  const cancel = useMutation({
    mutationFn: cancelSubscription,
    onSuccess: (data) => {
      queryClient.setQueryData(billingKeys.organisation(), data)
      setConfirmCancel(false)
      setNotice('Tu tienda quedó en el plan Gratis.')
    },
  })

  const resume = useMutation({
    mutationFn: resumeSubscription,
    onSuccess: (data) => {
      queryClient.setQueryData(billingKeys.organisation(), data)
      setNotice('La suscripción volvió a quedar activa.')
    },
  })

  if (!canManage) {
    return (
      <>
        <header className="page-heading">
          <div>
            <p className="eyebrow">Permiso requerido</p>
            <h1>Plan y facturación</h1>
          </div>
        </header>
        <EmptyState
          title="No puedes administrar el plan"
          description="Esta sección está disponible para Owner o membresías con configuración sensible."
        />
      </>
    )
  }

  const data = billing.data
  const error =
    checkout.error instanceof TendaApiError
      ? checkout.error
      : resume.error instanceof TendaApiError
        ? resume.error
        : billing.error instanceof TendaApiError
          ? billing.error
          : null
  const cancelError = cancel.error instanceof TendaApiError ? cancel.error : null

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">Suscripción Tenda</p>
          <h1>Plan y facturación</h1>
          <p>
            Desde aquí ves el plan de la tienda, lo mejoras, lo cambias o lo das de baja.
            Al darlo de baja quedas en Gratis.
          </p>
        </div>
      </header>

      {params.get('status') === 'pending' || params.get('preapproval_id') ? (
        <div className="form-message form-message--success" role="status">
          <strong>Estamos activando tu plan</strong>
          <span>Si el pago ya se autorizó, actualiza en unos segundos.</span>
        </div>
      ) : null}

      {notice ? (
        <div className="form-message form-message--success" role="status">
          <span>{notice}</span>
        </div>
      ) : null}

      {error ? (
        <div className="form-message form-message--error" role="alert">
          <strong>{error.code}</strong>
          <span>{error.message}</span>
        </div>
      ) : null}

      {billing.isLoading || !data ? (
        <p>Cargando plan…</p>
      ) : (
        <>
          <CurrentPlan
            billing={data}
            onCancel={() => {
              cancel.reset()
              setConfirmCancel(true)
            }}
            onResume={() => resume.mutate()}
            resumePending={resume.isPending}
          />

          <section className="plan-change" aria-labelledby="plan-change-title">
            <div className="plan-change__intro">
              <h2 id="plan-change-title">Mejorar o cambiar de plan</h2>
              <p>
                Un plan superior amplía el cupo. Para uno de pago, confirmas el cobro en
                Mercado Pago.
              </p>
            </div>

            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(event) => setAcceptedTerms(event.target.checked)}
              />
              <span>
                Acepto los{' '}
                <Link to="/terminos" target="_blank" rel="noreferrer">
                  términos y condiciones
                </Link>{' '}
                para suscribirme a un plan de pago.
              </span>
            </label>

            <div className="plan-grid">
              {data.plans.map((plan) => (
                <PlanOption
                  key={plan.code}
                  plan={plan}
                  currentCode={data.planCode}
                  productCount={data.productCount}
                  pending={checkout.isPending && checkout.variables === plan.code}
                  disabled={checkout.isPending || !acceptedTerms}
                  onChoose={() => checkout.mutate(plan.code)}
                />
              ))}
            </div>
          </section>

          <p className="plan-footnote">
            Los cobros a tus compradores siguen en{' '}
            <Link to="/app/cuenta/pagos">Integración de pago</Link>. Esta página solo
            factura el plan de Tenda.
          </p>

          {confirmCancel ? (
            <CancelPlanDialog
              billing={data}
              pending={cancel.isPending}
              errorMessage={cancelError?.message ?? null}
              onClose={() => {
                if (!cancel.isPending) setConfirmCancel(false)
              }}
              onConfirm={() => cancel.mutate()}
            />
          ) : null}
        </>
      )}
    </>
  )
}

function CurrentPlan({
  billing,
  onCancel,
  onResume,
  resumePending,
}: {
  billing: OrganisationBilling
  onCancel: () => void
  onResume: () => void
  resumePending: boolean
}) {
  const paid = !onFreePlan(billing)
  const percent = usagePercent(billing.productCount, billing.productLimit)
  const overLimit =
    billing.productLimit != null && billing.productCount > billing.productLimit
  const periodEnd = formatPeriodEnd(billing.currentPeriodEnd)
  const canResume =
    paid && (billing.subscriptionStatus === 'paused' || billing.cancelAtPeriodEnd)

  return (
    <section className="plan-current" aria-label="Plan actual">
      <div className="plan-current__top">
        <div>
          <p className="plan-kicker">Plan actual</p>
          <h2>{billing.planName}</h2>
          <p className="plan-current__price">
            {formatPlanPrice(billing.priceClp)}
            {billing.priceClp > 0 ? <span> / mes</span> : null}
          </p>
        </div>
        <StatusChip
          status={statusTone[billing.subscriptionStatus] ?? 'warning'}
          label={statusLabels[billing.subscriptionStatus] ?? billing.subscriptionStatus}
        />
      </div>

      <ul className="plan-current__facts">
        <li>{formatProductLimit(billing.productLimit)}</li>
        <li>
          {billing.aiAssistedEnabled
            ? 'Creación asistida con foto'
            : 'Solo carga manual'}
        </li>
        {periodEnd && paid && !billing.cancelAtPeriodEnd ? (
          <li>Próximo período hasta el {periodEnd}</li>
        ) : null}
      </ul>

      <div className="plan-usage">
        <div className="plan-usage__label">
          <span>
            Usas <strong>{billing.productCount}</strong>
            {billing.productLimit != null ? ` de ${billing.productLimit}` : ''} productos
          </span>
          {percent != null ? <span>{percent}%</span> : <span>Sin tope</span>}
        </div>
        {percent != null ? (
          <div
            className="plan-usage__track"
            role="meter"
            aria-valuemin={0}
            aria-valuemax={billing.productLimit ?? 0}
            aria-valuenow={Math.min(billing.productCount, billing.productLimit ?? 0)}
            aria-label="Productos usados del cupo"
          >
            <span
              className={`plan-usage__fill${overLimit ? ' plan-usage__fill--over' : ''}`}
              style={{ width: `${percent}%` }}
            />
          </div>
        ) : null}
        {overLimit ? (
          <p>
            Superaste el cupo de este plan. Los productos siguen en el catálogo, y no
            puedes crear más hasta archivar o cambiar de plan.
          </p>
        ) : billing.remainingSlots === 0 ? (
          <p>No quedan cupos para productos nuevos.</p>
        ) : null}
      </div>

      {billing.cancelAtPeriodEnd && paid ? (
        <p role="status">
          Esta suscripción está marcada para terminar
          {periodEnd ? ` el ${periodEnd}` : ' al final del período'}. Darla de baja te
          deja en Gratis ahora.
        </p>
      ) : null}

      {paid ? (
        <div className="plan-danger">
          <div>
            <h3>Dar de baja el plan</h3>
            <p>
              La tienda sigue abierta en el plan Gratis. Se detiene el cobro de{' '}
              {billing.planName} y no se borra el catálogo.
            </p>
          </div>
          <button type="button" className="button button--danger" onClick={onCancel}>
            Dar de baja plan
          </button>
        </div>
      ) : (
        <p className="plan-current__free">
          Estás en Gratis. Elige un plan de pago cuando necesites más productos o
          creación asistida.
        </p>
      )}

      {canResume ? (
        <div className="button-row">
          <button
            type="button"
            className="button button--secondary"
            disabled={resumePending}
            onClick={onResume}
          >
            {resumePending ? 'Reactivando…' : 'Reactivar suscripción'}
          </button>
        </div>
      ) : null}
    </section>
  )
}

function PlanOption({
  plan,
  currentCode,
  productCount,
  pending,
  disabled,
  onChoose,
}: {
  plan: BillingPlan
  currentCode: string
  productCount: number
  pending: boolean
  disabled: boolean
  onChoose: () => void
}) {
  const current = plan.isCurrent || plan.code === currentCode
  const free = plan.code === 'free'
  const upgrade = (planRank[plan.code] ?? 0) > (planRank[currentCode] ?? 0)
  const shrinksCatalog =
    plan.productLimit != null && productCount > plan.productLimit

  return (
    <article className={`plan-card${current ? ' plan-card--current' : ''}`}>
      <div className="plan-card__heading">
        <h3>{plan.name}</h3>
        {current ? <StatusChip status="active" label="Plan actual" /> : null}
      </div>
      <p className="plan-card__price">
        {formatPlanPrice(plan.priceClp)}
        {plan.priceClp > 0 ? <span> / mes</span> : null}
      </p>
      <p>{formatProductLimit(plan.productLimit)}</p>
      <p>{plan.aiAssistedEnabled ? 'Incluye creación asistida' : 'Solo creación manual'}</p>
      {shrinksCatalog && !current ? (
        <p className="plan-card__note">
          Tienes {productCount} productos. Este plan conserva el catálogo y bloquea
          altas nuevas sobre su cupo.
        </p>
      ) : null}
      {current ? (
        <p className="plan-card__note">Este es el plan de la tienda.</p>
      ) : free ? (
        <p className="plan-card__note">
          Se activa con Dar de baja plan. No tiene un cobro aparte.
        </p>
      ) : (
        <button
          type="button"
          className={`button ${upgrade ? 'button--primary' : 'button--secondary'}`}
          disabled={disabled}
          onClick={onChoose}
        >
          {pending
            ? 'Redirigiendo…'
            : upgrade
              ? `Mejorar a ${plan.name}`
              : `Cambiar a ${plan.name}`}
        </button>
      )}
    </article>
  )
}

function CancelPlanDialog({
  billing,
  pending,
  errorMessage,
  onClose,
  onConfirm,
}: {
  billing: OrganisationBilling
  pending: boolean
  errorMessage: string | null
  onClose: () => void
  onConfirm: () => void
}) {
  const freePlan = billing.plans.find((plan) => plan.code === 'free')
  const freeLimit = freePlan?.productLimit ?? 5
  const overFreeLimit = billing.productCount > freeLimit

  return (
    <Modal
      title="Dar de baja el plan"
      description={`Dejas ${billing.planName} y la tienda pasa al plan Gratis.`}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="button button--secondary"
            disabled={pending}
            onClick={onClose}
          >
            Conservar {billing.planName}
          </button>
          <button
            type="button"
            className="button button--danger"
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? 'Dando de baja…' : 'Dar de baja y pasar a Gratis'}
          </button>
        </>
      }
    >
      <ul className="plan-confirm">
        <li>
          Se detiene el cobro de {formatPlanPrice(billing.priceClp)} al mes en Mercado
          Pago.
        </li>
        <li>
          Quedas en Gratis: {formatProductLimit(freeLimit).toLowerCase()} y solo carga
          manual.
        </li>
        <li>Los productos que ya cargaste se conservan.</li>
        {billing.aiAssistedEnabled ? (
          <li>La creación asistida con foto deja de estar disponible.</li>
        ) : null}
        {overFreeLimit ? (
          <li>
            Tienes {billing.productCount} productos. No podrás crear más hasta archivar
            o volver a un plan de pago.
          </li>
        ) : null}
      </ul>
      {errorMessage ? (
        <p className="form-message form-message--error" role="alert">
          <span>{errorMessage}</span>
        </p>
      ) : null}
    </Modal>
  )
}
