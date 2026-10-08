import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { SLOW_QUERY_STALE_MS } from '../lib/queryDefaults'
import { fetchTermsAndConditions, termsKeys } from './termsApi'

export function TermsPage() {
  const terms = useQuery({
    queryKey: termsKeys.root,
    queryFn: fetchTermsAndConditions,
    staleTime: SLOW_QUERY_STALE_MS,
  })

  return (
    <main className="legal-page">
      <nav className="landing__nav" aria-label="Navegación">
        <Link className="wordmark" to="/">
          tenda
        </Link>
        <div className="landing__nav-actions">
          <Link className="button button--ghost" to="/contacto">
            Contacto
          </Link>
          <Link className="button button--primary" to="/registro">
            Crear cuenta
          </Link>
        </div>
      </nav>

      <article className="legal-page__article">
        {terms.isPending ? (
          <>
            <p className="eyebrow">Legal</p>
            <h1>Términos y condiciones</h1>
            <p>Cargando el documento…</p>
          </>
        ) : null}

        {terms.isError ? (
          <>
            <p className="eyebrow">Legal</p>
            <h1>Términos y condiciones</h1>
            <p>No pudimos cargar los términos. Inténtalo más tarde.</p>
          </>
        ) : null}

        {terms.data ? (
          <>
            <p className="eyebrow">Legal</p>
            <h1>{terms.data.title}</h1>
            <p className="legal-page__meta">
              Actualizado el{' '}
              {new Intl.DateTimeFormat('es-CL', {
                dateStyle: 'long',
              }).format(new Date(terms.data.updatedAt))}
            </p>
            <div
              className="legal-page__body"
              dangerouslySetInnerHTML={{ __html: terms.data.bodyHtml }}
            />
          </>
        ) : null}

        {!terms.isPending && !terms.isError && !terms.data ? (
          <>
            <p className="eyebrow">Legal</p>
            <h1>Términos y condiciones</h1>
            <p>Aún no hay un documento publicado.</p>
          </>
        ) : null}
      </article>

      <footer className="landing-footer">
        <Link className="wordmark" to="/">
          tenda
        </Link>
        <div className="landing-footer__links">
          <Link to="/contacto">Contacto</Link>
          <Link to="/terminos" aria-current="page">
            Términos y condiciones
          </Link>
        </div>
      </footer>
    </main>
  )
}
