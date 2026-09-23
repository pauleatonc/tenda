import { organisationHasBankDetails } from '@tenda/api-client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useState } from 'react'
import { Clipboard, Pressable, Share, StyleSheet, Text, View } from 'react-native'

import { PrimaryButton, StatusMessage, colors } from './auth-ui'
import { BankDetailsRequired } from './bank-details-required'
import { Sheet, SheetField } from './inventory-ui'
import { getMobileViewer, MobileApiError } from '../lib/auth-api'
import { canGenerateSale } from '../lib/can-generate-sale'
import { formatPrice, formatQuantity } from '../lib/format'
import { newIdempotencyKey } from '../lib/graphql'
import type { ProductCard } from '../lib/inventory-api'
import {
  createOrder,
  publishOrderLink,
  sendOfferLink,
} from '../lib/sales-api'

const METHODS = [
  {
    id: 'deposit',
    label: 'Depósito',
    description: 'El comprador transfiere y sube el comprobante.',
    enabled: true,
  },
  {
    id: 'online',
    label: 'Pago Online',
    description: 'Próximamente',
    enabled: false,
  },
  {
    id: 'cash',
    label: 'Efectivo',
    description: 'Abres la ficha para completar datos y registrar el pago.',
    enabled: true,
  },
] as const

const DELIVERY_MODES = [
  {
    id: 'shipping',
    label: 'Despacho',
    description: 'El comprador completará destinatario y dirección.',
  },
  {
    id: 'pickup',
    label: 'Retiro',
    description: 'El retiro se coordina directamente con el vendedor.',
  },
  {
    id: 'coordinated',
    label: 'Entrega coordinada',
    description: 'La fecha y el lugar se acuerdan después de la compra.',
  },
] as const

type DeliveryMode = (typeof DELIVERY_MODES)[number]['id']

