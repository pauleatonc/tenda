import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import {
  billingKeys,
  fetchOrganisationBilling,
  formatProductLimit,
} from '../billing/api'
import { PRODUCT_CREATE_OPTIONS } from './create-options'

export function ProductCreateChooser() {
  const billing = useQuery({
    queryKey: billingKeys.organisation(),
    queryFn: fetchOrganisationBilling,
    staleTime: 60_000,
  })
  const aiAllowed = billing.data?.aiAssistedEnabled ?? false
  const canCreate = billing.data?.canCreateProduct ?? true

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">Inventario</p>
          <h1>Agregar producto</h1>
          <p>Elige cómo quieres registrar el producto.</p>
          {billing.data ? (
            <p>
              Plan {billing.data.planName}: {billing.data.productCount}
              {billing.data.productLimit != null
                ? ` / ${billing.data.productLimit}`
                : ''}{' '}
              productos · {formatProductLimit(billing.data.productLimit)}
            </p>
          ) : null}
        </div>
      </header>

      {!canCreate ? (
        <div className="form-message form-message--error" role="alert">
          <strong>Límite de productos alcanzado</strong>
          <span>
            Archiva productos o{' '}
            <Link to="/app/configuracion/plan">mejora tu plan</Link> para crear más.
          </span>
        </div>
      ) : null}

      <section className="create-chooser" aria-label="Formas de agregar un producto">
        {PRODUCT_CREATE_OPTIONS.map((option) => {
          const lockedAssisted = option.origin === 'assisted' && !aiAllowed
          const lockedQuota = !canCreate
          if (lockedAssisted || lockedQuota) {
            return (
              <div
                key={option.origin}
                className="create-chooser__card create-chooser__card--disabled"
                aria-disabled="true"
              >
                <h2>{option.title}</h2>
                <p>{option.description}</p>
                <p>
                  {lockedAssisted ? (
                    <>
                      Disponible desde Starter.{' '}
                      <Link to="/app/configuracion/plan">Ver planes</Link>
                    </>
                  ) : (
                    <>
                      Sin cupo disponible.{' '}
                      <Link to="/app/configuracion/plan">Mejorar plan</Link>
                    </>
                  )}
                </p>
              </div>
            )
          }
          return (
            <Link key={option.origin} className="create-chooser__card" to={option.to}>
              <h2>{option.title}</h2>
              <p>{option.description}</p>
            </Link>
          )
        })}
      </section>
    </>
  )
}
