import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  MapPin,
  Package,
  RefreshCw,
  Search,
  ShieldCheck,
  Truck,
  XCircle
} from 'lucide-react'
import { cn } from '../lib/utils'

type Msg = { type: 'error' | 'success' | 'info'; text: string } | null

type ShipmentStatus = 'pending' | 'preparing' | 'in_transit' | 'delivered' | 'cancelled' | 'lost'
type ApprovalStatus = 'pending' | 'approved' | 'rejected'

type ShipmentSummary = {
  id: string
  created_at: string
  updated_at: string
  customer_name: string | null
  customer_email: string
  customer_phone: string | null
  total_amount_cents: number
  currency: string
  approval_status: ApprovalStatus
  shipment_status: ShipmentStatus
  carrier: string | null
  service: string | null
  tracking_number: string | null
  tracking_url: string | null
  label_r2_key: string | null
  label_url: string | null
  approved_at: string | null
  rejected_at: string | null
  rejected_reason: string | null
  last_sync_at: string | null
  last_error: string | null
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

type ShipmentRecord = {
  order_id: string
  provider: string
  mode: 'test' | 'prod'
  approval_status: ApprovalStatus
  shipment_status: ShipmentStatus
  carrier: string | null
  service: string | null
  tracking_number: string | null
  tracking_url: string | null
  envia_shipment_id: string | null
  label_r2_key: string | null
  label_url: string | null
  quote_amount_cents: number | null
  currency: string
  parcel: unknown
  address_validation: unknown
  envia_request: unknown
  envia_response: unknown
  approved_at: string | null
  rejected_at: string | null
  rejected_reason: string | null
  last_sync_at: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

type ShipmentEvent = {
  id: number
  order_id: string
  event_type: string
  source: string
  payload_json: string | null
  payload?: unknown
  created_at: string
}

type ShipmentOrder = {
  id: string
  stripe_session_id: string | null
  status: string
  shipping_status: ShipmentStatus
  display_status: string
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
  shipment: ShipmentRecord | null
  shipment_events: ShipmentEvent[]
}

type QuoteOption = {
  carrier: string
  service: string
  amount_cents: number
  currency: string
  estimated_days: number | null
  raw: Record<string, unknown>
}

type QuoteMode = 'auto' | 'manual'

type QuoteSnapshot = {
  mode: QuoteMode
  request: Record<string, unknown>
  quotes: QuoteOption[]
  selected_quote: QuoteOption | null
}

type QuoteState = {
  quotes: QuoteOption[]
  selectedQuote: QuoteOption | null
  requestKey: string | null
  invalidated: boolean
}

type ShipmentListResponse = {
  success: boolean
  shipments?: ShipmentSummary[]
  error?: string
}

type ShipmentDetailResponse = {
  success: boolean
  order?: ShipmentOrder
  error?: string
}

type ShipmentQuoteResponse = {
  success: boolean
  order?: ShipmentOrder
  quotes?: QuoteOption[]
  selected_quote?: QuoteOption | null
  error?: string
}

type ShipmentOptionsResponse = {
  success: boolean
  carriers?: string[]
  services?: string[]
  error?: string
}

type ShipmentApprovePreviewResponse = {
  success: boolean
  order_id?: string
  mode?: QuoteMode
  payload?: Record<string, unknown>
  resolved_settings?: Record<string, unknown> | null
  selected_quote?: QuoteOption | null
  settings_source?: 'provider' | 'fallback'
  shipment_type_applied?: number
  missing_fields?: string[]
  warning?: string | null
  error?: string
}

type ParcelForm = {
  weight_kg: string
  length_cm: string
  width_cm: string
  height_cm: string
  declared_value_cents: string
  content: string
  notes: string
  carrier: string
  service: string
}

const TOKEN_STORAGE_KEY = 'lumea_admin_api_token'
const TOKEN_REMEMBER_KEY = 'lumea_admin_api_token_remember'

const EMPTY_PARCEL_FORM: ParcelForm = {
  weight_kg: '1',
  length_cm: '10',
  width_cm: '10',
  height_cm: '10',
  declared_value_cents: '',
  content: 'Joyeria Lumea Imperium',
  notes: '',
  carrier: '',
  service: ''
}

const AUTO_QUOTE_FIELDS = new Set<keyof ParcelForm>([
  'weight_kg',
  'length_cm',
  'width_cm',
  'height_cm',
  'declared_value_cents',
  'content'
])

const MANUAL_QUOTE_FIELDS = new Set<keyof ParcelForm>([
  ...AUTO_QUOTE_FIELDS,
  'carrier',
  'service'
])

const EMPTY_QUOTE_STATE: QuoteState = {
  quotes: [],
  selectedQuote: null,
  requestKey: null,
  invalidated: false
}

function normalizeAdminToken(value: string): string {
  const trimmed = String(value || '').trim()
  if (!trimmed) return ''
  return trimmed.replace(/^Bearer\\s+/i, '').trim()
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
      const asRecord = toRecord(payload)
      const message =
        (typeof asRecord?.error === 'string' && asRecord.error) ||
        (typeof asRecord?.message === 'string' && asRecord.message) ||
        `HTTP ${res.status}`
      throw new Error(message)
    }

    return payload as T
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === 'AbortError' || /aborted|timeout/i.test(String(error.message || '')))
    ) {
      throw new Error('La solicitud a Envia tardo demasiado. Intenta de nuevo.')
    }
    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function readText(value: unknown): string {
  return String(value || '').trim()
}

function normalizeQuoteOption(value: unknown): QuoteOption | null {
  const record = toRecord(value)
  if (!record) return null

  const carrier = readText(record.carrier)
  const service = readText(record.service)
  const amountCents = Number(record.amount_cents)
  if (!carrier || !service || !Number.isFinite(amountCents)) return null

  return {
    carrier,
    service,
    amount_cents: Math.round(amountCents),
    currency: readText(record.currency).toUpperCase() || 'MXN',
    estimated_days:
      record.estimated_days == null || record.estimated_days === ''
        ? null
        : Number.isFinite(Number(record.estimated_days))
          ? Number(record.estimated_days)
          : null,
    raw: toRecord(record.raw) || record
  }
}

function normalizeQuoteMode(value: unknown, request: Record<string, unknown> | null = null): QuoteMode {
  const normalized = readText(value).toLowerCase()
  if (normalized === 'manual') return 'manual'
  if (normalized === 'auto') return 'auto'
  const shipment = toRecord(request?.shipment)
  return readText(shipment?.carrier) || readText(shipment?.service) ? 'manual' : 'auto'
}

function parseQuoteSnapshot(order: ShipmentOrder | null): QuoteSnapshot | null {
  const response = toRecord(order?.shipment?.envia_response)
  const request = toRecord(response?.request)
  const quotes = Array.isArray(response?.quotes)
    ? response.quotes.map((quote) => normalizeQuoteOption(quote)).filter(Boolean)
    : []
  const selected = normalizeQuoteOption(response?.selected_quote)
  if (!request || quotes.length === 0) return null
  return {
    mode: normalizeQuoteMode(response?.mode, request),
    request,
    quotes: quotes as QuoteOption[],
    selected_quote: selected
  }
}

function formatMoney(cents: number, currency = 'MXN'): string {
  try {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: currency || 'MXN',
      currencyDisplay: 'code',
      minimumFractionDigits: 2
    }).format((Number(cents) || 0) / 100)
  } catch {
    const code = String(currency || 'MXN').trim().toUpperCase() || 'MXN'
    return `${code} ${((Number(cents) || 0) / 100).toFixed(2)}`
  }
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-'
  const iso = value.includes('T') ? value : value.replace(' ', 'T')
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date)
}

