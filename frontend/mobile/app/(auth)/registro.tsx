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
import { AnalyticsEvents, getAnalytics } from '../../lib/analytics'
import { MobileApiError, mobileRegister } from '../../lib/auth-api'
import {
  SIGNUP_PLAN_OPTIONS,
  formatSignupPlanPrice,
  type SignupPlanOption,
} from '../../lib/plan-catalog'

export default function RegisterScreen() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [planCode, setPlanCode] = useState<SignupPlanOption['code']>('free')
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
        planCode,
        turnstileToken: turnstileToken || 'local-development',
      })
      getAnalytics().track(AnalyticsEvents.signUp, { method: 'email' })
      router.replace({
        pathname: '/(auth)/verificar',
        params: { email, planCode },
      })
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
      description="Elige tu plan; tu Tienda e inventario se crean en el mismo paso."
    >
      {error ? <StatusMessage message={error.message} /> : null}
      <Text style={localStyles.sectionLabel}>Elige tu plan</Text>
      <View style={localStyles.planList}>
        {SIGNUP_PLAN_OPTIONS.map((plan) => {
          const selected = planCode === plan.code
          return (
            <Pressable
              key={plan.code}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => setPlanCode(plan.code)}
              style={[localStyles.planOption, selected && localStyles.planOptionSelected]}
            >
              <Text style={localStyles.planName}>{plan.name}</Text>
              <Text style={localStyles.planPrice}>{formatSignupPlanPrice(plan.priceClp)}</Text>
              <Text style={localStyles.planSummary}>{plan.summary}</Text>
            </Pressable>
          )
        })}
      </View>
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
  sectionLabel: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  planList: {
    gap: 10,
    marginBottom: 8,
  },
  planOption: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  planOptionSelected: {
    borderColor: colors.green,
  },
  planName: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  planPrice: {
    color: colors.green,
    fontSize: 14,
    fontWeight: '700',
  },
  planSummary: {
    color: colors.inkSoft,
    fontSize: 13,
    lineHeight: 18,
  },
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
