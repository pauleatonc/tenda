import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { useRef, useState } from 'react'
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { MobileEmptyState } from '../../../components/app-ui'
import { PrimaryButton, StatusMessage, colors } from '../../../components/auth-ui'
import { SectionCard, Sheet, SheetField } from '../../../components/inventory-ui'
import {
  DetailRow,
  OrderStatus,
  SalesBanner,
  deliveryModeLabels,
  formatClp,
  paymentMethodLabels,
  salesStyles,
} from '../../../components/sales-ui'
import { MobileApiError } from '../../../lib/auth-api'
import { formatDate } from '../../../lib/format'
import { newIdempotencyKey } from '../../../lib/graphql'
import {
  cancelOrder,
  confirmManualPayment,
  fetchOrder,
  refundPayment,
  resendOrderLink,
  reviewPaymentProof,
  salesKeys,
  type SellerOrder,
} from '../../../lib/sales-api'

type ActionKind = 'approve' | 'reject' | 'manual' | 'cancel' | 'refund' | 'resend'

const ACTION_TITLES: Record<ActionKind, string> = {
  approve: 'Aprobar comprobante',
  reject: 'Rechazar comprobante',
  manual: 'Registrar pago manual',
  cancel: 'Cancelar venta',
  refund: 'Reembolsar pago',
  resend: 'Reenviar enlace',
}