function statusLabel(status: ShipmentStatus): string {
  if (status === 'preparing') return 'Preparando'
  if (status === 'in_transit') return 'En transito'
  if (status === 'delivered') return 'Entregado'
  if (status === 'cancelled') return 'Cancelado'
  if (status === 'lost') return 'Perdido'
  return 'Pendiente'
}

function approvalLabel(status: ApprovalStatus): string {
  if (status === 'approved') return 'Aprobado'
  if (status === 'rejected') return 'Rechazado'
  return 'Pendiente'
}

function statusClass(status: ShipmentStatus): string {
  if (status === 'preparing') return 'border-amber-400/35 bg-amber-500/15 text-amber-200'
  if (status === 'in_transit') return 'border-sky-400/35 bg-sky-500/15 text-sky-200'
  if (status === 'delivered') return 'border-emerald-400/35 bg-emerald-500/15 text-emerald-200'
  if (status === 'cancelled') return 'border-rose-400/35 bg-rose-500/15 text-rose-200'
  if (status === 'lost') return 'border-orange-400/35 bg-orange-500/15 text-orange-200'
  return 'border-zinc-400/35 bg-zinc-500/15 text-zinc-200'
}

function approvalClass(status: ApprovalStatus): string {
  if (status === 'approved') return 'border-emerald-400/35 bg-emerald-500/15 text-emerald-200'
  if (status === 'rejected') return 'border-rose-400/35 bg-rose-500/15 text-rose-200'
  return 'border-brand/30 bg-brand/10 text-brand'
}

function buildAuthHeaders(adminToken: string, extra?: HeadersInit): HeadersInit {
  return {
    Authorization: `Bearer ${normalizeAdminToken(adminToken)}`,
    ...extra
  }
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => sortJsonValue(item))
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort((left, right) => left.localeCompare(right))
      .reduce<Record<string, unknown>>((accumulator, key) => {
        accumulator[key] = sortJsonValue((value as Record<string, unknown>)[key])
        return accumulator
      }, {})
  }
  return value
}

function stableStringify(value: unknown): string | null {
  if (value === null || value === undefined) return null
  try {
    return JSON.stringify(sortJsonValue(value))
  } catch {
    return null
  }
}

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value || '')
  }
}

function buildPackageRequestFromForm(form: ParcelForm): Record<string, unknown> {
  return {
    weight_kg: form.weight_kg.trim(),
    length_cm: form.length_cm.trim(),
    width_cm: form.width_cm.trim(),
    height_cm: form.height_cm.trim(),
    declared_value_cents: form.declared_value_cents.trim(),
    content: form.content.trim()
  }
}

function buildQuoteRequestFromForm(form: ParcelForm, mode: QuoteMode): Record<string, unknown> {
  const carrier = mode === 'manual' ? form.carrier.trim() : ''
  const service = mode === 'manual' && carrier ? form.service.trim() : ''
  return {
    packages: [buildPackageRequestFromForm(form)],
    shipment:
      mode === 'manual' && (carrier || service)
        ? {
            carrier,
            ...(service ? { service } : {})
          }
        : null
  }
}

function buildQuoteRequestKeyFromForm(form: ParcelForm, mode: QuoteMode): string | null {
  return stableStringify(buildQuoteRequestFromForm(form, mode))
}

function buildQuoteRequestKeyFromSnapshot(snapshot: QuoteSnapshot | null): string | null {
  if (!snapshot) return null
  const request = {
    packages: toRecord(Array.isArray(snapshot.request.packages) ? snapshot.request.packages[0] : null)
      ? [toRecord(Array.isArray(snapshot.request.packages) ? snapshot.request.packages[0] : null)]
      : [],
    shipment: toRecord(snapshot.request.shipment)
  }
  return stableStringify(request)
}

function parcelFormBaseFromOrder(order: ShipmentOrder | null): ParcelForm {
  const parcel = toRecord(order?.shipment?.parcel)
  return {
    weight_kg: readText(parcel?.weight_kg) || EMPTY_PARCEL_FORM.weight_kg,
    length_cm: readText(parcel?.length_cm) || EMPTY_PARCEL_FORM.length_cm,
    width_cm: readText(parcel?.width_cm) || EMPTY_PARCEL_FORM.width_cm,
    height_cm: readText(parcel?.height_cm) || EMPTY_PARCEL_FORM.height_cm,
    declared_value_cents:
      readText(parcel?.declared_value_cents) || String(order?.total_amount_cents || ''),
    content: readText(parcel?.content) || EMPTY_PARCEL_FORM.content,
    notes: readText(parcel?.notes),
    carrier: '',
    service: ''
  }
}

function parcelFormFromOrder(
  order: ShipmentOrder | null,
  snapshot: QuoteSnapshot | null = null,
  mode: QuoteMode = 'auto'
): ParcelForm {
  const base = parcelFormBaseFromOrder(order)
  if (mode !== 'manual' || !snapshot || snapshot.mode !== 'manual') {
    return base
  }

  const shipmentRequest = toRecord(snapshot.request?.shipment)
  return {
    ...base,
    carrier: readText(shipmentRequest?.carrier),
    service: readText(shipmentRequest?.service)
  }
}

function getAddressParts(order: ShipmentOrder | null): string[] {
  const shipping = toRecord(order?.shipping_address)
  const address = toRecord(shipping?.address)
  if (!address) return []

  return [
    readText(address.line1),
    readText(address.line2),
    [readText(address.city), readText(address.state)].filter(Boolean).join(', '),
    readText(address.postal_code),
    readText(address.country)
  ].filter(Boolean)
}

function getZipValidation(order: ShipmentOrder | null): {
  deliverable: boolean | null
  city: string
  state: string
  zip: string
} {
  const validation = toRecord(order?.shipment?.address_validation)
  const deliverableValue =
    validation?.deliverable ??
    validation?.is_deliverable ??
    validation?.isDeliverable ??
    validation?.serviceable
  const deliverable =
    typeof deliverableValue === 'boolean'
      ? deliverableValue
      : typeof deliverableValue === 'number'
        ? deliverableValue > 0
        : null

  return {
    deliverable,
    city: readText(validation?.city || validation?.municipality),
    state: readText(validation?.state),
    zip: readText(validation?.postal_code || validation?.zip_code || validation?.zip)
  }
}

