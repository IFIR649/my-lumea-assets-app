import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Eye,
  RefreshCw,
  Save,
  Search,
  X
} from 'lucide-react'
import { cn } from '../lib/utils'

type Msg = { type: 'error' | 'success' | 'info'; text: string } | null

type DisplayStatus =
  | 'cancelado'
  | 'perdido'
  | 'pendiente_pago'
  | 'preparando_envio'
  | 'en_camino'
  | 'entregado'
  | 'pagado'

type ShippingStatus = 'pending' | 'preparing' | 'in_transit' | 'delivered' | 'cancelled' | 'lost'

type OrderSummary = {
  id: string
  stripe_session_id: string | null
  customer_email: string
  customer_name: string | null
  customer_phone: string | null
  total_amount_cents: number
  currency: string
  status: string
  shipping_status: string
  created_at: string
  updated_at: string
  units_total: number
  items_count: number
  display_status: DisplayStatus
}

type OrdersListResponse = {
  success: boolean
  orders?: OrderSummary[]
  page?: number
  limit?: number
  has_prev?: boolean
  has_next?: boolean
  error?: string
}

type OrderItem = {
  id: number
  order_id: string
  product_id: number
  product_slug: string
  quantity: number
  unit_price_cents: number
  amount_cents: number
  product_title: string | null
  product_type: string | null
  product_image_key: string | null
}

type OrderDetail = {
  id: string
  stripe_session_id: string | null
  status: string
  shipping_status: ShippingStatus
  display_status: DisplayStatus
  customer_email: string
  customer_name: string | null
  customer_phone: string | null
  shipping_address_json: string | null
  shipping_address: unknown
  total_amount_cents: number
  currency: string
  internal_note: string | null
  created_at: string
  updated_at: string
  summary: {
    units_total: number
    items_count: number
    subtotal_cents: number
    total_amount_cents: number
    currency: string
  }
  items: OrderItem[]
  reservations: Array<Record<string, unknown>>
  stripe_events: Array<Record<string, unknown>>
}

type OrderDetailResponse = {
  success: boolean
  order?: OrderDetail
  error?: string
}

type OrderFilters = {
  q: string
  status: '' | DisplayStatus
  amount_min: string
  amount_max: string
  date_from: string
  date_to: string
  qty_min: string
  qty_max: string
  product_q: string
}

type EditForm = {
  shipping_status: ShippingStatus
  customer_name: string
  customer_email: string
  customer_phone: string
  shipping_address_json: string
  internal_note: string
}

const TOKEN_STORAGE_KEY = 'lumea_admin_api_token'

const EMPTY_FILTERS: OrderFilters = {
  q: '',
  status: '',
  amount_min: '',
  amount_max: '',
  date_from: '',
  date_to: '',
  qty_min: '',
  qty_max: '',
  product_q: ''
}

function formatMoney(cents: number, currency = 'MXN'): string {
  try {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: currency || 'MXN',
      minimumFractionDigits: 2
    }).format((Number(cents) || 0) / 100)
  } catch {
    return `$${((Number(cents) || 0) / 100).toFixed(2)}`
  }
}

function formatDate(value: string): string {
  if (!value) return '-'
  const iso = value.includes('T') ? value : value.replace(' ', 'T')
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date)
}

function statusLabel(status: DisplayStatus): string {
  if (status === 'cancelado') return 'Cancelado'
  if (status === 'perdido') return 'Perdido'
  if (status === 'pendiente_pago') return 'Pendiente de pago'
  if (status === 'preparando_envio') return 'Preparando envio'
  if (status === 'en_camino') return 'En camino'
  if (status === 'entregado') return 'Entregado'
  return 'Pagado'
}

