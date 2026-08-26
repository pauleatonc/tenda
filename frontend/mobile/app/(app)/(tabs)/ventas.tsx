import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { MobileEmptyState } from '../../../components/app-ui'
import { PrimaryButton, colors } from '../../../components/auth-ui'
import { InventoryChip, Sheet, SheetField } from '../../../components/inventory-ui'
import {
  SalesBanner,
  SalesMetric,
  SalesOrderCardView,
  formatClp,
  orderStatusLabels,
  paymentMethodLabels,
  salesStyles,
} from '../../../components/sales-ui'
import { MobileApiError } from '../../../lib/auth-api'
import {
  fetchOrders,
  fetchSalesDashboard,
  salesKeys,
} from '../../../lib/sales-api'

const PAGE_SIZE = 20

const ORDER_STATUSES = [
  'reserved',
  'purchase_in_progress',
  'purchase_validation',
  'paid',
  'sold',
  'cancelled',
  'expired',
  'refunded',
] as const

const PAYMENT_METHODS = ['bank_transfer', 'cash', 'mercado_pago'] as const

function toggle(values: string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value]
}

function splitParam(value: string | string[] | undefined): string[] {
  const raw = Array.isArray(value) ? value.join(',') : value
  return raw ? raw.split(',').filter(Boolean) : []
}

