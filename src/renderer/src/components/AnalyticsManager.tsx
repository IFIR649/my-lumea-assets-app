import { useEffect, useState } from 'react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'
import {
  AlertCircle,
  RefreshCw,
  TrendingUp,
  ShoppingBag,
  Truck,
  Package,
  Download,
  Eye,
  EyeOff
} from 'lucide-react'
import { cn } from '../lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type Msg = { type: 'error' | 'success' | 'info'; text: string } | null

type OrdersAnalyticsResponse = {
  success: boolean
  error?: string
  period?: { start: string; end: string }
  summary?: {
    total_orders: number
    total_revenue_cents: number
    avg_order_cents: number
    by_status: { status: string; count: number }[]
  }
  series?: { date: string; orders: number; revenue_cents: number }[]
}

type ShipmentsAnalyticsResponse = {
  success: boolean
  error?: string
  by_approval?: { approval_status: string; count: number }[]
  by_status?: { shipment_status: string; count: number }[]
  by_carrier?: { carrier: string; count: number; total_quote_cents: number }[]
  summary?: { total: number; avg_quote_cents: number; total_quote_cents: number }
}

type ProductsAnalyticsResponse = {
  success: boolean
  error?: string
  summary?: {
    total_active: number
    total_products: number
    total_stock: number
    total_value_cents: number
    low_stock_count: number
    bestsellers: number
    new_arrivals: number
  }
  low_stock?: { id: number; title: string; stock: number; price_cents: number }[]
}

type DateRange = { start: string; end: string }

// ─── Constants ────────────────────────────────────────────────────────────────

const TOKEN_STORAGE_KEY = 'lumea_admin_api_token'

const STATUS_COLORS: Record<string, string> = {
  delivered: '#10b981',
  in_transit: '#3b82f6',
  paid: '#8b5cf6',
  preparing_shipment: '#f59e0b',
  unpaid: '#6b7280',
  cancelled: '#ef4444',
  pending: '#6b7280',
  preparing: '#f59e0b',
  partially_cancelled: '#f97316',
  lost: '#dc2626'
}

const APPROVAL_COLORS: Record<string, string> = {
  approved: '#10b981',
  pending: '#f59e0b',
  rejected: '#ef4444'
}

const CHART_PALETTE = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeAdminToken(value: string): string {
  const trimmed = String(value || '').trim()
  if (!trimmed) return ''
  return trimmed.replace(/^Bearer\s+/i, '').trim()
}

async function requestJson<T>(path: string, init?: RequestInit, timeoutMs = 20000): Promise<T> {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(path, { ...init, signal: controller.signal })
    const text = await res.text()
    let payload: unknown = {}
    if (text) {
      try {
        payload = JSON.parse(text)
      } catch {
        payload = {}
      }
    }
    if (!res.ok) {
      const asRecord = payload as Record<string, unknown>
      const message =
        (typeof asRecord.error === 'string' && asRecord.error) ||
        (typeof asRecord.message === 'string' && asRecord.message) ||
        `HTTP ${res.status}`
      throw new Error(message)
    }
    return payload as T
  } finally {
    window.clearTimeout(timeoutId)
  }
}

function formatMoney(cents: number, currency = 'MXN'): string {
  return (cents / 100).toLocaleString('es-MX', { style: 'currency', currency })
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10)
}

function isoNDaysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function labelStatus(s: string): string {
  const map: Record<string, string> = {
    delivered: 'Entregado',
    in_transit: 'En tránsito',
    paid: 'Pagado',
    preparing_shipment: 'Preparando',
    unpaid: 'Sin pagar',
    cancelled: 'Cancelado',
    pending: 'Pendiente',
    preparing: 'Preparando',
    partially_cancelled: 'Parc. cancel.',
    lost: 'Perdido',
    approved: 'Aprobado',
    rejected: 'Rechazado'
  }
  return map[s] ?? s
}