function statusClass(status: DisplayStatus): string {
  if (status === 'cancelado') return 'bg-rose-500/15 text-rose-200 border-rose-400/35'
  if (status === 'perdido') return 'bg-orange-500/15 text-orange-200 border-orange-400/35'
  if (status === 'pendiente_pago') return 'bg-gold/10 text-brand border-brand/30'
  if (status === 'preparando_envio') return 'bg-amber-500/15 text-amber-200 border-amber-400/35'
  if (status === 'en_camino') return 'bg-sky-500/15 text-sky-200 border-sky-400/35'
  if (status === 'entregado') return 'bg-emerald-500/15 text-emerald-200 border-emerald-400/35'
  return 'bg-zinc-500/15 text-zinc-200 border-zinc-400/35'
}

function buildQuery(page: number, filters: OrderFilters): string {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('limit', '10')
  if (filters.q.trim()) params.set('q', filters.q.trim())
  if (filters.status) params.set('status', filters.status)
  if (filters.amount_min.trim()) params.set('amount_min', filters.amount_min.trim())
  if (filters.amount_max.trim()) params.set('amount_max', filters.amount_max.trim())
  if (filters.date_from) params.set('date_from', filters.date_from)
  if (filters.date_to) params.set('date_to', filters.date_to)
  if (filters.qty_min.trim()) params.set('qty_min', filters.qty_min.trim())
  if (filters.qty_max.trim()) params.set('qty_max', filters.qty_max.trim())
  if (filters.product_q.trim()) params.set('product_q', filters.product_q.trim())
  return params.toString()
}

function normalizeAddressJson(value: string | null): string {
  if (!value) return ''
  try {
    const parsed = JSON.parse(value)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return value
  }
}

function normalizeAdminToken(value: string): string {
  const trimmed = String(value || '').trim()
  if (!trimmed) return ''
  const withoutPrefix = trimmed.replace(/^Bearer\s+/i, '')
  return withoutPrefix.trim()
}

