import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Clipboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { PrimaryButton, StatusMessage, colors } from '../../../components/auth-ui'
import {
  InventoryChip,
  OptionRow,
  SectionCard,
  SheetField,
} from '../../../components/inventory-ui'
import {
  deliveryModeLabels,
  formatClp,
  paymentMethodLabels,
  salesStyles,
} from '../../../components/sales-ui'
import { MobileApiError } from '../../../lib/auth-api'
import { formatPrice, formatQuantity } from '../../../lib/format'
import { isOfflineError } from '../../../lib/graphql'
import {
  fetchProducts,
  inventoryKeys,
  type ProductCard,
} from '../../../lib/inventory-api'
import {
  createOrder,
  fetchSellerPaymentConnection,
  publishOrderLink,
  salesKeys,
} from '../../../lib/sales-api'
import {
  calculateDiscountedPrice,
  clearSaleDraft,
  createEmptySaleDraft,
  createSaleDraftLine,
  loadSaleDraft,
  saveSaleDraft,
  validateSaleDraftLines,
  type SaleDraft,
  type SaleDraftLine,
  type SaleDraftStep,
} from '../../../lib/sales-draft'

const STEPS: SaleDraftStep[] = ['products', 'terms', 'review']
const STEP_LABELS: Record<SaleDraftStep, string> = {
  products: 'Productos y precios',
  terms: 'Entrega y pago',
  review: 'Revisión',
  result: 'Enlace listo',
}

function updateLine(
  draft: SaleDraft,
  lineId: string,
  update: Partial<SaleDraftLine>,
): SaleDraft {
  return {
    ...draft,
    lines: draft.lines.map((line) =>
      line.id === lineId ? { ...line, ...update } : line,
    ),
  }
}

function StepHeading({ step }: { step: SaleDraftStep }) {
  const index = step === 'result' ? 4 : STEPS.indexOf(step) + 1
  return (
    <View style={styles.stepHeading}>
      <Text style={styles.eyebrow}>
        {step === 'result' ? 'Completado' : `Paso ${index} de 3`}
      </Text>
      <Text accessibilityRole="header" style={styles.title}>
        {STEP_LABELS[step]}
      </Text>
    </View>
  )
}

