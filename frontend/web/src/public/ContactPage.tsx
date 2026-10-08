import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'

import { submitContact, TendaApiError } from '../auth/api'
import { TurnstileField, turnstileSiteKey } from '../components/TurnstileField'
import { FormErrorSummary } from '../components/ui'

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
            if (turnstileSiteKey() && !turnstileToken) {
              setServerError('Completa la validación anti-bot para continuar.')
              return
            }
            try {
              const response = await submitContact({
                ...values,
                turnstileToken: turnstileToken || 'local-development',
              })
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
      <footer className="landing-footer">
        <Link className="wordmark" to="/">
          tenda
        </Link>
        <div className="landing-footer__links">
          <Link to="/terminos">Términos y condiciones</Link>
          <Link to="/login">Iniciar sesión</Link>
        </div>
      </footer>
    </main>
  )
}
