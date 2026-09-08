import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useForm, type UseFormRegisterReturn } from 'react-hook-form'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { GoogleSignInButton } from '../components/GoogleSignInButton'
import { TurnstileField, turnstileSiteKey } from '../components/TurnstileField'
import {
  TendaApiError,
  confirmPasswordReset,
  getViewer,
  login,
  logout,
  registerAccount,
  requestPasswordReset,
  resendVerification,
  verifyEmail,
} from './api'

const emailField = z.string().trim().email('Ingresa un correo válido.')
const passwordField = z.string().min(10, 'Usa al menos 10 caracteres.')

const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Ingresa tu contraseña.'),
})

const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Ingresa tu nombre.'),
  email: emailField,
  password: passwordField,
  acceptedTerms: z.boolean().refine(Boolean, 'Debes aceptar los términos.'),
})

const emailSchema = z.object({ email: emailField })

const resetSchema = z
  .object({
    password: passwordField,
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Las contraseñas no coinciden.',
  })

type LoginValues = z.infer<typeof loginSchema>
type RegisterValues = z.infer<typeof registerSchema>
type EmailValues = z.infer<typeof emailSchema>
type ResetValues = z.infer<typeof resetSchema>

function AuthShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <main className="auth-page">
      <section className="auth-intro" aria-label="Tenda">
        <Link className="wordmark wordmark--light" to="/" aria-label="Tenda, inicio">
          tenda
        </Link>
        <div>
          <p className="eyebrow eyebrow--light">Tu negocio, en orden</p>
          <h2>Una base clara para vender con tranquilidad.</h2>
          <p>Inventario, ventas y despachos sin planillas dispersas.</p>
        </div>
        <small>Control simple. Decisiones informadas.</small>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="auth-card__lead">{description}</p>
          {children}
        </div>
      </section>
    </main>
  )
}

function ErrorSummary({ error }: { error: unknown }) {
  if (!error) return null
  const apiError = error instanceof TendaApiError ? error : null
  return (
    <div className="form-message form-message--error" role="alert">
      <strong>No pudimos completar la acción</strong>
      <span>{apiError?.message ?? 'Revisa tu conexión e inténtalo nuevamente.'}</span>
      {apiError?.correlationId ? (
        <small>Referencia: {apiError.correlationId}</small>
      ) : null}
    </div>
  )
}

function PasswordInput({
  id,
  label,
  error,
  registration,
  autoComplete,
}: {
  id: string
  label: string
  error?: string
  registration: UseFormRegisterReturn
  autoComplete: string
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="password-control">
        <input
          {...registration}
          aria-describedby={error ? `${id}-error` : undefined}
          aria-invalid={Boolean(error)}
          autoComplete={autoComplete}
          id={id}
          type={visible ? 'text' : 'password'}
        />
        <button type="button" onClick={() => setVisible((current) => !current)}>
          {visible ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>
      {error ? (
        <span className="field__error" id={`${id}-error`}>
          {error}
        </span>
      ) : null}
    </div>
  )
}

export function LoginPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [serverError, setServerError] = useState<unknown>(null)
  const [turnstileToken, setTurnstileToken] = useState('')
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })

  return (
    <AuthShell
      eyebrow="Bienvenido"
      title="Inicia sesión"
      description="Vuelve a tu negocio y continúa donde quedaste."
    >
      <GoogleSignInButton onError={setServerError} />
      <div className="auth-divider">
        <span>o usa tu correo</span>
      </div>
      <ErrorSummary error={serverError} />
      <form
        className="auth-form"
        noValidate
        onSubmit={handleSubmit(async (values) => {
          setServerError(null)
          if (turnstileSiteKey() && !turnstileToken) {
            setServerError(
              new TendaApiError(
                {
                  code: 'ANTIBOT_FAILED',
                  message: 'Completa la validación anti-bot para continuar.',
                  fieldErrors: {},
                  correlationId: '',
                },
                400,
              ),
            )
            return
          }
          try {
            const viewer = await login({
              ...values,
              turnstileToken: turnstileToken || 'local-development',
            })
            queryClient.setQueryData(['viewer'], viewer)
            navigate('/app', { replace: true })
          } catch (error) {
            setServerError(error)
          }
        })}
      >
        <div className="field">
          <label htmlFor="login-email">Correo</label>
          <input
            {...register('email')}
            aria-describedby={errors.email ? 'login-email-error' : undefined}
            aria-invalid={Boolean(errors.email)}
            autoComplete="email"
            id="login-email"
            inputMode="email"
            type="email"
          />
          {errors.email ? (
            <span className="field__error" id="login-email-error">
              {errors.email.message}
            </span>
          ) : null}
        </div>
        <PasswordInput
          autoComplete="current-password"
          error={errors.password?.message}
          id="login-password"
          label="Contraseña"
          registration={register('password')}
        />
        <TurnstileField onToken={setTurnstileToken} />
        <div className="form-row">
          <Link to="/recuperar">¿Olvidaste tu contraseña?</Link>
          {serverError instanceof TendaApiError &&
          serverError.code === 'EMAIL_UNVERIFIED' ? (
            <Link to="/verificar-email">Reenviar verificación</Link>
          ) : null}
        </div>
        <button className="button button--primary button--wide" disabled={isSubmitting}>
          {isSubmitting ? 'Ingresando…' : 'Iniciar sesión'}
        </button>
      </form>
      <p className="auth-card__footer">
        ¿Aún no tienes cuenta? <Link to="/registro">Créala aquí</Link>
      </p>
    </AuthShell>
  )
}

