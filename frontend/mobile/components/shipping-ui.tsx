import { Pressable, StyleSheet, Text, View } from 'react-native'

import { formatDate } from '../lib/format'
import type { ShipmentCard } from '../lib/shipping-api'
import { MobileStatusChip } from './app-ui'
import { colors } from './auth-ui'

export const shipmentStatuses = ['pending', 'dispatched', 'delivered'] as const

export const shipmentStatusLabels: Record<string, string> = {
  pending: 'Pendiente',
  dispatched: 'Despachado',
  delivered: 'Entregado',
}

export const deliveryModes = ['shipping', 'pickup', 'coordinated'] as const

export const deliveryModeLabels: Record<string, string> = {
  shipping: 'Despacho',
  pickup: 'Retiro',
  coordinated: 'Entrega coordinada',
}

function statusTone(status: string): 'success' | 'warning' {
  return status === 'pending' ? 'warning' : 'success'
}

export function requiresCarrier(deliveryMode: string): boolean {
  return deliveryMode === 'shipping'
}

export function registrationLabel(deliveryMode: string): string {
  return requiresCarrier(deliveryMode) ? 'Registrar despacho' : 'Registrar entrega'
}

export function registeredAt(shipment: {
  status: string
  dispatchedAt: string | null
  deliveredAt: string | null
}): string | null {
  if (shipment.status === 'dispatched') return shipment.dispatchedAt
  if (shipment.status === 'delivered') return shipment.deliveredAt
  return null
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

function carrierLine(shipment: ShipmentCard): string {
  if (!requiresCarrier(shipment.deliveryMode)) {
    return deliveryModeLabels[shipment.deliveryMode] ?? shipment.deliveryMode
  }
  const parts = [shipment.carrier, shipment.trackingCode].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'Sin transportista aún'
}

export function ShipmentCardView({
  shipment,
  onPress,
}: {
  shipment: ShipmentCard
  onPress: () => void
}) {
  const recipient = shipment.recipientName.trim() || 'Sin destinatario'
  const place = destinationLine(shipment)
  const pending = shipment.status === 'pending'
  const when = registeredAt(shipment) ?? shipment.createdAt

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
        <Text style={styles.metaText}>{carrierLine(shipment)}</Text>
        <Text style={styles.metaText}>
          {pending ? `Creado ${formatDate(when)}` : formatDate(when)}
        </Text>
      </View>
      {pending ? (
        <View style={styles.nextAction}>
          <Text style={styles.nextActionLabel}>Pendiente</Text>
          <Text style={styles.nextActionValue}>
            {registrationLabel(shipment.deliveryMode)}
          </Text>
        </View>
      ) : null}
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
