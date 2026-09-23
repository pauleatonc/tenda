import { useQuery } from '@tanstack/react-query'
import { Link, router } from 'expo-router'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'

import { AppScreen, MobileStatusChip } from '../../../components/app-ui'
import { PrimaryButton, colors } from '../../../components/auth-ui'
import { SectionCard } from '../../../components/inventory-ui'
import { formatClp } from '../../../components/sales-ui'
import { MobileApiError, getMobileViewer } from '../../../lib/auth-api'
import {
  formatDate,
  formatQuantity,
  formatSignedQuantity,
  movementLabels,
} from '../../../lib/format'
import { fetchDashboard, inventoryKeys } from '../../../lib/inventory-api'
import { fetchSalesDashboard, salesKeys } from '../../../lib/sales-api'
import { fetchShippingDashboard, shippingKeys } from '../../../lib/shipping-api'

function InventorySummary() {
  const dashboard = useQuery({
    queryKey: inventoryKeys.dashboard(),
    queryFn: fetchDashboard,
  })

  if (dashboard.isPending) {
    return (
      <SectionCard title="Inventario">
        <Text accessibilityLiveRegion="polite" style={styles.muted}>
          Cargando resumen…
        </Text>
      </SectionCard>
    )
  }

  if (dashboard.isError) {
    return (
      <SectionCard title="Inventario">
        <Text style={styles.muted}>
          {dashboard.error instanceof MobileApiError
            ? dashboard.error.message
            : 'No pudimos cargar el resumen de inventario.'}
        </Text>
        <PrimaryButton
          label="Reintentar"
          variant="secondary"
          onPress={() => void dashboard.refetch()}
        />
      </SectionCard>
    )
  }

  const data = dashboard.data
  const metrics = [
    { label: 'Productos', value: data.productCount },
    { label: 'Disponible', value: data.available },
    { label: 'Reservado', value: data.reserved },
    { label: 'Sin unidades', value: data.outOfStockCount },
    { label: 'Stock bajo', value: data.lowStockCount },
  ]

  return (
    <SectionCard title="Inventario">
      <View style={styles.metrics}>
        {metrics.map((metric) => (
          <View key={metric.label} style={styles.metric}>
            <Text style={styles.cardLabel}>{metric.label}</Text>
            <Text style={styles.metricValue}>{formatQuantity(metric.value)}</Text>
          </View>
        ))}
      </View>

      {data.alerts.length ? (
        <View style={styles.movements}>
          <Text style={styles.cardLabel}>Requiere atención</Text>
          {data.alerts.slice(0, 4).map((alert) => (
            <Link
              key={alert.id}
              accessibilityRole="link"
              href={`/inventario/${alert.productId}`}
              style={styles.alertRow}
            >
              <Text style={styles.movementName}>{alert.productName}</Text>
              <Text style={styles.muted}>
                {alert.alertType === 'out_of_stock'
                  ? 'Sin unidades disponibles'
                  : `${formatQuantity(alert.availableQuantity)} disponibles · umbral ${formatQuantity(alert.threshold)}`}
              </Text>
            </Link>
          ))}
        </View>
      ) : null}

      {data.recentMovements.length ? (
        <View style={styles.movements}>
          <Text style={styles.cardLabel}>Actividad reciente</Text>
          {data.recentMovements.slice(0, 4).map((movement) => (
            <Link
              key={movement.id}
              accessibilityRole="link"
              href={`/inventario/${movement.productId}`}
              style={styles.movementRow}
            >
              <Text style={styles.movementName}>{movement.productName}</Text>
              <Text style={styles.muted}>
                {movementLabels[movement.movementType] ?? movement.movementType} ·{' '}
                {formatSignedQuantity(movement.quantity)} · {formatDate(movement.createdAt)}
              </Text>
            </Link>
          ))}
        </View>
      ) : null}

      <PrimaryButton label="Ir a inventario" onPress={() => router.push('/inventario')} />
    </SectionCard>
  )
}

function SalesSummary() {
  const summary = useQuery({
    queryKey: salesKeys.dashboard(),
    queryFn: fetchSalesDashboard,
  })

  if (summary.isPending) {
    return (
      <SectionCard title="Ventas">
        <Text accessibilityLiveRegion="polite" style={styles.muted}>
          Cargando resumen…
        </Text>
      </SectionCard>
    )
  }

  if (summary.isError) {
    return (
      <SectionCard title="Ventas">
        <Text style={styles.muted}>
          {summary.error instanceof MobileApiError
            ? summary.error.message
            : 'No pudimos cargar el resumen de ventas.'}
        </Text>
        <PrimaryButton
          label="Reintentar"
          variant="secondary"
          onPress={() => void summary.refetch()}
        />
      </SectionCard>
    )
  }

  const data = summary.data
  const pending =
    data.awaitingBuyerCount +
    data.awaitingPaymentCount +
    data.awaitingValidationCount +
    data.reconciliationRequiredCount
  const metrics = [
    { label: 'Esperando pago', value: String(data.awaitingPaymentCount) },
    { label: 'Por validar', value: String(data.awaitingValidationCount) },
    { label: 'Conciliación', value: String(data.reconciliationRequiredCount) },
    { label: 'Mes confirmado', value: formatClp(data.confirmedThisMonthAmount) },
  ]

  return (
    <SectionCard title="Ventas">
      <MobileStatusChip
        label={pending ? `${pending} acciones pendientes` : 'Ventas al día'}
        tone={pending ? 'warning' : 'success'}
      />
      <View style={styles.metrics}>
        {metrics.map((metric) => (
          <View key={metric.label} style={styles.metric}>
            <Text style={styles.cardLabel}>{metric.label}</Text>
            <Text style={styles.metricValue}>{metric.value}</Text>
          </View>
        ))}
      </View>
      <PrimaryButton label="Ir a ventas" onPress={() => router.push('/ventas')} />
    </SectionCard>
  )
}

