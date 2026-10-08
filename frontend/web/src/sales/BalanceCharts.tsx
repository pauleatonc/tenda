import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { BalanceBreakdown } from './api'
import { formatClp } from './model'

function compactClp(value: number): string {
  if (!Number.isFinite(value)) return '—'
  if (Math.abs(value) >= 1_000_000) {
    return `$${Math.round(value / 100_000) / 10}M`
  }
  if (Math.abs(value) >= 1000) {
    return `$${Math.round(value / 100) / 10}k`
  }
  return formatClp(String(value))
}

function toNumber(value: string): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function formatPeriodLabel(value: string): string {
  if (!value) return '—'
  const [year, month, day] = value.split('-')
  if (!year || !month || !day) return value
  return `${Number(day)}/${Number(month)}`
}

type TrendPoint = { label: string; net: number; gross: number; refunds: number }

export function BalanceTrendChart({
  rows,
  loading,
}: {
  rows: BalanceBreakdown[]
  loading?: boolean
}) {
  const data: TrendPoint[] = [...rows]
    .sort((a, b) => (a.periodStart ?? '').localeCompare(b.periodStart ?? ''))
    .map((row) => ({
      label: formatPeriodLabel(row.periodStart ?? row.label),
      net: toNumber(row.netSales),
      gross: toNumber(row.grossSales),
      refunds: toNumber(row.refunds),
    }))

  if (loading) {
    return <div className="balance-chart balance-chart--loading" aria-busy="true" />
  }

  if (!data.length) {
    return (
      <div className="balance-chart balance-chart--empty">
        <p>Sin tendencia en este rango.</p>
      </div>
    )
  }

  return (
    <figure className="balance-chart" aria-label="Tendencia de ventas netas">
      <figcaption>Ventas netas en el período</figcaption>
      <div className="balance-chart__canvas">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="balanceNetFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--green)" stopOpacity={0.28} />
                <stop offset="100%" stopColor="var(--green)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--ink-soft)', fontSize: 12 }}
            />
            <YAxis
              tickFormatter={compactClp}
              width={56}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--ink-soft)', fontSize: 12 }}
            />
            <Tooltip
              formatter={(value: number, name: string) => [
                formatClp(String(value)),
                name === 'net' ? 'Neto' : name === 'gross' ? 'Bruto' : 'Reembolsos',
              ]}
              contentStyle={{
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 12,
              }}
            />
            <Area
              type="monotone"
              dataKey="net"
              stroke="var(--green)"
              strokeWidth={2.5}
              fill="url(#balanceNetFill)"
              isAnimationActive
              animationDuration={700}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}

export function BalanceMixChart({
  rows,
  loading,
  title,
}: {
  rows: BalanceBreakdown[]
  loading?: boolean
  title: string
}) {
  const data = [...rows]
    .sort((a, b) => toNumber(b.netSales) - toNumber(a.netSales))
    .slice(0, 5)
    .map((row) => ({
      label: row.label.length > 22 ? `${row.label.slice(0, 20)}…` : row.label,
      net: toNumber(row.netSales),
    }))

  if (loading) {
    return <div className="balance-chart balance-chart--loading" aria-busy="true" />
  }

  if (!data.length) {
    return (
      <div className="balance-chart balance-chart--empty">
        <p>Sin composición para mostrar.</p>
      </div>
    )
  }

  return (
    <figure className="balance-chart" aria-label={title}>
      <figcaption>{title}</figcaption>
      <div className="balance-chart__canvas">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 8, right: 12, left: 8, bottom: 0 }}
          >
            <CartesianGrid stroke="var(--line)" horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={compactClp}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--ink-soft)', fontSize: 12 }}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={110}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--ink)', fontSize: 12 }}
            />
            <Tooltip
              formatter={(value: number) => [formatClp(String(value)), 'Neto']}
              contentStyle={{
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 12,
              }}
            />
            <Bar
              dataKey="net"
              fill="var(--green)"
              radius={[0, 8, 8, 0]}
              isAnimationActive
              animationDuration={700}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}
