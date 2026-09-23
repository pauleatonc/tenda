import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { formatDate, formatPrice } from '../lib/format'
import type { SalesOrderCard } from '../lib/sales-api'
import { colors } from './auth-ui'
import { MobileStatusChip } from './app-ui'

export const orderStatusLabels: Record<string, string> = {
  draft: 'Borrador',
  reserved: 'Reservado',
  purchase_in_progress: 'Proceso de compra',
  purchase_validation: 'Validación de compra',
  paid: 'Pagado',
  sold: 'Vendido',
  cancelled: 'Cancelado',
  expired: 'Expirado',
  refunded: 'Reembolsado',
}

export const paymentMethodLabels: Record<string, string> = {
  bank_transfer: 'Transferencia',
  cash: 'Efectivo / presencial',
  mercado_pago: 'Mercado Pago',
}

export const deliveryModeLabels: Record<string, string> = {
  shipping: 'Despacho',
  pickup: 'Retiro / coordinación',
  coordinated: 'Retiro / coordinación',
}

const nextActionLabels: Record<string, string> = {
  share_link: 'Compartir enlace',
  await_buyer: 'Esperar datos del comprador',
  await_payment: 'Esperar pago',
  review_proof: 'Revisar comprobante',
  review_payment_proof: 'Revisar comprobante',
  confirm_manual_payment: 'Registrar pago',
  prepare_delivery: 'Preparar despacho',
  prepare_shipment: 'Preparar despacho',
  reconcile: 'Revisar conciliación',
  none: 'Sin acción pendiente',
}

export function formatClp(value: string | null | undefined): string {
  const price = formatPrice(value)
  return price === '—' ? price : `${price} CLP`
}

function statusTone(status: string): 'success' | 'warning' | 'neutral' {
  if (status === 'paid' || status === 'sold') return 'success'
  if (
    status === 'reserved' ||
    status === 'purchase_in_progress' ||
    status === 'purchase_validation'
  ) {
    return 'warning'
  }
  return 'neutral'
}

export function OrderStatus({ status }: { status: string }) {
  return (
    <MobileStatusChip
      label={orderStatusLabels[status] ?? status}
      tone={statusTone(status)}
    />
  )
}

export function SalesOrderCardView({
  order,
  onPress,
}: {
  order: SalesOrderCard
  onPress: () => void
}) {
  const buyer = order.buyer?.fullName?.trim() || 'Comprador pendiente'
  const nextAction = order.nextAction ?? 'none'
  const pendingAction = nextActionLabels[nextAction] ?? nextAction

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Venta ${order.number}, ${buyer}, ${formatClp(order.total)}`}
      onPress={onPress}
      style={({ pressed }) => [styles.orderCard, pressed && styles.pressed]}
    >
      <View style={styles.orderHead}>
        <View style={styles.orderTitleCopy}>
          <Text style={styles.orderNumber}>Venta {order.number}</Text>
          <Text style={styles.buyer}>{buyer}</Text>
        </View>
        {order.status === 'purchase_validation' ? (
          <MobileStatusChip label="Por revisar" tone="warning" />
        ) : (
          <OrderStatus status={order.status} />
        )}
      </View>
      <View style={styles.orderMeta}>
        <Text style={styles.total}>{formatClp(order.total)}</Text>
        <Text style={styles.meta}>
          {paymentMethodLabels[order.paymentMethod] ?? order.paymentMethod}
        </Text>
        <Text style={styles.meta}>{formatDate(order.createdAt)}</Text>
      </View>
      <View
        style={[
          styles.nextAction,
          order.reconciliationRequired && styles.reconciliationAction,
        ]}
      >
        <Text style={styles.nextActionLabel}>Siguiente acción</Text>
        <Text
          style={[
            styles.nextActionValue,
            order.reconciliationRequired && styles.reconciliationText,
          ]}
        >
          {order.reconciliationRequired ? 'Revisar conciliación' : pendingAction}
        </Text>
      </View>
    </Pressable>
  )
}

export function DetailRow({
  label,
  value,
  children,
}: {
  label: string
  value?: string
  children?: ReactNode
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      {children ?? <Text style={styles.detailValue}>{value || '—'}</Text>}
    </View>
  )
}

export function SalesBanner({
  title,
  description,
  tone = 'warning',
  action,
}: {
  title: string
  description: string
  tone?: 'warning' | 'error' | 'neutral'
  action?: ReactNode
}) {
  return (
    <View
      accessibilityRole={tone === 'error' ? 'alert' : 'summary'}
      style={[
        styles.banner,
        tone === 'error' && styles.bannerError,
        tone === 'neutral' && styles.bannerNeutral,
      ]}
    >
      <View style={styles.bannerCopy}>
        <Text
          style={[
            styles.bannerTitle,
            tone === 'error' && styles.bannerTitleError,
            tone === 'neutral' && styles.bannerTitleNeutral,
          ]}
        >
          {title}
        </Text>
        <Text style={styles.bannerDescription}>{description}</Text>
      </View>
      {action}
    </View>
  )
}

export function SalesMetric({
  label,
  value,
  detail,
  onPress,
}: {
  label: string
  value: string
  detail?: string
  onPress?: () => void
}) {
  const content = (
    <>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      {detail ? <Text style={styles.metricDetail}>{detail}</Text> : null}
    </>
  )
  if (!onPress) return <View style={styles.metric}>{content}</View>
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${label}: ${value}`}
      onPress={onPress}
      style={({ pressed }) => [styles.metric, pressed && styles.pressed]}
    >
      {content}
      <Text style={styles.metricLink}>Ver ventas ›</Text>
    </Pressable>
  )
}