export function RegisterPage() {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<unknown>(null)
  const [turnstileToken, setTurnstileToken] = useState('')
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { acceptedTerms: false },
  })

  return (
    <AuthShell
      eyebrow="Comienza hoy"
      title="Crea tu cuenta"
      description="Solo necesitamos lo esencial. Tu Tienda e inventario se crean contigo."
    >
      <GoogleSignInButton onError={setServerError} />
      <div className="auth-divider">
        <span>o regístrate con correo</span>
      </div>
      <ErrorSummary error={serverError} />
      <form
        className="auth-form"
        noValidate
        onSubmit={handleSubmit(async (values) => {
          setServerError(null)
          if (turnstileSiteKey() && !turnstileToken) {
            setServerError(
              new TendaApiError(
                {
                  code: 'ANTIBOT_FAILED',
                  message: 'Completa la validación anti-bot para continuar.',
                  fieldErrors: {},
                  correlationId: '',
                },
                400,
              ),
            )
            return
          }
          try {
            await registerAccount({
              ...values,
              turnstileToken: turnstileToken || 'local-development',
            })
            navigate('/verificar-email', {
              replace: true,
              state: { email: values.email },
            })
          } catch (error) {
            setServerError(error)
          }
        })}
      >
        <div className="field">
          <label htmlFor="register-name">Nombre</label>
          <input
            {...register('fullName')}
            aria-describedby={errors.fullName ? 'register-name-error' : undefined}
            aria-invalid={Boolean(errors.fullName)}
            autoComplete="name"
            id="register-name"
          />
          {errors.fullName ? (
            <span className="field__error" id="register-name-error">
              {errors.fullName.message}
            </span>
          ) : null}
        </div>
        <div className="field">
          <label htmlFor="register-email">Correo</label>
          <input
            {...register('email')}
            aria-describedby={errors.email ? 'register-email-error' : undefined}
            aria-invalid={Boolean(errors.email)}
            autoComplete="email"
            id="register-email"
            inputMode="email"
            type="email"
          />
          {errors.email ? (
            <span className="field__error" id="register-email-error">
              {errors.email.message}
            </span>
          ) : null}
        </div>
        <PasswordInput
          autoComplete="new-password"
          error={errors.password?.message}
          id="register-password"
          label="Contraseña"
          registration={register('password')}
        />
        <label className="checkbox-field">
          <input {...register('acceptedTerms')} type="checkbox" />
          <span>Acepto los términos y la política de privacidad de Tenda.</span>
        </label>
        {errors.acceptedTerms ? (
          <span className="field__error">{errors.acceptedTerms.message}</span>
        ) : null}
        <TurnstileField onToken={setTurnstileToken} />
        <button className="button button--primary button--wide" disabled={isSubmitting}>
          {isSubmitting ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>
      </form>
      <p className="auth-card__footer">
        ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
      </p>
    </AuthShell>
  )
}

