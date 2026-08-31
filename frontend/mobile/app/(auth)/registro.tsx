import { Link, router } from 'expo-router'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import {
  AuthScaffold,
  FormField,
  PrimaryButton,
  StatusMessage,
  colors,
  styles,
} from '../../components/auth-ui'
import { MobileTurnstile, mobileTurnstileEnabled } from '../../components/turnstile'
import { MobileApiError, mobileRegister } from '../../lib/auth-api'

export default function RegisterScreen() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<MobileApiError | null>(null)
  const [turnstileToken, setTurnstileToken] = useState('')
  const [validation, setValidation] = useState<Record<string, string>>({})

  const submit = async () => {
    const nextValidation: Record<string, string> = {}
    if (fullName.trim().length < 2) nextValidation.fullName = 'Ingresa tu nombre.'
    if (!email.includes('@')) nextValidation.email = 'Ingresa un correo válido.'
    if (password.length < 10) nextValidation.password = 'Usa al menos 10 caracteres.'
    if (!acceptedTerms) nextValidation.terms = 'Debes aceptar los términos.'
    setValidation(nextValidation)
    if (Object.keys(nextValidation).length) return
    if (mobileTurnstileEnabled() && !turnstileToken) {
      setError(
        new MobileApiError({
          code: 'ANTIBOT_FAILED',
          message: 'Completa la validación anti-bot para continuar.',
          fieldErrors: {},
          correlationId: '',
        }),
      )
      return
    }
    setError(null)
    setLoading(true)
    try {
      await mobileRegister({
        fullName,
        email,
        password,
        acceptedTerms,
        turnstileToken: turnstileToken || 'local-development',
      })
      router.replace({ pathname: '/(auth)/verificar', params: { email } })
    } catch (caught) {
      setError(caught instanceof MobileApiError ? caught : null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthScaffold
      eyebrow="Comienza hoy"
      title="Crea tu cuenta"
      description="Tu Tienda y tu inventario principal se crean en el mismo paso."
    >
      {error ? <StatusMessage message={error.message} /> : null}
      <FormField
        autoCapitalize="words"
        autoComplete="name"
        error={validation.fullName}
        label="Nombre"
        onChangeText={setFullName}
        value={fullName}
      />
      <FormField
        autoCapitalize="none"
        autoComplete="email"
        error={validation.email}
        keyboardType="email-address"
        label="Correo"
        onChangeText={setEmail}
        value={email}
      />
      <FormField
        autoCapitalize="none"
        autoComplete="new-password"
        error={validation.password}
        label="Contraseña"
        onChangeText={setPassword}
        secureTextEntry
        value={password}
      />
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: acceptedTerms }}
        onPress={() => setAcceptedTerms((current) => !current)}
        style={localStyles.checkbox}
      >
        <View
          style={[
            localStyles.checkboxMark,
            acceptedTerms && localStyles.checkboxMarkChecked,
          ]}
        >
          <Text style={localStyles.check}>{acceptedTerms ? '✓' : ''}</Text>
        </View>
        <Text style={localStyles.checkboxLabel}>
          Acepto los términos y la política de privacidad de Tenda.
        </Text>
      </Pressable>
      {validation.terms ? (
        <Text style={localStyles.error}>{validation.terms}</Text>
      ) : null}
      <MobileTurnstile onToken={setTurnstileToken} />
      <PrimaryButton label="Crear cuenta" loading={loading} onPress={submit} />
      <Link href="/(auth)/login" style={styles.link}>
        Ya tengo una cuenta
      </Link>
    </AuthScaffold>
  )
}

const localStyles = StyleSheet.create({
  checkbox: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    minHeight: 48,
    paddingVertical: 7,
  },
  checkboxMark: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: 6,
    borderWidth: 2,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  checkboxMarkChecked: { backgroundColor: colors.green, borderColor: colors.green },
  check: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  checkboxLabel: { color: colors.inkSoft, flex: 1, fontSize: 14, lineHeight: 21 },
  error: { color: colors.error, fontSize: 13 },
})
