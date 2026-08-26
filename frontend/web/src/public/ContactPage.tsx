import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'

import { submitContact, TendaApiError } from '../auth/api'
import { FormErrorSummary } from '../components/ui'

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: {
          sitekey: string
          callback: (token: string) => void
          'expired-callback': () => void
          theme: 'light'
        },
      ) => string
      remove: (widgetId: string) => void
    }
  }
}

const schema = z.object({
  name: z.string().trim().min(2, 'Ingresa tu nombre.').max(160),
  email: z.email('Ingresa un correo válido.'),
  message: z
    .string()
    .trim()
    .min(10, 'Cuéntanos un poco más para poder ayudarte.')
    .max(4000),
})

type ContactForm = z.infer<typeof schema>

function TurnstileField({ onToken }: { onToken: (token: string) => void }) {
  const container = useRef<HTMLDivElement>(null)
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined

  useEffect(() => {
    if (!siteKey) {
      if (import.meta.env.DEV) onToken('local-development')
      return
    }
    let widgetId = ''
    const render = () => {
      if (!container.current || !window.turnstile) return
      widgetId = window.turnstile.render(container.current, {
        sitekey: siteKey,
        callback: onToken,
        'expired-callback': () => onToken(''),
        theme: 'light',
      })
    }
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-tenda-turnstile]',
    )
    if (window.turnstile) {
      render()
    } else if (existing) {
      existing.addEventListener('load', render, { once: true })
    } else {
      const script = document.createElement('script')
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.async = true
      script.defer = true
      script.dataset.tendaTurnstile = 'true'
      script.addEventListener('load', render, { once: true })
      document.head.appendChild(script)
    }
    return () => {
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId)
      existing?.removeEventListener('load', render)
    }
  }, [onToken, siteKey])

  if (!siteKey && import.meta.env.DEV) return null
  return <div ref={container} aria-label="Validación anti-bot" />
}

export function ContactPage() {
  const [turnstileToken, setTurnstileToken] = useState('')
  const [result, setResult] = useState('')
  const [serverError, setServerError] = useState('')
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ContactForm>({ resolver: zodResolver(schema) })

  return (
    <main className="contact-page">
      <nav className="landing__nav">
        <Link className="wordmark" to="/">
          tenda
        </Link>
        <Link className="button button--ghost" to="/login">
          Iniciar sesión
        </Link>
      </nav>
      <section className="contact-layout">
        <div>
          <p className="eyebrow">Conversemos</p>
          <h1>¿Cómo podemos ayudarte?</h1>
          <p>
            Escríbenos sobre tu negocio o sobre Tenda. Respondemos sin incluir datos
            sensibles en el correo.
          </p>
        </div>
        <form
          onSubmit={handleSubmit(async (values) => {
            setServerError('')
            setResult('')
            if (!turnstileToken) {
              setServerError('Completa la validación antes de enviar.')
              return
            }
            try {
              const response = await submitContact({ ...values, turnstileToken })
              setResult(response.message)
              reset()
            } catch (error) {
              setServerError(
                error instanceof TendaApiError
                  ? error.message
                  : 'No pudimos enviar tu mensaje.',
              )
            }
          })}
        >
          <FormErrorSummary
            errors={{
              name: errors.name?.message,
              email: errors.email?.message,
              message: errors.message?.message,
            }}
          />
          {serverError ? (
            <p className="auth-status auth-status--error" role="alert">
              {serverError}
            </p>
          ) : null}
          {result ? (
            <p className="auth-status auth-status--success" role="status">
              {result}
            </p>
          ) : null}
          <label htmlFor="name">Nombre</label>
          <input id="name" autoComplete="name" {...register('name')} />
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" {...register('email')} />
          <label htmlFor="message">Mensaje</label>
          <textarea id="message" rows={6} {...register('message')} />
          <TurnstileField onToken={setTurnstileToken} />
          <button
            className="button button--primary"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? 'Enviando…' : 'Enviar mensaje'}
          </button>
        </form>
      </section>
    </main>
  )
}
