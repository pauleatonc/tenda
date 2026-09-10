import { Pressable, StyleSheet, Text, View } from 'react-native'

import { formatDate } from '../lib/format'
import type { ShipmentCard } from '../lib/shipping-api'
import { MobileStatusChip } from './app-ui'
import { colors } from './auth-ui'

export const shipmentStatusLabels: Record<string, string> = {
  pending: 'Pendiente',
  preparing: 'En preparación',
  dispatched: 'Despachado',
  delivery_check: 'Chequeo de entrega',
  delivered: 'Entregado',
  issue: 'Incidencia',
  returned: 'Devuelto',
  cancelled: 'Cancelado',
  closed: 'Cerrado',
}

export const deliveryModeLabels: Record<string, string> = {
  shipping: 'Despacho',
  pickup: 'Retiro',
  coordinated: 'Entrega coordinada',
}

export const nextActionLabels: Record<string, string> = {
  prepare: 'Preparar envío',
  dispatch: 'Marcar despachado',
  check_delivery: 'Chequear entrega',
  confirm_delivery: 'Confirmar entrega',
  review_issue: 'Revisar incidencia',
  reply_ticket: 'Responder consulta',
  close: 'Cerrar envío',
  none: 'Sin acción pendiente',
}

export const ticketStatusLabels: Record<string, string> = {
  open: 'Abierta',
  awaiting_seller: 'Espera tu respuesta',
  awaiting_buyer: 'Espera al comprador',
  resolved: 'Resuelta',
  closed: 'Cerrada',
}

export const followUpKindLabels: Record<string, string> = {
  delivery_check: 'Chequeo de entrega',
  reminder: 'Recordatorio',
  autoclose: 'Autocierre',
}

export const returnCaseKindLabels: Record<string, string> = {
  lost: 'Pérdida',
  rejected: 'Rechazo',
  returned: 'Devolución',
  other: 'Otro',
}

function statusTone(status: string): 'success' | 'warning' | 'neutral' {
  if (status === 'dispatched' || status === 'delivered' || status === 'closed') {
    return 'success'
  }
  if (status === 'cancelled' || status === 'returned' || status === 'issue') {
    return 'neutral'
  }
  return 'warning'
}

export function destinationLine(shipment: {
  addressLine?: string
  commune: string
  region: string
}): string {
  return [shipment.addressLine, shipment.commune, shipment.region]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(', ')
}

export function ShipmentStatus({ status }: { status: string }) {
  return (
    <MobileStatusChip
      label={shipmentStatusLabels[status] ?? status}
      tone={statusTone(status)}
    />
  )
}

export function ShipmentCardView({
  shipment,
  onPress,
}: {
  shipment: ShipmentCard
  onPress: () => void
}) {
  const recipient = shipment.recipientName.trim() || 'Sin destinatario'
  const nextAction = nextActionLabels[shipment.nextAction] ?? shipment.nextAction
  const place = destinationLine(shipment)

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Envío ${shipment.number}, ${recipient}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.head}>
        <View style={styles.titleCopy}>
          <Text style={styles.number}>Envío {shipment.number}</Text>
          <Text style={styles.recipient}>{recipient}</Text>
        </View>
        <ShipmentStatus status={shipment.status} />
      </View>
      <View style={styles.meta}>
        <Text style={styles.place}>
          {place || deliveryModeLabels[shipment.deliveryMode]}
        </Text>
        <Text style={styles.metaText}>
          {shipment.trackingCode ? `Tracking ${shipment.trackingCode}` : 'Sin tracking'}
        </Text>
        <Text style={styles.metaText}>
          {shipment.nextFollowUp
            ? `Vence ${formatDate(shipment.nextFollowUp.dueAt)}`
            : formatDate(shipment.createdAt)}
        </Text>
      </View>
      <View style={styles.nextAction}>
        <Text style={styles.nextActionLabel}>Siguiente acción</Text>
        <Text style={styles.nextActionValue}>{nextAction}</Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.82 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  head: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  titleCopy: { flex: 1, gap: 4 },
  number: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  recipient: { color: colors.inkSoft, fontSize: 14 },
  meta: { gap: 4 },
  place: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  metaText: { color: colors.inkSoft, fontSize: 13, lineHeight: 19 },
  nextAction: {
    backgroundColor: colors.greenPale,
    borderRadius: 13,
    gap: 3,
    padding: 12,
  },
  nextActionLabel: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  nextActionValue: { color: colors.green, fontSize: 14, fontWeight: '800' },
})
