import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { MobileEmptyState } from '../../../components/app-ui'
import { PrimaryButton, StatusMessage, colors } from '../../../components/auth-ui'
import { SectionCard, Sheet, SheetField } from '../../../components/inventory-ui'
import { DetailRow, salesStyles } from '../../../components/sales-ui'
import {
  ShipmentStatus,
  deliveryModeLabels,
  destinationLine,
  followUpKindLabels,
  nextActionLabels,
  returnCaseKindLabels,
} from '../../../components/shipping-ui'
import { MobileApiError } from '../../../lib/auth-api'
import { formatDate } from '../../../lib/format'
import { newIdempotencyKey } from '../../../lib/graphql'
import {
  confirmReturnToStock,
  fetchShipment,
  generateShipmentLabel,
  markShipmentDispatched,
  registerReturnCase,
  rescheduleFollowUp,
  shippingKeys,
  updateShipment,
  type SellerShipment,
} from '../../../lib/shipping-api'

export default function ShipmentDetailScreen() {
  const params = useLocalSearchParams<{ shipmentId?: string }>()
  const shipmentId = typeof params.shipmentId === 'string' ? params.shipmentId : ''
  const queryClient = useQueryClient()
  const [carrier, setCarrier] = useState('')
  const [trackingCode, setTrackingCode] = useState('')
  const [trackingUrl, setTrackingUrl] = useState('')
  const [comment, setComment] = useState('')
  const [internalNote, setInternalNote] = useState(false)
  const [dispatchOpen, setDispatchOpen] = useState(false)
  const [actionError, setActionError] = useState('')
  const [success, setSuccess] = useState('')
  const [updateKey, setUpdateKey] = useState(newIdempotencyKey)
  const [dispatchKey, setDispatchKey] = useState(newIdempotencyKey)
  const [labelKey, setLabelKey] = useState(newIdempotencyKey)
  const [dueAt, setDueAt] = useState('')
  const [rescheduleReason, setRescheduleReason] = useState('')
  const [rescheduleKey, setRescheduleKey] = useState(newIdempotencyKey)
  const [returnKind, setReturnKind] = useState('returned')
  const [returnNotes, setReturnNotes] = useState('')
  const [returnKey, setReturnKey] = useState(newIdempotencyKey)
  const [stockKey, setStockKey] = useState(newIdempotencyKey)
  const saveLock = useRef(false)
  const dispatchLock = useRef(false)
  const labelLock = useRef(false)
  const rescheduleLock = useRef(false)
  const returnLock = useRef(false)
  const stockLock = useRef(false)

  const shipment = useQuery({
    queryKey: shippingKeys.shipment(shipmentId),
    queryFn: () => fetchShipment(shipmentId),
    enabled: Boolean(shipmentId),
  })

  useEffect(() => {
    if (!shipment.data) return
    setCarrier(shipment.data.carrier)
    setTrackingCode(shipment.data.trackingCode)
    setTrackingUrl(shipment.data.trackingUrl)
    if (shipment.data.nextFollowUp) setDueAt(shipment.data.nextFollowUp.dueAt)
  }, [shipment.data])

  const saveTracking = useMutation({
    mutationFn: () =>
      updateShipment({
        shipmentId,
        carrier,
        trackingCode,
        trackingUrl,
        comment: comment.trim() || null,
        internalNote,
        idempotencyKey: updateKey,
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(shippingKeys.shipment(shipmentId), result.shipment)
      void queryClient.invalidateQueries({ queryKey: shippingKeys.root })
      setComment('')
      setInternalNote(false)
      setUpdateKey(newIdempotencyKey())
      setActionError('')
      setSuccess('Seguimiento guardado.')
      saveLock.current = false
    },
    onError: (error: Error) => {
      setActionError(
        error instanceof MobileApiError
          ? error.message
          : 'No pudimos guardar el seguimiento.',
      )
      saveLock.current = false
    },
  })

  const dispatch = useMutation({
    mutationFn: () =>
      markShipmentDispatched({
        shipmentId,
        comment: comment.trim() || null,
        idempotencyKey: dispatchKey,
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(shippingKeys.shipment(shipmentId), result.shipment)
      void queryClient.invalidateQueries({ queryKey: shippingKeys.root })
      setDispatchOpen(false)
      setComment('')
      setDispatchKey(newIdempotencyKey())
      setActionError('')
      setSuccess('El pedido quedó marcado como despachado.')
      dispatchLock.current = false
    },
    onError: (error: Error) => {
      setActionError(
        error instanceof MobileApiError
          ? error.message
          : 'No pudimos marcar el despacho.',
      )
      dispatchLock.current = false
    },
  })

  const generateLabel = useMutation({
    mutationFn: () =>
      generateShipmentLabel({
        shipmentId,
        idempotencyKey: labelKey,
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(shippingKeys.shipment(shipmentId), result.shipment)
      void queryClient.invalidateQueries({ queryKey: shippingKeys.root })
      setLabelKey(newIdempotencyKey())
      setActionError('')
      setSuccess('Etiqueta interna generada.')
      labelLock.current = false
      const url = result.shipment.latestLabel?.downloadUrl
      if (url) {
        Alert.alert(
          'Etiqueta interna Tenda',
          'Este documento no es una etiqueta de transportista. El enlace de descarga expira.',
          [
            { text: 'Cerrar', style: 'cancel' },
            { text: 'Descargar PDF', onPress: () => void Linking.openURL(url) },
          ],
        )
      }
    },
    onError: (error: Error) => {
      setActionError(
        error instanceof MobileApiError
          ? error.message
          : 'No pudimos generar la etiqueta.',
      )
      labelLock.current = false
    },
  })

  const reschedule = useMutation({
    mutationFn: () =>
      rescheduleFollowUp({
        followUpId: shipment.data?.nextFollowUp?.id ?? '',
        dueAt,
        reason: rescheduleReason.trim(),
        idempotencyKey: rescheduleKey,
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(shippingKeys.shipment(shipmentId), result.shipment)
      void queryClient.invalidateQueries({ queryKey: shippingKeys.root })
      setRescheduleReason('')
      setRescheduleKey(newIdempotencyKey())
      setActionError('')
      setSuccess('Cadencia reprogramada.')
      rescheduleLock.current = false
    },
    onError: (error: Error) => {
      setActionError(
        error instanceof MobileApiError
          ? error.message
          : 'No pudimos reprogramar la cadencia.',
      )
      rescheduleLock.current = false
    },
  })

  const registerCase = useMutation({
    mutationFn: () =>
      registerReturnCase({
        shipmentId,
        kind: returnKind,
        notes: returnNotes.trim() || null,
        idempotencyKey: returnKey,
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(shippingKeys.shipment(shipmentId), result.shipment)
      void queryClient.invalidateQueries({ queryKey: shippingKeys.root })
      setReturnNotes('')
      setReturnKey(newIdempotencyKey())
      setActionError('')
      setSuccess('Incidencia registrada. El stock no se repuso.')
      returnLock.current = false
    },
    onError: (error: Error) => {
      setActionError(
        error instanceof MobileApiError
          ? error.message
          : 'No pudimos registrar la incidencia.',
      )
      returnLock.current = false
    },
  })

  const confirmStock = useMutation({
    mutationFn: (returnCaseId: string) =>
      confirmReturnToStock({
        returnCaseId,
        idempotencyKey: stockKey,
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(shippingKeys.shipment(shipmentId), result.shipment)
      void queryClient.invalidateQueries({ queryKey: shippingKeys.root })
      setStockKey(newIdempotencyKey())
      setActionError('')
      setSuccess('Reposición de stock confirmada.')
      stockLock.current = false
    },
    onError: (error: Error) => {
      setActionError(
        error instanceof MobileApiError
          ? error.message
          : 'No pudimos confirmar la reposición.',
      )
      stockLock.current = false
    },
  })

  function shareTracking(code: string) {
    void Share.share({ message: code, title: 'Tracking del envío' })
  }

  function openLabel(url: string) {
    Alert.alert(
      'Etiqueta interna Tenda',
      'Este documento no es una etiqueta de transportista. El enlace de descarga expira.',
      [
        { text: 'Cerrar', style: 'cancel' },
        { text: 'Descargar PDF', onPress: () => void Linking.openURL(url) },
      ],
    )
  }

  function openExternal(url: string) {
    Alert.alert(
      'Abrir seguimiento externo',
      'Tenda no consulta el estado con el transportista. Vas a salir a un sitio externo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Abrir sitio',
          onPress: () => void Linking.openURL(url),
        },
      ],
    )
  }

  if (shipment.isPending) {
    return (
      <SafeAreaView style={salesStyles.safeArea}>
        <View style={styles.state}>
          <Text style={salesStyles.muted}>Cargando despacho…</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (shipment.isError) {
    return (
      <SafeAreaView style={salesStyles.safeArea}>
        <View style={styles.state}>
          <MobileEmptyState
            title="No pudimos cargar el despacho"
            description={
              shipment.error instanceof MobileApiError
                ? shipment.error.message
                : 'Revisa tu conexión e inténtalo otra vez.'
            }
            action={
              <PrimaryButton label="Reintentar" onPress={() => void shipment.refetch()} />
            }
          />
        </View>
      </SafeAreaView>
    )
  }

  const data = shipment.data
  if (!data) {
    return (
      <SafeAreaView style={salesStyles.safeArea}>
        <View style={styles.state}>
          <MobileEmptyState
            title="Despacho no encontrado"
            description="No existe o pertenece a otra Tienda."
            action={<PrimaryButton label="Volver" onPress={() => router.back()} />}
          />
        </View>
      </SafeAreaView>
    )
  }

  const detail: SellerShipment = data
  const canUpdate = detail.allowedActions.updateShipment
  const canDispatch = detail.allowedActions.markShipmentDispatched
  const canGenerateLabel = detail.allowedActions.generateShipmentLabel
  const place = destinationLine(detail)

  return (
    <SafeAreaView style={salesStyles.safeArea}>
      <ScrollView contentContainerStyle={salesStyles.content}>
        <View style={styles.heading}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={styles.back}>‹ Despachos</Text>
          </Pressable>
          <View style={styles.headingRow}>
            <View style={styles.headingCopy}>
              <Text style={styles.eyebrow}>Detalle de envío</Text>
              <Text accessibilityRole="header" style={styles.title}>
                Envío {detail.number}
              </Text>
            </View>
            <ShipmentStatus status={detail.status} />
          </View>
          <Text style={salesStyles.muted}>
            Venta {detail.order.number} · {formatDate(detail.createdAt)}
          </Text>
          <Text style={salesStyles.muted}>
            {nextActionLabels[detail.nextAction] ?? detail.nextAction}
          </Text>
        </View>

        {success ? <StatusMessage kind="success" message={success} /> : null}
        {actionError ? <StatusMessage kind="error" message={actionError} /> : null}

        <SectionCard title="Destino">
          <DetailRow label="Destinatario" value={detail.recipientName || '—'} />
          {detail.recipientTaxId ? (
            <DetailRow label="RUT de quien recibe" value={detail.recipientTaxId} />
          ) : null}
          <DetailRow label="Dirección" value={place || '—'} />
          <DetailRow
            label="Modalidad"
            value={deliveryModeLabels[detail.deliveryMode] ?? detail.deliveryMode}
          />
          {detail.deliveryNotes ? (
            <DetailRow label="Notas de entrega" value={detail.deliveryNotes} />
          ) : null}
          <PrimaryButton
            label="Abrir venta asociada"
            variant="secondary"
            onPress={() => router.push(`/ventas/${detail.order.id}`)}
          />
        </SectionCard>

        <SectionCard title="Seguimiento">
          {detail.trackingCode ? (
            <>
              <Text selectable style={styles.tracking}>
                {detail.trackingCode}
              </Text>
              <PrimaryButton
                label="Compartir tracking"
                variant="secondary"
                onPress={() => shareTracking(detail.trackingCode)}
              />
            </>
          ) : (
            <Text style={salesStyles.muted}>Todavía no hay un código de tracking.</Text>
          )}
          {detail.trackingUrl ? (
            <PrimaryButton
              label="Abrir seguimiento"
              variant="secondary"
              onPress={() => openExternal(detail.trackingUrl)}
            />
          ) : null}
          {detail.publicUrl ? (
            <PrimaryButton
              label="Compartir enlace público"
              variant="secondary"
              onPress={() => shareTracking(detail.publicUrl)}
            />
          ) : null}
          {detail.activeTicket ? (
            <PrimaryButton
              label={`Abrir consulta ${detail.activeTicket.number}`}
              onPress={() =>
                router.push(`/despachos/ticket/${detail.activeTicket?.id}`)
              }
            />
          ) : null}
          {canUpdate ? (
            <View style={salesStyles.actions}>
              <SheetField
                label="Transportista"
                value={carrier}
                onChangeText={setCarrier}
              />
              <SheetField
                label="Código de tracking"
                value={trackingCode}
                onChangeText={setTrackingCode}
                autoCapitalize="characters"
              />
              <SheetField
                label="URL de seguimiento"
                value={trackingUrl}
                onChangeText={setTrackingUrl}
                autoCapitalize="none"
                keyboardType="url"
              />
              <SheetField
                label="Comentario"
                value={comment}
                onChangeText={setComment}
                multiline
              />
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Nota interna</Text>
                <Switch
                  accessibilityLabel="Nota interna"
                  value={internalNote}
                  onValueChange={setInternalNote}
                />
              </View>
              <PrimaryButton
                label="Guardar seguimiento"
                loading={saveTracking.isPending}
                onPress={() => {
                  if (saveLock.current || saveTracking.isPending) return
                  saveLock.current = true
                  saveTracking.mutate()
                }}
              />
            </View>
          ) : (
            <DetailRow label="Transportista" value={detail.carrier || '—'} />
          )}
          {canDispatch ? (
            <PrimaryButton
              label="Marcar despachado"
              loading={dispatch.isPending}
              onPress={() => setDispatchOpen(true)}
            />
          ) : null}
          {detail.latestLabel?.downloadUrl ? (
            <PrimaryButton
              label="Ver etiqueta"
              variant="secondary"
              onPress={() => openLabel(detail.latestLabel?.downloadUrl ?? '')}
            />
          ) : null}
          {canGenerateLabel ? (
            <PrimaryButton
              label="Generar etiqueta"
              variant="secondary"
              loading={generateLabel.isPending}
              onPress={() => {
                if (labelLock.current || generateLabel.isPending) return
                labelLock.current = true
                generateLabel.mutate()
              }}
            />
          ) : null}
        </SectionCard>

        <SectionCard title="Cadencias">
          {detail.nextFollowUp ? (
            <>
              <DetailRow
                label="Próximo vencimiento"
                value={`${followUpKindLabels[detail.nextFollowUp.kind] ?? detail.nextFollowUp.kind} · ${formatDate(detail.nextFollowUp.dueAt)}`}
              />
              <DetailRow
                label="Origen del parámetro"
                value={`${detail.nextFollowUp.parameterSourceLabel} · ${detail.nextFollowUp.parameterKey} (${detail.nextFollowUp.parameterLabel})`}
              />
              {detail.allowedActions.rescheduleFollowUp ? (
                <>
                  <SheetField
                    label="Nueva fecha"
                    value={dueAt}
                    onChangeText={setDueAt}
                    autoCapitalize="none"
                  />
                  <SheetField
                    label="Motivo"
                    value={rescheduleReason}
                    onChangeText={setRescheduleReason}
                    multiline
                  />
                  <PrimaryButton
                    label="Reprogramar seguimiento"
                    variant="secondary"
                    loading={reschedule.isPending}
                    onPress={() => {
                      if (rescheduleLock.current || reschedule.isPending) return
                      rescheduleLock.current = true
                      reschedule.mutate()
                    }}
                  />
                </>
              ) : null}
            </>
          ) : (
            <Text style={salesStyles.muted}>No hay una cadencia programada.</Text>
          )}
        </SectionCard>

        <SectionCard title="Incidencia o devolución">
          <Text style={salesStyles.muted}>
            Registrar un caso no repone stock. La reposición pide confirmación aparte.
          </Text>
          {detail.allowedActions.registerReturnCase ? (
            <>
              {Object.entries(returnCaseKindLabels).map(([value, label]) => (
                <PrimaryButton
                  key={value}
                  label={label}
                  variant={returnKind === value ? undefined : 'secondary'}
                  onPress={() => setReturnKind(value)}
                />
              ))}
              <SheetField
                label="Notas"
                value={returnNotes}
                onChangeText={setReturnNotes}
                multiline
              />
              <PrimaryButton
                label="Registrar incidencia"
                loading={registerCase.isPending}
                onPress={() => {
                  if (returnLock.current || registerCase.isPending) return
                  returnLock.current = true
                  registerCase.mutate()
                }}
              />
            </>
          ) : null}
          {detail.returnCases.map((item) => (
            <View key={item.id} style={styles.event}>
              <Text style={styles.eventTitle}>
                {returnCaseKindLabels[item.kind] ?? item.kind}
              </Text>
              <Text style={salesStyles.muted}>
                {item.stockConfirmedAt
                  ? `Stock repuesto ${formatDate(item.stockConfirmedAt)}`
                  : 'Sin reposición de stock'}
              </Text>
              {item.notes ? <Text style={salesStyles.muted}>{item.notes}</Text> : null}
              {!item.stockConfirmedAt ? (
                <PrimaryButton
                  label="Confirmar reposición"
                  variant="secondary"
                  loading={confirmStock.isPending}
                  onPress={() => {
                    if (stockLock.current || confirmStock.isPending) return
                    stockLock.current = true
                    confirmStock.mutate(item.id)
                  }}
                />
              ) : null}
            </View>
          ))}
        </SectionCard>

        <SectionCard title="Línea de tiempo">
          {detail.timeline.map((item) => (
            <View key={item.id} style={styles.event}>
              <Text style={styles.eventTitle}>{item.title}</Text>
              {item.detail ? <Text style={salesStyles.muted}>{item.detail}</Text> : null}
              <Text style={salesStyles.muted}>
                {item.isPublic ? 'Visible al comprador' : 'Nota interna'} · {item.actorName} ·{' '}
                {formatDate(item.createdAt)}
              </Text>
            </View>
          ))}
        </SectionCard>
      </ScrollView>

      <Sheet
        visible={dispatchOpen}
        title="Marcar despachado"
        description="El envío dejará de admitir cambios de tracking."
        onClose={() => !dispatch.isPending && setDispatchOpen(false)}
        footer={
          <PrimaryButton
            label="Confirmar despacho"
            loading={dispatch.isPending}
            onPress={() => {
              if (dispatchLock.current || dispatch.isPending) return
              dispatchLock.current = true
              dispatch.mutate()
            }}
          />
        }
      >
        <Text style={salesStyles.muted}>
          Confirma que el pedido ya salió. Si reintentas, Tenda no duplica el despacho.
        </Text>
      </Sheet>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  state: { flex: 1, justifyContent: 'center', padding: 20 },
  heading: { gap: 10 },
  back: { color: colors.green, fontSize: 15, fontWeight: '700' },
  headingRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  headingCopy: { flex: 1, gap: 4 },
  eyebrow: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: { color: colors.ink, fontSize: 28, fontWeight: '800', letterSpacing: -0.8 },
  tracking: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  switchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  switchLabel: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  event: { gap: 4, paddingBottom: 12 },
  eventTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
})
