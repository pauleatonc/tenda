import { Link } from 'react-router-dom'

import { AnalyticsEvents, getAnalytics } from '../analytics'
import { SIGNUP_PLAN_OPTIONS, formatSignupPlanPrice } from '../billing/planCatalog'

function trackCta(cta: string) {
  getAnalytics().track(AnalyticsEvents.landingCtaClick, { cta })
}

export function LandingPage() {
  return (
    <main className="landing">
      <section className="landing-hero" aria-labelledby="landing-brand">
        <div className="landing-hero__atmosphere" aria-hidden="true">
          <div className="landing-hero__glow" />
          <div className="landing-hero__grain" />
          <div className="landing-hero__shelf">
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>

        <nav
          className="landing__nav landing__nav--over-hero"
          aria-label="Navegación principal"
        >
          <a className="landing__nav-skip" href="#como-funciona">
            Ir al contenido
          </a>
          <div className="landing__nav-actions">
            <Link className="button button--ghost button--ghost-light" to="/contacto">
              Contacto
            </Link>
            <Link className="button button--ghost button--ghost-light" to="/login">
              Iniciar sesión
            </Link>
            <Link
              className="button button--primary"
              to="/registro"
              onClick={() => trackCta('nav_crear_cuenta')}
            >
              Crear cuenta
            </Link>
          </div>
        </nav>

        <div className="landing-hero__copy">
          <p className="landing-hero__brand" id="landing-brand">
            tenda
          </p>
          <h1>Inventario, venta y despacho en un solo lugar.</h1>
          <p className="landing-hero__lead">
            Para negocios que venden por WhatsApp, feria o tienda: stock claro, enlace de
            pago y seguimiento del envío sin planillas.
          </p>
          <div className="hero__actions">
            <Link
              className="button button--primary"
              to="/registro?plan=free"
              onClick={() => trackCta('comenzar_gratis')}
            >
              Empezar gratis
            </Link>
            <a className="text-link text-link--on-hero" href="#planes">
              Ver planes
            </a>
          </div>
        </div>
      </section>

      <section className="landing-flow" id="como-funciona" aria-labelledby="flow-title">
        <div className="landing-section__intro">
          <h2 id="flow-title">Así corre tu día con Tenda</h2>
          <p>Tres pasos. Sin saltar entre apps ni Excel.</p>
        </div>
        <ol className="landing-flow__steps">
          <li>
            <h3>Ordena el inventario</h3>
            <p>
              Carga productos a mano o con foto asistida. Ves stock, reservas y alertas en
              un vistazo.
            </p>
          </li>
          <li>
            <h3>Vende con un enlace</h3>
            <p>
              Reservas el stock y compartes un link seguro. El comprador paga con
              transferencia o Mercado Pago.
            </p>
          </li>
          <li>
            <h3>Despacha con seguimiento</h3>
            <p>
              Generas la etiqueta, registras el envío y el comprador ve el estado hasta la
              entrega.
            </p>
          </li>
        </ol>
      </section>

      <section className="landing-plans" id="planes" aria-labelledby="plans-title">
        <div className="landing-section__intro">
          <h2 id="plans-title">Empieza gratis. Crece cuando lo necesites.</h2>
          <p>
            Hasta 5 productos sin costo. La creación asistida con foto y más cupo están en
            los planes de pago.
          </p>
        </div>
        <div className="landing-plans__grid">
          {SIGNUP_PLAN_OPTIONS.map((plan) => (
            <Link
              key={plan.code}
              className={
                plan.code === 'starter'
                  ? 'landing-plan landing-plan--featured'
                  : 'landing-plan'
              }
              to={`/registro?plan=${plan.code}`}
              onClick={() => trackCta(`plan_${plan.code}`)}
            >
              <span className="landing-plan__name">{plan.name}</span>
              <span className="landing-plan__price">
                {formatSignupPlanPrice(plan.priceClp)}
                {plan.priceClp > 0 ? (
                  <span className="landing-plan__period"> / mes</span>
                ) : null}
              </span>
              <span className="landing-plan__summary">{plan.summary}</span>
              <span className="landing-plan__cta">
                {plan.code === 'free' ? 'Empezar gratis' : 'Elegir este plan'}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="landing-close" aria-labelledby="close-title">
        <h2 id="close-title">Tu negocio, más simple.</h2>
        <p>Crea tu cuenta en minutos y deja las planillas en el pasado.</p>
        <Link
          className="button button--primary"
          to="/registro?plan=free"
          onClick={() => trackCta('cerrar_comenzar')}
        >
          Crear cuenta gratis
        </Link>
      </section>

      <footer className="landing-footer">
        <Link className="wordmark" to="/">
          tenda
        </Link>
        <div className="landing-footer__links">
          <Link to="/contacto">Contacto</Link>
          <Link to="/terminos">Términos y condiciones</Link>
          <Link to="/login">Iniciar sesión</Link>
        </div>
      </footer>
    </main>
  )
}
