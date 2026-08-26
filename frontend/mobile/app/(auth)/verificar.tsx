import { Link, router, useLocalSearchParams } from 'expo-router'
import { useEffect, useRef, useState } from 'react'

import {
  AuthScaffold,
  FormField,
  PrimaryButton,
  StatusMessage,
  styles,
} from '../../components/auth-ui'
import {
  MobileApiError,
  mobileResendVerification,
  mobileVerifyEmail,
} from '../../lib/auth-api'

export default function VerificationScreen() {
  const params = useLocalSearchParams<{ token?: string; email?: string }>()
  const rawToken = Array.isArray(params.token) ? params.token[0] : params.token
  const initialEmail = Array.isArray(params.email) ? params.email[0] : params.email
  const [email, setEmail] = useState(initialEmail ?? '')
  const [loading, setLoading] = useState(Boolean(rawToken))
  const [verified, setVerified] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState<MobileApiError | null>(null)
  const [emailError, setEmailError] = useState('')
  const started = useRef(false)

  useEffect(() => {
    if (!rawToken || started.current) return
    started.current = true
    mobileVerifyEmail(rawToken)
      .then(() => setVerified(true))
      .catch((caught: unknown) => {
        setError(caught instanceof MobileApiError ? caught : null)
      })
      .finally(() => setLoading(false))
  }, [rawToken])

  const resend = async () => {
    if (!email.includes('@')) {
      setEmailError('Ingresa un correo válido.')
      return
    }
    setEmailError('')
    setError(null)
    setLoading(true)
    try {
      const result = await mobileResendVerification(email)
      setMessage(result.message)
    } catch (caught) {
      setError(caught instanceof MobileApiError ? caught : null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthScaffold
      eyebrow="Confirma tu correo"
      title={verified ? 'Correo verificado' : 'Revisa tu bandeja'}
      description="La verificación protege la información de tu negocio."
    >
      {loading && rawToken ? (
        <StatusMessage kind="success" message="Verificando tu enlace…" />
      ) : null}
      {error ? <StatusMessage message={error.message} /> : null}
      {verified ? (
        <>
          <StatusMessage kind="success" message="Tu cuenta está lista para usar Tenda." />
          <PrimaryButton label="Ir a Tenda" onPress={() => router.replace('/(app)')} />
        </>
      ) : (
        <>
          <FormField
            autoCapitalize="none"
            autoComplete="email"
            error={emailError}
            keyboardType="email-address"
            label="Correo"
            onChangeText={setEmail}
            value={email}
          />
          {message ? <StatusMessage kind="success" message={message} /> : null}
          <PrimaryButton label="Reenviar enlace" loading={loading} onPress={resend} />
        </>
      )}
      <Link href="/(auth)/login" style={styles.link}>
        Volver al inicio de sesión
      </Link>
    </AuthScaffold>
  )
}
