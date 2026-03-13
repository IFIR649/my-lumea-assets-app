import {
  cancelShipment,
  createShippingLabel,
  downloadLabelBinary,
  EnviaRequestError,
  getDefaultUserPrintSettings,
  getRemoteShipment,
  listAvailableCarriers,
  listAvailableServices,
  pingEnviaApis,
  quoteShipment,
  trackShipment,
  type EnviaHealthStatus,
  type NormalizedRemoteShipment,
  type NormalizedQuote,
  type NormalizedShipmentResult,
  normalizeTrackingResult
} from './envia'

interface Env {
  DB: D1Database
  ASSETS_BUCKET: R2Bucket
  R2_PUBLIC_BASE_URL?: string
  CORS_ORIGIN?: string
  ADMIN_API_TOKEN?: string
  ENVIA_MODE?: string
  ENVIA_API_KEY?: string
  ENVIA_SHIPPING_BASE_URL?: string
  ENVIA_QUERIES_BASE_URL?: string
  ENVIA_GEOCODES_BASE_URL?: string
  ENVIA_TIMEOUT_MS?: string
  ENVIA_WEBHOOK_TOKEN?: string
  ENVIA_FROM_NAME?: string
  ENVIA_FROM_COMPANY?: string
  ENVIA_FROM_PHONE?: string
  ENVIA_FROM_EMAIL?: string
  ENVIA_FROM_STREET?: string
  ENVIA_FROM_NUMBER?: string
  ENVIA_FROM_DISTRICT?: string
  ENVIA_FROM_CITY?: string
  ENVIA_FROM_STATE?: string
  ENVIA_FROM_ZIP?: string
  ENVIA_FROM_COUNTRY?: string
  ENVIA_DEFAULT_WEIGHT_KG?: string
  ENVIA_DEFAULT_LENGTH_CM?: string
  ENVIA_DEFAULT_WIDTH_CM?: string
  ENVIA_DEFAULT_HEIGHT_CM?: string
  ENVIA_DEFAULT_CONTENT?: string
  ENVIA_ALLOWED_CARRIERS?: string
}

type ProductRow = {
  id: number
  title: string
  slug: string
  type: string
  description: string
  short_desc: string
  price_cents: number
  stock: number
  image_key: string | null
  seo_slug?: string | null
  sku?: string | null
  brand?: string | null
  material?: string | null
  base_metal?: string | null
  finish_text?: string | null
  main_color?: string | null
  hypoallergenic?: number | null
  care_instructions?: string | null
  gift_ready?: number | null
  package_includes?: string | null
  shipping_time_min_days?: number | null
  shipping_time_max_days?: number | null
  return_window_days?: number | null
  is_bestseller?: number | null
  is_new_arrival?: number | null
  is_active?: number | null
  is_featured?: number | null
  currency?: string | null
  sort?: number | null
  canonical_path?: string
  images?: ProductImageResponse[]
}

type ProductImageRow = {
  id: number
  product_id: number
  position: number
  image_key: string
  alt_text: string | null
  created_at: string
}

type ProductImagePayload = {
  position?: number | null
  image_key?: string | null
  alt?: string | null
  alt_text?: string | null
}

type ProductImageResponse = {
  id: number
  position: number
  image_key: string
  alt: string
  url: string
}

type ProductPayload = {
  slug: string
  title: string
  type?: string
  description?: string
  short_desc?: string
  price_cents: number
  stock?: number
  image_key?: string | null
  images?: ProductImagePayload[]
  seo_slug?: string
  sku?: string
  brand?: string
  material?: string
  base_metal?: string
  finish_text?: string
  main_color?: string
  hypoallergenic?: boolean | number
  care_instructions?: string
  gift_ready?: boolean | number
  package_includes?: string
  shipping_time_min_days?: number | null
  shipping_time_max_days?: number | null
  return_window_days?: number | null
  is_bestseller?: boolean | number
  is_new_arrival?: boolean | number
  is_active?: boolean | number
  is_featured?: boolean | number
  currency?: string
  sort?: number
}

type ProductUpdatePayload = Partial<ProductPayload>

type NormalizedProductImagePayload = {
  position: number
  image_key: string
  alt_text: string
}

type NormalizedProductPayload = Omit<ProductPayload, 'stock' | 'image_key' | 'images'> & {
  stock: number
  image_key: string
  images: NormalizedProductImagePayload[]
  seo_slug: string
  sku: string
  brand: string
  material: string
  base_metal: string
  finish_text: string
  main_color: string
  hypoallergenic: number
  care_instructions: string
  gift_ready: number
  package_includes: string
  shipping_time_min_days: number | null
  shipping_time_max_days: number | null
  return_window_days: number
  is_bestseller: number
  is_new_arrival: number
  is_active: number
  is_featured: number
  currency: string
  sort: number
}

type ProductVariantRow = {
  id: number
  product_id: number
  sku: string
  option_name: string
  option_value: string
  price_cents: number | null
  stock: number
  is_active: number
  created_at: string
}

type ProductVariantPayload = {
  sku: string
  option_name: string
  option_value: string
  price_cents?: number | null
  stock?: number
  is_active?: boolean | number
}

type ProductVariantUpdatePayload = Partial<ProductVariantPayload>

type ProductReviewRow = {
  id: number
  product_id: number
  author_name: string
  rating: number
  title: string | null
  body: string | null
  verified_purchase: number
  is_published: number
  created_at: string
}

type ProductReviewPayload = {
  author_name: string
  rating: number
  title?: string
  body?: string
  verified_purchase?: boolean | number
  is_published?: boolean | number
}

type ProductReviewUpdatePayload = Partial<ProductReviewPayload>

type ProductTypeRow = {
  id: number
  type: string
  sort: number
}

type ShipmentBoxTypeRow = {
  id: number
  name: string
  code: string | null
  inner_length_cm: number
  inner_width_cm: number
  inner_height_cm: number
  max_products: number
  stock_qty: number
  is_active: number
  sort: number
  created_at: string
  updated_at: string
}

type ShippingStatus =
  | 'pending'
  | 'preparing'
  | 'in_transit'
  | 'delivered'
  | 'partially_cancelled'
  | 'cancelled'
  | 'lost'
type ShipmentApprovalStatus = 'pending' | 'approved' | 'rejected'

type DisplayStatus =
  | 'cancelado'
  | 'cancelado_parcial'
  | 'perdido'
  | 'pendiente_pago'
  | 'preparando_envio'
  | 'en_camino'
  | 'entregado'
  | 'pagado'

type OrderListRow = {
  id: string
  stripe_session_id: string | null
  customer_email: string
  customer_name: string | null
  customer_phone: string | null
  total_amount_cents: number
  currency: string
  status: string
  shipping_status: string | null
  created_at: string
  updated_at: string
  units_total: number
  items_count: number
  display_status: DisplayStatus
}

type OrderItemRow = {
  id: number
  order_id: string
  product_id: number
  product_slug: string
  quantity: number
  unit_price_cents: number
  product_title: string | null
  product_type: string | null
  product_image_key: string | null
}

type StockReservationRow = {
  id: number
  product_id: number
  quantity: number
  status: string
  expires_at: string
  created_at: string
  updated_at: string
}

type StripeEventRow = {
  id: number
  event_id: string
  event_type: string
  created_at: string
}

type OrderFilters = {
  q: string
  status: DisplayStatus | ''
  amountMinCents: number | null
  amountMaxCents: number | null
  dateFrom: string
  dateTo: string
  qtyMin: number | null
  qtyMax: number | null
  productQuery: string
}

type OrderUpdatePayload = {
  shipping_status?: ShippingStatus
  customer_name?: string
  customer_email?: string
  customer_phone?: string
  shipping_address_json?: unknown
  internal_note?: string | null
}

type OrderShipmentRow = {
  order_id: string
  provider: string
  mode: string
  approval_status: ShipmentApprovalStatus
  shipment_status: ShippingStatus
  carrier: string | null
  service: string | null
  tracking_number: string | null
  tracking_url: string | null
  envia_shipment_id: string | null
  label_r2_key: string | null
  quote_amount_cents: number | null
  currency: string
  parcel_json: string | null
  address_validation_json: string | null
  envia_request_json: string | null
  envia_response_json: string | null
  approved_at: string | null
  rejected_at: string | null
  rejected_reason: string | null
  last_sync_at: string | null
  last_error: string | null
  last_error_code: string | null
  tracking_sync_paused_at: string | null
  tracking_sync_pause_reason: string | null
  created_at: string
  updated_at: string
}

type OrderShipmentGuideRow = {
  order_id: string
  guide_index: number
  carrier: string | null
  service: string | null
  tracking_number: string | null
  tracking_url: string | null
  envia_shipment_id: string | null
  label_r2_key: string | null
  parcel_json: string | null
  envia_request_json: string | null
  envia_response_json: string | null
  shipment_status: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

type OrderShipmentEventRow = {
  id: number
  order_id: string
  event_type: string
  source: string
  payload_json: string | null
  created_at: string
}

type ShipmentListRow = {
  id: string
  created_at: string
  updated_at: string
  customer_name: string | null
  customer_email: string
  customer_phone: string | null
  total_amount_cents: number
  currency: string
  approval_status: ShipmentApprovalStatus
  shipment_status: ShippingStatus
  carrier: string | null
  service: string | null
  tracking_number: string | null
  tracking_url: string | null
  label_r2_key: string | null
  approved_at: string | null
  rejected_at: string | null
  rejected_reason: string | null
  last_sync_at: string | null
  last_error: string | null
  last_error_code: string | null
  tracking_sync_paused_at: string | null
  tracking_sync_pause_reason: string | null
}

type ShipmentListFilters = {
  status: ShippingStatus | ''
}

type ShipmentBoxPlanBoxPayload = {
  box_type_id?: number | string | null
  box_type_name?: string | null
  box_type_code?: string | null
  inner_length_cm?: number | string | null
  inner_width_cm?: number | string | null
  inner_height_cm?: number | string | null
  units_in_box?: number | string | null
  weight_kg?: number | string | null
  length_cm?: number | string | null
  width_cm?: number | string | null
  height_cm?: number | string | null
  declared_value_cents?: number | string | null
  content?: string | null
  notes?: string | null
}

type ShipmentBoxPlanPayload = {
  box_type_id?: number | string | null
  box_type_name?: string | null
  box_type_code?: string | null
  inner_length_cm?: number | string | null
  inner_width_cm?: number | string | null
  inner_height_cm?: number | string | null
  products_per_box?: number | string | null
  boxes?: ShipmentBoxPlanBoxPayload[] | null
}

type ShipmentBoxTypePayload = {
  name?: string | null
  code?: string | null
  inner_length_cm?: number | string | null
  inner_width_cm?: number | string | null
  inner_height_cm?: number | string | null
  max_products?: number | string | null
  stock_qty?: number | string | null
  is_active?: boolean | number | string | null
  sort?: number | string | null
}

type ShipmentQuotePayload = {
  weight_kg?: number | string | null
  length_cm?: number | string | null
  width_cm?: number | string | null
  height_cm?: number | string | null
  declared_value_cents?: number | string | null
  content?: string | null
  notes?: string | null
  carrier?: string | null
  service?: string | null
  box_plan?: ShipmentBoxPlanPayload | null
}

type ShipmentQuoteMode = 'auto' | 'manual'

type ShipmentSelectedQuotePayload = {
  carrier?: string | null
  service?: string | null
  amount_cents?: number | string | null
  currency?: string | null
  estimated_days?: number | string | null
}

type ShipmentApprovePayload = ShipmentQuotePayload & {
  mode?: ShipmentQuoteMode | null
  selected_quote?: ShipmentSelectedQuotePayload | null
}

type ShipmentQuoteSnapshot = {
  kind: 'quote_snapshot'
  mode: ShipmentQuoteMode
  quoted_at: string
  request: Record<string, unknown>
  selected_quote: NormalizedQuote | null
  quotes: NormalizedQuote[]
  attempted_carriers: string[]
  provider_payload: unknown
}

type LabelSettingsSource = 'provider' | 'fallback'

type ShipmentRejectPayload = {
  reason?: string | null
}

const DEFAULT_PRODUCT_TYPES: Array<{ type: string; sort: number }> = [
  { type: 'ring', sort: 100 },
  { type: 'necklace', sort: 90 },
  { type: 'set', sort: 80 },
  { type: 'earrings', sort: 70 },
  { type: 'jewelry', sort: 60 },
  { type: 'accessory', sort: 50 }
]

let ensureTypesCatalogPromise: Promise<void> | null = null
let ensureOrdersAdminSchemaPromise: Promise<void> | null = null
let ensureProductImagesSchemaPromise: Promise<void> | null = null
let ensureOrderShipmentsSchemaPromise: Promise<void> | null = null
const tableColumnsCache = new Map<string, Set<string>>()
const tableExistsCache = new Map<string, boolean>()
const ENVIA_HEALTH_TTL_MS = 60_000
const ENVIA_LABEL_SHIPMENT_TYPE = 1
const SHIPMENT_ERROR_CODE_APPROVAL_PARTIAL_FAILURE = 'approval_partial_failure'
const SHIPMENT_ERROR_CODE_CARRIER_ACCOUNT_MISMATCH = 'carrier_account_mismatch'
const SHIPMENT_ERROR_CODE_TRACKING_FORBIDDEN = 'tracking_forbidden'
const ENVIA_PRINT_SIZE_ENUMS = new Set([
  'PAPER_4.75X7',
  'PAPER_4X6',
  'PAPER_4X8',
  'PAPER_7X4.75',
  'PAPER_8.5X11',
  'PAPER_8.5X11_BOTTOM_HALF_LABEL',
  'PAPER_85X11_TOP_HALF_LABEL',
  'PAPER_LETTER',
  'STOCK_2.4X6',
  'STOCK_2.9X5',
  'STOCK_2.9X7',
  'STOCK_3.8X4.2',
  'STOCK_3.9X2.3',
  'STOCK_3.9X3.9',
  'STOCK_3.9X7',
  'STOCK_4X4',
  'STOCK_4X6',
  'STOCK_4X6.5',
  'STOCK_4X7.5',
  'STOCK_4X8',
  'STOCK_4X9',
  'PAPER_8.27X11.67',
  'STOCK_4X3',
  'STOCK_3.9X4.3'
])
const ENVIA_LABEL_SETTINGS_FALLBACK = {
  printFormat: 'PDF',
  printSize: 'STOCK_4X6',
  printType: 'thermal'
} as const
let enviaHealthCache: { status: EnviaHealthStatus; expiresAt: number } | null = null

const PRODUCT_BASE_COLUMNS = [
  'id',
  'title',
  'slug',
  'type',
  'description',
  'short_desc',
  'price_cents',
  'stock',
  'image_key'
] as const

const PRODUCT_OPTIONAL_COLUMNS = [
  'seo_slug',
  'sku',
  'brand',
  'material',
  'base_metal',
  'finish_text',
  'main_color',
  'hypoallergenic',
  'care_instructions',
  'gift_ready',
  'package_includes',
  'shipping_time_min_days',
  'shipping_time_max_days',
  'return_window_days',
  'is_bestseller',
  'is_new_arrival',
  'is_active',
  'is_featured',
  'currency',
  'sort'
] as const

const PRODUCT_ENRICHED_HEALTH_COLUMNS = [
  'seo_slug',
  'sku',
  'is_bestseller',
  'is_new_arrival'
] as const

const VARIANT_REQUIRED_COLUMNS = [
  'id',
  'product_id',
  'sku',
  'option_name',
  'option_value',
  'price_cents',
  'stock',
  'is_active',
  'created_at'
] as const

const REVIEW_REQUIRED_COLUMNS = [
  'id',
  'product_id',
  'author_name',
  'rating',
  'title',
  'body',
  'verified_purchase',
  'is_published',
  'created_at'
] as const

const PRODUCT_IMAGE_REQUIRED_COLUMNS = [
  'id',
  'product_id',
  'position',
  'image_key',
  'alt_text',
  'created_at'
] as const

const ORDER_SHIPMENT_REQUIRED_COLUMNS = [
  'order_id',
  'provider',
  'mode',
  'approval_status',
  'shipment_status',
  'carrier',
  'service',
  'tracking_number',
  'tracking_url',
  'envia_shipment_id',
  'label_r2_key',
  'quote_amount_cents',
  'currency',
  'parcel_json',
  'address_validation_json',
  'envia_request_json',
  'envia_response_json',
  'approved_at',
  'rejected_at',
  'rejected_reason',
  'last_sync_at',
  'last_error',
  'created_at',
  'updated_at'
] as const

const SHIPPING_STATUS_VALUES = [
  'pending',
  'preparing',
  'in_transit',
  'delivered',
  'partially_cancelled',
  'cancelled',
  'lost'
] as const satisfies readonly ShippingStatus[]

const DISPLAY_STATUS_VALUES = [
  'cancelado',
  'cancelado_parcial',
  'perdido',
  'pendiente_pago',
  'preparando_envio',
  'en_camino',
  'entregado',
  'pagado'
] as const satisfies readonly DisplayStatus[]

function workerLog(requestId: string, message: string, details?: unknown): void {
  if (details === undefined) {
    console.log(`[worker][${requestId}] ${message}`)
    return
  }

  console.log(`[worker][${requestId}] ${message}`, details)
}

function workerError(requestId: string, message: string, error: unknown): void {
  console.error(`[worker][${requestId}] ${message}`, error)
}

function getAllowedOrigin(request: Request, env: Env): string {
  const configured = env.CORS_ORIGIN?.trim()
  if (!configured || configured === '*') {
    return '*'
  }

  const requestOrigin = request.headers.get('Origin')
  if (!requestOrigin) {
    return configured.split(',')[0]?.trim() || configured
  }

  const allowedOrigins = configured
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  return allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0] || 'null'
}

function withCors(request: Request, env: Env, headers: Headers = new Headers()): Headers {
  headers.set('Access-Control-Allow-Origin', getAllowedOrigin(request, env))
  headers.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  headers.set('Vary', 'Origin')
  return headers
}

function json(request: Request, env: Env, body: unknown, status = 200): Response {
  const headers = withCors(request, env)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  return new Response(JSON.stringify(body), { status, headers })
}

function sanitizeFileName(fileName: string): string {
  const cleaned = fileName
    .replace(/[^a-zA-Z0-9.-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()

  return cleaned || `asset-${Date.now()}`
}

function normalizeAssetPrefix(value: unknown): string {
  const trimmed = String(value ?? '')
    .trim()
    .replace(/\\/g, '/')
  const normalized = trimmed.replace(/^\/+/, '').replace(/\/+/g, '/')
  if (!normalized) return 'products/'
  return normalized.endsWith('/') ? normalized : `${normalized}/`
}

function buildAssetUrl(env: Env, key: string): string {
  const baseUrl = env.R2_PUBLIC_BASE_URL?.trim().replace(/\/+$/, '')
  return baseUrl ? `${baseUrl}/${key}` : `/api/assets/${encodeURIComponent(key)}`
}

function buildAssetPreviewUrl(key: string): string {
  return `/api/assets/${encodeURIComponent(key)}`
}

function parseAssetsLimit(value: string | null): number {
  const parsed = Number.parseInt(String(value || '').trim(), 10)
  if (!Number.isInteger(parsed) || parsed <= 0) return 50
  return Math.min(parsed, 100)
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error'
}

class HttpError extends Error {
  status: number
  code: string | null

  constructor(message: string, status = 500, code: string | null = null) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.code = code
  }
}

function getHttpStatus(error: unknown, fallback = 500): number {
  return error instanceof HttpError ? error.status : fallback
}

function getErrorCode(error: unknown): string | null {
  return error instanceof HttpError ? error.code : null
}

function isCarrierAccountMismatchError(error: unknown): boolean {
  if (error instanceof EnviaRequestError && error.providerCode === '120121') {
    return true
  }
  const message = getErrorMessage(error).toLowerCase()
  return (
    message.includes('120121') ||
    message.includes("shipper's shipper number cannot be used for the shipment")
  )
}

function buildCarrierAccountMismatchMessage(quote: NormalizedQuote): string {
  return `Carrier/servicio ${quote.carrier}/${quote.service} no compatible con la cuenta actual de Envia. Vuelve a cotizar.`
}

function buildPartialApprovalFailureMessage(createdGuides: Array<Record<string, unknown>>): string {
  const count = createdGuides.length
  return `Incidente operativo: Envia genero ${count} guia(s) antes de fallar. El pedido sigue pendiente y requiere revision manual antes de reintentar.`
}

function isTrackingForbiddenError(error: unknown): boolean {
  return error instanceof EnviaRequestError && error.status === 403
}

function getChangesFromRun(result: unknown): number {
  if (!result || typeof result !== 'object') return 0
  const meta = (result as { meta?: unknown }).meta
  if (!meta || typeof meta !== 'object') return 0
  const changes = (meta as { changes?: unknown }).changes
  return typeof changes === 'number' ? changes : 0
}

type AssetUsageProduct = {
  product_id: number
  title: string
  slug: string
  seo_slug: string | null
  canonical_path: string
  role: 'primary' | 'gallery'
}

type AssetUsageEntry = {
  usage_count: number
  usage_products: AssetUsageProduct[]
}

function buildUsageProduct(
  row: Record<string, unknown>,
  role: 'primary' | 'gallery'
): AssetUsageProduct | null {
  const productId = Number(row.product_id || 0)
  const slug = String(row.slug || '').trim()
  if (!productId || !slug) return null

  const seoSlug = String(row.seo_slug || '').trim() || null

  return {
    product_id: productId,
    title: String(row.title || '').trim() || slug,
    slug,
    seo_slug: seoSlug,
    canonical_path: toCanonicalPath(slug, seoSlug),
    role
  }
}

function addAssetUsage(
  usageMap: Map<string, Map<number, AssetUsageProduct>>,
  key: string,
  product: AssetUsageProduct
): void {
  const normalizedKey = String(key || '').trim()
  if (!normalizedKey) return

  const perKey = usageMap.get(normalizedKey) || new Map<number, AssetUsageProduct>()
  const existing = perKey.get(product.product_id)
  if (!existing || existing.role !== 'primary') {
    perKey.set(product.product_id, product)
  }
  usageMap.set(normalizedKey, perKey)
}

async function getAssetUsageMap(env: Env, keys: string[]): Promise<Map<string, AssetUsageEntry>> {
  const normalizedKeys = [...new Set(keys.map((key) => String(key || '').trim()).filter(Boolean))]
  if (!normalizedKeys.length) return new Map()

  const columns = await existingColumns(env, 'products')
  if (!columns.has('image_key')) return new Map()

  const usageByKey = new Map<string, Map<number, AssetUsageProduct>>()
  const placeholders = normalizedKeys.map(() => '?').join(', ')
  const galleryReady = await productImagesTableReady(env, 'assets-usage')

  if (galleryReady) {
    const galleryResult = await env.DB.prepare(
      `SELECT
         pi.image_key,
         p.id AS product_id,
         p.title,
         p.slug,
         p.seo_slug,
         CASE
           WHEN pi.position = 1 OR p.image_key = pi.image_key THEN 'primary'
           ELSE 'gallery'
         END AS role
       FROM product_images pi
       INNER JOIN products p ON p.id = pi.product_id
       WHERE pi.image_key IN (${placeholders})
       ORDER BY p.id ASC, pi.position ASC, pi.id ASC`
    )
      .bind(...normalizedKeys)
      .all<Record<string, unknown>>()

    for (const row of galleryResult.results || []) {
      const key = String(row.image_key || '').trim()
      const role = String(row.role || '').trim() === 'primary' ? 'primary' : 'gallery'
      const product = buildUsageProduct(row, role)
      if (!product) continue
      addAssetUsage(usageByKey, key, product)
    }
  }

  const legacyWhere = galleryReady
    ? `p.image_key IN (${placeholders})
       AND NOT EXISTS (
         SELECT 1
         FROM product_images pi
         WHERE pi.product_id = p.id
           AND pi.image_key = p.image_key
       )`
    : `p.image_key IN (${placeholders})`

  const legacyResult = await env.DB.prepare(
    `SELECT
       p.image_key,
       p.id AS product_id,
       p.title,
       p.slug,
       p.seo_slug
     FROM products p
     WHERE ${legacyWhere}
     ORDER BY p.id ASC`
  )
    .bind(...normalizedKeys)
    .all<Record<string, unknown>>()

  for (const row of legacyResult.results || []) {
    const key = String(row.image_key || '').trim()
    const product = buildUsageProduct(row, 'primary')
    if (!product) continue
    addAssetUsage(usageByKey, key, product)
  }

  return new Map(
    [...usageByKey.entries()].map(([key, productMap]) => [
      key,
      {
        usage_count: productMap.size,
        usage_products: [...productMap.values()].sort((left, right) =>
          left.title.localeCompare(right.title, 'es-MX', { sensitivity: 'base' })
        )
      } satisfies AssetUsageEntry
    ])
  )
}

async function getAssetUsageCount(env: Env, key: string): Promise<number> {
  const usageMap = await getAssetUsageMap(env, [key])
  return usageMap.get(key)?.usage_count || 0
}

function getProductIdFromPath(pathname: string): number | null {
  const match = pathname.match(/^\/api\/products\/(\d+)$/)
  if (!match) return null

  const value = Number.parseInt(match[1], 10)
  if (!Number.isInteger(value) || value <= 0) return null

  return value
}

function getProductVariantRoute(
  pathname: string
): { productId: number; variantId: number | null } | null {
  const listMatch = pathname.match(/^\/api\/products\/(\d+)\/variants$/)
  if (listMatch) {
    const productId = Number.parseInt(listMatch[1], 10)
    if (!Number.isInteger(productId) || productId <= 0) return null
    return { productId, variantId: null }
  }

  const detailMatch = pathname.match(/^\/api\/products\/(\d+)\/variants\/(\d+)$/)
  if (!detailMatch) return null
  const productId = Number.parseInt(detailMatch[1], 10)
  const variantId = Number.parseInt(detailMatch[2], 10)
  if (!Number.isInteger(productId) || productId <= 0) return null
  if (!Number.isInteger(variantId) || variantId <= 0) return null
  return { productId, variantId }
}

function getProductReviewRoute(
  pathname: string
): { productId: number; reviewId: number | null } | null {
  const listMatch = pathname.match(/^\/api\/products\/(\d+)\/reviews$/)
  if (listMatch) {
    const productId = Number.parseInt(listMatch[1], 10)
    if (!Number.isInteger(productId) || productId <= 0) return null
    return { productId, reviewId: null }
  }

  const detailMatch = pathname.match(/^\/api\/products\/(\d+)\/reviews\/(\d+)$/)
  if (!detailMatch) return null
  const productId = Number.parseInt(detailMatch[1], 10)
  const reviewId = Number.parseInt(detailMatch[2], 10)
  if (!Number.isInteger(productId) || productId <= 0) return null
  if (!Number.isInteger(reviewId) || reviewId <= 0) return null
  return { productId, reviewId }
}

function getProductTypeIdFromPath(pathname: string): number | null {
  const match = pathname.match(/^\/api\/product-types\/(\d+)$/)
  if (!match) return null

  const value = Number.parseInt(match[1], 10)
  if (!Number.isInteger(value) || value <= 0) return null

  return value
}

function getOrderIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/api\/orders\/([^/]+)$/)
  if (!match) return null
  const decoded = decodeURIComponent(match[1] || '').trim()
  return decoded || null
}

function getShipmentOrderIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/api\/shipments\/([^/]+)$/)
  if (!match) return null
  const decoded = decodeURIComponent(match[1] || '').trim()
  return decoded || null
}

function getShipmentActionRoute(
  pathname: string
):
  | { orderId: string; action: 'quote'; mode: ShipmentQuoteMode }
  | {
      orderId: string
      action: 'approve-preview' | 'approve' | 'reject' | 'sync' | 'remote-refresh' | 'cancel-all'
    }
  | null {
  let match = pathname.match(/^\/api\/shipments\/([^/]+)\/quote\/(auto|manual)$/)
  if (match) {
    const orderId = decodeURIComponent(match[1] || '').trim()
    const mode = match[2] as ShipmentQuoteMode
    return orderId ? { orderId, action: 'quote', mode } : null
  }

  match = pathname.match(
    /^\/api\/shipments\/([^/]+)\/(approve-preview|approve|reject|sync|remote-refresh|cancel-all)$/
  )
  if (!match) return null
  const orderId = decodeURIComponent(match[1] || '').trim()
  const action = match[2] as
    | 'approve-preview'
    | 'approve'
    | 'reject'
    | 'sync'
    | 'remote-refresh'
    | 'cancel-all'
  return orderId ? { orderId, action } : null
}

function getShipmentGuideActionRoute(
  pathname: string
): { orderId: string; guideIndex: number; action: 'cancel' } | null {
  const match = pathname.match(/^\/api\/shipments\/([^/]+)\/guides\/(\d+)\/(cancel)$/)
  if (!match) return null
  const orderId = decodeURIComponent(match[1] || '').trim()
  const guideIndex = Number.parseInt(match[2] || '', 10)
  if (!orderId || !Number.isInteger(guideIndex) || guideIndex <= 0) return null
  return { orderId, guideIndex, action: 'cancel' }
}

function getShipmentBoxTypeIdFromPath(pathname: string): number | null {
  const match = pathname.match(/^\/api\/shipment-box-types\/(\d+)$/)
  if (!match) return null
  const value = Number.parseInt(match[1], 10)
  return Number.isInteger(value) && value > 0 ? value : null
}

function normalizeType(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
}

function normalizeSlug(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function parseBooleanToInt(value: unknown, fallback = 0): number {
  if (value === undefined || value === null || value === '') return fallback
  if (typeof value === 'boolean') return value ? 1 : 0
  if (typeof value === 'number') return value > 0 ? 1 : 0
  const normalized = String(value).trim().toLowerCase()
  if (!normalized) return fallback
  if (['1', 'true', 'yes', 'si', 'on'].includes(normalized)) return 1
  if (['0', 'false', 'no', 'off'].includes(normalized)) return 0
  return fallback
}

function parseNonNegativeInteger(value: unknown, fallback: number | null = 0): number | null {
  if (value === undefined || value === null || value === '') return fallback
  const n = Number(value)
  if (!Number.isInteger(n) || n < 0) return null
  return n
}

function normalizeOptionalText(value: unknown): string {
  return String(value ?? '').trim()
}

function toCanonicalPath(slug: unknown, seoSlug: unknown): string {
  const resolved = normalizeSlug(seoSlug) || normalizeSlug(slug)
  return `/producto/${resolved}`
}

function getRunLastRowId(result: unknown): number | null {
  if (!result || typeof result !== 'object') return null
  const meta = (result as { meta?: Record<string, unknown> }).meta
  if (!meta || typeof meta !== 'object') return null
  const candidate = meta['last_row_id']
  return typeof candidate === 'number' && Number.isInteger(candidate) ? candidate : null
}

function isUniqueConstraintError(error: unknown, token: string): boolean {
  const msg = getErrorMessage(error).toLowerCase()
  return msg.includes('unique constraint failed') && msg.includes(token.toLowerCase())
}

function parseInteger(value: unknown): number | null {
  if (value === undefined || value === null) return null
  if (typeof value === 'string' && value.trim() === '') return null
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : null
}

function parseCurrencyInputToCents(value: string | null): number | null {
  if (!value) return null
  const normalized = value.trim()
  if (!normalized) return null
  const parsed = Number.parseFloat(normalized)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return Math.round(parsed * 100)
}

function parsePositiveIntegerInput(value: string | null): number | null {
  if (!value) return null
  const parsed = Number.parseInt(value, 10)
  if (!Number.isInteger(parsed) || parsed < 0) return null
  return parsed
}

function parseDateInput(value: string | null): string {
  if (!value) return ''
  const normalized = value.trim()
  if (!normalized) return ''
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : ''
}

function toDisplayStatus(status: string, shippingStatus: string | null): DisplayStatus {
  const normalizedStatus = String(status || '').toLowerCase()
  const normalizedShipping = String(shippingStatus || '').toLowerCase()

  if (normalizedShipping === 'cancelled' || normalizedStatus === 'cancelled') return 'cancelado'
  if (normalizedShipping === 'partially_cancelled') return 'cancelado_parcial'
  if (normalizedShipping === 'lost') return 'perdido'
  if (normalizedStatus === 'unpaid') return 'pendiente_pago'
  if (normalizedShipping === 'preparing') return 'preparando_envio'
  if (normalizedShipping === 'in_transit' || normalizedStatus === 'shipped') return 'en_camino'
  if (normalizedShipping === 'delivered') return 'entregado'
  return 'pagado'
}

function parseShippingAddress(value: string | null): unknown {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function normalizeShippingStatus(value: unknown): ShippingStatus | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return SHIPPING_STATUS_VALUES.includes(normalized as ShippingStatus)
    ? (normalized as ShippingStatus)
    : null
}

function readBearerToken(request: Request): string | null {
  const header = request.headers.get('Authorization') || request.headers.get('authorization')
  if (!header) return null
  const match = header.match(/^Bearer\s+(.+)$/i)
  if (!match) return null
  const token = match[1]?.trim()
  return token || null
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timeout after ${timeoutMs}ms`)),
          timeoutMs
        )
      })
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function ensureProductTypesCatalog(env: Env, requestId: string): Promise<void> {
  if (!ensureTypesCatalogPromise) {
    ensureTypesCatalogPromise = (async () => {
      workerLog(requestId, 'types:ensure:start')
      await env.DB.prepare(
        `
        CREATE TABLE IF NOT EXISTS product_types (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT NOT NULL UNIQUE,
          sort INTEGER NOT NULL DEFAULT 0
        )
        `
      ).run()

      await env.DB.prepare(
        'CREATE INDEX IF NOT EXISTS idx_product_types_sort ON product_types(sort DESC, type ASC)'
      ).run()

      for (const entry of DEFAULT_PRODUCT_TYPES) {
        await env.DB.prepare('INSERT OR IGNORE INTO product_types (type, sort) VALUES (?, ?)')
          .bind(entry.type, entry.sort)
          .run()
      }

      await env.DB.prepare(
        `
        INSERT OR IGNORE INTO product_types (type, sort)
        SELECT DISTINCT LOWER(TRIM(type)) as type, 0
        FROM products
        WHERE type IS NOT NULL AND TRIM(type) <> ''
        `
      ).run()
      workerLog(requestId, 'types:ensure:done')
    })().catch((error) => {
      ensureTypesCatalogPromise = null
      throw error
    })
  }

  await ensureTypesCatalogPromise
}

async function tableExists(env: Env, tableName: string): Promise<boolean> {
  if (tableExistsCache.has(tableName)) return Boolean(tableExistsCache.get(tableName))
  const row = await env.DB.prepare(
    "SELECT 1 as ok FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1"
  )
    .bind(tableName)
    .first<{ ok: number }>()
  const exists = Boolean(row?.ok)
  tableExistsCache.set(tableName, exists)
  return exists
}

async function existingColumns(env: Env, tableName: string): Promise<Set<string>> {
  const cached = tableColumnsCache.get(tableName)
  if (cached) return cached

  const exists = await tableExists(env, tableName)
  if (!exists) {
    const empty = new Set<string>()
    tableColumnsCache.set(tableName, empty)
    return empty
  }

  const rows = await env.DB.prepare(`PRAGMA table_info(${tableName})`).all<{ name: string }>()
  const set = new Set(
    (rows.results || []).map((row) => String(row.name || '').trim()).filter(Boolean)
  )
  tableColumnsCache.set(tableName, set)
  return set
}

async function tableHasColumn(env: Env, tableName: string, columnName: string): Promise<boolean> {
  const cols = await existingColumns(env, tableName)
  return cols.has(columnName)
}

function clearTableMetadataCache(tableName: string): void {
  tableExistsCache.delete(tableName)
  tableColumnsCache.delete(tableName)
}

async function ensureProductImagesSchema(env: Env, requestId: string): Promise<void> {
  if (!ensureProductImagesSchemaPromise) {
    ensureProductImagesSchemaPromise = (async () => {
      workerLog(requestId, 'product-images:schema:start')
      clearTableMetadataCache('product_images')

      await env.DB.prepare(
        `
        CREATE TABLE IF NOT EXISTS product_images (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          product_id INTEGER NOT NULL,
          position INTEGER NOT NULL CHECK(position BETWEEN 1 AND 3),
          image_key TEXT NOT NULL,
          alt_text TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
        )
        `
      ).run()

      await env.DB.prepare(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_product_images_product_position
         ON product_images(product_id, position)`
      ).run()

      await env.DB.prepare(
        `CREATE INDEX IF NOT EXISTS idx_product_images_product
         ON product_images(product_id, position)`
      ).run()

      await env.DB.prepare(
        `
        INSERT INTO product_images (product_id, position, image_key, alt_text)
        SELECT
          p.id,
          1,
          p.image_key,
          CASE
            WHEN p.title IS NULL OR TRIM(p.title) = '' THEN NULL
            ELSE TRIM(p.title)
          END
        FROM products p
        WHERE p.image_key IS NOT NULL
          AND TRIM(p.image_key) <> ''
          AND NOT EXISTS (
            SELECT 1
            FROM product_images pi
            WHERE pi.product_id = p.id
          )
        `
      ).run()

      clearTableMetadataCache('product_images')
      workerLog(requestId, 'product-images:schema:done')
    })().catch((error) => {
      ensureProductImagesSchemaPromise = null
      throw error
    })
  }

  await ensureProductImagesSchemaPromise
}

