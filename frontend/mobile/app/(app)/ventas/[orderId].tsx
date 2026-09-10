import { formatChileAddress, formatRutInput } from '@tenda/api-client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { useRef, useState } from 'react'
import {
  Alert,
  Clipboard,
  Image,
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
import { ChileLocationFields } from '../../../components/chile-location-fields'
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
import { generateShipmentLabel } from '../../../lib/shipping-api'
import {
  cancelOrder,
  confirmManualPayment,
  fetchOrder,
  refundPayment,
  reissueBankTransferOffer,
  restoreOrder,
  reviewPaymentProof,
  salesKeys,
  sendOfferLink,
  updateOrderBuyer,
  type SellerOrder,
} from '../../../lib/sales-api'

type ActionKind =
  | 'approve'
  | 'reject'
  | 'manual'
  | 'cancel'
  | 'restore'
  | 'refund'
  | 'resend'
  | 'reissue'

const ACTION_TITLES: Record<ActionKind, string> = {
  approve: 'Validar comprobante',
  reject: 'Rechazar comprobante',
  manual: 'Registrar pago manual',
  cancel: 'Cancelar venta',
  restore: 'Restaurar venta',
  refund: 'Reembolsar pago',
  resend: 'Reenviar enlace',
  reissue: 'Enviar de nuevo',
}

const ACTION_CONFIRM_LABELS: Record<ActionKind, string> = {
  approve: 'Validar y descontar stock',
  reject: 'Rechazar comprobante',
  manual: 'Confirmar pago',
  cancel: 'Cancelar venta',
  restore: 'Restaurar venta',
  refund: 'Iniciar reembolso total',
  resend: 'Reenviar enlace',
  reissue: 'Crear enlace nuevo',
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

type ActionForm = {
  reason: string
  amount: string
  paidDate: string
  note: string
  email: string
}

function isValidEmail(value: string) {
  const email = value.trim()
  return Boolean(email) && email.includes('@') && !email.includes(' ')
}

function SaleActionSheet({
  action,
  isPending,
  actionError,
  defaultAmount,
  defaultEmail,
  onClose,
  onConfirm,
}: {
  action: ActionKind | null
  isPending: boolean
  actionError: string
  defaultAmount: string
  defaultEmail: string
  onClose: () => void
  onConfirm: (form: ActionForm) => void
}) {
  const [reason, setReason] = useState('')
  const [amount, setAmount] = useState(defaultAmount)
  const [paidDate, setPaidDate] = useState(today)
  const [note, setNote] = useState('')
  const [email, setEmail] = useState(defaultEmail)

  return (
    <Sheet
      visible={action !== null}
      title={action ? ACTION_TITLES[action] : 'Confirmar acción'}
      description={
        action === 'approve'
          ? 'Al validar, el pago se confirma y el stock reservado se descuenta una sola vez.'
          : action === 'resend'
            ? defaultEmail
              ? 'Revisa el correo. Si lo anotaste mal, corrígelo antes de enviar el enlace.'
              : 'Ingresa el correo del comprador para enviarle el enlace.'
            : action === 'reissue'
              ? 'Se cancela esta venta y se crea un enlace nuevo con el mismo producto.'
              : action === 'restore'
                ? 'Se vuelve a reservar el stock y el enlace público queda activo.'
                : 'Revisa los datos antes de confirmar.'
      }
      onClose={onClose}
      footer={
        <>
          <View style={salesStyles.footerItem}>
            <PrimaryButton
              label="Volver"
              variant="secondary"
              disabled={isPending}
              onPress={onClose}
            />
          </View>
          <View style={salesStyles.footerItem}>
            <PrimaryButton
              label={action ? ACTION_CONFIRM_LABELS[action] : 'Confirmar'}
              loading={isPending}
              onPress={() => onConfirm({ reason, amount, paidDate, note, email })}
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
          blurOnSubmit={false}
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
            blurOnSubmit={false}
            value={note}
            onChangeText={setNote}
          />
        </>
      ) : null}
      {action === 'resend' ? (
        <SheetField
          label="Correo del comprador"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
      ) : null}
      {action === 'approve' ? (
        <Text style={salesStyles.muted}>
          Esta confirmación no puede ejecutarse dos veces: Tenda conserva la misma
          clave si debes reintentar por una falla de red.
        </Text>
      ) : null}
      {action === 'resend' ? (
        <Text style={salesStyles.muted}>
          Enviaremos el enlace vigente a este correo.
        </Text>
      ) : null}
      {actionError ? <StatusMessage message={actionError} /> : null}
    </Sheet>
  )
}

export default function SaleDetailScreen() {
  const params = useLocalSearchParams<{ orderId?: string }>()
  const orderId = typeof params.orderId === 'string' ? params.orderId : ''
  const queryClient = useQueryClient()
  const [action, setAction] = useState<ActionKind | null>(null)
  const [actionError, setActionError] = useState('')
  const [success, setSuccess] = useState('')
  const [actionKey, setActionKey] = useState(newIdempotencyKey)
  const [shareUrl, setShareUrl] = useState('')
  const [shareOrderId, setShareOrderId] = useState('')
  const [email, setEmail] = useState('')
  const [editingContact, setEditingContact] = useState(false)
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [recipientTaxId, setRecipientTaxId] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [deliveryCommune, setDeliveryCommune] = useState('')
  const [deliveryRegion, setDeliveryRegion] = useState('')
  const [deliveryNotes, setDeliveryNotes] = useState('')
  const [contactKey, setContactKey] = useState(newIdempotencyKey)
  const [labelKey, setLabelKey] = useState(newIdempotencyKey)
  const actionLock = useRef(false)
  const labelLock = useRef(false)

  const order = useQuery({
    queryKey: salesKeys.order(orderId),
    queryFn: () => fetchOrder(orderId),
    enabled: Boolean(orderId),
  })

  const executeAction = useMutation({
    mutationFn: async ({ kind, form }: { kind: ActionKind; form: ActionForm }) => {
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
          reason: form.reason.trim(),
          idempotencyKey: actionKey,
        })
      }
      if (kind === 'manual') {
        return confirmManualPayment({
          orderId,
          amount: form.amount,
          paidAt: `${form.paidDate}T12:00:00.000Z`,
          note: form.note.trim() || null,
          idempotencyKey: actionKey,
        })
      }
      if (kind === 'cancel') {
        return cancelOrder({
          orderId,
          reason: form.reason.trim(),
          idempotencyKey: actionKey,
        })
      }
      if (kind === 'restore') {
        return restoreOrder({ orderId, idempotencyKey: actionKey })
      }
      if (kind === 'refund') {
        return refundPayment({
          orderId,
          reason: form.reason.trim(),
          idempotencyKey: actionKey,
        })
      }
      if (kind === 'reissue') {
        return reissueBankTransferOffer({ orderId, idempotencyKey: actionKey })
      }
      return sendOfferLink({
        orderId,
        email: form.email.trim(),
        idempotencyKey: actionKey,
      })
    },
    onSuccess: (result, { kind }) => {
      if ((kind === 'resend' || kind === 'reissue') && 'publicUrl' in result) {
        setShareUrl(String(result.publicUrl))
        setShareOrderId(result.order.id)
      }
      setSuccess(
        kind === 'resend'
          ? 'Enviamos el enlace al correo indicado.'
          : kind === 'reissue'
            ? 'Se creó un enlace nuevo. Compártelo con el comprador.'
            : kind === 'restore'
              ? 'La venta se restauró. El stock quedó reservado y el enlace quedó activo.'
              : 'La venta se actualizó correctamente.',
      )
      closeAction()
      void queryClient.invalidateQueries({ queryKey: salesKeys.root })
      if (kind === 'reissue' && 'order' in result) {
        router.replace(`/ventas/${result.order.id}`)
      }
    },
    onError: (error: unknown, { kind }) => {
      setActionError(
        error instanceof MobileApiError
          ? error.message
          : 'No pudimos completar la acción. Inténtalo otra vez.',
      )
      if (kind === 'resend') setActionKey(newIdempotencyKey())
    },
    onSettled: () => {
      actionLock.current = false
    },
  })

  const saveContact = useMutation({
    mutationFn: () =>
      updateOrderBuyer({
        orderId,
        fullName: contactName.trim() || recipientName.trim() || 'Comprador',
        email: contactEmail.trim() || null,
        phone: contactPhone.trim() || null,
        recipientName: recipientName.trim() || null,
        recipientTaxId: recipientTaxId.trim() || null,
        deliveryAddress: deliveryAddress.trim() || null,
        deliveryCommune: deliveryCommune.trim() || null,
        deliveryRegion: deliveryRegion.trim() || null,
        deliveryNotes: deliveryNotes.trim() || null,
        taxId: order.data?.buyer?.taxId || null,
        taxName: order.data?.buyer?.taxName || null,
        taxBusinessActivity: order.data?.buyer?.taxBusinessActivity || null,
        taxAddress: order.data?.buyer?.taxAddress || null,
        taxCommune: order.data?.buyer?.taxCommune || null,
        taxRegion: order.data?.buyer?.taxRegion || null,
        taxEmail: order.data?.buyer?.taxEmail || null,
        idempotencyKey: contactKey,
      }),
    onSuccess: () => {
      setEditingContact(false)
      setContactKey(newIdempotencyKey())
      setSuccess('Datos de comprador y entrega actualizados.')
      void queryClient.invalidateQueries({ queryKey: salesKeys.root })
    },
    onError: (error: unknown) => {
      setActionError(
        error instanceof MobileApiError
          ? error.message
          : 'No pudimos guardar los cambios. Inténtalo otra vez.',
      )
      setContactKey(newIdempotencyKey())
    },
  })

  const generateLabel = useMutation({
    mutationFn: () =>
      generateShipmentLabel({
        shipmentId: order.data?.shipmentId ?? '',
        idempotencyKey: labelKey,
      }),
    onSuccess: (result) => {
      const url = result.label?.downloadUrl ?? result.shipment.latestLabel?.downloadUrl
      setLabelKey(newIdempotencyKey())
      setActionError('')
      labelLock.current = false
      void queryClient.invalidateQueries({ queryKey: salesKeys.order(orderId) })
      if (url) {
        openLabelUrl(url)
      }
    },
    onError: (error: unknown) => {
      setActionError(
        error instanceof MobileApiError
          ? error.message
          : 'No pudimos generar la etiqueta.',
      )
      labelLock.current = false
    },
  })

  function openLabelUrl(url: string) {
    Alert.alert(
      'Etiqueta interna Tenda',
      'Este documento no es una etiqueta de transportista. El enlace de descarga expira.',
      [
        { text: 'Cerrar', style: 'cancel' },
        { text: 'Descargar PDF', onPress: () => void Linking.openURL(url) },
      ],
    )
  }

  function openLabel() {
    const url = order.data?.latestLabel?.downloadUrl
    if (url) {
      openLabelUrl(url)
      return
    }
    if (!order.data?.shipmentId || labelLock.current || generateLabel.isPending) return
    labelLock.current = true
    generateLabel.mutate()
  }

  function openContactEditor() {
    const current = order.data?.buyer
    setContactName(current?.fullName ?? '')
    setContactEmail(current?.email ?? '')
    setContactPhone(current?.phone ?? '')
    setRecipientName(current?.recipientName ?? '')
    setRecipientTaxId(current?.recipientTaxId ?? '')
    setDeliveryAddress(current?.deliveryAddress ?? '')
    setDeliveryCommune(current?.deliveryCommune ?? '')
    setDeliveryRegion(current?.deliveryRegion ?? '')
    setDeliveryNotes(current?.deliveryNotes ?? '')
    setActionError('')
    setEditingContact(true)
  }

  function openAction(kind: ActionKind) {
    setAction(kind)
    setActionError('')
    setSuccess('')
    setActionKey(newIdempotencyKey())
  }

  function closeAction() {
    setAction(null)
    setActionError('')
  }

  function confirmAction(form: ActionForm) {
    if (!action || executeAction.isPending || actionLock.current) return
    if (action === 'reject' && !form.reason.trim()) {
      setActionError('Escribe el motivo del rechazo.')
      return
    }
    if (action === 'refund' && !form.reason.trim()) {
      setActionError('Escribe el motivo del reembolso.')
      return
    }
    if (action === 'resend' && !isValidEmail(form.email)) {
      setActionError('Ingresa un correo válido.')
      return
    }
    if (action === 'manual') {
      const numericAmount = Number(form.amount)
      if (!Number.isInteger(numericAmount) || numericAmount <= 0) {
        setActionError('Ingresa un monto CLP entero mayor que cero.')
        return
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(form.paidDate)) {
        setActionError('Usa una fecha con formato AAAA-MM-DD.')
        return
      }
    }
    actionLock.current = true
    setActionError('')
    executeAction.mutate({ kind: action, form })
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
  const canSendLink = allowed.resendLink || allowed.sendOfferLink
  const canViewLabel = allowed.viewShipmentLabel || Boolean(data.latestLabel)

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
        {shareUrl ? (
          <View style={styles.shareBox}>
            <Text selectable style={styles.shareUrl}>
              {shareUrl}
            </Text>
            <PrimaryButton
              label="Compartir"
              onPress={() =>
                void Share.share({
                  title: `Venta ${data.number}`,
                  message: shareUrl,
                  url: shareUrl,
                })
              }
            />
            <PrimaryButton
              label="Copiar"
              variant="secondary"
              onPress={() => Clipboard.setString(shareUrl)}
            />
            <SheetField
              label="Enviar por correo"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
            <PrimaryButton
              label="Enviar correo"
              variant="secondary"
              onPress={() => {
                if (!email.trim() || !shareOrderId) return
                void sendOfferLink({
                  orderId: shareOrderId,
                  email: email.trim(),
                  idempotencyKey: newIdempotencyKey(),
                })
              }}
            />
          </View>
        ) : null}
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

        <SectionCard
          title="Comprador y entrega"
          action={
            allowed.updateBuyer ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Editar comprador y entrega"
                onPress={openContactEditor}
              >
                <Text style={styles.editIcon}>✎</Text>
              </Pressable>
            ) : undefined
          }
        >
          <DetailRow label="Comprador" value={buyer?.fullName ?? 'Pendiente'} />
          <DetailRow label="Email" value={buyer?.email || 'Sin correo'} />
          <DetailRow label="Teléfono" value={buyer?.phone ?? ''} />
          <DetailRow
            label="Entrega"
            value={deliveryModeLabels[data.deliveryMode] ?? data.deliveryMode}
          />
          {buyer?.recipientName || data.deliveryMode === 'shipping' ? (
            <>
              <DetailRow label="Destinatario" value={buyer?.recipientName ?? ''} />
              <DetailRow label="RUT de quien recibe" value={buyer?.recipientTaxId ?? ''} />
              <DetailRow
                label="Dirección"
                value={formatChileAddress(
                  buyer?.deliveryAddress ?? '',
                  buyer?.deliveryCommune ?? '',
                  buyer?.deliveryRegion ?? '',
                )}
              />
              {buyer?.deliveryNotes ? (
                <DetailRow label="Indicaciones" value={buyer.deliveryNotes} />
              ) : null}
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
          {!Object.values(allowed).some(Boolean) && !canViewLabel ? (
            <Text style={salesStyles.muted}>
              No hay acciones disponibles para el estado actual.
            </Text>
          ) : null}
          <View style={salesStyles.actions}>
            {allowed.approveProof ? (
              <PrimaryButton
                label="Validar"
                onPress={() => openAction('approve')}
              />
            ) : null}
            {allowed.rejectProof && data.paymentMethod !== 'bank_transfer' ? (
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
            {canSendLink ? (
              <PrimaryButton
                label="Reenviar enlace"
                variant="secondary"
                onPress={() => openAction('resend')}
              />
            ) : null}
            {allowed.reissueOffer ? (
              <PrimaryButton
                label="Enviar de nuevo"
                variant="secondary"
                onPress={() => openAction('reissue')}
              />
            ) : null}
            {allowed.cancel ? (
              <PrimaryButton
                label="Cancelar venta"
                variant="secondary"
                onPress={() => openAction('cancel')}
              />
            ) : null}
            {allowed.restore ? (
              <PrimaryButton
                label="Restaurar venta"
                onPress={() => openAction('restore')}
              />
            ) : null}
            {allowed.refund ? (
              <PrimaryButton
                label="Reembolsar pago"
                variant="secondary"
                onPress={() => openAction('refund')}
              />
            ) : null}
            {canViewLabel ? (
              <PrimaryButton
                label="Ver etiqueta"
                variant="secondary"
                loading={generateLabel.isPending}
                onPress={openLabel}
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

      <SaleActionSheet
        key={action ?? 'closed'}
        action={action}
        isPending={executeAction.isPending}
        actionError={actionError}
        defaultAmount={data.payment?.amount ?? data.total}
        defaultEmail={data.buyer?.email ?? ''}
        onClose={closeAction}
        onConfirm={confirmAction}
      />
      <Sheet
        visible={editingContact}
        title="Editar comprador y entrega"
        description="Corrige los datos si el comprador los anotó mal."
        onClose={() => setEditingContact(false)}
        footer={
          <>
            <View style={salesStyles.footerItem}>
              <PrimaryButton
                label="Cancelar"
                variant="secondary"
                disabled={saveContact.isPending}
                onPress={() => setEditingContact(false)}
              />
            </View>
            <View style={salesStyles.footerItem}>
              <PrimaryButton
                label="Guardar"
                loading={saveContact.isPending}
                onPress={() => saveContact.mutate()}
              />
            </View>
          </>
        }
      >
        <SheetField label="Nombre" value={contactName} onChangeText={setContactName} />
        <SheetField
          label="Email"
          value={contactEmail}
          onChangeText={setContactEmail}
          keyboardType="email-address"
        />
        <SheetField
          label="Teléfono"
          value={contactPhone}
          onChangeText={setContactPhone}
          keyboardType="phone-pad"
        />
        <SheetField label="Quién recibe" value={recipientName} onChangeText={setRecipientName} />
        <SheetField
          label="RUT de quien recibe"
          value={recipientTaxId}
          onChangeText={(value) => setRecipientTaxId(formatRutInput(value))}
        />
        <SheetField label="Dirección" value={deliveryAddress} onChangeText={setDeliveryAddress} />
        <ChileLocationFields
          region={deliveryRegion}
          commune={deliveryCommune}
          onChange={({ region, commune }) => {
            setDeliveryRegion(region)
            setDeliveryCommune(commune)
          }}
        />
        <SheetField label="Indicaciones" value={deliveryNotes} onChangeText={setDeliveryNotes} />
        {actionError && editingContact ? <StatusMessage message={actionError} /> : null}
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
  editIcon: { color: colors.inkSoft, fontSize: 18, fontWeight: '700', padding: 4 },
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
  shareBox: { gap: 10 },
  shareUrl: { color: colors.ink, fontSize: 14, fontWeight: '600' },
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