function ShippingSummary() {
  const summary = useQuery({
    queryKey: shippingKeys.dashboard(),
    queryFn: fetchShippingDashboard,
  })

  if (summary.isPending) {
    return (
      <SectionCard title="Despachos">
        <Text accessibilityLiveRegion="polite" style={styles.muted}>
          Cargando resumen…
        </Text>
      </SectionCard>
    )
  }

  if (summary.isError) {
    return (
      <SectionCard title="Despachos">
        <Text style={styles.muted}>
          {summary.error instanceof MobileApiError
            ? summary.error.message
            : 'No pudimos cargar el resumen de despachos.'}
        </Text>
        <PrimaryButton
          label="Reintentar"
          variant="secondary"
          onPress={() => void summary.refetch()}
        />
      </SectionCard>
    )
  }

  const data = summary.data
  const pending = data.pendingCount
  const metrics = [
    { label: 'Pendientes', value: data.pendingCount },
    { label: 'Despachados', value: data.dispatchedCount },
    { label: 'Entregados', value: data.deliveredCount },
  ]

  return (
    <SectionCard title="Despachos">
      <MobileStatusChip
        label={
          pending
            ? `${pending} ${pending === 1 ? 'envío por registrar' : 'envíos por registrar'}`
            : 'Despachos al día'
        }
        tone={pending ? 'warning' : 'success'}
      />
      <View style={styles.metrics}>
        {metrics.map((metric) => (
          <View key={metric.label} style={styles.metric}>
            <Text style={styles.cardLabel}>{metric.label}</Text>
            <Text style={styles.metricValue}>{formatQuantity(metric.value)}</Text>
          </View>
        ))}
      </View>
      <PrimaryButton label="Ir a despachos" onPress={() => router.push('/despachos')} />
    </SectionCard>
  )
}

export default function DashboardScreen() {
  const viewer = useQuery({
    queryKey: ['mobile-viewer'],
    queryFn: getMobileViewer,
    retry: false,
  })

  if (viewer.isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.green} size="large" />
        <Text style={styles.muted}>Preparando tu espacio…</Text>
      </View>
    )
  }
  if (viewer.isError) {
    const needsLogin =
      viewer.error instanceof MobileApiError &&
      viewer.error.code === 'AUTHENTICATION_REQUIRED'
    return (
      <View style={styles.center}>
        <Text accessibilityRole="header" style={styles.errorTitle}>
          {needsLogin ? 'Tu sesión terminó' : 'No pudimos cargar Tenda'}
        </Text>
        <Text style={styles.muted}>{viewer.error.message}</Text>
        <Pressable
          accessibilityRole="button"
          style={styles.button}
          onPress={() =>
            needsLogin ? router.replace('/(auth)/login') : void viewer.refetch()
          }
        >
          <Text style={styles.buttonText}>
            {needsLogin ? 'Iniciar sesión' : 'Reintentar'}
          </Text>
        </Pressable>
      </View>
    )
  }

  const data = viewer.data
  return (
    <AppScreen
      eyebrow={data.inventory.name}
      title={`Hola, ${data.viewer.profile.fullName || data.viewer.email}`}
    >
      {!data.viewer.emailVerified ? (
        <View style={styles.attention}>
          <MobileStatusChip label="Requiere atención" tone="warning" />
          <Text style={styles.cardTitle}>Verifica tu correo electrónico</Text>
          <Text style={styles.muted}>
            Confirma tu email para proteger la cuenta y recuperar el acceso.
          </Text>
        </View>
      ) : null}

      <InventorySummary />
      <SalesSummary />
      <ShippingSummary />
    </AppScreen>
  )
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    flex: 1,
    gap: 16,
    justifyContent: 'center',
    padding: 24,
  },
  muted: { color: colors.inkSoft, lineHeight: 21, textAlign: 'center' },
  errorTitle: { color: colors.ink, fontSize: 24, fontWeight: '800', textAlign: 'center' },
  button: {
    backgroundColor: colors.green,
    borderRadius: 12,
    minHeight: 48,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '800' },
  attention: {
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    padding: 20,
  },
  cardTitle: { color: colors.ink, fontSize: 20, fontWeight: '800' },
  cardLabel: { color: colors.inkMuted, fontSize: 12 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  metric: { gap: 3, minWidth: '44%' },
  metricValue: { color: colors.ink, fontSize: 22, fontWeight: '800' },
  movements: { borderTopColor: colors.line, borderTopWidth: 1, gap: 10, paddingTop: 12 },
  movementRow: { gap: 2, minHeight: 44 },
  alertRow: {
    backgroundColor: '#fff4d6',
    borderRadius: 10,
    gap: 2,
    minHeight: 48,
    padding: 10,
  },
  movementName: { color: colors.ink, fontSize: 15, fontWeight: '700' },
})