async function ensureOrdersAdminSchema(env: Env, requestId: string): Promise<void> {
  if (!ensureOrdersAdminSchemaPromise) {
    ensureOrdersAdminSchemaPromise = (async () => {
      workerLog(requestId, 'orders:schema:start')

      const hasShippingStatus = await tableHasColumn(env, 'orders', 'shipping_status')
      if (!hasShippingStatus) {
        await env.DB.prepare(
          "ALTER TABLE orders ADD COLUMN shipping_status TEXT NOT NULL DEFAULT 'pending'"
        ).run()
      }

      const hasInternalNote = await tableHasColumn(env, 'orders', 'internal_note')
      if (!hasInternalNote) {
        await env.DB.prepare('ALTER TABLE orders ADD COLUMN internal_note TEXT').run()
      }

      await env.DB.prepare(
        `
          UPDATE orders
          SET shipping_status = CASE
            WHEN status = 'shipped' THEN 'in_transit'
            WHEN status = 'cancelled' THEN 'cancelled'
            ELSE 'pending'
          END
          WHERE shipping_status IS NULL OR TRIM(shipping_status) = ''
        `
      ).run()

      await env.DB.prepare(
        `
          UPDATE orders
          SET shipping_status = 'in_transit'
          WHERE status = 'shipped' AND shipping_status = 'pending'
        `
      ).run()

      await env.DB.prepare(
        `
          UPDATE orders
          SET shipping_status = 'cancelled'
          WHERE status = 'cancelled'
            AND shipping_status NOT IN ('cancelled', 'lost')
        `
      ).run()

      await env.DB.prepare(
        'CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC)'
      ).run()
      await env.DB.prepare(
        'CREATE INDEX IF NOT EXISTS idx_orders_shipping_status ON orders(shipping_status)'
      ).run()
      await env.DB.prepare(
        'CREATE INDEX IF NOT EXISTS idx_order_items_product_slug ON order_items(product_slug)'
      ).run()

      workerLog(requestId, 'orders:schema:done')
    })().catch((error) => {
      ensureOrdersAdminSchemaPromise = null
      throw error
    })
  }

  await ensureOrdersAdminSchemaPromise
}