function ProductSearch({
  onAdd,
}: {
  onAdd: (product: ProductCard) => void
}) {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 250)
    return () => clearTimeout(timer)
  }, [search])

  const products = useQuery({
    queryKey: inventoryKeys.products({
      filter: { search: debouncedSearch || null, catalogStatuses: ['active'] },
      salePicker: true,
    }),
    queryFn: () =>
      fetchProducts({
        filter: {
          search: debouncedSearch || null,
          catalogStatuses: ['active'],
          includeArchived: false,
        },
        first: 20,
        after: null,
      }),
  })

  return (
    <SectionCard title="Buscar producto">
      <TextInput
        accessibilityLabel="Buscar producto para la venta"
        placeholder="Nombre del producto"
        placeholderTextColor={colors.inkMuted}
        returnKeyType="search"
        style={salesStyles.search}
        value={search}
        onChangeText={setSearch}
      />
      {products.isPending ? (
        <Text style={salesStyles.muted}>Buscando productos…</Text>
      ) : products.isError ? (
        <View style={styles.inlineMessage}>
          <Text style={styles.errorText}>No pudimos cargar los productos.</Text>
          <PrimaryButton
            label="Reintentar"
            variant="secondary"
            onPress={() => void products.refetch()}
          />
        </View>
      ) : products.data.products.length ? (
        products.data.products.map((product) => (
          <View key={product.id} style={styles.productResult}>
            <View style={styles.productCopy}>
              <Text style={styles.productName}>{product.name}</Text>
              <Text style={salesStyles.muted}>
                Referencia {formatPrice(product.salePrice)}
              </Text>
              <View style={salesStyles.chips}>
                <InventoryChip
                  tone={product.stock.available > 0 ? 'available' : 'warning'}
                  label={`Disponible ${formatQuantity(product.stock.available)}`}
                />
                {product.stock.reserved > 0 ? (
                  <InventoryChip
                    tone="reserved"
                    label={`Reservado ${formatQuantity(product.stock.reserved)}`}
                  />
                ) : null}
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Agregar ${product.name}`}
              accessibilityState={{ disabled: product.stock.available <= 0 }}
              disabled={product.stock.available <= 0}
              onPress={() => onAdd(product)}
              style={[
                styles.addButton,
                product.stock.available <= 0 && styles.disabled,
              ]}
            >
              <Text style={styles.addButtonText}>Agregar</Text>
            </Pressable>
          </View>
        ))
      ) : (
        <Text style={salesStyles.muted}>No encontramos productos disponibles.</Text>
      )}
    </SectionCard>
  )
}

function DraftLineCard({
  line,
  errors,
  onChange,
  onDuplicate,
  onRemove,
}: {
  line: SaleDraftLine
  errors: string[]
  onChange: (update: Partial<SaleDraftLine>) => void
  onDuplicate: () => void
  onRemove: () => void
}) {
  return (
    <SectionCard
      title={line.productName}
      action={
        <Pressable accessibilityRole="button" onPress={onRemove}>
          <Text style={styles.removeText}>Quitar</Text>
        </Pressable>
      }
    >
      <View style={salesStyles.chips}>
        <InventoryChip
          tone="available"
          label={`Disponible ${formatQuantity(line.available)}`}
        />
        {line.reserved > 0 ? (
          <InventoryChip
            tone="reserved"
            label={`Reservado ${formatQuantity(line.reserved)}`}
          />
        ) : null}
      </View>
      <SheetField
        label={`Cantidad de ${line.productName}`}
        keyboardType="number-pad"
        value={line.quantity}
        onChangeText={(quantity) => onChange({ quantity })}
        error={errors.find((error) => error.includes('cantidad'))}
      />
      <SheetField
        label={`Precio efectivo de ${line.productName}`}
        help={`Referencia: ${formatPrice(line.referencePrice)}. Este es el precio que queda guardado en la venta.`}
        keyboardType="number-pad"
        value={line.unitSalePrice}
        onChangeText={(unitSalePrice) =>
          onChange({ unitSalePrice, discountPercent: '' })
        }
        error={errors.find((error) => error.includes('precio'))}
      />
      <SheetField
        label={`Ayuda de descuento para ${line.productName}`}
        help="Porcentaje opcional: solo calcula el precio efectivo; el porcentaje no se guarda."
        keyboardType="decimal-pad"
        placeholder="Ej. 10"
        value={line.discountPercent}
        onChangeText={(discountPercent) => {
          const calculated = calculateDiscountedPrice(
            line.referencePrice,
            discountPercent,
          )
          onChange({
            discountPercent,
            ...(calculated === null ? {} : { unitSalePrice: calculated }),
          })
        }}
      />
      <PrimaryButton
        label="Agregar otra línea de precio"
        variant="secondary"
        onPress={onDuplicate}
      />
    </SectionCard>
  )
}

export default function NewSaleScreen() {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<SaleDraft>(createEmptySaleDraft)
  const [hydrated, setHydrated] = useState(false)
  const [apiError, setApiError] = useState<MobileApiError | null>(null)
  const submitLock = useRef(false)

  useEffect(() => {
    let active = true
    void loadSaleDraft().then((stored) => {
      if (!active) return
      setDraft(stored)
      setHydrated(true)
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    void saveSaleDraft(draft)
  }, [draft, hydrated])

  const paymentConnection = useQuery({
    queryKey: salesKeys.paymentConnection(),
    queryFn: fetchSellerPaymentConnection,
  })
  const mercadoPagoActive =
    paymentConnection.data?.sellerPaymentConnection?.status === 'connected'

  const validation = useMemo(
    () => validateSaleDraftLines(draft.lines),
    [draft.lines],
  )
  const total = useMemo(
    () =>
      draft.lines.reduce((sum, line) => {
        const quantity = Number(line.quantity)
        const price = Number(line.unitSalePrice)
        return sum + (Number.isFinite(quantity) && Number.isFinite(price)
          ? quantity * price
          : 0)
      }, 0),
    [draft.lines],
  )

  const submit = useMutation({
    mutationFn: async () => {
      const created = await createOrder({
        lines: draft.lines.map((line) => ({
          productId: line.productId,
          quantity: Number(line.quantity),
          unitSalePrice: line.unitSalePrice,
        })),
        deliveryMode: draft.deliveryMode,
        paymentMethod: draft.paymentMethod,
        idempotencyKey: draft.idempotencyKey,
      })
      return publishOrderLink({
        orderId: created.order.id,
        idempotencyKey: draft.idempotencyKey,
      })
    },
    onSuccess: (published) => {
      setApiError(null)
      setDraft((current) => ({
        ...current,
        step: 'result',
        result: {
          orderId: published.order.id,
          orderNumber: published.order.number,
          publicUrl: published.publicUrl,
        },
      }))
      void queryClient.invalidateQueries({ queryKey: salesKeys.root })
    },
    onError: (error: unknown) => {
      if (error instanceof MobileApiError) setApiError(error)
    },
    onSettled: () => {
      submitLock.current = false
    },
  })

  function addProduct(product: ProductCard) {
    setDraft((current) => ({
      ...current,
      lines: [...current.lines, createSaleDraftLine(product)],
    }))
  }

  function goNext() {
    setApiError(null)
    if (draft.step === 'products') {
      if (!validation.valid) return
      setDraft((current) => ({ ...current, step: 'terms' }))
      return
    }
    if (draft.step === 'terms') {
      setDraft((current) => ({ ...current, step: 'review' }))
    }
  }

  function goBack() {
    if (draft.step === 'terms') {
      setDraft((current) => ({ ...current, step: 'products' }))
    } else if (draft.step === 'review') {
      setDraft((current) => ({ ...current, step: 'terms' }))
    } else {
      router.back()
    }
  }

  if (!hydrated) {
    return (
      <SafeAreaView style={salesStyles.safeArea}>
        <Text accessibilityLiveRegion="polite" style={styles.loading}>
          Recuperando borrador…
        </Text>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={salesStyles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={salesStyles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.topBar}>
            <StepHeading step={draft.step} />
            {draft.step !== 'result' ? (
              <Pressable accessibilityRole="button" onPress={() => router.back()}>
                <Text style={styles.close}>Cerrar</Text>
              </Pressable>
            ) : null}
          </View>

          {apiError ? (
            <>
              <StatusMessage message={apiError.message} />
              {isOfflineError(apiError) ? (
                <Text style={salesStyles.muted}>
                  No encolamos la venta. El borrador y su clave de reintento siguen
                  guardados en este dispositivo.
                </Text>
              ) : null}
            </>
          ) : null}

          {draft.step === 'products' ? (
            <>
              <Text style={salesStyles.muted}>
                Puedes repetir un producto en líneas separadas si cada grupo tiene un
                precio distinto. La disponibilidad se valida sumando todas sus líneas.
              </Text>
              <ProductSearch onAdd={addProduct} />
              {draft.lines.map((line) => (
                <DraftLineCard
                  key={line.id}
                  line={line}
                  errors={validation.lineErrors[line.id] ?? []}
                  onChange={(update) =>
                    setDraft((current) => updateLine(current, line.id, update))
                  }
                  onDuplicate={() =>
                    setDraft((current) => ({
                      ...current,
                      lines: [
                        ...current.lines,
                        {
                          ...line,
                          id: createSaleDraftLine({
                            id: line.productId,
                            name: line.productName,
                            salePrice: line.referencePrice,
                            stock: {
                              available: line.available,
                              reserved: line.reserved,
                            },
                          }).id,
                          quantity: '1',
                          discountPercent: '',
                        },
                      ],
                    }))
                  }
                  onRemove={() =>
                    setDraft((current) => ({
                      ...current,
                      lines: current.lines.filter((item) => item.id !== line.id),
                    }))
                  }
                />
              ))}
              {Object.values(validation.productErrors).map((message) => (
                <StatusMessage key={message} message={message} />
              ))}
              {!draft.lines.length ? (
                <StatusMessage message="Agrega al menos un producto para continuar." />
              ) : null}
              <PrimaryButton
                label="Continuar a entrega y pago"
                disabled={!validation.valid}
                onPress={goNext}
              />
            </>
          ) : null}

          {draft.step === 'terms' ? (
            <>
              <SectionCard title="Entrega">
                <OptionRow
                  label="Modo de entrega"
                  value={draft.deliveryMode}
                  onChange={(deliveryMode) =>
                    setDraft((current) => ({ ...current, deliveryMode }))
                  }
                  options={[
                    { value: 'shipping', label: deliveryModeLabels.shipping },
                    { value: 'pickup', label: deliveryModeLabels.pickup },
                  ]}
                />
              </SectionCard>
              <SectionCard title="Pago">
                <OptionRow
                  label="Método de pago"
                  value={draft.paymentMethod}
                  onChange={(paymentMethod) =>
                    setDraft((current) => ({ ...current, paymentMethod }))
                  }
                  options={[
                    {
                      value: 'bank_transfer',
                      label: paymentMethodLabels.bank_transfer,
                    },
                    { value: 'cash', label: paymentMethodLabels.cash },
                    {
                      value: 'mercado_pago',
                      label: paymentMethodLabels.mercado_pago,
                      disabled: !mercadoPagoActive,
                      hint: mercadoPagoActive
                        ? undefined
                        : 'Conecta la cuenta del negocio en Más, Pagos.',
                    },
                  ]}
                />
                {!mercadoPagoActive ? (
                  <Text style={salesStyles.muted}>
                    Mercado Pago está desactivado hasta que el Owner conecte una cuenta
                    activa en Más › Pagos.
                  </Text>
                ) : null}
              </SectionCard>
              <View accessibilityRole="summary" style={styles.reserveNotice}>
                <Text style={styles.reserveTitle}>Reserva por 8 horas</Text>
                <Text style={salesStyles.muted}>
                  Al crear la venta, Tenda reserva el stock durante ocho horas mientras
                  el comprador completa el pago. Si vence, la disponibilidad se libera.
                </Text>
              </View>
              <View style={salesStyles.actions}>
                <PrimaryButton label="Revisar venta" onPress={goNext} />
                <PrimaryButton label="Volver" variant="secondary" onPress={goBack} />
              </View>
            </>
          ) : null}

          {draft.step === 'review' ? (
            <>
              <SectionCard title="Productos">
                {draft.lines.map((line) => (
                  <View key={line.id} style={styles.reviewLine}>
                    <View style={styles.productCopy}>
                      <Text style={styles.productName}>{line.productName}</Text>
                      <Text style={salesStyles.muted}>
                        {line.quantity} × {formatClp(line.unitSalePrice)}
                      </Text>
                    </View>
                    <Text style={styles.reviewAmount}>
                      {formatClp(
                        String(Number(line.quantity) * Number(line.unitSalePrice)),
                      )}
                    </Text>
                  </View>
                ))}
              </SectionCard>
              <SectionCard title="Condiciones">
                <Text style={styles.reviewDetail}>
                  {deliveryModeLabels[draft.deliveryMode]}
                </Text>
                <Text style={styles.reviewDetail}>
                  {paymentMethodLabels[draft.paymentMethod]}
                </Text>
                <Text style={styles.total}>Total {formatClp(String(total))}</Text>
              </SectionCard>
              <Text style={salesStyles.muted}>
                Crear reserva stock y publica un enlace opaco. No se enviará a ningún
                contacto automáticamente.
              </Text>
              <View style={salesStyles.actions}>
                <PrimaryButton
                  label="Crear venta y enlace"
                  loading={submit.isPending}
                  onPress={() => {
                    if (submitLock.current || submit.isPending) return
                    submitLock.current = true
                    setApiError(null)
                    submit.mutate()
                  }}
                />
                <PrimaryButton label="Volver" variant="secondary" onPress={goBack} />
              </View>
            </>
          ) : null}

          {draft.step === 'result' && draft.result ? (
            <>
              <View accessibilityRole="summary" style={styles.result}>
                <Text style={styles.resultIcon}>✓</Text>
                <Text style={styles.resultTitle}>
                  Venta {draft.result.orderNumber} creada
                </Text>
                <Text selectable style={styles.publicUrl}>
                  {draft.result.publicUrl}
                </Text>
              </View>
              <View style={salesStyles.actions}>
                <PrimaryButton
                  label="Compartir"
                  onPress={() =>
                    void Share.share({
                      title: `Venta ${draft.result?.orderNumber ?? ''}`,
                      message: draft.result?.publicUrl ?? '',
                      url: draft.result?.publicUrl,
                    })
                  }
                />
                <PrimaryButton
                  label="Copiar enlace"
                  variant="secondary"
                  onPress={() => {
                    if (draft.result) Clipboard.setString(draft.result.publicUrl)
                  }}
                />
                <PrimaryButton
                  label="Vista previa"
                  variant="secondary"
                  onPress={() => {
                    if (draft.result) void Linking.openURL(draft.result.publicUrl)
                  }}
                />
                <PrimaryButton
                  label="Ver detalle de la venta"
                  variant="secondary"
                  onPress={() => router.replace(`/ventas/${draft.result?.orderId ?? ''}`)}
                />
                <PrimaryButton
                  label="Crear otra venta"
                  variant="secondary"
                  onPress={() => {
                    void clearSaleDraft()
                    setDraft(createEmptySaleDraft())
                    setApiError(null)
                  }}
                />
              </View>
              <Text style={salesStyles.muted}>
                El enlace solo se comparte cuando eliges Compartir o Copiar. Tenda no
                contacta automáticamente al comprador.
              </Text>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { color: colors.inkSoft, padding: 24 },
  topBar: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  stepHeading: { flex: 1, gap: 6 },
  eyebrow: {
    color: colors.green,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: { color: colors.ink, fontSize: 28, fontWeight: '800', letterSpacing: -1 },
  close: { color: colors.green, fontSize: 14, fontWeight: '800', paddingVertical: 10 },
  inlineMessage: { gap: 10 },
  errorText: { color: colors.error, fontSize: 14 },
  productResult: {
    alignItems: 'center',
    borderTopColor: colors.line,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingTop: 14,
  },
  productCopy: { flex: 1, gap: 5 },
  productName: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  addButton: {
    alignItems: 'center',
    borderColor: colors.green,
    borderRadius: 11,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 13,
  },
  addButtonText: { color: colors.green, fontSize: 13, fontWeight: '800' },
  disabled: { opacity: 0.45 },
  removeText: { color: colors.error, fontSize: 13, fontWeight: '800' },
  reserveNotice: {
    backgroundColor: '#f4e5b7',
    borderColor: '#e3ce86',
    borderRadius: 16,
    borderWidth: 1,
    gap: 7,
    padding: 16,
  },
  reserveTitle: { color: '#765c17', fontSize: 16, fontWeight: '800' },
  reviewLine: {
    alignItems: 'center',
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 12,
  },
  reviewAmount: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  reviewDetail: { color: colors.ink, fontSize: 15, lineHeight: 21 },
  total: { color: colors.ink, fontSize: 19, fontWeight: '800', marginTop: 4 },
  result: {
    alignItems: 'center',
    backgroundColor: colors.greenPale,
    borderColor: '#c2dbd1',
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
    padding: 24,
  },
  resultIcon: { color: colors.green, fontSize: 34, fontWeight: '800' },
  resultTitle: {
    color: colors.ink,
    fontSize: 21,
    fontWeight: '800',
    textAlign: 'center',
  },
  publicUrl: { color: colors.green, fontSize: 14, lineHeight: 20, textAlign: 'center' },
})