export function VerificationPage() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const token = searchParams.get('token')
  const stateEmail = (location.state as { email?: string } | null)?.email ?? ''
  const started = useRef(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(
    token ? 'loading' : 'idle',
  )
  const [serverError, setServerError] = useState<unknown>(null)
  const [message, setMessage] = useState('')
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EmailValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: stateEmail },
  })

  useEffect(() => {
    if (!token || started.current) return
    started.current = true
    verifyEmail(token)
      .then(() => setStatus('success'))
      .catch((error: unknown) => {
        setServerError(error)
        setStatus('error')
      })
  }, [token])

  return (
    <AuthShell
      eyebrow="Confirma tu correo"
      title={status === 'success' ? 'Correo verificado' : 'Revisa tu bandeja'}
      description="La verificación protege tu negocio y tus sesiones."
    >
      {status === 'loading' ? (
        <div className="form-message" aria-live="polite">
          <strong>Verificando tu enlace…</strong>
          <span>Esto tomará solo un momento.</span>
        </div>
      ) : null}
      {status === 'success' ? (
        <div className="form-message form-message--success" role="status">
          <strong>Tu cuenta está lista.</strong>
          <span>Ya puedes entrar a tu Tienda.</span>
          <button
            className="button button--primary button--wide"
            onClick={() => navigate('/app')}
          >
            Ir a Tenda
          </button>
        </div>
      ) : null}
      {status === 'error' ? <ErrorSummary error={serverError} /> : null}
      {status !== 'loading' && status !== 'success' ? (
        <form
          className="auth-form"
          noValidate
          onSubmit={handleSubmit(async ({ email }) => {
            setServerError(null)
            try {
              const result = await resendVerification(email)
              setMessage(result.message)
            } catch (error) {
              setServerError(error)
            }
          })}
        >
          <div className="field">
            <label htmlFor="verification-email">Correo</label>
            <input
              {...register('email')}
              aria-invalid={Boolean(errors.email)}
              autoComplete="email"
              id="verification-email"
              inputMode="email"
              type="email"
            />
            {errors.email ? (
              <span className="field__error">{errors.email.message}</span>
            ) : null}
          </div>
          {message ? (
            <div className="form-message form-message--success" role="status">
              <span>{message}</span>
            </div>
          ) : null}
          <button className="button button--primary button--wide" disabled={isSubmitting}>
            {isSubmitting ? 'Enviando…' : 'Reenviar enlace'}
          </button>
        </form>
      ) : null}
      <p className="auth-card__footer">
        <Link to="/login">Volver al inicio de sesión</Link>
      </p>
    </AuthShell>
  )
}

