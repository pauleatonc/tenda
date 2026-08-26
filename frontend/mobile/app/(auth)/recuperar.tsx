import { Link, router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'

import {
  AuthScaffold,
  FormField,
  PrimaryButton,
  StatusMessage,
  styles,
} from '../../components/auth-ui'
import {
  MobileApiError,
  mobileConfirmPasswordReset,
  mobileRequestPasswordReset,
} from '../../lib/auth-api'

export default function RecoveryScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>()
  const resetToken = Array.isArray(token) ? token[0] : token
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<MobileApiError | null>(null)
  const [message, setMessage] = useState('')
  const [validation, setValidation] = useState<Record<string, string>>({})

  const submit = async () => {
    const nextValidation: Record<string, string> = {}
    if (resetToken) {
      if (password.length < 10) nextValidation.password = 'Usa al menos 10 caracteres.'
      if (password !== confirmation)
        nextValidation.confirmation = 'Las contraseñas no coinciden.'
    } else if (!email.includes('@')) {
      nextValidation.email = 'Ingresa un correo válido.'
    }
    setValidation(nextValidation)
    if (Object.keys(nextValidation).length) return
    setError(null)
    setLoading(true)
    try {
      const result = resetToken
        ? await mobileConfirmPasswordReset(resetToken, password)
        : await mobileRequestPasswordReset(email)
      setMessage(result.message)
    } catch (caught) {
      setError(caught instanceof MobileApiError ? caught : null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthScaffold
      eyebrow="Recupera tu acceso"
      title={resetToken ? 'Crea una contraseña nueva' : '¿Olvidaste tu contraseña?'}
      description={
        resetToken
          ? 'Cerraremos las sesiones anteriores cuando guardes el cambio.'
          : 'La respuesta será la misma exista o no una cuenta para ese correo.'
      }
    >
      {error ? <StatusMessage message={error.message} /> : null}
      {message ? <StatusMessage kind="success" message={message} /> : null}
      {resetToken ? (
        <>
          <FormField
            autoCapitalize="none"
            autoComplete="new-password"
            error={validation.password}
            label="Contraseña nueva"
            onChangeText={setPassword}
            secureTextEntry
            value={password}
          />
          <FormField
            autoCapitalize="none"
            autoComplete="new-password"
            error={validation.confirmation}
            label="Repite la contraseña"
            onChangeText={setConfirmation}
            secureTextEntry
            value={confirmation}
          />
        </>
      ) : (
        <FormField
          autoCapitalize="none"
          autoComplete="email"
          error={validation.email}
          keyboardType="email-address"
          label="Correo"
          onChangeText={setEmail}
          value={email}
        />
      )}
      <PrimaryButton
        disabled={Boolean(message)}
        label={resetToken ? 'Guardar contraseña' : 'Enviar instrucciones'}
        loading={loading}
        onPress={submit}
      />
      {resetToken && message ? (
        <PrimaryButton
          label="Iniciar sesión"
          onPress={() => router.replace('/(auth)/login')}
          variant="secondary"
        />
      ) : null}
      <Link href="/(auth)/login" style={styles.link}>
        Volver al inicio de sesión
      </Link>
    </AuthScaffold>
  )
}
