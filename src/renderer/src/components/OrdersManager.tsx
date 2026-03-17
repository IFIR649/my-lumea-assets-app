import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, ArrowLeft, ArrowRight, Eye, RefreshCw, Save, Search, X } from 'lucide-react'
import { cn } from '../lib/utils'

type Msg = { type: 'error' | 'success' | 'info'; text: string } | null

type DisplayStatus =
  | 'cancelado'
  | 'cancelado_parcial'
  | 'perdido'
  | 'pendiente_pago'
  | 'preparando_envio'
  | 'en_camino'
  | 'entregado'
  | 'pagado'

type ShippingStatus =
  | 'pending'
  | 'preparing'
  | 'in_transit'
  | 'delivered'
  | 'partially_cancelled'
  | 'cancelled'
  | 'lost'

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
  if (status === 'cancelado_parcial') return 'Cancelado parcial'
  if (status === 'perdido') return 'Perdido'
  if (status === 'pendiente_pago') return 'Pendiente de pago'
  if (status === 'preparando_envio') return 'Preparando envio'
  if (status === 'en_camino') return 'En camino'
  if (status === 'entregado') return 'Entregado'
  return 'Pagado'
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
      const data = await requestJson<OrderDetailResponse>(
        `/api/orders/${encodeURIComponent(orderId)}`
      )
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
      const data = await requestJson<OrderDetailResponse>(
        `/api/orders/${encodeURIComponent(selectedOrderId)}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${normalizedToken}`
          },
          body: JSON.stringify(payload)
        }
      )
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
    <div className="relative flex h-[calc(100vh-80px)] w-full flex-col gap-6 overflow-hidden rounded-[32px] border border-white/10 bg-surface/80 p-6 text-zinc-100 font-sans shadow-2xl xl:flex-row">
      {/* Toast Messages */}
      {msg && (
        <div
          className={cn(
            'absolute right-8 top-8 z-50 flex max-w-sm items-center gap-3 rounded-2xl border px-4 py-3 text-sm shadow-xl',
            msg.type === 'error' && 'border-rose-500/30 bg-rose-500/10 text-rose-200',
            msg.type === 'success' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
            msg.type === 'info' && 'border-sky-500/30 bg-sky-500/10 text-sky-200'
          )}
        >
          {msg.type === 'error' ? (
            <AlertCircle className="h-5 w-5" />
          ) : (
            <RefreshCw className={cn('h-5 w-5', msg.type === 'info' && 'animate-spin')} />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      {/* LEFT COLUMN: LIST */}
      <div className="flex w-full flex-shrink-0 flex-col overflow-hidden rounded-[24px] border border-white/10 bg-surface100 xl:w-[400px]">
        {/* Advanced Filters Header */}
        <div className="p-5 border-b border-white/[0.04] space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-medium tracking-wide">Orders</h2>
            <button
              onClick={() => setReloadKey((v) => v + 1)}
              className="px-4 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-xs font-semibold transition-colors flex items-center gap-2"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', loadingOrders && 'animate-spin')} />
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              value={draftFilters.q}
              onChange={(e) => setDraftFilters((p) => ({ ...p, q: e.target.value }))}
              placeholder="Search ID"
              className="w-full rounded-full border border-white/10 bg-black/30 py-2.5 pl-10 pr-4 text-sm transition-colors focus:outline-none focus:border-brand/50"
            />
          </div>

          <div className="flex gap-2 text-xs overflow-x-auto custom-scrollbar pb-1">
            <select
              value={draftFilters.status}
              onChange={(e) =>
                setDraftFilters((p) => ({ ...p, status: e.target.value as OrderFilters['status'] }))
              }
              className="bg-black/40 border border-white/5 rounded-full px-3 py-1.5 focus:outline-none appearance-none min-w-[100px]"
            >
              <option value="">Status</option>
              <option value="pendiente_pago">Pendiente</option>
              <option value="pagado">Pagado</option>
              <option value="preparando_envio">Preparando</option>
              <option value="en_camino">En camino</option>
              <option value="entregado">Entregado</option>
              <option value="cancelado">Cancelado</option>
            </select>
            <input
              value={draftFilters.date_from}
              onChange={(e) => setDraftFilters((p) => ({ ...p, date_from: e.target.value }))}
              type="date"
              className="bg-black/40 border border-white/5 rounded-full px-3 py-1.5 text-xs focus:outline-none dark:[color-scheme:dark]"
            />
            <input
              value={draftFilters.date_to}
              onChange={(e) => setDraftFilters((p) => ({ ...p, date_to: e.target.value }))}
              type="date"
              className="bg-black/40 border border-white/5 rounded-full px-3 py-1.5 text-xs focus:outline-none dark:[color-scheme:dark]"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={applyFilters}
              className="rounded-full bg-brand px-4 py-1.5 text-xs font-medium text-black transition-colors hover:bg-brand/90"
            >
              Apply
            </button>
            <button
              onClick={clearFilters}
              className="bg-white/5 hover:bg-white/10 rounded-full px-4 py-1.5 text-xs font-medium transition-colors text-zinc-300"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Order List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
          {loadingOrders ? (
            <p className="text-zinc-500 text-sm p-4 text-center">Loading...</p>
          ) : orders.length === 0 ? (
            <p className="text-zinc-500 text-sm p-4 text-center">No orders found.</p>
          ) : (
            orders.map((order) => (
              <div
                key={order.id}
                onClick={() => void openOrderDetail(order.id)}
                className={cn(
                  'p-4 rounded-2xl cursor-pointer transition-all border',
                  selectedOrderId === order.id
                    ? 'border-brand/35 bg-brand/15'
                    : 'bg-black/20 border-white/[0.04] hover:bg-white/[0.04]'
                )}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-sm font-medium text-white">{order.id}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {order.customer_email || 'No email'}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'px-2.5 py-1 rounded-[8px] text-[10px] font-medium uppercase tracking-wider border',
                      order.display_status === 'pagado' || order.display_status === 'entregado'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : order.display_status === 'cancelado'
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    )}
                  >
                    {statusLabel(order.display_status)}
                  </span>
                </div>
                <div className="flex items-end justify-between mt-4">
                  <div>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">
                      Total
                    </p>
                    <p className="text-sm font-semibold text-white">
                      {formatMoney(order.total_amount_cents, order.currency)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">
                      Date
                    </p>
                    <p className="text-xs text-zinc-300">
                      {formatDate(order.created_at).split(',')[0]}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-white/[0.04] flex items-center justify-between bg-black/20">
          <button
            disabled={!hasPrev || loadingOrders}
            onClick={() => setPage((v) => Math.max(1, v - 1))}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-zinc-400 font-medium">Page {page}</span>
          <button
            disabled={!hasNext || loadingOrders}
            onClick={() => setPage((v) => v + 1)}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* RIGHT COLUMN: MAIN DETAIL */}
      <div className="relative flex flex-1 flex-col overflow-hidden rounded-[24px] border border-white/10 bg-surface100">
        {selectedOrderId && loadingDetail ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-transparent to-white/[0.01]">
            <RefreshCw className="mb-4 h-8 w-8 animate-spin text-brand" />
            <p className="text-zinc-500">Loading complete order details...</p>
          </div>
        ) : selectedOrderId && activeOrder ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-semibold mb-1">Order Details</h3>
                <p className="text-zinc-400 text-sm">ID: {selectedOrderId}</p>
              </div>
              <button
                onClick={closeDetail}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {detailMsg && (
              <div
                className={cn(
                  'px-4 py-3 rounded-2xl text-sm border font-medium',
                  detailMsg.type === 'error'
                    ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                    : detailMsg.type === 'success'
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                      : 'bg-sky-500/10 text-sky-300 border-sky-500/30'
                )}
              >
                {detailMsg.text}
              </div>
            )}

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-black/30 rounded-2xl p-5 border border-white/[0.04]">
                <p className="text-xs text-zinc-500 font-medium mb-1">Payment Status</p>
                <p className="text-lg font-semibold text-white capitalize">{activeOrder.status}</p>
                <p className="text-xs text-zinc-600 mt-1">
                  {statusLabel(activeOrder.display_status)}
                </p>
              </div>
              <div className="bg-black/30 rounded-2xl p-5 border border-white/[0.04]">
                <p className="text-xs text-zinc-500 font-medium mb-1">Total Amount</p>
                <p className="text-lg font-semibold text-white">
                  {formatMoney(activeOrder.total_amount_cents, activeOrder.currency)}
                </p>
                <p className="text-xs text-zinc-600 mt-1">
                  {activeOrder.summary.items_count} items
                </p>
              </div>
              <div className="bg-black/30 rounded-2xl p-5 border border-white/[0.04]">
                <p className="text-xs text-zinc-500 font-medium mb-1">Customer</p>
                <p className="text-sm font-medium text-white truncate">
                  {activeOrder.customer_name || 'No Name'}
                </p>
                <p className="text-xs text-zinc-500 truncate mt-1">{activeOrder.customer_email}</p>
              </div>
              <div className="bg-black/30 rounded-2xl p-5 border border-white/[0.04]">
                <p className="text-xs text-zinc-500 font-medium mb-1">Created At</p>
                <p className="text-sm font-medium text-white">
                  {formatDate(activeOrder.created_at).split(',')[0]}
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  {formatDate(activeOrder.created_at).split(',')[1]}
                </p>
              </div>
            </div>

            {/* Edit Section */}
            <div className="bg-black/20 rounded-3xl p-6 border border-white/[0.04]">
              <div className="flex items-center justify-between mb-5">
                <h4 className="text-sm font-semibold uppercase tracking-widest text-brand">
                  Update Order
                </h4>
                <div className="flex items-center gap-2">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={adminToken}
                    onChange={(e) => setAdminToken(normalizeAdminToken(e.target.value))}
                    className="w-48 rounded-full border border-white/10 bg-black/30 px-4 py-1.5 text-xs focus:outline-none focus:border-brand/50"
                    placeholder="Admin Token"
                  />
                  <button
                    onClick={() => setShowToken(!showToken)}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-zinc-500 mb-1.5 block ml-1">
                      Shipping Status
                    </label>
                    <select
                      value={editForm.shipping_status}
                      onChange={(e) =>
                        setEditForm((p) => ({
                          ...p,
                          shipping_status: e.target.value as ShippingStatus
                        }))
                      }
                      className="w-full appearance-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm focus:outline-none focus:border-brand/50"
                    >
                      <option value="pending">Pending</option>
                      <option value="preparing">Preparing</option>
                      <option value="in_transit">In Transit</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1.5 block ml-1">
                      Customer Email
                    </label>
                    <input
                      value={editForm.customer_email}
                      onChange={(e) =>
                        setEditForm((p) => ({ ...p, customer_email: e.target.value }))
                      }
                      className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm focus:outline-none focus:border-brand/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1.5 block ml-1">Customer Name</label>
                    <input
                      value={editForm.customer_name}
                      onChange={(e) =>
                        setEditForm((p) => ({ ...p, customer_name: e.target.value }))
                      }
                      className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm focus:outline-none focus:border-brand/50"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-zinc-500 mb-1.5 block ml-1">
                      Shipping Address (JSON)
                    </label>
                    <textarea
                      value={editForm.shipping_address_json}
                      onChange={(e) =>
                        setEditForm((p) => ({ ...p, shipping_address_json: e.target.value }))
                      }
                      rows={5}
                      className="custom-scrollbar w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 font-mono text-sm focus:outline-none focus:border-brand/50"
                      placeholder="{}"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1.5 block ml-1">Internal Note</label>
                    <input
                      value={editForm.internal_note}
                      onChange={(e) =>
                        setEditForm((p) => ({ ...p, internal_note: e.target.value }))
                      }
                      className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm focus:outline-none focus:border-brand/50"
                      placeholder="Add a note..."
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  onClick={resetOrderChanges}
                  disabled={savingDetail || !activeOrder}
                  className="px-6 py-2.5 rounded-full bg-white/5 hover:bg-white/10 text-sm font-medium transition-colors disabled:opacity-50"
                >
                  Discard
                </button>
                <button
                  onClick={() => void saveOrderChanges()}
                  disabled={savingDetail}
                  className="flex items-center gap-2 rounded-full bg-brand px-6 py-2.5 text-sm font-medium text-black transition-colors hover:bg-brand/90 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {savingDetail ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>

            {/* Items Table */}
            <div className="bg-black/20 rounded-3xl p-6 border border-white/[0.04]">
              <h4 className="text-sm font-semibold mb-4 text-zinc-300">
                Items ({activeOrder.items.length})
              </h4>
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left text-sm min-w-[400px]">
                  <thead>
                    <tr className="text-xs text-zinc-500 uppercase tracking-wider border-b border-white/5">
                      <th className="pb-3 font-medium">Product</th>
                      <th className="pb-3 font-medium text-right">Qty</th>
                      <th className="pb-3 font-medium text-right">Price</th>
                      <th className="pb-3 font-medium text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {activeOrder.items.map((item) => (
                      <tr key={item.id} className="text-zinc-300">
                        <td className="py-4">
                          <p className="font-medium text-white">
                            {item.product_title || item.product_slug}
                          </p>
                          <p className="text-xs text-zinc-500 mt-1">{item.product_type}</p>
                        </td>
                        <td className="py-4 text-right">{item.quantity}</td>
                        <td className="py-4 text-right">
                          {formatMoney(item.unit_price_cents, activeOrder.currency)}
                        </td>
                        <td className="py-4 text-right font-medium text-white">
                          {formatMoney(item.amount_cents, activeOrder.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-transparent to-white/[0.01]">
            <div className="w-24 h-24 mb-6 rounded-full bg-white/[0.02] border border-white/[0.04] flex items-center justify-center flex-shrink-0">
              <Search className="w-8 h-8 text-zinc-600" />
            </div>
            <h3 className="text-xl font-medium text-white mb-2">No Order Selected</h3>
            <p className="text-zinc-500 max-w-sm">
              Select an order from the list on the left to view its complete details, items, and
              manage shipping information.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