export default function SalesScreen() {
  const params = useLocalSearchParams<{
    dateFrom?: string
    dateTo?: string
    productId?: string
    paymentMethods?: string | string[]
    statuses?: string | string[]
  }>()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statuses, setStatuses] = useState<string[]>(() => splitParam(params.statuses))
  const [paymentMethods, setPaymentMethods] = useState<string[]>(() =>
    splitParam(params.paymentMethods),
  )
  const [dateFrom, setDateFrom] = useState(
    typeof params.dateFrom === 'string' ? params.dateFrom : '',
  )
  const [dateTo, setDateTo] = useState(
    typeof params.dateTo === 'string' ? params.dateTo : '',
  )
  const [productId, setProductId] = useState(
    typeof params.productId === 'string' ? params.productId : '',
  )
  const [filtersOpen, setFiltersOpen] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])

  const filter = useMemo(
    () => ({
      search: debouncedSearch || null,
      statuses: statuses.length ? statuses : null,
      paymentMethods: paymentMethods.length ? paymentMethods : null,
      dateFrom: dateFrom.trim() || null,
      dateTo: dateTo.trim() || null,
      productId: productId || null,
    }),
    [debouncedSearch, statuses, paymentMethods, dateFrom, dateTo, productId],
  )
  const variables = useMemo(
    () => ({ filter, first: PAGE_SIZE, after: null }),
    [filter],
  )

  const dashboard = useQuery({
    queryKey: salesKeys.dashboard(),
    queryFn: fetchSalesDashboard,
  })
  const orders = useInfiniteQuery({
    queryKey: salesKeys.orders(variables),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      fetchOrders({ filter, first: PAGE_SIZE, after: pageParam }),
    getNextPageParam: (lastPage) =>
      lastPage.pageInfo.hasNextPage ? lastPage.pageInfo.endCursor : undefined,
  })

  const rows = useMemo(
    () => orders.data?.pages.flatMap((page) => page.nodes) ?? [],
    [orders.data],
  )
  const totalCount = orders.data?.pages[0]?.totalCount ?? 0
  const hasFilters =
    Boolean(debouncedSearch) ||
    statuses.length > 0 ||
    paymentMethods.length > 0 ||
    Boolean(dateFrom) ||
    Boolean(dateTo) ||
    Boolean(productId)

  function clearFilters() {
    setSearch('')
    setDebouncedSearch('')
    setStatuses([])
    setPaymentMethods([])
    setDateFrom('')
    setDateTo('')
    setProductId('')
  }

  const summary = dashboard.data
  const refreshing =
    (orders.isRefetching && !orders.isFetchingNextPage) || dashboard.isRefetching

  return (
    <SafeAreaView edges={['left', 'right']} style={salesStyles.safeArea}>
      <View style={salesStyles.header}>
        <View style={salesStyles.headerRow}>
          <View style={salesStyles.headerCopy}>
            <Text accessibilityRole="header" style={salesStyles.title}>
              Ventas
            </Text>
            <Text style={salesStyles.muted}>
              {orders.isPending ? 'Cargando ventas…' : `${totalCount} ventas`}
            </Text>
          </View>
          <PrimaryButton label="Nueva" onPress={() => router.push('/ventas/nueva')} />
        </View>
        <TextInput
          accessibilityLabel="Buscar ventas"
          placeholder="Número o comprador"
          placeholderTextColor={colors.inkMuted}
          returnKeyType="search"
          style={salesStyles.search}
          value={search}
          onChangeText={setSearch}
        />
        <View style={salesStyles.chips}>
          <InventoryChip
            label={hasFilters ? 'Filtros aplicados' : 'Filtrar'}
            selected={hasFilters}
            onPress={() => setFiltersOpen(true)}
          />
          {statuses.slice(0, 2).map((status) => (
            <InventoryChip
              key={status}
              label={orderStatusLabels[status] ?? status}
              selected
              onPress={() => setStatuses((current) => toggle(current, status))}
            />
          ))}
          {productId ? (
            <InventoryChip
              label="Producto del balance ×"
              selected
              onPress={() => setProductId('')}
            />
          ) : null}
        </View>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={salesStyles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.green}
            onRefresh={() => {
              void Promise.all([orders.refetch(), dashboard.refetch()])
            }}
          />
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (orders.hasNextPage && !orders.isFetchingNextPage) {
            void orders.fetchNextPage()
          }
        }}
        ListHeaderComponent={
          <View style={styles.dashboard}>
            {dashboard.isError ? (
              <SalesBanner
                tone="error"
                title="Resumen no disponible"
                description="La lista sigue visible. Puedes reintentar el resumen sin perder los filtros."
                action={
                  <PrimaryButton
                    label="Reintentar resumen"
                    variant="secondary"
                    onPress={() => void dashboard.refetch()}
                  />
                }
              />
            ) : dashboard.isPending ? (
              <View style={salesStyles.center}>
                <ActivityIndicator color={colors.green} />
                <Text style={salesStyles.muted}>Cargando resumen…</Text>
              </View>
            ) : summary ? (
              <>
                <View style={styles.metrics}>
                  <View style={styles.metric}>
                    <SalesMetric
                      label="Por validar"
                      value={String(summary.awaitingValidationCount)}
                      detail="Comprobantes pendientes"
                    />
                  </View>
                  <View style={styles.metric}>
                    <SalesMetric
                      label="Confirmado este mes"
                      value={formatClp(summary.confirmedThisMonthAmount)}
                      detail={`${summary.confirmedThisMonthCount} operaciones`}
                    />
                  </View>
                </View>
                <Text style={styles.summaryText}>
                  {summary.awaitingBuyerCount} esperando comprador ·{' '}
                  {summary.awaitingPaymentCount} esperando pago
                </Text>
                {summary.reconciliationRequiredCount > 0 ? (
                  <SalesBanner
                    tone="error"
                    title="Hay ventas por conciliar"
                    description={`${summary.reconciliationRequiredCount} ventas requieren revisión. No se muestran como éxito confirmado.`}
                  />
                ) : null}
              </>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <SalesOrderCardView
            order={item}
            onPress={() => router.push(`/ventas/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          orders.isPending ? (
            <View style={salesStyles.center}>
              <ActivityIndicator color={colors.green} />
              <Text style={salesStyles.muted}>Cargando ventas…</Text>
            </View>
          ) : orders.isError ? (
            <MobileEmptyState
              title="No pudimos cargar las ventas"
              description={
                orders.error instanceof MobileApiError
                  ? orders.error.message
                  : 'Revisa tu conexión e inténtalo otra vez.'
              }
              action={
                <PrimaryButton
                  label="Reintentar"
                  onPress={() => void orders.refetch()}
                />
              }
            />
          ) : hasFilters ? (
            <MobileEmptyState
              title="Sin ventas que coincidan"
              description="Prueba otra búsqueda o quita los filtros aplicados."
              action={<PrimaryButton label="Limpiar filtros" onPress={clearFilters} />}
            />
          ) : (
            <MobileEmptyState
              title="Aún no tienes ventas"
              description="Crea una venta para reservar stock y obtener un enlace para compartir."
              action={
                <PrimaryButton
                  label="Crear primera venta"
                  onPress={() => router.push('/ventas/nueva')}
                />
              }
            />
          )
        }
        ListFooterComponent={
          orders.isFetchingNextPage ? (
            <View style={salesStyles.center}>
              <ActivityIndicator color={colors.green} />
            </View>
          ) : null
        }
      />

      <Sheet
        visible={filtersOpen}
        title="Buscar y filtrar ventas"
        description="Filtra por estado, método y fecha de creación."
        onClose={() => setFiltersOpen(false)}
        footer={
          <>
            <View style={salesStyles.footerItem}>
              <PrimaryButton label="Limpiar" variant="secondary" onPress={clearFilters} />
            </View>
            <View style={salesStyles.footerItem}>
              <PrimaryButton
                label="Ver resultados"
                onPress={() => setFiltersOpen(false)}
              />
            </View>
          </>
        }
      >
        <Text style={salesStyles.filterHeading}>Estado</Text>
        <View style={salesStyles.chips}>
          {ORDER_STATUSES.map((status) => (
            <InventoryChip
              key={status}
              label={orderStatusLabels[status]}
              selected={statuses.includes(status)}
              onPress={() => setStatuses((current) => toggle(current, status))}
            />
          ))}
        </View>
        <Text style={salesStyles.filterHeading}>Método de pago</Text>
        <View style={salesStyles.chips}>
          {PAYMENT_METHODS.map((method) => (
            <InventoryChip
              key={method}
              label={paymentMethodLabels[method]}
              selected={paymentMethods.includes(method)}
              onPress={() =>
                setPaymentMethods((current) => toggle(current, method))
              }
            />
          ))}
        </View>
        <SheetField
          label="Desde"
          placeholder="AAAA-MM-DD"
          value={dateFrom}
          onChangeText={setDateFrom}
        />
        <SheetField
          label="Hasta"
          placeholder="AAAA-MM-DD"
          value={dateTo}
          onChangeText={setDateTo}
        />
      </Sheet>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  dashboard: { gap: 12 },
  metrics: { flexDirection: 'row', gap: 10 },
  metric: { flex: 1 },
  summaryText: { color: colors.inkSoft, fontSize: 13, lineHeight: 19 },
})
