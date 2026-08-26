import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { MobileEmptyState } from '../../components/app-ui'
import { PrimaryButton, colors } from '../../components/auth-ui'
import { InventoryChip, Sheet, SheetField } from '../../components/inventory-ui'
import {
  SalesBanner,
  SalesMetric,
  formatClp,
  orderStatusLabels,
  paymentMethodLabels,
  salesStyles,
} from '../../components/sales-ui'
import { MobileApiError, getMobileViewer } from '../../lib/auth-api'
import { fetchProducts, inventoryKeys } from '../../lib/inventory-api'
import { fetchSalesBalance, salesKeys } from '../../lib/sales-api'

type BalancePreset = 'today' | 'seven_days' | 'month' | 'custom'

const PRESETS: { value: BalancePreset; label: string }[] = [
  { value: 'today', label: 'Hoy' },
  { value: 'seven_days', label: '7 días' },
  { value: 'month', label: 'Mes' },
  { value: 'custom', label: 'Personalizado' },
]
const PAYMENT_METHODS = ['bank_transfer', 'cash', 'mercado_pago'] as const
const BALANCE_STATUSES = ['paid', 'sold', 'refunded'] as const

function dateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function presetRange(preset: BalancePreset): { from: string; to: string } {
  const end = new Date()
  const start = new Date(end)
  if (preset === 'seven_days') start.setDate(start.getDate() - 6)
  if (preset === 'month') start.setDate(1)
  return { from: dateKey(start), to: dateKey(end) }
}

function toggle(values: string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value]
}

function formatCoverage(value: string): string {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '—'
  const percentage = numeric <= 1 ? numeric * 100 : numeric
  return `${Math.round(percentage)}%`
}

