import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { MobileEmptyState } from '../../../components/app-ui'
import { PrimaryButton, StatusMessage, colors } from '../../../components/auth-ui'
import { InventoryChip, SectionCard } from '../../../components/inventory-ui'
import { MobileProductMedia } from '../../../components/product-media'
import { StockAdjustSheet } from '../../../components/stock-adjust-sheet'
import { MobileApiError } from '../../../lib/auth-api'
import {
  catalogStatusLabels,
  formatAttribute,
  formatDate,
  formatPrice,
  formatQuantity,
  formatSignedQuantity,
  movementLabels,
} from '../../../lib/format'
import {
  archiveProduct,
  fetchInventorySchema,
  fetchProductDetail,
  fetchProductMovements,
  inventoryKeys,
  restoreProduct,
} from '../../../lib/inventory-api'

/** V1-INV-04 on the phone: stacked sections instead of the web tabs. */
export default function ProductDetailScreen() {
  const params = useLocalSearchParams<{ productId: string }>()
  const productId = typeof params.productId === 'string' ? params.productId : ''
  const queryClient = useQueryClient()
  const [adjusting, setAdjusting] = useState(false)
  const [actionError, setActionError] = useState<MobileApiError | null>(null)

  const detail = useQuery({
    queryKey: inventoryKeys.product(productId),
    queryFn: () => fetchProductDetail(productId),
    enabled: Boolean(productId),
  })

  const schema = useQuery({
    queryKey: inventoryKeys.schema(),
    queryFn: () => fetchInventorySchema(true),
  })

  const movements = useQuery({
    queryKey: inventoryKeys.movements(productId),
    queryFn: () => fetchProductMovements(productId),
    enabled: Boolean(productId),
  })

  function refreshInventory() {
    void queryClient.invalidateQueries({ queryKey: ['inventory'] })
  }

  const archive = useMutation({
    mutationFn: () => archiveProduct(productId),
    onSuccess: () => {
      setActionError(null)
      refreshInventory()
    },
    onError: (error: unknown) => {
      setActionError(error instanceof MobileApiError ? error : null)
    },
  })

  const restore = useMutation({
    mutationFn: () => restoreProduct(productId),
    onSuccess: () => {
      setActionError(null)
      refreshInventory()
    },
    onError: (error: unknown) => {
      setActionError(error instanceof MobileApiError ? error : null)
    },
  })

  if (detail.isPending) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Text accessibilityLiveRegion="polite" style={styles.loading}>
          Cargando producto…
        </Text>
      </SafeAreaView>
    )
  }

  if (detail.isError || !detail.data) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.padded}>
          <MobileEmptyState
            title={
              detail.isError ? 'No pudimos cargar el producto' : 'Producto no encontrado'
            }
            description={
              detail.error instanceof MobileApiError
                ? detail.error.message
                : 'El producto no existe o pertenece a otra organización.'
            }
            action={
              <PrimaryButton
                label={detail.isError ? 'Reintentar' : 'Volver al inventario'}
                onPress={() =>
                  detail.isError ? void detail.refetch() : router.replace('/inventario')
                }
              />
            }
          />
        </View>
      </SafeAreaView>
    )
  }

  const { product, breakdown, orders, shipments } = detail.data
  const archived = product.catalogStatus === 'archived'
  const fields = (schema.data?.fields ?? []).filter((field) => field.isActive)

  function confirmArchive() {
    if (product.stock.reserved > 0 || product.stock.activeFulfilment > 0) {
      Alert.alert(
        'No se puede archivar',
        'El producto tiene reservas o ventas activas. Resuélvelas antes de archivarlo.',
      )
      return
    }
    Alert.alert(
      'Archivar producto',
      'El historial y los movimientos se conservan. Podrás reactivarlo cuando quieras.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Archivar',
          style: 'destructive',
          onPress: () => archive.mutate(),
        },
      ],
    )
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>Inventario</Text>
          <Text accessibilityRole="header" style={styles.title}>
            {product.name}
          </Text>
          <View style={styles.chips}>
            {product.stock.available > 0 ? (
              <InventoryChip
                tone="available"
                label={`Disponible ${formatQuantity(product.stock.available)}`}
              />
            ) : (
              <InventoryChip tone="warning" label="Sin unidades disponibles" />
            )}
            {product.stock.reserved > 0 ? (
              <InventoryChip
                tone="reserved"
                label={`Reservado ${formatQuantity(product.stock.reserved)}`}
              />
            ) : null}
            {product.stock.activeFulfilment > 0 ? (
              <InventoryChip
                tone="neutral"
                label={`En proceso ${formatQuantity(product.stock.activeFulfilment)}`}
              />
            ) : null}
            <InventoryChip
              tone="neutral"
              label={catalogStatusLabels[product.catalogStatus] ?? product.catalogStatus}
            />
          </View>
        </View>

        {actionError ? <StatusMessage message={actionError.message} /> : null}

        <View style={styles.actions}>
          <PrimaryButton
            label="Editar"
            variant="secondary"
            onPress={() => router.push(`/inventario/producto?id=${product.id}`)}
          />
          <PrimaryButton label="Ajustar stock" onPress={() => setAdjusting(true)} />
          {archived ? (
            <PrimaryButton
              label="Reactivar"
              variant="secondary"
              loading={restore.isPending}
              onPress={() => restore.mutate()}
            />
          ) : (
            <PrimaryButton
              label="Archivar"
              variant="secondary"
              loading={archive.isPending}
              onPress={confirmArchive}
            />
          )}
        </View>

        <SectionCard title="Resumen">
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.label}>Total en inventario</Text>
              <Text style={styles.value}>{formatQuantity(product.stock.onHand)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.label}>Precio de venta</Text>
              <Text style={styles.value}>{formatPrice(product.salePrice)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.label}>Precio de compra</Text>
              <Text style={styles.value}>{formatPrice(product.purchasePrice)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.label}>Creado</Text>
              <Text style={styles.value}>{formatDate(product.createdAt)}</Text>
            </View>
          </View>
          {fields.length ? (
            <View style={styles.attributes}>
              {fields.map((field) => (
                <View key={field.id} style={styles.attributeRow}>
                  <Text style={styles.label}>{field.label}</Text>
                  <Text style={styles.attributeValue}>
                    {formatAttribute(product.extraAttributes[field.key])}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </SectionCard>

        <MobileProductMedia
          productId={product.id}
          media={product.media}
          archived={archived}
        />

        <SectionCard title="Disponibilidad y operaciones activas">
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Unidades disponibles</Text>
            <Text style={styles.value}>{formatQuantity(breakdown.available)}</Text>
          </View>
          {breakdown.lines.map((line) => (
            <View key={`${line.kind}-${line.referenceId}`} style={styles.rowBetween}>
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>{line.label}</Text>
                <Text style={styles.muted}>
                  {[line.buyerName, formatPrice(line.effectivePrice), line.status]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              <Text style={styles.value}>{formatQuantity(line.quantity)}</Text>
            </View>
          ))}
          {!breakdown.lines.length ? (
            <Text style={styles.muted}>No hay reservas ni ventas activas.</Text>
          ) : null}
        </SectionCard>

        <SectionCard title="Movimientos">
          {movements.isPending ? (
            <Text style={styles.muted}>Cargando historial…</Text>
          ) : null}
          {movements.data?.nodes.map((movement) => (
            <View key={movement.id} style={styles.movement}>
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>
                  {movementLabels[movement.movementType] ?? movement.movementType}
                </Text>
                <Text style={styles.muted}>
                  {formatDate(movement.createdAt)} · {movement.actorName || 'Sistema'}
                </Text>
                {movement.reason ? (
                  <Text style={styles.muted}>{movement.reason}</Text>
                ) : null}
              </View>
              <View style={styles.movementNumbers}>
                <Text style={styles.value}>
                  {formatSignedQuantity(movement.quantity)}
                </Text>
                <Text style={styles.muted}>
                  Saldo {formatQuantity(movement.balanceAfter)}
                </Text>
              </View>
            </View>
          ))}
          {movements.data && !movements.data.nodes.length ? (
            <Text style={styles.muted}>Todavía no hay movimientos registrados.</Text>
          ) : null}
        </SectionCard>

        <SectionCard title="Ventas relacionadas">
          <Text style={styles.muted}>
            {orders.totalCount > 0
              ? `${orders.totalCount} ventas asociadas.`
              : 'Aparecerán cuando el módulo de ventas registre operaciones.'}
          </Text>
        </SectionCard>

        <SectionCard title="Despachos relacionados">
          <Text style={styles.muted}>
            {shipments.totalCount > 0
              ? `${shipments.totalCount} despachos asociados.`
              : 'Aparecerán cuando el módulo de despachos registre entregas.'}
          </Text>
        </SectionCard>
      </ScrollView>

      <StockAdjustSheet
        product={product}
        visible={adjusting}
        onClose={() => setAdjusting(false)}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.paper, flex: 1 },
  content: { gap: 16, padding: 20, paddingBottom: 48 },
  padded: { padding: 20 },
  loading: { color: colors.inkSoft, padding: 24 },
  heading: { gap: 8 },
  eyebrow: {
    color: colors.green,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: { color: colors.ink, fontSize: 28, fontWeight: '800', letterSpacing: -1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actions: { gap: 10 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  summaryItem: { gap: 3, minWidth: '44%' },
  label: { color: colors.inkSoft, fontSize: 13 },
  value: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  attributes: { borderTopColor: colors.line, borderTopWidth: 1, gap: 10, paddingTop: 12 },
  attributeRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  attributeValue: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  rowBetween: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  rowCopy: { flex: 1, gap: 2 },
  rowTitle: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  muted: { color: colors.inkSoft, fontSize: 13, lineHeight: 19 },
  movement: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingTop: 12,
  },
  movementNumbers: { alignItems: 'flex-end', gap: 2 },
})