async function requestJson<T>(path: string, init?: RequestInit, timeoutMs = 15000): Promise<T> {
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

export default function OrdersManager(): React.JSX.Element {
  const [draftFilters, setDraftFilters] = useState<OrderFilters>(EMPTY_FILTERS)
  const [appliedFilters, setAppliedFilters] = useState<OrderFilters>(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [hasPrev, setHasPrev] = useState(false)
  const [hasNext, setHasNext] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [adminToken, setAdminToken] = useState('')
  const [showToken, setShowToken] = useState(false)

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [savingDetail, setSavingDetail] = useState(false)
  const [detailMsg, setDetailMsg] = useState<Msg>(null)
  const [editForm, setEditForm] = useState<EditForm>({
    shipping_status: 'pending',
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    shipping_address_json: '',
    internal_note: ''
  })

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
      // Ignore storage failures (privacy mode or restricted environment).
    }
  }, [adminToken])

  useEffect(() => {
    let alive = true
    const load = async (): Promise<void> => {
      setLoadingOrders(true)
      setMsg(null)
      try {
        const query = buildQuery(page, appliedFilters)
        const data = await requestJson<OrdersListResponse>(`/api/orders?${query}`)
        if (!alive) return
        if (!data.success) throw new Error(data.error || 'No se pudo listar pedidos.')
        setOrders(data.orders || [])
        setHasPrev(Boolean(data.has_prev))
        setHasNext(Boolean(data.has_next))
      } catch (error) {
        if (!alive) return
        setOrders([])
        setHasPrev(false)
        setHasNext(false)
        setMsg({
          type: 'error',
          text: error instanceof Error ? error.message : 'Error cargando pedidos.'
        })
      } finally {
        if (alive) setLoadingOrders(false)
      }
    }
    void load()
    return () => {
      alive = false
    }
  }, [page, appliedFilters, reloadKey])

  const activeOrder = useMemo(
    () => (selectedOrder && selectedOrder.id === selectedOrderId ? selectedOrder : null),
    [selectedOrder, selectedOrderId]
  )

  const buildEditFormFromOrder = (order: OrderDetail): EditForm => ({
    shipping_status: order.shipping_status || 'pending',
    customer_name: order.customer_name || '',
    customer_email: order.customer_email || '',
    customer_phone: order.customer_phone || '',
    shipping_address_json: normalizeAddressJson(order.shipping_address_json),
    internal_note: order.internal_note || ''
  })

  const applyFilters = (): void => {
    setPage(1)
    setAppliedFilters({ ...draftFilters })
  }

  const clearFilters = (): void => {
    setDraftFilters(EMPTY_FILTERS)
    setAppliedFilters(EMPTY_FILTERS)
    setPage(1)
  }

  const openOrderDetail = async (orderId: string): Promise<void> => {
    setSelectedOrderId(orderId)
    setSelectedOrder(null)
    setDetailMsg(null)
    setLoadingDetail(true)
    try {
      const data = await requestJson<OrderDetailResponse>(`/api/orders/${encodeURIComponent(orderId)}`)
      if (!data.success || !data.order) {
        throw new Error(data.error || 'No se pudo obtener el detalle.')
      }
      setSelectedOrder(data.order)
      setEditForm(buildEditFormFromOrder(data.order))
    } catch (error) {
      setDetailMsg({
        type: 'error',
        text: error instanceof Error ? error.message : 'Error cargando detalle.'
      })
    } finally {
      setLoadingDetail(false)
    }
  }

  const closeDetail = (): void => {
    setSelectedOrderId(null)
    setSelectedOrder(null)
    setDetailMsg(null)
  }

  const saveOrderChanges = async (): Promise<void> => {
    if (!selectedOrderId) return
    let normalizedToken = normalizeAdminToken(adminToken)
    if (!normalizedToken) {
      const prompted = window.prompt('Pega tu ADMIN_API_TOKEN para guardar cambios:')
      normalizedToken = normalizeAdminToken(prompted || '')
      if (normalizedToken) {
        setAdminToken(normalizedToken)
      } else {
        setDetailMsg({ type: 'error', text: 'Ingresa token administrativo para guardar cambios.' })
        return
      }
    }

    const payload: Record<string, unknown> = {
      shipping_status: editForm.shipping_status,
      customer_name: editForm.customer_name.trim() || null,
      customer_email: editForm.customer_email.trim(),
      customer_phone: editForm.customer_phone.trim() || null,
      internal_note: editForm.internal_note.trim() || null
    }

    const shippingText = editForm.shipping_address_json.trim()
    if (shippingText) {
      try {
        payload.shipping_address_json = JSON.parse(shippingText)
      } catch {
        setDetailMsg({ type: 'error', text: 'shipping_address_json no es JSON valido.' })
        return
      }
    } else {
      payload.shipping_address_json = null
    }

    setSavingDetail(true)
    setDetailMsg({ type: 'info', text: 'Guardando cambios...' })

    try {
      const data = await requestJson<OrderDetailResponse>(`/api/orders/${encodeURIComponent(selectedOrderId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${normalizedToken}`
        },
        body: JSON.stringify(payload)
      })
      if (!data.success || !data.order) throw new Error(data.error || 'No se pudo guardar.')

      setSelectedOrder(data.order)
      setEditForm(buildEditFormFromOrder(data.order))

      setDetailMsg({ type: 'success', text: 'Pedido actualizado.' })
      setReloadKey((value) => value + 1)
    } catch (error) {
      setDetailMsg({
        type: 'error',
        text: error instanceof Error ? error.message : 'Error guardando cambios.'
      })
    } finally {
      setSavingDetail(false)
    }
  }

  const resetOrderChanges = (): void => {
    if (!activeOrder) return
    setEditForm(buildEditFormFromOrder(activeOrder))
    setDetailMsg({ type: 'info', text: 'Cambios locales descartados.' })
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4">
      {msg && (
        <div
          className={cn(
            'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm',
            msg.type === 'error' && 'bg-rose-500/10 text-rose-200',
            msg.type === 'success' && 'bg-emerald-500/10 text-emerald-200',
            msg.type === 'info' && 'bg-sky-500/10 text-sky-200'
          )}
        >
          {msg.type === 'error' ? (
            <AlertCircle className="h-4 w-4" />
          ) : (
            <RefreshCw className={cn('h-4 w-4', msg.type === 'info' && 'animate-spin')} />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      <section className="rounded-3xl border border-white/5 bg-white/[0.02] p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Pedidos</h2>
            <p className="text-sm text-zinc-400">Ultimos 10 por pagina con filtros avanzados.</p>
          </div>
          <button
            type="button"
            onClick={() => setReloadKey((value) => value + 1)}
            className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs font-semibold"
          >
            <RefreshCw className={cn('h-4 w-4', loadingOrders && 'animate-spin')} />
            Recargar
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={draftFilters.q}
              onChange={(event) => setDraftFilters((prev) => ({ ...prev, q: event.target.value }))}
              placeholder="Buscar ID/orden"
              className="w-full rounded-xl border border-white/10 bg-surface100 py-2.5 pl-9 pr-3 text-sm"
            />
          </label>

          <select
            value={draftFilters.status}
            onChange={(event) =>
              setDraftFilters((prev) => ({
                ...prev,
                status: event.target.value as OrderFilters['status']
              }))
            }
            className="rounded-xl border border-white/10 bg-surface100 px-3 py-2.5 text-sm"
          >
            <option value="">Todos los estados</option>
            <option value="pendiente_pago">Pendiente de pago</option>
            <option value="pagado">Pagado</option>
            <option value="preparando_envio">Preparando envio</option>
            <option value="en_camino">En camino</option>
            <option value="entregado">Entregado</option>
            <option value="cancelado">Cancelado</option>
            <option value="perdido">Perdido</option>
          </select>

          <input
            value={draftFilters.amount_min}
            onChange={(event) => setDraftFilters((prev) => ({ ...prev, amount_min: event.target.value }))}
            type="number"
            min="0"
            step="0.01"
            placeholder="Monto min MXN"
            className="rounded-xl border border-white/10 bg-surface100 px-3 py-2.5 text-sm"
          />

          <input
            value={draftFilters.amount_max}
            onChange={(event) => setDraftFilters((prev) => ({ ...prev, amount_max: event.target.value }))}
            type="number"
            min="0"
            step="0.01"
            placeholder="Monto max MXN"
            className="rounded-xl border border-white/10 bg-surface100 px-3 py-2.5 text-sm"
          />

          <input
            value={draftFilters.date_from}
            onChange={(event) => setDraftFilters((prev) => ({ ...prev, date_from: event.target.value }))}
            type="date"
            className="rounded-xl border border-white/10 bg-surface100 px-3 py-2.5 text-sm"
          />

          <input
            value={draftFilters.date_to}
            onChange={(event) => setDraftFilters((prev) => ({ ...prev, date_to: event.target.value }))}
            type="date"
            className="rounded-xl border border-white/10 bg-surface100 px-3 py-2.5 text-sm"
          />

          <input
            value={draftFilters.qty_min}
            onChange={(event) => setDraftFilters((prev) => ({ ...prev, qty_min: event.target.value }))}
            type="number"
            min="0"
            step="1"
            placeholder="Unidades min"
            className="rounded-xl border border-white/10 bg-surface100 px-3 py-2.5 text-sm"
          />

          <input
            value={draftFilters.qty_max}
            onChange={(event) => setDraftFilters((prev) => ({ ...prev, qty_max: event.target.value }))}
            type="number"
            min="0"
            step="1"
            placeholder="Unidades max"
            className="rounded-xl border border-white/10 bg-surface100 px-3 py-2.5 text-sm"
          />

          <input
            value={draftFilters.product_q}
            onChange={(event) => setDraftFilters((prev) => ({ ...prev, product_q: event.target.value }))}
            placeholder="Producto en la orden"
            className="md:col-span-2 lg:col-span-2 rounded-xl border border-white/10 bg-surface100 px-3 py-2.5 text-sm"
          />

          <input
            value={adminToken}
            onChange={(event) => setAdminToken(normalizeAdminToken(event.target.value))}
            placeholder="Admin token (Bearer)"
            className="md:col-span-2 lg:col-span-2 rounded-xl border border-white/10 bg-surface100 px-3 py-2.5 text-sm"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={applyFilters} className="rounded-xl bg-brand px-3 py-2 text-xs font-semibold text-black">
            Aplicar
          </button>
          <button type="button" onClick={clearFilters} className="rounded-xl bg-white/5 px-3 py-2 text-xs font-semibold">
            Limpiar
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-white/5 bg-white/[0.02] p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-zinc-400">Resultados: {loadingOrders ? '...' : orders.length}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!hasPrev || loadingOrders}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className={cn(
                'inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold',
                !hasPrev || loadingOrders ? 'cursor-not-allowed bg-white/5 text-zinc-500' : 'bg-white/10 text-zinc-200'
              )}
            >
              <ArrowLeft className="h-4 w-4" />
              Prev
            </button>
            <span className="rounded-lg bg-black/30 px-3 py-1.5 text-xs">Pag {page}</span>
            <button
              type="button"
              disabled={!hasNext || loadingOrders}
              onClick={() => setPage((value) => value + 1)}
              className={cn(
                'inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold',
                !hasNext || loadingOrders ? 'cursor-not-allowed bg-white/5 text-zinc-500' : 'bg-white/10 text-zinc-200'
              )}
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {loadingOrders ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-zinc-400">
            Cargando pedidos...
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-zinc-400">
            No hay pedidos para los filtros actuales.
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <article key={order.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold">{order.id}</p>
                    <p className="text-xs text-zinc-500">{order.customer_email}</p>
                  </div>
                  <span
                    className={cn(
                      'inline-flex w-fit items-center rounded-lg border px-2.5 py-1 text-[11px] uppercase tracking-[0.12em]',
                      statusClass(order.display_status)
                    )}
                  >
                    {statusLabel(order.display_status)}
                  </span>
                </div>

                <div className="mt-3 grid gap-2 text-xs text-zinc-400 sm:grid-cols-2 lg:grid-cols-4">
                  <div>Total: <span className="text-zinc-200">{formatMoney(order.total_amount_cents, order.currency)}</span></div>
                  <div>Unidades: <span className="text-zinc-200">{order.units_total}</span></div>
                  <div>Items: <span className="text-zinc-200">{order.items_count}</span></div>
                  <div>Fecha: <span className="text-zinc-200">{formatDate(order.created_at)}</span></div>
                </div>

                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => void openOrderDetail(order.id)}
                    className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold"
                  >
                    <Eye className="h-4 w-4" />
                    Ver mas info
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {selectedOrderId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-3 py-4">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-auto rounded-3xl border border-white/10 bg-surface p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold">Detalle de pedido {selectedOrderId}</h3>
              <button type="button" onClick={closeDetail} className="rounded-lg bg-white/10 p-2">
                <X className="h-4 w-4" />
              </button>
            </div>

            {detailMsg && (
              <div
                className={cn(
                  'mb-4 rounded-xl px-3 py-2 text-sm',
                  detailMsg.type === 'error' && 'bg-rose-500/10 text-rose-200',
                  detailMsg.type === 'success' && 'bg-emerald-500/10 text-emerald-200',
                  detailMsg.type === 'info' && 'bg-sky-500/10 text-sky-200'
                )}
              >
                {detailMsg.text}
              </div>
            )}

            {loadingDetail ? (
              <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-400">
                Cargando detalle...
              </div>
            ) : !activeOrder ? (
              <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-400">
                No se pudo cargar el detalle de la orden.
              </div>
            ) : (
              <div className="space-y-4">
                <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="grid gap-2 text-sm md:grid-cols-2 lg:grid-cols-3">
                    <p>ID: <span className="text-zinc-200">{activeOrder.id}</span></p>
                    <p>Estado pago: <span className="text-zinc-200">{activeOrder.status}</span></p>
                    <p>Estado visible: <span className="text-zinc-200">{statusLabel(activeOrder.display_status)}</span></p>
                    <p>Total: <span className="text-zinc-200">{formatMoney(activeOrder.total_amount_cents, activeOrder.currency)}</span></p>
                    <p>Creado: <span className="text-zinc-200">{formatDate(activeOrder.created_at)}</span></p>
                    <p>Actualizado: <span className="text-zinc-200">{formatDate(activeOrder.updated_at)}</span></p>
                  </div>
                </section>

                <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <h4 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400">Cliente y envio</h4>
                  <div className="grid gap-2 text-sm md:grid-cols-2">
                    <p>Email: <span className="text-zinc-200">{activeOrder.customer_email || '-'}</span></p>
                    <p>Nombre: <span className="text-zinc-200">{activeOrder.customer_name || '-'}</span></p>
                    <p>Telefono: <span className="text-zinc-200">{activeOrder.customer_phone || '-'}</span></p>
                    <p>Moneda: <span className="text-zinc-200">{activeOrder.currency || 'MXN'}</span></p>
                  </div>
                  {activeOrder.shipping_address ? (
                    <pre className="mt-3 overflow-auto rounded-xl border border-white/10 bg-black/25 p-3 text-xs text-zinc-300">
                      {typeof activeOrder.shipping_address === 'string'
                        ? activeOrder.shipping_address
                        : JSON.stringify(activeOrder.shipping_address, null, 2)}
                    </pre>
                  ) : (
                    <p className="mt-3 text-sm text-zinc-500">Sin direccion de envio registrada.</p>
                  )}
                </section>

                <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <h4 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400">Editar operacion</h4>
                  <div className="mb-3 grid gap-2 md:grid-cols-[1fr_auto]">
                    <input
                      value={adminToken}
                      onChange={(event) => setAdminToken(normalizeAdminToken(event.target.value))}
                      type={showToken ? 'text' : 'password'}
                      placeholder="ADMIN_API_TOKEN"
                      className="rounded-xl border border-white/10 bg-surface100 px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken((value) => !value)}
                      className="rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold"
                    >
                      {showToken ? 'Ocultar token' : 'Mostrar token'}
                    </button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <select
                      value={editForm.shipping_status}
                      onChange={(event) =>
                        setEditForm((prev) => ({
                          ...prev,
                          shipping_status: event.target.value as ShippingStatus
                        }))
                      }
                      className="rounded-xl border border-white/10 bg-surface100 px-3 py-2 text-sm"
                    >
                      <option value="pending">Pendiente</option>
                      <option value="preparing">Preparando</option>
                      <option value="in_transit">En transito</option>
                      <option value="delivered">Entregado</option>
                      <option value="cancelled">Cancelado</option>
                      <option value="lost">Perdido</option>
                    </select>
                    <input
                      value={editForm.customer_email}
                      onChange={(event) =>
                        setEditForm((prev) => ({ ...prev, customer_email: event.target.value }))
                      }
                      placeholder="Email cliente"
                      className="rounded-xl border border-white/10 bg-surface100 px-3 py-2 text-sm"
                    />
                    <input
                      value={editForm.customer_name}
                      onChange={(event) =>
                        setEditForm((prev) => ({ ...prev, customer_name: event.target.value }))
                      }
                      placeholder="Nombre cliente"
                      className="rounded-xl border border-white/10 bg-surface100 px-3 py-2 text-sm"
                    />
                    <input
                      value={editForm.customer_phone}
                      onChange={(event) =>
                        setEditForm((prev) => ({ ...prev, customer_phone: event.target.value }))
                      }
                      placeholder="Telefono cliente"
                      className="rounded-xl border border-white/10 bg-surface100 px-3 py-2 text-sm"
                    />
                  </div>
                  <textarea
                    value={editForm.shipping_address_json}
                    onChange={(event) =>
                      setEditForm((prev) => ({ ...prev, shipping_address_json: event.target.value }))
                    }
                    rows={6}
                    className="mt-3 w-full rounded-xl border border-white/10 bg-surface100 px-3 py-2 text-xs outline-none"
                    placeholder="shipping_address_json"
                  />
                  <textarea
                    value={editForm.internal_note}
                    onChange={(event) =>
                      setEditForm((prev) => ({ ...prev, internal_note: event.target.value }))
                    }
                    rows={3}
                    className="mt-3 w-full rounded-xl border border-white/10 bg-surface100 px-3 py-2 text-sm outline-none"
                    placeholder="Nota interna"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={savingDetail}
                      onClick={() => void saveOrderChanges()}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold',
                        savingDetail
                          ? 'cursor-not-allowed bg-surface200 text-zinc-500'
                          : 'bg-brand text-black'
                      )}
                    >
                      <Save className="h-4 w-4" />
                      {savingDetail ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                    <button
                      type="button"
                      disabled={savingDetail || !activeOrder}
                      onClick={resetOrderChanges}
                      className={cn(
                        'rounded-xl px-3 py-2 text-xs font-semibold',
                        savingDetail || !activeOrder
                          ? 'cursor-not-allowed bg-surface200 text-zinc-500'
                          : 'bg-white/10 text-zinc-100'
                      )}
                    >
                      Cancelar cambios
                    </button>
                  </div>
                </section>

                <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <h4 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400">Articulos</h4>
                  {activeOrder.items.length === 0 ? (
                    <p className="text-sm text-zinc-500">Sin articulos.</p>
                  ) : (
                    <div className="space-y-2">
                      {activeOrder.items.map((item) => (
                        <div key={item.id} className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-zinc-200">{item.product_title || item.product_slug}</p>
                            <p className="text-zinc-200">
                              {item.quantity} x {formatMoney(item.unit_price_cents, activeOrder.currency)}
                            </p>
                          </div>
                          <p className="mt-1 text-zinc-500">Slug: {item.product_slug}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <h4 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400">Metadatos operativos</h4>
                  <div className="grid gap-2 text-sm md:grid-cols-2">
                    <p>Stripe session: <span className="text-zinc-200">{activeOrder.stripe_session_id || '-'}</span></p>
                    <p>Nota interna: <span className="text-zinc-200">{activeOrder.internal_note || '-'}</span></p>
                    <p>Reservas: <span className="text-zinc-200">{activeOrder.reservations.length}</span></p>
                    <p>Eventos Stripe: <span className="text-zinc-200">{activeOrder.stripe_events.length}</span></p>
                  </div>

                  {activeOrder.reservations.length > 0 ? (
                    <div className="mt-3 rounded-xl border border-white/10 bg-black/25 p-3">
                      <p className="mb-2 text-xs uppercase tracking-[0.14em] text-zinc-500">Reservas</p>
                      <pre className="overflow-auto text-xs text-zinc-300">
                        {JSON.stringify(activeOrder.reservations, null, 2)}
                      </pre>
                    </div>
                  ) : null}

                  {activeOrder.stripe_events.length > 0 ? (
                    <div className="mt-3 rounded-xl border border-white/10 bg-black/25 p-3">
                      <p className="mb-2 text-xs uppercase tracking-[0.14em] text-zinc-500">Eventos Stripe</p>
                      <pre className="overflow-auto text-xs text-zinc-300">
                        {JSON.stringify(activeOrder.stripe_events, null, 2)}
                      </pre>
                    </div>
                  ) : null}
                </section>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
