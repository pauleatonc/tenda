import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'

import { getViewer } from '../auth/api'
import { TendaApiError } from '../lib/http'
import { SLOW_QUERY_STALE_MS } from '../lib/queryDefaults'
import {
  SIGNUP_PLAN_OPTIONS,
  SIGNUP_PLAN_STORAGE_KEY,
  formatSignupPlanPrice,
  type SignupPlanOption,
} from './planCatalog'
import {
  billingKeys,
  fetchOrganisationBilling,
  selectSignupPlan,
  startPlanCheckout,
} from './api'

function suggestedPlanCode(): SignupPlanOption['code'] {
  const stored = sessionStorage.getItem(SIGNUP_PLAN_STORAGE_KEY)
  if (
    stored === 'free' ||
    stored === 'starter' ||
    stored === 'growth' ||
    stored === 'pro'
  ) {
    return stored
  }
  return 'free'
}

export function ChoosePlanPage() {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<SignupPlanOption['code']>(suggestedPlanCode)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const viewer = useQuery({
    queryKey: ['viewer'],
    queryFn: getViewer,
    retry: false,
    staleTime: SLOW_QUERY_STALE_MS,
  })

  const billing = useQuery({
    queryKey: billingKeys.organisation(),
    queryFn: fetchOrganisationBilling,
    enabled: viewer.isSuccess,
    staleTime: 30_000,
  })

  const choose = useMutation({
    mutationFn: async (planCode: SignupPlanOption['code']) => {
      if (!acceptedTerms) {
        throw new TendaApiError(
          {
            code: 'TERMS_NOT_ACCEPTED',
            message: 'Debes aceptar los términos y condiciones para continuar.',
            fieldErrors: {
              acceptedTerms: ['Marca la casilla para aceptar los términos.'],
            },
            correlationId: '',
          },
          400,
        )
      }
      if (planCode === 'free') {
        return {
          kind: 'free' as const,
          billing: await selectSignupPlan(planCode, true),
        }
      }
      const checkout = await startPlanCheckout({
        planCode,
        payerEmail: viewer.data?.viewer.email,
        acceptedTerms: true,
      })
      return { kind: 'paid' as const, checkout }
    },
    onSuccess: (result) => {
      sessionStorage.removeItem(SIGNUP_PLAN_STORAGE_KEY)
      if (result.kind === 'free') {
        queryClient.setQueryData(billingKeys.organisation(), result.billing)
        window.location.assign('/app')
        return
      }
      window.location.assign(result.checkout.initPoint)
    },
    onError: (caught) => setError(caught),
  })

  if (viewer.isPending || (viewer.isSuccess && billing.isPending)) {
    return (
      <main className="auth-page">
        <section className="auth-panel">
          <div className="auth-card">
            <p className="eyebrow">Tu plan</p>
            <h1>Preparando opciones…</h1>
          </div>
        </section>
      </main>
    )
  }

  if (viewer.isError) {
    return <Navigate to="/login" replace />
  }

  if (billing.isError) {
    return (
      <main className="auth-page">
        <section className="auth-panel">
          <div className="auth-card">
            <p className="eyebrow">Tu plan</p>
            <h1>No pudimos cargar los planes</h1>
            <p className="auth-card__lead">
              {billing.error instanceof TendaApiError
                ? billing.error.message
                : 'Revisa tu conexión e inténtalo de nuevo.'}
            </p>
            <Link className="button button--primary button--wide" to="/app">
              Reintentar
            </Link>
          </div>
        </section>
      </main>
    )
  }

  if (billing.data && !billing.data.needsPlanSelection) {
    return <Navigate to="/app" replace />
  }

  return (
    <main className="auth-page">
      <section className="auth-intro" aria-label="Tenda">
        <Link className="wordmark wordmark--light" to="/" aria-label="Tenda, inicio">
          tenda
        </Link>
        <div>
          <p className="eyebrow eyebrow--light">Casi listo</p>
          <h2>Elige cómo quieres empezar.</h2>
          <p>Puedes cambiar de plan después desde la configuración.</p>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <p className="eyebrow">Tu plan</p>
          <h1>Elige tu plan</h1>
          <p className="auth-card__lead">
            Empieza gratis o amplía cupo y creación asistida cuando lo necesites.
          </p>
          {error ? (
            <div className="form-message form-message--error" role="alert">
              <strong>No pudimos guardar el plan</strong>
              <span>
                {error instanceof TendaApiError
                  ? error.message
                  : 'Inténtalo nuevamente.'}
              </span>
            </div>
          ) : null}
          <div className="auth-plan-grid" role="radiogroup" aria-label="Plan">
            {SIGNUP_PLAN_OPTIONS.map((plan) => {
              const isSelected = selected === plan.code
              return (
                <label
                  key={plan.code}
                  className={
                    isSelected
                      ? 'auth-plan-option auth-plan-option--selected'
                      : 'auth-plan-option'
                  }
                >
                  <input
                    type="radio"
                    name="signup-plan"
                    value={plan.code}
                    checked={isSelected}
                    onChange={() => setSelected(plan.code)}
                  />
                  <span className="auth-plan-option__name">{plan.name}</span>
                  <span className="auth-plan-option__price">
                    {formatSignupPlanPrice(plan.priceClp)}
                    {plan.priceClp > 0 ? ' / mes' : ''}
                  </span>
                  <span className="auth-plan-option__summary">{plan.summary}</span>
                </label>
              )
            })}
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
              </Link>
              .
            </span>
          </label>
          <button
            className="button button--primary button--wide"
            type="button"
            disabled={choose.isPending || !acceptedTerms}
            onClick={() => {
              setError(null)
              choose.mutate(selected)
            }}
          >
            {choose.isPending
              ? 'Continuando…'
              : selected === 'free'
                ? 'Empezar gratis'
                : 'Continuar al pago'}
          </button>
        </div>
      </section>
    </main>
  )
}
