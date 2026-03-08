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

const DEFAULT_TIMEOUT_MS = 10000
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
const QUOTE_PATHS = ['/ship/rate/', '/ship/rates/', '/ship/quote/']
const LABEL_PATHS = ['/ship/generate/', '/ship/create/', '/ship/labels/']
const TRACK_PATHS = ['/ship/generaltrack/', '/ship/track/']
const QUERIES_PATHS = ['/webhook-types', '/carriers', '/shipments?limit=1']

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

  constructor(message: string, options: { status: number; payload: unknown; url: string }) {
    super(message)
    this.name = 'EnviaRequestError'
    this.status = options.status
    this.payload = options.payload
    this.url = options.url
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

function buildRequestError(result: RequestResult, fallbackLabel: string): EnviaRequestError {
  const payloadRecord = toRecord(result.payload)
  const message =
    pickString(payloadRecord?.message, payloadRecord?.error) || `${fallbackLabel} con HTTP ${result.status}.`
  return new EnviaRequestError(message, {
    status: result.status,
    payload: result.payload,
    url: result.url
  })
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
      ? Math.min(Math.max(timeoutMsRaw, 2000), 30000)
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
  const pools = [payload, record?.data, record?.results, record?.items]
  const out: JsonRecord[] = []
  for (const pool of pools) {
    if (Array.isArray(pool)) {
      for (const item of pool) {
        const object = toRecord(item)
        if (object) out.push(object)
      }
      if (out.length) return out
    }
  }
  return out
}

function normalizeCarrierNames(payload: unknown): string[] {
  const objects = topLevelObjects(payload)
  const names = objects
    .map((item) => {
      const active = truthyValue(item.active ?? item.enabled ?? item.available)
      if (active === false) return ''
      return pickString(item.name, item.carrier, item.slug, item.code, item.carrier_name)
    })
    .filter(Boolean)

  return [...new Set(names)]
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

      return getQuoteService(item)
    })
    .filter(Boolean)

  return [...new Set(names)]
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

  for (const buildPath of CARRIER_QUERY_PATHS) {
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

  return normalizeTrackingResult(result.payload)
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
  } finally {
    clearTimeout(timeoutId)
  }
}