async function ensureOrderShipmentsSchema(env: Env, requestId: string): Promise<void> {
  if (!ensureOrderShipmentsSchemaPromise) {
    ensureOrderShipmentsSchemaPromise = (async () => {
      workerLog(requestId, 'shipments:schema:start')
      clearTableMetadataCache('order_shipments')
      clearTableMetadataCache('order_shipment_events')
      clearTableMetadataCache('order_shipment_guides')
      clearTableMetadataCache('shipment_box_types')

      await env.DB.prepare(
        `
        CREATE TABLE IF NOT EXISTS order_shipments (
          order_id TEXT PRIMARY KEY,
          provider TEXT NOT NULL DEFAULT 'envia',
          mode TEXT NOT NULL DEFAULT 'test',
          approval_status TEXT NOT NULL DEFAULT 'pending',
          shipment_status TEXT NOT NULL DEFAULT 'pending',
          carrier TEXT,
          service TEXT,
          tracking_number TEXT,
          tracking_url TEXT,
          envia_shipment_id TEXT,
          label_r2_key TEXT,
          quote_amount_cents INTEGER,
          currency TEXT NOT NULL DEFAULT 'MXN',
          parcel_json TEXT,
          address_validation_json TEXT,
          envia_request_json TEXT,
          envia_response_json TEXT,
          approved_at TEXT,
          rejected_at TEXT,
          rejected_reason TEXT,
          last_sync_at TEXT,
          last_error TEXT,
          last_error_code TEXT,
          tracking_sync_paused_at TEXT,
          tracking_sync_pause_reason TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
        )
        `
      ).run()

      const hasLastErrorCode = await tableHasColumn(env, 'order_shipments', 'last_error_code')
      if (!hasLastErrorCode) {
        await env.DB.prepare('ALTER TABLE order_shipments ADD COLUMN last_error_code TEXT').run()
      }

      const hasTrackingSyncPausedAt = await tableHasColumn(
        env,
        'order_shipments',
        'tracking_sync_paused_at'
      )
      if (!hasTrackingSyncPausedAt) {
        await env.DB.prepare(
          'ALTER TABLE order_shipments ADD COLUMN tracking_sync_paused_at TEXT'
        ).run()
      }

      const hasTrackingSyncPauseReason = await tableHasColumn(
        env,
        'order_shipments',
        'tracking_sync_pause_reason'
      )
      if (!hasTrackingSyncPauseReason) {
        await env.DB.prepare(
          'ALTER TABLE order_shipments ADD COLUMN tracking_sync_pause_reason TEXT'
        ).run()
      }

      await env.DB.prepare(
        `CREATE INDEX IF NOT EXISTS idx_order_shipments_approval_status
         ON order_shipments(approval_status, shipment_status, created_at DESC)`
      ).run()

      await env.DB.prepare(
        `CREATE INDEX IF NOT EXISTS idx_order_shipments_tracking_number
         ON order_shipments(tracking_number)`
      ).run()

      await env.DB.prepare(
        `CREATE INDEX IF NOT EXISTS idx_order_shipments_envia_shipment_id
         ON order_shipments(envia_shipment_id)`
      ).run()

      await env.DB.prepare(
        `
        CREATE TABLE IF NOT EXISTS order_shipment_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_id TEXT NOT NULL,
          event_type TEXT NOT NULL,
          source TEXT NOT NULL,
          payload_json TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
        )
        `
      ).run()

      await env.DB.prepare(
        `CREATE INDEX IF NOT EXISTS idx_order_shipment_events_order
         ON order_shipment_events(order_id, created_at DESC)`
      ).run()

      await env.DB.prepare(
        `
        CREATE TABLE IF NOT EXISTS order_shipment_guides (
          order_id TEXT NOT NULL,
          guide_index INTEGER NOT NULL,
          carrier TEXT,
          service TEXT,
          tracking_number TEXT,
          tracking_url TEXT,
          envia_shipment_id TEXT,
          label_r2_key TEXT,
          parcel_json TEXT,
          envia_request_json TEXT,
          envia_response_json TEXT,
          shipment_status TEXT NOT NULL DEFAULT 'pending',
          last_error TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          PRIMARY KEY (order_id, guide_index),
          FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
        )
        `
      ).run()

      await env.DB.prepare(
        `CREATE INDEX IF NOT EXISTS idx_order_shipment_guides_tracking_number
         ON order_shipment_guides(tracking_number)`
      ).run()

      await env.DB.prepare(
        `CREATE INDEX IF NOT EXISTS idx_order_shipment_guides_order
         ON order_shipment_guides(order_id, guide_index ASC)`
      ).run()

      await env.DB.prepare(
        `
        CREATE TABLE IF NOT EXISTS shipment_box_types (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          code TEXT,
          inner_length_cm REAL NOT NULL,
          inner_width_cm REAL NOT NULL,
          inner_height_cm REAL NOT NULL,
          max_products INTEGER NOT NULL,
          stock_qty INTEGER NOT NULL DEFAULT 0,
          is_active INTEGER NOT NULL DEFAULT 1,
          sort INTEGER NOT NULL DEFAULT 100,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
        `
      ).run()

      await env.DB.prepare(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_shipment_box_types_code
         ON shipment_box_types(code)
         WHERE code IS NOT NULL AND TRIM(code) <> ''`
      ).run()

      await env.DB.prepare(
        `CREATE INDEX IF NOT EXISTS idx_shipment_box_types_active_sort
         ON shipment_box_types(is_active, sort ASC, id ASC)`
      ).run()

      await env.DB.prepare(
        `
          INSERT INTO order_shipments (
            order_id,
            provider,
            mode,
            approval_status,
            shipment_status,
            currency,
            parcel_json,
            created_at,
            updated_at
          )
          SELECT
            o.id,
            'envia',
            'test',
            'pending',
            COALESCE(o.shipping_status, 'pending'),
            COALESCE(o.currency, 'MXN'),
            json_object(
              'weight_kg', 1,
              'length_cm', 10,
              'width_cm', 10,
              'height_cm', 10,
              'declared_value_cents', COALESCE(o.total_amount_cents, 0),
              'content', 'Joyeria Lumea Imperium',
              'notes', NULL
            ),
            o.created_at,
            o.updated_at
          FROM orders o
          WHERE o.status <> 'unpaid'
            AND NOT EXISTS (
              SELECT 1
              FROM order_shipments os
              WHERE os.order_id = o.id
            )
        `
      ).run()

      clearTableMetadataCache('order_shipments')
      clearTableMetadataCache('order_shipment_events')
      clearTableMetadataCache('order_shipment_guides')
      workerLog(requestId, 'shipments:schema:done')
    })().catch((error) => {
      ensureOrderShipmentsSchemaPromise = null
      throw error
    })
  }

  await ensureOrderShipmentsSchemaPromise
}

function safeParseJson(value: string | null): unknown {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function safeStringify(value: unknown): string | null {
  if (value === null || value === undefined) return null
  try {
    return JSON.stringify(value)
  } catch {
    return null
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

function toObjectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function cleanText(value: unknown): string | null {
  const normalized = String(value || '').trim()
  return normalized || null
}

const ENVIA_GEOCODE_CANDIDATES = [
  (zip: string, country = 'MX') =>
    `/zipcode/${encodeURIComponent(country)}/${encodeURIComponent(zip)}`,
  (zip: string) => `/validate-zip-code?zip_code=${encodeURIComponent(zip)}`,
  (zip: string) => `/validate-zip-code?postal_code=${encodeURIComponent(zip)}`
]

const enviaMxStateCodeCache = new Map<string, string>()

function compactObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    const compacted = value
      .map((item) => compactObject(item))
      .filter((item) => item !== null && item !== undefined)
    return compacted
  }

  if (!value || typeof value !== 'object') {
    return value
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .map(([key, entryValue]) => [key, compactObject(entryValue)] as const)
    .filter(([, entryValue]) => {
      if (entryValue === null || entryValue === undefined) return false
      if (typeof entryValue === 'string' && !entryValue.trim()) return false
      if (Array.isArray(entryValue) && entryValue.length === 0) return false
      if (
        typeof entryValue === 'object' &&
        !Array.isArray(entryValue) &&
        Object.keys(entryValue as Record<string, unknown>).length === 0
      ) {
        return false
      }
      return true
    })

  return Object.fromEntries(entries)
}

function normalizeCountryCode(value: unknown, fallback = 'MX'): string {
  return (
    String(value || fallback)
      .trim()
      .toUpperCase() || fallback
  )
}

function normalizeMxStateCode(value: unknown): string | null {
  const raw = cleanText(value)
  if (!raw) return null

  const normalized = raw.toUpperCase()
  if (/^[A-Z]{2,3}$/.test(normalized)) {
    return normalized
  }

  const isoMatch = normalized.match(/(?:^|-)(([A-Z]{2,3}))$/)
  if (isoMatch) {
    return isoMatch[1]
  }

  return null
}

function extractMxStateCodeFromValidation(
  validation: Record<string, unknown> | null
): string | null {
  if (!validation) return null

  const raw = toObjectRecord(validation.raw)
  const stateRecord = toObjectRecord(raw?.state)
  const stateCodeRecord = toObjectRecord(stateRecord?.code)

  return (
    normalizeMxStateCode(stateCodeRecord?.['2digit']) ||
    normalizeMxStateCode(stateCodeRecord?.['3digit']) ||
    normalizeMxStateCode(stateRecord?.iso_code) ||
    normalizeMxStateCode(validation.state)
  )
}

function resolveEnviaTimeoutMs(env: Env): number {
  const parsed = Number(env.ENVIA_TIMEOUT_MS || 45000)
  if (!Number.isFinite(parsed) || parsed <= 0) return 45000
  return Math.max(2000, Math.min(parsed, 60000))
}

function resolveEnviaGeocodesBaseUrl(env: Env): string {
  return cleanText(env.ENVIA_GEOCODES_BASE_URL) || 'https://geocodes.envia.com'
}

async function fetchJsonWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<unknown> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    if (!response.ok) {
      return null
    }

    const text = await response.text()
    if (!text) return null

    try {
      return JSON.parse(text)
    } catch {
      return null
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

function extractMxStateCodeFromGeocodePayload(payload: unknown): string | null {
  const root = toObjectRecord(payload)
  const candidates = [
    payload,
    root?.data,
    root?.results,
    root?.items,
    root?.zip_code,
    root?.postal_code
  ]

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      for (const item of candidate) {
        const stateCode = extractMxStateCodeFromValidation({ raw: item })
        if (stateCode) return stateCode
      }
      continue
    }

    const stateCode = extractMxStateCodeFromValidation({ raw: candidate })
    if (stateCode) return stateCode
  }

  return null
}

async function lookupMxStateCodeByZip(
  env: Env,
  postalCode: string | null,
  countryCode: string
): Promise<string | null> {
  const normalizedPostalCode = cleanText(postalCode)
  if (!normalizedPostalCode || countryCode !== 'MX') return null

  const cacheKey = `${countryCode}:${normalizedPostalCode}`
  const cached = enviaMxStateCodeCache.get(cacheKey)
  if (cached) return cached

  const apiKey = cleanText(env.ENVIA_API_KEY)
  if (!apiKey) return null

  const headers = {
    accept: 'application/json',
    authorization: `Bearer ${apiKey}`
  }
  const baseUrl = resolveEnviaGeocodesBaseUrl(env).replace(/\/+$/, '')
  const timeoutMs = resolveEnviaTimeoutMs(env)

  for (const buildPath of ENVIA_GEOCODE_CANDIDATES) {
    const payload = await fetchJsonWithTimeout(
      `${baseUrl}${buildPath(normalizedPostalCode, countryCode)}`,
      { method: 'GET', headers },
      timeoutMs
    ).catch(() => null)

    const stateCode = extractMxStateCodeFromGeocodePayload(payload)
    if (stateCode) {
      enviaMxStateCodeCache.set(cacheKey, stateCode)
      return stateCode
    }
  }

  return null
}

function parsePositiveFloat(value: unknown, fallback: number | null = null): number | null {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.round(parsed * 1000) / 1000
}

function parsePositiveInteger(value: unknown, fallback: number | null = null): number | null {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback
  return parsed
}

function parseNonNegativeCents(value: unknown, fallback: number | null = null): number | null {
  if (value === null || value === undefined || value === '') return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return Math.round(parsed)
}

function parseShipmentBoxTypeId(value: unknown, fallback: number | null = null): number | null {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback
  return parsed
}

function buildShipmentBoxTypeSnapshot(
  row: ShipmentBoxTypeRow | Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  const record = toObjectRecord(row)
  if (!record) return null
  const id = parseShipmentBoxTypeId(record.id ?? record.box_type_id, null)
  const name = cleanText(record.name ?? record.box_type_name)
  const code = cleanText(record.code ?? record.box_type_code)
  const innerLength = parsePositiveFloat(record.inner_length_cm, null)
  const innerWidth = parsePositiveFloat(record.inner_width_cm, null)
  const innerHeight = parsePositiveFloat(record.inner_height_cm, null)

  if (!id && !name && !code && !innerLength && !innerWidth && !innerHeight) {
    return null
  }

  return compactObject({
    box_type_id: id,
    box_type_name: name,
    box_type_code: code,
    inner_length_cm: innerLength,
    inner_width_cm: innerWidth,
    inner_height_cm: innerHeight
  }) as Record<string, unknown>
}

function mergeShipmentBoxTypeSnapshot(
  target: Record<string, unknown>,
  snapshot: Record<string, unknown> | null
): Record<string, unknown> {
  if (!snapshot) return target
  return {
    ...target,
    ...snapshot
  }
}

function toShipmentBoxTypeResponse(row: ShipmentBoxTypeRow): Record<string, unknown> {
  return {
    id: Number(row.id || 0),
    name: row.name,
    code: row.code || null,
    inner_length_cm: Number(row.inner_length_cm || 0),
    inner_width_cm: Number(row.inner_width_cm || 0),
    inner_height_cm: Number(row.inner_height_cm || 0),
    max_products: Number(row.max_products || 0),
    stock_qty: Number(row.stock_qty || 0),
    is_active: Number(row.is_active || 0) > 0,
    sort: Number(row.sort || 0),
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

function normalizeShipmentBoxTypePayload(
  payload: ShipmentBoxTypePayload | null | undefined,
  options: { partial?: boolean } = {}
): { ok: true; values: Record<string, unknown> } | { ok: false; error: string } {
  const partial = Boolean(options.partial)
  const values: Record<string, unknown> = {}

  if (payload?.name !== undefined) {
    const name = cleanText(payload.name)
    if (!name) return { ok: false, error: 'El nombre de la caja es obligatorio.' }
    values.name = name
  } else if (!partial) {
    return { ok: false, error: 'El nombre de la caja es obligatorio.' }
  }

  if (payload?.code !== undefined) {
    values.code = cleanText(payload.code)
  }

  const numericFields: Array<{
    key: keyof ShipmentBoxTypePayload
    target: string
    label: string
  }> = [
    { key: 'inner_length_cm', target: 'inner_length_cm', label: 'Largo interno' },
    { key: 'inner_width_cm', target: 'inner_width_cm', label: 'Ancho interno' },
    { key: 'inner_height_cm', target: 'inner_height_cm', label: 'Alto interno' },
    { key: 'max_products', target: 'max_products', label: 'Maximo de productos' }
  ]

  for (const field of numericFields) {
    if (payload?.[field.key] !== undefined) {
      const parsed = parsePositiveFloat(payload[field.key], null)
      if (!parsed) {
        return { ok: false, error: `${field.label} debe ser mayor a cero.` }
      }
      values[field.target] =
        field.key === 'max_products' ? Math.round(parsed) : Math.round(parsed * 1000) / 1000
    } else if (!partial) {
      return { ok: false, error: `${field.label} es obligatorio.` }
    }
  }

  if (payload?.stock_qty !== undefined) {
    const stockQty = parseNonNegativeInteger(payload.stock_qty, null)
    if (stockQty === null) {
      return { ok: false, error: 'El stock de cajas debe ser cero o mayor.' }
    }
    values.stock_qty = stockQty
  } else if (!partial) {
    values.stock_qty = 0
  }

  if (payload?.is_active !== undefined) {
    values.is_active = parseBooleanToInt(payload.is_active, 1)
  } else if (!partial) {
    values.is_active = 1
  }

  if (payload?.sort !== undefined) {
    const sort = parseInteger(payload.sort)
    if (sort === null) return { ok: false, error: 'El orden debe ser un entero.' }
    values.sort = sort
  } else if (!partial) {
    values.sort = 100
  }

  if (Object.keys(values).length === 0) {
    return { ok: false, error: 'No se enviaron campos para la caja.' }
  }

  return { ok: true, values }
}

function parseShipmentApprovalStatus(value: unknown): ShipmentApprovalStatus {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
  if (normalized === 'approved') return 'approved'
  if (normalized === 'rejected') return 'rejected'
  return 'pending'
}

function normalizeWorkerShippingStatus(value: unknown): ShippingStatus {
  return normalizeShippingStatus(value) || 'pending'
}

function extractRemoteShipmentMeta(value: unknown): {
  cancelable: boolean | null
  status_text: string | null
  checked_at: string | null
} {
  const record = toObjectRecord(value)
  const remoteDetail = toObjectRecord(record?.remote_detail)
  const tracking = toObjectRecord(record?.tracking)
  const cancelableValue =
    record?.remote_cancelable ??
    remoteDetail?.cancelable ??
    tracking?.cancelable ??
    record?.cancelable
  const statusText =
    cleanText(record?.remote_status_text) ||
    cleanText(remoteDetail?.status_text) ||
    cleanText(remoteDetail?.status) ||
    cleanText(tracking?.status_text) ||
    cleanText(tracking?.status)

  return {
    cancelable:
      typeof cancelableValue === 'boolean'
        ? cancelableValue
        : typeof cancelableValue === 'number'
          ? cancelableValue > 0
          : typeof cancelableValue === 'string'
            ? ['1', 'true', 'yes', 'si', 'active'].includes(cancelableValue.trim().toLowerCase())
            : null,
    status_text: statusText,
    checked_at: cleanText(record?.remote_checked_at) || cleanText(record?.checked_at)
  }
}

function toShipmentGuide(row: OrderShipmentGuideRow, env: Env): Record<string, unknown> {
  const enviaResponse = safeParseJson(row.envia_response_json)
  const remoteMeta = extractRemoteShipmentMeta(enviaResponse)
  const parcel = safeParseJson(row.parcel_json)
  const parcelRecord = toObjectRecord(parcel)
  return {
    guide_index: Number(row.guide_index || 0),
    carrier: row.carrier || null,
    service: row.service || null,
    tracking_number: row.tracking_number || null,
    tracking_url: row.tracking_url || null,
    envia_shipment_id: row.envia_shipment_id || null,
    label_r2_key: row.label_r2_key || null,
    label_url: row.label_r2_key ? buildAssetUrl(env, row.label_r2_key) : null,
    parcel,
    envia_request: safeParseJson(row.envia_request_json),
    envia_response: enviaResponse,
    shipment_status: normalizeWorkerShippingStatus(row.shipment_status),
    remote_cancelable: remoteMeta.cancelable,
    remote_status_text: remoteMeta.status_text,
    remote_checked_at: remoteMeta.checked_at,
    box_type: buildShipmentBoxTypeSnapshot(toObjectRecord(parcelRecord?.box_type) || parcelRecord),
    last_error: row.last_error || null,
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

function buildLegacyShipmentGuide(
  shipmentRow: OrderShipmentRow,
  env: Env
): Record<string, unknown> | null {
  if (
    !shipmentRow.tracking_number &&
    !shipmentRow.label_r2_key &&
    !shipmentRow.envia_shipment_id &&
    !shipmentRow.parcel_json
  ) {
    return null
  }

  const enviaResponse = safeParseJson(shipmentRow.envia_response_json)
  const remoteMeta = extractRemoteShipmentMeta(enviaResponse)
  const parcel = safeParseJson(shipmentRow.parcel_json)
  const parcelRecord = toObjectRecord(parcel)
  return {
    guide_index: 1,
    carrier: shipmentRow.carrier || null,
    service: shipmentRow.service || null,
    tracking_number: shipmentRow.tracking_number || null,
    tracking_url: shipmentRow.tracking_url || null,
    envia_shipment_id: shipmentRow.envia_shipment_id || null,
    label_r2_key: shipmentRow.label_r2_key || null,
    label_url: shipmentRow.label_r2_key ? buildAssetUrl(env, shipmentRow.label_r2_key) : null,
    parcel,
    envia_request: safeParseJson(shipmentRow.envia_request_json),
    envia_response: enviaResponse,
    shipment_status: normalizeWorkerShippingStatus(shipmentRow.shipment_status),
    remote_cancelable: remoteMeta.cancelable,
    remote_status_text: remoteMeta.status_text,
    remote_checked_at: remoteMeta.checked_at,
    box_type: buildShipmentBoxTypeSnapshot(toObjectRecord(parcelRecord?.box_type) || parcelRecord),
    last_error: shipmentRow.last_error || null,
    created_at: shipmentRow.created_at,
    updated_at: shipmentRow.updated_at
  }
}

function toOrderShipment(
  row: OrderShipmentRow | null | undefined,
  env: Env,
  guides: Record<string, unknown>[] = []
): null | Record<string, unknown> {
  if (!row?.order_id) return null
  const legacyGuide = buildLegacyShipmentGuide(row, env)
  const normalizedGuides = guides.length > 0 ? guides : legacyGuide ? [legacyGuide] : []
  const enviaResponse = safeParseJson(row.envia_response_json)
  const remoteMeta = extractRemoteShipmentMeta(enviaResponse)
  const parcel = safeParseJson(row.parcel_json)
  const parcelRecord = toObjectRecord(parcel)
  return {
    order_id: row.order_id,
    provider: row.provider || 'envia',
    mode: row.mode || 'test',
    approval_status: parseShipmentApprovalStatus(row.approval_status),
    shipment_status: normalizeWorkerShippingStatus(row.shipment_status),
    carrier: row.carrier || null,
    service: row.service || null,
    tracking_number: row.tracking_number || null,
    tracking_url: row.tracking_url || null,
    envia_shipment_id: row.envia_shipment_id || null,
    label_r2_key: row.label_r2_key || null,
    label_url: row.label_r2_key ? buildAssetUrl(env, row.label_r2_key) : null,
    quote_amount_cents: row.quote_amount_cents == null ? null : Number(row.quote_amount_cents || 0),
    currency: row.currency || 'MXN',
    parcel,
    address_validation: safeParseJson(row.address_validation_json),
    envia_request: safeParseJson(row.envia_request_json),
    envia_response: enviaResponse,
    approved_at: row.approved_at || null,
    rejected_at: row.rejected_at || null,
    rejected_reason: row.rejected_reason || null,
    last_sync_at: row.last_sync_at || null,
    last_error: row.last_error || null,
    last_error_code: row.last_error_code || null,
    tracking_sync_paused_at: row.tracking_sync_paused_at || null,
    tracking_sync_pause_reason: row.tracking_sync_pause_reason || null,
    remote_cancelable: remoteMeta.cancelable,
    remote_status_text: remoteMeta.status_text,
    remote_checked_at: remoteMeta.checked_at,
    box_type: buildShipmentBoxTypeSnapshot(toObjectRecord(parcelRecord?.box_type) || parcelRecord),
    guides: normalizedGuides,
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

function assertAdminToken(
  request: Request,
  env: Env
): { ok: true } | { ok: false; status: number; error: string } {
  const expected = env.ADMIN_API_TOKEN?.trim()
  if (!expected) {
    return { ok: false, status: 500, error: 'ADMIN_API_TOKEN no configurado.' }
  }

  const actual = readBearerToken(request)
  if (!actual) return { ok: false, status: 401, error: 'Authorization Bearer requerido.' }
  if (actual !== expected) return { ok: false, status: 403, error: 'Token invalido.' }
  return { ok: true }
}

function pickExistingColumns(existing: Set<string>, columns: readonly string[]): string[] {
  return columns.filter((column) => existing.has(column))
}

function toProductImageResponse(
  row: Partial<ProductImageRow>,
  env: Env,
  fallbackAlt: string
): ProductImageResponse | null {
  const imageKey = String(row.image_key || '').trim()
  if (!imageKey) return null

  return {
    id: Number(row.id || 0),
    position: Number(row.position || 0) || 1,
    image_key: imageKey,
    alt: String(row.alt_text || '').trim() || fallbackAlt,
    url: buildAssetUrl(env, imageKey)
  }
}

function buildProductImagesResponse(
  images: Partial<ProductImageRow>[],
  env: Env,
  title: string,
  fallbackImageKey: string | null
): ProductImageResponse[] {
  const normalized = images
    .map((image) => toProductImageResponse(image, env, title))
    .filter((image): image is ProductImageResponse => Boolean(image))
    .sort((left, right) => left.position - right.position || left.id - right.id)

  if (normalized.length > 0) return normalized
  if (!fallbackImageKey) return []

  return [
    {
      id: 0,
      position: 1,
      image_key: fallbackImageKey,
      alt: title,
      url: buildAssetUrl(env, fallbackImageKey)
    }
  ]
}

function getPrimaryProductImageKey(
  row: Partial<ProductRow> | Record<string, unknown>,
  images: Partial<ProductImageRow>[]
): string | null {
  const directImageKey = String((row as { image_key?: unknown }).image_key || '').trim()
  if (directImageKey) return directImageKey
  const fallbackKey = String(images[0]?.image_key || '').trim()
  return fallbackKey || null
}

function normalizeProductImagesInput(
  rawImages: unknown,
  fallbackImageKey: unknown
): NormalizedProductImagePayload[] {
  const source =
    Array.isArray(rawImages) && rawImages.length > 0
      ? rawImages
      : normalizeOptionalText(fallbackImageKey)
        ? [{ image_key: normalizeOptionalText(fallbackImageKey), position: 1 }]
        : []

  const normalized = source
    .map((entry, index) => {
      const image = entry as ProductImagePayload
      const imageKey = normalizeOptionalText(image?.image_key)
      if (!imageKey) return null

      const rawPosition = image?.position
      let requestedPosition: number | null = null
      if (rawPosition !== undefined && rawPosition !== null) {
        requestedPosition = parseInteger(rawPosition)
        if (requestedPosition === null || requestedPosition < 1 || requestedPosition > 3) {
          throw new Error('images.position debe ser un entero entre 1 y 3.')
        }
      }

      return {
        requestedPosition,
        image_key: imageKey,
        alt_text: normalizeOptionalText(image?.alt ?? image?.alt_text),
        originalIndex: index
      }
    })
    .filter(
      (
        image
      ): image is {
        requestedPosition: number | null
        image_key: string
        alt_text: string
        originalIndex: number
      } => Boolean(image)
    )

  if (normalized.length > 3) {
    throw new Error('Solo se permiten hasta 3 imagenes por producto.')
  }

  const requestedPositions = normalized
    .map((image) => image.requestedPosition)
    .filter((position): position is number => position !== null)
  const uniquePositions = new Set(requestedPositions)
  if (uniquePositions.size !== requestedPositions.length) {
    throw new Error('Las posiciones de images deben ser unicas.')
  }

  normalized.sort((left, right) => {
    const leftOrder = left.requestedPosition ?? left.originalIndex + 100
    const rightOrder = right.requestedPosition ?? right.originalIndex + 100
    if (leftOrder !== rightOrder) return leftOrder - rightOrder
    return left.originalIndex - right.originalIndex
  })

  return normalized.map((image, index) => ({
    position: index + 1,
    image_key: image.image_key,
    alt_text: image.alt_text
  }))
}

function toProductResponse(
  row: Record<string, unknown>,
  env: Env,
  images: Partial<ProductImageRow>[] = []
): ProductRow {
  const slug = String(row.slug || '').trim()
  const seoSlug = String(row.seo_slug || '').trim()
  const primaryImageKey = getPrimaryProductImageKey(row, images)

  return {
    id: Number(row.id || 0),
    title: String(row.title || ''),
    slug,
    type: String(row.type || ''),
    description: String(row.description || ''),
    short_desc: String(row.short_desc || ''),
    price_cents: Number(row.price_cents || 0),
    stock: Number(row.stock || 0),
    image_key: primaryImageKey,
    seo_slug: seoSlug || null,
    sku: row.sku == null ? null : String(row.sku),
    brand: row.brand == null ? null : String(row.brand),
    material: row.material == null ? null : String(row.material),
    base_metal: row.base_metal == null ? null : String(row.base_metal),
    finish_text: row.finish_text == null ? null : String(row.finish_text),
    main_color: row.main_color == null ? null : String(row.main_color),
    hypoallergenic: row.hypoallergenic == null ? null : Number(row.hypoallergenic || 0),
    care_instructions: row.care_instructions == null ? null : String(row.care_instructions),
    gift_ready: row.gift_ready == null ? null : Number(row.gift_ready || 0),
    package_includes: row.package_includes == null ? null : String(row.package_includes),
    shipping_time_min_days:
      row.shipping_time_min_days == null ? null : Number(row.shipping_time_min_days || 0),
    shipping_time_max_days:
      row.shipping_time_max_days == null ? null : Number(row.shipping_time_max_days || 0),
    return_window_days: row.return_window_days == null ? null : Number(row.return_window_days || 0),
    is_bestseller: row.is_bestseller == null ? null : Number(row.is_bestseller || 0),
    is_new_arrival: row.is_new_arrival == null ? null : Number(row.is_new_arrival || 0),
    is_active: row.is_active == null ? null : Number(row.is_active || 0),
    is_featured: row.is_featured == null ? null : Number(row.is_featured || 0),
    currency: row.currency == null ? null : String(row.currency),
    sort: row.sort == null ? null : Number(row.sort || 0),
    canonical_path: toCanonicalPath(slug, seoSlug),
    images: buildProductImagesResponse(images, env, String(row.title || ''), primaryImageKey)
  }
}

function schemaNotReadyResponse(request: Request, env: Env, feature: string): Response {
  return json(
    request,
    env,
    {
      success: false,
      code: 'schema_not_ready',
      error: `Schema no listo para ${feature}. Faltan migraciones 0005/0006 en D1.`
    },
    409
  )
}

async function productExistsById(env: Env, productId: number): Promise<boolean> {
  const row = await env.DB.prepare('SELECT 1 as ok FROM products WHERE id = ? LIMIT 1')
    .bind(productId)
    .first<{ ok: number }>()
  return Boolean(row?.ok)
}

async function tableHasRequiredColumns(
  env: Env,
  tableName: string,
  required: readonly string[]
): Promise<boolean> {
  const cols = await existingColumns(env, tableName)
  return required.every((column) => cols.has(column))
}

async function productImagesTableReady(env: Env, requestId = 'schema'): Promise<boolean> {
  await ensureProductImagesSchema(env, requestId)
  return tableHasRequiredColumns(env, 'product_images', PRODUCT_IMAGE_REQUIRED_COLUMNS)
}

async function loadProductImagesMap(
  env: Env,
  productIds: number[]
): Promise<Map<number, ProductImageRow[]>> {
  const ids = [...new Set(productIds.map((id) => Number(id || 0)).filter((id) => id > 0))]
  const imageMap = new Map<number, ProductImageRow[]>()

  if (!ids.length) return imageMap
  if (!(await productImagesTableReady(env))) return imageMap

  const placeholders = ids.map(() => '?').join(', ')
  const result = await env.DB.prepare(
    `SELECT id, product_id, position, image_key, alt_text, created_at
       FROM product_images
       WHERE product_id IN (${placeholders})
       ORDER BY product_id ASC, position ASC, id ASC`
  )
    .bind(...ids)
    .all<ProductImageRow>()

  for (const row of result.results || []) {
    const productId = Number(row.product_id || 0)
    if (!productId) continue
    const current = imageMap.get(productId) || []
    current.push({
      id: Number(row.id || 0),
      product_id: productId,
      position: Number(row.position || current.length + 1),
      image_key: String(row.image_key || ''),
      alt_text: row.alt_text == null ? null : String(row.alt_text),
      created_at: String(row.created_at || '')
    })
    imageMap.set(productId, current)
  }

  return imageMap
}

async function replaceProductImages(
  env: Env,
  productId: number,
  images: NormalizedProductImagePayload[]
): Promise<void> {
  const statements: D1PreparedStatement[] = [
    env.DB.prepare('DELETE FROM product_images WHERE product_id = ?').bind(productId)
  ]

  for (const image of images) {
    statements.push(
      env.DB.prepare(
        `INSERT INTO product_images (product_id, position, image_key, alt_text)
         VALUES (?, ?, ?, ?)`
      ).bind(productId, image.position, image.image_key, image.alt_text ? image.alt_text : null)
    )
  }

  statements.push(
    env.DB.prepare('UPDATE products SET image_key = ? WHERE id = ?').bind(
      images[0]?.image_key || null,
      productId
    )
  )

  await env.DB.batch(statements)
}

async function syncPrimaryProductImage(
  env: Env,
  productId: number,
  imageKey: string
): Promise<void> {
  const normalizedKey = normalizeOptionalText(imageKey)
  if (!normalizedKey) return

  const galleryMap = await loadProductImagesMap(env, [productId])
  const currentImages = galleryMap.get(productId) || []
  if (!currentImages.length) {
    await replaceProductImages(env, productId, [
      {
        position: 1,
        image_key: normalizedKey,
        alt_text: ''
      }
    ])
    return
  }

  const syncedImages = currentImages.map((image, index) => ({
    position: index + 1,
    image_key: index === 0 ? normalizedKey : image.image_key,
    alt_text: image.alt_text || ''
  }))

  await replaceProductImages(env, productId, syncedImages)
}

async function productTypeExists(env: Env, type: string, requestId: string): Promise<boolean> {
  await ensureProductTypesCatalog(env, requestId)
  const row = await env.DB.prepare('SELECT 1 as ok FROM product_types WHERE type = ? LIMIT 1')
    .bind(type)
    .first<{ ok: number }>()
  return Boolean(row?.ok)
}

async function readProductPayload(request: Request): Promise<NormalizedProductPayload> {
  const payload = (await request.json()) as ProductPayload

  const normalizedSlug = normalizeSlug(payload.slug || '')
  const normalizedType = normalizeType(payload.type || 'ring')
  const normalizedSeoSlug = normalizeSlug(payload.seo_slug || normalizedSlug)
  const normalizedImages = normalizeProductImagesInput(payload.images, payload.image_key)
  const shippingTimeMinDays = parseNonNegativeInteger(payload.shipping_time_min_days, null)
  const shippingTimeMaxDays = parseNonNegativeInteger(payload.shipping_time_max_days, null)
  const returnWindowDays = parseNonNegativeInteger(payload.return_window_days, 30)

  if (
    shippingTimeMinDays != null &&
    shippingTimeMaxDays != null &&
    shippingTimeMaxDays < shippingTimeMinDays
  ) {
    throw new Error('shipping_time_max_days no puede ser menor a shipping_time_min_days.')
  }

  return {
    slug: normalizedSlug,
    title: String(payload.title || '').trim(),
    type: normalizedType || 'ring',
    description: String(payload.description || '').trim(),
    short_desc: String(payload.short_desc || '').trim(),
    price_cents: Number(payload.price_cents),
    stock: parseNonNegativeInteger(payload.stock, 0) ?? -1,
    image_key: normalizedImages[0]?.image_key || String(payload.image_key || '').trim(),
    images: normalizedImages,
    seo_slug: normalizedSeoSlug,
    sku: normalizeOptionalText(payload.sku),
    brand: normalizeOptionalText(payload.brand),
    material: normalizeOptionalText(payload.material),
    base_metal: normalizeOptionalText(payload.base_metal),
    finish_text: normalizeOptionalText(payload.finish_text),
    main_color: normalizeOptionalText(payload.main_color),
    hypoallergenic: parseBooleanToInt(payload.hypoallergenic, 0),
    care_instructions: normalizeOptionalText(payload.care_instructions),
    gift_ready: parseBooleanToInt(payload.gift_ready, 1),
    package_includes: normalizeOptionalText(payload.package_includes),
    shipping_time_min_days: shippingTimeMinDays,
    shipping_time_max_days: shippingTimeMaxDays,
    return_window_days: returnWindowDays ?? -1,
    is_bestseller: parseBooleanToInt(payload.is_bestseller, 0),
    is_new_arrival: parseBooleanToInt(payload.is_new_arrival, 0),
    is_active: parseBooleanToInt(payload.is_active, 1),
    is_featured: parseBooleanToInt(payload.is_featured, 0),
    currency: String(payload.currency || 'MXN')
      .trim()
      .toUpperCase(),
    sort: parseNonNegativeInteger(payload.sort, 0) ?? -1
  }
}

async function readProductUpdatePayload(request: Request): Promise<ProductUpdatePayload> {
  return (await request.json()) as ProductUpdatePayload
}

function buildUpdateStatement(
  payload: ProductUpdatePayload,
  availableColumns: Set<string>
): { clauses: string[]; values: unknown[] } {
  const clauses: string[] = []
  const values: unknown[] = []

  if (payload.slug !== undefined) {
    const slug = normalizeSlug(payload.slug)
    if (!slug) throw new Error('El slug no puede estar vacio.')
    clauses.push('slug = ?')
    values.push(slug)
  }

  if (payload.title !== undefined) {
    const title = String(payload.title).trim()
    if (!title) throw new Error('El titulo no puede estar vacio.')
    clauses.push('title = ?')
    values.push(title)
  }

  if (payload.type !== undefined) {
    const type = normalizeType(payload.type)
    if (!type) throw new Error('El tipo no puede estar vacio.')
    clauses.push('type = ?')
    values.push(type)
  }

  if (payload.description !== undefined) {
    clauses.push('description = ?')
    values.push(String(payload.description))
  }

  if (payload.short_desc !== undefined) {
    clauses.push('short_desc = ?')
    values.push(String(payload.short_desc))
  }

  if (payload.price_cents !== undefined) {
    const priceCents = Number(payload.price_cents)
    if (!Number.isInteger(priceCents) || priceCents < 0) {
      throw new Error('price_cents debe ser un entero mayor o igual a 0.')
    }
    clauses.push('price_cents = ?')
    values.push(priceCents)
  }

  if (payload.stock !== undefined) {
    const stock = Number(payload.stock)
    if (!Number.isInteger(stock) || stock < 0) {
      throw new Error('stock debe ser un entero mayor o igual a 0.')
    }
    clauses.push('stock = ?')
    values.push(stock)
  }

  if (payload.image_key !== undefined) {
    const imageKey = String(payload.image_key).trim()
    if (!imageKey) throw new Error('image_key no puede estar vacio.')
    clauses.push('image_key = ?')
    values.push(imageKey)
  }

  if (payload.seo_slug !== undefined && availableColumns.has('seo_slug')) {
    const seoSlug = normalizeSlug(payload.seo_slug)
    if (!seoSlug) throw new Error('seo_slug no puede estar vacio.')
    clauses.push('seo_slug = ?')
    values.push(seoSlug)
  }

  if (payload.sku !== undefined && availableColumns.has('sku')) {
    const sku = normalizeOptionalText(payload.sku)
    if (!sku) throw new Error('sku no puede estar vacio.')
    clauses.push('sku = ?')
    values.push(sku)
  }

  if (payload.brand !== undefined && availableColumns.has('brand')) {
    const brand = normalizeOptionalText(payload.brand)
    if (!brand) throw new Error('brand no puede estar vacio.')
    clauses.push('brand = ?')
    values.push(brand)
  }

  if (payload.material !== undefined && availableColumns.has('material')) {
    clauses.push('material = ?')
    values.push(String(payload.material ?? ''))
  }

  if (payload.base_metal !== undefined && availableColumns.has('base_metal')) {
    clauses.push('base_metal = ?')
    values.push(String(payload.base_metal ?? ''))
  }

  if (payload.finish_text !== undefined && availableColumns.has('finish_text')) {
    clauses.push('finish_text = ?')
    values.push(String(payload.finish_text ?? ''))
  }

  if (payload.main_color !== undefined && availableColumns.has('main_color')) {
    clauses.push('main_color = ?')
    values.push(String(payload.main_color ?? ''))
  }

  if (payload.hypoallergenic !== undefined && availableColumns.has('hypoallergenic')) {
    clauses.push('hypoallergenic = ?')
    values.push(parseBooleanToInt(payload.hypoallergenic))
  }

  if (payload.care_instructions !== undefined && availableColumns.has('care_instructions')) {
    clauses.push('care_instructions = ?')
    values.push(String(payload.care_instructions ?? ''))
  }

  if (payload.gift_ready !== undefined && availableColumns.has('gift_ready')) {
    clauses.push('gift_ready = ?')
    values.push(parseBooleanToInt(payload.gift_ready, 1))
  }

  if (payload.package_includes !== undefined && availableColumns.has('package_includes')) {
    clauses.push('package_includes = ?')
    values.push(String(payload.package_includes ?? ''))
  }

  if (
    payload.shipping_time_min_days !== undefined &&
    availableColumns.has('shipping_time_min_days')
  ) {
    const value = parseNonNegativeInteger(payload.shipping_time_min_days, null)
    if (value === null && payload.shipping_time_min_days !== null) {
      throw new Error('shipping_time_min_days debe ser entero mayor o igual a 0.')
    }
    clauses.push('shipping_time_min_days = ?')
    values.push(value)
  }

  if (
    payload.shipping_time_max_days !== undefined &&
    availableColumns.has('shipping_time_max_days')
  ) {
    const value = parseNonNegativeInteger(payload.shipping_time_max_days, null)
    if (value === null && payload.shipping_time_max_days !== null) {
      throw new Error('shipping_time_max_days debe ser entero mayor o igual a 0.')
    }
    clauses.push('shipping_time_max_days = ?')
    values.push(value)
  }

  if (payload.return_window_days !== undefined && availableColumns.has('return_window_days')) {
    const value = parseNonNegativeInteger(payload.return_window_days, null)
    if (value === null) throw new Error('return_window_days debe ser entero mayor o igual a 0.')
    clauses.push('return_window_days = ?')
    values.push(value)
  }

  if (payload.is_bestseller !== undefined && availableColumns.has('is_bestseller')) {
    clauses.push('is_bestseller = ?')
    values.push(parseBooleanToInt(payload.is_bestseller))
  }

  if (payload.is_new_arrival !== undefined && availableColumns.has('is_new_arrival')) {
    clauses.push('is_new_arrival = ?')
    values.push(parseBooleanToInt(payload.is_new_arrival))
  }

  if (payload.is_active !== undefined && availableColumns.has('is_active')) {
    clauses.push('is_active = ?')
    values.push(parseBooleanToInt(payload.is_active, 1))
  }

  if (payload.is_featured !== undefined && availableColumns.has('is_featured')) {
    clauses.push('is_featured = ?')
    values.push(parseBooleanToInt(payload.is_featured))
  }

  if (payload.currency !== undefined && availableColumns.has('currency')) {
    const currency = String(payload.currency || '')
      .trim()
      .toUpperCase()
    if (!currency) throw new Error('currency no puede estar vacio.')
    clauses.push('currency = ?')
    values.push(currency)
  }

  if (payload.sort !== undefined && availableColumns.has('sort')) {
    const sort = parseNonNegativeInteger(payload.sort, null)
    if (sort === null) throw new Error('sort debe ser entero mayor o igual a 0.')
    clauses.push('sort = ?')
    values.push(sort)
  }

  return { clauses, values }
}

async function handleHealth(request: Request, env: Env, requestId: string): Promise<Response> {
  const startedAt = Date.now()
  workerLog(requestId, 'health:start')
  const status: {
    r2: { ok: boolean; error: string | null }
    d1: { ok: boolean; error: string | null }
    schema: {
      products_enriched: boolean
      product_variants: boolean
      product_reviews: boolean
      order_shipments: boolean
    }
    envia: EnviaHealthStatus
  } = {
    r2: { ok: true, error: null as string | null },
    d1: { ok: true, error: null as string | null },
    schema: {
      products_enriched: false,
      product_variants: false,
      product_reviews: false,
      order_shipments: false
    },
    envia: {
      configured: false,
      mode: (String(env.ENVIA_MODE || 'test')
        .trim()
        .toLowerCase() === 'prod'
        ? 'prod'
        : 'test') as 'test' | 'prod',
      shipping: { ok: false, error: 'Envia no verificado.' as string | null },
      queries: { ok: false, error: 'Envia no verificado.' as string | null },
      geocodes: { ok: false, error: 'Envia no verificado.' as string | null },
      checked_at: new Date().toISOString()
    } satisfies EnviaHealthStatus
  }

  try {
    await withTimeout(env.ASSETS_BUCKET.list({ limit: 1 }), 8000, 'R2 health check')
  } catch (error) {
    workerError(requestId, 'health:r2:error', error)
    status.r2 = {
      ok: false,
      error: `Fallo en R2: ${getErrorMessage(error)}`
    }
  }

  try {
    await withTimeout(env.DB.prepare('SELECT 1 as ok').first(), 8000, 'D1 health check')
    await withTimeout(ensureProductTypesCatalog(env, requestId), 8000, 'D1 product_types ensure')
    await withTimeout(
      ensureOrdersAdminSchema(env, requestId),
      8000,
      'D1 orders admin schema ensure'
    )
    await withTimeout(
      ensureProductImagesSchema(env, requestId),
      8000,
      'D1 product_images schema ensure'
    )
    await withTimeout(
      ensureOrderShipmentsSchema(env, requestId),
      8000,
      'D1 order_shipments schema ensure'
    )

    const productColumns = await existingColumns(env, 'products')
    status.schema.products_enriched = PRODUCT_ENRICHED_HEALTH_COLUMNS.every((column) =>
      productColumns.has(column)
    )
    status.schema.product_variants = await tableHasRequiredColumns(
      env,
      'product_variants',
      VARIANT_REQUIRED_COLUMNS
    )
    status.schema.product_reviews = await tableHasRequiredColumns(
      env,
      'product_reviews',
      REVIEW_REQUIRED_COLUMNS
    )
    status.schema.order_shipments = await tableHasRequiredColumns(
      env,
      'order_shipments',
      ORDER_SHIPMENT_REQUIRED_COLUMNS
    )
  } catch (error) {
    workerError(requestId, 'health:d1:error', error)
    status.d1 = {
      ok: false,
      error: `Fallo en D1: ${getErrorMessage(error)}`
    }
  }

  try {
    if (enviaHealthCache && enviaHealthCache.expiresAt > Date.now()) {
      status.envia = enviaHealthCache.status
    } else {
      status.envia = await withTimeout(
        pingEnviaApis(env, {
          originZip: String(env.ENVIA_FROM_ZIP || '64000').trim() || '64000',
          dryRunPayload: {
            origin: {
              name:
                String(env.ENVIA_FROM_NAME || env.ENVIA_FROM_COMPANY || 'Lumea Imperium').trim() ||
                'Lumea Imperium',
              company:
                String(env.ENVIA_FROM_COMPANY || 'Lumea Imperium').trim() || 'Lumea Imperium',
              email:
                String(env.ENVIA_FROM_EMAIL || 'ops@lumea.invalid').trim() || 'ops@lumea.invalid',
              phone: String(env.ENVIA_FROM_PHONE || '8181818181').trim() || '8181818181',
              street: String(env.ENVIA_FROM_STREET || 'Av Fundidora').trim() || 'Av Fundidora',
              number: String(env.ENVIA_FROM_NUMBER || '100').trim() || '100',
              district: String(env.ENVIA_FROM_DISTRICT || 'Centro').trim() || 'Centro',
              city: String(env.ENVIA_FROM_CITY || 'Monterrey').trim() || 'Monterrey',
              state: String(env.ENVIA_FROM_STATE || 'NL').trim() || 'NL',
              postal_code: String(env.ENVIA_FROM_ZIP || '64000').trim() || '64000',
              country: String(env.ENVIA_FROM_COUNTRY || 'MX').trim() || 'MX'
            },
            destination: {
              name: 'Health Check',
              company: 'Health Check',
              email:
                String(env.ENVIA_FROM_EMAIL || 'ops@lumea.invalid').trim() || 'ops@lumea.invalid',
              phone: String(env.ENVIA_FROM_PHONE || '8181818181').trim() || '8181818181',
              street: String(env.ENVIA_FROM_STREET || 'Av Fundidora').trim() || 'Av Fundidora',
              number: String(env.ENVIA_FROM_NUMBER || '100').trim() || '100',
              district: String(env.ENVIA_FROM_DISTRICT || 'Centro').trim() || 'Centro',
              city: String(env.ENVIA_FROM_CITY || 'Monterrey').trim() || 'Monterrey',
              state: String(env.ENVIA_FROM_STATE || 'NL').trim() || 'NL',
              postal_code: String(env.ENVIA_FROM_ZIP || '64000').trim() || '64000',
              country: 'MX'
            },
            packages: [
              {
                content:
                  String(env.ENVIA_DEFAULT_CONTENT || 'Health check').trim() || 'Health check',
                amount: 1,
                type: 'box',
                declared_value: 1,
                weight: Number(env.ENVIA_DEFAULT_WEIGHT_KG || 1) || 1,
                length: Number(env.ENVIA_DEFAULT_LENGTH_CM || 10) || 10,
                width: Number(env.ENVIA_DEFAULT_WIDTH_CM || 10) || 10,
                height: Number(env.ENVIA_DEFAULT_HEIGHT_CM || 10) || 10
              }
            ]
          }
        }),
        10000,
        'Envia health check'
      )
      enviaHealthCache = {
        status: status.envia,
        expiresAt: Date.now() + ENVIA_HEALTH_TTL_MS
      }
    }
  } catch (error) {
    status.envia = {
      configured: Boolean(String(env.ENVIA_API_KEY || '').trim()),
      mode:
        String(env.ENVIA_MODE || 'test')
          .trim()
          .toLowerCase() === 'prod'
          ? 'prod'
          : 'test',
      shipping: { ok: false, error: `Fallo en Envia Shipping: ${getErrorMessage(error)}` },
      queries: { ok: false, error: `Fallo en Envia Queries: ${getErrorMessage(error)}` },
      geocodes: { ok: false, error: `Fallo en Envia Geocodes: ${getErrorMessage(error)}` },
      checked_at: new Date().toISOString()
    }
    enviaHealthCache = {
      status: status.envia,
      expiresAt: Date.now() + Math.min(ENVIA_HEALTH_TTL_MS, 15_000)
    }
  }

  workerLog(requestId, 'health:done', { elapsedMs: Date.now() - startedAt, status })
  return json(request, env, status)
}

async function handleGetProducts(request: Request, env: Env, requestId: string): Promise<Response> {
  const url = new URL(request.url)
  const rawTypeFilter = url.searchParams.get('type')
  const typeFilter = rawTypeFilter ? normalizeType(rawTypeFilter) : null
  workerLog(requestId, 'products:list:start', { typeFilter })
  try {
    const availableColumns = await existingColumns(env, 'products')
    const selectColumns = pickExistingColumns(availableColumns, [
      ...PRODUCT_BASE_COLUMNS,
      ...PRODUCT_OPTIONAL_COLUMNS
    ])
    const sqlSelect = selectColumns.join(', ')

    let result: D1Result<Record<string, unknown>>
    if (typeFilter) {
      result = await env.DB.prepare(
        `
          SELECT ${sqlSelect}
          FROM products
          WHERE type = ?
          ORDER BY id DESC
        `
      )
        .bind(typeFilter)
        .all<Record<string, unknown>>()
    } else {
      result = await env.DB.prepare(
        `
          SELECT ${sqlSelect}
          FROM products
          ORDER BY id DESC
        `
      ).all<Record<string, unknown>>()
    }

    const rows = result.results || []
    const productImages = await loadProductImagesMap(
      env,
      rows.map((row) => Number(row.id || 0))
    )

    workerLog(requestId, 'products:list:ok', { count: rows.length })
    return json(request, env, {
      success: true,
      products: rows.map((row) =>
        toProductResponse(row, env, productImages.get(Number(row.id || 0)) || [])
      )
    })
  } catch (error) {
    workerError(requestId, 'products:list:error', error)
    return json(
      request,
      env,
      { success: false, error: `Error obteniendo productos: ${getErrorMessage(error)}` },
      500
    )
  }
}

async function handleGetProductById(
  request: Request,
  env: Env,
  requestId: string,
  productId: number
): Promise<Response> {
  workerLog(requestId, 'products:get:start', { productId })
  try {
    const availableColumns = await existingColumns(env, 'products')
    const selectColumns = pickExistingColumns(availableColumns, [
      ...PRODUCT_BASE_COLUMNS,
      ...PRODUCT_OPTIONAL_COLUMNS
    ])
    const sqlSelect = selectColumns.join(', ')

    const product = await env.DB.prepare(
      `
        SELECT ${sqlSelect}
        FROM products
        WHERE id = ?
      `
    )
      .bind(productId)
      .first<Record<string, unknown>>()

    if (!product) {
      return json(request, env, { success: false, error: 'Producto no encontrado.' }, 404)
    }

    const productImages = await loadProductImagesMap(env, [productId])

    workerLog(requestId, 'products:get:ok')
    return json(request, env, {
      success: true,
      product: toProductResponse(product, env, productImages.get(productId) || [])
    })
  } catch (error) {
    workerError(requestId, 'products:get:error', error)
    return json(
      request,
      env,
      { success: false, error: `Error leyendo producto: ${getErrorMessage(error)}` },
      500
    )
  }
}

async function handleCreateProduct(
  request: Request,
  env: Env,
  requestId: string
): Promise<Response> {
  workerLog(requestId, 'products:create:start')
  try {
    const availableColumns = await existingColumns(env, 'products')
    const payload = await readProductPayload(request)
    workerLog(requestId, 'products:create:payload', {
      slug: payload.slug,
      title: payload.title,
      type: payload.type,
      price_cents: payload.price_cents,
      stock: payload.stock,
      image_key: payload.image_key,
      images: payload.images.length
    })

    if (!payload.slug)
      return json(request, env, { success: false, error: 'El slug es obligatorio.' }, 400)
    if (!payload.title) {
      return json(request, env, { success: false, error: 'El titulo es obligatorio.' }, 400)
    }
    if (!payload.image_key) {
      return json(
        request,
        env,
        { success: false, error: 'La imagen principal es obligatoria.' },
        400
      )
    }
    if (payload.images.length > 1 && !(await productImagesTableReady(env))) {
      return json(
        request,
        env,
        {
          success: false,
          code: 'schema_not_ready',
          error: 'Schema no listo para multiples imagenes.'
        },
        409
      )
    }
    if (!payload.type) {
      return json(request, env, { success: false, error: 'El type es obligatorio.' }, 400)
    }
    if (!Number.isInteger(payload.price_cents) || payload.price_cents < 0) {
      return json(
        request,
        env,
        { success: false, error: 'price_cents debe ser un entero mayor o igual a 0.' },
        400
      )
    }
    if (!Number.isInteger(payload.stock) || payload.stock < 0) {
      return json(
        request,
        env,
        { success: false, error: 'stock debe ser un entero mayor o igual a 0.' },
        400
      )
    }
    if (payload.return_window_days < 0) {
      return json(request, env, { success: false, error: 'return_window_days debe ser >= 0.' }, 400)
    }
    if (payload.sort < 0) {
      return json(request, env, { success: false, error: 'sort debe ser >= 0.' }, 400)
    }
    if (
      payload.shipping_time_min_days != null &&
      payload.shipping_time_max_days != null &&
      payload.shipping_time_max_days < payload.shipping_time_min_days
    ) {
      return json(
        request,
        env,
        {
          success: false,
          error: 'shipping_time_max_days no puede ser menor a shipping_time_min_days.'
        },
        400
      )
    }

    const typeExists = await productTypeExists(env, payload.type, requestId)
    if (!typeExists) {
      return json(
        request,
        env,
        { success: false, error: `Type "${payload.type}" no esta registrado.` },
        400
      )
    }

    const insertColumns: string[] = []
    const insertValues: unknown[] = []
    const add = (column: string, value: unknown): void => {
      if (!availableColumns.has(column)) return
      insertColumns.push(column)
      insertValues.push(value)
    }

    add('slug', payload.slug)
    add('title', payload.title)
    add('type', payload.type)
    add('description', payload.description)
    add('short_desc', payload.short_desc)
    add('price_cents', payload.price_cents)
    add('stock', payload.stock)
    add('image_key', payload.image_key)
    add('seo_slug', payload.seo_slug)
    if (payload.sku) add('sku', payload.sku)
    if (payload.brand) add('brand', payload.brand)
    add('material', payload.material)
    add('base_metal', payload.base_metal)
    add('finish_text', payload.finish_text)
    add('main_color', payload.main_color)
    add('hypoallergenic', payload.hypoallergenic)
    add('care_instructions', payload.care_instructions)
    add('gift_ready', payload.gift_ready)
    add('package_includes', payload.package_includes)
    add('shipping_time_min_days', payload.shipping_time_min_days)
    add('shipping_time_max_days', payload.shipping_time_max_days)
    add('return_window_days', payload.return_window_days)
    add('is_bestseller', payload.is_bestseller)
    add('is_new_arrival', payload.is_new_arrival)
    add('is_active', payload.is_active)
    add('is_featured', payload.is_featured)
    add('currency', payload.currency)
    add('sort', payload.sort)

    const placeholders = insertColumns.map(() => '?').join(', ')
    const result = await env.DB.prepare(
      `INSERT INTO products (${insertColumns.join(', ')}) VALUES (${placeholders})`
    )
      .bind(...insertValues)
      .run()

    const createdId = getRunLastRowId(result)
    if (createdId) {
      if (await productImagesTableReady(env)) {
        await replaceProductImages(env, createdId, payload.images)
      }
      if (availableColumns.has('seo_slug') && !payload.seo_slug) {
        await env.DB.prepare('UPDATE products SET seo_slug = slug WHERE id = ?')
          .bind(createdId)
          .run()
      }
      if (availableColumns.has('sku') && !payload.sku) {
        await env.DB.prepare("UPDATE products SET sku = 'LUM-' || id WHERE id = ?")
          .bind(createdId)
          .run()
      }
      if (availableColumns.has('brand') && !payload.brand) {
        await env.DB.prepare("UPDATE products SET brand = 'Lumea Imperium' WHERE id = ?")
          .bind(createdId)
          .run()
      }
    }

    workerLog(requestId, 'products:create:ok')
    return json(request, env, { success: true }, 201)
  } catch (error) {
    if (isUniqueConstraintError(error, 'products.slug')) {
      return json(request, env, { success: false, error: 'slug ya existe.' }, 409)
    }
    if (isUniqueConstraintError(error, 'products.seo_slug')) {
      return json(request, env, { success: false, error: 'seo_slug ya existe.' }, 409)
    }
    if (isUniqueConstraintError(error, 'products.sku')) {
      return json(request, env, { success: false, error: 'sku ya existe.' }, 409)
    }
    workerError(requestId, 'products:create:error', error)
    return json(
      request,
      env,
      { success: false, error: `Error creando producto: ${getErrorMessage(error)}` },
      500
    )
  }
}

async function handleUpdateProduct(
  request: Request,
  env: Env,
  requestId: string,
  productId: number
): Promise<Response> {
  workerLog(requestId, 'products:update:start', { productId })

  try {
    const availableColumns = await existingColumns(env, 'products')
    const payload = await readProductUpdatePayload(request)
    const hasImagesPayload = Array.isArray(payload.images)
    const normalizedImages = hasImagesPayload
      ? normalizeProductImagesInput(payload.images, payload.image_key)
      : []
    if (payload.type !== undefined) {
      const requestedType = normalizeType(payload.type)
      if (!requestedType) {
        return json(request, env, { success: false, error: 'El type no puede estar vacio.' }, 400)
      }
      const typeExists = await productTypeExists(env, requestedType, requestId)
      if (!typeExists) {
        return json(
          request,
          env,
          { success: false, error: `Type "${requestedType}" no esta registrado.` },
          400
        )
      }
    }

    if (hasImagesPayload && normalizedImages.length > 1 && !(await productImagesTableReady(env))) {
      return json(
        request,
        env,
        {
          success: false,
          code: 'schema_not_ready',
          error: 'Schema no listo para multiples imagenes.'
        },
        409
      )
    }

    if (
      (payload.shipping_time_min_days !== undefined ||
        payload.shipping_time_max_days !== undefined) &&
      availableColumns.has('shipping_time_min_days') &&
      availableColumns.has('shipping_time_max_days')
    ) {
      const row = await env.DB.prepare(
        'SELECT shipping_time_min_days, shipping_time_max_days FROM products WHERE id = ?'
      )
        .bind(productId)
        .first<{ shipping_time_min_days?: number | null; shipping_time_max_days?: number | null }>()

      if (!row) {
        return json(request, env, { success: false, error: 'Producto no encontrado.' }, 404)
      }

      const nextMin =
        payload.shipping_time_min_days === undefined
          ? (row.shipping_time_min_days ?? null)
          : parseNonNegativeInteger(payload.shipping_time_min_days, null)
      const nextMax =
        payload.shipping_time_max_days === undefined
          ? (row.shipping_time_max_days ?? null)
          : parseNonNegativeInteger(payload.shipping_time_max_days, null)

      if (nextMin != null && nextMax != null && nextMax < nextMin) {
        return json(
          request,
          env,
          {
            success: false,
            error: 'shipping_time_max_days no puede ser menor a shipping_time_min_days.'
          },
          400
        )
      }
    }

    const { clauses, values } = buildUpdateStatement(payload, availableColumns)
    if (clauses.length === 0 && !hasImagesPayload) {
      return json(
        request,
        env,
        { success: false, error: 'No se enviaron campos para actualizar.' },
        400
      )
    }

    if (clauses.length > 0) {
      const sql = `UPDATE products SET ${clauses.join(', ')} WHERE id = ?`
      const result = await env.DB.prepare(sql)
        .bind(...values, productId)
        .run()

      if (getChangesFromRun(result) === 0) {
        return json(request, env, { success: false, error: 'Producto no encontrado.' }, 404)
      }
    } else if (!(await productExistsById(env, productId))) {
      return json(request, env, { success: false, error: 'Producto no encontrado.' }, 404)
    }

    if (await productImagesTableReady(env)) {
      if (hasImagesPayload) {
        await replaceProductImages(env, productId, normalizedImages)
      } else if (payload.image_key !== undefined) {
        await syncPrimaryProductImage(env, productId, String(payload.image_key || ''))
      }
    }

    workerLog(requestId, 'products:update:ok', { updatedFields: clauses.length })
    return json(request, env, { success: true })
  } catch (error) {
    if (isUniqueConstraintError(error, 'products.slug')) {
      return json(request, env, { success: false, error: 'slug ya existe.' }, 409)
    }
    if (isUniqueConstraintError(error, 'products.seo_slug')) {
      return json(request, env, { success: false, error: 'seo_slug ya existe.' }, 409)
    }
    if (isUniqueConstraintError(error, 'products.sku')) {
      return json(request, env, { success: false, error: 'sku ya existe.' }, 409)
    }
    workerError(requestId, 'products:update:error', error)
    return json(
      request,
      env,
      { success: false, error: `Error actualizando producto: ${getErrorMessage(error)}` },
      500
    )
  }
}

async function handleDeleteProduct(
  request: Request,
  env: Env,
  requestId: string,
  productId: number
): Promise<Response> {
  workerLog(requestId, 'products:delete:start', { productId })
  try {
    const result = await env.DB.prepare('DELETE FROM products WHERE id = ?').bind(productId).run()
    if (getChangesFromRun(result) === 0) {
      return json(request, env, { success: false, error: 'Producto no encontrado.' }, 404)
    }

    workerLog(requestId, 'products:delete:ok')
    return json(request, env, { success: true })
  } catch (error) {
    workerError(requestId, 'products:delete:error', error)
    return json(
      request,
      env,
      { success: false, error: `Error eliminando producto: ${getErrorMessage(error)}` },
      500
    )
  }
}

async function readVariantPayload(request: Request): Promise<ProductVariantPayload> {
  return (await request.json()) as ProductVariantPayload
}

async function readVariantUpdatePayload(request: Request): Promise<ProductVariantUpdatePayload> {
  return (await request.json()) as ProductVariantUpdatePayload
}

function parseVariantPriceCents(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) return Number.NaN
  return parsed
}

async function handleGetProductVariants(
  request: Request,
  env: Env,
  requestId: string,
  productId: number
): Promise<Response> {
  workerLog(requestId, 'variants:list:start', { productId })
  try {
    const tableReady = await tableHasRequiredColumns(
      env,
      'product_variants',
      VARIANT_REQUIRED_COLUMNS
    )
    if (!tableReady) return schemaNotReadyResponse(request, env, 'variantes')

    if (!(await productExistsById(env, productId))) {
      return json(request, env, { success: false, error: 'Producto no encontrado.' }, 404)
    }

    const result = await env.DB.prepare(
      `SELECT id, product_id, sku, option_name, option_value, price_cents, stock, is_active, created_at
         FROM product_variants
         WHERE product_id = ?
         ORDER BY id ASC`
    )
      .bind(productId)
      .all<ProductVariantRow>()

    return json(request, env, { success: true, variants: result.results || [] })
  } catch (error) {
    workerError(requestId, 'variants:list:error', error)
    return json(
      request,
      env,
      { success: false, error: `Error obteniendo variantes: ${getErrorMessage(error)}` },
      500
    )
  }
}

async function handleCreateProductVariant(
  request: Request,
  env: Env,
  requestId: string,
  productId: number
): Promise<Response> {
  workerLog(requestId, 'variants:create:start', { productId })
  try {
    const tableReady = await tableHasRequiredColumns(
      env,
      'product_variants',
      VARIANT_REQUIRED_COLUMNS
    )
    if (!tableReady) return schemaNotReadyResponse(request, env, 'variantes')

    if (!(await productExistsById(env, productId))) {
      return json(request, env, { success: false, error: 'Producto no encontrado.' }, 404)
    }

    const payload = await readVariantPayload(request)
    const sku = normalizeOptionalText(payload.sku)
    const optionName = normalizeOptionalText(payload.option_name)
    const optionValue = normalizeOptionalText(payload.option_value)
    const priceCents = parseVariantPriceCents(payload.price_cents)
    const stock = parseNonNegativeInteger(payload.stock, 0)
    const isActive = parseBooleanToInt(payload.is_active, 1)

    if (!sku) return json(request, env, { success: false, error: 'sku es obligatorio.' }, 400)
    if (!optionName)
      return json(request, env, { success: false, error: 'option_name es obligatorio.' }, 400)
    if (!optionValue)
      return json(request, env, { success: false, error: 'option_value es obligatorio.' }, 400)
    if (Number.isNaN(priceCents)) {
      return json(
        request,
        env,
        { success: false, error: 'price_cents debe ser null o entero >= 0.' },
        400
      )
    }
    if (stock === null)
      return json(request, env, { success: false, error: 'stock debe ser entero >= 0.' }, 400)

    const result = await env.DB.prepare(
      `INSERT INTO product_variants (product_id, sku, option_name, option_value, price_cents, stock, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(productId, sku, optionName, optionValue, priceCents, stock, isActive)
      .run()

    const createdId = getRunLastRowId(result)
    const variant =
      createdId != null
        ? await env.DB.prepare(
            `SELECT id, product_id, sku, option_name, option_value, price_cents, stock, is_active, created_at
               FROM product_variants
               WHERE id = ?`
          )
            .bind(createdId)
            .first<ProductVariantRow>()
        : null

    return json(request, env, { success: true, variant }, 201)
  } catch (error) {
    if (isUniqueConstraintError(error, 'product_variants.sku')) {
      return json(request, env, { success: false, error: 'sku de variante ya existe.' }, 409)
    }
    workerError(requestId, 'variants:create:error', error)
    return json(
      request,
      env,
      { success: false, error: `Error creando variante: ${getErrorMessage(error)}` },
      500
    )
  }
}

async function handleUpdateProductVariant(
  request: Request,
  env: Env,
  requestId: string,
  productId: number,
  variantId: number
): Promise<Response> {
  workerLog(requestId, 'variants:update:start', { productId, variantId })
  try {
    const tableReady = await tableHasRequiredColumns(
      env,
      'product_variants',
      VARIANT_REQUIRED_COLUMNS
    )
    if (!tableReady) return schemaNotReadyResponse(request, env, 'variantes')

    const payload = await readVariantUpdatePayload(request)
    const clauses: string[] = []
    const values: unknown[] = []

    if (payload.sku !== undefined) {
      const sku = normalizeOptionalText(payload.sku)
      if (!sku)
        return json(request, env, { success: false, error: 'sku no puede estar vacio.' }, 400)
      clauses.push('sku = ?')
      values.push(sku)
    }
    if (payload.option_name !== undefined) {
      const optionName = normalizeOptionalText(payload.option_name)
      if (!optionName) {
        return json(
          request,
          env,
          { success: false, error: 'option_name no puede estar vacio.' },
          400
        )
      }
      clauses.push('option_name = ?')
      values.push(optionName)
    }
    if (payload.option_value !== undefined) {
      const optionValue = normalizeOptionalText(payload.option_value)
      if (!optionValue) {
        return json(
          request,
          env,
          { success: false, error: 'option_value no puede estar vacio.' },
          400
        )
      }
      clauses.push('option_value = ?')
      values.push(optionValue)
    }
    if (payload.price_cents !== undefined) {
      const priceCents = parseVariantPriceCents(payload.price_cents)
      if (Number.isNaN(priceCents)) {
        return json(
          request,
          env,
          { success: false, error: 'price_cents debe ser null o entero >= 0.' },
          400
        )
      }
      clauses.push('price_cents = ?')
      values.push(priceCents)
    }
    if (payload.stock !== undefined) {
      const stock = parseNonNegativeInteger(payload.stock, null)
      if (stock === null)
        return json(request, env, { success: false, error: 'stock debe ser entero >= 0.' }, 400)
      clauses.push('stock = ?')
      values.push(stock)
    }
    if (payload.is_active !== undefined) {
      clauses.push('is_active = ?')
      values.push(parseBooleanToInt(payload.is_active, 1))
    }

    if (clauses.length === 0) {
      return json(
        request,
        env,
        { success: false, error: 'No se enviaron campos para actualizar.' },
        400
      )
    }

    const result = await env.DB.prepare(
      `UPDATE product_variants SET ${clauses.join(', ')} WHERE id = ? AND product_id = ?`
    )
      .bind(...values, variantId, productId)
      .run()

    if (getChangesFromRun(result) === 0) {
      return json(request, env, { success: false, error: 'Variante no encontrada.' }, 404)
    }

    const variant = await env.DB.prepare(
      `SELECT id, product_id, sku, option_name, option_value, price_cents, stock, is_active, created_at
         FROM product_variants
         WHERE id = ? AND product_id = ?`
    )
      .bind(variantId, productId)
      .first<ProductVariantRow>()

    return json(request, env, { success: true, variant })
  } catch (error) {
    if (isUniqueConstraintError(error, 'product_variants.sku')) {
      return json(request, env, { success: false, error: 'sku de variante ya existe.' }, 409)
    }
    workerError(requestId, 'variants:update:error', error)
    return json(
      request,
      env,
      { success: false, error: `Error actualizando variante: ${getErrorMessage(error)}` },
      500
    )
  }
}

async function handleDeleteProductVariant(
  request: Request,
  env: Env,
  requestId: string,
  productId: number,
  variantId: number
): Promise<Response> {
  workerLog(requestId, 'variants:delete:start', { productId, variantId })
  try {
    const tableReady = await tableHasRequiredColumns(
      env,
      'product_variants',
      VARIANT_REQUIRED_COLUMNS
    )
    if (!tableReady) return schemaNotReadyResponse(request, env, 'variantes')

    const result = await env.DB.prepare(
      'DELETE FROM product_variants WHERE id = ? AND product_id = ?'
    )
      .bind(variantId, productId)
      .run()

    if (getChangesFromRun(result) === 0) {
      return json(request, env, { success: false, error: 'Variante no encontrada.' }, 404)
    }

    return json(request, env, { success: true })
  } catch (error) {
    workerError(requestId, 'variants:delete:error', error)
    return json(
      request,
      env,
      { success: false, error: `Error eliminando variante: ${getErrorMessage(error)}` },
      500
    )
  }
}

async function readReviewPayload(request: Request): Promise<ProductReviewPayload> {
  return (await request.json()) as ProductReviewPayload
}

async function readReviewUpdatePayload(request: Request): Promise<ProductReviewUpdatePayload> {
  return (await request.json()) as ProductReviewUpdatePayload
}

async function handleGetProductReviews(
  request: Request,
  env: Env,
  requestId: string,
  productId: number
): Promise<Response> {
  workerLog(requestId, 'reviews:list:start', { productId })
  try {
    const tableReady = await tableHasRequiredColumns(
      env,
      'product_reviews',
      REVIEW_REQUIRED_COLUMNS
    )
    if (!tableReady) return schemaNotReadyResponse(request, env, 'resenas')

    if (!(await productExistsById(env, productId))) {
      return json(request, env, { success: false, error: 'Producto no encontrado.' }, 404)
    }

    const result = await env.DB.prepare(
      `SELECT id, product_id, author_name, rating, title, body, verified_purchase, is_published, created_at
         FROM product_reviews
         WHERE product_id = ?
         ORDER BY created_at DESC, id DESC`
    )
      .bind(productId)
      .all<ProductReviewRow>()

    return json(request, env, { success: true, reviews: result.results || [] })
  } catch (error) {
    workerError(requestId, 'reviews:list:error', error)
    return json(
      request,
      env,
      { success: false, error: `Error obteniendo resenas: ${getErrorMessage(error)}` },
      500
    )
  }
}

async function handleCreateProductReview(
  request: Request,
  env: Env,
  requestId: string,
  productId: number
): Promise<Response> {
  workerLog(requestId, 'reviews:create:start', { productId })
  try {
    const tableReady = await tableHasRequiredColumns(
      env,
      'product_reviews',
      REVIEW_REQUIRED_COLUMNS
    )
    if (!tableReady) return schemaNotReadyResponse(request, env, 'resenas')

    if (!(await productExistsById(env, productId))) {
      return json(request, env, { success: false, error: 'Producto no encontrado.' }, 404)
    }

    const payload = await readReviewPayload(request)
    const authorName = normalizeOptionalText(payload.author_name)
    const rating = Number(payload.rating)
    const title = normalizeOptionalText(payload.title)
    const body = normalizeOptionalText(payload.body)
    const verifiedPurchase = parseBooleanToInt(payload.verified_purchase, 0)
    const isPublished = parseBooleanToInt(payload.is_published, 0)

    if (!authorName)
      return json(request, env, { success: false, error: 'author_name es obligatorio.' }, 400)
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return json(
        request,
        env,
        { success: false, error: 'rating debe ser entero entre 1 y 5.' },
        400
      )
    }

    const result = await env.DB.prepare(
      `INSERT INTO product_reviews (
          product_id,
          author_name,
          rating,
          title,
          body,
          verified_purchase,
          is_published
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        productId,
        authorName,
        rating,
        title || null,
        body || null,
        verifiedPurchase,
        isPublished
      )
      .run()

    const createdId = getRunLastRowId(result)
    const review =
      createdId != null
        ? await env.DB.prepare(
            `SELECT id, product_id, author_name, rating, title, body, verified_purchase, is_published, created_at
               FROM product_reviews
               WHERE id = ?`
          )
            .bind(createdId)
            .first<ProductReviewRow>()
        : null

    return json(request, env, { success: true, review }, 201)
  } catch (error) {
    workerError(requestId, 'reviews:create:error', error)
    return json(
      request,
      env,
      { success: false, error: `Error creando resena: ${getErrorMessage(error)}` },
      500
    )
  }
}

async function handleUpdateProductReview(
  request: Request,
  env: Env,
  requestId: string,
  productId: number,
  reviewId: number
): Promise<Response> {
  workerLog(requestId, 'reviews:update:start', { productId, reviewId })
  try {
    const tableReady = await tableHasRequiredColumns(
      env,
      'product_reviews',
      REVIEW_REQUIRED_COLUMNS
    )
    if (!tableReady) return schemaNotReadyResponse(request, env, 'resenas')

    const payload = await readReviewUpdatePayload(request)
    const clauses: string[] = []
    const values: unknown[] = []

    if (payload.author_name !== undefined) {
      const authorName = normalizeOptionalText(payload.author_name)
      if (!authorName)
        return json(
          request,
          env,
          { success: false, error: 'author_name no puede estar vacio.' },
          400
        )
      clauses.push('author_name = ?')
      values.push(authorName)
    }
    if (payload.rating !== undefined) {
      const rating = Number(payload.rating)
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return json(
          request,
          env,
          { success: false, error: 'rating debe ser entero entre 1 y 5.' },
          400
        )
      }
      clauses.push('rating = ?')
      values.push(rating)
    }
    if (payload.title !== undefined) {
      const title = normalizeOptionalText(payload.title)
      clauses.push('title = ?')
      values.push(title || null)
    }
    if (payload.body !== undefined) {
      const body = normalizeOptionalText(payload.body)
      clauses.push('body = ?')
      values.push(body || null)
    }
    if (payload.verified_purchase !== undefined) {
      clauses.push('verified_purchase = ?')
      values.push(parseBooleanToInt(payload.verified_purchase, 0))
    }
    if (payload.is_published !== undefined) {
      clauses.push('is_published = ?')
      values.push(parseBooleanToInt(payload.is_published, 0))
    }

    if (clauses.length === 0) {
      return json(
        request,
        env,
        { success: false, error: 'No se enviaron campos para actualizar.' },
        400
      )
    }

    const result = await env.DB.prepare(
      `UPDATE product_reviews SET ${clauses.join(', ')} WHERE id = ? AND product_id = ?`
    )
      .bind(...values, reviewId, productId)
      .run()

    if (getChangesFromRun(result) === 0) {
      return json(request, env, { success: false, error: 'Resena no encontrada.' }, 404)
    }

    const review = await env.DB.prepare(
      `SELECT id, product_id, author_name, rating, title, body, verified_purchase, is_published, created_at
         FROM product_reviews
         WHERE id = ? AND product_id = ?`
    )
      .bind(reviewId, productId)
      .first<ProductReviewRow>()

    return json(request, env, { success: true, review })
  } catch (error) {
    workerError(requestId, 'reviews:update:error', error)
    return json(
      request,
      env,
      { success: false, error: `Error actualizando resena: ${getErrorMessage(error)}` },
      500
    )
  }
}

async function handleDeleteProductReview(
  request: Request,
  env: Env,
  requestId: string,
  productId: number,
  reviewId: number
): Promise<Response> {
  workerLog(requestId, 'reviews:delete:start', { productId, reviewId })
  try {
    const tableReady = await tableHasRequiredColumns(
      env,
      'product_reviews',
      REVIEW_REQUIRED_COLUMNS
    )
    if (!tableReady) return schemaNotReadyResponse(request, env, 'resenas')

    const result = await env.DB.prepare(
      'DELETE FROM product_reviews WHERE id = ? AND product_id = ?'
    )
      .bind(reviewId, productId)
      .run()

    if (getChangesFromRun(result) === 0) {
      return json(request, env, { success: false, error: 'Resena no encontrada.' }, 404)
    }

    return json(request, env, { success: true })
  } catch (error) {
    workerError(requestId, 'reviews:delete:error', error)
    return json(
      request,
      env,
      { success: false, error: `Error eliminando resena: ${getErrorMessage(error)}` },
      500
    )
  }
}

async function handleGetProductTypes(
  request: Request,
  env: Env,
  requestId: string
): Promise<Response> {
  workerLog(requestId, 'types:list:start')
  try {
    await ensureProductTypesCatalog(env, requestId)
    const result = await env.DB.prepare(
      'SELECT id, type, sort FROM product_types ORDER BY sort DESC, type ASC'
    ).all<ProductTypeRow>()
    workerLog(requestId, 'types:list:ok', { count: result.results?.length || 0 })
    return json(request, env, { success: true, types: result.results || [] })
  } catch (error) {
    workerError(requestId, 'types:list:error', error)
    return json(
      request,
      env,
      { success: false, error: `Error obteniendo types: ${getErrorMessage(error)}` },
      500
    )
  }
}

async function handleGetProductTypeById(
  request: Request,
  env: Env,
  requestId: string,
  productTypeId: number
): Promise<Response> {
  workerLog(requestId, 'types:get:start', { productTypeId })
  try {
    await ensureProductTypesCatalog(env, requestId)
    const type = await env.DB.prepare(
      'SELECT id, type, sort FROM product_types WHERE id = ? LIMIT 1'
    )
      .bind(productTypeId)
      .first<ProductTypeRow>()

    if (!type) return json(request, env, { success: false, error: 'Type no encontrado.' }, 404)

    workerLog(requestId, 'types:get:ok')
    return json(request, env, { success: true, type })
  } catch (error) {
    workerError(requestId, 'types:get:error', error)
    return json(
      request,
      env,
      { success: false, error: `Error leyendo type: ${getErrorMessage(error)}` },
      500
    )
  }
}

async function handleCreateProductType(
  request: Request,
  env: Env,
  requestId: string
): Promise<Response> {
  workerLog(requestId, 'types:create:start')
  try {
    await ensureProductTypesCatalog(env, requestId)
    const payload = (await request.json()) as { type?: string; sort?: number }
    const type = normalizeType(payload.type)
    const sort = payload.sort === undefined ? 0 : parseInteger(payload.sort)

    if (!type) {
      return json(
        request,
        env,
        { success: false, error: 'type invalido. Usa letras, numeros, guion o guion bajo.' },
        400
      )
    }
    if (sort === null) {
      return json(request, env, { success: false, error: 'sort debe ser entero.' }, 400)
    }

    await env.DB.prepare('INSERT INTO product_types (type, sort) VALUES (?, ?)')
      .bind(type, sort)
      .run()

    const created = await env.DB.prepare(
      'SELECT id, type, sort FROM product_types WHERE type = ? LIMIT 1'
    )
      .bind(type)
      .first<ProductTypeRow>()

    workerLog(requestId, 'types:create:ok', { type })
    return json(request, env, { success: true, type: created }, 201)
  } catch (error) {
    workerError(requestId, 'types:create:error', error)
    return json(
      request,
      env,
      { success: false, error: `Error creando type: ${getErrorMessage(error)}` },
      500
    )
  }
}

async function handleUpdateProductType(
  request: Request,
  env: Env,
  requestId: string,
  productTypeId: number
): Promise<Response> {
  workerLog(requestId, 'types:update:start', { productTypeId })
  try {
    await ensureProductTypesCatalog(env, requestId)
    const current = await env.DB.prepare(
      'SELECT id, type, sort FROM product_types WHERE id = ? LIMIT 1'
    )
      .bind(productTypeId)
      .first<ProductTypeRow>()
    if (!current) return json(request, env, { success: false, error: 'Type no encontrado.' }, 404)

    const payload = (await request.json()) as { type?: string; sort?: number }
    const nextType = payload.type === undefined ? current.type : normalizeType(payload.type)
    const nextSort = payload.sort === undefined ? current.sort : parseInteger(payload.sort)

    if (!nextType) {
      return json(
        request,
        env,
        { success: false, error: 'type invalido. Usa letras, numeros, guion o guion bajo.' },
        400
      )
    }
    if (nextSort === null) {
      return json(request, env, { success: false, error: 'sort debe ser entero.' }, 400)
    }

    await env.DB.prepare('UPDATE product_types SET type = ?, sort = ? WHERE id = ?')
      .bind(nextType, nextSort, productTypeId)
      .run()

    let migratedProducts = 0
    if (nextType !== current.type) {
      const migrationResult = await env.DB.prepare('UPDATE products SET type = ? WHERE type = ?')
        .bind(nextType, current.type)
        .run()
      migratedProducts = getChangesFromRun(migrationResult)
    }

    const updated = await env.DB.prepare(
      'SELECT id, type, sort FROM product_types WHERE id = ? LIMIT 1'
    )
      .bind(productTypeId)
      .first<ProductTypeRow>()

    workerLog(requestId, 'types:update:ok', { migratedProducts })
    return json(request, env, { success: true, type: updated, migrated_products: migratedProducts })
  } catch (error) {
    workerError(requestId, 'types:update:error', error)
    return json(
      request,
      env,
      { success: false, error: `Error actualizando type: ${getErrorMessage(error)}` },
      500
    )
  }
}

async function handleDeleteProductType(
  request: Request,
  env: Env,
  requestId: string,
  productTypeId: number
): Promise<Response> {
  workerLog(requestId, 'types:delete:start', { productTypeId })
  try {
    await ensureProductTypesCatalog(env, requestId)
    const current = await env.DB.prepare(
      'SELECT id, type, sort FROM product_types WHERE id = ? LIMIT 1'
    )
      .bind(productTypeId)
      .first<ProductTypeRow>()
    if (!current) return json(request, env, { success: false, error: 'Type no encontrado.' }, 404)

    const usage = await env.DB.prepare('SELECT COUNT(*) as count FROM products WHERE type = ?')
      .bind(current.type)
      .first<{ count: number }>()
    const usedCount = Number(usage?.count || 0)
    if (usedCount > 0) {
      return json(
        request,
        env,
        {
          success: false,
          error: `No se puede eliminar "${current.type}" porque tiene ${usedCount} producto(s) asociado(s).`
        },
        409
      )
    }

    await env.DB.prepare('DELETE FROM product_types WHERE id = ?').bind(productTypeId).run()
    workerLog(requestId, 'types:delete:ok')
    return json(request, env, { success: true })
  } catch (error) {
    workerError(requestId, 'types:delete:error', error)
    return json(
      request,
      env,
      { success: false, error: `Error eliminando type: ${getErrorMessage(error)}` },
      500
    )
  }
}

function readOrderFilters(url: URL): { page: number; limit: number; filters: OrderFilters } {
  const rawPage = parsePositiveIntegerInput(url.searchParams.get('page'))
  const page = Math.max(1, rawPage || 1)
  const limit = 10

  let amountMinCents = parseCurrencyInputToCents(url.searchParams.get('amount_min'))
  let amountMaxCents = parseCurrencyInputToCents(url.searchParams.get('amount_max'))
  let qtyMin = parsePositiveIntegerInput(url.searchParams.get('qty_min'))
  let qtyMax = parsePositiveIntegerInput(url.searchParams.get('qty_max'))

  if (amountMinCents !== null && amountMaxCents !== null && amountMinCents > amountMaxCents) {
    const swap = amountMinCents
    amountMinCents = amountMaxCents
    amountMaxCents = swap
  }

  if (qtyMin !== null && qtyMax !== null && qtyMin > qtyMax) {
    const swap = qtyMin
    qtyMin = qtyMax
    qtyMax = swap
  }

  const statusValue = String(url.searchParams.get('status') || '')
    .trim()
    .toLowerCase() as DisplayStatus

  const filters: OrderFilters = {
    q: String(url.searchParams.get('q') || '')
      .trim()
      .toLowerCase(),
    status: DISPLAY_STATUS_VALUES.includes(statusValue) ? statusValue : '',
    amountMinCents,
    amountMaxCents,
    dateFrom: parseDateInput(url.searchParams.get('date_from')),
    dateTo: parseDateInput(url.searchParams.get('date_to')),
    qtyMin,
    qtyMax,
    productQuery: String(url.searchParams.get('product_q') || '')
      .trim()
      .toLowerCase()
  }

  return { page, limit, filters }
}

const DISPLAY_STATUS_SQL = `CASE
  WHEN lower(COALESCE(o.shipping_status, '')) = 'cancelled' OR o.status = 'cancelled' THEN 'cancelado'
  WHEN lower(COALESCE(o.shipping_status, '')) = 'partially_cancelled' THEN 'cancelado_parcial'
  WHEN lower(COALESCE(o.shipping_status, '')) = 'lost' THEN 'perdido'
  WHEN o.status = 'unpaid' THEN 'pendiente_pago'
  WHEN lower(COALESCE(o.shipping_status, '')) = 'preparing' THEN 'preparando_envio'
  WHEN lower(COALESCE(o.shipping_status, '')) = 'in_transit' OR o.status = 'shipped' THEN 'en_camino'
  WHEN lower(COALESCE(o.shipping_status, '')) = 'delivered' THEN 'entregado'
  ELSE 'pagado'
END`

function readShipmentFilters(url: URL): ShipmentListFilters {
  const status = normalizeShippingStatus(url.searchParams.get('status'))
  return {
    status: status || ''
  }
}

function mapShipmentSummary(row: ShipmentListRow, env: Env): Record<string, unknown> {
  return {
    id: row.id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    customer_name: row.customer_name || null,
    customer_email: row.customer_email,
    customer_phone: row.customer_phone || null,
    total_amount_cents: Number(row.total_amount_cents || 0),
    currency: row.currency || 'MXN',
    approval_status: parseShipmentApprovalStatus(row.approval_status),
    shipment_status: normalizeWorkerShippingStatus(row.shipment_status),
    carrier: row.carrier || null,
    service: row.service || null,
    tracking_number: row.tracking_number || null,
    tracking_url: row.tracking_url || null,
    label_r2_key: row.label_r2_key || null,
    label_url: row.label_r2_key ? buildAssetUrl(env, row.label_r2_key) : null,
    approved_at: row.approved_at || null,
    rejected_at: row.rejected_at || null,
    rejected_reason: row.rejected_reason || null,
    last_sync_at: row.last_sync_at || null,
    last_error: row.last_error || null,
    last_error_code: row.last_error_code || null,
    tracking_sync_paused_at: row.tracking_sync_paused_at || null,
    tracking_sync_pause_reason: row.tracking_sync_pause_reason || null
  }
}

async function handleGetOrders(request: Request, env: Env, requestId: string): Promise<Response> {
  workerLog(requestId, 'orders:list:start')
  try {
    await ensureOrdersAdminSchema(env, requestId)

    const url = new URL(request.url)
    const { page, limit, filters } = readOrderFilters(url)

    const whereClauses: string[] = ['1 = 1']
    const binds: unknown[] = []

    if (filters.q) {
      whereClauses.push("(lower(o.id) LIKE ? OR lower(COALESCE(o.stripe_session_id, '')) LIKE ?)")
      const qLike = `%${filters.q}%`
      binds.push(qLike, qLike)
    }

    if (filters.status) {
      whereClauses.push(`${DISPLAY_STATUS_SQL} = ?`)
      binds.push(filters.status)
    }

    if (filters.amountMinCents !== null) {
      whereClauses.push('o.total_amount_cents >= ?')
      binds.push(filters.amountMinCents)
    }

    if (filters.amountMaxCents !== null) {
      whereClauses.push('o.total_amount_cents <= ?')
      binds.push(filters.amountMaxCents)
    }

    if (filters.dateFrom) {
      whereClauses.push("datetime(o.created_at) >= datetime(? || ' 00:00:00')")
      binds.push(filters.dateFrom)
    }

    if (filters.dateTo) {
      whereClauses.push("datetime(o.created_at) < datetime(? || ' 00:00:00', '+1 day')")
      binds.push(filters.dateTo)
    }

    if (filters.qtyMin !== null) {
      whereClauses.push('COALESCE(agg.units_total, 0) >= ?')
      binds.push(filters.qtyMin)
    }

    if (filters.qtyMax !== null) {
      whereClauses.push('COALESCE(agg.units_total, 0) <= ?')
      binds.push(filters.qtyMax)
    }

    if (filters.productQuery) {
      whereClauses.push(
        `EXISTS (
          SELECT 1
          FROM order_items oi
          LEFT JOIN products p ON p.id = oi.product_id
          WHERE oi.order_id = o.id
            AND (
              lower(oi.product_slug) LIKE ?
              OR lower(COALESCE(p.title, '')) LIKE ?
            )
        )`
      )
      const productLike = `%${filters.productQuery}%`
      binds.push(productLike, productLike)
    }

    const offset = (page - 1) * limit
    const query = `
      SELECT
        o.id,
        o.stripe_session_id,
        o.customer_email,
        o.customer_name,
        o.customer_phone,
        o.total_amount_cents,
        o.currency,
        o.status,
        COALESCE(o.shipping_status, 'pending') AS shipping_status,
        o.created_at,
        o.updated_at,
        COALESCE(agg.units_total, 0) AS units_total,
        COALESCE(agg.items_count, 0) AS items_count,
        ${DISPLAY_STATUS_SQL} AS display_status
      FROM orders o
      LEFT JOIN (
        SELECT order_id, SUM(quantity) AS units_total, COUNT(*) AS items_count
        FROM order_items
        GROUP BY order_id
      ) agg ON agg.order_id = o.id
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY datetime(o.created_at) DESC, o.id DESC
      LIMIT ? OFFSET ?
    `

    const result = await env.DB.prepare(query)
      .bind(...binds, limit + 1, offset)
      .all<OrderListRow>()

    const rows = result.results || []
    const hasNext = rows.length > limit
    const orders = rows.slice(0, limit).map((row) => ({
      ...row,
      total_amount_cents: Number(row.total_amount_cents || 0),
      units_total: Number(row.units_total || 0),
      items_count: Number(row.items_count || 0),
      shipping_status: row.shipping_status || 'pending',
      display_status: row.display_status || toDisplayStatus(row.status, row.shipping_status)
    }))

    workerLog(requestId, 'orders:list:ok', { count: orders.length, page, hasNext })
    return json(request, env, {
      success: true,
      orders,
      page,
      limit,
      has_prev: page > 1,
      has_next: hasNext,
      applied_filters: {
        q: filters.q || null,
        status: filters.status || null,
        amount_min: filters.amountMinCents !== null ? filters.amountMinCents / 100 : null,
        amount_max: filters.amountMaxCents !== null ? filters.amountMaxCents / 100 : null,
        date_from: filters.dateFrom || null,
        date_to: filters.dateTo || null,
        qty_min: filters.qtyMin,
        qty_max: filters.qtyMax,
        product_q: filters.productQuery || null
      }
    })
  } catch (error) {
    workerError(requestId, 'orders:list:error', error)
    return json(
      request,
      env,
      { success: false, error: `Error obteniendo pedidos: ${getErrorMessage(error)}` },
      500
    )
  }
}

async function fetchOrderDetail(
  env: Env,
  orderId: string
): Promise<null | Record<string, unknown>> {
  await ensureOrderShipmentsSchema(env, 'fetch-order-detail')

  const orderRow = await env.DB.prepare(
    `
      SELECT
        id,
        stripe_session_id,
        customer_email,
        customer_name,
        customer_phone,
        shipping_address_json,
        total_amount_cents,
        currency,
        status,
        COALESCE(shipping_status, 'pending') AS shipping_status,
        internal_note,
        created_at,
        updated_at
      FROM orders
      WHERE id = ?
      LIMIT 1
    `
  )
    .bind(orderId)
    .first<{
      id: string
      stripe_session_id: string | null
      customer_email: string
      customer_name: string | null
      customer_phone: string | null
      shipping_address_json: string | null
      total_amount_cents: number
      currency: string
      status: string
      shipping_status: string
      internal_note: string | null
      created_at: string
      updated_at: string
    }>()

  if (!orderRow) return null

  const itemsResult = await env.DB.prepare(
    `
      SELECT
        oi.id,
        oi.order_id,
        oi.product_id,
        oi.product_slug,
        oi.quantity,
        oi.unit_price_cents,
        p.title AS product_title,
        p.type AS product_type,
        p.image_key AS product_image_key
      FROM order_items oi
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = ?
      ORDER BY oi.id ASC
    `
  )
    .bind(orderId)
    .all<OrderItemRow>()

  const reservationsResult = await env.DB.prepare(
    `
      SELECT id, product_id, quantity, status, expires_at, created_at, updated_at
      FROM stock_reservations
      WHERE order_id = ?
      ORDER BY id ASC
    `
  )
    .bind(orderId)
    .all<StockReservationRow>()

  const stripeEventsResult = await env.DB.prepare(
    `
      SELECT id, event_id, event_type, created_at
      FROM stripe_events
      WHERE order_id = ?
      ORDER BY id DESC
    `
  )
    .bind(orderId)
    .all<StripeEventRow>()

  const shipmentRow = await env.DB.prepare(
    `
      SELECT
        order_id,
        provider,
        mode,
        approval_status,
        shipment_status,
        carrier,
        service,
        tracking_number,
        tracking_url,
        envia_shipment_id,
        label_r2_key,
        quote_amount_cents,
        currency,
        parcel_json,
        address_validation_json,
        envia_request_json,
        envia_response_json,
        approved_at,
        rejected_at,
          rejected_reason,
          last_sync_at,
          last_error,
          last_error_code,
          tracking_sync_paused_at,
          tracking_sync_pause_reason,
          created_at,
          updated_at
      FROM order_shipments
      WHERE order_id = ?
      LIMIT 1
    `
  )
    .bind(orderId)
    .first<OrderShipmentRow>()

  const shipmentEventsResult = await env.DB.prepare(
    `
      SELECT id, order_id, event_type, source, payload_json, created_at
      FROM order_shipment_events
      WHERE order_id = ?
      ORDER BY id DESC
    `
  )
    .bind(orderId)
    .all<OrderShipmentEventRow>()

  const shipmentGuidesResult = await env.DB.prepare(
    `
      SELECT
        order_id,
        guide_index,
        carrier,
        service,
        tracking_number,
        tracking_url,
        envia_shipment_id,
        label_r2_key,
        parcel_json,
        envia_request_json,
        envia_response_json,
        shipment_status,
        last_error,
        created_at,
        updated_at
      FROM order_shipment_guides
      WHERE order_id = ?
      ORDER BY guide_index ASC
    `
  )
    .bind(orderId)
    .all<OrderShipmentGuideRow>()

  const items = (itemsResult.results || []).map((item) => ({
    ...item,
    quantity: Number(item.quantity || 0),
    unit_price_cents: Number(item.unit_price_cents || 0),
    amount_cents: Number(item.quantity || 0) * Number(item.unit_price_cents || 0)
  }))

  const unitsTotal = items.reduce((acc, item) => acc + Number(item.quantity || 0), 0)
  const subtotalCents = items.reduce((acc, item) => acc + Number(item.amount_cents || 0), 0)
  const displayStatus = toDisplayStatus(orderRow.status, orderRow.shipping_status)

  return {
    id: orderRow.id,
    stripe_session_id: orderRow.stripe_session_id,
    status: orderRow.status,
    shipping_status: orderRow.shipping_status,
    display_status: displayStatus,
    customer_email: orderRow.customer_email,
    customer_name: orderRow.customer_name,
    customer_phone: orderRow.customer_phone,
    shipping_address_json: orderRow.shipping_address_json,
    shipping_address: parseShippingAddress(orderRow.shipping_address_json),
    total_amount_cents: Number(orderRow.total_amount_cents || 0),
    currency: orderRow.currency,
    internal_note: orderRow.internal_note,
    created_at: orderRow.created_at,
    updated_at: orderRow.updated_at,
    summary: {
      units_total: unitsTotal,
      items_count: items.length,
      subtotal_cents: subtotalCents,
      total_amount_cents: Number(orderRow.total_amount_cents || 0),
      currency: orderRow.currency
    },
    items,
    shipment: toOrderShipment(
      shipmentRow,
      env,
      (shipmentGuidesResult.results || []).map((guide) => toShipmentGuide(guide, env))
    ),
    shipment_events: (shipmentEventsResult.results || []).map((event) => ({
      ...event,
      payload: safeParseJson(event.payload_json)
    })),
    reservations: (reservationsResult.results || []).map((row) => ({
      ...row,
      quantity: Number(row.quantity || 0)
    })),
    stripe_events: stripeEventsResult.results || []
  }
}

async function fetchShipmentRow(env: Env, orderId: string): Promise<OrderShipmentRow | null> {
  await ensureOrderShipmentsSchema(env, 'fetch-shipment-row')
  const row = await env.DB.prepare(
    `
      SELECT
        order_id,
        provider,
        mode,
        approval_status,
        shipment_status,
        carrier,
        service,
        tracking_number,
        tracking_url,
        envia_shipment_id,
        label_r2_key,
        quote_amount_cents,
        currency,
        parcel_json,
        address_validation_json,
        envia_request_json,
        envia_response_json,
        approved_at,
        rejected_at,
          rejected_reason,
          last_sync_at,
          last_error,
          last_error_code,
          tracking_sync_paused_at,
          tracking_sync_pause_reason,
          created_at,
          updated_at
      FROM order_shipments
      WHERE order_id = ?
      LIMIT 1
    `
  )
    .bind(orderId)
    .first<OrderShipmentRow>()

  return row || null
}

async function fetchShipmentBoxTypeRow(
  env: Env,
  boxTypeId: number
): Promise<ShipmentBoxTypeRow | null> {
  await ensureOrderShipmentsSchema(env, 'fetch-shipment-box-type')
  const row = await env.DB.prepare(
    `
      SELECT
        id,
        name,
        code,
        inner_length_cm,
        inner_width_cm,
        inner_height_cm,
        max_products,
        stock_qty,
        is_active,
        sort,
        created_at,
        updated_at
      FROM shipment_box_types
      WHERE id = ?
      LIMIT 1
    `
  )
    .bind(boxTypeId)
    .first<ShipmentBoxTypeRow>()

  return row || null
}

async function listShipmentBoxTypeRows(env: Env): Promise<ShipmentBoxTypeRow[]> {
  await ensureOrderShipmentsSchema(env, 'list-shipment-box-types')
  const result = await env.DB.prepare(
    `
      SELECT
        id,
        name,
        code,
        inner_length_cm,
        inner_width_cm,
        inner_height_cm,
        max_products,
        stock_qty,
        is_active,
        sort,
        created_at,
        updated_at
      FROM shipment_box_types
      ORDER BY is_active DESC, sort ASC, id ASC
    `
  ).all<ShipmentBoxTypeRow>()

  return result.results || []
}

async function insertShipmentEvent(
  env: Env,
  orderId: string,
  eventType: string,
  source: string,
  payload: unknown
): Promise<void> {
  await ensureOrderShipmentsSchema(env, 'insert-shipment-event')
  await env.DB.prepare(
    `
      INSERT INTO order_shipment_events (order_id, event_type, source, payload_json)
      VALUES (?, ?, ?, ?)
    `
  )
    .bind(orderId, eventType, source, safeStringify(payload))
    .run()
}

function buildDefaultParcel(
  env: Env,
  totalAmountCents: number,
  existing: Record<string, unknown> | null = null
): Record<string, unknown> {
  return {
    weight_kg: parsePositiveFloat(
      existing?.weight_kg,
      parsePositiveFloat(env.ENVIA_DEFAULT_WEIGHT_KG, 1)
    ),
    length_cm: parsePositiveFloat(
      existing?.length_cm,
      parsePositiveFloat(env.ENVIA_DEFAULT_LENGTH_CM, 10)
    ),
    width_cm: parsePositiveFloat(
      existing?.width_cm,
      parsePositiveFloat(env.ENVIA_DEFAULT_WIDTH_CM, 10)
    ),
    height_cm: parsePositiveFloat(
      existing?.height_cm,
      parsePositiveFloat(env.ENVIA_DEFAULT_HEIGHT_CM, 10)
    ),
    declared_value_cents: parseNonNegativeCents(existing?.declared_value_cents, totalAmountCents),
    content:
      cleanText(existing?.content) ||
      cleanText(env.ENVIA_DEFAULT_CONTENT) ||
      'Joyeria Lumea Imperium',
    notes: cleanText(existing?.notes)
  }
}

function distributeDeclaredValueAcrossBoxes(
  totalAmountCents: number,
  unitsPerBox: number[]
): number[] {
  const totalUnits = unitsPerBox.reduce((sum, units) => sum + units, 0)
  if (totalUnits <= 0) return unitsPerBox.map(() => 0)

  let assigned = 0
  return unitsPerBox.map((units, index) => {
    if (index === unitsPerBox.length - 1) {
      return Math.max(0, totalAmountCents - assigned)
    }
    const value = Math.round((totalAmountCents * units) / totalUnits)
    assigned += value
    return value
  })
}

function buildAutoBoxPlan(
  baseline: Record<string, unknown>,
  totalAmountCents: number,
  totalUnits: number,
  productsPerBox: number,
  boxTypeSnapshot: Record<string, unknown> | null = null
): Record<string, unknown> {
  const unitBuckets: number[] = []
  let remaining = totalUnits
  while (remaining > 0) {
    const unitsInBox = Math.min(productsPerBox, remaining)
    unitBuckets.push(unitsInBox)
    remaining -= unitsInBox
  }

  const declaredValues = distributeDeclaredValueAcrossBoxes(totalAmountCents, unitBuckets)

  return {
    ...(boxTypeSnapshot || {}),
    products_per_box: productsPerBox,
    boxes: unitBuckets.map((unitsInBox, index) => ({
      guide_index: index + 1,
      ...(boxTypeSnapshot || {}),
      units_in_box: unitsInBox,
      weight_kg: baseline.weight_kg,
      length_cm: baseline.length_cm,
      width_cm: baseline.width_cm,
      height_cm: baseline.height_cm,
      declared_value_cents: declaredValues[index] ?? 0,
      content: baseline.content,
      notes: baseline.notes || null
    }))
  }
}

function normalizeBoxPlanInput(
  payload: ShipmentQuotePayload | null | undefined,
  existingParcel: Record<string, unknown> | null,
  baseline: Record<string, unknown>,
  totalAmountCents: number,
  totalUnits: number
): { ok: true; boxPlan: Record<string, unknown> | null } | { ok: false; error: string } {
  const hasBoxPlanField = Boolean(
    payload && Object.prototype.hasOwnProperty.call(payload, 'box_plan')
  )
  const rawBoxPlan = hasBoxPlanField
    ? toObjectRecord(payload?.box_plan)
    : toObjectRecord(existingParcel?.box_plan)

  if (totalUnits <= 1 && !rawBoxPlan) {
    return { ok: true, boxPlan: null }
  }

  if (!rawBoxPlan) {
    return { ok: true, boxPlan: null }
  }

  const boxTypeSnapshot =
    buildShipmentBoxTypeSnapshot(rawBoxPlan) ||
    buildShipmentBoxTypeSnapshot(
      Array.isArray(rawBoxPlan.boxes) ? toObjectRecord(rawBoxPlan.boxes[0]) : null
    )
  const parsedProductsPerBox = parsePositiveInteger(rawBoxPlan.products_per_box, null)
  const rawBoxes = Array.isArray(rawBoxPlan.boxes) ? rawBoxPlan.boxes : []
  if (rawBoxes.length === 0) {
    if (!parsedProductsPerBox || parsedProductsPerBox >= totalUnits) {
      return {
        ok: true,
        boxPlan: boxTypeSnapshot
          ? compactObject({
              ...(boxTypeSnapshot || {}),
              products_per_box: parsedProductsPerBox || totalUnits
            }) as Record<string, unknown>
          : null
      }
    }
    return {
      ok: true,
      boxPlan: buildAutoBoxPlan(
        baseline,
        totalAmountCents,
        totalUnits,
        parsedProductsPerBox,
        boxTypeSnapshot
      )
    }
  }

  const normalizedBoxes = rawBoxes
    .map((entry, index) => {
      const record = toObjectRecord(entry)
      if (!record) return null
      const unitsInBox = parsePositiveInteger(record.units_in_box, null)
      const weightKg = parsePositiveFloat(record.weight_kg, baseline.weight_kg as number | null)
      const lengthCm = parsePositiveFloat(record.length_cm, baseline.length_cm as number | null)
      const widthCm = parsePositiveFloat(record.width_cm, baseline.width_cm as number | null)
      const heightCm = parsePositiveFloat(record.height_cm, baseline.height_cm as number | null)
      const declaredValueCents = parseNonNegativeCents(
        record.declared_value_cents,
        baseline.declared_value_cents as number | null
      )

      if (
        !unitsInBox ||
        !weightKg ||
        !lengthCm ||
        !widthCm ||
        !heightCm ||
        declaredValueCents == null
      ) {
        return null
      }

      return {
        guide_index: index + 1,
        ...(boxTypeSnapshot || {}),
        units_in_box: unitsInBox,
        weight_kg: weightKg,
        length_cm: lengthCm,
        width_cm: widthCm,
        height_cm: heightCm,
        declared_value_cents: declaredValueCents,
        content: cleanText(record.content) || String(baseline.content || ''),
        notes: cleanText(record.notes)
      }
    })
    .filter(Boolean)

  if (normalizedBoxes.length <= 1) {
    return {
      ok: true,
      boxPlan: boxTypeSnapshot
        ? compactObject({
            ...(boxTypeSnapshot || {}),
            products_per_box: parsedProductsPerBox || totalUnits
          }) as Record<string, unknown>
        : null
    }
  }

  const typedBoxes = normalizedBoxes as Array<Record<string, unknown>>
  const unitsAssigned = typedBoxes.reduce((sum, box) => sum + Number(box.units_in_box || 0), 0)
  if (unitsAssigned !== totalUnits) {
    return {
      ok: false,
      error: `La distribucion de cajas suma ${unitsAssigned} unidades y el pedido requiere ${totalUnits}.`
    }
  }

  const productsPerBox =
    parsedProductsPerBox ||
    typedBoxes.reduce((max, box) => Math.max(max, Number(box.units_in_box || 0)), 1)

  return {
    ok: true,
    boxPlan: {
      ...(boxTypeSnapshot || {}),
      products_per_box: productsPerBox,
      boxes: typedBoxes
    }
  }
}

function resolveShipmentBoxes(parcel: Record<string, unknown>): Record<string, unknown>[] {
  const boxPlan = toObjectRecord(parcel.box_plan)
  const rawBoxes = Array.isArray(boxPlan?.boxes) ? boxPlan.boxes : []
  const normalizedBoxes = rawBoxes
    .map((entry) => toObjectRecord(entry))
    .filter(Boolean)
    .map(
      (box) =>
        compactObject({
          guide_index: box?.guide_index,
          box_type: buildShipmentBoxTypeSnapshot(box),
          units_in_box: box?.units_in_box,
          weight_kg: box?.weight_kg,
          length_cm: box?.length_cm,
          width_cm: box?.width_cm,
          height_cm: box?.height_cm,
          declared_value_cents: box?.declared_value_cents,
          content: box?.content,
          notes: box?.notes
        }) as Record<string, unknown>
    )

  if (normalizedBoxes.length > 1) {
    return normalizedBoxes
  }

  const boxTypeSnapshot =
    buildShipmentBoxTypeSnapshot(boxPlan) || buildShipmentBoxTypeSnapshot(toObjectRecord(parcel.box_type))
  return [
    compactObject({
      box_type: boxTypeSnapshot,
      weight_kg: parcel.weight_kg,
      length_cm: parcel.length_cm,
      width_cm: parcel.width_cm,
      height_cm: parcel.height_cm,
      declared_value_cents: parcel.declared_value_cents,
      content: parcel.content,
      notes: parcel.notes
    }) as Record<string, unknown>
  ]
}

function resolveShipmentBoxTypeUsage(
  parcel: Record<string, unknown>,
  guidesCount = 0
): { boxTypeId: number | null; boxesUsed: number; snapshot: Record<string, unknown> | null } {
  const boxPlan = toObjectRecord(parcel.box_plan)
  const snapshot =
    buildShipmentBoxTypeSnapshot(toObjectRecord(parcel.box_type)) ||
    buildShipmentBoxTypeSnapshot(boxPlan) ||
    buildShipmentBoxTypeSnapshot(Array.isArray(boxPlan?.boxes) ? toObjectRecord(boxPlan.boxes[0]) : null)
  const boxTypeId = parseShipmentBoxTypeId(snapshot?.box_type_id, null)
  if (!boxTypeId) {
    return { boxTypeId: null, boxesUsed: 0, snapshot }
  }

  const plannedBoxes = Array.isArray(boxPlan?.boxes) ? boxPlan.boxes.length : 0
  const boxesUsed = Math.max(plannedBoxes, guidesCount > 0 ? guidesCount : plannedBoxes || 1)
  return { boxTypeId, boxesUsed, snapshot }
}

async function consumeShipmentBoxTypeStock(
  env: Env,
  parcel: Record<string, unknown>,
  guidesCount: number
): Promise<{ boxType: Record<string, unknown> | null; warning: string | null; boxesUsed: number }> {
  const usage = resolveShipmentBoxTypeUsage(parcel, guidesCount)
  if (!usage.boxTypeId || usage.boxesUsed <= 0) {
    return { boxType: null, warning: null, boxesUsed: 0 }
  }

  const currentBoxType = await fetchShipmentBoxTypeRow(env, usage.boxTypeId)
  if (!currentBoxType) {
    return { boxType: usage.snapshot, warning: 'El tipo de caja seleccionado ya no existe.', boxesUsed: usage.boxesUsed }
  }

  const stockBefore = Number(currentBoxType.stock_qty || 0)
  const nextStock = Math.max(0, stockBefore - usage.boxesUsed)
  await env.DB.prepare(
    `
      UPDATE shipment_box_types
      SET stock_qty = ?, updated_at = datetime('now')
      WHERE id = ?
    `
  )
    .bind(nextStock, usage.boxTypeId)
    .run()

  return {
    boxType: toShipmentBoxTypeResponse({ ...currentBoxType, stock_qty: nextStock }),
    warning:
      stockBefore < usage.boxesUsed
        ? `Stock bajo para la caja ${currentBoxType.name}. Se descontaron ${usage.boxesUsed} y el inventario quedo en 0.`
        : null,
    boxesUsed: usage.boxesUsed
  }
}

function normalizeParcelInput(
  env: Env,
  payload: ShipmentQuotePayload | null | undefined,
  currentShipment: Record<string, unknown> | null,
  totalAmountCents: number,
  totalUnits: number
): { ok: true; parcel: Record<string, unknown> } | { ok: false; error: string } {
  const existingParcel = toObjectRecord(currentShipment?.parcel)
  const baseline = buildDefaultParcel(env, totalAmountCents, existingParcel)
  const parcel = {
    ...baseline,
    weight_kg: parsePositiveFloat(payload?.weight_kg, baseline.weight_kg as number | null),
    length_cm: parsePositiveFloat(payload?.length_cm, baseline.length_cm as number | null),
    width_cm: parsePositiveFloat(payload?.width_cm, baseline.width_cm as number | null),
    height_cm: parsePositiveFloat(payload?.height_cm, baseline.height_cm as number | null),
    declared_value_cents: parseNonNegativeCents(
      payload?.declared_value_cents,
      baseline.declared_value_cents as number | null
    ),
    content: cleanText(payload?.content) || String(baseline.content || ''),
    notes: cleanText(payload?.notes) || cleanText(baseline.notes)
  }

  if (!parcel.weight_kg || !parcel.length_cm || !parcel.width_cm || !parcel.height_cm) {
    return { ok: false, error: 'Peso y dimensiones del paquete son obligatorios.' }
  }

  const boxPlanResult = normalizeBoxPlanInput(
    payload,
    existingParcel,
    parcel,
    totalAmountCents,
    totalUnits || 1
  )
  if (!boxPlanResult.ok) {
    return boxPlanResult
  }

  if (boxPlanResult.boxPlan) {
    ;(parcel as Record<string, unknown>).box_plan = boxPlanResult.boxPlan
    const boxTypeSnapshot = buildShipmentBoxTypeSnapshot(boxPlanResult.boxPlan)
    if (boxTypeSnapshot) {
      ;(parcel as Record<string, unknown>).box_type = boxTypeSnapshot
    }
  }

  return { ok: true, parcel }
}

async function getOrderShippingDestination(
  env: Env,
  order: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  const shippingAddress = toObjectRecord(order.shipping_address)
  const address = toObjectRecord(shippingAddress?.address)
  if (!address) return null
  const shipment = toObjectRecord(order.shipment)
  const addressValidation = toObjectRecord(shipment?.address_validation)

  const rawLine1 = cleanText(address.line1) || ''
  let street = rawLine1
  let number: string | null = null
  let districtFromLine1: string | null = null

  const districtMatch = rawLine1.match(/\b(?:col(?:onia)?\.?|fracc(?:ionamiento)?\.?|barrio)\b.*$/i)
  if (districtMatch && typeof districtMatch.index === 'number') {
    districtFromLine1 = cleanText(districtMatch[0])
    street = rawLine1.slice(0, districtMatch.index).trim()
  }

  const numberMatch =
    street.match(/(?:#|no\.?|num(?:ero)?\.?)\s*([A-Za-z0-9-]+)/i) ||
    street.match(/\b(\d+[A-Za-z0-9-]*)\b(?!.*\b\d+[A-Za-z0-9-]*\b)/)
  if (numberMatch) {
    number = cleanText(numberMatch[1])
    street = street.replace(numberMatch[0], ' ').replace(/\s+/g, ' ').trim()
  }

  const country = normalizeCountryCode(address.country, 'MX')
  const postalCode = cleanText(address.postal_code)
  const normalizedState =
    country === 'MX'
      ? extractMxStateCodeFromValidation(addressValidation) ||
        normalizeMxStateCode(address.state) ||
        (await lookupMxStateCodeByZip(env, postalCode, country)) ||
        cleanText(address.state)
      : cleanText(address.state)

  return {
    name: cleanText(shippingAddress?.name) || cleanText(order.customer_name),
    email: cleanText(order.customer_email),
    phone: cleanText(shippingAddress?.phone) || cleanText(order.customer_phone),
    street: cleanText(street) || rawLine1,
    number,
    district: districtFromLine1 || cleanText(address.line2),
    city: cleanText(address.city),
    state: normalizedState,
    country,
    postal_code: postalCode
  }
}

async function getOriginAddress(env: Env): Promise<Record<string, unknown> | null> {
  const street = cleanText(env.ENVIA_FROM_STREET)
  const city = cleanText(env.ENVIA_FROM_CITY)
  const postal_code = cleanText(env.ENVIA_FROM_ZIP)
  const country = normalizeCountryCode(env.ENVIA_FROM_COUNTRY, 'MX')

  const state =
    country === 'MX'
      ? normalizeMxStateCode(env.ENVIA_FROM_STATE) ||
        (await lookupMxStateCodeByZip(env, postal_code, country))
      : cleanText(env.ENVIA_FROM_STATE)

  if (!street || !city || !state || !postal_code) return null

  return {
    name: cleanText(env.ENVIA_FROM_NAME) || cleanText(env.ENVIA_FROM_COMPANY) || 'Lumea Imperium',
    company: cleanText(env.ENVIA_FROM_COMPANY) || 'Lumea Imperium',
    email: cleanText(env.ENVIA_FROM_EMAIL),
    phone: cleanText(env.ENVIA_FROM_PHONE),
    street,
    number: cleanText(env.ENVIA_FROM_NUMBER),
    district: cleanText(env.ENVIA_FROM_DISTRICT),
    city,
    state,
    country,
    postal_code
  }
}

function listMissingShipmentAddressFields(
  address: Record<string, unknown> | null,
  label: 'origen' | 'destino'
): string[] {
  if (!address) return [`${label}.direccion`]

  const requiredFields = [
    'name',
    'phone',
    'street',
    'city',
    'state',
    'country',
    'postal_code'
  ] as const

  return requiredFields
    .filter((field) => !cleanText(address[field]))
    .map((field) => `${label}.${field}`)
}

function buildAddressPayload(address: Record<string, unknown>): Record<string, unknown> {
  return compactObject({
    name: address.name,
    company: address.company,
    email: address.email,
    phone: address.phone,
    street: address.street,
    number: address.number,
    district: address.district,
    city: address.city,
    state: address.state,
    country: address.country,
    postal_code: address.postal_code,
    postalCode: address.postal_code,
    zip_code: address.postal_code,
    zipCode: address.postal_code
  }) as Record<string, unknown>
}

function buildLabelAddressPayload(address: Record<string, unknown>): Record<string, unknown> {
  return compactObject({
    name: address.name,
    company: address.company,
    email: address.email,
    phone: address.phone,
    street: address.street,
    number: address.number,
    district: address.district,
    city: address.city,
    state: address.state,
    country: address.country,
    postal_code: address.postal_code,
    postalCode: address.postal_code
  }) as Record<string, unknown>
}

function buildPackagePayload(parcel: Record<string, unknown>): Record<string, unknown> {
  const declaredValueCents = Number(parcel.declared_value_cents || 0)
  const length = Number(parcel.length_cm || 0)
  const width = Number(parcel.width_cm || 0)
  const height = Number(parcel.height_cm || 0)
  return compactObject({
    content: parcel.content,
    amount: 1,
    type: 'box',
    weight: Number(parcel.weight_kg || 0),
    weight_kg: Number(parcel.weight_kg || 0),
    weightUnit: 'KG',
    weight_unit: 'KG',
    length,
    width,
    height,
    dimensions: {
      length,
      width,
      height,
      unit: 'CM'
    },
    dimensionUnit: 'CM',
    dimension_unit: 'CM',
    declaredValue: declaredValueCents / 100,
    declared_value: declaredValueCents / 100,
    insurance: declaredValueCents / 100
  }) as Record<string, unknown>
}

function buildLabelPackagePayload(parcel: Record<string, unknown>): Record<string, unknown> {
  const declaredValueCents = Number(parcel.declared_value_cents || 0)
  const length = Number(parcel.length_cm || 0)
  const width = Number(parcel.width_cm || 0)
  const height = Number(parcel.height_cm || 0)
  return compactObject({
    content: parcel.content,
    amount: 1,
    type: 'box',
    weight: Number(parcel.weight_kg || 0),
    weightUnit: 'KG',
    length,
    width,
    height,
    dimensions: {
      length,
      width,
      height
    },
    lengthUnit: 'CM',
    declaredValue: declaredValueCents / 100,
    insurance: declaredValueCents / 100
  }) as Record<string, unknown>
}

function normalizeRequestedShipmentFilters(payload: ShipmentQuotePayload | null | undefined): {
  carrier: string | null
  service: string | null
} {
  const carrier = cleanText(payload?.carrier)
  const service = carrier ? cleanText(payload?.service) : null
  return { carrier, service }
}

function normalizeShipmentQuoteMode(
  value: unknown,
  fallback: ShipmentQuoteMode = 'auto'
): ShipmentQuoteMode {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
  if (normalized === 'manual') return 'manual'
  if (normalized === 'auto') return 'auto'
  return fallback
}

function normalizeQuoteCandidate(value: unknown): NormalizedQuote | null {
  const record = toObjectRecord(value)
  if (!record) return null

  const carrier = cleanText(record.carrier)
  const service = cleanText(record.service)
  const amountCents = parseNonNegativeCents(record.amount_cents)
  if (!carrier || !service || amountCents === null) return null

  return {
    carrier,
    service,
    amount_cents: amountCents,
    currency: String(cleanText(record.currency) || 'MXN').toUpperCase(),
    estimated_days: parsePositiveFloat(record.estimated_days, null),
    raw: toObjectRecord(record.raw) || record
  }
}

function parseQuoteSnapshot(value: unknown): ShipmentQuoteSnapshot | null {
  const record = toObjectRecord(value)
  if (!record) return null

  const quotes = Array.isArray(record.quotes)
    ? record.quotes.map((quote) => normalizeQuoteCandidate(quote)).filter(Boolean)
    : []
  const normalizedQuotes = quotes as NormalizedQuote[]
  const selected = normalizeQuoteCandidate(record.selected_quote)
  const request = toObjectRecord(record.request)
  if (!request || normalizedQuotes.length === 0) return null
  const requestShipment = toObjectRecord(request.shipment)
  const mode = normalizeShipmentQuoteMode(
    record.mode,
    cleanText(requestShipment?.carrier) || cleanText(requestShipment?.service) ? 'manual' : 'auto'
  )

  return {
    kind: 'quote_snapshot',
    mode,
    quoted_at: String(cleanText(record.quoted_at) || ''),
    request,
    selected_quote: selected,
    quotes: normalizedQuotes,
    attempted_carriers: Array.isArray(record.attempted_carriers)
      ? record.attempted_carriers.map((item) => String(item || '').trim()).filter(Boolean)
      : [],
    provider_payload: record.provider_payload ?? null
  }
}

function findMatchingQuote(
  quotes: NormalizedQuote[],
  selected: ShipmentSelectedQuotePayload | null | undefined
): NormalizedQuote | null {
  const normalized = normalizeQuoteCandidate(selected)
  if (!normalized) return null

  return (
    quotes.find(
      (quote) =>
        quote.carrier.toLowerCase() === normalized.carrier.toLowerCase() &&
        quote.service.toLowerCase() === normalized.service.toLowerCase() &&
        quote.amount_cents === normalized.amount_cents &&
        quote.currency.toUpperCase() === normalized.currency.toUpperCase()
    ) || null
  )
}

async function clearShipmentQuoteState(
  env: Env,
  orderId: string,
  parcel: Record<string, unknown>
): Promise<void> {
  await upsertShipmentRow(env, orderId, {
    parcel_json: safeStringify(parcel),
    carrier: null,
    service: null,
    quote_amount_cents: null,
    envia_request_json: null,
    envia_response_json: null,
    last_error: null,
    last_error_code: null
  })
}

function normalizeLabelSettings(
  value: Record<string, unknown> | null
): Record<string, unknown> | null {
  if (!value) return null

  const printFormat = cleanText(value.printFormat || value.print_format || value.format)
  if (!printFormat) return null

  const printType = cleanText(
    value.printType || value.print_type || value.type || value.labelType || value.label_type
  )
  const rawPrintSize = cleanText(
    value.printSize ||
      value.print_size ||
      value.size ||
      value.paperSize ||
      value.paper_size ||
      value.labelSize ||
      value.label_size
  )
  const normalizedPrintSize = normalizeLabelPrintSize(rawPrintSize, printType)

  return compactObject({
    printFormat,
    printSize: normalizedPrintSize,
    printType
  }) as Record<string, unknown>
}

function normalizeLabelPrintSize(value: string | null, printType: string | null): string | null {
  const raw = cleanText(value)
  if (!raw) return null

  const normalized = raw.toUpperCase().replace(/\s+/g, '')
  if (ENVIA_PRINT_SIZE_ENUMS.has(normalized)) {
    return normalized
  }

  const simplified = normalized.replace(/_/g, '')
  const normalizedPrintType = String(cleanText(printType) || '').toLowerCase()
  const useStock = normalizedPrintType === 'thermal'

  if (simplified === '4X6' || simplified === 'PAPER4X6' || simplified === 'STOCK4X6') {
    return useStock ? 'STOCK_4X6' : 'PAPER_4X6'
  }

  if (simplified === '4X8' || simplified === 'PAPER4X8' || simplified === 'STOCK4X8') {
    return useStock ? 'STOCK_4X8' : 'PAPER_4X8'
  }

  if (
    simplified === 'LETTER' ||
    simplified === '85X11' ||
    simplified === '8.5X11' ||
    simplified === 'PAPERLETTER'
  ) {
    return 'PAPER_LETTER'
  }

  return raw
}

function hasCompleteLabelSettings(value: Record<string, unknown> | null): boolean {
  if (!value) return false
  return Boolean(
    cleanText(value.printFormat) && cleanText(value.printSize) && cleanText(value.printType)
  )
}

async function resolveLabelSettings(
  env: Env,
  carrier: string
): Promise<{ settings: Record<string, unknown>; source: LabelSettingsSource }> {
  const providerSettings = await getDefaultUserPrintSettings(env, carrier).catch(() => null)
  const normalizedProviderSettings = normalizeLabelSettings(providerSettings)
  if (hasCompleteLabelSettings(normalizedProviderSettings)) {
    return {
      settings: normalizedProviderSettings as Record<string, unknown>,
      source: 'provider'
    }
  }

  return {
    settings: { ...ENVIA_LABEL_SETTINGS_FALLBACK },
    source: 'fallback'
  }
}

function getNestedRequiredField(value: unknown, path: string): unknown {
  const segments = path.replace(/\[(\d+)\]/g, '.$1').split('.')
  let current: unknown = value
  for (const segment of segments) {
    if (current === null || current === undefined) return undefined
    if (Array.isArray(current)) {
      const index = Number(segment)
      current = Number.isInteger(index) ? current[index] : undefined
      continue
    }
    if (typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

function listMissingLabelPayloadFields(payload: Record<string, unknown>): string[] {
  const requiredFields = [
    'origin.name',
    'origin.phone',
    'origin.street',
    'origin.city',
    'origin.state',
    'origin.country',
    'origin.postalCode',
    'destination.name',
    'destination.phone',
    'destination.street',
    'destination.city',
    'destination.state',
    'destination.country',
    'destination.postalCode',
    'packages[0].content',
    'packages[0].amount',
    'packages[0].type',
    'packages[0].weight',
    'packages[0].weightUnit',
    'packages[0].length',
    'packages[0].width',
    'packages[0].height',
    'packages[0].dimensions.length',
    'packages[0].dimensions.width',
    'packages[0].dimensions.height',
    'packages[0].lengthUnit',
    'packages[0].declaredValue',
    'packages[0].insurance',
    'shipment.carrier',
    'shipment.service',
    'shipment.type',
    'settings.printFormat',
    'settings.printSize',
    'settings.printType'
  ]

  return requiredFields.filter((path) => {
    const value = getNestedRequiredField(payload, path)
    if (value === null || value === undefined) return true
    if (typeof value === 'string') return !value.trim()
    return false
  })
}

function assertQuoteSnapshotMatches(
  shipment: Record<string, unknown> | null,
  currentRequestPayload: Record<string, unknown>,
  selectedQuotePayload: ShipmentSelectedQuotePayload | null | undefined,
  mode: ShipmentQuoteMode
): { selectedQuote: NormalizedQuote } {
  const quoteSnapshot = parseQuoteSnapshot(shipment?.envia_response)
  if (!quoteSnapshot) {
    throw new HttpError('Debes cotizar el envio antes de aprobar.', 409, 'requote_required')
  }

  if (quoteSnapshot.mode !== mode) {
    throw new HttpError(
      'La cotizacion guardada pertenece a otro metodo. Vuelve a cotizar antes de aprobar.',
      409,
      'requote_required'
    )
  }

  const storedRequest = quoteSnapshot.request || toObjectRecord(shipment?.envia_request)
  if (!storedRequest || stableStringify(storedRequest) !== stableStringify(currentRequestPayload)) {
    throw new HttpError(
      'Cambiaste datos del paquete. Vuelve a cotizar antes de aprobar.',
      409,
      'requote_required'
    )
  }

  if (!normalizeQuoteCandidate(selectedQuotePayload)) {
    throw new HttpError(
      'Debes seleccionar una cotizacion valida antes de aprobar.',
      400,
      'selected_quote_required'
    )
  }

  const selectedQuote = findMatchingQuote(quoteSnapshot.quotes, selectedQuotePayload)
  if (!selectedQuote) {
    throw new HttpError(
      'La cotizacion elegida ya no coincide con la ultima cotizacion guardada. Vuelve a cotizar.',
      409,
      'requote_required'
    )
  }

  return { selectedQuote }
}

async function buildQuoteRequestPayload(
  env: Env,
  order: Record<string, unknown>,
  parcel: Record<string, unknown>,
  requestedCarrier: string | null = null,
  requestedService: string | null = null
): Promise<Record<string, unknown>> {
  const origin = await getOriginAddress(env)
  const destination = await getOrderShippingDestination(env, order)
  if (!origin || !destination) {
    throw new Error('Configuracion de origen o direccion destino incompleta para cotizar.')
  }

  const missingAddressFields = [
    ...listMissingShipmentAddressFields(origin, 'origen'),
    ...listMissingShipmentAddressFields(destination, 'destino')
  ]
  if (missingAddressFields.length > 0) {
    throw new Error(
      `Configuracion de origen o direccion destino incompleta para cotizar. Faltan: ${missingAddressFields.join(', ')}.`
    )
  }

  const carrier = cleanText(requestedCarrier)
  const service = carrier ? cleanText(requestedService) : null
  const boxes = resolveShipmentBoxes(parcel)

  return compactObject({
    origin: buildAddressPayload(origin),
    destination: buildAddressPayload(destination),
    packages: boxes.map((box) => buildPackagePayload(box)),
    box_plan: toObjectRecord(parcel.box_plan),
    shipment:
      carrier || service
        ? {
            carrier,
            service
          }
        : undefined
  }) as Record<string, unknown>
}

function buildProviderQuotePayloads(
  requestPayload: Record<string, unknown>,
  requestedCarrier: string | null = null,
  requestedService: string | null = null
): Record<string, unknown>[] {
  const combinedPayload = buildCombinedQuotePayload(
    requestPayload,
    requestedCarrier,
    requestedService
  )
  const packages = Array.isArray(combinedPayload.packages) ? combinedPayload.packages : []

  return packages.map(
    (pkg) =>
      ({
        ...combinedPayload,
        packages: [pkg]
      }) as Record<string, unknown>
  )
}

function buildCombinedQuotePayload(
  requestPayload: Record<string, unknown>,
  requestedCarrier: string | null = null,
  requestedService: string | null = null
): Record<string, unknown> {
  const shipmentRecord = toObjectRecord(requestPayload.shipment)
  const carrier = cleanText(requestedCarrier) || cleanText(shipmentRecord?.carrier)
  const service =
    carrier && (cleanText(requestedService) || cleanText(shipmentRecord?.service))
      ? cleanText(requestedService) || cleanText(shipmentRecord?.service)
      : null

  return compactObject({
    origin: requestPayload.origin,
    destination: requestPayload.destination,
    packages: Array.isArray(requestPayload.packages) ? requestPayload.packages : [],
    shipment:
      carrier || service
        ? {
            carrier,
            service
          }
        : undefined
  }) as Record<string, unknown>
}

function aggregateBoxQuoteCollections(
  collections: Array<{ quotes: NormalizedQuote[] }>
): NormalizedQuote[] {
  if (!collections.length) return []
  if (collections.some((collection) => collection.quotes.length === 0)) return []

  const totals = new Map<
    string,
    {
      carrier: string
      service: string
      amount_cents: number
      currency: string
      estimated_days: number | null
      raws: unknown[]
      matchedBoxes: number
    }
  >()

  collections[0].quotes.forEach((quote) => {
    totals.set(`${quote.carrier}::${quote.service}`, {
      carrier: quote.carrier,
      service: quote.service,
      amount_cents: quote.amount_cents,
      currency: quote.currency,
      estimated_days: quote.estimated_days,
      raws: [quote.raw],
      matchedBoxes: 1
    })
  })

  for (let boxIndex = 1; boxIndex < collections.length; boxIndex += 1) {
    const currentMap = new Map<string, NormalizedQuote>(
      collections[boxIndex].quotes.map(
        (quote) => [`${quote.carrier}::${quote.service}`, quote] as const
      )
    )
    for (const [key, current] of [...totals.entries()]) {
      const nextQuote = currentMap.get(key)
      if (!nextQuote || nextQuote.currency.toUpperCase() !== current.currency.toUpperCase()) {
        totals.delete(key)
        continue
      }
      current.amount_cents += nextQuote.amount_cents
      current.estimated_days =
        current.estimated_days == null
          ? nextQuote.estimated_days
          : nextQuote.estimated_days == null
            ? current.estimated_days
            : Math.max(current.estimated_days, nextQuote.estimated_days)
      current.raws.push(nextQuote.raw)
      current.matchedBoxes += 1
    }
  }

  return [...totals.values()]
    .filter((quote) => quote.matchedBoxes === collections.length)
    .map((quote) => ({
      carrier: quote.carrier,
      service: quote.service,
      amount_cents: quote.amount_cents,
      currency: quote.currency,
      estimated_days: quote.estimated_days,
      raw: {
        boxes: quote.raws
      }
    }))
    .sort((left, right) => left.amount_cents - right.amount_cents)
}

async function quoteSplitShipments(
  env: Env,
  providerPayloads: Record<string, unknown>[]
): Promise<{ payload: Record<string, unknown>; quotes: NormalizedQuote[] }> {
  const boxResults = await Promise.all(
    providerPayloads.map(async (providerPayload, index) => {
      try {
        const response = await quoteShipment(env, providerPayload)
        return {
          box_index: index + 1,
          ok: true,
          payload: response.payload,
          quotes: response.quotes,
          error: null
        }
      } catch (error) {
        return {
          box_index: index + 1,
          ok: false,
          payload: error instanceof EnviaRequestError ? error.payload : null,
          quotes: [] as NormalizedQuote[],
          error: getErrorMessage(error)
        }
      }
    })
  )

  return {
    payload: {
      requests: providerPayloads,
      boxes: boxResults.map((result) => ({
        box_index: result.box_index,
        ok: result.ok,
        error: result.error,
        payload: result.payload
      }))
    },
    quotes: aggregateBoxQuoteCollections(boxResults)
  }
}

async function quoteShipmentWithBoxFallback(
  env: Env,
  requestPayload: Record<string, unknown>,
  providerPayloads: Record<string, unknown>[]
): Promise<{ payload: unknown; quotes: NormalizedQuote[] }> {
  try {
    const combinedResult = await quoteShipment(env, requestPayload)
    if (combinedResult.quotes.length > 0 || providerPayloads.length <= 1) {
      return combinedResult
    }

    const splitResult = await quoteSplitShipments(env, providerPayloads)
    if (splitResult.quotes.length > 0) {
      return {
        payload: {
          strategy: 'split_fallback',
          combined_payload: combinedResult.payload,
          split_payload: splitResult.payload
        },
        quotes: splitResult.quotes
      }
    }

    return {
      payload: {
        strategy: 'combined_then_split',
        combined_payload: combinedResult.payload,
        split_payload: splitResult.payload
      },
      quotes: []
    }
  } catch (error) {
    if (providerPayloads.length <= 1) {
      throw error
    }

    const splitResult = await quoteSplitShipments(env, providerPayloads)
    if (splitResult.quotes.length > 0) {
      return {
        payload: {
          strategy: 'split_after_combined_error',
          combined_error: getErrorMessage(error),
          combined_error_payload: error instanceof EnviaRequestError ? error.payload : null,
          split_payload: splitResult.payload
        },
        quotes: splitResult.quotes
      }
    }

    throw error
  }
}

async function buildLabelRequestPayloads(
  env: Env,
  order: Record<string, unknown>,
  parcel: Record<string, unknown>,
  quote: NormalizedQuote
): Promise<{
  requests: Record<string, unknown>[]
  settingsSource: LabelSettingsSource
  shipmentTypeApplied: number
  missingFields: string[]
  boxPlan: Record<string, unknown> | null
}> {
  const origin = await getOriginAddress(env)
  const destination = await getOrderShippingDestination(env, order)
  if (!origin || !destination) {
    throw new Error('Configuracion de origen o direccion destino incompleta para generar la guia.')
  }

  const settingsResolution = await resolveLabelSettings(env, quote.carrier)
  const boxes = resolveShipmentBoxes(parcel)
  const requests = boxes.map(
    (box) =>
      compactObject({
        origin: buildLabelAddressPayload(origin),
        destination: buildLabelAddressPayload(destination),
        packages: [buildLabelPackagePayload(box)],
        shipment: {
          carrier: quote.carrier,
          service: quote.service,
          type: ENVIA_LABEL_SHIPMENT_TYPE
        },
        settings: settingsResolution.settings
      }) as Record<string, unknown>
  )

  return {
    requests,
    settingsSource: settingsResolution.source,
    shipmentTypeApplied: ENVIA_LABEL_SHIPMENT_TYPE,
    missingFields: requests.flatMap((payload, index) =>
      listMissingLabelPayloadFields(payload).map((field) => `requests[${index}].${field}`)
    ),
    boxPlan: toObjectRecord(parcel.box_plan)
  }
}

function buildTrackingRequestPayload(shipment: Record<string, unknown>): Record<string, unknown> {
  const tracking_number = cleanText(shipment.tracking_number)
  const carrier = cleanText(shipment.carrier)
  if (!tracking_number) {
    throw new Error('No hay tracking_number para sincronizar este envio.')
  }

  return {
    tracking_number,
    trackingNumber: tracking_number,
    guide_number: tracking_number,
    guideNumber: tracking_number,
    carrier,
    carrier_name: carrier
  }
}

async function upsertShipmentRow(
  env: Env,
  orderId: string,
  values: Record<string, unknown>
): Promise<void> {
  await ensureOrderShipmentsSchema(env, 'upsert-shipment-row')

  const allowedKeys = [
    'provider',
    'mode',
    'approval_status',
    'shipment_status',
    'carrier',
    'service',
    'tracking_number',
    'tracking_url',
    'envia_shipment_id',
    'label_r2_key',
    'quote_amount_cents',
    'currency',
    'parcel_json',
    'address_validation_json',
    'envia_request_json',
    'envia_response_json',
    'approved_at',
    'rejected_at',
    'rejected_reason',
    'last_sync_at',
    'last_error',
    'last_error_code',
    'tracking_sync_paused_at',
    'tracking_sync_pause_reason'
  ]

  const clauses: string[] = []
  const bindValues: unknown[] = []
  for (const key of allowedKeys) {
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      clauses.push(`${key} = ?`)
      bindValues.push(values[key])
    }
  }

  if (clauses.length === 0) return

  const existing = await fetchShipmentRow(env, orderId)
  if (!existing) {
    await env.DB.prepare(
      `
        INSERT INTO order_shipments (
          order_id,
          provider,
          mode,
          approval_status,
          shipment_status,
          currency,
          created_at,
          updated_at
        ) VALUES (?, 'envia', ?, 'pending', 'pending', 'MXN', datetime('now'), datetime('now'))
      `
    )
      .bind(
        orderId,
        String(env.ENVIA_MODE || 'test')
          .trim()
          .toLowerCase() === 'prod'
          ? 'prod'
          : 'test'
      )
      .run()
  }

  await env.DB.prepare(
    `
      UPDATE order_shipments
      SET ${clauses.join(', ')}, updated_at = datetime('now')
      WHERE order_id = ?
    `
  )
    .bind(...bindValues, orderId)
    .run()
}

async function updateOrderShippingStatus(
  env: Env,
  orderId: string,
  shippingStatus: ShippingStatus
): Promise<void> {
  await env.DB.prepare(
    `
      UPDATE orders
      SET shipping_status = ?, updated_at = datetime('now')
      WHERE id = ?
    `
  )
    .bind(shippingStatus, orderId)
    .run()
}

function decodeBase64ToBytes(value: string): Uint8Array {
  const normalized = String(value || '').trim()
  const binary = atob(normalized)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function sanitizeShipmentLabelPart(value: string | null, fallback: string): string {
  const cleaned = String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
  return cleaned || fallback
}

async function storeShipmentLabel(
  env: Env,
  orderId: string,
  shipment: NormalizedShipmentResult,
  guideIndex: number
): Promise<string | null> {
  const trackingPart = sanitizeShipmentLabelPart(shipment.tracking_number, `guide-${guideIndex}`)
  const key = `labels/${sanitizeShipmentLabelPart(orderId, 'pedido')}/${String(guideIndex).padStart(2, '0')}-${trackingPart}.pdf`

  if (shipment.label_base64) {
    const bytes = decodeBase64ToBytes(shipment.label_base64)
    await env.ASSETS_BUCKET.put(key, bytes, {
      httpMetadata: { contentType: 'application/pdf' }
    })
    return key
  }

  if (shipment.label_url) {
    const buffer = await downloadLabelBinary(env, shipment.label_url)
    await env.ASSETS_BUCKET.put(key, buffer, {
      httpMetadata: { contentType: 'application/pdf' }
    })
    return key
  }

  return null
}

async function replaceShipmentGuides(
  env: Env,
  orderId: string,
  guides: Array<Record<string, unknown>>
): Promise<void> {
  await ensureOrderShipmentsSchema(env, 'replace-shipment-guides')
  const statements: D1PreparedStatement[] = [
    env.DB.prepare('DELETE FROM order_shipment_guides WHERE order_id = ?').bind(orderId)
  ]

  guides.forEach((guide, index) => {
    statements.push(
      env.DB.prepare(
        `
          INSERT INTO order_shipment_guides (
            order_id,
            guide_index,
            carrier,
            service,
            tracking_number,
            tracking_url,
            envia_shipment_id,
            label_r2_key,
            parcel_json,
            envia_request_json,
            envia_response_json,
            shipment_status,
            last_error
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      ).bind(
        orderId,
        Number(guide.guide_index || index + 1),
        cleanText(guide.carrier),
        cleanText(guide.service),
        cleanText(guide.tracking_number),
        cleanText(guide.tracking_url),
        cleanText(guide.envia_shipment_id),
        cleanText(guide.label_r2_key),
        safeStringify(guide.parcel),
        safeStringify(guide.envia_request),
        safeStringify(guide.envia_response),
        cleanText(guide.shipment_status) || 'pending',
        cleanText(guide.last_error)
      )
    )
  })

  await env.DB.batch(statements)
}

function summarizeShipmentStatusFromGuides(
  guides: Array<{ shipment_status: string | null | undefined }>
): ShippingStatus {
  const statuses = guides.map((guide) => normalizeWorkerShippingStatus(guide.shipment_status))
  if (!statuses.length) return 'pending'
  if (statuses.every((status) => status === 'delivered')) return 'delivered'
  if (statuses.includes('lost')) return 'lost'
  if (statuses.every((status) => status === 'cancelled')) return 'cancelled'
  if (statuses.includes('cancelled')) return 'partially_cancelled'
  if (statuses.includes('in_transit')) return 'in_transit'
  if (statuses.includes('preparing')) return 'preparing'
  return 'pending'
}

function summarizeShipmentHeaderFromGuides(guides: Array<Record<string, unknown>>): {
  shipment_status: ShippingStatus
  tracking_number: string | null
  tracking_url: string | null
  carrier: string | null
  service: string | null
  envia_shipment_id: string | null
  label_r2_key: string | null
} {
  const firstGuide = guides[0] || {}
  return {
    shipment_status: summarizeShipmentStatusFromGuides(
      guides.map((guide) => ({
        shipment_status: cleanText(guide.shipment_status)
      }))
    ),
    tracking_number: cleanText(firstGuide.tracking_number),
    tracking_url: cleanText(firstGuide.tracking_url),
    carrier: cleanText(firstGuide.carrier),
    service: cleanText(firstGuide.service),
    envia_shipment_id: cleanText(firstGuide.envia_shipment_id),
    label_r2_key: cleanText(firstGuide.label_r2_key)
  }
}

async function pauseTrackingSyncForShipment(
  env: Env,
  orderId: string,
  reason: string
): Promise<void> {
  await upsertShipmentRow(env, orderId, {
    tracking_sync_paused_at: new Date().toISOString(),
    tracking_sync_pause_reason: reason,
    last_sync_at: new Date().toISOString(),
    last_error: `Sync programado pausado: ${reason}`,
    last_error_code: SHIPMENT_ERROR_CODE_TRACKING_FORBIDDEN
  })
}

function resolveRemoteCancelableStatus(
  remoteShipment: NormalizedRemoteShipment | null,
  fallbackStatus: ShippingStatus
): boolean {
  if (remoteShipment?.cancelable != null) return remoteShipment.cancelable
  return fallbackStatus === 'pending' || fallbackStatus === 'preparing'
}

function buildRemoteRefreshGuideResponse(
  remoteShipment: NormalizedRemoteShipment | null,
  tracking: ReturnType<typeof normalizeTrackingResult> | null,
  checkedAt: string,
  remoteCancelable: boolean
): Record<string, unknown> {
  return compactObject({
    kind: 'remote_refresh',
    remote_checked_at: checkedAt,
    remote_cancelable: remoteCancelable,
    remote_status_text: cleanText(remoteShipment?.status_text) || cleanText(tracking?.status),
    remote_detail: remoteShipment,
    tracking
  }) as Record<string, unknown>
}

function buildCancelShipmentPayload(
  guide: Record<string, unknown>,
  remoteShipment: NormalizedRemoteShipment | null
): Record<string, unknown> {
  const shipmentId = cleanText(remoteShipment?.shipment_id) || cleanText(guide.envia_shipment_id)
  const trackingNumber =
    cleanText(remoteShipment?.tracking_number) || cleanText(guide.tracking_number)
  const carrier = cleanText(remoteShipment?.carrier) || cleanText(guide.carrier)

  return compactObject({
    id: shipmentId,
    shipment_id: shipmentId,
    shipmentId: shipmentId,
    tracking_number: trackingNumber,
    trackingNumber: trackingNumber,
    guide_number: trackingNumber,
    guideNumber: trackingNumber,
    carrier,
    carrier_name: carrier
  }) as Record<string, unknown>
}

async function refreshOrderShipmentFromRemote(
  env: Env,
  orderId: string,
  source: 'admin' | 'detail_open' | 'cancel'
): Promise<Record<string, unknown>> {
  const order = await fetchOrderDetail(env, orderId)
  if (!order) {
    throw new Error('Pedido no encontrado.')
  }

  const shipment = toObjectRecord(order.shipment)
  if (!shipment) {
    throw new Error('El pedido no tiene registro de envio.')
  }

  const guideRecords = Array.isArray(shipment.guides)
    ? shipment.guides.map((guide) => toObjectRecord(guide)).filter(Boolean)
    : []
  const guidesToSync =
    guideRecords.length > 0 ? (guideRecords as Record<string, unknown>[]) : [shipment]
  const checkedAt = new Date().toISOString()
  const refreshedGuides: Array<Record<string, unknown>> = []

  for (const guide of guidesToSync) {
    const guideIndex = Number(guide.guide_index || refreshedGuides.length + 1)
    const trackingNumber = cleanText(guide.tracking_number)
    const shipmentId = cleanText(guide.envia_shipment_id)

    let remoteShipment: NormalizedRemoteShipment | null = null
    let trackingResult: ReturnType<typeof normalizeTrackingResult> | null = null
    let remoteLookupError: unknown = null

    try {
      remoteShipment = await getRemoteShipment(env, {
        shipmentId,
        trackingNumber,
        carrier: cleanText(guide.carrier)
      })
    } catch (error) {
      remoteLookupError = error
    }

    if (trackingNumber) {
      try {
        trackingResult = await trackShipment(env, buildTrackingRequestPayload(guide))
      } catch (error) {
        if (!remoteShipment) {
          throw error
        }
      }
    } else if (!remoteShipment && remoteLookupError) {
      throw remoteLookupError
    }

    const nextStatus = normalizeWorkerShippingStatus(
      trackingResult?.status || remoteShipment?.status || guide.shipment_status
    )
    const remoteCancelable = resolveRemoteCancelableStatus(remoteShipment, nextStatus)
    let labelKey = cleanText(guide.label_r2_key)
    if (remoteShipment?.label_url || remoteShipment?.label_base64) {
      labelKey =
        (await storeShipmentLabel(
          env,
          orderId,
          {
            shipment_id: remoteShipment.shipment_id,
            tracking_number: remoteShipment.tracking_number,
            tracking_url: remoteShipment.tracking_url,
            label_url: remoteShipment.label_url,
            label_base64: remoteShipment.label_base64,
            carrier: remoteShipment.carrier,
            service: remoteShipment.service,
            status: remoteShipment.status_text,
            raw: remoteShipment.raw
          },
          guideIndex
        )) || labelKey
    }

    refreshedGuides.push({
      guide_index: guideIndex,
      carrier: cleanText(remoteShipment?.carrier) || cleanText(trackingResult?.carrier) || cleanText(guide.carrier),
      service: cleanText(remoteShipment?.service) || cleanText(guide.service),
      tracking_number:
        cleanText(trackingResult?.tracking_number) ||
        cleanText(remoteShipment?.tracking_number) ||
        trackingNumber,
      tracking_url:
        cleanText(trackingResult?.tracking_url) ||
        cleanText(remoteShipment?.tracking_url) ||
        cleanText(guide.tracking_url),
      envia_shipment_id: cleanText(remoteShipment?.shipment_id) || shipmentId,
      label_r2_key: labelKey,
      parcel: toObjectRecord(guide.parcel) || safeParseJson(String(guide.parcel_json || '')),
      envia_request: guide.envia_request ?? safeParseJson(String(guide.envia_request_json || '')),
      envia_response: buildRemoteRefreshGuideResponse(
        remoteShipment,
        trackingResult,
        checkedAt,
        remoteCancelable
      ),
      shipment_status: nextStatus,
      last_error: null
    })
  }

  await replaceShipmentGuides(env, orderId, refreshedGuides)
  const summary = summarizeShipmentHeaderFromGuides(refreshedGuides)
  await upsertShipmentRow(env, orderId, {
    shipment_status: summary.shipment_status,
    tracking_url: summary.tracking_url || cleanText(shipment.tracking_url),
    tracking_number: summary.tracking_number || cleanText(shipment.tracking_number),
    carrier: summary.carrier || cleanText(shipment.carrier),
    service: summary.service || cleanText(shipment.service),
    envia_shipment_id: summary.envia_shipment_id || cleanText(shipment.envia_shipment_id),
    label_r2_key: summary.label_r2_key || cleanText(shipment.label_r2_key),
    envia_response_json: safeStringify({
      kind: 'remote_refresh_summary',
      remote_checked_at: checkedAt,
      guides: refreshedGuides.map((guide) => guide.envia_response)
    }),
    last_sync_at: checkedAt,
    last_error: null,
    last_error_code: null,
    tracking_sync_paused_at: null,
    tracking_sync_pause_reason: null
  })
  await updateOrderShippingStatus(env, orderId, summary.shipment_status)
  if (source !== 'detail_open') {
    await insertShipmentEvent(env, orderId, 'remote_refreshed', source, {
      guide_count: refreshedGuides.length,
      guides: refreshedGuides,
      remote_checked_at: checkedAt
    })
  }

  const refreshed = await fetchOrderDetail(env, orderId)
  return { success: true, order: refreshed }
}

async function cancelOrderShipmentGuide(
  env: Env,
  orderId: string,
  guideIndex: number,
  source: 'admin'
): Promise<Record<string, unknown>> {
  const order = await fetchOrderDetail(env, orderId)
  if (!order) {
    throw new Error('Pedido no encontrado.')
  }

  const shipment = toObjectRecord(order.shipment)
  if (!shipment) {
    throw new Error('El pedido no tiene registro de envio.')
  }

  const guideRecords = Array.isArray(shipment.guides)
    ? shipment.guides.map((guide) => toObjectRecord(guide)).filter(Boolean)
    : []
  const targetGuide = guideRecords.find((guide) => Number(guide?.guide_index || 0) === guideIndex)
  if (!targetGuide) {
    throw new HttpError('Guia no encontrada.', 404, 'shipment_guide_not_found')
  }

  const remoteShipment = await getRemoteShipment(env, {
    shipmentId: cleanText(targetGuide.envia_shipment_id),
    trackingNumber: cleanText(targetGuide.tracking_number),
    carrier: cleanText(targetGuide.carrier)
  }).catch(() => null)
  const currentStatus = normalizeWorkerShippingStatus(
    remoteShipment?.status || targetGuide.shipment_status
  )
  const remoteCancelable = resolveRemoteCancelableStatus(remoteShipment, currentStatus)
  if (!remoteCancelable) {
    throw new HttpError(
      'Envia no confirma que esta guia siga siendo cancelable.',
      409,
      'shipment_not_cancelable'
    )
  }

  const cancelPayload = buildCancelShipmentPayload(targetGuide, remoteShipment)
  if (!cleanText(cancelPayload.shipment_id) && !cleanText(cancelPayload.tracking_number)) {
    throw new HttpError(
      'No hay identificadores suficientes para cancelar la guia.',
      409,
      'shipment_identifiers_missing'
    )
  }

  const cancelResult = await cancelShipment(env, cancelPayload)
  await insertShipmentEvent(env, orderId, 'guide_cancel_requested', source, {
    guide_index: guideIndex,
    payload: cancelPayload,
    provider_payload: cancelResult.payload
  })

  const refreshResult = await refreshOrderShipmentFromRemote(env, orderId, 'cancel').catch(async () => {
    const nextGuides = guideRecords.map((guide) =>
      Number(guide?.guide_index || 0) === guideIndex
        ? {
            ...guide,
            shipment_status: 'cancelled',
            envia_response: {
              kind: 'cancelled_locally_after_provider_ack',
              remote_checked_at: new Date().toISOString(),
              provider_payload: cancelResult.payload,
              remote_cancelable: false
            },
            last_error: null
          }
        : guide
    )
    await replaceShipmentGuides(env, orderId, nextGuides as Array<Record<string, unknown>>)
    const summary = summarizeShipmentHeaderFromGuides(nextGuides as Array<Record<string, unknown>>)
    await upsertShipmentRow(env, orderId, {
      shipment_status: summary.shipment_status,
      envia_response_json: safeStringify({
        kind: 'cancel_fallback',
        provider_payload: cancelResult.payload
      }),
      last_sync_at: new Date().toISOString(),
      last_error: null,
      last_error_code: null
    })
    await updateOrderShippingStatus(env, orderId, summary.shipment_status)
    const refreshed = await fetchOrderDetail(env, orderId)
    return { success: true, order: refreshed }
  })

  await insertShipmentEvent(env, orderId, 'guide_cancelled', source, {
    guide_index: guideIndex,
    provider_payload: cancelResult.payload
  })
  return refreshResult
}

async function handleGetOrderById(
  request: Request,
  env: Env,
  requestId: string,
  orderId: string
): Promise<Response> {
  workerLog(requestId, 'orders:get:start', { orderId })
  try {
    await ensureOrdersAdminSchema(env, requestId)
    const order = await fetchOrderDetail(env, orderId)
    if (!order) {
      return json(request, env, { success: false, error: 'Pedido no encontrado.' }, 404)
    }
    workerLog(requestId, 'orders:get:ok', { orderId })
    return json(request, env, { success: true, order })
  } catch (error) {
    workerError(requestId, 'orders:get:error', error)
    return json(
      request,
      env,
      { success: false, error: `Error obteniendo pedido: ${getErrorMessage(error)}` },
      500
    )
  }
}

async function handlePatchOrderById(
  request: Request,
  env: Env,
  requestId: string,
  orderId: string
): Promise<Response> {
  workerLog(requestId, 'orders:patch:start', { orderId })
  try {
    await ensureOrdersAdminSchema(env, requestId)

    const authResult = assertAdminToken(request, env)
    if (!authResult.ok) {
      return json(request, env, { success: false, error: authResult.error }, authResult.status)
    }

    const payload = (await request.json()) as OrderUpdatePayload
    if (!payload || typeof payload !== 'object') {
      return json(request, env, { success: false, error: 'Payload invalido.' }, 400)
    }

    const allowed = new Set([
      'shipping_status',
      'customer_name',
      'customer_email',
      'customer_phone',
      'shipping_address_json',
      'internal_note'
    ])
    const keys = Object.keys(payload)
    const unknown = keys.filter((key) => !allowed.has(key))
    if (unknown.length > 0) {
      return json(
        request,
        env,
        { success: false, error: `Campos no permitidos: ${unknown.join(', ')}` },
        400
      )
    }
    if (keys.length === 0) {
      return json(
        request,
        env,
        { success: false, error: 'No se enviaron campos para actualizar.' },
        400
      )
    }

    const clauses: string[] = []
    const values: unknown[] = []

    if (payload.shipping_status !== undefined) {
      const shippingStatus = normalizeShippingStatus(payload.shipping_status)
      if (!shippingStatus) {
        return json(
          request,
          env,
          {
            success: false,
            error: `shipping_status invalido. Valores: ${SHIPPING_STATUS_VALUES.join(', ')}`
          },
          400
        )
      }
      clauses.push('shipping_status = ?')
      values.push(shippingStatus)
    }

    if (payload.customer_name !== undefined) {
      const value =
        payload.customer_name === null ? null : String(payload.customer_name || '').trim() || null
      clauses.push('customer_name = ?')
      values.push(value)
    }

    if (payload.customer_email !== undefined) {
      const value = String(payload.customer_email || '')
        .trim()
        .toLowerCase()
      if (!value || !value.includes('@')) {
        return json(request, env, { success: false, error: 'customer_email invalido.' }, 400)
      }
      clauses.push('customer_email = ?')
      values.push(value)
    }

    if (payload.customer_phone !== undefined) {
      const value =
        payload.customer_phone === null ? null : String(payload.customer_phone || '').trim() || null
      clauses.push('customer_phone = ?')
      values.push(value)
    }

    if (payload.shipping_address_json !== undefined) {
      if (payload.shipping_address_json === null) {
        clauses.push('shipping_address_json = ?')
        values.push(null)
      } else if (typeof payload.shipping_address_json === 'string') {
        try {
          const parsed = JSON.parse(payload.shipping_address_json)
          clauses.push('shipping_address_json = ?')
          values.push(JSON.stringify(parsed))
        } catch {
          return json(
            request,
            env,
            { success: false, error: 'shipping_address_json no es JSON valido.' },
            400
          )
        }
      } else if (typeof payload.shipping_address_json === 'object') {
        clauses.push('shipping_address_json = ?')
        values.push(JSON.stringify(payload.shipping_address_json))
      } else {
        return json(request, env, { success: false, error: 'shipping_address_json invalido.' }, 400)
      }
    }

    if (payload.internal_note !== undefined) {
      const value = payload.internal_note === null ? null : String(payload.internal_note)
      clauses.push('internal_note = ?')
      values.push(value)
    }

    if (clauses.length === 0) {
      return json(request, env, { success: false, error: 'No se enviaron cambios validos.' }, 400)
    }

    const result = await env.DB.prepare(
      `
        UPDATE orders
        SET ${clauses.join(', ')}, updated_at = datetime('now')
        WHERE id = ?
      `
    )
      .bind(...values, orderId)
      .run()

    if (getChangesFromRun(result) === 0) {
      return json(request, env, { success: false, error: 'Pedido no encontrado.' }, 404)
    }

    const order = await fetchOrderDetail(env, orderId)
    workerLog(requestId, 'orders:patch:ok', { orderId, updatedFields: clauses.length })
    return json(request, env, { success: true, order })
  } catch (error) {
    workerError(requestId, 'orders:patch:error', error)
    return json(
      request,
      env,
      { success: false, error: `Error actualizando pedido: ${getErrorMessage(error)}` },
      500
    )
  }
}

function selectQuote(
  quotes: NormalizedQuote[],
  payload: ShipmentQuotePayload | null | undefined,
  mode: ShipmentQuoteMode
): NormalizedQuote | null {
  if (!quotes.length) return null
  if (mode === 'auto') return quotes[0]

  const filters = normalizeRequestedShipmentFilters(payload)
  const requestedCarrier = filters.carrier?.toLowerCase() || null
  const requestedService = filters.service?.toLowerCase() || null
  if (!requestedCarrier) return null

  const carrierQuotes = quotes.filter((quote) => quote.carrier.toLowerCase() === requestedCarrier)
  if (!carrierQuotes.length) return null

  if (!requestedService) return carrierQuotes[0]

  return carrierQuotes.find((quote) => quote.service.toLowerCase() === requestedService) || null
}

async function quoteOrderShipment(
  env: Env,
  orderId: string,
  payload: ShipmentQuotePayload | null | undefined,
  mode: ShipmentQuoteMode
): Promise<Record<string, unknown>> {
  const order = await fetchOrderDetail(env, orderId)
  if (!order) {
    throw new Error('Pedido no encontrado.')
  }

  if (String(order.status || '') === 'unpaid') {
    throw new Error('El pedido aun no esta pagado.')
  }

  const currentShipment = toObjectRecord(order.shipment)
  const parcelResult = normalizeParcelInput(
    env,
    payload,
    currentShipment,
    Number(order.total_amount_cents || 0),
    Number(toObjectRecord(order.summary)?.units_total || 1)
  )
  if (!parcelResult.ok) {
    throw new Error(parcelResult.error)
  }

  const filters = normalizeRequestedShipmentFilters(payload)
  const requestedCarrier = mode === 'manual' ? filters.carrier : null
  const requestedService = mode === 'manual' ? filters.service : null
  if (mode === 'auto' && (filters.carrier || filters.service)) {
    throw new HttpError(
      'El modo automatico no acepta carrier o servicio manual.',
      400,
      'quote_mode_invalid'
    )
  }
  if (mode === 'manual' && !requestedCarrier) {
    throw new HttpError(
      'Selecciona un carrier antes de cotizar en modo manual.',
      400,
      'carrier_required'
    )
  }
  await clearShipmentQuoteState(env, orderId, parcelResult.parcel)

  const requestPayload = await buildQuoteRequestPayload(
    env,
    order,
    parcelResult.parcel,
    requestedCarrier,
    requestedService
  )
  const providerQuotePayloads = buildProviderQuotePayloads(
    requestPayload,
    requestedCarrier,
    requestedService
  )

  let quoteResult: { payload: unknown; quotes: NormalizedQuote[] } = {
    payload: null,
    quotes: []
  }
  let aggregatedQuotes: NormalizedQuote[] = []
  let attemptedCarriers: string[] = requestedCarrier ? [requestedCarrier] : []
  if (mode === 'manual') {
    try {
      quoteResult = await quoteShipmentWithBoxFallback(env, requestPayload, providerQuotePayloads)
      aggregatedQuotes = [...quoteResult.quotes]
    } catch (error) {
      quoteResult = {
        payload: error instanceof EnviaRequestError ? error.payload : null,
        quotes: []
      }
      const message = getErrorMessage(error)
      await upsertShipmentRow(env, orderId, {
        parcel_json: safeStringify(parcelResult.parcel),
        envia_request_json: safeStringify(requestPayload),
        envia_response_json:
          error instanceof EnviaRequestError ? safeStringify(error.payload) : null,
        last_error: message
      })
      await insertShipmentEvent(env, orderId, 'quote_failed', 'admin', {
        requested_carrier: requestedCarrier,
        requested_service: requestedService,
        mode,
        error: message,
        payload: error instanceof EnviaRequestError ? error.payload : null
      })
      throw error
    }
  } else {
    const destination = await getOrderShippingDestination(env, order)
    const destinationCountry = cleanText(destination?.country) || 'MX'
    const discoveredCarriers = await listAvailableCarriers(env, destinationCountry).catch(
      () => [] as string[]
    )
    attemptedCarriers = discoveredCarriers

    if (discoveredCarriers.length === 0) {
      try {
        quoteResult = await quoteShipmentWithBoxFallback(env, requestPayload, providerQuotePayloads)
        aggregatedQuotes = [...quoteResult.quotes]
      } catch (error) {
        quoteResult = {
          payload: error instanceof EnviaRequestError ? error.payload : null,
          quotes: []
        }
      }
    } else {
      const quoteMap = new Map<string, NormalizedQuote>()
      const providerPayloads: unknown[] = []
      let carrierIndex = 0
      const concurrency = Math.min(4, discoveredCarriers.length)

      await Promise.all(
        Array.from({ length: concurrency }, async () => {
          while (carrierIndex < discoveredCarriers.length) {
            const nextIndex = carrierIndex++
            const carrierName = discoveredCarriers[nextIndex]
            if (!carrierName) return

            const carrierRequestPayload = buildCombinedQuotePayload(
              requestPayload,
              carrierName,
              null
            )
            const carrierPayloads = buildProviderQuotePayloads(requestPayload, carrierName, null)
            try {
              const perCarrierResult = await quoteShipmentWithBoxFallback(
                env,
                carrierRequestPayload,
                carrierPayloads
              )
              providerPayloads.push({
                carrier: carrierName,
                payload: perCarrierResult.payload
              })
              for (const quote of perCarrierResult.quotes) {
                quoteMap.set(`${quote.carrier}::${quote.service}`, quote)
              }
            } catch (error) {
              providerPayloads.push({
                carrier: carrierName,
                error: getErrorMessage(error),
                payload: error instanceof EnviaRequestError ? error.payload : null
              })
            }
          }
        })
      )

      aggregatedQuotes = [...quoteMap.values()].sort(
        (left, right) => left.amount_cents - right.amount_cents
      )
      quoteResult = {
        payload: {
          carriers: providerPayloads
        },
        quotes: aggregatedQuotes
      }
    }
  }

  if (mode === 'manual' && providerQuotePayloads.length === 1 && aggregatedQuotes.length === 0) {
    const boxPayload = toObjectRecord(quoteResult.payload)
    const firstBox = Array.isArray(boxPayload?.boxes) ? toObjectRecord(boxPayload?.boxes[0]) : null
    const providerPayload = firstBox?.payload
    const providerError = firstBox?.error
    if (providerError || providerPayload) {
      const message = String(providerError || 'Envia no devolvio una cotizacion valida.')
      await upsertShipmentRow(env, orderId, {
        parcel_json: safeStringify(parcelResult.parcel),
        envia_request_json: safeStringify(requestPayload),
        envia_response_json: safeStringify(providerPayload),
        last_error: message
      })
      await insertShipmentEvent(env, orderId, 'quote_failed', 'admin', {
        requested_carrier: requestedCarrier,
        requested_service: requestedService,
        mode,
        error: message,
        payload: providerPayload
      })
      throw new Error(message)
    }
  }

  const selected = selectQuote(aggregatedQuotes, payload, mode)
  if (!selected) {
    const message =
      mode === 'manual' && requestedService
        ? `Envia no devolvio la cotizacion solicitada para ${requestedCarrier}/${requestedService}.`
        : mode === 'manual'
          ? `Envia no devolvio cotizaciones validas para el carrier ${requestedCarrier}.`
          : 'Envia no devolvio cotizaciones validas para este envio.'
    await upsertShipmentRow(env, orderId, {
      parcel_json: safeStringify(parcelResult.parcel),
      envia_request_json: safeStringify(requestPayload),
      envia_response_json: safeStringify(quoteResult.payload),
      last_error: message
    })
    await insertShipmentEvent(env, orderId, 'quote_failed', 'admin', {
      requested_carrier: requestedCarrier,
      requested_service: requestedService,
      mode,
      error: message,
      payload: quoteResult.payload,
      attempted_carriers: attemptedCarriers
    })
    throw new Error(message)
  }

  const quoteSnapshot: ShipmentQuoteSnapshot = {
    kind: 'quote_snapshot',
    mode,
    quoted_at: new Date().toISOString(),
    request: requestPayload,
    selected_quote: selected,
    quotes: aggregatedQuotes,
    attempted_carriers: attemptedCarriers,
    provider_payload: quoteResult.payload
  }

  await upsertShipmentRow(env, orderId, {
    parcel_json: safeStringify(parcelResult.parcel),
    quote_amount_cents: selected.amount_cents,
    currency: selected.currency,
    carrier: selected.carrier,
    service: selected.service,
    envia_request_json: safeStringify(requestPayload),
    envia_response_json: safeStringify(quoteSnapshot),
    last_error: null,
    last_error_code: null
  })
  await updateOrderShippingStatus(
    env,
    orderId,
    currentShipment ? normalizeWorkerShippingStatus(currentShipment.shipment_status) : 'pending'
  )

  await insertShipmentEvent(env, orderId, 'quoted', 'admin', {
    mode,
    selected_quote: selected,
    quotes_count: aggregatedQuotes.length
  })

  const refreshed = await fetchOrderDetail(env, orderId)
  return {
    success: true,
    order: refreshed,
    quotes: aggregatedQuotes,
    selected_quote: selected
  }
}

async function syncOrderShipmentStatus(
  env: Env,
  orderId: string,
  source: 'admin' | 'scheduled' | 'webhook'
): Promise<Record<string, unknown>> {
  const order = await fetchOrderDetail(env, orderId)
  if (!order) {
    throw new Error('Pedido no encontrado.')
  }

  const shipment = toObjectRecord(order.shipment)
  if (!shipment) {
    throw new Error('El pedido no tiene registro de envio.')
  }

  const guideRecords = Array.isArray(shipment.guides)
    ? shipment.guides.map((guide) => toObjectRecord(guide)).filter(Boolean)
    : []
  const guidesToSync =
    guideRecords.length > 0 ? (guideRecords as Record<string, unknown>[]) : [shipment]
  const syncedGuides: Array<Record<string, unknown>> = []

  for (const guide of guidesToSync) {
    try {
      const tracking = await trackShipment(env, buildTrackingRequestPayload(guide))
      syncedGuides.push({
        guide_index: Number(guide.guide_index || syncedGuides.length + 1),
        carrier: tracking.carrier || cleanText(guide.carrier),
        service: cleanText(guide.service),
        tracking_number: tracking.tracking_number || cleanText(guide.tracking_number),
        tracking_url: tracking.tracking_url || cleanText(guide.tracking_url),
        envia_shipment_id: cleanText(guide.envia_shipment_id),
        label_r2_key: cleanText(guide.label_r2_key),
        parcel: toObjectRecord(guide.parcel) || safeParseJson(String(guide.parcel_json || '')),
        envia_request: guide.envia_request ?? safeParseJson(String(guide.envia_request_json || '')),
        envia_response: tracking.raw,
        shipment_status: tracking.status,
        last_error: null
      })
    } catch (error) {
      if (source === 'scheduled' && isTrackingForbiddenError(error)) {
        const reason =
          'Envia tracking devolvio HTTP 403 para este envio. Revisa carrier/cuenta y reintenta manualmente.'
        await pauseTrackingSyncForShipment(env, orderId, reason)
        await insertShipmentEvent(env, orderId, 'sync_paused', source, {
          error: getErrorMessage(error),
          payload: error instanceof EnviaRequestError ? error.payload : null
        })
        const refreshed = await fetchOrderDetail(env, orderId)
        return { success: true, order: refreshed }
      }
      throw error
    }
  }

  await replaceShipmentGuides(env, orderId, syncedGuides)
  const summary = summarizeShipmentHeaderFromGuides(syncedGuides)
  await upsertShipmentRow(env, orderId, {
    shipment_status: summary.shipment_status,
    tracking_url: summary.tracking_url || cleanText(shipment.tracking_url),
    tracking_number: summary.tracking_number || cleanText(shipment.tracking_number),
    carrier: summary.carrier || cleanText(shipment.carrier),
    service: summary.service || cleanText(shipment.service),
    envia_shipment_id: summary.envia_shipment_id || cleanText(shipment.envia_shipment_id),
    label_r2_key: summary.label_r2_key || cleanText(shipment.label_r2_key),
    envia_response_json: safeStringify({
      guides: syncedGuides.map((guide) => guide.envia_response)
    }),
    last_sync_at: new Date().toISOString(),
    last_error: null,
    last_error_code: null,
    tracking_sync_paused_at: null,
    tracking_sync_pause_reason: null
  })
  await updateOrderShippingStatus(env, orderId, summary.shipment_status)
  await insertShipmentEvent(env, orderId, 'synced', source, {
    guide_count: syncedGuides.length,
    guides: syncedGuides
  })

  const refreshed = await fetchOrderDetail(env, orderId)
  return { success: true, order: refreshed }
}

async function handleGetPendingShipments(
  request: Request,
  env: Env,
  requestId: string
): Promise<Response> {
  workerLog(requestId, 'shipments:pending:start')
  try {
    const authResult = assertAdminToken(request, env)
    if (!authResult.ok) {
      return json(request, env, { success: false, error: authResult.error }, authResult.status)
    }

    await ensureOrdersAdminSchema(env, requestId)
    await ensureOrderShipmentsSchema(env, requestId)

    const result = await env.DB.prepare(
      `
        SELECT
          o.id,
          o.created_at,
          o.updated_at,
          o.customer_name,
          o.customer_email,
          o.customer_phone,
          o.total_amount_cents,
          o.currency,
          os.approval_status,
          os.shipment_status,
          os.carrier,
          os.service,
          os.tracking_number,
          os.tracking_url,
          os.label_r2_key,
          os.approved_at,
          os.rejected_at,
          os.rejected_reason,
          os.last_sync_at,
          os.last_error,
          os.last_error_code,
          os.tracking_sync_paused_at,
          os.tracking_sync_pause_reason
        FROM order_shipments os
        INNER JOIN orders o ON o.id = os.order_id
        WHERE o.status <> 'unpaid'
          AND os.approval_status = 'pending'
        ORDER BY datetime(o.created_at) DESC, o.id DESC
      `
    ).all<ShipmentListRow>()

    const shipments = (result.results || []).map((row) => mapShipmentSummary(row, env))
    return json(request, env, { success: true, shipments })
  } catch (error) {
    workerError(requestId, 'shipments:pending:error', error)
    return json(
      request,
      env,
      { success: false, error: `Error obteniendo pendientes: ${getErrorMessage(error)}` },
      500
    )
  }
}

async function handleGetShipmentOptions(
  request: Request,
  env: Env,
  requestId: string
): Promise<Response> {
  workerLog(requestId, 'shipments:options:start')
  try {
    const authResult = assertAdminToken(request, env)
    if (!authResult.ok) {
      return json(request, env, { success: false, error: authResult.error }, authResult.status)
    }

    const url = new URL(request.url)
    const country = cleanText(url.searchParams.get('country')) || 'MX'
    const carrier = cleanText(url.searchParams.get('carrier'))
    const [carriers, services] = await Promise.all([
      listAvailableCarriers(env, country).catch(() => [] as string[]),
      listAvailableServices(env, country, carrier).catch(() => [] as string[])
    ])

    return json(request, env, {
      success: true,
      country,
      carrier: carrier || null,
      carriers,
      services
    })
  } catch (error) {
    workerError(requestId, 'shipments:options:error', error)
    return json(
      request,
      env,
      { success: false, error: `Error cargando opciones de Envia: ${getErrorMessage(error)}` },
      500
    )
  }
}

async function handleGetShipments(
  request: Request,
  env: Env,
  requestId: string
): Promise<Response> {
  workerLog(requestId, 'shipments:list:start')
  try {
    const authResult = assertAdminToken(request, env)
    if (!authResult.ok) {
      return json(request, env, { success: false, error: authResult.error }, authResult.status)
    }

    await ensureOrdersAdminSchema(env, requestId)
    await ensureOrderShipmentsSchema(env, requestId)

    const filters = readShipmentFilters(new URL(request.url))
    const where: string[] = ["os.approval_status = 'approved'"]
    const binds: unknown[] = []
    if (filters.status) {
      where.push('os.shipment_status = ?')
      binds.push(filters.status)
    }

    const result = await env.DB.prepare(
      `
        SELECT
          o.id,
          o.created_at,
          o.updated_at,
          o.customer_name,
          o.customer_email,
          o.customer_phone,
          o.total_amount_cents,
          o.currency,
          os.approval_status,
          os.shipment_status,
          os.carrier,
          os.service,
          os.tracking_number,
          os.tracking_url,
          os.label_r2_key,
          os.approved_at,
          os.rejected_at,
          os.rejected_reason,
          os.last_sync_at,
          os.last_error,
          os.last_error_code,
          os.tracking_sync_paused_at,
          os.tracking_sync_pause_reason
        FROM order_shipments os
        INNER JOIN orders o ON o.id = os.order_id
        WHERE ${where.join(' AND ')}
        ORDER BY datetime(COALESCE(os.approved_at, o.created_at)) DESC, o.id DESC
      `
    )
      .bind(...binds)
      .all<ShipmentListRow>()

    const shipments = (result.results || []).map((row) => mapShipmentSummary(row, env))
    return json(request, env, { success: true, shipments })
  } catch (error) {
    workerError(requestId, 'shipments:list:error', error)
    return json(
      request,
      env,
      { success: false, error: `Error obteniendo envios: ${getErrorMessage(error)}` },
      500
    )
  }
}

async function handleGetShipmentByOrderId(
  request: Request,
  env: Env,
  requestId: string,
  orderId: string
): Promise<Response> {
  workerLog(requestId, 'shipments:get:start', { orderId })
  try {
    const authResult = assertAdminToken(request, env)
    if (!authResult.ok) {
      return json(request, env, { success: false, error: authResult.error }, authResult.status)
    }

    await ensureOrdersAdminSchema(env, requestId)
    await ensureOrderShipmentsSchema(env, requestId)
    const order = await fetchOrderDetail(env, orderId)
    if (!order) {
      return json(request, env, { success: false, error: 'Pedido no encontrado.' }, 404)
    }
    return json(request, env, { success: true, order })
  } catch (error) {
    workerError(requestId, 'shipments:get:error', error)
    return json(
      request,
      env,
      { success: false, error: `Error obteniendo envio: ${getErrorMessage(error)}` },
      500
    )
  }
}

async function handleQuoteShipmentByOrderId(
  request: Request,
  env: Env,
  requestId: string,
  orderId: string,
  mode: ShipmentQuoteMode
): Promise<Response> {
  workerLog(requestId, 'shipments:quote:start', { orderId, mode })
  try {
    const authResult = assertAdminToken(request, env)
    if (!authResult.ok) {
      return json(request, env, { success: false, error: authResult.error }, authResult.status)
    }

    const payload = (await request.json().catch(() => ({}))) as ShipmentQuotePayload
    const response = await quoteOrderShipment(env, orderId, payload, mode)
    return json(request, env, response)
  } catch (error) {
    workerError(requestId, 'shipments:quote:error', error)
    const status = getHttpStatus(error, 500)
    const code = getErrorCode(error)
    return json(
      request,
      env,
      {
        success: false,
        error: `Error cotizando envio: ${getErrorMessage(error)}`,
        ...(code ? { code } : {})
      },
      status
    )
  }
}

async function handleApproveShipmentByOrderId(
  request: Request,
  env: Env,
  requestId: string,
  orderId: string
): Promise<Response> {
  workerLog(requestId, 'shipments:approve:start', { orderId })
  try {
    const authResult = assertAdminToken(request, env)
    if (!authResult.ok) {
      return json(request, env, { success: false, error: authResult.error }, authResult.status)
    }

    const payload = (await request.json().catch(() => ({}))) as ShipmentApprovePayload
    const mode = normalizeShipmentQuoteMode(payload.mode)
    if (!payload.mode) {
      throw new HttpError(
        'Debes indicar el metodo de cotizacion antes de aprobar.',
        400,
        'mode_required'
      )
    }
    const order = await fetchOrderDetail(env, orderId)
    if (!order) {
      throw new Error('Pedido no encontrado.')
    }

    const currentShipment = toObjectRecord(order.shipment)
    if (
      currentShipment &&
      String(currentShipment.approval_status || '') === 'approved' &&
      cleanText(currentShipment.tracking_number)
    ) {
      return json(request, env, { success: true, order })
    }

    if (String(order.status || '') === 'unpaid') {
      throw new Error('El pedido aun no esta pagado.')
    }

    if (!currentShipment) {
      throw new Error('El pedido no tiene registro de envio.')
    }

    const parcelResult = normalizeParcelInput(
      env,
      payload,
      currentShipment,
      Number(order.total_amount_cents || 0),
      Number(toObjectRecord(order.summary)?.units_total || 1)
    )
    if (!parcelResult.ok) {
      throw new Error(parcelResult.error)
    }

    const filters =
      mode === 'manual'
        ? normalizeRequestedShipmentFilters(payload)
        : { carrier: null, service: null }
    if (mode === 'manual' && !filters.carrier) {
      throw new HttpError(
        'Selecciona un carrier antes de aprobar en modo manual.',
        400,
        'carrier_required'
      )
    }
    const currentRequestPayload = await buildQuoteRequestPayload(
      env,
      order,
      parcelResult.parcel,
      filters.carrier,
      filters.service
    )
    const { selectedQuote } = assertQuoteSnapshotMatches(
      currentShipment,
      currentRequestPayload,
      payload.selected_quote,
      mode
    )

    const labelBuild = await buildLabelRequestPayloads(
      env,
      order,
      parcelResult.parcel,
      selectedQuote
    )
    const labelRequests = labelBuild.requests
    const shipmentBoxes = resolveShipmentBoxes(parcelResult.parcel)
    const createdGuides: Array<Record<string, unknown>> = []
    try {
      for (let index = 0; index < labelRequests.length; index += 1) {
        const labelPayload = labelRequests[index]
        const created = await createShippingLabel(env, labelPayload)
        const labelKey = await storeShipmentLabel(env, orderId, created, index + 1)
        const requestPackage = shipmentBoxes[index] || null
        createdGuides.push({
          guide_index: index + 1,
          carrier: created.carrier || selectedQuote.carrier,
          service: created.service || selectedQuote.service,
          tracking_number: created.tracking_number,
          tracking_url: created.tracking_url,
          envia_shipment_id: created.shipment_id,
          label_r2_key: labelKey,
          parcel: requestPackage,
          envia_request: labelPayload,
          envia_response: created.raw,
          shipment_status: normalizeWorkerShippingStatus(created.status || 'preparing'),
          last_error: null
        })
      }
    } catch (error) {
      const hasPartialApprovalFailure = createdGuides.length > 0
      const hasCarrierAccountMismatch = isCarrierAccountMismatchError(error)
      const errorCode = hasPartialApprovalFailure
        ? SHIPMENT_ERROR_CODE_APPROVAL_PARTIAL_FAILURE
        : hasCarrierAccountMismatch
          ? SHIPMENT_ERROR_CODE_CARRIER_ACCOUNT_MISMATCH
          : null
      const message = hasPartialApprovalFailure
        ? buildPartialApprovalFailureMessage(createdGuides)
        : hasCarrierAccountMismatch
          ? buildCarrierAccountMismatchMessage(selectedQuote)
          : getErrorMessage(error)
      const requestPayloadForError =
        labelRequests.length === 1
          ? labelRequests[0]
          : { requests: labelRequests, box_plan: labelBuild.boxPlan }
      const responsePayloadForError = hasPartialApprovalFailure
        ? {
            request: requestPayloadForError,
            created_guides: createdGuides,
            failed_request_index: createdGuides.length + 1,
            error_message: getErrorMessage(error),
            error_payload: error instanceof EnviaRequestError ? error.payload : null
          }
        : error instanceof EnviaRequestError
          ? error.payload
          : null

      await replaceShipmentGuides(env, orderId, [])
      await upsertShipmentRow(env, orderId, {
        approval_status: 'pending',
        shipment_status: 'pending',
        parcel_json: safeStringify(parcelResult.parcel),
        carrier:
          hasCarrierAccountMismatch || hasPartialApprovalFailure ? null : currentShipment.carrier,
        service:
          hasCarrierAccountMismatch || hasPartialApprovalFailure ? null : currentShipment.service,
        tracking_number: null,
        tracking_url: null,
        envia_shipment_id: null,
        label_r2_key: null,
        quote_amount_cents:
          hasCarrierAccountMismatch || hasPartialApprovalFailure
            ? null
            : currentShipment.quote_amount_cents,
        envia_request_json: safeStringify(requestPayloadForError),
        envia_response_json: safeStringify(responsePayloadForError),
        last_error: message,
        last_error_code: errorCode
      })
      await insertShipmentEvent(env, orderId, 'approve_failed', 'admin', {
        mode,
        quote: selectedQuote,
        error: message,
        error_code: errorCode,
        failed_request_index: createdGuides.length + 1,
        created_guides: createdGuides,
        requires_manual_review: hasPartialApprovalFailure,
        payload: responsePayloadForError
      })
      if (errorCode) {
        throw new HttpError(message, 409, errorCode)
      }
      throw error
    }

    const summary = summarizeShipmentHeaderFromGuides(createdGuides)
    await replaceShipmentGuides(env, orderId, createdGuides)
    const boxConsumption = await consumeShipmentBoxTypeStock(env, parcelResult.parcel, createdGuides.length)

    await upsertShipmentRow(env, orderId, {
      approval_status: 'approved',
      shipment_status: summary.shipment_status,
      parcel_json: safeStringify(parcelResult.parcel),
      carrier: summary.carrier || selectedQuote.carrier,
      service: summary.service || selectedQuote.service,
      tracking_number: summary.tracking_number,
      tracking_url: summary.tracking_url,
      envia_shipment_id: summary.envia_shipment_id,
      label_r2_key: summary.label_r2_key,
      quote_amount_cents: selectedQuote.amount_cents,
      currency: selectedQuote.currency,
      envia_request_json: safeStringify(
        labelRequests.length === 1
          ? labelRequests[0]
          : { requests: labelRequests, box_plan: labelBuild.boxPlan }
      ),
      envia_response_json: safeStringify({
        guides: createdGuides.map((guide) => guide.envia_response)
      }),
      approved_at: new Date().toISOString(),
      last_sync_at: new Date().toISOString(),
      rejected_at: null,
      rejected_reason: null,
      last_error: null,
      last_error_code: null,
      tracking_sync_paused_at: null,
      tracking_sync_pause_reason: null
    })
    await updateOrderShippingStatus(env, orderId, summary.shipment_status)
    await insertShipmentEvent(env, orderId, 'approved', 'admin', {
      mode,
      quote: selectedQuote,
      guide_count: createdGuides.length,
      shipments: createdGuides,
      box_consumption: boxConsumption
    })
    if (boxConsumption.boxType) {
      await insertShipmentEvent(env, orderId, 'box_stock_consumed', 'admin', boxConsumption)
    }

    const refreshed = await fetchOrderDetail(env, orderId)
    return json(request, env, { success: true, order: refreshed })
  } catch (error) {
    workerError(requestId, 'shipments:approve:error', error)
    const status = getHttpStatus(error, 500)
    const code = getErrorCode(error)
    return json(
      request,
      env,
      {
        success: false,
        error: `Error aprobando envio: ${getErrorMessage(error)}`,
        ...(code ? { code } : {})
      },
      status
    )
  }
}

async function handleApprovePreviewShipmentByOrderId(
  request: Request,
  env: Env,
  requestId: string,
  orderId: string
): Promise<Response> {
  workerLog(requestId, 'shipments:approve-preview:start', { orderId })
  try {
    const authResult = assertAdminToken(request, env)
    if (!authResult.ok) {
      return json(request, env, { success: false, error: authResult.error }, authResult.status)
    }

    const payload = (await request.json().catch(() => ({}))) as ShipmentApprovePayload
    const mode = normalizeShipmentQuoteMode(payload.mode)
    if (!payload.mode) {
      throw new HttpError(
        'Debes indicar el metodo de cotizacion antes de previsualizar la peticion.',
        400,
        'mode_required'
      )
    }

    const order = await fetchOrderDetail(env, orderId)
    if (!order) {
      throw new Error('Pedido no encontrado.')
    }

    if (String(order.status || '') === 'unpaid') {
      throw new Error('El pedido aun no esta pagado.')
    }

    const currentShipment = toObjectRecord(order.shipment)
    if (!currentShipment) {
      throw new Error('El pedido no tiene registro de envio.')
    }

    const parcelResult = normalizeParcelInput(
      env,
      payload,
      currentShipment,
      Number(order.total_amount_cents || 0),
      Number(toObjectRecord(order.summary)?.units_total || 1)
    )
    if (!parcelResult.ok) {
      throw new Error(parcelResult.error)
    }

    const filters =
      mode === 'manual'
        ? normalizeRequestedShipmentFilters(payload)
        : { carrier: null, service: null }
    if (mode === 'manual' && !filters.carrier) {
      throw new HttpError(
        'Selecciona un carrier antes de aprobar en modo manual.',
        400,
        'carrier_required'
      )
    }

    const currentRequestPayload = await buildQuoteRequestPayload(
      env,
      order,
      parcelResult.parcel,
      filters.carrier,
      filters.service
    )
    const { selectedQuote } = assertQuoteSnapshotMatches(
      currentShipment,
      currentRequestPayload,
      payload.selected_quote,
      mode
    )

    const labelBuild = await buildLabelRequestPayloads(
      env,
      order,
      parcelResult.parcel,
      selectedQuote
    )
    const firstPayload = labelBuild.requests[0] || null
    const resolvedSettings = toObjectRecord(firstPayload?.settings)

    return json(request, env, {
      success: true,
      order_id: orderId,
      mode,
      selected_quote: selectedQuote,
      payload: firstPayload,
      label_requests: labelBuild.requests,
      guide_count: labelBuild.requests.length,
      box_plan: labelBuild.boxPlan,
      resolved_settings: resolvedSettings,
      settings_source: labelBuild.settingsSource,
      shipment_type_applied: labelBuild.shipmentTypeApplied,
      missing_fields: labelBuild.missingFields,
      warning:
        labelBuild.settingsSource === 'fallback'
          ? 'Envia no devolvio print settings desde Queries. El worker aplico un fallback local `PDF / STOCK_4X6 / thermal`; segun Quickstart de Envia, `settings` es opcional para `ship/generate`.'
          : null
    })
  } catch (error) {
    workerError(requestId, 'shipments:approve-preview:error', error)
    const status = getHttpStatus(error, 500)
    const code = getErrorCode(error)
    return json(
      request,
      env,
      {
        success: false,
        error: `Error generando preview de la peticion: ${getErrorMessage(error)}`,
        ...(code ? { code } : {})
      },
      status
    )
  }
}

async function handleRejectShipmentByOrderId(
  request: Request,
  env: Env,
  requestId: string,
  orderId: string
): Promise<Response> {
  workerLog(requestId, 'shipments:reject:start', { orderId })
  try {
    const authResult = assertAdminToken(request, env)
    if (!authResult.ok) {
      return json(request, env, { success: false, error: authResult.error }, authResult.status)
    }

    const payload = (await request.json().catch(() => ({}))) as ShipmentRejectPayload
    const reason = cleanText(payload.reason)
    if (!reason) {
      return json(
        request,
        env,
        { success: false, error: 'Debes indicar el motivo del rechazo.' },
        400
      )
    }

    const current = await fetchShipmentRow(env, orderId)
    if (!current) {
      return json(request, env, { success: false, error: 'Pedido no encontrado.' }, 404)
    }
    if (parseShipmentApprovalStatus(current.approval_status) === 'approved') {
      return json(
        request,
        env,
        { success: false, error: 'No se puede rechazar un envio ya aprobado.' },
        409
      )
    }

    await upsertShipmentRow(env, orderId, {
      approval_status: 'rejected',
      rejected_reason: reason,
      rejected_at: new Date().toISOString(),
      last_error: reason
    })
    await insertShipmentEvent(env, orderId, 'rejected', 'admin', { reason })
    const refreshed = await fetchOrderDetail(env, orderId)
    return json(request, env, { success: true, order: refreshed })
  } catch (error) {
    workerError(requestId, 'shipments:reject:error', error)
    return json(
      request,
      env,
      { success: false, error: `Error rechazando envio: ${getErrorMessage(error)}` },
      500
    )
  }
}

async function handleSyncShipmentByOrderId(
  request: Request,
  env: Env,
  requestId: string,
  orderId: string
): Promise<Response> {
  workerLog(requestId, 'shipments:sync:start', { orderId })
  try {
    const authResult = assertAdminToken(request, env)
    if (!authResult.ok) {
      return json(request, env, { success: false, error: authResult.error }, authResult.status)
    }

    const response = await syncOrderShipmentStatus(env, orderId, 'admin')
    return json(request, env, response)
  } catch (error) {
    workerError(requestId, 'shipments:sync:error', error)
    return json(
      request,
      env,
      { success: false, error: `Error sincronizando envio: ${getErrorMessage(error)}` },
      500
    )
  }
}

async function handleGetShipmentBoxTypes(
  request: Request,
  env: Env,
  requestId: string
): Promise<Response> {
  workerLog(requestId, 'shipment-box-types:list:start')
  try {
    const authResult = assertAdminToken(request, env)
    if (!authResult.ok) {
      return json(request, env, { success: false, error: authResult.error }, authResult.status)
    }

    const boxTypes = (await listShipmentBoxTypeRows(env)).map((row) => toShipmentBoxTypeResponse(row))
    return json(request, env, { success: true, box_types: boxTypes })
  } catch (error) {
    workerError(requestId, 'shipment-box-types:list:error', error)
    return json(
      request,
      env,
      { success: false, error: `Error obteniendo cajas: ${getErrorMessage(error)}` },
      500
    )
  }
}

async function handleCreateShipmentBoxType(
  request: Request,
  env: Env,
  requestId: string
): Promise<Response> {
  workerLog(requestId, 'shipment-box-types:create:start')
  try {
    const authResult = assertAdminToken(request, env)
    if (!authResult.ok) {
      return json(request, env, { success: false, error: authResult.error }, authResult.status)
    }

    const payload = (await request.json().catch(() => ({}))) as ShipmentBoxTypePayload
    const normalized = normalizeShipmentBoxTypePayload(payload)
    if (!normalized.ok) {
      return json(request, env, { success: false, error: normalized.error }, 400)
    }

    await ensureOrderShipmentsSchema(env, requestId)
    await env.DB.prepare(
      `
        INSERT INTO shipment_box_types (
          name,
          code,
          inner_length_cm,
          inner_width_cm,
          inner_height_cm,
          max_products,
          stock_qty,
          is_active,
          sort,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `
    )
      .bind(
        normalized.values.name,
        normalized.values.code ?? null,
        normalized.values.inner_length_cm,
        normalized.values.inner_width_cm,
        normalized.values.inner_height_cm,
        normalized.values.max_products,
        normalized.values.stock_qty ?? 0,
        normalized.values.is_active ?? 1,
        normalized.values.sort ?? 100
      )
      .run()

    const boxTypes = (await listShipmentBoxTypeRows(env)).map((row) => toShipmentBoxTypeResponse(row))
    return json(request, env, { success: true, box_types: boxTypes })
  } catch (error) {
    workerError(requestId, 'shipment-box-types:create:error', error)
    const message = isUniqueConstraintError(error, 'shipment_box_types.code')
      ? 'Ya existe una caja con ese codigo.'
      : getErrorMessage(error)
    return json(request, env, { success: false, error: message }, 500)
  }
}

async function handleUpdateShipmentBoxType(
  request: Request,
  env: Env,
  requestId: string,
  boxTypeId: number
): Promise<Response> {
  workerLog(requestId, 'shipment-box-types:update:start', { boxTypeId })
  try {
    const authResult = assertAdminToken(request, env)
    if (!authResult.ok) {
      return json(request, env, { success: false, error: authResult.error }, authResult.status)
    }

    const existing = await fetchShipmentBoxTypeRow(env, boxTypeId)
    if (!existing) {
      return json(request, env, { success: false, error: 'Caja no encontrada.' }, 404)
    }

    const payload = (await request.json().catch(() => ({}))) as ShipmentBoxTypePayload
    const normalized = normalizeShipmentBoxTypePayload(payload, { partial: true })
    if (!normalized.ok) {
      return json(request, env, { success: false, error: normalized.error }, 400)
    }

    const clauses = Object.keys(normalized.values).map((key) => `${key} = ?`)
    const values = Object.values(normalized.values)
    await env.DB.prepare(
      `
        UPDATE shipment_box_types
        SET ${clauses.join(', ')}, updated_at = datetime('now')
        WHERE id = ?
      `
    )
      .bind(...values, boxTypeId)
      .run()

    const boxTypes = (await listShipmentBoxTypeRows(env)).map((row) => toShipmentBoxTypeResponse(row))
    return json(request, env, { success: true, box_types: boxTypes })
  } catch (error) {
    workerError(requestId, 'shipment-box-types:update:error', error)
    const message = isUniqueConstraintError(error, 'shipment_box_types.code')
      ? 'Ya existe una caja con ese codigo.'
      : getErrorMessage(error)
    return json(request, env, { success: false, error: message }, 500)
  }
}

async function handleDeleteShipmentBoxType(
  request: Request,
  env: Env,
  requestId: string,
  boxTypeId: number
): Promise<Response> {
  workerLog(requestId, 'shipment-box-types:delete:start', { boxTypeId })
  try {
    const authResult = assertAdminToken(request, env)
    if (!authResult.ok) {
      return json(request, env, { success: false, error: authResult.error }, authResult.status)
    }

    const existing = await fetchShipmentBoxTypeRow(env, boxTypeId)
    if (!existing) {
      return json(request, env, { success: false, error: 'Caja no encontrada.' }, 404)
    }

    await env.DB.prepare('DELETE FROM shipment_box_types WHERE id = ?').bind(boxTypeId).run()
    const boxTypes = (await listShipmentBoxTypeRows(env)).map((row) => toShipmentBoxTypeResponse(row))
    return json(request, env, { success: true, box_types: boxTypes })
  } catch (error) {
    workerError(requestId, 'shipment-box-types:delete:error', error)
    return json(
      request,
      env,
      { success: false, error: `Error eliminando caja: ${getErrorMessage(error)}` },
      500
    )
  }
}

async function handleRemoteRefreshShipmentByOrderId(
  request: Request,
  env: Env,
  requestId: string,
  orderId: string
): Promise<Response> {
  workerLog(requestId, 'shipments:remote-refresh:start', { orderId })
  try {
    const authResult = assertAdminToken(request, env)
    if (!authResult.ok) {
      return json(request, env, { success: false, error: authResult.error }, authResult.status)
    }

    const sourceParam = String(new URL(request.url).searchParams.get('source') || '').trim()
    const source = sourceParam === 'detail_open' ? 'detail_open' : 'admin'
    const response = await refreshOrderShipmentFromRemote(env, orderId, source)
    return json(request, env, response)
  } catch (error) {
    workerError(requestId, 'shipments:remote-refresh:error', error)
    const status = getHttpStatus(error, 500)
    const code = getErrorCode(error)
    return json(
      request,
      env,
      {
        success: false,
        error: `Error refrescando envio desde Envia: ${getErrorMessage(error)}`,
        ...(code ? { code } : {})
      },
      status
    )
  }
}

async function handleCancelShipmentGuideByOrderId(
  request: Request,
  env: Env,
  requestId: string,
  orderId: string,
  guideIndex: number
): Promise<Response> {
  workerLog(requestId, 'shipments:guide-cancel:start', { orderId, guideIndex })
  try {
    const authResult = assertAdminToken(request, env)
    if (!authResult.ok) {
      return json(request, env, { success: false, error: authResult.error }, authResult.status)
    }

    const response = await cancelOrderShipmentGuide(env, orderId, guideIndex, 'admin')
    return json(request, env, response)
  } catch (error) {
    workerError(requestId, 'shipments:guide-cancel:error', error)
    const status = getHttpStatus(error, 500)
    const code = getErrorCode(error)
    return json(
      request,
      env,
      {
        success: false,
        error: `Error cancelando guia: ${getErrorMessage(error)}`,
        ...(code ? { code } : {})
      },
      status
    )
  }
}

async function handleCancelAllShipmentGuidesByOrderId(
  request: Request,
  env: Env,
  requestId: string,
  orderId: string
): Promise<Response> {
  workerLog(requestId, 'shipments:cancel-all:start', { orderId })
  try {
    const authResult = assertAdminToken(request, env)
    if (!authResult.ok) {
      return json(request, env, { success: false, error: authResult.error }, authResult.status)
    }

    const order = await fetchOrderDetail(env, orderId)
    if (!order) {
      return json(request, env, { success: false, error: 'Pedido no encontrado.' }, 404)
    }

    const shipment = toObjectRecord(order.shipment)
    const guides = Array.isArray(shipment?.guides)
      ? shipment?.guides.map((guide) => toObjectRecord(guide)).filter(Boolean)
      : []
    if (!guides.length) {
      return json(request, env, { success: false, error: 'Este pedido no tiene guias.' }, 409)
    }

    const cancelledGuides: number[] = []
    const failedGuides: Array<Record<string, unknown>> = []
    let latestOrder: Record<string, unknown> | null = order

    for (const guide of guides as Array<Record<string, unknown>>) {
      const guideIndex = Number(guide.guide_index || 0)
      if (!guideIndex || normalizeWorkerShippingStatus(guide.shipment_status) === 'cancelled') continue
      try {
        const response = await cancelOrderShipmentGuide(env, orderId, guideIndex, 'admin')
        latestOrder = toObjectRecord(response.order) || latestOrder
        cancelledGuides.push(guideIndex)
      } catch (error) {
        failedGuides.push({
          guide_index: guideIndex,
          error: getErrorMessage(error),
          code: getErrorCode(error)
        })
      }
    }

    if (cancelledGuides.length === 0 && failedGuides.length > 0) {
      return json(
        request,
        env,
        {
          success: false,
          error: 'No se pudo cancelar ninguna guia.',
          failed_guides: failedGuides,
          order: latestOrder
        },
        409
      )
    }

    await insertShipmentEvent(env, orderId, 'cancel_all_completed', 'admin', {
      cancelled_guides: cancelledGuides,
      failed_guides: failedGuides
    })

    return json(request, env, {
      success: true,
      order: latestOrder,
      cancelled_guides: cancelledGuides,
      failed_guides: failedGuides,
      warning:
        failedGuides.length > 0
          ? `Se cancelaron ${cancelledGuides.length} guia(s), pero ${failedGuides.length} fallaron.`
          : null
    })
  } catch (error) {
    workerError(requestId, 'shipments:cancel-all:error', error)
    const status = getHttpStatus(error, 500)
    const code = getErrorCode(error)
    return json(
      request,
      env,
      {
        success: false,
        error: `Error cancelando guias: ${getErrorMessage(error)}`,
        ...(code ? { code } : {})
      },
      status
    )
  }
}

async function handleResetShipmentTempStorage(
  request: Request,
  env: Env,
  requestId: string
): Promise<Response> {
  workerLog(requestId, 'shipments:reset-temp:start')
  try {
    const authResult = assertAdminToken(request, env)
    if (!authResult.ok) {
      return json(request, env, { success: false, error: authResult.error }, authResult.status)
    }

    await ensureOrdersAdminSchema(env, requestId)
    await ensureOrderShipmentsSchema(env, requestId)

    const [shipmentLabelRows, guideLabelRows] = await Promise.all([
      env.DB.prepare(
        `
          SELECT label_r2_key
          FROM order_shipments
          WHERE label_r2_key IS NOT NULL AND TRIM(label_r2_key) <> ''
        `
      ).all<{ label_r2_key: string | null }>(),
      env.DB.prepare(
        `
          SELECT label_r2_key
          FROM order_shipment_guides
          WHERE label_r2_key IS NOT NULL AND TRIM(label_r2_key) <> ''
        `
      ).all<{ label_r2_key: string | null }>()
    ])

    const labelKeys = [
      ...(shipmentLabelRows.results || []).map((row) => cleanText(row.label_r2_key)),
      ...(guideLabelRows.results || []).map((row) => cleanText(row.label_r2_key))
    ].filter((key): key is string => Boolean(key))

    const uniqueLabelKeys = [...new Set(labelKeys)]
    const labelDeleteResults = await Promise.allSettled(
      uniqueLabelKeys.map((key) => env.ASSETS_BUCKET.delete(key))
    )
    const labelObjectsDeleted = labelDeleteResults.filter((result) => result.status === 'fulfilled')
      .length
    const labelObjectsDeleteFailed = labelDeleteResults.length - labelObjectsDeleted

    const [guidesDeleteResult, eventsDeleteResult, shipmentsResetResult, ordersResetResult] =
      await Promise.all([
        env.DB.prepare('DELETE FROM order_shipment_guides').run(),
        env.DB.prepare('DELETE FROM order_shipment_events').run(),
        env.DB.prepare(
          `
            UPDATE order_shipments
            SET
              approval_status = 'pending',
              shipment_status = 'pending',
              carrier = NULL,
              service = NULL,
              tracking_number = NULL,
              tracking_url = NULL,
              envia_shipment_id = NULL,
              label_r2_key = NULL,
              quote_amount_cents = NULL,
              parcel_json = NULL,
              envia_request_json = NULL,
              envia_response_json = NULL,
              approved_at = NULL,
              rejected_at = NULL,
              rejected_reason = NULL,
              last_sync_at = NULL,
              last_error = NULL,
              last_error_code = NULL,
              tracking_sync_paused_at = NULL,
              tracking_sync_pause_reason = NULL,
              updated_at = datetime('now')
          `
        ).run(),
        env.DB.prepare(
          `
            UPDATE orders
            SET shipping_status = 'pending', updated_at = datetime('now')
            WHERE status <> 'unpaid'
          `
        ).run()
      ])

    enviaHealthCache = null
    enviaMxStateCodeCache.clear()

    workerLog(requestId, 'shipments:reset-temp:ok', {
      shipmentsReset: getChangesFromRun(shipmentsResetResult),
      ordersReset: getChangesFromRun(ordersResetResult),
      eventsCleared: getChangesFromRun(eventsDeleteResult),
      guidesCleared: getChangesFromRun(guidesDeleteResult),
      labelObjectsDeleted,
      labelObjectsDeleteFailed
    })

    return json(request, env, {
      success: true,
      shipments_reset: getChangesFromRun(shipmentsResetResult),
      orders_reset: getChangesFromRun(ordersResetResult),
      shipment_events_cleared: getChangesFromRun(eventsDeleteResult),
      shipment_guides_cleared: getChangesFromRun(guidesDeleteResult),
      label_objects_deleted: labelObjectsDeleted,
      label_objects_delete_failed: labelObjectsDeleteFailed
    })
  } catch (error) {
    workerError(requestId, 'shipments:reset-temp:error', error)
    return json(
      request,
      env,
      {
        success: false,
        error: `Error limpiando almacenamiento temporal de envios: ${getErrorMessage(error)}`
      },
      500
    )
  }
}

async function handleEnviaWebhook(
  request: Request,
  env: Env,
  requestId: string
): Promise<Response> {
  workerLog(requestId, 'shipments:webhook:start')
  try {
    const expected = cleanText(env.ENVIA_WEBHOOK_TOKEN)
    if (expected) {
      const actual =
        cleanText(request.headers.get('x-envia-webhook-token')) ||
        cleanText(new URL(request.url).searchParams.get('token'))
      if (actual !== expected) {
        return json(request, env, { success: false, error: 'Webhook token invalido.' }, 403)
      }
    }

    const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null
    if (!payload) {
      return json(request, env, {
        success: true,
        ignored: true,
        reason: 'empty_or_invalid_payload'
      })
    }

    const webhookTracking = normalizeTrackingResult(payload)
    const trackingNumber =
      webhookTracking.tracking_number ||
      cleanText(payload.tracking_number) ||
      cleanText(payload.trackingNumber) ||
      cleanText(payload.guide_number) ||
      cleanText(payload.guideNumber)

    if (!trackingNumber) {
      return json(request, env, {
        success: true,
        ignored: true,
        reason: 'missing_tracking_number'
      })
    }

    await ensureOrderShipmentsSchema(env, requestId)
    const shipmentRow = await env.DB.prepare(
      `
        SELECT order_id
        FROM order_shipments
        WHERE tracking_number = ?
        LIMIT 1
      `
    )
      .bind(trackingNumber)
      .first<{ order_id: string }>()

    if (!shipmentRow?.order_id) {
      return json(request, env, {
        success: true,
        ignored: true,
        reason: 'tracking_not_found',
        tracking_number: trackingNumber
      })
    }

    const current = await fetchShipmentRow(env, shipmentRow.order_id)
    const nextStatus = webhookTracking.status
    const noChange =
      current &&
      normalizeWorkerShippingStatus(current.shipment_status) === nextStatus &&
      cleanText(current.tracking_number) === trackingNumber

    if (!noChange) {
      await upsertShipmentRow(env, shipmentRow.order_id, {
        shipment_status: nextStatus,
        tracking_number: trackingNumber,
        tracking_url: webhookTracking.tracking_url,
        carrier: webhookTracking.carrier,
        envia_response_json: safeStringify(payload),
        last_sync_at: new Date().toISOString(),
        last_error: null
      })
      await updateOrderShippingStatus(env, shipmentRow.order_id, nextStatus)
      await insertShipmentEvent(env, shipmentRow.order_id, 'webhook', 'envia', payload)
    }

    const refreshed = await fetchOrderDetail(env, shipmentRow.order_id)
    return json(request, env, { success: true, order: refreshed, duplicate: Boolean(noChange) })
  } catch (error) {
    workerError(requestId, 'shipments:webhook:error', error)
    return json(
      request,
      env,
      { success: false, error: `Error procesando webhook Envia: ${getErrorMessage(error)}` },
      500
    )
  }
}

async function handleEnviaWebhookProbe(
  request: Request,
  env: Env,
  requestId: string
): Promise<Response> {
  workerLog(requestId, 'shipments:webhook:probe')
  const expected = cleanText(env.ENVIA_WEBHOOK_TOKEN)
  if (expected) {
    const actual =
      cleanText(request.headers.get('x-envia-webhook-token')) ||
      cleanText(new URL(request.url).searchParams.get('token'))
    if (actual !== expected) {
      return json(request, env, { success: false, error: 'Webhook token invalido.' }, 403)
    }
  }

  return json(request, env, {
    success: true,
    webhook: 'envia',
    reachable: true
  })
}

async function listNonTerminalApprovedShipmentOrderIds(env: Env): Promise<string[]> {
  await ensureOrderShipmentsSchema(env, 'scheduled-shipments-sync')
  const result = await env.DB.prepare(
    `
      SELECT order_id
      FROM order_shipments
      WHERE approval_status = 'approved'
        AND shipment_status NOT IN ('delivered', 'cancelled', 'lost')
        AND (tracking_sync_paused_at IS NULL OR TRIM(tracking_sync_paused_at) = '')
      ORDER BY datetime(COALESCE(last_sync_at, approved_at, created_at)) ASC, order_id ASC
      LIMIT 25
    `
  ).all<{ order_id: string }>()

  return (result.results || []).map((row) => String(row.order_id || '').trim()).filter(Boolean)
}

async function runScheduledShipmentSync(env: Env): Promise<void> {
  const requestId = `sched-${crypto.randomUUID().slice(0, 8)}`
  workerLog(requestId, 'shipments:scheduled:start')
  const orderIds = await listNonTerminalApprovedShipmentOrderIds(env)
  for (const orderId of orderIds) {
    try {
      await syncOrderShipmentStatus(env, orderId, 'scheduled')
    } catch (error) {
      workerError(requestId, 'shipments:scheduled:item:error', {
        orderId,
        error: getErrorMessage(error)
      })
      await upsertShipmentRow(env, orderId, {
        last_error: `Sync programado: ${getErrorMessage(error)}`,
        last_sync_at: new Date().toISOString()
      }).catch(() => null)
    }
  }
  workerLog(requestId, 'shipments:scheduled:done', { processed: orderIds.length })
}

async function handleUpload(request: Request, env: Env, requestId: string): Promise<Response> {
  workerLog(requestId, 'upload:start')
  try {
    const contentType = request.headers.get('Content-Type') || ''
    if (!contentType.includes('multipart/form-data')) {
      return json(request, env, { success: false, error: 'Se esperaba multipart/form-data.' }, 400)
    }

    const data = await request.formData()
    const file = data.get('file') as unknown

    if (
      !file ||
      typeof file === 'string' ||
      typeof file !== 'object' ||
      !('name' in file) ||
      !('type' in file) ||
      !('stream' in file)
    ) {
      return json(request, env, { success: false, error: 'El campo "file" es obligatorio.' }, 400)
    }

    const uploadFile = file as { name: string; type: string; stream: () => ReadableStream }
    workerLog(requestId, 'upload:file', { name: uploadFile.name, type: uploadFile.type })

    if (!uploadFile.type.startsWith('image/')) {
      return json(
        request,
        env,
        { success: false, error: 'Solo se permiten archivos de imagen.' },
        400
      )
    }

    const prefix = normalizeAssetPrefix(data.get('prefix'))
    const safeName = sanitizeFileName(uploadFile.name)
    const key = `${prefix}${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName}`

    await env.ASSETS_BUCKET.put(key, uploadFile.stream(), {
      httpMetadata: { contentType: uploadFile.type || 'application/octet-stream' }
    })

    const url = buildAssetUrl(env, key)

    workerLog(requestId, 'upload:ok', { key, prefix, url })
    return json(request, env, { success: true, key, url, reused: false }, 201)
  } catch (error) {
    workerError(requestId, 'upload:error', error)
    return json(
      request,
      env,
      { success: false, error: `Error subiendo archivo: ${getErrorMessage(error)}` },
      500
    )
  }
}

async function handleListAssets(request: Request, env: Env, requestId: string): Promise<Response> {
  workerLog(requestId, 'assets:list:start')
  try {
    const url = new URL(request.url)
    const prefix = normalizeAssetPrefix(url.searchParams.get('prefix'))
    const cursor = String(url.searchParams.get('cursor') || '').trim() || undefined
    const limit = parseAssetsLimit(url.searchParams.get('limit'))
    const listing = await env.ASSETS_BUCKET.list({ prefix, cursor, limit })
    const usageMap = await getAssetUsageMap(
      env,
      (listing.objects || []).map((object) => object.key).filter(Boolean)
    )

    const assets = (listing.objects || []).map((object) => {
      const usageEntry = usageMap.get(object.key)
      const usageCount = usageEntry?.usage_count || 0
      const uploadedAt =
        object.uploaded instanceof Date
          ? object.uploaded.toISOString()
          : object.uploaded
            ? new Date(object.uploaded).toISOString()
            : null

      return {
        key: object.key,
        url: buildAssetUrl(env, object.key),
        preview_url: buildAssetPreviewUrl(object.key),
        size: Number(object.size || 0),
        uploaded_at: uploadedAt,
        content_type: object.httpMetadata?.contentType || null,
        usage_count: usageCount,
        usage_products: usageEntry?.usage_products || [],
        can_delete: usageCount === 0
      }
    })

    workerLog(requestId, 'assets:list:ok', {
      prefix,
      count: assets.length,
      truncated: Boolean(listing.truncated)
    })
    return json(request, env, {
      success: true,
      assets,
      next_cursor: listing.truncated ? listing.cursor || null : null,
      has_more: Boolean(listing.truncated && listing.cursor)
    })
  } catch (error) {
    workerError(requestId, 'assets:list:error', error)
    return json(
      request,
      env,
      { success: false, error: `Error listando assets: ${getErrorMessage(error)}` },
      500
    )
  }
}

async function handleAssetGet(
  request: Request,
  env: Env,
  key: string,
  requestId: string
): Promise<Response> {
  workerLog(requestId, 'asset:get:start', { key })
  if (!key) {
    return json(request, env, { success: false, error: 'Llave de archivo invalida.' }, 400)
  }

  const object = await env.ASSETS_BUCKET.get(key)

  if (!object) {
    return json(request, env, { success: false, error: 'Archivo no encontrado.' }, 404)
  }

  const headers = withCors(request, env)
  object.writeHttpMetadata(headers)
  headers.set('ETag', object.httpEtag)
  workerLog(requestId, 'asset:get:ok')
  return new Response(object.body, { headers })
}

async function handleDeleteAsset(
  request: Request,
  env: Env,
  key: string,
  requestId: string
): Promise<Response> {
  workerLog(requestId, 'asset:delete:start', { key })
  if (!key) {
    return json(request, env, { success: false, error: 'Llave de archivo invalida.' }, 400)
  }

  try {
    const object = await env.ASSETS_BUCKET.head(key)
    if (!object) {
      return json(request, env, { success: false, error: 'Asset no encontrado.' }, 404)
    }

    const usageCount = await getAssetUsageCount(env, key)
    if (usageCount > 0) {
      return json(
        request,
        env,
        {
          success: false,
          error: `No se puede eliminar; ${usageCount} producto(s) referencian esta imagen.`
        },
        409
      )
    }

    await env.ASSETS_BUCKET.delete(key)
    workerLog(requestId, 'asset:delete:ok', { key })
    return json(request, env, { success: true })
  } catch (error) {
    workerError(requestId, 'asset:delete:error', error)
    return json(
      request,
      env,
      { success: false, error: `Error eliminando asset: ${getErrorMessage(error)}` },
      500
    )
  }
}

export default {
  async fetch(request, env): Promise<Response> {
    const requestId = crypto.randomUUID().slice(0, 8)
    const { pathname, search } = new URL(request.url)
    const startedAt = Date.now()
    const productId = getProductIdFromPath(pathname)
    const variantRoute = getProductVariantRoute(pathname)
    const reviewRoute = getProductReviewRoute(pathname)
    const productTypeId = getProductTypeIdFromPath(pathname)
    const orderId = getOrderIdFromPath(pathname)
    const shipmentOrderId = getShipmentOrderIdFromPath(pathname)
    const shipmentActionRoute = getShipmentActionRoute(pathname)
    const shipmentGuideActionRoute = getShipmentGuideActionRoute(pathname)
    const shipmentBoxTypeId = getShipmentBoxTypeIdFromPath(pathname)
    workerLog(requestId, 'request:start', {
      method: request.method,
      pathname,
      search,
      productId,
      variantRoute,
      reviewRoute,
      productTypeId,
      orderId,
      shipmentOrderId,
      shipmentActionRoute,
      shipmentGuideActionRoute,
      shipmentBoxTypeId
    })

    if (request.method === 'OPTIONS') {
      const response = new Response(null, { status: 204, headers: withCors(request, env) })
      workerLog(requestId, 'request:done', {
        status: response.status,
        elapsedMs: Date.now() - startedAt
      })
      return response
    }

    if (request.method === 'GET' && pathname === '/api/health') {
      const response = await handleHealth(request, env, requestId)
      workerLog(requestId, 'request:done', {
        status: response.status,
        elapsedMs: Date.now() - startedAt
      })
      return response
    }

    if (request.method === 'GET' && pathname === '/api/products') {
      const response = await handleGetProducts(request, env, requestId)
      workerLog(requestId, 'request:done', {
        status: response.status,
        elapsedMs: Date.now() - startedAt
      })
      return response
    }

    if (request.method === 'GET' && pathname === '/api/orders') {
      const response = await handleGetOrders(request, env, requestId)
      workerLog(requestId, 'request:done', {
        status: response.status,
        elapsedMs: Date.now() - startedAt
      })
      return response
    }

    if (request.method === 'GET' && pathname === '/api/shipments/pending') {
      const response = await handleGetPendingShipments(request, env, requestId)
      workerLog(requestId, 'request:done', {
        status: response.status,
        elapsedMs: Date.now() - startedAt
      })
      return response
    }

    if (request.method === 'GET' && pathname === '/api/shipments/options') {
      const response = await handleGetShipmentOptions(request, env, requestId)
      workerLog(requestId, 'request:done', {
        status: response.status,
        elapsedMs: Date.now() - startedAt
      })
      return response
    }

    if (request.method === 'GET' && pathname === '/api/shipments') {
      const response = await handleGetShipments(request, env, requestId)
      workerLog(requestId, 'request:done', {
        status: response.status,
        elapsedMs: Date.now() - startedAt
      })
      return response
    }

    if (request.method === 'GET' && pathname === '/api/shipment-box-types') {
      const response = await handleGetShipmentBoxTypes(request, env, requestId)
      workerLog(requestId, 'request:done', {
        status: response.status,
        elapsedMs: Date.now() - startedAt
      })
      return response
    }

    if (request.method === 'POST' && pathname === '/api/shipment-box-types') {
      const response = await handleCreateShipmentBoxType(request, env, requestId)
      workerLog(requestId, 'request:done', {
        status: response.status,
        elapsedMs: Date.now() - startedAt
      })
      return response
    }

    if (shipmentBoxTypeId !== null && request.method === 'PUT') {
      const response = await handleUpdateShipmentBoxType(request, env, requestId, shipmentBoxTypeId)
      workerLog(requestId, 'request:done', {
        status: response.status,
        elapsedMs: Date.now() - startedAt
      })
      return response
    }

    if (shipmentBoxTypeId !== null && request.method === 'DELETE') {
      const response = await handleDeleteShipmentBoxType(request, env, requestId, shipmentBoxTypeId)
      workerLog(requestId, 'request:done', {
        status: response.status,
        elapsedMs: Date.now() - startedAt
      })
      return response
    }

    if (request.method === 'POST' && pathname === '/api/shipments/reset-temp') {
      const response = await handleResetShipmentTempStorage(request, env, requestId)
      workerLog(requestId, 'request:done', {
        status: response.status,
        elapsedMs: Date.now() - startedAt
      })
      return response
    }

    if (shipmentOrderId !== null && request.method === 'GET') {
      const response = await handleGetShipmentByOrderId(request, env, requestId, shipmentOrderId)
      workerLog(requestId, 'request:done', {
        status: response.status,
        elapsedMs: Date.now() - startedAt
      })
      return response
    }

    if (
      shipmentActionRoute &&
      shipmentActionRoute.action === 'quote' &&
      request.method === 'POST'
    ) {
      const response = await handleQuoteShipmentByOrderId(
        request,
        env,
        requestId,
        shipmentActionRoute.orderId,
        shipmentActionRoute.mode
      )
      workerLog(requestId, 'request:done', {
        status: response.status,
        elapsedMs: Date.now() - startedAt
      })
      return response
    }

    if (
      shipmentActionRoute &&
      shipmentActionRoute.action === 'approve-preview' &&
      request.method === 'POST'
    ) {
      const response = await handleApprovePreviewShipmentByOrderId(
        request,
        env,
        requestId,
        shipmentActionRoute.orderId
      )
      workerLog(requestId, 'request:done', {
        status: response.status,
        elapsedMs: Date.now() - startedAt
      })
      return response
    }

    if (
      shipmentActionRoute &&
      shipmentActionRoute.action === 'approve' &&
      request.method === 'POST'
    ) {
      const response = await handleApproveShipmentByOrderId(
        request,
        env,
        requestId,
        shipmentActionRoute.orderId
      )
      workerLog(requestId, 'request:done', {
        status: response.status,
        elapsedMs: Date.now() - startedAt
      })
      return response
    }

    if (
      shipmentActionRoute &&
      shipmentActionRoute.action === 'reject' &&
      request.method === 'POST'
    ) {
      const response = await handleRejectShipmentByOrderId(
        request,
        env,
        requestId,
        shipmentActionRoute.orderId
      )
      workerLog(requestId, 'request:done', {
        status: response.status,
        elapsedMs: Date.now() - startedAt
      })
      return response
    }

    if (shipmentActionRoute && shipmentActionRoute.action === 'sync' && request.method === 'POST') {
      const response = await handleSyncShipmentByOrderId(
        request,
        env,
        requestId,
        shipmentActionRoute.orderId
      )
      workerLog(requestId, 'request:done', {
        status: response.status,
        elapsedMs: Date.now() - startedAt
      })
      return response
    }

    if (
      shipmentActionRoute &&
      shipmentActionRoute.action === 'remote-refresh' &&
      request.method === 'POST'
    ) {
      const response = await handleRemoteRefreshShipmentByOrderId(
        request,
        env,
        requestId,
        shipmentActionRoute.orderId
      )
      workerLog(requestId, 'request:done', {
        status: response.status,
        elapsedMs: Date.now() - startedAt
      })
      return response
    }

    if (
      shipmentActionRoute &&
      shipmentActionRoute.action === 'cancel-all' &&
      request.method === 'POST'
    ) {
      const response = await handleCancelAllShipmentGuidesByOrderId(
        request,
        env,
        requestId,
        shipmentActionRoute.orderId
      )
      workerLog(requestId, 'request:done', {
        status: response.status,
        elapsedMs: Date.now() - startedAt
      })
      return response
    }

    if (
      shipmentGuideActionRoute &&
      shipmentGuideActionRoute.action === 'cancel' &&
      request.method === 'POST'
    ) {
      const response = await handleCancelShipmentGuideByOrderId(
        request,
        env,
        requestId,
        shipmentGuideActionRoute.orderId,
        shipmentGuideActionRoute.guideIndex
      )
      workerLog(requestId, 'request:done', {
        status: response.status,
        elapsedMs: Date.now() - startedAt
      })
      return response
    }

    if (request.method === 'GET' && pathname === '/api/integrations/envia/webhook') {
      const response = await handleEnviaWebhookProbe(request, env, requestId)
      workerLog(requestId, 'request:done', {
        status: response.status,
        elapsedMs: Date.now() - startedAt
      })
      return response
    }

    if (request.method === 'POST' && pathname === '/api/integrations/envia/webhook') {
      const response = await handleEnviaWebhook(request, env, requestId)
      workerLog(requestId, 'request:done', {
        status: response.status,
        elapsedMs: Date.now() - startedAt
      })
      return response
    }

    if (orderId !== null && request.method === 'GET') {
      const response = await handleGetOrderById(request, env, requestId, orderId)
      workerLog(requestId, 'request:done', {
        status: response.status,
        elapsedMs: Date.now() - startedAt
      })
      return response
    }

    if (orderId !== null && request.method === 'PATCH') {
      const response = await handlePatchOrderById(request, env, requestId, orderId)
      workerLog(requestId, 'request:done', {
        status: response.status,
        elapsedMs: Date.now() - startedAt
      })
      return response
    }

    if (productId !== null && request.method === 'GET') {
      const response = await handleGetProductById(request, env, requestId, productId)
      workerLog(requestId, 'request:done', {
        status: response.status,
        elapsedMs: Date.now() - startedAt
      })
      return response
    }

    if (variantRoute && variantRoute.variantId === null && request.method === 'GET') {
      const response = await handleGetProductVariants(
        request,
        env,
        requestId,
        variantRoute.productId
      )
      workerLog(requestId, 'request:done', {
        status: response.status,
        elapsedMs: Date.now() - startedAt
      })
      return response
    }

    if (variantRoute && variantRoute.variantId === null && request.method === 'POST') {
      const response = await handleCreateProductVariant(
        request,
        env,
        requestId,
        variantRoute.productId
      )
      workerLog(requestId, 'request:done', {
        status: response.status,
        elapsedMs: Date.now() - startedAt
      })
      return response
    }

    if (variantRoute && variantRoute.variantId !== null && request.method === 'PATCH') {
      const response = await handleUpdateProductVariant(
        request,
        env,
        requestId,
        variantRoute.productId,
        variantRoute.variantId
      )
      workerLog(requestId, 'request:done', {
        status: response.status,
        elapsedMs: Date.now() - startedAt
      })
      return response
    }

    if (variantRoute && variantRoute.variantId !== null && request.method === 'DELETE') {
      const response = await handleDeleteProductVariant(
        request,
        env,
        requestId,
        variantRoute.productId,
        variantRoute.variantId
      )
      workerLog(requestId, 'request:done', {
        status: response.status,
        elapsedMs: Date.now() - startedAt
      })
      return response
    }

    if (reviewRoute && reviewRoute.reviewId === null && request.method === 'GET') {
      const response = await handleGetProductReviews(request, env, requestId, reviewRoute.productId)
      workerLog(requestId, 'request:done', {
        status: response.status,
        elapsedMs: Date.now() - startedAt
      })
      return response
    }

    if (reviewRoute && reviewRoute.reviewId === null && request.method === 'POST') {
      const response = await handleCreateProductReview(
        request,
        env,
        requestId,
        reviewRoute.productId
      )
      workerLog(requestId, 'request:done', {
        status: response.status,
        elapsedMs: Date.now() - startedAt
      })
      return response
    }

    if (reviewRoute && reviewRoute.reviewId !== null && request.method === 'PATCH') {
      const response = await handleUpdateProductReview(
        request,
        env,
        requestId,
        reviewRoute.productId,
        reviewRoute.reviewId
      )
      workerLog(requestId, 'request:done', {
        status: response.status,
        elapsedMs: Date.now() - startedAt
      })
      return response
    }

    if (reviewRoute && reviewRoute.reviewId !== null && request.method === 'DELETE') {
      const response = await handleDeleteProductReview(
        request,
        env,
        requestId,
        reviewRoute.productId,
        reviewRoute.reviewId
      )
      workerLog(requestId, 'request:done', {
        status: response.status,
        elapsedMs: Date.now() - startedAt
      })
      return response
    }

    if (request.method === 'POST' && pathname === '/api/products') {
      const response = await handleCreateProduct(request, env, requestId)
      workerLog(requestId, 'request:done', {
        status: response.status,
        elapsedMs: Date.now() - startedAt
      })
      return response
    }

    if (productId !== null && request.method === 'PATCH') {
      const response = await handleUpdateProduct(request, env, requestId, productId)
      workerLog(requestId, 'request:done', {
        status: response.status,
        elapsedMs: Date.now() - startedAt
      })
      return response
    }

    if (productId !== null && request.method === 'DELETE') {
      const response = await handleDeleteProduct(request, env, requestId, productId)
      workerLog(requestId, 'request:done', {
        status: response.status,
        elapsedMs: Date.now() - startedAt
      })
      return response
    }

    if (request.method === 'GET' && pathname === '/api/product-types') {
      const response = await handleGetProductTypes(request, env, requestId)
      workerLog(requestId, 'request:done', {
        status: response.status,
        elapsedMs: Date.now() - startedAt
      })
      return response
    }

    if (productTypeId !== null && request.method === 'GET') {
      const response = await handleGetProductTypeById(request, env, requestId, productTypeId)
      workerLog(requestId, 'request:done', {
        status: response.status,
        elapsedMs: Date.now() - startedAt
      })
      return response
    }

    if (request.method === 'POST' && pathname === '/api/product-types') {
      const response = await handleCreateProductType(request, env, requestId)
      workerLog(requestId, 'request:done', {
        status: response.status,
        elapsedMs: Date.now() - startedAt
      })
      return response
    }

    if (productTypeId !== null && request.method === 'PATCH') {
      const response = await handleUpdateProductType(request, env, requestId, productTypeId)
      workerLog(requestId, 'request:done', {
        status: response.status,
        elapsedMs: Date.now() - startedAt
      })
      return response
    }

    if (productTypeId !== null && request.method === 'DELETE') {
      const response = await handleDeleteProductType(request, env, requestId, productTypeId)
      workerLog(requestId, 'request:done', {
        status: response.status,
        elapsedMs: Date.now() - startedAt
      })
      return response
    }

    if (request.method === 'POST' && pathname === '/api/upload') {
      const response = await handleUpload(request, env, requestId)
      workerLog(requestId, 'request:done', {
        status: response.status,
        elapsedMs: Date.now() - startedAt
      })
      return response
    }

    if (request.method === 'GET' && pathname === '/api/assets') {
      const response = await handleListAssets(request, env, requestId)
      workerLog(requestId, 'request:done', {
        status: response.status,
        elapsedMs: Date.now() - startedAt
      })
      return response
    }

    if (request.method === 'GET' && pathname.startsWith('/api/assets/')) {
      const response = await handleAssetGet(
        request,
        env,
        decodeURIComponent(pathname.replace('/api/assets/', '')),
        requestId
      )
      workerLog(requestId, 'request:done', {
        status: response.status,
        elapsedMs: Date.now() - startedAt
      })
      return response
    }

    if (request.method === 'DELETE' && pathname.startsWith('/api/assets/')) {
      const response = await handleDeleteAsset(
        request,
        env,
        decodeURIComponent(pathname.replace('/api/assets/', '')),
        requestId
      )
      workerLog(requestId, 'request:done', {
        status: response.status,
        elapsedMs: Date.now() - startedAt
      })
      return response
    }

    const response = json(request, env, { success: false, error: 'Not found' }, 404)
    workerLog(requestId, 'request:done', {
      status: response.status,
      elapsedMs: Date.now() - startedAt
    })
    return response
  },
  async scheduled(_controller, env): Promise<void> {
    await runScheduledShipmentSync(env)
  }
} satisfies ExportedHandler<Env>
