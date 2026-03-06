interface Env {
  DB: D1Database
  ASSETS_BUCKET: R2Bucket
  R2_PUBLIC_BASE_URL?: string
  CORS_ORIGIN?: string
  ADMIN_API_TOKEN?: string
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
}

type ProductPayload = {
  slug: string
  title: string
  type?: string
  description?: string
  short_desc?: string
  price_cents: number
  stock?: number
  image_key: string
}

type ProductUpdatePayload = Partial<ProductPayload>

type NormalizedProductPayload = Omit<ProductPayload, 'stock'> & {
  stock: number
}

type ProductTypeRow = {
  id: number
  type: string
  sort: number
}

type ShippingStatus = 'pending' | 'preparing' | 'in_transit' | 'delivered' | 'cancelled' | 'lost'

type DisplayStatus =
  | 'cancelado'
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

const SHIPPING_STATUS_VALUES = [
  'pending',
  'preparing',
  'in_transit',
  'delivered',
  'cancelled',
  'lost'
] as const satisfies readonly ShippingStatus[]

const DISPLAY_STATUS_VALUES = [
  'cancelado',
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

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error'
}

function getChangesFromRun(result: unknown): number {
  if (!result || typeof result !== 'object') return 0
  const meta = (result as { meta?: unknown }).meta
  if (!meta || typeof meta !== 'object') return 0
  const changes = (meta as { changes?: unknown }).changes
  return typeof changes === 'number' ? changes : 0
}

