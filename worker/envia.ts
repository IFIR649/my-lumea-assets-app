type EnviaEnvLike = {
  ENVIA_MODE?: string
  ENVIA_API_KEY?: string
  ENVIA_SHIPPING_BASE_URL?: string
  ENVIA_QUERIES_BASE_URL?: string
  ENVIA_GEOCODES_BASE_URL?: string
  ENVIA_TIMEOUT_MS?: string | number
  ENVIA_ALLOWED_CARRIERS?: string
}

type JsonRecord = Record<string, unknown>

type RequestResult = {
  ok: boolean
  status: number
  payload: unknown
  url: string
}

export type EnviaHealthStatus = {
  configured: boolean
  mode: 'test' | 'prod'
  shipping: { ok: boolean; error: string | null }
  queries: { ok: boolean; error: string | null }
  geocodes: { ok: boolean; error: string | null }
  checked_at: string
}

export type NormalizedQuote = {
  carrier: string
  service: string
  amount_cents: number
  currency: string
  estimated_days: number | null
  raw: JsonRecord
}

export type NormalizedShipmentResult = {
  shipment_id: string | null
  tracking_number: string | null
  tracking_url: string | null
  label_url: string | null
  label_base64: string | null
  carrier: string | null
  service: string | null
  status: string | null
  raw: unknown
}

export type NormalizedTrackingResult = {
  status: 'pending' | 'preparing' | 'in_transit' | 'delivered' | 'cancelled' | 'lost'
  tracking_url: string | null
  tracking_number: string | null
  carrier: string | null
  raw: unknown
}

export type NormalizedRemoteShipment = {
  shipment_id: string | null
  tracking_number: string | null
  tracking_url: string | null
  label_url: string | null
  label_base64: string | null
  carrier: string | null
  service: string | null
  status: NormalizedTrackingResult['status']
  status_text: string | null
  cancelable: boolean | null
  raw: unknown
}

const DEFAULT_TIMEOUT_MS = 45000
const GEOCODE_PATHS = [
  (zip: string, country = 'MX') =>
    `/zipcode/${encodeURIComponent(country)}/${encodeURIComponent(zip)}`,
  (zip: string) => `/validate-zip-code?zip_code=${encodeURIComponent(zip)}`,
  (zip: string) => `/validate-zip-code?postal_code=${encodeURIComponent(zip)}`,
  (zip: string) => `/zip-code/${encodeURIComponent(zip)}`,
  (zip: string) => `/zip-codes/${encodeURIComponent(zip)}`,
  (zip: string) => `/zipcode/${encodeURIComponent(zip)}`
]
const CARRIER_QUERY_PATHS = [
  (country: string) => `/carrier?country_code=${encodeURIComponent(country)}`,
  (country: string) => `/carrier?country=${encodeURIComponent(country)}`,
  (country: string) => `/carrier?code=${encodeURIComponent(country)}`
]
const AVAILABLE_CARRIER_PATHS = [
  (country: string) => `/available-carrier/${encodeURIComponent(country)}/0`,
  (country: string) => `/available-carrier/${encodeURIComponent(country)}/1`
]
const SERVICE_QUERY_PATHS = [
  (country: string, carrier: string | null) =>
    `/service?country_code=${encodeURIComponent(country)}${
      carrier ? `&carrier=${encodeURIComponent(carrier)}` : ''
    }`,
  (country: string, carrier: string | null) =>
    `/service?country=${encodeURIComponent(country)}${
      carrier ? `&carrier=${encodeURIComponent(carrier)}` : ''
    }`,
  (country: string, carrier: string | null) =>
    `/service?code=${encodeURIComponent(country)}${
      carrier ? `&carrier=${encodeURIComponent(carrier)}` : ''
    }`
]
const DEFAULT_PRINT_SETTINGS_PATHS = [
  (carrier: string) => `/default-user-print/${encodeURIComponent(carrier)}`,
  (carrier: string) => `/default-user-print?carrier_id=${encodeURIComponent(carrier)}`
]
const QUOTE_PATHS = ['/ship/rate/', '/ship/rates/', '/ship/quote/']
const LABEL_PATHS = ['/ship/generate/', '/ship/create/', '/ship/labels/']
const TRACK_PATHS = ['/ship/generaltrack/', '/ship/track/']
const CANCEL_PATHS = ['/ship/cancel/', '/ship/cancel']
const QUERIES_PATHS = ['/webhook-types', '/carriers', '/shipments?limit=1']
const SHIPMENT_BY_ID_QUERY_PATHS = [
  (shipmentId: string) => `/shipments/${encodeURIComponent(shipmentId)}`,
  (shipmentId: string) => `/shipment/${encodeURIComponent(shipmentId)}`,
  (shipmentId: string) => `/shipments?id=${encodeURIComponent(shipmentId)}`,
  (shipmentId: string) => `/shipments?shipment_id=${encodeURIComponent(shipmentId)}`,
  (shipmentId: string) => `/shipment?id=${encodeURIComponent(shipmentId)}`
]
const SHIPMENT_BY_TRACKING_QUERY_PATHS = [
  (tracking: string) => `/shipments?tracking_number=${encodeURIComponent(tracking)}`,
  (tracking: string) => `/shipments?tracking=${encodeURIComponent(tracking)}`,
  (tracking: string) => `/shipments?guide_number=${encodeURIComponent(tracking)}`,
  (tracking: string) => `/shipment?tracking_number=${encodeURIComponent(tracking)}`
]
const SHIPMENTS_BY_MONTH_QUERY_PATHS = [
  (month: number, year: number, limit: number) =>
    `/shipments?month=${month}&year=${year}&limit=${limit}`,
  (month: number, year: number, limit: number) =>
    `/shipments?year=${year}&month=${month}&limit=${limit}`,
  (month: number, year: number, limit: number) =>
    `/shipment?month=${month}&year=${year}&limit=${limit}`
]

