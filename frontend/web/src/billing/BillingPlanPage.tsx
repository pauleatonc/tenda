import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { Link, useOutletContext, useSearchParams } from 'react-router-dom'

import type { ViewerPayload } from '../auth/api'
import { EmptyState, StatusChip } from '../components/ui'
import { TendaApiError } from '../lib/http'
import {
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

export function BillingPlanPage() {
  const viewer = useOutletContext<ViewerPayload>()
  const [params] = useSearchParams()
  const queryClient = useQueryClient()
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
      startPlanCheckout({ planCode, payerEmail: viewer.viewer.email }),
    onSuccess: (result) => {
      sessionStorage.removeItem(SIGNUP_PLAN_STORAGE_KEY)
      window.location.assign(result.initPoint)
    },
  })

  const autoCheckoutStarted = useRef(false)
  const checkoutPlan = params.get('checkout')
  useEffect(() => {
    if (autoCheckoutStarted.current || !canManage) return
    if (!checkoutPlan || checkoutPlan === 'free') return
    autoCheckoutStarted.current = true
    checkout.mutate(checkoutPlan)
    // Intentionally run once when the return/signup query asks for checkout.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- checkout.mutate is stable enough for one-shot
  }, [canManage, checkoutPlan])

  const cancel = useMutation({
    mutationFn: cancelSubscription,
    onSuccess: (data) => {
      queryClient.setQueryData(billingKeys.organisation(), data)
    },
  })

  const resume = useMutation({
    mutationFn: resumeSubscription,
    onSuccess: (data) => {
      queryClient.setQueryData(billingKeys.organisation(), data)
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
      : cancel.error instanceof TendaApiError
        ? cancel.error
        : resume.error instanceof TendaApiError
          ? resume.error
          : billing.error instanceof TendaApiError
            ? billing.error
            : null

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">Suscripción Tenda</p>
          <h1>Plan y facturación</h1>
          <p>
            El servicio es gratuito hasta 5 productos. Los planes de pago amplían el
            cupo e incluyen creación asistida con foto.
          </p>
        </div>
      </header>

      {params.get('status') === 'pending' || params.get('preapproval_id') ? (
        <div className="form-message form-message--success" role="status">
          <strong>Estamos activando tu plan</strong>
          <span>Si el pago ya se autorizó, actualiza en unos segundos.</span>
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
          <section className="panel" aria-label="Plan actual">
            <div className="panel__header">
              <h2>{data.planName}</h2>
              <StatusChip status={data.subscriptionStatus} />
            </div>
            <p>
              {formatPlanPrice(data.priceClp)} / mes · {formatProductLimit(data.productLimit)}
            </p>
            <p>
              Usas <strong>{data.productCount}</strong>
              {data.productLimit != null ? ` de ${data.productLimit}` : ''} productos.
              {data.aiAssistedEnabled
                ? ' Creación asistida habilitada.'
                : ' Creación asistida disponible desde Starter.'}
            </p>
            <p>{statusLabels[data.subscriptionStatus] ?? data.subscriptionStatus}</p>
            {data.cancelAtPeriodEnd ? (
              <p role="status">La suscripción se cancelará al final del período actual.</p>
            ) : null}
            <div className="button-row">
              {data.planCode !== 'free' && !data.cancelAtPeriodEnd ? (
                <button
                  type="button"
                  className="button button--ghost"
                  disabled={cancel.isPending}
                  onClick={() => cancel.mutate()}
                >
                  {cancel.isPending ? 'Cancelando…' : 'Cancelar al final del período'}
                </button>
              ) : null}
              {(data.subscriptionStatus === 'paused' || data.cancelAtPeriodEnd) &&
              data.planCode !== 'free' ? (
                <button
                  type="button"
                  className="button button--secondary"
                  disabled={resume.isPending}
                  onClick={() => resume.mutate()}
                >
                  {resume.isPending ? 'Reactivando…' : 'Reactivar suscripción'}
                </button>
              ) : null}
            </div>
          </section>

          <section className="plan-grid" aria-label="Planes disponibles">
            {data.plans.map((plan) => {
              const isCurrent = plan.isCurrent
              const isFree = plan.code === 'free'
              return (
                <article key={plan.code} className="plan-card">
                  <h3>{plan.name}</h3>
                  <p className="plan-card__price">{formatPlanPrice(plan.priceClp)}</p>
                  <p>{formatProductLimit(plan.productLimit)}</p>
                  <p>
                    {plan.aiAssistedEnabled
                      ? 'Incluye creación asistida'
                      : 'Solo creación manual'}
                  </p>
                  {isCurrent ? (
                    <StatusChip status="active" />
                  ) : isFree ? (
                    <p className="muted">Plan base al cancelar o sin suscripción</p>
                  ) : (
                    <button
                      type="button"
                      className="button button--primary"
                      disabled={checkout.isPending}
                      onClick={() => checkout.mutate(plan.code)}
                    >
                      {checkout.isPending && checkout.variables === plan.code
                        ? 'Redirigiendo…'
                        : 'Suscribirse'}
                    </button>
                  )}
                </article>
              )
            })}
          </section>

          <p>
            Los cobros a tus compradores siguen en{' '}
            <Link to="/app/configuracion/pagos">Configuración de pagos</Link>. Esta
            página solo factura el plan de Tenda.
          </p>
        </>
      )}
    </>
  )
}