export const salesStyles = StyleSheet.create({
  safeArea: { backgroundColor: colors.paper, flex: 1 },
  header: { gap: 14, paddingHorizontal: 20, paddingTop: 8 },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  headerCopy: { flex: 1, gap: 4 },
  title: { color: colors.ink, fontSize: 30, fontWeight: '800', letterSpacing: -1 },
  muted: { color: colors.inkSoft, fontSize: 14, lineHeight: 20 },
  search: {
    backgroundColor: colors.surface,
    borderColor: '#c9c6bc',
    borderRadius: 12,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  list: { gap: 14, padding: 20, paddingBottom: 40 },
  center: { alignItems: 'center', gap: 10, paddingVertical: 24 },
  content: { gap: 18, padding: 20, paddingBottom: 48 },
  filterHeading: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  footerItem: { flex: 1 },
  actions: { gap: 10 },
})

const styles = StyleSheet.create({
  pressed: { opacity: 0.82 },
  orderCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  orderHead: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  orderTitleCopy: { flex: 1, gap: 4 },
  orderNumber: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  buyer: { color: colors.inkSoft, fontSize: 14 },
  orderMeta: { gap: 4 },
  total: { color: colors.ink, fontSize: 19, fontWeight: '800' },
  meta: { color: colors.inkSoft, fontSize: 13, lineHeight: 19 },
  nextAction: {
    backgroundColor: colors.greenPale,
    borderRadius: 13,
    gap: 3,
    padding: 12,
  },
  reconciliationAction: { backgroundColor: colors.errorPale },
  nextActionLabel: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  nextActionValue: { color: colors.green, fontSize: 14, fontWeight: '800' },
  reconciliationText: { color: colors.error },
  detailRow: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    gap: 5,
    paddingBottom: 12,
  },
  detailLabel: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  detailValue: { color: colors.ink, fontSize: 15, lineHeight: 21 },
  banner: {
    alignItems: 'flex-start',
    backgroundColor: '#f4e5b7',
    borderColor: '#e3ce86',
    borderRadius: 15,
    borderWidth: 1,
    gap: 12,
    padding: 15,
  },
  bannerError: { backgroundColor: colors.errorPale, borderColor: '#edc6bc' },
  bannerNeutral: { backgroundColor: '#eceae3', borderColor: colors.line },
  bannerCopy: { gap: 5 },
  bannerTitle: { color: '#765c17', fontSize: 15, fontWeight: '800' },
  bannerTitleError: { color: colors.error },
  bannerTitleNeutral: { color: colors.ink },
  bannerDescription: { color: colors.inkSoft, fontSize: 13, lineHeight: 19 },
  metric: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 17,
    borderWidth: 1,
    gap: 5,
    minHeight: 120,
    padding: 16,
    width: '100%',
  },
  metricLabel: { color: colors.inkSoft, fontSize: 13, fontWeight: '700' },
  metricValue: { color: colors.ink, fontSize: 25, fontWeight: '800' },
  metricDetail: { color: colors.inkSoft, fontSize: 12, lineHeight: 17 },
  metricLink: { color: colors.green, fontSize: 12, fontWeight: '800', marginTop: 3 },
})