export default function ShipmentsManager(): React.JSX.Element {
  const [adminToken, setAdminToken] = useState('')
  const [rememberToken, setRememberToken] = useState(false)
  const [showToken, setShowToken] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)
  const [pending, setPending] = useState<ShipmentSummary[]>([])
  const [approved, setApproved] = useState<ShipmentSummary[]>([])
  const [pendingLoading, setPendingLoading] = useState(false)
  const [approvedLoading, setApprovedLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<ShipmentStatus | ''>('')
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<ShipmentOrder | null>(null)
  const [activeQuoteMode, setActiveQuoteMode] = useState<QuoteMode>('auto')
  const [autoParcelForm, setAutoParcelForm] = useState<ParcelForm>(EMPTY_PARCEL_FORM)
  const [manualParcelForm, setManualParcelForm] = useState<ParcelForm>(EMPTY_PARCEL_FORM)
  const [autoQuoteState, setAutoQuoteState] = useState<QuoteState>(EMPTY_QUOTE_STATE)
  const [manualQuoteState, setManualQuoteState] = useState<QuoteState>(EMPTY_QUOTE_STATE)
  const [availableCarriers, setAvailableCarriers] = useState<string[]>([])
  const [availableServices, setAvailableServices] = useState<string[]>([])
  const [rejectReason, setRejectReason] = useState('')
  const [showApproveConfirm, setShowApproveConfirm] = useState(false)
  const [debugLoading, setDebugLoading] = useState(false)
  const [showDebugRequest, setShowDebugRequest] = useState(false)
  const [debugRequestPayload, setDebugRequestPayload] = useState('')
  const [debugRequestWarning, setDebugRequestWarning] = useState<string | null>(null)
  const [debugRequestSettingsSource, setDebugRequestSettingsSource] = useState<
    'provider' | 'fallback' | null
  >(null)
  const [debugRequestShipmentType, setDebugRequestShipmentType] = useState<number | null>(null)
  const [debugRequestMissingFields, setDebugRequestMissingFields] = useState<string[]>([])

  useEffect(() => {
    try {
      const shouldRemember = localStorage.getItem(TOKEN_REMEMBER_KEY) === '1'
      setRememberToken(shouldRemember)
      setAdminToken(
        shouldRemember ? normalizeAdminToken(localStorage.getItem(TOKEN_STORAGE_KEY) || '') : ''
      )
    } catch {
      setRememberToken(false)
      setAdminToken('')
    }
  }, [])

  useEffect(() => {
    try {
      if (rememberToken) {
        localStorage.setItem(TOKEN_REMEMBER_KEY, '1')
        localStorage.setItem(TOKEN_STORAGE_KEY, normalizeAdminToken(adminToken))
      } else {
        localStorage.removeItem(TOKEN_REMEMBER_KEY)
        localStorage.removeItem(TOKEN_STORAGE_KEY)
      }
    } catch {
      // Ignore storage failures.
    }
  }, [adminToken, rememberToken])

  const zipValidation = useMemo(() => getZipValidation(selectedOrder), [selectedOrder])
  const addressLines = useMemo(() => getAddressParts(selectedOrder), [selectedOrder])
  const currentParcelForm = activeQuoteMode === 'auto' ? autoParcelForm : manualParcelForm
  const currentQuoteState = activeQuoteMode === 'auto' ? autoQuoteState : manualQuoteState
  const currentSelectedQuote = currentQuoteState.selectedQuote
  const currentQuotes = currentQuoteState.quotes
  const currentQuoteInvalidated = currentQuoteState.invalidated
  const manualCarrierOptions = useMemo(
    () =>
      [
        ...new Set(
          [...availableCarriers, ...manualQuoteState.quotes.map((quote) => quote.carrier)].filter(
            Boolean
          )
        )
      ].sort(),
    [availableCarriers, manualQuoteState.quotes]
  )
  const manualServiceOptions = useMemo(() => {
    const currentCarrier = manualParcelForm.carrier.trim().toLowerCase()
    const quotedServices = manualQuoteState.quotes
      .filter((quote) => !currentCarrier || quote.carrier.toLowerCase() === currentCarrier)
      .map((quote) => quote.service)
    return [...new Set([...availableServices, ...quotedServices].filter(Boolean))].sort()
  }, [availableServices, manualQuoteState.quotes, manualParcelForm.carrier])

  const resetDebugRequest = (): void => {
    setShowDebugRequest(false)
    setDebugRequestPayload('')
    setDebugRequestWarning(null)
    setDebugRequestSettingsSource(null)
    setDebugRequestShipmentType(null)
    setDebugRequestMissingFields([])
  }

  const applyOrderQuoteState = (
    order: ShipmentOrder,
    fallbackQuotes: QuoteOption[] = [],
    fallbackSelected: QuoteOption | null = null
  ): void => {
    const snapshot = parseQuoteSnapshot(order)
    const nextAutoState = { ...EMPTY_QUOTE_STATE }
    const nextManualState = { ...EMPTY_QUOTE_STATE }
    const nextQuotes = snapshot?.quotes?.length ? snapshot.quotes : fallbackQuotes
    const nextSelected = snapshot?.selected_quote || fallbackSelected

    if (snapshot) {
      const stateFromSnapshot: QuoteState = {
        quotes: nextQuotes,
        selectedQuote: nextSelected,
        requestKey: buildQuoteRequestKeyFromSnapshot(snapshot),
        invalidated: false
      }
      if (snapshot.mode === 'manual') {
        Object.assign(nextManualState, stateFromSnapshot)
      } else {
        Object.assign(nextAutoState, stateFromSnapshot)
      }
    }

    setSelectedOrder(order)
    setAutoParcelForm(parcelFormFromOrder(order, snapshot, 'auto'))
    setManualParcelForm(parcelFormFromOrder(order, snapshot, 'manual'))
    setAutoQuoteState(nextAutoState)
    setManualQuoteState(nextManualState)
    setActiveQuoteMode(snapshot?.mode || 'auto')
    resetDebugRequest()
  }

  const clearQuoteSelection = (mode: QuoteMode, markInvalidated = false): void => {
    resetDebugRequest()
    const nextState = { ...EMPTY_QUOTE_STATE, invalidated: markInvalidated }
    if (mode === 'auto') {
      setAutoQuoteState(nextState)
      return
    }
    setManualQuoteState(nextState)
  }

  const updateParcelField = (mode: QuoteMode, field: keyof ParcelForm, value: string): void => {
    resetDebugRequest()
    const currentForm = mode === 'auto' ? autoParcelForm : manualParcelForm
    const nextForm = { ...currentForm, [field]: value }
    if (mode === 'manual' && field === 'carrier') {
      nextForm.service = ''
    }
    if (mode === 'auto') {
      setAutoParcelForm(nextForm)
    } else {
      setManualParcelForm(nextForm)
    }

    const quoteFields = mode === 'auto' ? AUTO_QUOTE_FIELDS : MANUAL_QUOTE_FIELDS
    const requestKey = mode === 'auto' ? autoQuoteState.requestKey : manualQuoteState.requestKey
    if (quoteFields.has(field)) {
      if (requestKey && buildQuoteRequestKeyFromForm(nextForm, mode) !== requestKey) {
        clearQuoteSelection(mode, true)
      }
    }
  }

  const loadEnviaOptions = async (
    token = adminToken,
    carrier = manualParcelForm.carrier.trim()
  ): Promise<void> => {
    if (!normalizeAdminToken(token)) {
      setAvailableCarriers([])
      setAvailableServices([])
      return
    }

    const params = new URLSearchParams({ country: 'MX' })
    if (carrier) params.set('carrier', carrier)
    const response = await requestJson<ShipmentOptionsResponse>(
      `/api/shipments/options?${params.toString()}`,
      {
        headers: buildAuthHeaders(token)
      }
    )

    if (!response.success) {
      throw new Error(response.error || 'No se pudieron cargar opciones de Envia.')
    }

    setAvailableCarriers(response.carriers || [])
    setAvailableServices(carrier ? response.services || [] : [])
  }

  const loadPending = async (token = adminToken): Promise<void> => {
    if (!normalizeAdminToken(token)) {
      setPending([])
      return
    }

    setPendingLoading(true)
    try {
      const response = await requestJson<ShipmentListResponse>('/api/shipments/pending', {
        headers: buildAuthHeaders(token)
      })
      if (!response.success) throw new Error(response.error || 'No se pudo cargar pendientes.')
      setPending(response.shipments || [])
    } finally {
      setPendingLoading(false)
    }
  }

  const loadApproved = async (token = adminToken, filter = statusFilter): Promise<void> => {
    if (!normalizeAdminToken(token)) {
      setApproved([])
      return
    }

    setApprovedLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter) params.set('status', filter)
      const suffix = params.toString()
      const response = await requestJson<ShipmentListResponse>(
        `/api/shipments${suffix ? `?${suffix}` : ''}`,
        {
          headers: buildAuthHeaders(token)
        }
      )
      if (!response.success) throw new Error(response.error || 'No se pudo cargar envios.')
      setApproved(response.shipments || [])
    } finally {
      setApprovedLoading(false)
    }
  }

  const loadDetail = async (orderId: string, token = adminToken): Promise<void> => {
    if (!normalizeAdminToken(token)) return
    setDetailLoading(true)
    try {
      const response = await requestJson<ShipmentDetailResponse>(`/api/shipments/${orderId}`, {
        headers: buildAuthHeaders(token)
      })
      if (!response.success || !response.order) {
        throw new Error(response.error || 'No se pudo cargar el detalle del envio.')
      }
      applyOrderQuoteState(response.order)
      setAvailableCarriers([])
      setAvailableServices([])
      setRejectReason(response.order.shipment?.rejected_reason || '')
    } finally {
      setDetailLoading(false)
    }
  }

  const refreshLists = async (token = adminToken): Promise<void> => {
    if (!normalizeAdminToken(token)) {
      setMsg({ type: 'info', text: 'Ingresa el Bearer admin para gestionar envios.' })
      setPending([])
      setApproved([])
      return
    }

    setMsg(null)
    try {
      await Promise.all([loadPending(token), loadApproved(token, statusFilter)])
    } catch (error) {
      setMsg({
        type: 'error',
        text: error instanceof Error ? error.message : 'No se pudieron cargar los envios.'
      })
    }
  }

  useEffect(() => {
    void refreshLists()
  }, [statusFilter, adminToken])

  useEffect(() => {
    if (!selectedOrderId || !normalizeAdminToken(adminToken)) {
      setSelectedOrder(null)
      setAutoParcelForm(EMPTY_PARCEL_FORM)
      setManualParcelForm(EMPTY_PARCEL_FORM)
      clearQuoteSelection('auto')
      clearQuoteSelection('manual')
      setAvailableCarriers([])
      setAvailableServices([])
      return
    }

    void loadDetail(selectedOrderId)
  }, [selectedOrderId, adminToken])

  useEffect(() => {
    if (!selectedOrderId || !normalizeAdminToken(adminToken)) return

    void loadEnviaOptions().catch(() => {
      setAvailableCarriers([])
      setAvailableServices([])
    })
  }, [selectedOrderId, adminToken, manualParcelForm.carrier])

  const submitQuotePayload = (mode: QuoteMode): Record<string, string> => {
    const form = mode === 'auto' ? autoParcelForm : manualParcelForm
    return {
      weight_kg: form.weight_kg.trim(),
      length_cm: form.length_cm.trim(),
      width_cm: form.width_cm.trim(),
      height_cm: form.height_cm.trim(),
      declared_value_cents: form.declared_value_cents.trim(),
      content: form.content.trim(),
      notes: form.notes.trim(),
      ...(mode === 'manual'
        ? {
            carrier: form.carrier.trim(),
            service: form.carrier.trim() ? form.service.trim() : ''
          }
        : {})
    }
  }

  const buildApproveRequestPayload = (): Record<string, unknown> | null => {
    if (!currentSelectedQuote) return null
    return {
      ...submitQuotePayload(activeQuoteMode),
      mode: activeQuoteMode,
      selected_quote: {
        carrier: currentSelectedQuote.carrier,
        service: currentSelectedQuote.service,
        amount_cents: currentSelectedQuote.amount_cents,
        currency: currentSelectedQuote.currency
      }
    }
  }

  const runQuote = async (): Promise<void> => {
    if (!selectedOrderId) return
    if (activeQuoteMode === 'manual' && !manualParcelForm.carrier.trim()) {
      setMsg({ type: 'error', text: 'Selecciona un carrier antes de cotizar en modo manual.' })
      return
    }
    clearQuoteSelection(activeQuoteMode)
    setActionLoading(true)
    setMsg({
      type: 'info',
      text:
        activeQuoteMode === 'auto'
          ? 'Cotizando envio automatico con Envia...'
          : 'Cotizando envio manual con Envia...'
    })
    try {
      const response = await requestJson<ShipmentQuoteResponse>(
        `/api/shipments/${selectedOrderId}/quote/${activeQuoteMode}`,
        {
          method: 'POST',
          headers: buildAuthHeaders(adminToken, { 'Content-Type': 'application/json' }),
          body: JSON.stringify(submitQuotePayload(activeQuoteMode))
        },
        activeQuoteMode === 'auto' ? 90000 : 30000
      )
      if (!response.success || !response.order) {
        throw new Error(response.error || 'No se pudo cotizar el envio.')
      }
      applyOrderQuoteState(response.order, response.quotes || [], response.selected_quote || null)
      setMsg({ type: 'success', text: 'Cotizacion actualizada.' })
      await refreshLists()
    } catch (error) {
      setMsg({
        type: 'error',
        text: error instanceof Error ? error.message : 'Error cotizando envio.'
      })
    } finally {
      setActionLoading(false)
    }
  }

  const approveShipment = async (): Promise<void> => {
    if (!selectedOrderId) return
    const approvePayload = buildApproveRequestPayload()
    if (!approvePayload) {
      setMsg({ type: 'error', text: 'Debes seleccionar una cotizacion valida antes de aprobar.' })
      return
    }
    setActionLoading(true)
    setShowApproveConfirm(false)
    setMsg({ type: 'info', text: 'Generando guia de envio...' })
    try {
      const response = await requestJson<ShipmentDetailResponse>(
        `/api/shipments/${selectedOrderId}/approve`,
        {
          method: 'POST',
          headers: buildAuthHeaders(adminToken, { 'Content-Type': 'application/json' }),
          body: JSON.stringify(approvePayload)
        },
        60000
      )
      if (!response.success || !response.order) {
        throw new Error(response.error || 'No se pudo aprobar el envio.')
      }
      applyOrderQuoteState(response.order)
      setRejectReason('')
      setMsg({ type: 'success', text: 'Guia generada y envio aprobado.' })
      await refreshLists()
    } catch (error) {
      setMsg({
        type: 'error',
        text: error instanceof Error ? error.message : 'Error aprobando envio.'
      })
    } finally {
      setActionLoading(false)
    }
  }

  const previewApproveRequest = async (): Promise<void> => {
    if (!selectedOrderId) return
    const approvePayload = buildApproveRequestPayload()
    if (!approvePayload) {
      setMsg({ type: 'error', text: 'Debes seleccionar una cotizacion valida antes de revisar la peticion.' })
      return
    }

    setDebugLoading(true)
    setMsg({ type: 'info', text: 'Construyendo preview de la peticion a Envia...' })
    try {
      const response = await requestJson<ShipmentApprovePreviewResponse>(
        `/api/shipments/${selectedOrderId}/approve-preview`,
        {
          method: 'POST',
          headers: buildAuthHeaders(adminToken, { 'Content-Type': 'application/json' }),
          body: JSON.stringify(approvePayload)
        },
        30000
      )
      if (!response.success) {
        throw new Error(response.error || 'No se pudo construir la peticion.')
      }
      setDebugRequestPayload(formatJson(response.payload || {}))
      setDebugRequestWarning(response.warning || null)
      setDebugRequestSettingsSource(response.settings_source || null)
      setDebugRequestShipmentType(
        Number.isFinite(Number(response.shipment_type_applied))
          ? Number(response.shipment_type_applied)
          : null
      )
      setDebugRequestMissingFields(response.missing_fields || [])
      setShowDebugRequest(true)
      setMsg({ type: 'success', text: 'Preview de la peticion listo.' })
    } catch (error) {
      setMsg({
        type: 'error',
        text: error instanceof Error ? error.message : 'Error construyendo preview.'
      })
    } finally {
      setDebugLoading(false)
    }
  }

  const rejectShipment = async (): Promise<void> => {
    if (!selectedOrderId) return
    const reason = rejectReason.trim()
    if (!reason) {
      setMsg({ type: 'error', text: 'Debes indicar un motivo para rechazar el envio.' })
      return
    }

    setActionLoading(true)
    setMsg({ type: 'info', text: 'Guardando rechazo...' })
    try {
      const response = await requestJson<ShipmentDetailResponse>(
        `/api/shipments/${selectedOrderId}/reject`,
        {
          method: 'POST',
          headers: buildAuthHeaders(adminToken, { 'Content-Type': 'application/json' }),
          body: JSON.stringify({ reason })
        }
      )
      if (!response.success || !response.order) {
        throw new Error(response.error || 'No se pudo rechazar el envio.')
      }
      applyOrderQuoteState(response.order)
      setMsg({ type: 'success', text: 'Envio marcado como rechazado.' })
      await refreshLists()
    } catch (error) {
      setMsg({
        type: 'error',
        text: error instanceof Error ? error.message : 'Error rechazando envio.'
      })
    } finally {
      setActionLoading(false)
    }
  }

  const syncShipment = async (): Promise<void> => {
    if (!selectedOrderId) return
    setActionLoading(true)
    setMsg({ type: 'info', text: 'Sincronizando estado con Envia...' })
    try {
      const response = await requestJson<ShipmentDetailResponse>(
        `/api/shipments/${selectedOrderId}/sync`,
        {
          method: 'POST',
          headers: buildAuthHeaders(adminToken)
        }
      )
      if (!response.success || !response.order) {
        throw new Error(response.error || 'No se pudo sincronizar el envio.')
      }
      applyOrderQuoteState(response.order)
      setMsg({ type: 'success', text: 'Estado de envio sincronizado.' })
      await refreshLists()
    } catch (error) {
      setMsg({
        type: 'error',
        text: error instanceof Error ? error.message : 'Error sincronizando envio.'
      })
    } finally {
      setActionLoading(false)
    }
  }

  const chooseQuote = (mode: QuoteMode, quote: QuoteOption): void => {
    resetDebugRequest()
    if (mode === 'auto') {
      setAutoQuoteState((current) => ({ ...current, selectedQuote: quote, invalidated: false }))
      return
    }
    setManualQuoteState((current) => ({ ...current, selectedQuote: quote, invalidated: false }))
  }

  const hasToken = Boolean(normalizeAdminToken(adminToken))
  const isPendingSelection = selectedOrder?.shipment?.approval_status === 'pending'
  const isApprovedSelection = selectedOrder?.shipment?.approval_status === 'approved'
  const canApproveSelection =
    isPendingSelection && Boolean(currentSelectedQuote) && !currentQuoteInvalidated

  const renderShipmentCard = (shipment: ShipmentSummary): React.JSX.Element => (
    <button
      key={shipment.id}
      type="button"
      onClick={() => setSelectedOrderId(shipment.id)}
      className={cn(
        'w-full rounded-2xl border p-4 text-left transition',
        selectedOrderId === shipment.id
          ? 'border-brand/40 bg-brand/10 shadow-glow'
          : 'border-white/8 bg-black/20 hover:border-white/15 hover:bg-white/[0.03]'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Pedido</p>
          <h3 className="mt-1 text-sm font-semibold text-zinc-100">{shipment.id}</h3>
          <p className="mt-1 text-xs text-zinc-400">
            {shipment.customer_name || shipment.customer_email}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span
            className={cn(
              'rounded-full border px-2.5 py-1 text-[11px] font-semibold',
              approvalClass(shipment.approval_status)
            )}
          >
            {approvalLabel(shipment.approval_status)}
          </span>
          <span
            className={cn(
              'rounded-full border px-2.5 py-1 text-[11px] font-semibold',
              statusClass(shipment.shipment_status)
            )}
          >
            {statusLabel(shipment.shipment_status)}
          </span>
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-xs text-zinc-400 sm:grid-cols-2">
        <div>
          <p className="text-zinc-500">Total</p>
          <p className="mt-1 font-medium text-zinc-200">
            {formatMoney(shipment.total_amount_cents, shipment.currency)}
          </p>
        </div>
        <div>
          <p className="text-zinc-500">Fecha</p>
          <p className="mt-1 font-medium text-zinc-200">{formatDate(shipment.created_at)}</p>
        </div>
        <div>
          <p className="text-zinc-500">Carrier</p>
          <p className="mt-1 truncate font-medium text-zinc-200">
            {shipment.carrier || 'Pendiente'}
          </p>
        </div>
        <div>
          <p className="text-zinc-500">Guia</p>
          <p className="mt-1 truncate font-medium text-zinc-200">
            {shipment.tracking_number || 'Sin generar'}
          </p>
        </div>
      </div>

      {shipment.last_error && (
        <p className="mt-3 rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {shipment.last_error}
        </p>
      )}
    </button>
  )

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-brand/70">Envia</p>
            <h2 className="mt-1 text-xl font-semibold text-zinc-100">Shipments</h2>
            <p className="mt-2 max-w-3xl text-sm text-zinc-400">
              Valida compras pagadas, cotiza el paquete y genera la guia solo cuando des el visto
              bueno.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
            <label className="min-w-[260px] rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <span className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
                Bearer admin
              </span>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={adminToken}
                  onChange={(event) => setAdminToken(event.target.value)}
                  placeholder="Pega tu token admin"
                  className="w-full bg-transparent text-sm text-zinc-100 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowToken((current) => !current)}
                  className="rounded-lg bg-white/5 px-2 py-1 text-[11px] font-semibold text-zinc-300"
                >
                  {showToken ? 'Ocultar' : 'Ver'}
                </button>
              </div>
              <label className="mt-3 inline-flex items-center gap-2 text-xs text-zinc-400">
                <input
                  type="checkbox"
                  checked={rememberToken}
                  onChange={(event) => setRememberToken(event.target.checked)}
                />
                Recordar en este dispositivo
              </label>
            </label>

            <button
              type="button"
              onClick={() => void refreshLists()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-200 hover:bg-white/10"
            >
              <RefreshCw
                className={cn('h-4 w-4', (pendingLoading || approvedLoading) && 'animate-spin')}
              />
              Recargar
            </button>

            <div className="flex items-center rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-300">
              <ShieldCheck className="mr-2 h-4 w-4 text-brand" />
              {hasToken ? 'Token listo' : 'Token requerido'}
            </div>
          </div>
        </div>
      </div>

      {msg && (
        <div
          className={cn(
            'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm',
            msg.type === 'error' && 'bg-rose-500/5 text-rose-200',
            msg.type === 'success' && 'bg-emerald-500/5 text-emerald-200',
            msg.type === 'info' && 'bg-sky-500/5 text-sky-200'
          )}
        >
          {msg.type === 'error' ? (
            <AlertCircle className="h-4 w-4" />
          ) : msg.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <RefreshCw className="h-4 w-4 animate-spin" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[360px_360px_minmax(0,1fr)]">
        <section className="rounded-3xl border border-white/5 bg-white/[0.02] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-brand/70">Cola</p>
              <h3 className="mt-1 text-lg font-semibold text-zinc-100">Pendientes de aprobacion</h3>
            </div>
            <span className="rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
              {pending.length}
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {!hasToken ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-6 text-center text-sm text-zinc-500">
                Ingresa el token admin para cargar esta vista.
              </div>
            ) : pendingLoading ? (
              <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-6 text-center text-sm text-zinc-400">
                Cargando pendientes...
              </div>
            ) : pending.length === 0 ? (
              <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-6 text-center text-sm text-zinc-500">
                No hay pedidos pendientes de aprobacion.
              </div>
            ) : (
              pending.map((shipment) => renderShipmentCard(shipment))
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-white/5 bg-white/[0.02] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-brand/70">Historial</p>
              <h3 className="mt-1 text-lg font-semibold text-zinc-100">Envios realizados</h3>
            </div>
            <Search className="h-4 w-4 text-zinc-500" />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {(
              ['', 'preparing', 'in_transit', 'delivered', 'cancelled', 'lost'] as Array<
                ShipmentStatus | ''
              >
            ).map((status) => (
              <button
                key={status || 'all'}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-semibold',
                  statusFilter === status
                    ? 'border-brand/40 bg-brand text-black'
                    : 'border-white/10 bg-black/20 text-zinc-300'
                )}
              >
                {status ? statusLabel(status) : 'Todos'}
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-3">
            {!hasToken ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-6 text-center text-sm text-zinc-500">
                Ingresa el token admin para cargar esta vista.
              </div>
            ) : approvedLoading ? (
              <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-6 text-center text-sm text-zinc-400">
                Cargando envios...
              </div>
            ) : approved.length === 0 ? (
              <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-6 text-center text-sm text-zinc-500">
                No hay envios para este filtro.
              </div>
            ) : (
              approved.map((shipment) => renderShipmentCard(shipment))
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-white/5 bg-white/[0.02] p-4 sm:p-5">
          {!selectedOrderId ? (
            <div className="flex min-h-[520px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-black/20 px-6 text-center">
              <Truck className="h-8 w-8 text-brand/80" />
              <h3 className="mt-4 text-lg font-semibold text-zinc-100">Selecciona un envio</h3>
              <p className="mt-2 max-w-md text-sm text-zinc-500">
                Aqui veras el detalle del pedido, la validacion del CP, el paquete y las acciones
                para cotizar, aprobar o sincronizar la guia.
              </p>
            </div>
          ) : detailLoading || !selectedOrder ? (
            <div className="flex min-h-[520px] items-center justify-center rounded-3xl border border-white/8 bg-black/20 text-sm text-zinc-400">
              Cargando detalle...
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Detalle</p>
                  <h3 className="mt-1 text-xl font-semibold text-zinc-100">{selectedOrder.id}</h3>
                  <p className="mt-2 text-sm text-zinc-400">
                    {selectedOrder.customer_name || selectedOrder.customer_email}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs font-semibold',
                      approvalClass(selectedOrder.shipment?.approval_status || 'pending')
                    )}
                  >
                    {approvalLabel(selectedOrder.shipment?.approval_status || 'pending')}
                  </span>
                  <span
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs font-semibold',
                      statusClass(selectedOrder.shipment?.shipment_status || 'pending')
                    )}
                  >
                    {statusLabel(selectedOrder.shipment?.shipment_status || 'pending')}
                  </span>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                    <MapPin className="h-4 w-4 text-brand" />
                    Destino
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-zinc-300">
                    <p>{selectedOrder.customer_name || 'Cliente sin nombre'}</p>
                    <p>{selectedOrder.customer_email}</p>
                    {selectedOrder.customer_phone && <p>{selectedOrder.customer_phone}</p>}
                    {addressLines.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                  <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.02] p-3 text-xs text-zinc-400">
                    <p className="font-semibold text-zinc-200">Validacion de CP</p>
                    <p className="mt-2">
                      Resultado:{' '}
                      <span
                        className={cn(
                          zipValidation.deliverable === true && 'text-emerald-300',
                          zipValidation.deliverable === false && 'text-rose-300',
                          zipValidation.deliverable === null && 'text-zinc-300'
                        )}
                      >
                        {zipValidation.deliverable === true
                          ? 'Enviable'
                          : zipValidation.deliverable === false
                            ? 'No enviable'
                            : 'Sin dato'}
                      </span>
                    </p>
                    {(zipValidation.city || zipValidation.state || zipValidation.zip) && (
                      <p className="mt-1">
                        {zipValidation.city || '-'} / {zipValidation.state || '-'} /{' '}
                        {zipValidation.zip || '-'}
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                    <Package className="h-4 w-4 text-brand" />
                    Resumen comercial
                  </div>
                  <div className="mt-3 grid gap-3 text-sm text-zinc-300 sm:grid-cols-2">
                    <div>
                      <p className="text-zinc-500">Unidades</p>
                      <p className="mt-1 font-semibold text-zinc-100">
                        {selectedOrder.summary.units_total}
                      </p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Items</p>
                      <p className="mt-1 font-semibold text-zinc-100">
                        {selectedOrder.summary.items_count}
                      </p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Subtotal</p>
                      <p className="mt-1 font-semibold text-zinc-100">
                        {formatMoney(selectedOrder.summary.subtotal_cents, selectedOrder.currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Total</p>
                      <p className="mt-1 font-semibold text-zinc-100">
                        {formatMoney(selectedOrder.total_amount_cents, selectedOrder.currency)}
                      </p>
                    </div>
                  </div>
                  {selectedOrder.internal_note && (
                    <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.02] p-3 text-sm text-zinc-300">
                      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                        Nota interna
                      </p>
                      <p className="mt-2">{selectedOrder.internal_note}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                  <FileText className="h-4 w-4 text-brand" />
                  Paquete y metodo de cotizacion
                </div>

                <div className="mt-4 inline-flex rounded-2xl border border-white/10 bg-black/30 p-1">
                  {([
                    { mode: 'auto', label: 'Automatico' },
                    { mode: 'manual', label: 'Manual' }
                  ] as Array<{ mode: QuoteMode; label: string }>).map((item) => (
                    <button
                      key={item.mode}
                      type="button"
                      onClick={() => {
                        resetDebugRequest()
                        setActiveQuoteMode(item.mode)
                      }}
                      className={cn(
                        'rounded-xl px-4 py-2 text-sm font-semibold transition',
                        activeQuoteMode === item.mode
                          ? 'bg-brand text-black'
                          : 'text-zinc-300 hover:bg-white/5'
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <p className="mt-3 text-xs text-zinc-500">
                  {activeQuoteMode === 'auto'
                    ? 'El modo automatico consulta Envia y conserva solo la opcion valida mas barata para aprobar.'
                    : 'El modo manual te deja elegir carrier y servicio desde listas reales de Envia. No se aceptan valores libres.'}
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <label className="space-y-2 text-xs text-zinc-400">
                    <span>Peso (kg)</span>
                    <input
                      value={currentParcelForm.weight_kg}
                      onChange={(event) =>
                        updateParcelField(activeQuoteMode, 'weight_kg', event.target.value)
                      }
                      className="w-full rounded-xl border border-white/10 bg-surface100 px-3 py-2 text-sm text-zinc-100 outline-none"
                    />
                  </label>
                  <label className="space-y-2 text-xs text-zinc-400">
                    <span>Largo (cm)</span>
                    <input
                      value={currentParcelForm.length_cm}
                      onChange={(event) =>
                        updateParcelField(activeQuoteMode, 'length_cm', event.target.value)
                      }
                      className="w-full rounded-xl border border-white/10 bg-surface100 px-3 py-2 text-sm text-zinc-100 outline-none"
                    />
                  </label>
                  <label className="space-y-2 text-xs text-zinc-400">
                    <span>Ancho (cm)</span>
                    <input
                      value={currentParcelForm.width_cm}
                      onChange={(event) =>
                        updateParcelField(activeQuoteMode, 'width_cm', event.target.value)
                      }
                      className="w-full rounded-xl border border-white/10 bg-surface100 px-3 py-2 text-sm text-zinc-100 outline-none"
                    />
                  </label>
                  <label className="space-y-2 text-xs text-zinc-400">
                    <span>Alto (cm)</span>
                    <input
                      value={currentParcelForm.height_cm}
                      onChange={(event) =>
                        updateParcelField(activeQuoteMode, 'height_cm', event.target.value)
                      }
                      className="w-full rounded-xl border border-white/10 bg-surface100 px-3 py-2 text-sm text-zinc-100 outline-none"
                    />
                  </label>
                  <label className="space-y-2 text-xs text-zinc-400">
                    <span>Valor declarado (centavos)</span>
                    <input
                      value={currentParcelForm.declared_value_cents}
                      onChange={(event) =>
                        updateParcelField(
                          activeQuoteMode,
                          'declared_value_cents',
                          event.target.value
                        )
                      }
                      className="w-full rounded-xl border border-white/10 bg-surface100 px-3 py-2 text-sm text-zinc-100 outline-none"
                    />
                  </label>
                  <label className="space-y-2 text-xs text-zinc-400 sm:col-span-2 xl:col-span-1">
                    <span>Contenido</span>
                    <input
                      value={currentParcelForm.content}
                      onChange={(event) =>
                        updateParcelField(activeQuoteMode, 'content', event.target.value)
                      }
                      className="w-full rounded-xl border border-white/10 bg-surface100 px-3 py-2 text-sm text-zinc-100 outline-none"
                    />
                  </label>
                  {activeQuoteMode === 'manual' && (
                    <>
                      <label className="space-y-2 text-xs text-zinc-400">
                        <span>Carrier</span>
                        <select
                          value={manualParcelForm.carrier}
                          onChange={(event) =>
                            updateParcelField('manual', 'carrier', event.target.value)
                          }
                          className="w-full rounded-xl border border-white/10 bg-surface100 px-3 py-2 text-sm text-zinc-100 outline-none"
                        >
                          <option value="">Selecciona carrier</option>
                          {manualCarrierOptions.map((carrier) => (
                            <option key={carrier} value={carrier}>
                              {carrier}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-2 text-xs text-zinc-400">
                        <span>Servicio</span>
                        <select
                          value={manualParcelForm.service}
                          onChange={(event) =>
                            updateParcelField('manual', 'service', event.target.value)
                          }
                          disabled={!manualParcelForm.carrier.trim()}
                          className="w-full rounded-xl border border-white/10 bg-surface100 px-3 py-2 text-sm text-zinc-100 outline-none disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <option value="">
                            {manualParcelForm.carrier.trim()
                              ? 'Mas barato dentro del carrier'
                              : 'Primero elige carrier'}
                          </option>
                          {manualServiceOptions.map((service) => (
                            <option key={service} value={service}>
                              {service}
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
                  )}
                </div>

                <div className="mt-3 space-y-2 text-xs text-zinc-500">
                  {activeQuoteMode === 'auto' ? (
                    <p>Al cotizar en automatico se elige directamente la opcion valida mas barata.</p>
                  ) : (
                    <>
                      <p>Carrier es obligatorio en modo manual. Servicio es opcional.</p>
                      <p>
                        Si dejas servicio vacio, se elige el servicio mas barato dentro del carrier
                        seleccionado.
                      </p>
                    </>
                  )}
                </div>

                {currentQuoteInvalidated && (
                  <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                    Cambiaste datos del paquete. Vuelve a cotizar antes de aprobar.
                  </div>
                )}

                {activeQuoteMode === 'manual' &&
                  (availableCarriers.length > 0 || availableServices.length > 0) && (
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                        Carriers disponibles
                      </p>
                      <p className="mt-2 text-sm text-zinc-300">
                        {availableCarriers.length > 0
                          ? availableCarriers.join(', ')
                          : 'Envia no devolvio carriers para MX.'}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                        Servicios disponibles
                      </p>
                      <p className="mt-2 text-sm text-zinc-300">
                        {availableServices.length > 0
                          ? availableServices.join(', ')
                          : 'Selecciona un carrier o cotiza para ver servicios.'}
                      </p>
                    </div>
                  </div>
                )}

                <label className="mt-3 block space-y-2 text-xs text-zinc-400">
                  <span>Notas operativas</span>
                  <textarea
                    value={currentParcelForm.notes}
                    rows={3}
                    onChange={(event) =>
                      activeQuoteMode === 'auto'
                        ? setAutoParcelForm((current) => ({ ...current, notes: event.target.value }))
                        : setManualParcelForm((current) => ({
                            ...current,
                            notes: event.target.value
                          }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-surface100 px-3 py-3 text-sm text-zinc-100 outline-none"
                  />
                </label>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void runQuote()}
                    disabled={actionLoading || (activeQuoteMode === 'manual' && !manualParcelForm.carrier.trim())}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/5 px-4 py-2.5 text-sm font-semibold text-zinc-100 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <RefreshCw className={cn('h-4 w-4', actionLoading && 'animate-spin')} />
                    {activeQuoteMode === 'auto' ? 'Cotizar automatico' : 'Cotizar manualmente'}
                  </button>
                  {isPendingSelection && (
                    <button
                      type="button"
                      onClick={() => void previewApproveRequest()}
                      disabled={debugLoading || !canApproveSelection}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-500/15 px-4 py-2.5 text-sm font-semibold text-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <FileText className={cn('h-4 w-4', debugLoading && 'animate-spin')} />
                      Ver la peticion
                    </button>
                  )}
                  {isPendingSelection && (
                    <button
                      type="button"
                      onClick={() => setShowApproveConfirm(true)}
                      disabled={actionLoading || !canApproveSelection}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-2.5 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      Confirmar guia
                    </button>
                  )}
                  {isApprovedSelection && (
                    <button
                      type="button"
                      onClick={() => void syncShipment()}
                      disabled={actionLoading}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-500/15 px-4 py-2.5 text-sm font-semibold text-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <RefreshCw className={cn('h-4 w-4', actionLoading && 'animate-spin')} />
                      Sincronizar estado
                    </button>
                  )}
                </div>

                {isPendingSelection && !currentSelectedQuote && (
                  <p className="mt-3 text-xs text-zinc-500">
                    {activeQuoteMode === 'auto'
                      ? 'Cotiza automaticamente para fijar la mejor opcion antes de confirmar la guia.'
                      : 'Cotiza y elige una opcion valida antes de confirmar la guia.'}
                  </p>
                )}

                {selectedOrder.shipment && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-3 text-sm text-zinc-300">
                      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                        Envio actual
                      </p>
                      <p className="mt-2">Carrier: {selectedOrder.shipment.carrier || 'Pendiente'}</p>
                      <p className="mt-1">Servicio: {selectedOrder.shipment.service || 'Pendiente'}</p>
                      <p className="mt-1">
                        Cotizacion:{' '}
                        {selectedOrder.shipment.quote_amount_cents == null
                          ? 'Sin cotizar'
                          : formatMoney(
                              selectedOrder.shipment.quote_amount_cents,
                              selectedOrder.shipment.currency
                            )}
                      </p>
                      <p className="mt-1">
                        Ultimo sync: {formatDate(selectedOrder.shipment.last_sync_at)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-3 text-sm text-zinc-300">
                      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                        Documentos
                      </p>
                      <p className="mt-2">
                        Guia: {selectedOrder.shipment.tracking_number || 'Sin generar'}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedOrder.shipment.label_url && (
                          <a
                            href={selectedOrder.shipment.label_url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-xl bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10"
                          >
                            Descargar etiqueta
                          </a>
                        )}
                        {selectedOrder.shipment.tracking_url && (
                          <a
                            href={selectedOrder.shipment.tracking_url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-xl bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10"
                          >
                            Abrir tracking
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {currentSelectedQuote && (
                  <div className="mt-4 rounded-2xl border border-brand/20 bg-brand/10 p-3 text-sm text-zinc-200">
                    <p className="text-xs uppercase tracking-[0.18em] text-brand/80">
                      {activeQuoteMode === 'auto'
                        ? 'Mejor opcion seleccionada automaticamente'
                        : 'Opcion seleccionada para aprobar'}
                    </p>
                    <p className="mt-2 font-semibold">
                      {currentSelectedQuote.carrier} / {currentSelectedQuote.service}
                    </p>
                    <p className="mt-1 text-brand">
                      {formatMoney(currentSelectedQuote.amount_cents, currentSelectedQuote.currency)}
                    </p>
                  </div>
                )}

                {showDebugRequest && (
                  <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-amber-200/80">
                          Preview de la peticion
                        </p>
                        <p className="mt-1 text-sm text-amber-50">
                          Este es el payload final que el worker enviaria a `ship/generate`.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowDebugRequest(false)}
                        className="rounded-xl bg-black/20 px-3 py-2 text-xs font-semibold text-amber-100"
                      >
                        Ocultar
                      </button>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-sm text-zinc-200">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                          Fuente settings
                        </p>
                        <p className="mt-2 font-semibold">
                          {debugRequestSettingsSource === 'provider'
                            ? 'provider'
                            : debugRequestSettingsSource === 'fallback'
                              ? 'fallback'
                              : 'sin dato'}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-sm text-zinc-200">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                          Shipment.type
                        </p>
                        <p className="mt-2 font-semibold">
                          {debugRequestShipmentType == null ? 'sin dato' : debugRequestShipmentType}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-sm text-zinc-200">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                          Campos faltantes
                        </p>
                        <p className="mt-2 font-semibold">
                          {debugRequestMissingFields.length === 0
                            ? 'ninguno'
                            : String(debugRequestMissingFields.length)}
                        </p>
                      </div>
                    </div>
                    {debugRequestWarning && (
                      <div className="mt-3 rounded-2xl border border-amber-300/20 bg-black/20 px-4 py-3 text-sm text-amber-100">
                        {debugRequestWarning}
                      </div>
                    )}
                    {debugRequestSettingsSource === 'fallback' && (
                      <div className="mt-3 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                        Envia no devolvio print settings completos. El worker completo la guia con
                        fallback `PDF / 4x6 / thermal`.
                      </div>
                    )}
                    {debugRequestMissingFields.length > 0 && (
                      <div className="mt-3 rounded-2xl border border-rose-300/20 bg-black/20 px-4 py-3 text-sm text-rose-100">
                        Campos faltantes detectados: {debugRequestMissingFields.join(', ')}
                      </div>
                    )}
                    <pre className="mt-3 max-h-[28rem] overflow-auto rounded-2xl border border-white/8 bg-black/30 p-4 text-xs text-zinc-200">
                      {debugRequestPayload}
                    </pre>
                  </div>
                )}

                {activeQuoteMode === 'manual' && currentQuotes.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                      Cotizaciones sugeridas
                    </p>
                    <div className="grid gap-3 lg:grid-cols-2">
                      {currentQuotes.map((quote) => {
                        const active =
                          currentSelectedQuote?.carrier === quote.carrier &&
                          currentSelectedQuote?.service === quote.service &&
                          currentSelectedQuote?.amount_cents === quote.amount_cents
                        return (
                          <button
                            key={`${quote.carrier}-${quote.service}-${quote.amount_cents}`}
                            type="button"
                            onClick={() => chooseQuote('manual', quote)}
                            className={cn(
                              'rounded-2xl border p-3 text-left',
                              active
                                ? 'border-brand/40 bg-brand/10'
                                : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-zinc-100">
                                  {quote.carrier}
                                </p>
                                <p className="mt-1 text-xs text-zinc-400">{quote.service}</p>
                              </div>
                              <p className="text-sm font-semibold text-brand">
                                {formatMoney(quote.amount_cents, quote.currency)}
                              </p>
                            </div>
                            <p className="mt-2 text-xs text-zinc-500">
                              {quote.estimated_days == null
                                ? 'Sin estimado'
                                : `${quote.estimated_days} dia(s) estimados`}
                            </p>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {isPendingSelection && (
                <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4">
                  <p className="text-sm font-semibold text-rose-100">Rechazar envio</p>
                  <textarea
                    value={rejectReason}
                    rows={3}
                    onChange={(event) => setRejectReason(event.target.value)}
                    placeholder="Motivo obligatorio del rechazo"
                    className="mt-3 w-full rounded-2xl border border-rose-400/20 bg-black/20 px-3 py-3 text-sm text-rose-50 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void rejectShipment()}
                    disabled={actionLoading}
                    className="mt-3 inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-500/20 px-4 py-2.5 text-sm font-semibold text-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <XCircle className="h-4 w-4" />
                    Rechazar pedido
                  </button>
                </div>
              )}

              <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                <p className="text-sm font-semibold text-zinc-100">Items del pedido</p>
                <div className="mt-3 space-y-3">
                  {selectedOrder.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.02] px-3 py-3 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-zinc-100">
                          {item.product_title || item.product_slug}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {item.quantity} x{' '}
                          {formatMoney(item.unit_price_cents, selectedOrder.currency)}
                        </p>
                      </div>
                      <p className="font-semibold text-zinc-100">
                        {formatMoney(item.amount_cents, selectedOrder.currency)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                <p className="text-sm font-semibold text-zinc-100">Bitacora de envio</p>
                <div className="mt-3 space-y-3">
                  {selectedOrder.shipment_events.length === 0 ? (
                    <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-4 text-sm text-zinc-500">
                      Aun no hay eventos registrados.
                    </div>
                  ) : (
                    selectedOrder.shipment_events.map((event) => (
                      <div
                        key={event.id}
                        className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-zinc-100">{event.event_type}</p>
                          <p className="text-xs text-zinc-500">{formatDate(event.created_at)}</p>
                        </div>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-500">
                          {event.source}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {showApproveConfirm && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-surface100 p-6 shadow-2xl">
            <p className="text-[11px] uppercase tracking-[0.22em] text-brand/70">Confirmacion</p>
            <h3 className="mt-2 text-lg font-semibold text-zinc-100">
              Esta a punto de confirmar la guia de envio
            </h3>
            <p className="mt-3 text-sm text-zinc-400">
              Se consultara Envia, se generara la guia del pedido {selectedOrder.id} y se guardara
              la etiqueta en R2.
            </p>
            {currentSelectedQuote && (
              <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-zinc-300">
                <p>
                  Seleccion: {currentSelectedQuote.carrier} / {currentSelectedQuote.service}
                </p>
                <p className="mt-1 text-brand">
                  {formatMoney(currentSelectedQuote.amount_cents, currentSelectedQuote.currency)}
                </p>
              </div>
            )}
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => void approveShipment()}
                disabled={actionLoading || !canApproveSelection}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" />
                Aceptar
              </button>
              <button
                type="button"
                onClick={() => setShowApproveConfirm(false)}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-200"
              >
                <XCircle className="h-4 w-4" />
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
