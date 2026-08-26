import { Link, router } from 'expo-router'
import { useState } from 'react'
import { Pressable, Text } from 'react-native'

import {
  AuthScaffold,
  FormField,
  PrimaryButton,
  StatusMessage,
  styles,
} from '../../components/auth-ui'
import { MobileApiError, mobileGoogleLogin, mobileLogin } from '../../lib/auth-api'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<MobileApiError | null>(null)
  const [validation, setValidation] = useState<{ email?: string; password?: string }>({})

  const submit = async () => {
    const nextValidation = {
      email: email.includes('@') ? undefined : 'Ingresa un correo válido.',
      password: password ? undefined : 'Ingresa tu contraseña.',
    }
    setValidation(nextValidation)
    if (nextValidation.email || nextValidation.password) return
    setError(null)
    setLoading(true)
    try {
      await mobileLogin(email, password)
      router.replace('/(app)')
    } catch (caught) {
      setError(
        caught instanceof MobileApiError
          ? caught
          : new MobileApiError({
              code: 'UNEXPECTED_ERROR',
              message: 'No pudimos iniciar sesión.',
              fieldErrors: {},
              correlationId: '',
            }),
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthScaffold
      eyebrow="Bienvenido"
      title="Inicia sesión"
      description="Vuelve a tu negocio y continúa donde quedaste."
    >
      <PrimaryButton
        label="Continuar con Google"
        loading={googleLoading}
        onPress={async () => {
          setError(null)
          setGoogleLoading(true)
          try {
            await mobileGoogleLogin()
            router.replace('/(app)')
          } catch (caught) {
            setError(caught instanceof MobileApiError ? caught : null)
          } finally {
            setGoogleLoading(false)
          }
        }}
        variant="secondary"
      />
      <Text style={styles.divider}>o usa tu correo</Text>
      {error ? <StatusMessage message={error.message} /> : null}
      <FormField
        autoCapitalize="none"
        autoComplete="email"
        error={validation.email}
        keyboardType="email-address"
        label="Correo"
        onChangeText={setEmail}
        returnKeyType="next"
        value={email}
      />
      <FormField
        autoCapitalize="none"
        autoComplete="current-password"
        error={validation.password}
        label="Contraseña"
        onChangeText={setPassword}
        onSubmitEditing={submit}
        returnKeyType="done"
        secureTextEntry={!showPassword}
        value={password}
      />
      <Pressable
        accessibilityRole="button"
        onPress={() => setShowPassword((current) => !current)}
      >
        <Text style={styles.link}>
          {showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        </Text>
      </Pressable>
      <PrimaryButton label="Iniciar sesión" loading={loading} onPress={submit} />
      {error?.code === 'EMAIL_UNVERIFIED' ? (
        <Link href="/(auth)/verificar" style={styles.link}>
          Reenviar verificación
        </Link>
      ) : null}
      <Link href="/(auth)/recuperar" style={styles.link}>
        ¿Olvidaste tu contraseña?
      </Link>
      <Link href="/(auth)/registro" style={styles.link}>
        Crear una cuenta
      </Link>
    </AuthScaffold>
  )
}
