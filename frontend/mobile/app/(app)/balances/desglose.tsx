import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { useMemo } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { MobileEmptyState } from '../../../components/app-ui'
import { PrimaryButton, colors } from '../../../components/auth-ui'
import { DetailRow, formatClp, salesStyles } from '../../../components/sales-ui'
import { MobileApiError, getMobileViewer } from '../../../lib/auth-api'
import {
  fetchSalesBalanceBreakdown,
  salesKeys,
  type SalesBalanceBreakdownRow,
} from '../../../lib/sales-api'

const PAGE_SIZE = 20

function splitParam(value: string | string[] | undefined): string[] | null {
  const raw = Array.isArray(value) ? value.join(',') : value
  if (!raw) return null
  const values = raw.split(',').filter(Boolean)
  return values.length ? values : null
}

function BreakdownCard({
  row,
  onPress,
}: {
  row: SalesBalanceBreakdownRow
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${row.label}, ventas netas ${formatClp(row.netSales)}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <Text style={styles.cardTitle}>{row.label}</Text>
      <DetailRow label="Ventas brutas" value={formatClp(row.grossSales)} />
      <DetailRow label="Reembolsos" value={formatClp(row.refunds)} />
      <DetailRow label="Ventas netas" value={formatClp(row.netSales)} />
      <DetailRow label="Costo conocido" value={formatClp(row.knownCostOfGoods)} />
      <DetailRow
        label="Margen bruto"
        value={`${formatClp(row.grossMargin)}${row.marginComplete ? '' : ' · incompleto'}`}
      />
      <DetailRow label="Por cobrar / validar" value={formatClp(row.pendingAmount)} />
      <DetailRow label="Operaciones" value={String(row.operationCount)} />
      <Text style={styles.link}>Ver ventas con estos filtros ›</Text>
    </Pressable>
  )
}

export default function BalanceBreakdownScreen() {
  const params = useLocalSearchParams<{
    dateFrom?: string
    dateTo?: string
    productId?: string
    productLabel?: string
    paymentMethods?: string | string[]
    statuses?: string | string[]
  }>()
  const filter = useMemo(
    () => ({
      dateFrom: typeof params.dateFrom === 'string' ? params.dateFrom : '',
      dateTo: typeof params.dateTo === 'string' ? params.dateTo : '',
      productId: typeof params.productId === 'string' ? params.productId : null,
      paymentMethods: splitParam(params.paymentMethods),
      statuses: splitParam(params.statuses),
    }),
    [
      params.dateFrom,
      params.dateTo,
      params.productId,
      params.paymentMethods,
      params.statuses,
    ],
  )
  const viewer = useQuery({
    queryKey: ['mobile-viewer'],
    queryFn: getMobileViewer,
    retry: false,
  })
  const canView = viewer.data?.membership.permissions.viewFinancials === true
  const breakdown = useInfiniteQuery({
    queryKey: salesKeys.breakdown(filter),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      fetchSalesBalanceBreakdown({
        filter,
        first: PAGE_SIZE,
        after: pageParam,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.pageInfo.hasNextPage ? lastPage.pageInfo.endCursor : undefined,
    enabled: canView,
  })
  const rows = useMemo(
    () => breakdown.data?.pages.flatMap((page) => page.nodes) ?? [],
    [breakdown.data],
  )

  if (viewer.isPending) {
    return (
      <SafeAreaView style={salesStyles.safeArea}>
        <Text style={styles.loading}>Verificando acceso…</Text>
      </SafeAreaView>
    )
  }
  if (!canView) {
    return (
      <SafeAreaView style={salesStyles.safeArea}>
        <View style={styles.state}>
          <MobileEmptyState
            title="No tienes permiso para ver este desglose"
            description="Solicita al Owner acceso a información financiera."
            action={<PrimaryButton label="Volver" onPress={() => router.back()} />}
          />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={salesStyles.safeArea}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <Text style={styles.back}>‹ Balance</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>
          Desglose comercial
        </Text>
        <Text style={salesStyles.muted}>
          {filter.dateFrom} a {filter.dateTo}
          {typeof params.productLabel === 'string' ? ` · ${params.productLabel}` : ''}
        </Text>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.key}
        contentContainerStyle={salesStyles.list}
        refreshControl={
          <RefreshControl
            refreshing={breakdown.isRefetching && !breakdown.isFetchingNextPage}
            tintColor={colors.green}
            onRefresh={() => void breakdown.refetch()}
          />
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (breakdown.hasNextPage && !breakdown.isFetchingNextPage) {
            void breakdown.fetchNextPage()
          }
        }}
        renderItem={({ item }) => (
          <BreakdownCard
            row={item}
            onPress={() =>
              router.push({
                pathname: '/ventas',
                params: {
                  dateFrom: filter.dateFrom,
                  dateTo: filter.dateTo,
                  productId: item.productId ?? filter.productId ?? undefined,
                  paymentMethods:
                    item.paymentMethod ?? filter.paymentMethods?.join(',') ?? undefined,
                  statuses: item.status ?? filter.statuses?.join(',') ?? undefined,
                },
              })
            }
          />
        )}
        ListEmptyComponent={
          breakdown.isPending ? (
            <View style={salesStyles.center}>
              <ActivityIndicator color={colors.green} />
              <Text style={salesStyles.muted}>Cargando desglose…</Text>
            </View>
          ) : breakdown.isError ? (
            <MobileEmptyState
              title="No pudimos cargar el desglose"
              description={
                breakdown.error instanceof MobileApiError
                  ? breakdown.error.message
                  : 'Revisa tu conexión e inténtalo otra vez.'
              }
              action={
                <PrimaryButton
                  label="Reintentar"
                  onPress={() => void breakdown.refetch()}
                />
              }
            />
          ) : (
            <MobileEmptyState
              title="Sin filas para desglosar"
              description="No hay operaciones reconocidas con estos filtros."
            />
          )
        }
        ListFooterComponent={
          breakdown.isFetchingNextPage ? (
            <View style={salesStyles.center}>
              <ActivityIndicator color={colors.green} />
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  loading: { color: colors.inkSoft, padding: 24 },
  state: { padding: 20 },
  header: { gap: 6, paddingHorizontal: 20, paddingTop: 10 },
  back: { color: colors.green, fontSize: 14, fontWeight: '800', paddingVertical: 7 },
  title: { color: colors.ink, fontSize: 28, fontWeight: '800', letterSpacing: -1 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 19,
    borderWidth: 1,
    gap: 10,
    padding: 17,
  },
  pressed: { opacity: 0.82 },
  cardTitle: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  link: { color: colors.green, fontSize: 13, fontWeight: '800' },
})