function exportCsv(rows: Record<string, unknown>[], filename: string): void {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const lines = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? '')).join(','))
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  color = 'violet'
}: {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
  color?: 'violet' | 'emerald' | 'blue' | 'amber'
}): React.JSX.Element {
  const colorMap = {
    violet: 'text-violet-400 bg-violet-500/10',
    emerald: 'text-emerald-400 bg-emerald-500/10',
    blue: 'text-blue-400 bg-blue-500/10',
    amber: 'text-amber-400 bg-amber-500/10'
  }
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">{label}</span>
        <span className={cn('rounded-xl p-2', colorMap[color])}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="text-2xl font-bold tracking-tight text-zinc-100">{value}</div>
      {sub && <div className="text-xs text-zinc-500">{sub}</div>}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <h3 className="text-sm font-semibold uppercase tracking-widest text-zinc-400">{children}</h3>
  )
}

function ChartCard({
  title,
  children,
  className
}: {
  title: string
  children: React.ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <div className={cn('rounded-2xl border border-white/10 bg-white/5 p-5', className)}>
      <p className="mb-4 text-sm font-semibold text-zinc-300">{title}</p>
      {children}
    </div>
  )
}

// Custom tooltip estilo oscuro
function DarkTooltip({
  active,
  payload,
  label,
  formatter
}: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
  formatter?: (v: number, name: string) => string
}): React.JSX.Element | null {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-xs shadow-xl">
      {label && <p className="mb-1 font-semibold text-zinc-300">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {formatter ? formatter(p.value, p.name) : p.value}
        </p>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AnalyticsManager(): React.JSX.Element {
  const [adminToken, setAdminToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)
  const [loading, setLoading] = useState(false)

  const [dateRange, setDateRange] = useState<DateRange>({
    start: isoNDaysAgo(30),
    end: isoToday()
  })
  const [quickRange, setQuickRange] = useState<7 | 30 | 90 | null>(30)

  const [ordersData, setOrdersData] = useState<OrdersAnalyticsResponse | null>(null)
  const [shipmentsData, setShipmentsData] = useState<ShipmentsAnalyticsResponse | null>(null)
  const [productsData, setProductsData] = useState<ProductsAnalyticsResponse | null>(null)

  // Load token
  useEffect(() => {
    try {
      const stored = localStorage.getItem(TOKEN_STORAGE_KEY) || ''
      setAdminToken(normalizeAdminToken(stored))
    } catch {
      setAdminToken('')
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, normalizeAdminToken(adminToken))
    } catch {
      // ignore
    }
  }, [adminToken])

  const fetchAll = async (range: DateRange, token: string): Promise<void> => {
    const norm = normalizeAdminToken(token)
    if (!norm) {
      setMsg({ type: 'error', text: 'Ingresa tu ADMIN_API_TOKEN para ver los datos.' })
      return
    }
    setLoading(true)
    setMsg({ type: 'info', text: 'Cargando datos…' })

    const headers = { Authorization: `Bearer ${norm}` }
    const params = `start=${range.start}&end=${range.end}`

    try {
      const [orders, shipments, products] = await Promise.all([
        requestJson<OrdersAnalyticsResponse>(`/api/analytics/orders?${params}`, { headers }),
        requestJson<ShipmentsAnalyticsResponse>(`/api/analytics/shipments?${params}`, { headers }),
        requestJson<ProductsAnalyticsResponse>(`/api/analytics/products`, { headers })
      ])
      setOrdersData(orders)
      setShipmentsData(shipments)
      setProductsData(products)
      setMsg(null)
    } catch (error) {
      setMsg({
        type: 'error',
        text: error instanceof Error ? error.message : 'Error cargando analytics.'
      })
    } finally {
      setLoading(false)
    }
  }

  // Auto-fetch on mount once token is available
  useEffect(() => {
    const norm = normalizeAdminToken(adminToken)
    if (norm) void fetchAll(dateRange, norm)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const applyQuickRange = (days: 7 | 30 | 90): void => {
    const range = { start: isoNDaysAgo(days), end: isoToday() }
    setQuickRange(days)
    setDateRange(range)
    void fetchAll(range, adminToken)
  }

  const applyCustomRange = (): void => {
    setQuickRange(null)
    void fetchAll(dateRange, adminToken)
  }

  // ── Derived values ──
  const summary = ordersData?.summary
  const series = ordersData?.series ?? []
  const shipSummary = shipmentsData?.summary
  const prodSummary = productsData?.summary

  const revenueSeriesFormatted = series.map((s) => ({
    ...s,
    revenue: s.revenue_cents / 100
  }))

  const ordersByStatus = (summary?.by_status ?? []).map((s) => ({
    name: labelStatus(s.status),
    value: s.count,
    fill: STATUS_COLORS[s.status] ?? '#6b7280'
  }))

  const shipByApproval = (shipmentsData?.by_approval ?? []).map((s) => ({
    name: labelStatus(s.approval_status),
    value: s.count,
    fill: APPROVAL_COLORS[s.approval_status] ?? '#6b7280'
  }))

  const shipByStatus = (shipmentsData?.by_status ?? []).map((s) => ({
    name: labelStatus(s.shipment_status),
    value: s.count,
    fill: STATUS_COLORS[s.shipment_status] ?? '#6b7280'
  }))

  const carrierData = (shipmentsData?.by_carrier ?? []).map((c, i) => ({
    name: c.carrier,
    envios: c.count,
    cotizacion: c.total_quote_cents / 100,
    fill: CHART_PALETTE[i % CHART_PALETTE.length]
  }))

  const hasData = !!ordersData && !!shipmentsData && !!productsData

  return (
    <div className="relative flex h-[calc(100vh-80px)] w-full flex-col gap-0 overflow-hidden rounded-[32px] border border-white/10 bg-zinc-950/80 text-zinc-100 shadow-2xl">
      {/* Toast */}
      {msg && (
        <div
          className={cn(
            'absolute right-6 top-6 z-50 flex max-w-sm items-center gap-3 rounded-2xl border px-4 py-3 text-sm shadow-xl',
            msg.type === 'error' && 'border-rose-500/30 bg-rose-500/10 text-rose-200',
            msg.type === 'success' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
            msg.type === 'info' && 'border-sky-500/30 bg-sky-500/10 text-sky-200'
          )}
        >
          {msg.type === 'error' ? (
            <AlertCircle className="h-5 w-5 shrink-0" />
          ) : (
            <RefreshCw className={cn('h-5 w-5 shrink-0', msg.type === 'info' && 'animate-spin')} />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-white/5 px-6 py-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Inteligencia de Negocio</h2>
          <p className="text-xs text-zinc-500">Métricas de ventas, envíos e inventario</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Quick ranges */}
          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
            {([7, 30, 90] as const).map((d) => (
              <button
                key={d}
                onClick={() => applyQuickRange(d)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition',
                  quickRange === d
                    ? 'bg-violet-600 text-white'
                    : 'text-zinc-400 hover:bg-white/10 hover:text-zinc-100'
                )}
              >
                {d}d
              </button>
            ))}
          </div>

          {/* Custom date range */}
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange((r) => ({ ...r, start: e.target.value }))}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
          <span className="text-zinc-500 text-xs">–</span>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange((r) => ({ ...r, end: e.target.value }))}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
          <button
            onClick={applyCustomRange}
            className="rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-500"
          >
            Aplicar
          </button>

          {/* Refresh */}
          <button
            onClick={() => void fetchAll(dateRange, adminToken)}
            disabled={loading}
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100 disabled:opacity-40"
            title="Recargar"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>

          {/* Export */}
          {hasData && (
            <button
              onClick={() =>
                exportCsv(
                  series.map((s) => ({
                    fecha: s.date,
                    pedidos: s.orders,
                    ingresos_mxn: (s.revenue_cents / 100).toFixed(2)
                  })),
                  `lumea-ventas-${dateRange.start}-${dateRange.end}.csv`
                )
              }
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
          )}
        </div>
      </div>

      {/* Token bar */}
      <div className="flex shrink-0 items-center gap-3 border-b border-white/5 bg-white/[0.02] px-6 py-2">
        <span className="text-xs text-zinc-500">Token:</span>
        <input
          type={showToken ? 'text' : 'password'}
          value={adminToken}
          onChange={(e) => setAdminToken(e.target.value)}
          placeholder="ADMIN_API_TOKEN"
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
        <button
          onClick={() => setShowToken((v) => !v)}
          className="text-zinc-500 hover:text-zinc-300"
          title={showToken ? 'Ocultar' : 'Mostrar'}
        >
          {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
        <button
          onClick={() => void fetchAll(dateRange, adminToken)}
          disabled={loading || !adminToken}
          className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:opacity-40"
        >
          Cargar
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {!hasData && !loading && (
          <div className="flex h-40 items-center justify-center text-sm text-zinc-500">
            Ingresa tu token y haz clic en{' '}
            <span className="mx-1 font-semibold text-violet-400">Cargar</span> para ver las
            métricas.
          </div>
        )}

        {hasData && (
          <div className="space-y-8">
            {/* ── KPI cards ── */}
            <section>
              <SectionTitle>Resumen del periodo</SectionTitle>
              <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <KpiCard
                  label="Total Pedidos"
                  value={String(summary?.total_orders ?? 0)}
                  sub={`${dateRange.start} → ${dateRange.end}`}
                  icon={ShoppingBag}
                  color="violet"
                />
                <KpiCard
                  label="Ingresos Totales"
                  value={formatMoney(summary?.total_revenue_cents ?? 0)}
                  sub="Suma de total_amount"
                  icon={TrendingUp}
                  color="emerald"
                />
                <KpiCard
                  label="Ticket Promedio"
                  value={formatMoney(summary?.avg_order_cents ?? 0)}
                  sub="Promedio por pedido"
                  icon={TrendingUp}
                  color="blue"
                />
                <KpiCard
                  label="Productos Activos"
                  value={String(prodSummary?.total_active ?? 0)}
                  sub={`Stock total: ${prodSummary?.total_stock ?? 0} uds`}
                  icon={Package}
                  color="amber"
                />
              </div>
            </section>

            {/* ── Shipments KPIs ── */}
            <section>
              <SectionTitle>Envíos del periodo</SectionTitle>
              <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <KpiCard
                  label="Total Envíos"
                  value={String(shipSummary?.total ?? 0)}
                  icon={Truck}
                  color="blue"
                />
                <KpiCard
                  label="Cotización Promedio"
                  value={formatMoney(shipSummary?.avg_quote_cents ?? 0)}
                  sub="Costo prom. de guía"
                  icon={Truck}
                  color="amber"
                />
                <KpiCard
                  label="Total Cotizaciones"
                  value={formatMoney(shipSummary?.total_quote_cents ?? 0)}
                  sub="Suma de guías"
                  icon={Truck}
                  color="violet"
                />
                <KpiCard
                  label="Stock Bajo (≤5)"
                  value={String(prodSummary?.low_stock_count ?? 0)}
                  sub="Productos activos"
                  icon={Package}
                  color="amber"
                />
              </div>
            </section>

            {/* ── Revenue chart ── */}
            {revenueSeriesFormatted.length > 0 && (
              <section>
                <SectionTitle>Ingresos diarios</SectionTitle>
                <ChartCard title="Ingresos por día (MXN)" className="mt-4">
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart
                      data={revenueSeriesFormatted}
                      margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                    >
                      <defs>
                        <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: '#71717a', fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fill: '#71717a', fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v: number) => `$${v.toLocaleString('es-MX')}`}
                      />
                      <Tooltip
                        content={
                          <DarkTooltip
                            formatter={(v, name) =>
                              name === 'revenue'
                                ? `$${v.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
                                : String(v)
                            }
                          />
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        name="Ingresos"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        fill="url(#gradRevenue)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartCard>
              </section>
            )}

            {/* ── Orders by status + Shipment approval ── */}
            <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {ordersByStatus.length > 0 && (
                <ChartCard title="Pedidos por estado">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      data={ordersByStatus}
                      layout="vertical"
                      margin={{ top: 0, right: 10, left: 20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fill: '#71717a', fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        dataKey="name"
                        type="category"
                        tick={{ fill: '#a1a1aa', fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        width={90}
                      />
                      <Tooltip content={<DarkTooltip />} />
                      <Bar dataKey="value" name="Pedidos" radius={[0, 6, 6, 0]}>
                        {ordersByStatus.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}

              {shipByApproval.length > 0 && (
                <ChartCard title="Aprobación de envíos">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={shipByApproval}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                        nameKey="name"
                      >
                        {shipByApproval.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip content={<DarkTooltip />} />
                      <Legend
                        formatter={(value) => (
                          <span style={{ color: '#a1a1aa', fontSize: 11 }}>{value}</span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}
            </section>

            {/* ── Shipment status + Carriers ── */}
            <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {shipByStatus.length > 0 && (
                <ChartCard title="Estado de envíos">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={shipByStatus}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                        nameKey="name"
                      >
                        {shipByStatus.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip content={<DarkTooltip />} />
                      <Legend
                        formatter={(value) => (
                          <span style={{ color: '#a1a1aa', fontSize: 11 }}>{value}</span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}

              {carrierData.length > 0 && (
                <ChartCard title="Envíos por carrier">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      data={carrierData}
                      layout="vertical"
                      margin={{ top: 0, right: 10, left: 20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fill: '#71717a', fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        dataKey="name"
                        type="category"
                        tick={{ fill: '#a1a1aa', fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        width={90}
                      />
                      <Tooltip
                        content={
                          <DarkTooltip
                            formatter={(v, name) =>
                              name === 'cotizacion'
                                ? `$${v.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
                                : String(v)
                            }
                          />
                        }
                      />
                      <Bar dataKey="envios" name="Envíos" radius={[0, 6, 6, 0]}>
                        {carrierData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}
            </section>

            {/* ── Inventory badges ── */}
            <section>
              <SectionTitle>Inventario</SectionTitle>
              <div className="mt-4 flex flex-wrap gap-3">
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm">
                  <span className="text-zinc-500">Valor inventario:</span>{' '}
                  <span className="font-semibold text-emerald-400">
                    {formatMoney(prodSummary?.total_value_cents ?? 0)}
                  </span>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm">
                  <span className="text-zinc-500">Bestsellers:</span>{' '}
                  <span className="font-semibold text-violet-400">
                    {prodSummary?.bestsellers ?? 0}
                  </span>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm">
                  <span className="text-zinc-500">Novedades:</span>{' '}
                  <span className="font-semibold text-blue-400">
                    {prodSummary?.new_arrivals ?? 0}
                  </span>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm">
                  <span className="text-zinc-500">Total productos:</span>{' '}
                  <span className="font-semibold text-zinc-100">
                    {prodSummary?.total_products ?? 0}
                  </span>
                </div>
              </div>
            </section>

            {/* ── Low stock table ── */}
            {(productsData?.low_stock?.length ?? 0) > 0 && (
              <section>
                <SectionTitle>Productos con stock bajo (≤5 unidades)</SectionTitle>
                <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/5 text-xs text-zinc-400">
                        <th className="px-4 py-3 text-left font-medium">Producto</th>
                        <th className="px-4 py-3 text-right font-medium">Stock</th>
                        <th className="px-4 py-3 text-right font-medium">Precio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productsData!.low_stock!.map((p, i) => (
                        <tr
                          key={p.id}
                          className={cn(
                            'border-b border-white/5 transition hover:bg-white/5',
                            i % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.02]'
                          )}
                        >
                          <td className="px-4 py-3 text-zinc-200">{p.title}</td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className={cn(
                                'rounded-full px-2 py-0.5 text-xs font-semibold',
                                p.stock === 0
                                  ? 'bg-rose-500/20 text-rose-300'
                                  : 'bg-amber-500/20 text-amber-300'
                              )}
                            >
                              {p.stock}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-zinc-400">
                            {formatMoney(p.price_cents)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
