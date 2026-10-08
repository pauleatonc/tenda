import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocalSearchParams } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'

import { AppScreen, MobileEmptyState, MobileStatusChip } from '../../../components/app-ui'
import { PrimaryButton, StatusMessage, colors } from '../../../components/auth-ui'
import { SectionCard } from '../../../components/inventory-ui'
import { MobileApiError, getMobileViewer } from '../../../lib/auth-api'
import {
  billingKeys,
  cancelSubscription,
  fetchOrganisationBilling,
  formatPlanPrice,
  formatProductLimit,
  resumeSubscription,
  startPlanCheckout,
} from '../../../lib/billing-api'

const WEB_ORIGIN = process.env.EXPO_PUBLIC_WEB_ORIGIN ?? 'http://localhost:5173'

export default function PlanScreen() {
  const queryClient = useQueryClient()
  const params = useLocalSearchParams<{ checkout?: string }>()
  const checkoutParam = Array.isArray(params.checkout)
    ? params.checkout[0]
    : params.checkout
  const [error, setError] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const autoCheckoutStarted = useRef(false)
  const viewer = useQuery({
    queryKey: ['mobile-viewer'],
    queryFn: getMobileViewer,
    retry: false,
  })
  const canManage =
    viewer.data?.membership.role === 'owner' &&
    viewer.data.membership.permissions.manageSensitiveConfiguration

  const billing = useQuery({
    queryKey: billingKeys.organisation(),
    queryFn: fetchOrganisationBilling,
    enabled: Boolean(canManage),
  })

  const checkout = useMutation({
    mutationFn: (planCode: string) =>
      startPlanCheckout({
        planCode,
        payerEmail: viewer.data?.viewer.email,
        acceptedTerms: true,
      }),
    onSuccess: async (result) => {
      setError('')
      await Linking.openURL(result.initPoint)
    },
    onError: (err: unknown) => {
      setError(
        err instanceof MobileApiError ? err.message : 'No pudimos iniciar el pago.',
      )
    },
  })

  useEffect(() => {
    if (autoCheckoutStarted.current || !canManage || !acceptedTerms) return
    if (!checkoutParam || checkoutParam === 'free') return
    autoCheckoutStarted.current = true
    checkout.mutate(checkoutParam)
    // One-shot after signup verification.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage, checkoutParam, acceptedTerms])

  const cancel = useMutation({
    mutationFn: cancelSubscription,
    onSuccess: (data) => {
      setError('')
      queryClient.setQueryData(billingKeys.organisation(), data)
    },
    onError: (err: unknown) => {
      setError(err instanceof MobileApiError ? err.message : 'No pudimos cancelar.')
    },
  })

  const resume = useMutation({
    mutationFn: resumeSubscription,
    onSuccess: (data) => {
      setError('')
      queryClient.setQueryData(billingKeys.organisation(), data)
    },
    onError: (err: unknown) => {
      setError(err instanceof MobileApiError ? err.message : 'No pudimos reactivar.')
    },
  })

  if (!canManage) {
    return (
      <AppScreen title="Plan" eyebrow="Suscripción Tenda">
        <MobileEmptyState
          title="Sin permiso"
          description="Solo el owner puede administrar el plan de la tienda."
        />
      </AppScreen>
    )
  }

  const data = billing.data

  return (
    <AppScreen title="Plan" eyebrow="Suscripción Tenda">
      {error ? <StatusMessage message={error} /> : null}
      {billing.isLoading || !data ? (
        <Text style={styles.muted}>Cargando plan…</Text>
      ) : (
        <>
          <SectionCard title={data.planName}>
            <Text style={styles.line}>
              {formatPlanPrice(data.priceClp)} / mes ·{' '}
              {formatProductLimit(data.productLimit)}
            </Text>
            <Text style={styles.line}>
              Usas {data.productCount}
              {data.productLimit != null ? ` de ${data.productLimit}` : ''} productos.
            </Text>
            <MobileStatusChip
              label={data.subscriptionStatus}
              tone={data.subscriptionStatus === 'active' ? 'success' : 'warning'}
            />
            {data.cancelAtPeriodEnd ? (
              <Text style={styles.muted}>Se cancela al final del período.</Text>
            ) : null}
            {data.planCode !== 'free' && !data.cancelAtPeriodEnd ? (
              <PrimaryButton
                label={cancel.isPending ? 'Cancelando…' : 'Cancelar al final del período'}
                disabled={cancel.isPending}
                onPress={() => cancel.mutate()}
              />
            ) : null}
            {(data.subscriptionStatus === 'paused' || data.cancelAtPeriodEnd) &&
            data.planCode !== 'free' ? (
              <PrimaryButton
                label={resume.isPending ? 'Reactivando…' : 'Reactivar'}
                disabled={resume.isPending}
                onPress={() => resume.mutate()}
              />
            ) : null}
          </SectionCard>

          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: acceptedTerms }}
            onPress={() => setAcceptedTerms((current) => !current)}
            style={styles.termsRow}
          >
            <View style={[styles.termsMark, acceptedTerms && styles.termsMarkChecked]}>
              <Text style={styles.termsCheck}>{acceptedTerms ? '✓' : ''}</Text>
            </View>
            <Text style={styles.termsLabel}>
              Acepto los{' '}
              <Text
                style={styles.termsLink}
                onPress={() => Linking.openURL(`${WEB_ORIGIN}/terminos`)}
              >
                términos y condiciones
              </Text>
              .
            </Text>
          </Pressable>

          {data.plans.map((plan) => (
            <SectionCard key={plan.code} title={plan.name}>
              <Text style={styles.line}>{formatPlanPrice(plan.priceClp)}</Text>
              <Text style={styles.line}>{formatProductLimit(plan.productLimit)}</Text>
              <Text style={styles.muted}>
                {plan.aiAssistedEnabled
                  ? 'Incluye creación asistida'
                  : 'Solo creación manual'}
              </Text>
              {plan.isCurrent ? (
                <MobileStatusChip label="Actual" tone="success" />
              ) : plan.code === 'free' ? null : (
                <Pressable
                  accessibilityRole="button"
                  disabled={checkout.isPending || !acceptedTerms}
                  style={[
                    styles.subscribe,
                    (!acceptedTerms || checkout.isPending) && styles.subscribeDisabled,
                  ]}
                  onPress={() => {
                    if (!acceptedTerms) {
                      setError('Debes aceptar los términos y condiciones.')
                      return
                    }
                    checkout.mutate(plan.code)
                  }}
                >
                  <Text style={styles.subscribeText}>
                    {checkout.isPending && checkout.variables === plan.code
                      ? 'Abriendo Mercado Pago…'
                      : 'Suscribirse'}
                  </Text>
                </Pressable>
              )}
            </SectionCard>
          ))}
        </>
      )}
    </AppScreen>
  )
}

const styles = StyleSheet.create({
  line: {
    color: colors.ink,
    fontSize: 15,
    marginBottom: 6,
  },
  muted: {
    color: colors.inkSoft,
    fontSize: 14,
    marginBottom: 8,
  },
  termsRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  termsMark: {
    alignItems: 'center',
    borderColor: colors.inkSoft,
    borderRadius: 6,
    borderWidth: 1.5,
    height: 22,
    justifyContent: 'center',
    marginTop: 2,
    width: 22,
  },
  termsMarkChecked: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  termsCheck: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  termsLabel: {
    color: colors.inkSoft,
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  termsLink: {
    color: colors.ink,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  subscribe: {
    backgroundColor: colors.ink,
    borderRadius: 14,
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  subscribeDisabled: {
    opacity: 0.45,
  },
  subscribeText: {
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
  },
})
