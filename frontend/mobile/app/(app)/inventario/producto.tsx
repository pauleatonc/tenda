import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { PrimaryButton, StatusMessage, colors } from '../../../components/auth-ui'
import { CustomFieldSheet } from '../../../components/custom-field-sheet'
import { OptionRow, SectionCard, SheetField } from '../../../components/inventory-ui'
import { MobileApiError } from '../../../lib/auth-api'
import { catalogStatusLabels } from '../../../lib/format'
import { isOfflineError, newIdempotencyKey } from '../../../lib/graphql'
import {
  createProduct,
  fetchInventorySchema,
  fetchProductDetail,
  inventoryKeys,
  updateProduct,
  type CustomField,
} from '../../../lib/inventory-api'

function isBlank(value: string | undefined): boolean {
  return value === undefined || value.trim() === ''
}

/** Prices are CLP: integral, non-negative and `null` when left empty. */
function parsePrice(value: string): { ok: boolean; value: string | null } {
  if (isBlank(value)) return { ok: true, value: null }
  const numeric = Number(value.replace(',', '.'))
  if (!Number.isInteger(numeric) || numeric < 0) return { ok: false, value: null }
  return { ok: true, value: String(numeric) }
}

function attributeToDraft(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

function coerceAttribute(field: CustomField, raw: string): unknown {
  if (isBlank(raw)) return null
  if (field.fieldType === 'boolean') return raw === 'true'
  return raw.trim()
}

/**
 * V1-INV-03 on the phone: one column, one field per row and the keyboard that
 * matches each value. Creating a column never discards what is already typed.
 */
export default function ProductFormScreen() {
  const params = useLocalSearchParams<{ id?: string }>()
  const productId = typeof params.id === 'string' ? params.id : undefined
  const isEdit = Boolean(productId)
  const queryClient = useQueryClient()

  const [name, setName] = useState('')
  const [catalogStatus, setCatalogStatus] = useState('active')
  const [initialQuantity, setInitialQuantity] = useState('')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [attributes, setAttributes] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [apiError, setApiError] = useState<MobileApiError | null>(null)
  const [columnSheetOpen, setColumnSheetOpen] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey)

  const inputRefs = useRef<Record<string, TextInput | null>>({})

  const schema = useQuery({
    queryKey: inventoryKeys.schema(),
    queryFn: () => fetchInventorySchema(false),
  })

  const product = useQuery({
    queryKey: inventoryKeys.product(productId ?? ''),
    queryFn: () => fetchProductDetail(productId ?? ''),
    enabled: isEdit,
  })

  // Hydrate once when the product arrives; from then on the draft wins.
  const loaded = useRef(false)
  useEffect(() => {
    if (!isEdit || loaded.current || !product.data) return
    loaded.current = true
    const detail = product.data.product
    setName(detail.name)
    setCatalogStatus(detail.catalogStatus)
    setPurchasePrice(detail.purchasePrice ?? '')
    setSalePrice(detail.salePrice ?? '')
    setAttributes(
      Object.fromEntries(
        Object.entries(detail.extraAttributes).map(([key, value]) => [
          key,
          attributeToDraft(value),
        ]),
      ),
    )
  }, [isEdit, product.data])

  const fields = useMemo(
    () => (schema.data?.fields ?? []).filter((field) => field.isActive),
    [schema.data],
  )
  const activeCount = fields.length
  const maxActiveFields = schema.data?.maxActiveFields ?? 15

  function focusFirstError(nextErrors: Record<string, string | undefined>) {
    const order = ['name', 'initialQuantity', 'purchasePrice', 'salePrice']
    const dynamic = fields.map((field) => `extraAttributes.${field.key}`)
    const firstKey = [...order, ...dynamic].find((key) => nextErrors[key])
    if (firstKey) inputRefs.current[firstKey]?.focus()
  }

  const save = useMutation({
    mutationFn: async () => {
      const extraAttributes: Record<string, unknown> = {}
      for (const field of fields) {
        const value = coerceAttribute(field, attributes[field.key] ?? '')
        if (value !== null) extraAttributes[field.key] = value
      }
      const purchase = parsePrice(purchasePrice)
      const sale = parsePrice(salePrice)
      if (isEdit && productId) {
        return updateProduct({
          productId,
          name: name.trim(),
          catalogStatus,
          purchasePrice: purchase.value,
          salePrice: sale.value,
          clearPurchasePrice: purchase.value === null,
          clearSalePrice: sale.value === null,
          extraAttributes,
        })
      }
      const created = await createProduct({
        name: name.trim(),
        catalogStatus,
        purchasePrice: purchase.value,
        salePrice: sale.value,
        initialQuantity: isBlank(initialQuantity) ? 0 : Number(initialQuantity),
        reason: 'Carga inicial',
        extraAttributes,
        idempotencyKey,
      })
      return created.product
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ['inventory'] })
      setDirty(false)
      router.replace(`/inventario/${saved.id}`)
    },
    onError: (error: unknown) => {
      if (!(error instanceof MobileApiError)) {
        setApiError(null)
        return
      }
      setApiError(error)
      const fieldErrors = Object.fromEntries(
        Object.entries(error.fieldErrors).map(([field, messages]) => [
          field,
          messages[0],
        ]),
      )
      setErrors(fieldErrors)
      focusFirstError(fieldErrors)
      // A rejected submission gets a fresh key so a corrected retry is accepted.
      // Offline keeps the same key: nothing reached the server and nothing is queued.
      if (!isOfflineError(error)) setIdempotencyKey(newIdempotencyKey())
    },
  })

  function validate(): boolean {
    const nextErrors: Record<string, string | undefined> = {}
    if (isBlank(name)) nextErrors.name = 'Escribe el nombre del producto.'
    if (!parsePrice(purchasePrice).ok) {
      nextErrors.purchasePrice = 'Usa un monto entero en pesos, sin decimales.'
    }
    if (!parsePrice(salePrice).ok) {
      nextErrors.salePrice = 'Usa un monto entero en pesos, sin decimales.'
    }
    if (!isEdit && !isBlank(initialQuantity)) {
      const quantity = Number(initialQuantity)
      if (!Number.isInteger(quantity) || quantity < 0) {
        nextErrors.initialQuantity = 'Ingresa una cantidad entera de 0 o más.'
      }
    }
    for (const field of fields) {
      if (field.isRequired && isBlank(attributes[field.key])) {
        nextErrors[`extraAttributes.${field.key}`] = `Completa ${field.label}.`
      }
    }
    setErrors(nextErrors)
    const invalid = Object.keys(nextErrors).length > 0
    if (invalid) focusFirstError(nextErrors)
    return !invalid
  }

  function leave() {
    if (!dirty) {
      router.back()
      return
    }
    Alert.alert('Tienes cambios sin guardar', '¿Quieres salir y descartarlos?', [
      { text: 'Seguir editando', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: () => router.back() },
    ])
  }

  if (isEdit && product.isPending) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Text accessibilityLiveRegion="polite" style={styles.loading}>
          Cargando producto…
        </Text>
      </SafeAreaView>
    )
  }

  if (isEdit && !product.data) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.notFound}>
          <Text accessibilityRole="header" style={styles.title}>
            Producto no encontrado
          </Text>
          <Text style={styles.muted}>
            El producto no existe o pertenece a otra organización.
          </Text>
          <PrimaryButton label="Volver al inventario" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    )
  }

  const errorList = Object.values(errors).filter(Boolean) as string[]

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.heading}>
            <Text style={styles.eyebrow}>Inventario</Text>
            <Text accessibilityRole="header" style={styles.title}>
              {isEdit ? 'Editar producto' : 'Nuevo producto'}
            </Text>
            <Text style={styles.muted}>
              {isEdit
                ? 'Editar no cambia el stock: los cambios de cantidad se registran como movimiento.'
                : 'Registra el mínimo necesario. Puedes ampliar la ficha con columnas propias.'}
            </Text>
          </View>

          {errorList.length ? (
            <View accessibilityRole="alert" style={styles.summary}>
              <Text style={styles.summaryTitle}>Revisa estos datos</Text>
              {errorList.map((message) => (
                <Text key={message} style={styles.summaryItem}>
                  • {message}
                </Text>
              ))}
            </View>
          ) : null}
          {apiError ? <StatusMessage message={apiError.message} /> : null}

          <SectionCard title="Datos básicos">
            <SheetField
              label="Nombre"
              value={name}
              maxLength={160}
              onChangeText={(value) => {
                setName(value)
                setDirty(true)
              }}
              error={errors.name}
              ref={(node: TextInput | null) => {
                inputRefs.current.name = node
              }}
            />

            {!isEdit ? (
              <SheetField
                label="Cantidad inicial"
                help="Se registra como una entrada inicial en el historial."
                keyboardType="number-pad"
                value={initialQuantity}
                onChangeText={(value) => {
                  setInitialQuantity(value)
                  setDirty(true)
                }}
                error={errors.initialQuantity}
                ref={(node: TextInput | null) => {
                  inputRefs.current.initialQuantity = node
                }}
              />
            ) : null}

            <OptionRow
              label="Estado de catálogo"
              value={catalogStatus}
              onChange={(value) => {
                setCatalogStatus(value)
                setDirty(true)
              }}
              options={['active', 'inactive'].map((status) => ({
                value: status,
                label: catalogStatusLabels[status],
              }))}
            />
          </SectionCard>

          <SectionCard title="Precios de referencia">
            <Text style={styles.muted}>
              El precio efectivo se define en cada venta y puede variar entre unidades.
              Moneda: CLP.
            </Text>
            <SheetField
              label="Precio de compra"
              help="Déjalo vacío si aún no lo defines."
              keyboardType="number-pad"
              value={purchasePrice}
              onChangeText={(value) => {
                setPurchasePrice(value)
                setDirty(true)
              }}
              error={errors.purchasePrice}
              ref={(node: TextInput | null) => {
                inputRefs.current.purchasePrice = node
              }}
            />
            <SheetField
              label="Precio de venta"
              keyboardType="number-pad"
              value={salePrice}
              onChangeText={(value) => {
                setSalePrice(value)
                setDirty(true)
              }}
              error={errors.salePrice}
              ref={(node: TextInput | null) => {
                inputRefs.current.salePrice = node
              }}
            />
          </SectionCard>

          <SectionCard title="Datos adicionales">
            {!fields.length ? (
              <Text style={styles.muted}>
                Todavía no defines columnas propias para este inventario.
              </Text>
            ) : null}
            {fields.map((field) => {
              const errorKey = `extraAttributes.${field.key}`
              const value = attributes[field.key] ?? ''
              const update = (next: string) => {
                setAttributes((current) => ({ ...current, [field.key]: next }))
                setDirty(true)
              }
              if (field.fieldType === 'boolean' || field.fieldType === 'single_select') {
                const options =
                  field.fieldType === 'boolean'
                    ? [
                        { value: 'true', label: 'Sí' },
                        { value: 'false', label: 'No' },
                      ]
                    : field.options.map((option) => ({
                        value: option.key,
                        label: option.label,
                      }))
                return (
                  <OptionRow
                    key={field.id}
                    label={`${field.label}${field.isRequired ? ' *' : ''}`}
                    value={value}
                    onChange={update}
                    options={options}
                    error={errors[errorKey]}
                  />
                )
              }
              return (
                <SheetField
                  key={field.id}
                  label={`${field.label}${field.isRequired ? ' *' : ''}`}
                  help={field.helpText || undefined}
                  keyboardType={field.fieldType === 'decimal' ? 'decimal-pad' : 'default'}
                  placeholder={field.fieldType === 'date' ? 'AAAA-MM-DD' : undefined}
                  value={value}
                  onChangeText={update}
                  error={errors[errorKey]}
                  ref={(node: TextInput | null) => {
                    inputRefs.current[errorKey] = node
                  }}
                />
              )
            })}
            <PrimaryButton
              label="Agregar columna"
              variant="secondary"
              onPress={() => setColumnSheetOpen(true)}
            />
          </SectionCard>

          <SectionCard title="Fotos">
            <Text style={styles.muted}>
              La carga de fotos se habilita junto con el almacenamiento de media del
              inventario.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Usar asistente con foto"
              accessibilityState={{ disabled: true }}
              accessibilityHint="Próximamente: el asistente con foto aún no está disponible."
              disabled
              style={styles.assistant}
            >
              <Text style={styles.assistantText}>Usar asistente con foto</Text>
              <Text style={styles.assistantBadge}>Próximamente</Text>
            </Pressable>
            <Text style={styles.muted}>
              Próximamente: el asistente con foto aún no está disponible.
            </Text>
          </SectionCard>

          <View style={styles.actions}>
            <PrimaryButton
              label={isEdit ? 'Guardar cambios' : 'Crear producto'}
              loading={save.isPending}
              onPress={() => {
                setApiError(null)
                if (!validate()) return
                save.mutate()
              }}
            />
            <PrimaryButton label="Cancelar" variant="secondary" onPress={leave} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <CustomFieldSheet
        visible={columnSheetOpen}
        activeCount={activeCount}
        maxActiveFields={maxActiveFields}
        onClose={() => setColumnSheetOpen(false)}
        onCreated={(field) => {
          // The draft survives: only the new key is seeded, by key, not position.
          setAttributes((current) => ({ ...current, [field.key]: '' }))
        }}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { backgroundColor: colors.paper, flex: 1 },
  content: { gap: 18, padding: 20, paddingBottom: 48 },
  heading: { gap: 6 },
  eyebrow: {
    color: colors.green,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: { color: colors.ink, fontSize: 28, fontWeight: '800', letterSpacing: -1 },
  muted: { color: colors.inkSoft, fontSize: 14, lineHeight: 20 },
  loading: { color: colors.inkSoft, padding: 24 },
  notFound: { gap: 14, padding: 24 },
  summary: {
    backgroundColor: colors.errorPale,
    borderColor: '#edc6bc',
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
    padding: 16,
  },
  summaryTitle: { color: colors.error, fontSize: 15, fontWeight: '800' },
  summaryItem: { color: colors.error, fontSize: 14, lineHeight: 20 },
  actions: { gap: 12 },
  assistant: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: 12,
    borderStyle: 'dashed',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    minHeight: 52,
    opacity: 0.6,
    paddingHorizontal: 16,
  },
  assistantText: { color: colors.inkSoft, fontSize: 15, fontWeight: '700' },
  assistantBadge: {
    backgroundColor: '#eceae3',
    borderRadius: 999,
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
})