function getProductIdFromPath(pathname: string): number | null {
  const match = pathname.match(/^\/api\/products\/(\d+)$/)
  if (!match) return null

  const value = Number.parseInt(match[1], 10)
  if (!Number.isInteger(value) || value <= 0) return null

  return value
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

function normalizeType(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
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
        timer = setTimeout(() => reject(new Error(`${label} timeout after ${timeoutMs}ms`)), timeoutMs)
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

async function tableHasColumn(env: Env, tableName: string, columnName: string): Promise<boolean> {
  const rows = await env.DB.prepare(`PRAGMA table_info(${tableName})`).all<{ name: string }>()
  return (rows.results || []).some((row) => row.name === columnName)
}

async function ensureOrdersAdminSchema(env: Env, requestId: string): Promise<void> {
  if (!ensureOrdersAdminSchemaPromise) {
    ensureOrdersAdminSchemaPromise = (async () => {
      workerLog(requestId, 'orders:schema:start')

      const hasShippingStatus = await tableHasColumn(env, 'orders', 'shipping_status')
      if (!hasShippingStatus) {
        await env.DB.prepare("ALTER TABLE orders ADD COLUMN shipping_status TEXT NOT NULL DEFAULT 'pending'").run()
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
        "CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC)"
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

function assertAdminToken(request: Request, env: Env): { ok: true } | { ok: false; status: number; error: string } {
  const expected = env.ADMIN_API_TOKEN?.trim()
  if (!expected) {
    return { ok: false, status: 500, error: 'ADMIN_API_TOKEN no configurado.' }
  }

  const actual = readBearerToken(request)
  if (!actual) return { ok: false, status: 401, error: 'Authorization Bearer requerido.' }
  if (actual !== expected) return { ok: false, status: 403, error: 'Token invalido.' }
  return { ok: true }
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

  const normalizedType = normalizeType(payload.type || 'ring')
  return {
    slug: String(payload.slug || '').trim(),
    title: String(payload.title || '').trim(),
    type: normalizedType || 'ring',
    description: String(payload.description || '').trim(),
    short_desc: String(payload.short_desc || '').trim(),
    price_cents: Number(payload.price_cents),
    stock: Number.isFinite(payload.stock) ? Number(payload.stock) : 0,
    image_key: String(payload.image_key || '').trim()
  }
}

async function readProductUpdatePayload(request: Request): Promise<ProductUpdatePayload> {
  return (await request.json()) as ProductUpdatePayload
}

function buildUpdateStatement(payload: ProductUpdatePayload): { clauses: string[]; values: unknown[] } {
  const clauses: string[] = []
  const values: unknown[] = []

  if (payload.slug !== undefined) {
    const slug = String(payload.slug).trim()
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

  return { clauses, values }
}

async function handleHealth(request: Request, env: Env, requestId: string): Promise<Response> {
  const startedAt = Date.now()
  workerLog(requestId, 'health:start')
  const status = {
    r2: { ok: true, error: null as string | null },
    d1: { ok: true, error: null as string | null }
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
    await withTimeout(ensureOrdersAdminSchema(env, requestId), 8000, 'D1 orders admin schema ensure')
  } catch (error) {
    workerError(requestId, 'health:d1:error', error)
    status.d1 = {
      ok: false,
      error: `Fallo en D1: ${getErrorMessage(error)}`
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
    let result: D1Result<ProductRow>
    if (typeFilter) {
      result = await env.DB.prepare(
        `
          SELECT id, title, slug, type, description, short_desc, price_cents, stock, image_key
          FROM products
          WHERE type = ?
          ORDER BY id DESC
        `
      )
        .bind(typeFilter)
        .all<ProductRow>()
    } else {
      result = await env.DB.prepare(
        `
          SELECT id, title, slug, type, description, short_desc, price_cents, stock, image_key
          FROM products
          ORDER BY id DESC
        `
      ).all<ProductRow>()
    }

    workerLog(requestId, 'products:list:ok', { count: result.results?.length || 0 })
    return json(request, env, { success: true, products: result.results || [] })
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
    const product = await env.DB.prepare(
      `
        SELECT id, title, slug, type, description, short_desc, price_cents, stock, image_key
        FROM products
        WHERE id = ?
      `
    )
      .bind(productId)
      .first<ProductRow>()

    if (!product) {
      return json(request, env, { success: false, error: 'Producto no encontrado.' }, 404)
    }

    workerLog(requestId, 'products:get:ok')
    return json(request, env, { success: true, product })
  } catch (error) {
    workerError(requestId, 'products:get:error', error)
    return json(request, env, { success: false, error: `Error leyendo producto: ${getErrorMessage(error)}` }, 500)
  }
}

async function handleCreateProduct(request: Request, env: Env, requestId: string): Promise<Response> {
  workerLog(requestId, 'products:create:start')
  try {
    const payload = await readProductPayload(request)
    workerLog(requestId, 'products:create:payload', {
      slug: payload.slug,
      title: payload.title,
      type: payload.type,
      price_cents: payload.price_cents,
      stock: payload.stock,
      image_key: payload.image_key
    })

    if (!payload.slug) return json(request, env, { success: false, error: 'El slug es obligatorio.' }, 400)
    if (!payload.title) {
      return json(request, env, { success: false, error: 'El titulo es obligatorio.' }, 400)
    }
    if (!payload.image_key) {
      return json(request, env, { success: false, error: 'La imagen principal es obligatoria.' }, 400)
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
      return json(request, env, { success: false, error: 'stock debe ser un entero mayor o igual a 0.' }, 400)
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

    await env.DB.prepare(
      `
        INSERT INTO products (slug, title, type, description, short_desc, price_cents, stock, image_key)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
      .bind(
        payload.slug,
        payload.title,
        payload.type,
        payload.description,
        payload.short_desc,
        payload.price_cents,
        payload.stock,
        payload.image_key
      )
      .run()

    workerLog(requestId, 'products:create:ok')
    return json(request, env, { success: true }, 201)
  } catch (error) {
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
    const payload = await readProductUpdatePayload(request)
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
    const { clauses, values } = buildUpdateStatement(payload)
    if (clauses.length === 0) {
      return json(request, env, { success: false, error: 'No se enviaron campos para actualizar.' }, 400)
    }

    const sql = `UPDATE products SET ${clauses.join(', ')} WHERE id = ?`
    const result = await env.DB.prepare(sql)
      .bind(...values, productId)
      .run()

    if (getChangesFromRun(result) === 0) {
      return json(request, env, { success: false, error: 'Producto no encontrado.' }, 404)
    }

    workerLog(requestId, 'products:update:ok', { updatedFields: clauses.length })
    return json(request, env, { success: true })
  } catch (error) {
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

async function handleGetProductTypes(request: Request, env: Env, requestId: string): Promise<Response> {
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
    const type = await env.DB.prepare('SELECT id, type, sort FROM product_types WHERE id = ? LIMIT 1')
      .bind(productTypeId)
      .first<ProductTypeRow>()

    if (!type) return json(request, env, { success: false, error: 'Type no encontrado.' }, 404)

    workerLog(requestId, 'types:get:ok')
    return json(request, env, { success: true, type })
  } catch (error) {
    workerError(requestId, 'types:get:error', error)
    return json(request, env, { success: false, error: `Error leyendo type: ${getErrorMessage(error)}` }, 500)
  }
}

async function handleCreateProductType(request: Request, env: Env, requestId: string): Promise<Response> {
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

    const created = await env.DB.prepare('SELECT id, type, sort FROM product_types WHERE type = ? LIMIT 1')
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
    const current = await env.DB.prepare('SELECT id, type, sort FROM product_types WHERE id = ? LIMIT 1')
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

    const updated = await env.DB.prepare('SELECT id, type, sort FROM product_types WHERE id = ? LIMIT 1')
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
    const current = await env.DB.prepare('SELECT id, type, sort FROM product_types WHERE id = ? LIMIT 1')
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
    q: String(url.searchParams.get('q') || '').trim().toLowerCase(),
    status: DISPLAY_STATUS_VALUES.includes(statusValue) ? statusValue : '',
    amountMinCents,
    amountMaxCents,
    dateFrom: parseDateInput(url.searchParams.get('date_from')),
    dateTo: parseDateInput(url.searchParams.get('date_to')),
    qtyMin,
    qtyMax,
    productQuery: String(url.searchParams.get('product_q') || '').trim().toLowerCase()
  }

  return { page, limit, filters }
}

const DISPLAY_STATUS_SQL = `CASE
  WHEN lower(COALESCE(o.shipping_status, '')) = 'cancelled' OR o.status = 'cancelled' THEN 'cancelado'
  WHEN lower(COALESCE(o.shipping_status, '')) = 'lost' THEN 'perdido'
  WHEN o.status = 'unpaid' THEN 'pendiente_pago'
  WHEN lower(COALESCE(o.shipping_status, '')) = 'preparing' THEN 'preparando_envio'
  WHEN lower(COALESCE(o.shipping_status, '')) = 'in_transit' OR o.status = 'shipped' THEN 'en_camino'
  WHEN lower(COALESCE(o.shipping_status, '')) = 'delivered' THEN 'entregado'
  ELSE 'pagado'
END`

async function handleGetOrders(request: Request, env: Env, requestId: string): Promise<Response> {
  workerLog(requestId, 'orders:list:start')
  try {
    await ensureOrdersAdminSchema(env, requestId)

    const url = new URL(request.url)
    const { page, limit, filters } = readOrderFilters(url)

    const whereClauses: string[] = ['1 = 1']
    const binds: unknown[] = []

    if (filters.q) {
      whereClauses.push('(lower(o.id) LIKE ? OR lower(COALESCE(o.stripe_session_id, \'\')) LIKE ?)')
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
    return json(request, env, { success: false, error: `Error obteniendo pedidos: ${getErrorMessage(error)}` }, 500)
  }
}

async function fetchOrderDetail(env: Env, orderId: string): Promise<null | Record<string, unknown>> {
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
    reservations: (reservationsResult.results || []).map((row) => ({
      ...row,
      quantity: Number(row.quantity || 0)
    })),
    stripe_events: stripeEventsResult.results || []
  }
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
    return json(request, env, { success: false, error: `Error obteniendo pedido: ${getErrorMessage(error)}` }, 500)
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
      return json(request, env, { success: false, error: `Campos no permitidos: ${unknown.join(', ')}` }, 400)
    }
    if (keys.length === 0) {
      return json(request, env, { success: false, error: 'No se enviaron campos para actualizar.' }, 400)
    }

    const clauses: string[] = []
    const values: unknown[] = []

    if (payload.shipping_status !== undefined) {
      const shippingStatus = normalizeShippingStatus(payload.shipping_status)
      if (!shippingStatus) {
        return json(
          request,
          env,
          { success: false, error: `shipping_status invalido. Valores: ${SHIPPING_STATUS_VALUES.join(', ')}` },
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
      const value = String(payload.customer_email || '').trim().toLowerCase()
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
          return json(request, env, { success: false, error: 'shipping_address_json no es JSON valido.' }, 400)
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
    return json(request, env, { success: false, error: `Error actualizando pedido: ${getErrorMessage(error)}` }, 500)
  }
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
      return json(request, env, { success: false, error: 'Solo se permiten archivos de imagen.' }, 400)
    }

    const safeName = sanitizeFileName(uploadFile.name)
    const key = `products/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName}`

    await env.ASSETS_BUCKET.put(key, uploadFile.stream(), {
      httpMetadata: { contentType: uploadFile.type || 'application/octet-stream' }
    })

    const baseUrl = env.R2_PUBLIC_BASE_URL?.trim().replace(/\/+$/, '')
    const url = baseUrl ? `${baseUrl}/${key}` : `/api/assets/${encodeURIComponent(key)}`

    workerLog(requestId, 'upload:ok', { key, url })
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

async function handleAssetGet(request: Request, env: Env, key: string, requestId: string): Promise<Response> {
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

export default {
  async fetch(request, env): Promise<Response> {
    const requestId = crypto.randomUUID().slice(0, 8)
    const { pathname, search } = new URL(request.url)
    const startedAt = Date.now()
    const productId = getProductIdFromPath(pathname)
    const productTypeId = getProductTypeIdFromPath(pathname)
    const orderId = getOrderIdFromPath(pathname)
    workerLog(requestId, 'request:start', {
      method: request.method,
      pathname,
      search,
      productId,
      productTypeId,
      orderId
    })

    if (request.method === 'OPTIONS') {
      const response = new Response(null, { status: 204, headers: withCors(request, env) })
      workerLog(requestId, 'request:done', { status: response.status, elapsedMs: Date.now() - startedAt })
      return response
    }

    if (request.method === 'GET' && pathname === '/api/health') {
      const response = await handleHealth(request, env, requestId)
      workerLog(requestId, 'request:done', { status: response.status, elapsedMs: Date.now() - startedAt })
      return response
    }

    if (request.method === 'GET' && pathname === '/api/products') {
      const response = await handleGetProducts(request, env, requestId)
      workerLog(requestId, 'request:done', { status: response.status, elapsedMs: Date.now() - startedAt })
      return response
    }

    if (request.method === 'GET' && pathname === '/api/orders') {
      const response = await handleGetOrders(request, env, requestId)
      workerLog(requestId, 'request:done', { status: response.status, elapsedMs: Date.now() - startedAt })
      return response
    }

    if (orderId !== null && request.method === 'GET') {
      const response = await handleGetOrderById(request, env, requestId, orderId)
      workerLog(requestId, 'request:done', { status: response.status, elapsedMs: Date.now() - startedAt })
      return response
    }

    if (orderId !== null && request.method === 'PATCH') {
      const response = await handlePatchOrderById(request, env, requestId, orderId)
      workerLog(requestId, 'request:done', { status: response.status, elapsedMs: Date.now() - startedAt })
      return response
    }

    if (productId !== null && request.method === 'GET') {
      const response = await handleGetProductById(request, env, requestId, productId)
      workerLog(requestId, 'request:done', { status: response.status, elapsedMs: Date.now() - startedAt })
      return response
    }

    if (request.method === 'POST' && pathname === '/api/products') {
      const response = await handleCreateProduct(request, env, requestId)
      workerLog(requestId, 'request:done', { status: response.status, elapsedMs: Date.now() - startedAt })
      return response
    }

    if (productId !== null && request.method === 'PATCH') {
      const response = await handleUpdateProduct(request, env, requestId, productId)
      workerLog(requestId, 'request:done', { status: response.status, elapsedMs: Date.now() - startedAt })
      return response
    }

    if (productId !== null && request.method === 'DELETE') {
      const response = await handleDeleteProduct(request, env, requestId, productId)
      workerLog(requestId, 'request:done', { status: response.status, elapsedMs: Date.now() - startedAt })
      return response
    }

    if (request.method === 'GET' && pathname === '/api/product-types') {
      const response = await handleGetProductTypes(request, env, requestId)
      workerLog(requestId, 'request:done', { status: response.status, elapsedMs: Date.now() - startedAt })
      return response
    }

    if (productTypeId !== null && request.method === 'GET') {
      const response = await handleGetProductTypeById(request, env, requestId, productTypeId)
      workerLog(requestId, 'request:done', { status: response.status, elapsedMs: Date.now() - startedAt })
      return response
    }

    if (request.method === 'POST' && pathname === '/api/product-types') {
      const response = await handleCreateProductType(request, env, requestId)
      workerLog(requestId, 'request:done', { status: response.status, elapsedMs: Date.now() - startedAt })
      return response
    }

    if (productTypeId !== null && request.method === 'PATCH') {
      const response = await handleUpdateProductType(request, env, requestId, productTypeId)
      workerLog(requestId, 'request:done', { status: response.status, elapsedMs: Date.now() - startedAt })
      return response
    }

    if (productTypeId !== null && request.method === 'DELETE') {
      const response = await handleDeleteProductType(request, env, requestId, productTypeId)
      workerLog(requestId, 'request:done', { status: response.status, elapsedMs: Date.now() - startedAt })
      return response
    }

    if (request.method === 'POST' && pathname === '/api/upload') {
      const response = await handleUpload(request, env, requestId)
      workerLog(requestId, 'request:done', { status: response.status, elapsedMs: Date.now() - startedAt })
      return response
    }

    if (request.method === 'GET' && pathname.startsWith('/api/assets/')) {
      const response = await handleAssetGet(
        request,
        env,
        decodeURIComponent(pathname.replace('/api/assets/', '')),
        requestId
      )
      workerLog(requestId, 'request:done', { status: response.status, elapsedMs: Date.now() - startedAt })
      return response
    }

    const response = json(request, env, { success: false, error: 'Not found' }, 404)
    workerLog(requestId, 'request:done', { status: response.status, elapsedMs: Date.now() - startedAt })
    return response
  }
} satisfies ExportedHandler<Env>