export function GenerateSaleSheet({
  product,
  visible,
  onClose,
}: {
  product: ProductCard
  visible: boolean
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const viewer = useQuery({
    queryKey: ['mobile-viewer'],
    queryFn: getMobileViewer,
    enabled: visible,
    retry: false,
  })
  const hasBankDetails = viewer.data
    ? organisationHasBankDetails(viewer.data.organisation)
    : true
  const available = product.stock.available
  const [quantity, setQuantity] = useState(1)
  const [email, setEmail] = useState('')
  const [emailOpen, setEmailOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [error, setError] = useState('')
  const [createKey] = useState(newIdempotencyKey)
  const [publishKey] = useState(newIdempotencyKey)
  const [emailKey, setEmailKey] = useState(newIdempotencyKey)
  const [result, setResult] = useState<{ orderId: string; publicUrl: string } | null>(
    null,
  )
  const [confirmCash, setConfirmCash] = useState(false)
  const [method, setMethod] = useState<'deposit' | 'cash'>('deposit')
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('shipping')

  const publish = useMutation({
    mutationFn: async () => {
      const created = await createOrder({
        lines: [
          {
            productId: product.id,
            quantity,
            unitSalePrice: product.salePrice ?? '0',
          },
        ],
        deliveryMode,
        paymentMethod: 'bank_transfer',
        idempotencyKey: createKey,
      })
      const published = await publishOrderLink({
        orderId: created.order.id,
        idempotencyKey: publishKey,
      })
      return { orderId: created.order.id, publicUrl: published.publicUrl }
    },
    onSuccess: (published) => {
      setResult(published)
      setError('')
      void queryClient.invalidateQueries({ queryKey: ['inventory'] })
      void queryClient.invalidateQueries({ queryKey: ['sales'] })
    },
    onError: (mutationError: unknown) => {
      setError(
        mutationError instanceof MobileApiError
          ? mutationError.message
          : 'No pudimos generar la venta. Inténtalo otra vez.',
      )
    },
  })

  const createCash = useMutation({
    mutationFn: async () => {
      const created = await createOrder({
        lines: [
          {
            productId: product.id,
            quantity,
            unitSalePrice: product.salePrice ?? '0',
          },
        ],
        deliveryMode,
        paymentMethod: 'cash',
        idempotencyKey: createKey,
      })
      return created.order.id
    },
    onSuccess: (orderId) => {
      setError('')
      void queryClient.invalidateQueries({ queryKey: ['inventory'] })
      void queryClient.invalidateQueries({ queryKey: ['sales'] })
      onClose()
      router.push(`/ventas/${orderId}`)
    },
    onError: (mutationError: unknown) => {
      setError(
        mutationError instanceof MobileApiError
          ? mutationError.message
          : 'No pudimos crear la venta. Inténtalo otra vez.',
      )
    },
  })

  const sendEmail = useMutation({
    mutationFn: () => {
      if (!result) throw new Error('Falta el enlace.')
      return sendOfferLink({
        orderId: result.orderId,
        email: email.trim(),
        idempotencyKey: emailKey,
      })
    },
    onSuccess: () => {
      setEmailSent(true)
      setEmailOpen(false)
      setError('')
    },
    onError: (mutationError: unknown) => {
      setError(
        mutationError instanceof MobileApiError
          ? mutationError.message
          : 'No pudimos enviar el correo.',
      )
      setEmailKey(newIdempotencyKey())
    },
  })

  function closeAll() {
    setEmailOpen(false)
    setConfirmCash(false)
    onClose()
  }

  if (!canGenerateSale(product) && !result) {
    return (
      <Sheet visible={visible} title="Generar venta" onClose={onClose}>
        <Text style={styles.muted}>
          El producto debe estar activo, tener unidades disponibles y un precio de
          venta.
        </Text>
      </Sheet>
    )
  }

  return (
    <>
      <Sheet
        visible={visible && !emailOpen}
        title={
          result
            ? 'Enlace listo'
            : confirmCash
              ? 'Confirmar venta en efectivo'
              : `Generar venta · ${product.name}`
        }
        description={
          result
            ? 'Comparte el enlace. El comprador abre la ficha en el navegador.'
            : confirmCash
              ? 'Se reservará el stock y abrirás la ficha para completar los datos y registrar el pago.'
              : 'Elige entrega y tipo de venta. Depósito comparte un enlace.'
        }
        onClose={closeAll}
        footer={
          confirmCash && !result ? (
            <>
              <View style={styles.footerItem}>
                <PrimaryButton
                  label="Volver"
                  variant="secondary"
                  disabled={createCash.isPending}
                  onPress={() => setConfirmCash(false)}
                />
              </View>
              <View style={styles.footerItem}>
                <PrimaryButton
                  label={createCash.isPending ? 'Creando…' : 'Crear venta'}
                  loading={createCash.isPending}
                  onPress={() => createCash.mutate()}
                />
              </View>
            </>
          ) : undefined
        }
      >
        {error ? <StatusMessage message={error} /> : null}

        {result ? (
          <View style={styles.ready}>
            <Text selectable style={styles.url}>
              {result.publicUrl}
            </Text>
            <PrimaryButton
              label="Compartir"
              onPress={() =>
                void Share.share({
                  title: product.name,
                  message: result.publicUrl,
                  url: result.publicUrl,
                })
              }
            />
            <PrimaryButton
              label={copied ? 'Copiado' : 'Copiar'}
              variant="secondary"
              onPress={() => {
                Clipboard.setString(result.publicUrl)
                setCopied(true)
              }}
            />
            <PrimaryButton
              label="Enviar por correo"
              variant="secondary"
              onPress={() => setEmailOpen(true)}
            />
            {emailSent ? (
              <Text style={styles.muted}>Correo enviado.</Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.choose}>
            {confirmCash ? (
              <Text style={styles.price}>
                {product.name} · {formatQuantity(quantity)} ·{' '}
                {formatPrice(String(Number(product.salePrice ?? 0) * quantity))}
              </Text>
            ) : (
              <>
            <Text style={styles.sectionLabel}>Entrega</Text>
            {DELIVERY_MODES.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{ selected: deliveryMode === item.id }}
                accessibilityLabel={item.label}
                onPress={() => setDeliveryMode(item.id)}
              >
                <View
                  style={[
                    styles.method,
                    deliveryMode === item.id ? styles.methodActive : null,
                  ]}
                >
                  <Text style={styles.methodTitle}>{item.label}</Text>
                  <Text style={styles.muted}>{item.description}</Text>
                </View>
              </Pressable>
            ))}
            <Text style={styles.sectionLabel}>Pago</Text>
            {METHODS.map((item) => {
              const card = (
                <View
                  style={[
                    styles.method,
                    item.enabled && method === item.id ? styles.methodActive : null,
                  ]}
                >
                  <Text style={styles.methodTitle}>{item.label}</Text>
                  <Text style={styles.muted}>{item.description}</Text>
                </View>
              )
              if (!item.enabled) {
                return <View key={item.id}>{card}</View>
              }
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  accessibilityState={{ selected: method === item.id }}
                  onPress={() => {
                    setError('')
                    setConfirmCash(false)
                    setMethod(item.id === 'cash' ? 'cash' : 'deposit')
                  }}
                >
                  {card}
                </Pressable>
              )
            })}
            <Text style={styles.price}>
              Precio de venta: {formatPrice(product.salePrice)}
            </Text>
            {available > 1 ? (
              <View style={styles.stepper}>
                <PrimaryButton
                  label="−"
                  variant="secondary"
                  disabled={quantity <= 1}
                  onPress={() => setQuantity((current) => Math.max(1, current - 1))}
                />
                <Text style={styles.qty}>{formatQuantity(quantity)}</Text>
                <PrimaryButton
                  label="+"
                  variant="secondary"
                  disabled={quantity >= available}
                  onPress={() =>
                    setQuantity((current) => Math.min(available, current + 1))
                  }
                />
              </View>
            ) : null}
            {method === 'deposit' && hasBankDetails ? (
              <PrimaryButton
                label={publish.isPending ? 'Generando…' : 'Generar depósito'}
                loading={publish.isPending}
                onPress={() => publish.mutate()}
              />
            ) : null}
            {method === 'cash' ? (
              <PrimaryButton
                label="Continuar"
                onPress={() => {
                  setError('')
                  setConfirmCash(true)
                }}
              />
            ) : null}
            {method === 'deposit' && !hasBankDetails ? <BankDetailsRequired /> : null}
              </>
            )}
          </View>
        )}
      </Sheet>

      <Sheet
        visible={visible && emailOpen}
        title="Enviar por correo"
        onClose={() => setEmailOpen(false)}
        footer={
          <>
            <View style={styles.footerItem}>
              <PrimaryButton
                label="Volver"
                variant="secondary"
                onPress={() => setEmailOpen(false)}
              />
            </View>
            <View style={styles.footerItem}>
              <PrimaryButton
                label={sendEmail.isPending ? 'Enviando…' : 'Enviar'}
                loading={sendEmail.isPending}
                onPress={() => {
                  if (email.trim()) sendEmail.mutate()
                }}
              />
            </View>
          </>
        }
      >
        <SheetField
          label="Correo del comprador"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
      </Sheet>
    </>
  )
}

const styles = StyleSheet.create({
  muted: { color: colors.inkSoft, fontSize: 14, lineHeight: 20 },
  choose: { gap: 12 },
  sectionLabel: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
    textTransform: 'uppercase',
  },
  method: {
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
    minHeight: 72,
    padding: 16,
  },
  methodActive: { borderColor: colors.green, borderWidth: 2 },
  methodTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  price: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  stepper: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  qty: { color: colors.ink, fontSize: 22, fontWeight: '800', minWidth: 40, textAlign: 'center' },
  ready: { gap: 12 },
  url: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  footerItem: { flex: 1 },
})