export function RecoveryPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<unknown>(null)
  const [message, setMessage] = useState('')
  const emailForm = useForm<EmailValues>({ resolver: zodResolver(emailSchema) })
  const resetForm = useForm<ResetValues>({ resolver: zodResolver(resetSchema) })

  return (
    <AuthShell
      eyebrow="Recupera tu acceso"
      title={token ? 'Crea una contraseña nueva' : '¿Olvidaste tu contraseña?'}
      description={
        token
          ? 'Al guardar, cerraremos las sesiones anteriores para proteger tu cuenta.'
          : 'Te enviaremos instrucciones si encontramos una cuenta para ese correo.'
      }
    >
      <ErrorSummary error={serverError} />
      {token ? (
        <form
          className="auth-form"
          noValidate
          onSubmit={resetForm.handleSubmit(async ({ password }) => {
            setServerError(null)
            try {
              const result = await confirmPasswordReset(token, password)
              setMessage(result.message)
            } catch (error) {
              setServerError(error)
            }
          })}
        >
          <PasswordInput
            autoComplete="new-password"
            error={resetForm.formState.errors.password?.message}
            id="reset-password"
            label="Contraseña nueva"
            registration={resetForm.register('password')}
          />
          <PasswordInput
            autoComplete="new-password"
            error={resetForm.formState.errors.confirmPassword?.message}
            id="reset-confirm-password"
            label="Repite la contraseña"
            registration={resetForm.register('confirmPassword')}
          />
          {message ? (
            <div className="form-message form-message--success" role="status">
              <strong>Contraseña actualizada</strong>
              <span>{message}</span>
            </div>
          ) : null}
          <button
            className="button button--primary button--wide"
            disabled={resetForm.formState.isSubmitting || Boolean(message)}
          >
            {resetForm.formState.isSubmitting ? 'Guardando…' : 'Guardar contraseña'}
          </button>
          {message ? (
            <button
              className="button button--secondary button--wide"
              type="button"
              onClick={() => navigate('/login')}
            >
              Iniciar sesión
            </button>
          ) : null}
        </form>
      ) : (
        <form
          className="auth-form"
          noValidate
          onSubmit={emailForm.handleSubmit(async ({ email }) => {
            setServerError(null)
            try {
              const result = await requestPasswordReset(email)
              setMessage(result.message)
            } catch (error) {
              setServerError(error)
            }
          })}
        >
          <div className="field">
            <label htmlFor="recovery-email">Correo</label>
            <input
              {...emailForm.register('email')}
              aria-invalid={Boolean(emailForm.formState.errors.email)}
              autoComplete="email"
              id="recovery-email"
              inputMode="email"
              type="email"
            />
            {emailForm.formState.errors.email ? (
              <span className="field__error">
                {emailForm.formState.errors.email.message}
              </span>
            ) : null}
          </div>
          {message ? (
            <div className="form-message form-message--success" role="status">
              <span>{message}</span>
            </div>
          ) : null}
          <button
            className="button button--primary button--wide"
            disabled={emailForm.formState.isSubmitting}
          >
            {emailForm.formState.isSubmitting ? 'Enviando…' : 'Enviar instrucciones'}
          </button>
        </form>
      )}
      <p className="auth-card__footer">
        <Link to="/login">Volver al inicio de sesión</Link>
      </p>
    </AuthShell>
  )
}

export function AppHomePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [loggingOut, setLoggingOut] = useState(false)
  const viewer = useQuery({
    queryKey: ['viewer'],
    queryFn: getViewer,
    retry: false,
  })

  if (viewer.isPending) {
    return (
      <main className="app-loading" aria-live="polite">
        <span className="wordmark">tenda</span>
        <p>Cargando tu Tienda…</p>
      </main>
    )
  }
  if (viewer.isError) {
    const unauthenticated =
      viewer.error instanceof TendaApiError &&
      viewer.error.code === 'AUTHENTICATION_REQUIRED'
    return (
      <main className="app-loading">
        <span className="wordmark">tenda</span>
        <h1>{unauthenticated ? 'Tu sesión terminó' : 'No pudimos cargar tu cuenta'}</h1>
        <p>{viewer.error.message}</p>
        <Link className="button button--primary" to={unauthenticated ? '/login' : '/app'}>
          {unauthenticated ? 'Iniciar sesión' : 'Reintentar'}
        </Link>
      </main>
    )
  }
  const data = viewer.data
  return (
    <main className="app-home">
      <header className="app-home__header">
        <span className="wordmark">tenda</span>
        <button
          className="button button--secondary"
          disabled={loggingOut}
          onClick={async () => {
            setLoggingOut(true)
            try {
              await logout()
              queryClient.removeQueries({ queryKey: ['viewer'] })
              navigate('/login', { replace: true })
            } finally {
              setLoggingOut(false)
            }
          }}
        >
          {loggingOut ? 'Cerrando…' : 'Cerrar sesión'}
        </button>
      </header>
      <section className="app-home__welcome">
        <p className="eyebrow">{data.inventory.name}</p>
        <h1>Hola, {data.viewer.profile.fullName || data.viewer.email}</h1>
        <p>
          Estás trabajando en <strong>{data.organisation.name}</strong>.
        </p>
      </section>
      <section className="context-grid" aria-label="Contexto de la cuenta">
        <article>
          <span>Rol</span>
          <strong className="profile-role">{data.membership.roleLabel}</strong>
        </article>
        <article>
          <span>Finanzas</span>
          <strong>
            {data.membership.permissions.viewFinancials ? 'Habilitadas' : 'Restringidas'}
          </strong>
        </article>
        <article>
          <span>Miembros</span>
          <strong>
            {data.membership.permissions.manageMembers
              ? 'Puedes administrar'
              : 'Solo Owner'}
          </strong>
        </article>
      </section>
    </main>
  )
}
