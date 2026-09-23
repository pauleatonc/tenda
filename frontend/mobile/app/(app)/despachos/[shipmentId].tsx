import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { useRef, useState } from 'react'
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
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
  registeredAt,
  registrationLabel,
  requiresCarrier,
} from '../../../components/shipping-ui'
import { MobileApiError } from '../../../lib/auth-api'
import { formatDate } from '../../../lib/format'
import { newIdempotencyKey } from '../../../lib/graphql'
import {
  fetchShipment,
  generateShipmentLabel,
  registerShipmentDispatch,
  shippingKeys,
  type SellerShipment,
} from '../../../lib/shipping-api'

function fieldError(error: unknown, field: string): string | undefined {
  if (!(error instanceof MobileApiError)) return undefined
  return error.fieldErrors[field]?.[0]
}

export default function ShipmentDetailScreen() {
  const params = useLocalSearchParams<{ shipmentId?: string }>()
  const shipmentId = typeof params.shipmentId === 'string' ? params.shipmentId : ''
  const queryClient = useQueryClient()
  const [carrier, setCarrier] = useState('')
  const [trackingCode, setTrackingCode] = useState('')
  const [trackingUrl, setTrackingUrl] = useState('')
  const [note, setNote] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [actionError, setActionError] = useState('')
  const [registerError, setRegisterError] = useState<unknown>(null)
  const [success, setSuccess] = useState('')
  const [registerKey, setRegisterKey] = useState(newIdempotencyKey)
  const [labelKey, setLabelKey] = useState(newIdempotencyKey)
  const registerLock = useRef(false)
  const labelLock = useRef(false)

  const shipment = useQuery({
    queryKey: shippingKeys.shipment(shipmentId),
    queryFn: () => fetchShipment(shipmentId),
    enabled: Boolean(shipmentId),
  })

  const register = useMutation({
    mutationFn: () =>
      registerShipmentDispatch({
        shipmentId,
        carrier: carrier.trim() || null,
        trackingCode: trackingCode.trim() || null,
        trackingUrl: trackingUrl.trim() || null,
        note: note.trim() || null,
        idempotencyKey: registerKey,
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(shippingKeys.shipment(shipmentId), result.shipment)
      void queryClient.invalidateQueries({ queryKey: shippingKeys.root })
      setConfirmOpen(false)
      setRegisterKey(newIdempotencyKey())
      setActionError('')
      setRegisterError(null)
      setSuccess(
        result.shipment.buyerEmail
          ? `Registrado. Enviamos el correo a ${result.shipment.buyerEmail}.`
          : 'Registrado. El comprador no dejó correo, no se envió notificación.',
      )
      registerLock.current = false
    },
    onError: (error: Error) => {
      setConfirmOpen(false)
      setRegisterError(error)
      const hasFieldErrors =
        error instanceof MobileApiError && Object.keys(error.fieldErrors).length > 0
      setActionError(
        hasFieldErrors
          ? ''
          : error instanceof MobileApiError
            ? error.message
            : 'No pudimos registrar el envío.',
      )
      registerLock.current = false
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
      if (url) openLabel(url)
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
  const canRegister = detail.allowedActions.registerShipmentDispatch
  const canGenerateLabel = detail.allowedActions.generateShipmentLabel
  const needsCarrier = requiresCarrier(detail.deliveryMode)
  const actionLabel = registrationLabel(detail.deliveryMode)
  const place = destinationLine(detail)
  const registeredOn = registeredAt(detail)
  const formValid = !needsCarrier || carrier.trim().length > 0

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
          <DetailRow
            label="Correo del comprador"
            value={detail.buyerEmail || 'Sin correo registrado'}
          />
          <PrimaryButton
            label="Abrir venta asociada"
            variant="secondary"
            onPress={() => router.push(`/ventas/${detail.order.id}`)}
          />
        </SectionCard>

        <SectionCard title={canRegister ? actionLabel : 'Registro'}>
          {canRegister ? (
            <>
              <Text style={salesStyles.muted}>
                {detail.buyerEmail
                  ? `Al registrar, enviaremos un correo a ${detail.buyerEmail} con estos datos. No se hace seguimiento posterior.`
                  : 'El comprador no dejó correo. Registraremos el envío sin enviar notificación.'}
              </Text>
              <View style={salesStyles.actions}>
                {needsCarrier ? (
                  <>
                    <SheetField
                      label="Transportista"
                      value={carrier}
                      onChangeText={setCarrier}
                      placeholder="Chilexpress, Starken, Blue Express…"
                      error={fieldError(registerError, 'carrier')}
                    />
                    <SheetField
                      label="Código de tracking (opcional)"
                      value={trackingCode}
                      onChangeText={setTrackingCode}
                      autoCapitalize="characters"
                    />
                    <SheetField
                      label="URL de seguimiento (opcional)"
                      value={trackingUrl}
                      onChangeText={setTrackingUrl}
                      autoCapitalize="none"
                      keyboardType="url"
                      error={fieldError(registerError, 'trackingUrl')}
                    />
                  </>
                ) : null}
                <SheetField
                  label="Nota para el comprador (opcional)"
                  value={note}
                  onChangeText={setNote}
                  maxLength={500}
                  multiline
                />
                <PrimaryButton
                  label={actionLabel}
                  disabled={!formValid}
                  onPress={() => setConfirmOpen(true)}
                />
              </View>
            </>
          ) : (
            <>
              <DetailRow
                label={detail.status === 'delivered' ? 'Entregado' : 'Despachado'}
                value={formatDate(registeredOn)}
              />
              {needsCarrier ? (
                <DetailRow label="Transportista" value={detail.carrier || '—'} />
              ) : null}
              {detail.trackingCode ? (
                <>
                  <DetailRow label="Tracking">
                    <Text selectable style={styles.tracking}>
                      {detail.trackingCode}
                    </Text>
                  </DetailRow>
                  <PrimaryButton
                    label="Compartir tracking"
                    variant="secondary"
                    onPress={() => shareTracking(detail.trackingCode)}
                  />
                </>
              ) : null}
              {detail.trackingUrl ? (
                <PrimaryButton
                  label="Abrir seguimiento"
                  variant="secondary"
                  onPress={() => void Linking.openURL(detail.trackingUrl)}
                />
              ) : null}
              {detail.dispatchNote ? (
                <DetailRow label="Nota" value={detail.dispatchNote} />
              ) : null}
              <DetailRow
                label="Correo al comprador"
                value={
                  detail.buyerEmail
                    ? `Enviado a ${detail.buyerEmail}`
                    : 'No se envió (sin correo registrado)'
                }
              />
            </>
          )}
        </SectionCard>

        <SectionCard title="Etiqueta interna">
          <Text style={salesStyles.muted}>
            Documento interno de Tenda para preparar el bulto. No es una etiqueta del
            transportista.
          </Text>
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
      </ScrollView>

      <Sheet
        visible={confirmOpen}
        title={actionLabel}
        description={
          needsCarrier
            ? 'El envío quedará como despachado y no admite cambios posteriores.'
            : 'El envío quedará como entregado y no admite cambios posteriores.'
        }
        onClose={() => !register.isPending && setConfirmOpen(false)}
        footer={
          <PrimaryButton
            label="Confirmar y notificar"
            loading={register.isPending}
            onPress={() => {
              if (registerLock.current || register.isPending) return
              registerLock.current = true
              register.mutate()
            }}
          />
        }
      >
        {needsCarrier ? (
          <>
            <DetailRow label="Transportista" value={carrier.trim()} />
            <DetailRow label="Tracking" value={trackingCode.trim() || '—'} />
          </>
        ) : null}
        {note.trim() ? <DetailRow label="Nota" value={note.trim()} /> : null}
        <Text style={salesStyles.muted}>
          {detail.buyerEmail
            ? `Se enviará un correo a ${detail.buyerEmail}.`
            : 'No se enviará correo porque el comprador no dejó uno.'}
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
})
