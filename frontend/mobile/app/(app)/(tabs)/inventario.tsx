import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Link, router } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { MobileEmptyState } from '../../../components/app-ui'
import { PrimaryButton, colors } from '../../../components/auth-ui'
import { InventoryChip, Sheet } from '../../../components/inventory-ui'
import { StockAdjustSheet } from '../../../components/stock-adjust-sheet'
import { MobileApiError } from '../../../lib/auth-api'
import { catalogStatusLabels, formatPrice, formatQuantity } from '../../../lib/format'
import {
  fetchProductBreakdown,
  fetchProducts,
  inventoryKeys,
  type ProductCard,
} from '../../../lib/inventory-api'

const PAGE_SIZE = 20

const STOCK_STATES = [
  { value: 'available', label: 'Disponible' },
  { value: 'reserved', label: 'Reservado' },
  { value: 'out_of_stock', label: 'Sin unidades' },
] as const

const CATALOG_STATUSES = [
  { value: 'active', label: 'Activo' },
  { value: 'inactive', label: 'Inactivo' },
  { value: 'archived', label: 'Archivado' },
] as const

const SORTS = [
  { value: 'name', label: 'Nombre' },
  { value: 'available', label: 'Disponible' },
  { value: 'createdAt', label: 'Más recientes' },
] as const

function toggle(values: string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value]
}

/**
 * The breakdown is loaded only when the row is expanded, so browsing the list
 * never pulls every reservation of every product.
 */