export default function BalancesScreen() {
  const initialRange = presetRange('month')
  const [preset, setPreset] = useState<BalancePreset>('month')
  const [dateFrom, setDateFrom] = useState(initialRange.from)
  const [dateTo, setDateTo] = useState(initialRange.to)
  const [productId, setProductId] = useState('')
  const [productLabel, setProductLabel] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [paymentMethods, setPaymentMethods] = useState<string[]>([])
  const [statuses, setStatuses] = useState<string[]>([])
  const [filtersOpen, setFiltersOpen] = useState(false)

  const viewer = useQuery({
    queryKey: ['mobile-viewer'],
    queryFn: getMobileViewer,
    retry: false,
  })
  const canView = viewer.data?.membership.permissions.viewFinancials === true

  const filter = useMemo(
    () => ({
      dateFrom,
      dateTo,
      productId: productId || null,
      paymentMethods: paymentMethods.length ? paymentMethods : null,
      statuses: statuses.length ? statuses : null,
    }),
    [dateFrom, dateTo, productId, paymentMethods, statuses],
  )
  const balance = useQuery({
    queryKey: salesKeys.balance(filter),
    queryFn: () => fetchSalesBalance(filter),
    enabled: canView,
  })
  const products = useQuery({
    queryKey: inventoryKeys.products({
      balancePicker: true,
      search: productSearch.trim(),
    }),
    queryFn: () =>
      fetchProducts({
        filter: {
          search: productSearch.trim() || null,
          catalogStatuses: ['active'],
          includeArchived: false,
        },
        first: 10,
        after: null,
      }),
    enabled: canView && filtersOpen,
  })

  function selectPreset(next: BalancePreset) {
    setPreset(next)
    if (next === 'custom') return
    const range = presetRange(next)
    setDateFrom(range.from)
    setDateTo(range.to)
  }

  function openOrders() {
    router.push({
      pathname: '/ventas',
      params: {
        dateFrom,
        dateTo,
        productId: productId || undefined,
        paymentMethods: paymentMethods.join(',') || undefined,
        statuses: statuses.join(',') || undefined,
      },
    })
  }

  function openBreakdown() {
    router.push({
      pathname: '/balances/desglose',
      params: {
        dateFrom,
        dateTo,
        productId: productId || undefined,
        productLabel: productLabel || undefined,
        paymentMethods: paymentMethods.join(',') || undefined,
        statuses: statuses.join(',') || undefined,
      },
    })
  }

  if (viewer.isPending) {
    return (
      <SafeAreaView style={salesStyles.safeArea}>
        <Text accessibilityLiveRegion="polite" style={styles.loading}>
          Verificando acceso…
        </Text>
      </SafeAreaView>
    )
  }

  if (viewer.isError) {
    return (
      <SafeAreaView style={salesStyles.safeArea}>
        <View style={styles.state}>
          <MobileEmptyState
            title="No pudimos verificar tu acceso"
            description="Vuelve a intentarlo antes de consultar información financiera."
            action={
              <PrimaryButton label="Reintentar" onPress={() => void viewer.refetch()} />
            }
          />
        </View>
      </SafeAreaView>
    )
  }

  if (!canView) {
    return (
      <SafeAreaView style={salesStyles.safeArea}>
        <View style={styles.state}>
          <MobileEmptyState
            title="No tienes permiso para ver balances"
            description="El Owner puede habilitar el permiso de información financiera."
            action={<PrimaryButton label="Volver" onPress={() => router.back()} />}
          />
        </View>
      </SafeAreaView>
    )
  }

  const data = balance.data

  return (
    <SafeAreaView style={salesStyles.safeArea}>
      <ScrollView contentContainerStyle={salesStyles.content}>
        <View style={styles.heading}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={styles.back}>‹ Más</Text>
          </Pressable>
          <Text style={styles.eyebrow}>BAL-01</Text>
          <Text accessibilityRole="header" style={styles.title}>
            Balance comercial
          </Text>
          <Text style={salesStyles.muted}>
            Lectura operativa de ventas, costos conocidos y margen. No es contabilidad
            legal, tributaria ni conciliación bancaria.
          </Text>
        </View>

        <View style={salesStyles.chips}>
          {PRESETS.map((option) => (
            <InventoryChip
              key={option.value}
              label={option.label}
              selected={preset === option.value}
              onPress={() => {
                selectPreset(option.value)
                if (option.value === 'custom') setFiltersOpen(true)
              }}
            />
          ))}
          <InventoryChip
            label="Más filtros"
            selected={Boolean(productId || paymentMethods.length || statuses.length)}
            onPress={() => setFiltersOpen(true)}
          />
        </View>
        <Text style={styles.range}>
          {dateFrom} a {dateTo}
          {productLabel ? ` · ${productLabel}` : ''}
        </Text>

        {balance.isPending ? (
          <Text accessibilityLiveRegion="polite" style={styles.loadingInline}>
            Calculando balance…
          </Text>
        ) : balance.isError ? (
          <MobileEmptyState
            title="No pudimos calcular el balance"
            description={
              balance.error instanceof MobileApiError
                ? balance.error.message
                : 'Revisa tu conexión e inténtalo otra vez.'
            }
            action={
              <PrimaryButton label="Reintentar" onPress={() => void balance.refetch()} />
            }
          />
        ) : data && data.operationCount === 0 ? (
          <MobileEmptyState
            title="Sin operaciones confirmadas"
            description="No hay ventas reconocidas en el rango y filtros seleccionados."
            action={
              <PrimaryButton
                label="Cambiar filtros"
                onPress={() => setFiltersOpen(true)}
              />
            }
          />
        ) : data ? (
          <>
            {data.isPartial ? (
              <SalesBanner
                title="Información parcial"
                description={
                  data.warnings.join(' ') ||
                  'Algunas cifras no pudieron calcularse completamente.'
                }
              />
            ) : null}
            {!data.marginComplete ? (
              <SalesBanner
                title="Margen con costos incompletos"
                description={`Cobertura de costo ${formatCoverage(data.costCoverage)}: ${data.costedLineCount} de ${data.recognizedLineCount} líneas tienen costo snapshot. Los costos faltantes no se cuentan como cero.`}
              />
            ) : null}

            <View style={styles.metrics}>
              <SalesMetric
                label="Ventas brutas confirmadas"
                value={formatClp(data.grossSales)}
                onPress={openOrders}
              />
              <SalesMetric
                label="Reembolsos"
                value={formatClp(data.refunds)}
                onPress={openOrders}
              />
              <SalesMetric
                label="Ventas netas"
                value={formatClp(data.netSales)}
                onPress={openOrders}
              />
              <SalesMetric
                label="Costo de venta conocido"
                value={formatClp(data.knownCostOfGoods)}
                detail={`Cobertura ${formatCoverage(data.costCoverage)}`}
                onPress={openOrders}
              />
              <SalesMetric
                label="Margen bruto"
                value={formatClp(data.grossMargin)}
                detail={data.marginComplete ? 'Cobertura completa' : 'Margen incompleto'}
                onPress={openOrders}
              />
              <SalesMetric
                label="Por cobrar o validar"
                value={formatClp(data.pendingAmount)}
                onPress={openOrders}
              />
              <SalesMetric
                label="Operaciones"
                value={String(data.operationCount)}
                onPress={openOrders}
              />
            </View>
            <PrimaryButton label="Ver desglose" onPress={openBreakdown} />
            <Text style={styles.disclaimer}>
              Este balance excluye caja, impuestos, facturación/DTE, costo promedio por
              lote y conciliación bancaria.
            </Text>
          </>
        ) : null}
      </ScrollView>

      <Sheet
        visible={filtersOpen}
        title="Filtros del balance"
        description="El corte diario usa la zona horaria del negocio."
        onClose={() => setFiltersOpen(false)}
        footer={
          <>
            <View style={salesStyles.footerItem}>
              <PrimaryButton
                label="Limpiar adicionales"
                variant="secondary"
                onPress={() => {
                  setProductId('')
                  setProductLabel('')
                  setPaymentMethods([])
                  setStatuses([])
                }}
              />
            </View>
            <View style={salesStyles.footerItem}>
              <PrimaryButton
                label="Aplicar"
                onPress={() => setFiltersOpen(false)}
              />
            </View>
          </>
        }
      >
        <SheetField
          label="Desde"
          placeholder="AAAA-MM-DD"
          value={dateFrom}
          onChangeText={(value) => {
            setPreset('custom')
            setDateFrom(value)
          }}
        />
        <SheetField
          label="Hasta"
          placeholder="AAAA-MM-DD"
          value={dateTo}
          onChangeText={(value) => {
            setPreset('custom')
            setDateTo(value)
          }}
        />

        <Text style={salesStyles.filterHeading}>Producto</Text>
        {productId ? (
          <InventoryChip
            label={`${productLabel || 'Producto seleccionado'} ×`}
            selected
            onPress={() => {
              setProductId('')
              setProductLabel('')
            }}
          />
        ) : (
          <>
            <SheetField
              label="Buscar producto"
              value={productSearch}
              onChangeText={setProductSearch}
            />
            <View style={salesStyles.chips}>
              {products.data?.products.map((product) => (
                <InventoryChip
                  key={product.id}
                  label={product.name}
                  onPress={() => {
                    setProductId(product.id)
                    setProductLabel(product.name)
                  }}
                />
              ))}
            </View>
          </>
        )}

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

        <Text style={salesStyles.filterHeading}>Estado</Text>
        <View style={salesStyles.chips}>
          {BALANCE_STATUSES.map((status) => (
            <InventoryChip
              key={status}
              label={orderStatusLabels[status]}
              selected={statuses.includes(status)}
              onPress={() => setStatuses((current) => toggle(current, status))}
            />
          ))}
        </View>
      </Sheet>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  loading: { color: colors.inkSoft, padding: 24 },
  loadingInline: { color: colors.inkSoft, paddingVertical: 30, textAlign: 'center' },
  state: { padding: 20 },
  heading: { gap: 7 },
  back: { color: colors.green, fontSize: 14, fontWeight: '800', paddingVertical: 7 },
  eyebrow: {
    color: colors.green,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: { color: colors.ink, fontSize: 29, fontWeight: '800', letterSpacing: -1 },
  range: { color: colors.inkSoft, fontSize: 13 },
  metrics: { gap: 11 },
  disclaimer: {
    color: colors.inkSoft,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
})