export class EnviaConfigError extends Error {
  code = 'envia_config_error'
  constructor(message: string) {
    super(message)
    this.name = 'EnviaConfigError'
  }
}

export class EnviaRequestError extends Error {
  code = 'envia_request_error'
  status: number
  payload: unknown
  url: string
  providerCode: string | null

  constructor(
    message: string,
    options: { status: number; payload: unknown; url: string; providerCode?: string | null }
  ) {
    super(message)
    this.name = 'EnviaRequestError'
    this.status = options.status
    this.payload = options.payload
    this.url = options.url
    this.providerCode = options.providerCode || null
  }
}

function normalizeMode(value: unknown): 'test' | 'prod' {
  return String(value || '').trim().toLowerCase() === 'prod' ? 'prod' : 'test'
}

function normalizeBaseUrl(value: unknown): string {
  return String(value || '')
    .trim()
    .replace(/\/+$/, '')
}

function pickString(...values: unknown[]): string {
  for (const value of values) {
    if (value && typeof value === 'object') continue
    const normalized = String(value || '').trim()
    if (normalized) return normalized
  }
  return ''
}

function pickNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function toRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : null
}

function pickRecord(...values: unknown[]): JsonRecord | null {
  for (const value of values) {
    const record = toRecord(value)
    if (record) return record
  }
  return null
}

function getQuoteAmount(item: JsonRecord): number | null {
  const pricing = pickRecord(item.pricing, item.price_detail, item.priceDetail)
  const price = pickRecord(item.price)
  return normalizeAmountToCents(
    item.total_price ??
      item.totalPrice ??
      item.price ??
      item.rate ??
      item.amount ??
      item.total ??
      item.shipping_total ??
      item.shippingTotal ??
      item.cost ??
      pricing?.total ??
      pricing?.amount ??
      pricing?.price ??
      price?.total ??
      price?.amount
  )
}

function getQuoteCarrier(item: JsonRecord): string {
  const carrier = pickRecord(item.carrier)
  const provider = pickRecord(item.provider)
  const company = pickRecord(item.company)
  return pickString(
    item.carrier_name,
    item.carrierName,
    item.provider_name,
    item.providerName,
    item.provider,
    item.company,
    carrier?.name,
    carrier?.code,
    carrier?.slug,
    provider?.name,
    provider?.code,
    provider?.slug,
    company?.name,
    company?.code,
    typeof item.carrier === 'string' ? item.carrier : '',
    typeof item.name === 'string' ? item.name : ''
  )
}

function getQuoteService(item: JsonRecord): string {
  const service = pickRecord(item.service)
  const serviceLevel = pickRecord(item.service_level, item.serviceLevel)
  return pickString(
    item.service_name,
    item.serviceName,
    item.service_type,
    item.serviceType,
    item.service_level_name,
    item.serviceLevelName,
    item.service_code,
    item.serviceCode,
    item.shipping_service,
    item.shippingService,
    service?.name,
    service?.code,
    service?.type,
    serviceLevel?.name,
    serviceLevel?.code,
    typeof item.service === 'string' ? item.service : '',
    typeof item.type === 'string' ? item.type : ''
  )
}

function getQuoteEstimatedDays(item: JsonRecord): number | null {
  const delivery = pickRecord(item.delivery, item.delivery_estimate, item.deliveryEstimate)
  return pickNumber(
    item.estimated_days,
    item.estimatedDays,
    item.delivery_days,
    item.deliveryDays,
    item.transit_days,
    item.transitDays,
    delivery?.days,
    delivery?.estimated_days,
    delivery?.estimatedDays
  )
}

function extractProviderErrorMessage(payload: unknown): string {
  const payloadRecord = toRecord(payload)
  const errorRecord = pickRecord(payloadRecord?.error)
  const detailRecord = pickRecord(payloadRecord?.details, payloadRecord?.detail)
  return pickString(
    payloadRecord?.message,
    payloadRecord?.description,
    errorRecord?.message,
    errorRecord?.description,
    errorRecord?.detail,
    detailRecord?.message,
    detailRecord?.description,
    detailRecord?.detail,
    payloadRecord?.error
  )
}

function extractProviderErrorCode(payload: unknown): string | null {
  const payloadRecord = toRecord(payload)
  const errorRecord = pickRecord(payloadRecord?.error)
  const detailRecord = pickRecord(payloadRecord?.details, payloadRecord?.detail)
  const code = pickString(
    payloadRecord?.code,
    errorRecord?.code,
    errorRecord?.error_code,
    detailRecord?.code,
    detailRecord?.error_code
  )
  return code || null
}

function hasProviderError(payload: unknown): boolean {
  const payloadRecord = toRecord(payload)
  if (!payloadRecord) return false

  const meta = pickString(payloadRecord.meta).toLowerCase()
  if (meta === 'error') return true

  if (typeof payloadRecord.error === 'string' && payloadRecord.error.trim()) return true
  if (pickRecord(payloadRecord.error)) return true
  return false
}

