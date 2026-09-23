import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
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
import { colors } from '../../../components/auth-ui'
import { InventoryChip } from '../../../components/inventory-ui'
import {
  SalesBanner,
  SalesMetric,
  salesStyles,
} from '../../../components/sales-ui'
import {
  ShipmentCardView,
  deliveryModeLabels,
  deliveryModes,
  shipmentStatusLabels,
  shipmentStatuses,
} from '../../../components/shipping-ui'
import { MobileApiError } from '../../../lib/auth-api'
import {
  fetchShipments,
  fetchShippingDashboard,
  shippingKeys,
} from '../../../lib/shipping-api'

const PAGE_SIZE = 20

function toggle(values: string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value]
}

export default function ShippingScreen() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statuses, setStatuses] = useState<string[]>([])
  const [deliveryMode, setDeliveryMode] = useState<string | null>(null)

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 280)
    return () => clearTimeout(handle)
  }, [search])

  const filter = useMemo(
    () => ({
      search: debouncedSearch || null,
      statuses: statuses.length ? statuses : null,
      deliveryMode,
    }),
    [debouncedSearch, deliveryMode, statuses],
  )
  const variables = useMemo(
    () => ({ filter, first: PAGE_SIZE, after: null }),
    [filter],
  )

  const dashboard = useQuery({
    queryKey: shippingKeys.dashboard(),
    queryFn: fetchShippingDashboard,
  })
  const shipments = useInfiniteQuery({
    queryKey: shippingKeys.shipments(variables),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      fetchShipments({ filter, first: PAGE_SIZE, after: pageParam }),
    getNextPageParam: (lastPage) =>
      lastPage.pageInfo.hasNextPage ? lastPage.pageInfo.endCursor : undefined,
  })

  const rows = useMemo(
    () => shipments.data?.pages.flatMap((page) => page.nodes) ?? [],
    [shipments.data],
  )
  const totalCount = shipments.data?.pages[0]?.totalCount ?? 0
  const hasFilters = Boolean(debouncedSearch) || statuses.length > 0 || Boolean(deliveryMode)
  const refreshing =
    (shipments.isRefetching && !shipments.isFetchingNextPage) || dashboard.isRefetching

  return (
    <SafeAreaView edges={['left', 'right']} style={salesStyles.safeArea}>
      <View style={salesStyles.header}>
        <View style={salesStyles.headerCopy}>
          <Text accessibilityRole="header" style={salesStyles.title}>
            Despachos
          </Text>
          <Text style={salesStyles.muted}>
            {shipments.isPending ? 'Cargando envíos…' : `${totalCount} envíos`}
          </Text>
        </View>
        <TextInput
          accessibilityLabel="Buscar despachos"
          placeholder="Número, destinatario o tracking"
          placeholderTextColor={colors.inkMuted}
          returnKeyType="search"
          style={salesStyles.search}
          value={search}
          onChangeText={setSearch}
        />
        <View style={salesStyles.chips}>
          {shipmentStatuses.map((status) => (
            <InventoryChip
              key={status}
              label={shipmentStatusLabels[status]}
              selected={statuses.includes(status)}
              onPress={() => setStatuses((current) => toggle(current, status))}
            />
          ))}
        </View>
        <View style={salesStyles.chips}>
          {deliveryModes.map((mode) => (
            <InventoryChip
              key={mode}
              label={deliveryModeLabels[mode]}
              selected={deliveryMode === mode}
              onPress={() =>
                setDeliveryMode((current) => (current === mode ? null : mode))
              }
            />
          ))}
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
              void Promise.all([shipments.refetch(), dashboard.refetch()])
            }}
          />
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (shipments.hasNextPage && !shipments.isFetchingNextPage) {
            void shipments.fetchNextPage()
          }
        }}
        ListHeaderComponent={
          <View style={styles.dashboard}>
            {dashboard.isError ? (
              <SalesBanner
                tone="error"
                title="Resumen no disponible"
                description="La lista sigue visible. Puedes reintentar el resumen."
              />
            ) : null}
            {dashboard.data ? (
              <View style={styles.metrics}>
                <SalesMetric
                  label="Pendientes"
                  value={String(dashboard.data.pendingCount)}
                  onPress={() => setStatuses(['pending'])}
                />
                <SalesMetric
                  label="Despachados"
                  value={String(dashboard.data.dispatchedCount)}
                  onPress={() => setStatuses(['dispatched'])}
                />
                <SalesMetric
                  label="Entregados"
                  value={String(dashboard.data.deliveredCount)}
                  onPress={() => setStatuses(['delivered'])}
                />
              </View>
            ) : null}
            {shipments.isError ? (
              <SalesBanner
                tone="error"
                title="No pudimos cargar los despachos"
                description={
                  shipments.error instanceof MobileApiError
                    ? shipments.error.message
                    : 'Revisa tu conexión e inténtalo nuevamente.'
                }
              />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          shipments.isPending ? (
            <View style={salesStyles.center}>
              <ActivityIndicator color={colors.green} />
            </View>
          ) : (
            <MobileEmptyState
              title={hasFilters ? 'No encontramos envíos' : 'Aún no tienes despachos'}
              description={
                hasFilters
                  ? 'Ningún despacho coincide con los filtros aplicados.'
                  : 'Cuando una venta se pague, Tenda crea el envío para que registres el despacho o la entrega.'
              }
            />
          )
        }
        ListFooterComponent={
          shipments.isFetchingNextPage ? (
            <View style={salesStyles.center}>
              <ActivityIndicator color={colors.green} />
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <ShipmentCardView
            shipment={item}
            onPress={() => router.push(`/despachos/${item.id}`)}
          />
        )}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  dashboard: { gap: 14, marginBottom: 8 },
  metrics: { gap: 10 },
})
