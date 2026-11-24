import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Redirect, useLocalSearchParams } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native'

import { MobileEmptyState, MobileStatusChip } from '../../../components/app-ui'
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

const statusLabels: Record<string, string> = {
  active: 'Activo',
  pending: 'Pago pendiente',
  past_due: 'Pago atrasado',
  paused: 'Pausado',
  canceled: 'Cancelado',
}

export function PlanSection() {
  const queryClient = useQueryClient()
  const params = useLocalSearchParams<{ checkout?: string }>()
  const checkoutParam = Array.isArray(params.checkout)
    ? params.checkout[0]
    : params.checkout
  const [error, setError] = useState('')
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
    if (autoCheckoutStarted.current || !canManage) return
    if (!checkoutParam || checkoutParam === 'free') return
    autoCheckoutStarted.current = true
    checkout.mutate(checkoutParam)
    // One-shot after signup verification.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage, checkoutParam])

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

  function confirmCancel() {
    if (
      cancel.isPending ||
      !billing.data ||
      billing.data.planCode === 'free' ||
      billing.data.priceClp <= 0
    ) {
      return
    }
    const planName = billing.data.planName
    Alert.alert(
      'Dar de baja el plan',
      `Dejas ${planName} y la tienda pasa al plan Gratis. Se detiene el cobro y el catálogo se conserva.`,
      [
        { text: `Conservar ${planName}`, style: 'cancel' },
        {
          text: 'Dar de baja',
          style: 'destructive',
          onPress: () => cancel.mutate(),
        },
      ],
    )
  }

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
      <MobileEmptyState
        title="Sin permiso"
        description="Solo el owner puede administrar el plan de la tienda."
      />
    )
  }

  const data = billing.data

  return (
    <View style={styles.section}>
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
              label={statusLabels[data.subscriptionStatus] ?? data.subscriptionStatus}
              tone={data.subscriptionStatus === 'active' ? 'success' : 'warning'}
            />
            {data.cancelAtPeriodEnd ? (
              <Text style={styles.muted}>Se cancela al final del período.</Text>
            ) : null}
            {data.planCode !== 'free' && data.priceClp > 0 ? (
              <PrimaryButton
                label={cancel.isPending ? 'Dando de baja…' : 'Dar de baja plan'}
                disabled={cancel.isPending}
                onPress={confirmCancel}
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
                  disabled={checkout.isPending}
                  style={[
                    styles.subscribe,
                    checkout.isPending && styles.subscribeDisabled,
                  ]}
                  onPress={() => checkout.mutate(plan.code)}
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
    </View>
  )
}

export default function PlanRoute() {
  const params = useLocalSearchParams<{ checkout?: string }>()
  const checkout = Array.isArray(params.checkout) ? params.checkout[0] : params.checkout
  return (
    <Redirect
      href={{
        pathname: '/mas',
        params: checkout ? { seccion: 'plan', checkout } : { seccion: 'plan' },
      }}
    />
  )
}

const styles = StyleSheet.create({
  section: { gap: 12 },
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
