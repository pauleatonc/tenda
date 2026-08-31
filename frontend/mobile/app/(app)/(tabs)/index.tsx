import { useQuery } from '@tanstack/react-query'
import { Link, router } from 'expo-router'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'

import { AppScreen, MobileStatusChip } from '../../../components/app-ui'
import { PrimaryButton, colors } from '../../../components/auth-ui'
import { SectionCard } from '../../../components/inventory-ui'
import { MobileApiError, getMobileViewer } from '../../../lib/auth-api'
import {
  formatDate,
  formatQuantity,
  formatSignedQuantity,
  movementLabels,
} from '../../../lib/format'
import { fetchDashboard, inventoryKeys } from '../../../lib/inventory-api'

/** V1-INV-01 on the phone: the numbers that decide the next action, nothing else. */
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
  if (!data.productCount) {
    return (
      <SectionCard title="Inventario">
        <Text style={styles.muted}>
          Agrega tu primer producto para ver disponibilidad, reservas y movimientos.
        </Text>
        <PrimaryButton
          label="Agregar producto"
          onPress={() => router.push('/inventario/producto')}
        />
      </SectionCard>
    )
  }

  const metrics = [
    { label: 'Productos', value: data.productCount },
    { label: 'Disponible', value: data.available },
    { label: 'Reservado', value: data.reserved },
    { label: 'Sin unidades', value: data.outOfStockCount },
    { label: 'Stock bajo', value: data.lowStockCount },
  ]

  return (
    <SectionCard
      title="Inventario"
      action={
        <Link accessibilityRole="link" href="/inventario" style={styles.link}>
          Ver todo
        </Link>
      }
    >
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
                {formatSignedQuantity(movement.quantity)} ·{' '}
                {formatDate(movement.createdAt)}
              </Text>
            </Link>
          ))}
        </View>
      ) : null}

      <PrimaryButton
        label="Agregar producto"
        onPress={() => router.push('/inventario/producto')}
      />
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
      <View style={styles.attention}>
        <MobileStatusChip
          label={data.viewer.emailVerified ? 'Cuenta protegida' : 'Requiere atención'}
          tone={data.viewer.emailVerified ? 'success' : 'warning'}
        />
        <Text style={styles.cardTitle}>
          {data.viewer.emailVerified
            ? 'Todo listo para comenzar'
            : 'Verifica tu correo electrónico'}
        </Text>
        <Text style={styles.muted}>
          {data.viewer.emailVerified
            ? 'Revisa tu inventario y registra la próxima operación.'
            : 'Confirma tu email para proteger la cuenta y recuperar el acceso.'}
        </Text>
      </View>

      <InventorySummary />

      <View style={styles.contextRow}>
        <View style={styles.contextCard}>
          <Text style={styles.cardLabel}>Tienda</Text>
          <Text style={styles.contextValue}>{data.organisation.name}</Text>
        </View>
        <View style={styles.contextCard}>
          <Text style={styles.cardLabel}>Rol</Text>
          <Text style={styles.contextValue}>{data.membership.role}</Text>
        </View>
      </View>
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
  contextRow: { flexDirection: 'row', gap: 12 },
  contextCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    gap: 8,
    minHeight: 108,
    padding: 17,
  },
  cardLabel: { color: colors.inkMuted, fontSize: 12 },
  contextValue: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  link: { color: colors.green, fontSize: 14, fontWeight: '800' },
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