const ACTION_CONFIRM_LABELS: Record<ActionKind, string> = {
  approve: 'Aprobar y descontar stock',
  reject: 'Rechazar comprobante',
  manual: 'Confirmar pago',
  cancel: 'Cancelar venta',
  refund: 'Iniciar reembolso total',
  resend: 'Reenviar enlace',
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function SaleDetailScreen() {
  const params = useLocalSearchParams<{ orderId?: string }>()
  const orderId = typeof params.orderId === 'string' ? params.orderId : ''
  const queryClient = useQueryClient()
  const [action, setAction] = useState<ActionKind | null>(null)
  const [reason, setReason] = useState('')
  const [amount, setAmount] = useState('')
  const [paidDate, setPaidDate] = useState(today)
  const [note, setNote] = useState('')
  const [actionError, setActionError] = useState('')
  const [success, setSuccess] = useState('')
  const [actionKey, setActionKey] = useState(newIdempotencyKey)
  const actionLock = useRef(false)

  const order = useQuery({
    queryKey: salesKeys.order(orderId),
    queryFn: () => fetchOrder(orderId),
    enabled: Boolean(orderId),
  })

  const executeAction = useMutation({
    mutationFn: async (kind: ActionKind) => {
      if (kind === 'approve') {
        return reviewPaymentProof({
          orderId,
          decision: 'approve',
          reason: null,
          idempotencyKey: actionKey,
        })
      }
      if (kind === 'reject') {
        return reviewPaymentProof({
          orderId,
          decision: 'reject',
          reason: reason.trim(),
          idempotencyKey: actionKey,
        })
      }
      if (kind === 'manual') {
        return confirmManualPayment({
          orderId,
          amount,
          paidAt: `${paidDate}T12:00:00.000Z`,
          note: note.trim() || null,
          idempotencyKey: actionKey,
        })
      }
      if (kind === 'cancel') {
        return cancelOrder({
          orderId,
          reason: reason.trim(),
          idempotencyKey: actionKey,
        })
      }
      if (kind === 'refund') {
        return refundPayment({
          orderId,
          reason: reason.trim(),
          idempotencyKey: actionKey,
        })
      }
      return resendOrderLink({ orderId, idempotencyKey: actionKey })
    },
    onSuccess: (_result, kind) => {
      setSuccess(
        kind === 'resend'
          ? 'El enlace fue reenviado por la operación solicitada.'
          : 'La venta se actualizó correctamente.',
      )
      closeAction()
      void queryClient.invalidateQueries({ queryKey: salesKeys.root })
    },
    onError: (error: unknown) => {
      setActionError(
        error instanceof MobileApiError
          ? error.message
          : 'No pudimos completar la acción. Inténtalo otra vez.',
      )
    },
    onSettled: () => {
      actionLock.current = false
    },
  })

  function openAction(kind: ActionKind) {
    const current = order.data
    setAction(kind)
    setReason('')
    setNote('')
    setAmount(current?.payment?.amount ?? current?.total ?? '')
    setPaidDate(today())
    setActionError('')
    setSuccess('')
    setActionKey(newIdempotencyKey())
  }

  function closeAction() {
    setAction(null)
    setActionError('')
  }

  function confirmAction() {
    if (!action || executeAction.isPending || actionLock.current) return
    if (action === 'reject' && !reason.trim()) {
      setActionError('Escribe el motivo del rechazo.')
      return
    }
    if (action === 'refund' && !reason.trim()) {
      setActionError('Escribe el motivo del reembolso.')
      return
    }
    if (action === 'manual') {
      const numericAmount = Number(amount)
      if (!Number.isInteger(numericAmount) || numericAmount <= 0) {
        setActionError('Ingresa un monto CLP entero mayor que cero.')
        return
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(paidDate)) {
        setActionError('Usa una fecha con formato AAAA-MM-DD.')
        return
      }
    }
    actionLock.current = true
    setActionError('')
    executeAction.mutate(action)
  }

  if (order.isPending) {
    return (
      <SafeAreaView style={salesStyles.safeArea}>
        <Text accessibilityLiveRegion="polite" style={styles.loading}>
          Cargando venta…
        </Text>
      </SafeAreaView>
    )
  }

  if (order.isError) {
    return (
      <SafeAreaView style={salesStyles.safeArea}>
        <View style={styles.state}>
          <MobileEmptyState
            title="No pudimos cargar la venta"
            description={
              order.error instanceof MobileApiError
                ? order.error.message
                : 'Revisa tu conexión e inténtalo otra vez.'
            }
            action={
              <PrimaryButton label="Reintentar" onPress={() => void order.refetch()} />
            }
          />
        </View>
      </SafeAreaView>
    )
  }

  const data = order.data
  if (!data) {
    return (
      <SafeAreaView style={salesStyles.safeArea}>
        <View style={styles.state}>
          <MobileEmptyState
            title="Venta no encontrada"
            description="No existe o pertenece a otra Tienda."
            action={<PrimaryButton label="Volver" onPress={() => router.back()} />}
          />
        </View>
      </SafeAreaView>
    )
  }

  const buyer = data.buyer
  const payment = data.payment
  const proof = payment?.proof
  const allowed = data.allowedActions

  return (
    <SafeAreaView style={salesStyles.safeArea}>
      <ScrollView contentContainerStyle={salesStyles.content}>
        <View style={styles.heading}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={styles.back}>‹ Ventas</Text>
          </Pressable>
          <View style={styles.headingRow}>
            <View style={styles.headingCopy}>
              <Text style={styles.eyebrow}>Detalle de venta</Text>
              <Text accessibilityRole="header" style={styles.title}>
                Venta {data.number}
              </Text>
            </View>
            <OrderStatus status={data.status} />
          </View>
          <Text style={styles.total}>{formatClp(data.total)}</Text>
          <Text style={salesStyles.muted}>
            Creada {formatDate(data.createdAt)} · Actualizada {formatDate(data.updatedAt)}
          </Text>
        </View>

        {success ? <StatusMessage kind="success" message={success} /> : null}
        {data.reconciliationRequired ? (
          <SalesBanner
            tone="error"
            title="Conciliación requerida"
            description={
              data.reconciliationMessage ||
              'El pago o el movimiento de stock necesita revisión antes de considerarse resuelto.'
            }
          />
        ) : null}

        <SectionCard title="Productos">
          {data.lines.map((line: SellerOrder['lines'][number]) => (
            <View key={line.id} style={styles.line}>
              {line.productImageUrl ? (
                <Image
                  accessibilityLabel={`Imagen de ${line.productName}`}
                  source={{ uri: line.productImageUrl }}
                  style={styles.productImage}
                />
              ) : null}
              <View style={styles.lineCopy}>
                <Text style={styles.lineTitle}>{line.productName}</Text>
                <Text style={salesStyles.muted}>
                  {line.quantity} × {formatClp(line.unitSalePrice)}
                </Text>
                {data.costsVisible ? (
                  <Text style={styles.cost}>
                    Costo snapshot:{' '}
                    {line.unitCostSnapshot === null
                      ? 'Sin costo registrado'
                      : formatClp(line.unitCostSnapshot)}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.lineTotal}>{formatClp(line.lineTotal)}</Text>
            </View>
          ))}
          <DetailRow label="Subtotal" value={formatClp(data.subtotal)} />
          <DetailRow label="Comisión" value={formatClp(data.feeAmount)} />
          <DetailRow label="Total" value={formatClp(data.total)} />
        </SectionCard>

        <SectionCard title="Comprador y entrega">
          <DetailRow label="Comprador" value={buyer?.fullName ?? 'Pendiente'} />
          <DetailRow label="Email" value={buyer?.email ?? ''} />
          <DetailRow label="Teléfono" value={buyer?.phone ?? ''} />
          <DetailRow
            label="Entrega"
            value={deliveryModeLabels[data.deliveryMode] ?? data.deliveryMode}
          />
          {data.deliveryMode === 'shipping' ? (
            <>
              <DetailRow label="Destinatario" value={buyer?.recipientName ?? ''} />
              <DetailRow
                label="Dirección"
                value={[
                  buyer?.deliveryAddress,
                  buyer?.deliveryCommune,
                  buyer?.deliveryCity,
                ]
                  .filter(Boolean)
                  .join(', ')}
              />
            </>
          ) : null}
          {buyer?.taxId ? (
            <>
              <DetailRow label="RUT facturación" value={buyer.taxId} />
              <DetailRow label="Nombre / razón social" value={buyer.taxName ?? ''} />
              <DetailRow label="Giro" value={buyer.taxBusinessActivity ?? ''} />
            </>
          ) : null}
        </SectionCard>

        <SectionCard title="Pago">
          <DetailRow
            label="Método"
            value={paymentMethodLabels[data.paymentMethod] ?? data.paymentMethod}
          />
          <DetailRow label="Estado" value={payment?.status ?? 'Pendiente'} />
          <DetailRow label="Monto" value={formatClp(payment?.amount)} />
          <DetailRow label="Pagado" value={formatDate(payment?.paidAt)} />
          {payment?.refundedAmount && payment.refundedAmount !== '0' ? (
            <DetailRow
              label="Reembolsado"
              value={formatClp(payment.refundedAmount)}
            />
          ) : null}
          {payment?.rejectionReason ? (
            <DetailRow label="Motivo de rechazo" value={payment.rejectionReason} />
          ) : null}
          {proof ? (
            <View style={styles.proof}>
              <Text style={styles.lineTitle}>Comprobante</Text>
              {proof.contentType.startsWith('image/') ? (
                <Image
                  accessibilityLabel={`Vista previa de ${proof.fileName}`}
                  resizeMode="cover"
                  source={{ uri: proof.privatePreviewUrl }}
                  style={styles.proofImage}
                />
              ) : null}
              <Text style={salesStyles.muted}>
                {proof.fileName} · {formatDate(proof.uploadedAt)}
              </Text>
              <PrimaryButton
                label="Abrir comprobante seguro"
                variant="secondary"
                onPress={() => void Linking.openURL(proof.privatePreviewUrl)}
              />
            </View>
          ) : (
            <Text style={salesStyles.muted}>No hay comprobante cargado.</Text>
          )}
        </SectionCard>

        <SectionCard title="Acciones permitidas">
          {!Object.values(allowed).some(Boolean) ? (
            <Text style={salesStyles.muted}>
              No hay acciones disponibles para el estado actual.
            </Text>
          ) : null}
          <View style={salesStyles.actions}>
            {allowed.approveProof ? (
              <PrimaryButton
                label="Aprobar comprobante"
                onPress={() => openAction('approve')}
              />
            ) : null}
            {allowed.rejectProof ? (
              <PrimaryButton
                label="Rechazar comprobante"
                variant="secondary"
                onPress={() => openAction('reject')}
              />
            ) : null}
            {allowed.confirmManualPayment ? (
              <PrimaryButton
                label="Registrar pago manual"
                onPress={() => openAction('manual')}
              />
            ) : null}
            {allowed.resendLink ? (
              <PrimaryButton
                label="Reenviar enlace"
                variant="secondary"
                onPress={() => openAction('resend')}
              />
            ) : null}
            {allowed.cancel ? (
              <PrimaryButton
                label="Cancelar venta"
                variant="secondary"
                onPress={() => openAction('cancel')}
              />
            ) : null}
            {allowed.refund ? (
              <PrimaryButton
                label="Reembolsar pago"
                variant="secondary"
                onPress={() => openAction('refund')}
              />
            ) : null}
          </View>
        </SectionCard>

        <SectionCard title="Línea de tiempo">
          {data.timeline.map((event: SellerOrder['timeline'][number]) => (
            <View key={event.id} style={styles.timelineItem}>
              <View style={styles.timelineDot} />
              <View style={styles.timelineCopy}>
                <Text style={styles.lineTitle}>{event.title}</Text>
                {event.detail ? <Text style={salesStyles.muted}>{event.detail}</Text> : null}
                <Text style={styles.timelineMeta}>
                  {formatDate(event.createdAt)}
                  {event.actorName ? ` · ${event.actorName}` : ''}
                </Text>
              </View>
            </View>
          ))}
          {!data.timeline.length ? (
            <Text style={salesStyles.muted}>Aún no hay eventos registrados.</Text>
          ) : null}
        </SectionCard>
      </ScrollView>

      <Sheet
        visible={action !== null}
        title={action ? ACTION_TITLES[action] : 'Confirmar acción'}
        description={
          action === 'approve'
            ? 'Al aprobar, el pago se confirma y el stock reservado se descuenta una sola vez.'
            : action === 'resend'
              ? 'Confirma que quieres reenviar el enlace vigente al comprador.'
              : 'Revisa los datos antes de confirmar.'
        }
        onClose={closeAction}
        footer={
          <>
            <View style={salesStyles.footerItem}>
              <PrimaryButton
                label="Volver"
                variant="secondary"
                disabled={executeAction.isPending}
                onPress={closeAction}
              />
            </View>
            <View style={salesStyles.footerItem}>
              <PrimaryButton
                label={action ? ACTION_CONFIRM_LABELS[action] : 'Confirmar'}
                loading={executeAction.isPending}
                onPress={confirmAction}
              />
            </View>
          </>
        }
      >
        {action === 'reject' || action === 'cancel' || action === 'refund' ? (
          <SheetField
            label={
              action === 'reject'
                ? 'Motivo del rechazo'
                : action === 'refund'
                  ? 'Motivo del reembolso'
                  : 'Motivo de cancelación (opcional)'
            }
            multiline
            value={reason}
            onChangeText={setReason}
          />
        ) : null}
        {action === 'manual' ? (
          <>
            <SheetField
              label="Monto pagado"
              keyboardType="number-pad"
              value={amount}
              onChangeText={setAmount}
            />
            <SheetField
              label="Fecha del pago"
              placeholder="AAAA-MM-DD"
              value={paidDate}
              onChangeText={setPaidDate}
            />
            <SheetField
              label="Nota (opcional)"
              multiline
              value={note}
              onChangeText={setNote}
            />
          </>
        ) : null}
        {action === 'approve' ? (
          <Text style={salesStyles.muted}>
            Esta confirmación no puede ejecutarse dos veces: Tenda conserva la misma
            clave si debes reintentar por una falla de red.
          </Text>
        ) : null}
        {action === 'resend' ? (
          <Text style={salesStyles.muted}>
            Solo se ejecutará después de esta confirmación explícita.
          </Text>
        ) : null}
        {actionError ? <StatusMessage message={actionError} /> : null}
      </Sheet>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  loading: { color: colors.inkSoft, padding: 24 },
  state: { padding: 20 },
  heading: { gap: 7 },
  back: { color: colors.green, fontSize: 14, fontWeight: '800', paddingVertical: 7 },
  headingRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  headingCopy: { flex: 1, gap: 5 },
  eyebrow: {
    color: colors.green,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: { color: colors.ink, fontSize: 28, fontWeight: '800', letterSpacing: -1 },
  total: { color: colors.ink, fontSize: 24, fontWeight: '800' },
  line: {
    alignItems: 'center',
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 11,
    paddingBottom: 13,
  },
  productImage: { backgroundColor: colors.paper, borderRadius: 10, height: 52, width: 52 },
  lineCopy: { flex: 1, gap: 4 },
  lineTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  lineTotal: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  cost: { color: colors.inkSoft, fontSize: 12, lineHeight: 17 },
  proof: { gap: 10 },
  proofImage: {
    backgroundColor: colors.paper,
    borderRadius: 13,
    height: 210,
    width: '100%',
  },
  timelineItem: { flexDirection: 'row', gap: 11 },
  timelineDot: {
    backgroundColor: colors.green,
    borderRadius: 999,
    height: 9,
    marginTop: 6,
    width: 9,
  },
  timelineCopy: { flex: 1, gap: 3, paddingBottom: 14 },
  timelineMeta: { color: colors.inkMuted, fontSize: 12, lineHeight: 17 },
})