function ProductBreakdown({ productId }: { productId: string }) {
  const breakdown = useQuery({
    queryKey: inventoryKeys.breakdown(productId),
    queryFn: () => fetchProductBreakdown(productId),
  })

  if (breakdown.isPending) {
    return <Text style={styles.muted}>Cargando desglose…</Text>
  }
  if (breakdown.isError) {
    return (
      <Pressable accessibilityRole="button" onPress={() => void breakdown.refetch()}>
        <Text style={styles.errorLink}>No pudimos cargar el desglose. Reintentar</Text>
      </Pressable>
    )
  }

  const data = breakdown.data
  return (
    <View style={styles.breakdown}>
      <View style={styles.breakdownRow}>
        <Text style={styles.breakdownLabel}>Unidades disponibles</Text>
        <Text style={styles.breakdownValue}>{formatQuantity(data.available)}</Text>
      </View>
      {data.lines.map((line) => (
        <View key={`${line.kind}-${line.referenceId}`} style={styles.breakdownRow}>
          <View style={styles.breakdownCopy}>
            <Text style={styles.breakdownLabel}>{line.label}</Text>
            <Text style={styles.muted}>
              {[line.buyerName, formatPrice(line.effectivePrice)]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
          <Text style={styles.breakdownValue}>{formatQuantity(line.quantity)}</Text>
        </View>
      ))}
      {!data.lines.length ? (
        <Text style={styles.muted}>No hay reservas ni ventas activas.</Text>
      ) : null}
    </View>
  )
}

function ProductListItem({
  product,
  expanded,
  onToggle,
  onAdjust,
}: {
  product: ProductCard
  expanded: boolean
  onToggle: () => void
  onAdjust: () => void
}) {
  const { available, reserved, activeFulfilment } = product.stock
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Link href={`/inventario/${product.id}`} asChild>
          <Pressable accessibilityRole="link" style={styles.cardTitleArea}>
            <Text style={styles.cardTitle}>{product.name}</Text>
            <Text style={styles.muted}>
              {formatPrice(product.salePrice)} · {formatQuantity(product.stock.onHand)} en
              total
            </Text>
          </Pressable>
        </Link>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${expanded ? 'Contraer' : 'Expandir'} desglose de ${product.name}`}
          accessibilityState={{ expanded }}
          onPress={onToggle}
          style={styles.chevron}
        >
          <Text style={styles.chevronIcon}>{expanded ? '⌃' : '⌄'}</Text>
        </Pressable>
      </View>

      <View style={styles.chips}>
        {available > 0 ? (
          <InventoryChip
            tone="available"
            label={`Disponible ${formatQuantity(available)}`}
          />
        ) : (
          <InventoryChip tone="warning" label="Sin unidades disponibles" />
        )}
        {reserved > 0 ? (
          <InventoryChip
            tone="reserved"
            label={`Reservado ${formatQuantity(reserved)}`}
          />
        ) : null}
        {activeFulfilment > 0 ? (
          <InventoryChip
            tone="neutral"
            label={`En proceso ${formatQuantity(activeFulfilment)}`}
          />
        ) : null}
        {product.catalogStatus !== 'active' ? (
          <InventoryChip
            tone="neutral"
            label={catalogStatusLabels[product.catalogStatus] ?? product.catalogStatus}
          />
        ) : null}
      </View>

      {expanded ? <ProductBreakdown productId={product.id} /> : null}

      <View style={styles.cardActions}>
        <Pressable
          accessibilityRole="button"
          onPress={onAdjust}
          style={styles.secondaryAction}
        >
          <Text style={styles.secondaryActionText}>Ajustar stock</Text>
        </Pressable>
        <Link href={`/inventario/producto?id=${product.id}`} asChild>
          <Pressable accessibilityRole="link" style={styles.secondaryAction}>
            <Text style={styles.secondaryActionText}>Editar</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  )
}

export default function InventoryScreen() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [stockStates, setStockStates] = useState<string[]>([])
  const [catalogStatuses, setCatalogStatuses] = useState<string[]>([])
  const [sort, setSort] = useState<string>('name')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [adjusting, setAdjusting] = useState<ProductCard | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])

  const filter = useMemo(
    () => ({
      search: debouncedSearch || null,
      stockStates: stockStates.length ? stockStates : null,
      catalogStatuses: catalogStatuses.length ? catalogStatuses : null,
      includeArchived: catalogStatuses.includes('archived'),
    }),
    [debouncedSearch, stockStates, catalogStatuses],
  )

  const hasFilters =
    Boolean(debouncedSearch) || stockStates.length > 0 || catalogStatuses.length > 0

  const products = useInfiniteQuery({
    queryKey: inventoryKeys.products({ filter, sort }),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      fetchProducts({ filter, sort, first: PAGE_SIZE, after: pageParam }),
    getNextPageParam: (lastPage) =>
      lastPage.hasNextPage ? lastPage.endCursor : undefined,
  })

  const rows = useMemo(
    () => products.data?.pages.flatMap((page) => page.products) ?? [],
    [products.data],
  )
  const totalCount = products.data?.pages[0]?.totalCount ?? 0

  function clearFilters() {
    setSearch('')
    setDebouncedSearch('')
    setStockStates([])
    setCatalogStatuses([])
  }

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text accessibilityRole="header" style={styles.title}>
              Inventario
            </Text>
            <Text style={styles.muted}>
              {products.isPending ? 'Cargando productos…' : `${totalCount} productos`}
            </Text>
          </View>
          <PrimaryButton
            label="Agregar"
            onPress={() => router.push('/inventario/producto')}
          />
        </View>

        <TextInput
          accessibilityLabel="Buscar productos"
          placeholder="Buscar productos"
          placeholderTextColor={colors.inkMuted}
          value={search}
          onChangeText={setSearch}
          style={styles.search}
          returnKeyType="search"
        />

        <View style={styles.chips}>
          {STOCK_STATES.map((state) => (
            <InventoryChip
              key={state.value}
              label={state.label}
              selected={stockStates.includes(state.value)}
              onPress={() => setStockStates((current) => toggle(current, state.value))}
            />
          ))}
          <InventoryChip label="Filtros" onPress={() => setFiltersOpen(true)} />
          <InventoryChip
            label="Importar / exportar"
            onPress={() => router.push('/inventario/operaciones')}
          />
        </View>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={products.isRefetching && !products.isFetchingNextPage}
            onRefresh={() => void products.refetch()}
            tintColor={colors.green}
          />
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (products.hasNextPage && !products.isFetchingNextPage) {
            void products.fetchNextPage()
          }
        }}
        renderItem={({ item }) => (
          <ProductListItem
            product={item}
            expanded={expandedId === item.id}
            onToggle={() =>
              setExpandedId((current) => (current === item.id ? null : item.id))
            }
            onAdjust={() => setAdjusting(item)}
          />
        )}
        ListEmptyComponent={
          products.isPending ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.green} />
              <Text style={styles.muted}>Cargando productos…</Text>
            </View>
          ) : products.isError ? (
            <MobileEmptyState
              title="No pudimos cargar el inventario"
              description={
                products.error instanceof MobileApiError
                  ? products.error.message
                  : 'Revisa tu conexión e inténtalo otra vez.'
              }
              action={
                <PrimaryButton
                  label="Reintentar"
                  onPress={() => void products.refetch()}
                />
              }
            />
          ) : hasFilters ? (
            <MobileEmptyState
              title="Sin resultados"
              description="Ningún producto coincide con la búsqueda o los filtros aplicados."
              action={<PrimaryButton label="Limpiar filtros" onPress={clearFilters} />}
            />
          ) : (
            <MobileEmptyState
              title="Aún no tienes productos"
              description="Crea el primero para ver disponibilidad, movimientos y alertas."
              action={
                <PrimaryButton
                  label="Crear producto"
                  onPress={() => router.push('/inventario/producto')}
                />
              }
            />
          )
        }
        ListFooterComponent={
          products.isFetchingNextPage ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.green} />
            </View>
          ) : null
        }
      />

      <Sheet
        visible={filtersOpen}
        title="Filtros"
        description="Se aplican al instante sobre la lista."
        onClose={() => setFiltersOpen(false)}
        footer={
          <>
            <View style={styles.footerItem}>
              <PrimaryButton label="Limpiar" variant="secondary" onPress={clearFilters} />
            </View>
            <View style={styles.footerItem}>
              <PrimaryButton
                label="Ver resultados"
                onPress={() => setFiltersOpen(false)}
              />
            </View>
          </>
        }
      >
        <Text style={styles.filterHeading}>Disponibilidad</Text>
        <View style={styles.chips}>
          {STOCK_STATES.map((state) => (
            <InventoryChip
              key={state.value}
              label={state.label}
              selected={stockStates.includes(state.value)}
              onPress={() => setStockStates((current) => toggle(current, state.value))}
            />
          ))}
        </View>

        <Text style={styles.filterHeading}>Estado de catálogo</Text>
        <View style={styles.chips}>
          {CATALOG_STATUSES.map((status) => (
            <InventoryChip
              key={status.value}
              label={status.label}
              selected={catalogStatuses.includes(status.value)}
              onPress={() =>
                setCatalogStatuses((current) => toggle(current, status.value))
              }
            />
          ))}
        </View>

        <Text style={styles.filterHeading}>Ordenar por</Text>
        <View style={styles.chips}>
          {SORTS.map((option) => (
            <InventoryChip
              key={option.value}
              label={option.label}
              selected={sort === option.value}
              onPress={() => setSort(option.value)}
            />
          ))}
        </View>
      </Sheet>

      {adjusting ? (
        <StockAdjustSheet
          product={adjusting}
          visible
          onClose={() => setAdjusting(null)}
        />
      ) : null}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.paper, flex: 1 },
  header: { gap: 14, paddingHorizontal: 20, paddingTop: 8 },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  headerCopy: { flex: 1, gap: 4 },
  title: { color: colors.ink, fontSize: 30, fontWeight: '800', letterSpacing: -1 },
  muted: { color: colors.inkSoft, fontSize: 14, lineHeight: 20 },
  search: {
    backgroundColor: colors.surface,
    borderColor: '#c9c6bc',
    borderRadius: 12,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  list: { gap: 14, padding: 20, paddingBottom: 40 },
  center: { alignItems: 'center', gap: 10, paddingVertical: 24 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    padding: 18,
  },
  cardHead: { flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  cardTitleArea: { flex: 1, gap: 4, minHeight: 44 },
  cardTitle: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  chevron: { alignItems: 'center', justifyContent: 'center', minHeight: 44, width: 44 },
  chevronIcon: { color: colors.inkSoft, fontSize: 20, fontWeight: '800' },
  breakdown: {
    backgroundColor: colors.paper,
    borderRadius: 14,
    gap: 10,
    padding: 14,
  },
  breakdownRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  breakdownCopy: { flex: 1, gap: 2 },
  breakdownLabel: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  breakdownValue: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  errorLink: { color: colors.error, fontSize: 14, fontWeight: '700' },
  cardActions: { flexDirection: 'row', gap: 10 },
  secondaryAction: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
  },
  secondaryActionText: { color: colors.green, fontSize: 14, fontWeight: '800' },
  filterHeading: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  footerItem: { flex: 1 },
})