function buildRequestError(result: RequestResult, fallbackLabel: string): EnviaRequestError {
  const message = extractProviderErrorMessage(result.payload) || `${fallbackLabel} con HTTP ${result.status}.`
  return new EnviaRequestError(message, {
    status: result.status,
    payload: result.payload,
    url: result.url,
    providerCode: extractProviderErrorCode(result.payload)
  })
}

function isAbortLikeError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' || /aborted|timeout/i.test(String(error.message || '')))
  )
}

function collectObjectCandidates(payload: unknown): JsonRecord[] {
  const out: JsonRecord[] = []
  const queue: unknown[] = [payload]
  const seen = new Set<unknown>()

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current || seen.has(current)) continue
    seen.add(current)

    if (Array.isArray(current)) {
      for (const item of current) queue.push(item)
      continue
    }

    const record = toRecord(current)
    if (!record) continue
    out.push(record)

    for (const value of Object.values(record)) {
      if (value && typeof value === 'object') queue.push(value)
    }
  }

  return out
}

function resolveConfig(env: EnviaEnvLike): {
  mode: 'test' | 'prod'
  apiKey: string
  timeoutMs: number
  shippingBaseUrl: string
  queriesBaseUrl: string
  geocodesBaseUrl: string
  allowedCarriers: string[]
} {
  const mode = normalizeMode(env.ENVIA_MODE)
  const apiKey = String(env.ENVIA_API_KEY || '').trim()
  const timeoutMsRaw = Number(env.ENVIA_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)
  const timeoutMs =
    Number.isFinite(timeoutMsRaw) && timeoutMsRaw > 0
      ? Math.min(Math.max(timeoutMsRaw, 2000), 60000)
      : DEFAULT_TIMEOUT_MS

  return {
    mode,
    apiKey,
    timeoutMs,
    shippingBaseUrl:
      normalizeBaseUrl(env.ENVIA_SHIPPING_BASE_URL) ||
      (mode === 'prod' ? 'https://api.envia.com' : 'https://api-test.envia.com'),
    queriesBaseUrl:
      normalizeBaseUrl(env.ENVIA_QUERIES_BASE_URL) ||
      (mode === 'prod' ? 'https://queries.envia.com' : 'https://queries-test.envia.com'),
    geocodesBaseUrl:
      normalizeBaseUrl(env.ENVIA_GEOCODES_BASE_URL) || 'https://geocodes.envia.com',
    allowedCarriers: String(env.ENVIA_ALLOWED_CARRIERS || '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  }
}

function assertConfig(env: EnviaEnvLike): ReturnType<typeof resolveConfig> {
  const config = resolveConfig(env)
  if (!config.apiKey) {
    throw new EnviaConfigError('ENVIA_API_KEY no configurado.')
  }
  return config
}

async function fetchJson(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<RequestResult> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    const text = await response.text()
    let payload: unknown = null
    if (text) {
      try {
        payload = JSON.parse(text)
      } catch {
        payload = { raw: text }
      }
    }
    return {
      ok: response.ok,
      status: response.status,
      payload,
      url
    }
  } catch (error) {
    if (isAbortLikeError(error)) {
      throw new Error(`Envia tardo demasiado en responder (${timeoutMs} ms).`)
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

async function tryJsonPaths(
  baseUrl: string,
  paths: string[],
  init: RequestInit,
  timeoutMs: number
): Promise<RequestResult> {
  let lastResult: RequestResult | null = null
  for (const path of paths) {
    const result = await fetchJson(`${baseUrl}${path}`, init, timeoutMs)
    if (result.status === 404) {
      lastResult = result
      continue
    }
    return result
  }

  return (
    lastResult || {
      ok: false,
      status: 404,
      payload: { error: 'all_candidate_paths_failed' },
      url: `${baseUrl}${paths[0] || ''}`
    }
  )
}

async function tryGeocodePaths(
  baseUrl: string,
  zip: string,
  headers: HeadersInit,
  timeoutMs: number
): Promise<RequestResult> {
  let lastResult: RequestResult | null = null
  for (const buildPath of GEOCODE_PATHS) {
    const url = `${baseUrl}${buildPath(zip, 'MX')}`
    const result = await fetchJson(url, { method: 'GET', headers }, timeoutMs)
    if (result.status === 404) {
      if (url.includes('/zipcode/MX/')) {
        return result
      }
      lastResult = result
      continue
    }
    return result
  }
  return (
    lastResult || {
      ok: false,
      status: 404,
      payload: { error: 'geocode_route_not_found' },
      url: `${baseUrl}${GEOCODE_PATHS[0](zip)}`
    }
  )
}

async function requestQueriesPayload(
  config: ReturnType<typeof assertConfig>,
  path: string
): Promise<unknown | null> {
  const result = await fetchJson(
    `${config.queriesBaseUrl}${path}`,
    {
      method: 'GET',
      headers: { accept: 'application/json', authorization: `Bearer ${config.apiKey}` }
    },
    config.timeoutMs
  )
  if (result.status === 404 || result.status === 400) return null
  if (!result.ok || hasProviderError(result.payload)) {
    throw buildRequestError(result, 'Envia queries fallo')
  }
  return result.payload
}

function monthYearOffsets(count: number): Array<{ month: number; year: number }> {
  const base = new Date()
  return Array.from({ length: count }, (_, index) => {
    const current = new Date(base.getUTCFullYear(), base.getUTCMonth() - index, 1)
    return { month: current.getMonth() + 1, year: current.getFullYear() }
  })
}

function buildHeaders(apiKey: string): HeadersInit {
  return {
    accept: 'application/json',
    authorization: `Bearer ${apiKey}`,
    'content-type': 'application/json'
  }
}

function normalizeCurrency(value: unknown): string {
  return String(value || 'MXN').trim().toUpperCase() || 'MXN'
}

function normalizeAmountToCents(value: unknown): number | null {
  const amount = pickNumber(value)
  if (amount === null) return null
  if (Math.abs(amount) >= 1000 && Number.isInteger(amount)) return amount
  return Math.round(amount * 100)
}

function quoteCandidatesFromPayload(payload: unknown): JsonRecord[] {
  const objects = collectObjectCandidates(payload)
  return objects.filter((item) => {
    const amount = getQuoteAmount(item)
    const carrier = getQuoteCarrier(item)
    return amount !== null && Boolean(carrier)
  })
}

function truthyValue(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value > 0
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) return null
  if (['true', '1', 'yes', 'active'].includes(normalized)) return true
  if (['false', '0', 'no', 'inactive'].includes(normalized)) return false
  return null
}

function topLevelObjects(payload: unknown): JsonRecord[] {
  const record = toRecord(payload)
  const dataRecord = pickRecord(record?.data)
  const pools = [
    payload,
    record?.data,
    record?.results,
    record?.items,
    record?.carriers,
    record?.services,
    dataRecord?.carriers,
    dataRecord?.services,
    dataRecord?.results,
    dataRecord?.items
  ]
  const out: JsonRecord[] = []
  for (const pool of pools) {
    if (Array.isArray(pool)) {
      for (const item of pool) {
        const object = toRecord(item)
        if (object) out.push(object)
      }
    } else {
      const object = toRecord(pool)
      if (object) {
        for (const value of Object.values(object)) {
          const nested = toRecord(value)
          if (nested) out.push(nested)
        }
      }
    }
    if (out.length) return out
  }
  return out
}

function normalizeCarrierNames(payload: unknown): string[] {
  const objects = topLevelObjects(payload)
  const names = objects
    .map((item) => {
      const active = truthyValue(item.active ?? item.enabled ?? item.available)
      if (active === false) return ''
      return pickString(
        item.name,
        item.carrier_name,
        item.carrier,
        item.slug,
        item.code,
        item.provider_name
      )
    })
    .filter(Boolean)

  return [...new Set(names)]
}

function hasShipmentLikeKeys(record: JsonRecord): boolean {
  const keys = Object.keys(record).map((key) => key.toLowerCase())
  return keys.some((key) =>
    ['shipment', 'tracking', 'guide', 'label', 'carrier', 'service', 'cancel', 'status'].some(
      (token) => key.includes(token)
    )
  )
}

function getShipmentIdentifier(item: JsonRecord): string {
  const direct = pickString(
    item.shipment_id,
    item.shipmentId,
    item.envia_shipment_id,
    item.enviaShipmentId
  )
  if (direct) return direct
  return hasShipmentLikeKeys(item) ? pickString(item.id) : ''
}

function getShipmentTrackingNumber(item: JsonRecord): string {
  return pickString(
    item.tracking_number,
    item.trackingNumber,
    item.guide_number,
    item.guideNumber,
    item.number
  )
}

function getShipmentLabelUrl(item: JsonRecord): string {
  return pickString(
    item.label_url,
    item.labelUrl,
    item.label,
    item.pdf,
    item.file,
    item.url,
    item.document_url,
    item.documentUrl
  )
}

function getShipmentLabelBase64(item: JsonRecord): string {
  return pickString(item.label_base64, item.labelBase64, item.base64, item.content)
}

function getShipmentCarrier(item: JsonRecord): string {
  return pickString(
    item.carrier_name,
    item.carrierName,
    item.provider_name,
    item.providerName,
    item.provider,
    item.company,
    getQuoteCarrier(item)
  )
}

function getShipmentService(item: JsonRecord): string {
  return pickString(
    item.service_name,
    item.serviceName,
    item.service_type,
    item.serviceType,
    item.shipping_service,
    item.shippingService,
    getQuoteService(item)
  )
}

function getShipmentStatusText(item: JsonRecord): string {
  const statusRecord = pickRecord(item.status, item.shipment_status, item.shipmentStatus)
  const currentStatusRecord = pickRecord(item.current_status, item.currentStatus)
  return pickString(
    typeof item.status === 'string' ? item.status : '',
    item.shipment_status,
    item.shipmentStatus,
    item.current_status,
    item.currentStatus,
    item.description,
    statusRecord?.name,
    statusRecord?.status,
    statusRecord?.description,
    currentStatusRecord?.name,
    currentStatusRecord?.status,
    currentStatusRecord?.description
  )
}

function getShipmentCancelable(item: JsonRecord): boolean | null {
  const cancelRecord = pickRecord(item.cancel, item.cancelation, item.cancellation)
  const actions = pickRecord(item.actions, item.available_actions, item.availableActions)
  const candidates = [
    item.can_cancel,
    item.canCancel,
    item.cancelable,
    item.cancellable,
    item.is_cancelable,
    item.isCancelable,
    item.can_void,
    item.canVoid,
    item.voidable,
    cancelRecord?.can_cancel,
    cancelRecord?.cancelable,
    cancelRecord?.is_cancelable,
    actions?.cancel,
    actions?.void
  ]
  for (const candidate of candidates) {
    const normalized = truthyValue(candidate)
    if (normalized !== null) return normalized
  }
  return null
}

function looksLikeRemoteShipmentCandidate(item: JsonRecord): boolean {
  return Boolean(
    getShipmentIdentifier(item) ||
      getShipmentTrackingNumber(item) ||
      getShipmentStatusText(item) ||
      getShipmentCarrier(item) ||
      getShipmentLabelUrl(item) ||
      getShipmentLabelBase64(item)
  )
}

function normalizeRemoteShipmentRecord(
  item: JsonRecord,
  payload: unknown
): NormalizedRemoteShipment | null {
  if (!looksLikeRemoteShipmentCandidate(item)) return null
  const statusText = getShipmentStatusText(item)
  return {
    shipment_id: getShipmentIdentifier(item) || null,
    tracking_number: getShipmentTrackingNumber(item) || null,
    tracking_url: pickString(item.tracking_url, item.trackingUrl, item.track_url) || null,
    label_url: getShipmentLabelUrl(item) || null,
    label_base64: getShipmentLabelBase64(item) || null,
    carrier: getShipmentCarrier(item) || null,
    service: getShipmentService(item) || null,
    status: normalizeShipmentStatus(statusText),
    status_text: statusText || null,
    cancelable: getShipmentCancelable(item),
    raw: payload
  }
}

function normalizeRemoteShipmentCollection(payload: unknown): NormalizedRemoteShipment[] {
  const normalized = collectObjectCandidates(payload)
    .map((item) => normalizeRemoteShipmentRecord(item, payload))
    .filter((item): item is NormalizedRemoteShipment => Boolean(item))

  const seen = new Set<string>()
  return normalized.filter((item) => {
    const key = [
      String(item.shipment_id || '').toLowerCase(),
      String(item.tracking_number || '').toLowerCase(),
      String(item.carrier || '').toLowerCase(),
      String(item.service || '').toLowerCase(),
      item.status
    ].join('::')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function sameIdentifier(left: string | null | undefined, right: string | null | undefined): boolean {
  return Boolean(left && right && String(left).trim().toLowerCase() === String(right).trim().toLowerCase())
}

function findMatchingRemoteShipment(
  candidates: NormalizedRemoteShipment[],
  identifiers: {
    shipmentId?: string | null
    trackingNumber?: string | null
    carrier?: string | null
  }
): NormalizedRemoteShipment | null {
  const shipmentId = pickString(identifiers.shipmentId)
  const trackingNumber = pickString(identifiers.trackingNumber)
  const carrier = pickString(identifiers.carrier).toLowerCase()

  let best: NormalizedRemoteShipment | null = null
  let bestScore = -1

  for (const candidate of candidates) {
    let score = 0
    if (shipmentId && sameIdentifier(candidate.shipment_id, shipmentId)) score += 10
    if (trackingNumber && sameIdentifier(candidate.tracking_number, trackingNumber)) score += 8
    if (carrier && candidate.carrier?.toLowerCase() === carrier) score += 2
    if (candidate.cancelable === true) score += 1
    if (candidate.status !== 'pending') score += 1
    if (score > bestScore) {
      best = candidate
      bestScore = score
    }
  }

  return bestScore > 0 ? best : null
}

function normalizeServiceNames(payload: unknown, carrier: string | null = null): string[] {
  const requestedCarrier = String(carrier || '')
    .trim()
    .toLowerCase()
  const objects = topLevelObjects(payload)
  const names = objects
    .map((item) => {
      const active = truthyValue(item.active ?? item.enabled ?? item.available)
      if (active === false) return ''

      const itemCarrier = getQuoteCarrier(item).toLowerCase()
      if (requestedCarrier && itemCarrier && itemCarrier !== requestedCarrier) return ''

      return pickString(item.name, getQuoteService(item))
    })
    .filter(Boolean)

  return [...new Set(names)]
}

function looksLikePrintSettings(record: JsonRecord | null): boolean {
  if (!record) return false
  const keys = Object.keys(record).map((key) => key.toLowerCase())
  return keys.some((key) =>
    ['print', 'paper', 'size', 'format', 'label', 'thermal', 'stock'].some((token) =>
      key.includes(token)
    )
  )
}

function normalizePrintSettingsRecord(record: JsonRecord | null): JsonRecord | null {
  if (!record) return null

  const printRecord = pickRecord(record.print, record.print_settings, record.printSettings)
  const normalized: JsonRecord = { ...record }
  const printFormat = pickString(
    record.printFormat,
    record.print_format,
    printRecord?.printFormat,
    printRecord?.print_format,
    record.format,
    printRecord?.format
  )

  if (!printFormat) return null

  normalized.printFormat = printFormat

  const printSize = pickString(
    record.printSize,
    record.print_size,
    printRecord?.printSize,
    printRecord?.print_size,
    record.size,
    record.paperSize,
    record.paper_size,
    record.labelSize,
    record.label_size,
    printRecord?.size
  )
  if (printSize && !pickString(normalized.printSize, normalized.print_size, normalized.size)) {
    normalized.printSize = printSize
  }

  const printType = pickString(
    record.printType,
    record.print_type,
    printRecord?.printType,
    printRecord?.print_type,
    record.type,
    record.labelType,
    record.label_type,
    printRecord?.type
  )
  if (printType && !pickString(normalized.printType, normalized.print_type, normalized.type)) {
    normalized.printType = printType
  }

  return normalized
}

function extractPrintSettings(payload: unknown): JsonRecord | null {
  const root = toRecord(payload)
  const data = toRecord(root?.data)
  const results = Array.isArray(root?.results) ? root?.results : []
  const items = Array.isArray(root?.items) ? root?.items : []
  const candidates = [
    pickRecord(root?.settings),
    pickRecord(data?.settings),
    looksLikePrintSettings(data) ? data : null,
    looksLikePrintSettings(toRecord(results[0])) ? toRecord(results[0]) : null,
    looksLikePrintSettings(toRecord(items[0])) ? toRecord(items[0]) : null,
    looksLikePrintSettings(root) ? root : null
  ]

  for (const candidate of candidates) {
    const normalized = normalizePrintSettingsRecord(candidate)
    if (normalized) return normalized
  }

  return null
}

function shipmentCandidatesFromPayload(payload: unknown): JsonRecord[] {
  return collectObjectCandidates(payload)
}

function normalizeShipmentStatus(value: unknown): NormalizedTrackingResult['status'] {
  const normalized = String(value || '').trim().toLowerCase()
  if (
    normalized.includes('cancel') ||
    normalized.includes('void') ||
    normalized.includes('return')
  ) {
    return 'cancelled'
  }
  if (normalized.includes('lost') || normalized.includes('incident')) return 'lost'
  if (normalized.includes('deliver')) return 'delivered'
  if (
    normalized.includes('transit') ||
    normalized.includes('route') ||
    normalized.includes('shipped')
  ) {
    return 'in_transit'
  }
  if (
    normalized.includes('label') ||
    normalized.includes('prepare') ||
    normalized.includes('created') ||
    normalized.includes('generated') ||
    normalized.includes('processing')
  ) {
    return 'preparing'
  }
  return 'pending'
}

export function normalizeQuotes(payload: unknown, allowedCarriers: string[] = []): NormalizedQuote[] {
  const quotes = quoteCandidatesFromPayload(payload)
    .map((item) => {
      const carrier = getQuoteCarrier(item)
      const service = getQuoteService(item)
      const amount_cents = getQuoteAmount(item)
      if (!carrier || !service || amount_cents === null) return null
      return {
        carrier,
        service,
        amount_cents,
        currency: normalizeCurrency(item.currency),
        estimated_days: getQuoteEstimatedDays(item),
        raw: item
      }
    })
    .filter((item): item is NormalizedQuote => Boolean(item))

  const filtered =
    allowedCarriers.length > 0
      ? quotes.filter((item) => allowedCarriers.includes(item.carrier.toLowerCase()))
      : quotes

  return filtered.sort((left, right) => left.amount_cents - right.amount_cents)
}

export function normalizeShipmentResult(payload: unknown): NormalizedShipmentResult {
  const candidates = shipmentCandidatesFromPayload(payload)
  for (const item of candidates) {
    const tracking_number = pickString(
      item.tracking_number,
      item.trackingNumber,
      item.guide_number,
      item.guideNumber,
      item.number
    )
    const label_url = pickString(item.label_url, item.labelUrl, item.pdf, item.file, item.url)
    const label_base64 = pickString(item.label_base64, item.labelBase64, item.base64, item.content)
    const shipment_id = pickString(
      item.shipment_id,
      item.shipmentId,
      item.id,
      item.envia_shipment_id
    )
    const carrier = pickString(item.carrier, item.carrier_name, item.carrierName, item.provider)
    const service = pickString(
      item.service,
      item.service_name,
      item.serviceName,
      item.service_type,
      item.serviceType
    )
    const tracking_url = pickString(item.tracking_url, item.trackingUrl, item.track_url)
    const status = pickString(item.status, item.shipment_status, item.shipmentStatus)

    if (tracking_number || label_url || label_base64 || shipment_id) {
      return {
        shipment_id: shipment_id || null,
        tracking_number: tracking_number || null,
        tracking_url: tracking_url || null,
        label_url: label_url || null,
        label_base64: label_base64 || null,
        carrier: carrier || null,
        service: service || null,
        status: status || null,
        raw: payload
      }
    }
  }

  return {
    shipment_id: null,
    tracking_number: null,
    tracking_url: null,
    label_url: null,
    label_base64: null,
    carrier: null,
    service: null,
    status: null,
    raw: payload
  }
}

export function normalizeTrackingResult(payload: unknown): NormalizedTrackingResult {
  const candidates = shipmentCandidatesFromPayload(payload)
  for (const item of candidates) {
    const rawStatus = pickString(
      item.status,
      item.shipment_status,
      item.shipmentStatus,
      item.current_status,
      item.currentStatus,
      item.description
    )
    const tracking_number = pickString(
      item.tracking_number,
      item.trackingNumber,
      item.guide_number,
      item.guideNumber,
      item.number
    )
    const tracking_url = pickString(item.tracking_url, item.trackingUrl, item.track_url)
    const carrier = pickString(item.carrier, item.carrier_name, item.carrierName, item.provider)
    if (rawStatus || tracking_number || carrier) {
      return {
        status: normalizeShipmentStatus(rawStatus),
        tracking_url: tracking_url || null,
        tracking_number: tracking_number || null,
        carrier: carrier || null,
        raw: payload
      }
    }
  }

  return {
    status: 'pending',
    tracking_url: null,
    tracking_number: null,
    carrier: null,
    raw: payload
  }
}

export async function pingEnviaApis(
  env: EnviaEnvLike,
  options: { originZip: string; dryRunPayload: JsonRecord }
): Promise<EnviaHealthStatus> {
  const checked_at = new Date().toISOString()
  let config
  try {
    config = assertConfig(env)
  } catch (error) {
    return {
      configured: false,
      mode: normalizeMode(env.ENVIA_MODE),
      shipping: { ok: false, error: error instanceof Error ? error.message : 'Envia no configurado.' },
      queries: { ok: false, error: error instanceof Error ? error.message : 'Envia no configurado.' },
      geocodes: { ok: false, error: error instanceof Error ? error.message : 'Envia no configurado.' },
      checked_at
    }
  }

  const headers = buildHeaders(config.apiKey)
  const geocode = await tryGeocodePaths(
    config.geocodesBaseUrl,
    options.originZip,
    { accept: 'application/json', authorization: `Bearer ${config.apiKey}` },
    config.timeoutMs
  ).catch((error) => ({
    ok: false,
    status: 0,
    payload: { error: error instanceof Error ? error.message : 'geocodes_failed' },
    url: config.geocodesBaseUrl
  }))

  const queries = await tryJsonPaths(
    config.queriesBaseUrl,
    QUERIES_PATHS,
    { method: 'GET', headers: { accept: 'application/json', authorization: `Bearer ${config.apiKey}` } },
    config.timeoutMs
  ).catch((error) => ({
    ok: false,
    status: 0,
    payload: { error: error instanceof Error ? error.message : 'queries_failed' },
    url: config.queriesBaseUrl
  }))

  const shipping = await tryJsonPaths(
    config.shippingBaseUrl,
    QUOTE_PATHS,
    { method: 'POST', headers, body: JSON.stringify(options.dryRunPayload) },
    config.timeoutMs
  ).catch((error) => ({
    ok: false,
    status: 0,
    payload: { error: error instanceof Error ? error.message : 'shipping_failed' },
    url: config.shippingBaseUrl
  }))

  const formatResult = (
    result: RequestResult,
    options: { tolerateSandboxServerError?: boolean } = {}
  ): { ok: boolean; error: string | null } => {
    const clientValidationLike =
      result.status >= 400 &&
      result.status < 500 &&
      result.status !== 401 &&
      result.status !== 403 &&
      result.status !== 404
    const sandboxServerError =
      Boolean(options.tolerateSandboxServerError) &&
      config.mode === 'test' &&
      result.status >= 500 &&
      result.status < 600

    return {
      ok: result.ok || clientValidationLike || sandboxServerError,
      error:
        result.ok || clientValidationLike || sandboxServerError
          ? null
          : pickString(
              (result.payload as JsonRecord | null)?.error,
              (result.payload as JsonRecord | null)?.message
            ) || `HTTP ${result.status}`
    }
  }

  return {
    configured: true,
    mode: config.mode,
    shipping: formatResult(shipping, { tolerateSandboxServerError: true }),
    queries: formatResult(queries),
    geocodes: formatResult(geocode, { tolerateSandboxServerError: true }),
    checked_at
  }
}

export async function quoteShipment(
  env: EnviaEnvLike,
  payload: JsonRecord
): Promise<{ payload: unknown; quotes: NormalizedQuote[] }> {
  const config = assertConfig(env)
  const headers = buildHeaders(config.apiKey)
  const result = await tryJsonPaths(
    config.shippingBaseUrl,
    QUOTE_PATHS,
    { method: 'POST', headers, body: JSON.stringify(payload) },
    config.timeoutMs
  )

  if (!result.ok) {
    throw buildRequestError(result, 'Envia quote fallo')
  }
  if (hasProviderError(result.payload)) {
    throw buildRequestError(result, 'Envia quote fallo')
  }

  return {
    payload: result.payload,
    quotes: normalizeQuotes(result.payload, config.allowedCarriers)
  }
}

export async function listAvailableCarriers(
  env: EnviaEnvLike,
  countryCode = 'MX'
): Promise<string[]> {
  const config = assertConfig(env)
  const headers = { accept: 'application/json', authorization: `Bearer ${config.apiKey}` }
  let lastError: EnviaRequestError | null = null

  for (const buildPath of [...CARRIER_QUERY_PATHS, ...AVAILABLE_CARRIER_PATHS]) {
    const result = await fetchJson(
      `${config.queriesBaseUrl}${buildPath(countryCode)}`,
      { method: 'GET', headers },
      config.timeoutMs
    )

    if (result.status === 404 || result.status === 400) continue
    if (!result.ok) {
      lastError = buildRequestError(result, 'Envia carriers fallo')
      continue
    }

    const carriers = normalizeCarrierNames(result.payload)
    if (carriers.length > 0) return carriers
  }

  if (lastError) throw lastError
  return []
}

export async function listAvailableServices(
  env: EnviaEnvLike,
  countryCode = 'MX',
  carrier: string | null = null
): Promise<string[]> {
  const config = assertConfig(env)
  const headers = { accept: 'application/json', authorization: `Bearer ${config.apiKey}` }
  let lastError: EnviaRequestError | null = null

  for (const buildPath of SERVICE_QUERY_PATHS) {
    const result = await fetchJson(
      `${config.queriesBaseUrl}${buildPath(countryCode, carrier)}`,
      { method: 'GET', headers },
      config.timeoutMs
    )

    if (result.status === 404 || result.status === 400) continue
    if (!result.ok) {
      lastError = buildRequestError(result, 'Envia services fallo')
      continue
    }

    const services = normalizeServiceNames(result.payload, carrier)
    if (services.length > 0) return services
  }

  if (lastError) throw lastError
  return []
}

export async function getDefaultUserPrintSettings(
  env: EnviaEnvLike,
  carrier: string
): Promise<JsonRecord | null> {
  const normalizedCarrier = String(carrier || '').trim()
  if (!normalizedCarrier) return null

  const config = assertConfig(env)
  const headers = { accept: 'application/json', authorization: `Bearer ${config.apiKey}` }
  let lastError: EnviaRequestError | null = null

  for (const buildPath of DEFAULT_PRINT_SETTINGS_PATHS) {
    const result = await fetchJson(
      `${config.queriesBaseUrl}${buildPath(normalizedCarrier)}`,
      { method: 'GET', headers },
      config.timeoutMs
    )

    if (result.status === 404 || result.status === 400) continue
    if (!result.ok) {
      lastError = buildRequestError(result, 'Envia print settings fallo')
      continue
    }

    const settings = extractPrintSettings(result.payload)
    if (settings) return settings
  }

  if (lastError) throw lastError
  return null
}

export async function createShippingLabel(
  env: EnviaEnvLike,
  payload: JsonRecord
): Promise<NormalizedShipmentResult> {
  const config = assertConfig(env)
  const headers = buildHeaders(config.apiKey)
  const result = await tryJsonPaths(
    config.shippingBaseUrl,
    LABEL_PATHS,
    { method: 'POST', headers, body: JSON.stringify(payload) },
    config.timeoutMs
  )

  if (!result.ok) {
    throw buildRequestError(result, 'Envia label fallo')
  }
  if (hasProviderError(result.payload)) {
    throw buildRequestError(result, 'Envia label fallo')
  }

  return normalizeShipmentResult(result.payload)
}

export async function trackShipment(
  env: EnviaEnvLike,
  payload: JsonRecord
): Promise<NormalizedTrackingResult> {
  const config = assertConfig(env)
  const headers = buildHeaders(config.apiKey)
  const result = await tryJsonPaths(
    config.shippingBaseUrl,
    TRACK_PATHS,
    { method: 'POST', headers, body: JSON.stringify(payload) },
    config.timeoutMs
  )

  if (!result.ok) {
    throw buildRequestError(result, 'Envia tracking fallo')
  }
  if (hasProviderError(result.payload)) {
    throw buildRequestError(result, 'Envia tracking fallo')
  }

  return normalizeTrackingResult(result.payload)
}

export async function listShipmentsByMonth(
  env: EnviaEnvLike,
  options: { month: number; year: number; limit?: number | null }
): Promise<NormalizedRemoteShipment[]> {
  const config = assertConfig(env)
  const limit = pickNumber(options.limit, 100) || 100
  for (const buildPath of SHIPMENTS_BY_MONTH_QUERY_PATHS) {
    try {
      const payload = await requestQueriesPayload(config, buildPath(options.month, options.year, limit))
      if (!payload) continue
      const shipments = normalizeRemoteShipmentCollection(payload)
      if (shipments.length > 0) return shipments
    } catch (error) {
      if (error instanceof EnviaRequestError && error.status === 404) continue
      throw error
    }
  }
  return []
}

export async function getRemoteShipment(
  env: EnviaEnvLike,
  identifiers: {
    shipmentId?: string | null
    trackingNumber?: string | null
    carrier?: string | null
  }
): Promise<NormalizedRemoteShipment | null> {
  const config = assertConfig(env)
  const shipmentId = pickString(identifiers.shipmentId)
  const trackingNumber = pickString(identifiers.trackingNumber)
  const directLookups = [
    ...(shipmentId ? SHIPMENT_BY_ID_QUERY_PATHS.map((buildPath) => buildPath(shipmentId)) : []),
    ...(trackingNumber
      ? SHIPMENT_BY_TRACKING_QUERY_PATHS.map((buildPath) => buildPath(trackingNumber))
      : [])
  ]

  for (const path of directLookups) {
    try {
      const payload = await requestQueriesPayload(config, path)
      if (!payload) continue
      const match = findMatchingRemoteShipment(
        normalizeRemoteShipmentCollection(payload),
        identifiers
      )
      if (match) return match
    } catch (error) {
      if (error instanceof EnviaRequestError && (error.status === 404 || error.status === 400)) {
        continue
      }
      throw error
    }
  }

  for (const { month, year } of monthYearOffsets(6)) {
    const shipments = await listShipmentsByMonth(env, { month, year, limit: 200 }).catch(() => [])
    const match = findMatchingRemoteShipment(shipments, identifiers)
    if (match) return match
  }

  return null
}

export async function cancelShipment(
  env: EnviaEnvLike,
  payload: JsonRecord
): Promise<{ payload: unknown }> {
  const config = assertConfig(env)
  const headers = buildHeaders(config.apiKey)
  const result = await tryJsonPaths(
    config.shippingBaseUrl,
    CANCEL_PATHS,
    { method: 'POST', headers, body: JSON.stringify(payload) },
    config.timeoutMs
  )

  if (!result.ok) {
    throw buildRequestError(result, 'Envia cancel fallo')
  }
  if (hasProviderError(result.payload)) {
    throw buildRequestError(result, 'Envia cancel fallo')
  }

  return { payload: result.payload }
}

export async function downloadLabelBinary(env: EnviaEnvLike, url: string): Promise<ArrayBuffer> {
  const config = assertConfig(env)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) {
      throw new Error(`No se pudo descargar la etiqueta (${response.status}).`)
    }
    return await response.arrayBuffer()
  } catch (error) {
    if (isAbortLikeError(error)) {
      throw new Error(`Envia tardo demasiado en responder (${config.timeoutMs} ms).`)
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}
