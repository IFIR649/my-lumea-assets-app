import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  DollarSign,
  PackagePlus,
  Pencil,
  RefreshCw,
  Save,
  Trash2,
  UploadCloud,
  Wifi,
  WifiOff,
  XCircle
} from 'lucide-react'
import { cn } from './lib/utils'
import OrdersManager from './components/OrdersManager'

type View = 'create' | 'products' | 'orders' | 'connections'
type Msg = { type: 'error' | 'success' | 'info'; text: string } | null

type ImageOptimization = {
  optimizedSize: number
  savedBytes: number
  savedPercent: number
  outputType: string
}

type ImageRecord = {
  id: string
  name: string
  url: string
  size: number
  file: File
  originalSize: number
  optimization: ImageOptimization | null
}
type Product = {
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

type ProductType = {
  id: number
  type: string
  sort: number
}

type ConnectionStatus = {
  r2: { ok: boolean; error: string | null }
  d1: { ok: boolean; error: string | null }
  checking: boolean
}

type ProductForm = {
  title: string
  slug: string
  type: string
  price: string
  stock: string
  short_desc: string
  description: string
}

type EditForm = {
  title: string
  slug: string
  type: string
  price_cents: string
  stock: string
  image_key: string
}

const EMPTY_FORM: ProductForm = {
  title: '',
  slug: '',
  type: '',
  price: '',
  stock: '1',
  short_desc: '',
  description: ''
}

const EMPTY_EDIT: EditForm = {
  title: '',
  slug: '',
  type: '',
  price_cents: '0',
  stock: '0',
  image_key: ''
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function normalizeType(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
}

function fmtSize(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function fmtMoney(cents: number): string {
  return (cents / 100).toFixed(2)
}

function createImageRecord(file: File): ImageRecord {
  return {
    id: `${file.name}-${file.lastModified}-${file.size}-${Math.random().toString(36).slice(2, 7)}`,
    name: file.name,
    url: URL.createObjectURL(file),
    size: file.size,
    file,
    originalSize: file.size,
    optimization: null
  }
}

function replaceExt(name: string, ext: string): string {
  const cleanExt = ext.startsWith('.') ? ext : `.${ext}`
  const dotIndex = name.lastIndexOf('.')
  if (dotIndex <= 0) return `${name}${cleanExt}`
  return `${name.slice(0, dotIndex)}${cleanExt}`
}

function loadImage(file: File): Promise<{ image: HTMLImageElement; url: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => resolve({ image, url })
    image.onerror = (event) => {
      URL.revokeObjectURL(url)
      reject(event)
    }
    image.src = url
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('No se pudo generar imagen optimizada.'))
          return
        }
        resolve(blob)
      },
      type,
      quality
    )
  })
}

async function optimizeImageFile(file: File): Promise<File> {
  const { image, url } = await loadImage(file)
  try {
    const sourceWidth = image.naturalWidth || image.width
    const sourceHeight = image.naturalHeight || image.height
    if (!sourceWidth || !sourceHeight) {
      throw new Error('No se pudo leer el tamano de la imagen.')
    }

    const maxDimension = 2200
    const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight))
    const targetWidth = Math.max(1, Math.round(sourceWidth * scale))
    const targetHeight = Math.max(1, Math.round(sourceHeight * scale))

    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = targetHeight

    const context = canvas.getContext('2d', { alpha: true })
    if (!context) {
      throw new Error('No se pudo abrir el contexto de render.')
    }

    context.drawImage(image, 0, 0, targetWidth, targetHeight)
    const blob = await canvasToBlob(canvas, 'image/webp', 0.92)
    const outputType = blob.type || 'image/webp'
    const ext = outputType.includes('png')
      ? 'png'
      : outputType.includes('jpeg')
        ? 'jpg'
        : 'webp'
    const nextName = replaceExt(file.name, ext)

    return new File([blob], nextName, {
      type: outputType,
      lastModified: Date.now()
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

function log(msg: string, data?: unknown): void {
  if (data === undefined) console.info(`[app] ${msg}`)
  else console.info(`[app] ${msg}`, data)
}

function err(msg: string, e: unknown): void {
  console.error(`[app] ${msg}`, e)
}

async function requestJson<T>(path: string, init?: RequestInit, timeoutMs = 10000): Promise<T> {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(path, { ...init, signal: controller.signal })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(body || `Request failed (${res.status})`)
    }
    return (await res.json()) as T
  } catch (e) {
    err(`request ${init?.method || 'GET'} ${path}`, e)
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error(`Timeout en ${path}`)
    }
    throw e
  } finally {
    window.clearTimeout(timeoutId)
  }
}

function App(): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  const imagesRef = useRef<ImageRecord[]>([])
  const [view, setView] = useState<View>('create')
  const [images, setImages] = useState<ImageRecord[]>([])
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null)
  const [optimizingImageId, setOptimizingImageId] = useState<string | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [productTypes, setProductTypes] = useState<ProductType[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [loadingTypes, setLoadingTypes] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingTypeId, setEditingTypeId] = useState<number | null>(null)
  const [editingTypeValue, setEditingTypeValue] = useState('')
  const [newTypeValue, setNewTypeValue] = useState('')
  const [typeActionId, setTypeActionId] = useState<number | null>(null)
  const [productTypeFilter, setProductTypeFilter] = useState<string>('all')
  const [edit, setEdit] = useState<EditForm>(EMPTY_EDIT)
  const [msg, setMsg] = useState<Msg>(null)
  const [typeMsg, setTypeMsg] = useState<Msg>(null)
  const [slugTouched, setSlugTouched] = useState(false)
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM)
  const [conn, setConn] = useState<ConnectionStatus>({
    r2: { ok: false, error: null },
    d1: { ok: false, error: null },
    checking: true
  })

  const selectedImage = images.find((x) => x.id === selectedImageId) ?? null
  const connected = conn.r2.ok && conn.d1.ok

  useEffect(() => {
    void checkConnections()
    void loadProducts()
    void loadProductTypes()
  }, [])

  useEffect(() => {
    imagesRef.current = images
  }, [images])

  useEffect(() => {
    return () => {
      for (const img of imagesRef.current) URL.revokeObjectURL(img.url)
    }
  }, [])

  const checkConnections = async (): Promise<void> => {
    setConn((c) => ({ ...c, checking: true }))
    try {
      const status = await requestJson<Omit<ConnectionStatus, 'checking'>>('/api/health', undefined, 12000)
      setConn({ ...status, checking: false })
    } catch (e) {
      const text = e instanceof Error ? e.message : 'error'
      setConn({
        r2: { ok: false, error: `No se pudo verificar R2: ${text}` },
        d1: { ok: false, error: `No se pudo verificar D1: ${text}` },
        checking: false
      })
    }
  }

  const loadProducts = async (): Promise<void> => {
    setLoadingProducts(true)
    try {
      const data = await requestJson<{ success: boolean; products?: Product[]; error?: string }>('/api/products')
      setProducts(data.success ? data.products || [] : [])
    } finally {
      setLoadingProducts(false)
    }
  }

  const syncTypeSelection = (types: ProductType[]): void => {
    const fallbackType = types[0]?.type ?? ''
    setForm((current) => {
      if (!fallbackType) return { ...current, type: '' }
      const exists = types.some((item) => item.type === current.type)
      return exists ? current : { ...current, type: fallbackType }
    })
    setEdit((current) => {
      if (!current) return current
      if (!fallbackType) return { ...current, type: '' }
      const exists = types.some((item) => item.type === current.type)
      return exists ? current : { ...current, type: fallbackType }
    })
    setProductTypeFilter((current) => {
      if (current === 'all') return current
      return types.some((item) => item.type === current) ? current : 'all'
    })
  }

  const loadProductTypes = async (): Promise<void> => {
    setLoadingTypes(true)
    try {
      const data = await requestJson<{ success: boolean; types?: ProductType[]; error?: string }>(
        '/api/product-types'
      )
      const nextTypes = data.success ? data.types || [] : []
      setProductTypes(nextTypes)
      syncTypeSelection(nextTypes)
    } catch (e) {
      setTypeMsg({ type: 'error', text: e instanceof Error ? e.message : 'Error cargando types.' })
    } finally {
      setLoadingTypes(false)
    }
  }

  const createProductType = async (): Promise<void> => {
    const type = normalizeType(newTypeValue)
    if (!type) return setTypeMsg({ type: 'error', text: 'Type invalido.' })
    setTypeActionId(-1)
    try {
      const res = await requestJson<{ success: boolean; type?: ProductType; error?: string }>(
        '/api/product-types',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type })
        }
      )
      if (!res.success || !res.type) throw new Error(res.error || 'No se pudo crear type.')
      const next = [...productTypes, res.type].sort((a, b) => b.sort - a.sort || a.type.localeCompare(b.type))
      setProductTypes(next)
      syncTypeSelection(next)
      setNewTypeValue('')
      setTypeMsg({ type: 'success', text: `Type "${res.type.type}" creado.` })
    } catch (e) {
      setTypeMsg({ type: 'error', text: e instanceof Error ? e.message : 'Error creando type.' })
    } finally {
      setTypeActionId(null)
    }
  }

  const startEditType = (type: ProductType): void => {
    setEditingTypeId(type.id)
    setEditingTypeValue(type.type)
    setTypeMsg(null)
  }

  const cancelEditType = (): void => {
    setEditingTypeId(null)
    setEditingTypeValue('')
  }

  const saveEditType = async (type: ProductType): Promise<void> => {
    const normalized = normalizeType(editingTypeValue)
    if (!normalized) return setTypeMsg({ type: 'error', text: 'Type invalido.' })
    setTypeActionId(type.id)
    try {
      const res = await requestJson<{
        success: boolean
        type?: ProductType
        migrated_products?: number
        error?: string
      }>(`/api/product-types/${type.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: normalized })
      })
      if (!res.success || !res.type) throw new Error(res.error || 'No se pudo editar type.')

      const next = productTypes
        .map((item) => (item.id === type.id ? res.type! : item))
        .sort((a, b) => b.sort - a.sort || a.type.localeCompare(b.type))
      setProductTypes(next)
      syncTypeSelection(next)

      if (type.type !== res.type.type) {
        setProducts((current) =>
          current.map((product) =>
            product.type === type.type ? { ...product, type: res.type!.type } : product
          )
        )
      }

      setTypeMsg({
        type: 'success',
        text:
          res.migrated_products && res.migrated_products > 0
            ? `Type actualizado, ${res.migrated_products} producto(s) migrado(s).`
            : 'Type actualizado.'
      })
      cancelEditType()
    } catch (e) {
      setTypeMsg({ type: 'error', text: e instanceof Error ? e.message : 'Error editando type.' })
    } finally {
      setTypeActionId(null)
    }
  }

  const removeType = async (type: ProductType): Promise<void> => {
    if (!window.confirm(`Eliminar type "${type.type}"?`)) return
    setTypeActionId(type.id)
    try {
      const res = await requestJson<{ success: boolean; error?: string }>(`/api/product-types/${type.id}`, {
        method: 'DELETE'
      })
      if (!res.success) throw new Error(res.error || 'No se pudo eliminar type.')
      const next = productTypes.filter((item) => item.id !== type.id)
      setProductTypes(next)
      syncTypeSelection(next)
      if (editingTypeId === type.id) cancelEditType()
      setTypeMsg({ type: 'success', text: `Type "${type.type}" eliminado.` })
    } catch (e) {
      setTypeMsg({ type: 'error', text: e instanceof Error ? e.message : 'Error eliminando type.' })
    } finally {
      setTypeActionId(null)
    }
  }

  const chooseFiles = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/'))
    log('images:selected', { count: files.length })
    if (files.length === 0) return
    const next = files.map(createImageRecord)
    setImages((prev) => {
      for (const img of prev) URL.revokeObjectURL(img.url)
      return next
    })
    setSelectedImageId(next[0]?.id ?? null)
  }

  const optimizeSelectedImage = async (): Promise<void> => {
    if (!selectedImage) {
      setMsg({ type: 'error', text: 'Selecciona una imagen para optimizar.' })
      return
    }

    setOptimizingImageId(selectedImage.id)
    setMsg({ type: 'info', text: 'Optimizando imagen...' })

    try {
      const optimizedFile = await optimizeImageFile(selectedImage.file)
      const originalSize = selectedImage.originalSize
      const optimizedSize = optimizedFile.size

      if (optimizedSize >= selectedImage.size) {
        setMsg({
          type: 'info',
          text: `No hubo mejora de peso. Se conserva original (${fmtSize(selectedImage.size)}).`
        })
        return
      }

      const savedBytes = Math.max(0, originalSize - optimizedSize)
      const savedPercent = originalSize > 0 ? (savedBytes / originalSize) * 100 : 0

      setImages((current) =>
        current.map((img) => {
          if (img.id !== selectedImage.id) return img
          URL.revokeObjectURL(img.url)
          return {
            ...img,
            name: optimizedFile.name,
            file: optimizedFile,
            url: URL.createObjectURL(optimizedFile),
            size: optimizedSize,
            optimization: {
              optimizedSize,
              savedBytes,
              savedPercent,
              outputType: optimizedFile.type || 'image/webp'
            }
          }
        })
      )

      setMsg({
        type: 'success',
        text: `Imagen optimizada: ${fmtSize(originalSize)} -> ${fmtSize(optimizedSize)} (${savedPercent.toFixed(1)}% menos).`
      })
    } catch (e) {
      setMsg({
        type: 'error',
        text: e instanceof Error ? e.message : 'No se pudo optimizar la imagen.'
      })
    } finally {
      setOptimizingImageId(null)
    }
  }

  const submitCreate = async (ev: React.FormEvent): Promise<void> => {
    ev.preventDefault()
    if (!connected) return setMsg({ type: 'error', text: 'R2 y D1 deben estar conectados.' })
    if (!selectedImage) return setMsg({ type: 'error', text: 'Selecciona una imagen.' })
    const slug = slugify(form.slug || form.title)
    const selectedType = normalizeType(form.type)
    const price = Math.round(Number.parseFloat(form.price) * 100)
    const stock = Number.parseInt(form.stock, 10)
    if (
      !slug ||
      !selectedType ||
      !Number.isFinite(price) ||
      price < 0 ||
      !Number.isInteger(stock) ||
      stock < 0
    ) {
      return setMsg({ type: 'error', text: 'Datos invalidos en formulario.' })
    }
    setSubmitting(true)
    setMsg({ type: 'info', text: 'Subiendo imagen y creando producto...' })
    try {
      const fd = new FormData()
      fd.set('file', selectedImage.file, selectedImage.name)
      const up = await requestJson<{ success: boolean; key?: string; error?: string }>('/api/upload', { method: 'POST', body: fd }, 60000)
      if (!up.success || !up.key) throw new Error(up.error || 'Upload fallo')
      const res = await requestJson<{ success: boolean; error?: string }>(
        '/api/products',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: form.title.trim(),
            slug,
            type: selectedType,
            short_desc: form.short_desc.trim(),
            description: form.description.trim(),
            price_cents: price,
            stock,
            image_key: up.key
          })
        },
        15000
      )
      if (!res.success) throw new Error(res.error || 'No se pudo crear')
      setMsg({ type: 'success', text: 'Producto creado.' })
      setForm({ ...EMPTY_FORM, type: selectedType })
      setSlugTouched(false)
      setSelectedImageId(null)
      await loadProducts()
      setView('products')
    } catch (e) {
      setMsg({ type: 'error', text: e instanceof Error ? e.message : 'Error' })
    } finally {
      setSubmitting(false)
    }
  }

  const startEdit = (p: Product): void => {
    setEditingId(p.id)
    setEdit({
      title: p.title,
      slug: p.slug,
      type: p.type,
      price_cents: String(p.price_cents),
      stock: String(p.stock),
      image_key: p.image_key || ''
    })
  }

  const saveEdit = async (): Promise<void> => {
    if (!editingId) return
    const normalizedType = normalizeType(edit.type)
    const payload = {
      title: edit.title.trim(),
      slug: slugify(edit.slug),
      type: normalizedType,
      price_cents: Number.parseInt(edit.price_cents, 10),
      stock: Number.parseInt(edit.stock, 10),
      image_key: edit.image_key.trim()
    }
    if (!payload.slug || !payload.type) {
      setMsg({ type: 'error', text: 'Datos invalidos para editar producto.' })
      return
    }
    setMsg({ type: 'info', text: 'Actualizando producto...' })
    try {
      const res = await requestJson<{ success: boolean; error?: string }>(`/api/products/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.success) throw new Error(res.error || 'No se pudo actualizar')
      setEditingId(null)
      setEdit(EMPTY_EDIT)
      setMsg({ type: 'success', text: 'Producto actualizado.' })
      await loadProducts()
    } catch (e) {
      setMsg({ type: 'error', text: e instanceof Error ? e.message : 'Error' })
    }
  }

  const deleteProduct = async (id: number, title: string): Promise<void> => {
    if (!window.confirm(`Eliminar "${title}"?`)) return
    try {
      const res = await requestJson<{ success: boolean; error?: string }>(`/api/products/${id}`, { method: 'DELETE' })
      if (!res.success) throw new Error(res.error || 'No se pudo eliminar')
      setMsg({ type: 'success', text: 'Producto eliminado.' })
      await loadProducts()
    } catch (e) {
      setMsg({ type: 'error', text: e instanceof Error ? e.message : 'Error' })
    }
  }

  const filteredProducts =
    productTypeFilter === 'all'
      ? products
      : products.filter((product) => product.type === productTypeFilter)

  const renderTypeCrud = (): React.JSX.Element => (
    <div className="mb-4 rounded-3xl border border-white/5 bg-white/[0.02] p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Catalogo type</p>
          <p className="text-sm text-zinc-400">CRUD rapido para evitar error humano en altas.</p>
        </div>
        <button
          type="button"
          onClick={() => void loadProductTypes()}
          className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs font-semibold"
        >
          <RefreshCw className={cn('h-4 w-4', loadingTypes && 'animate-spin')} />
          Recargar types
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <input
          value={newTypeValue}
          onChange={(e) => setNewTypeValue(normalizeType(e.target.value))}
          placeholder="Nuevo type (ej: ring)"
          className="min-w-[180px] flex-1 rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => void createProductType()}
          disabled={typeActionId === -1}
          className={cn(
            'rounded-xl px-3 py-2 text-xs font-semibold',
            typeActionId === -1 ? 'cursor-not-allowed bg-surface200 text-zinc-500' : 'bg-brand text-black'
          )}
        >
          Agregar
        </button>
      </div>

      {typeMsg && (
        <div
          className={cn(
            'mt-3 rounded-xl px-3 py-2 text-sm',
            typeMsg.type === 'error' && 'bg-rose-500/10 text-rose-200',
            typeMsg.type === 'success' && 'bg-emerald-500/10 text-emerald-200',
            typeMsg.type === 'info' && 'bg-sky-500/10 text-sky-200'
          )}
        >
          {typeMsg.text}
        </div>
      )}

      <div className="mt-3 space-y-2">
        {productTypes.map((type) => (
          <div
            key={type.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2"
          >
            {editingTypeId === type.id ? (
              <div className="flex w-full flex-wrap items-center gap-2">
                <input
                  value={editingTypeValue}
                  onChange={(e) => setEditingTypeValue(normalizeType(e.target.value))}
                  className="min-w-[160px] flex-1 rounded-lg border border-white/10 bg-surface100 px-3 py-1.5 text-sm"
                />
                <button
                  type="button"
                  onClick={() => void saveEditType(type)}
                  disabled={typeActionId === type.id}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-semibold',
                    typeActionId === type.id
                      ? 'cursor-not-allowed bg-surface200 text-zinc-500'
                      : 'bg-brand text-black'
                  )}
                >
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={cancelEditType}
                  className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-semibold"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <>
                <div>
                  <p className="text-sm font-semibold text-zinc-100">{type.type}</p>
                  <p className="text-[11px] text-zinc-500">sort: {type.sort}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => startEditType(type)}
                    className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1.5 text-xs font-semibold"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeType(type)}
                    disabled={typeActionId === type.id}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold',
                      typeActionId === type.id
                        ? 'cursor-not-allowed bg-rose-500/20 text-rose-300'
                        : 'bg-rose-500/15 text-rose-200'
                    )}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Eliminar
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen flex-col bg-surface text-zinc-200">
      <header className="sticky top-0 z-20 border-b border-white/5 bg-gradient-to-r from-surface100 via-surface100 to-surface/95 backdrop-blur-sm">
        <div className="flex min-h-14 items-center justify-between gap-3 px-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-brand/20 bg-brand/10 shadow-glow"><PackagePlus className="h-5 w-5 text-brand" /></div>
            <div><p className="text-[11px] uppercase tracking-[0.28em] text-brand/70">Lumea Imperium</p><h1 className="text-xs font-semibold tracking-[0.18em] sm:text-sm">Gestor Web</h1></div>
          </div>
          <button onClick={() => void checkConnections()} className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-white/10">Recargar conexiones</button>
        </div>
        <nav className="flex gap-2 overflow-x-auto border-t border-white/5 px-3 py-2 sm:px-6">
          {(['create', 'products', 'orders', 'connections'] as View[]).map((v) => (
            <button key={v} onClick={() => setView(v)} className={cn('rounded-lg px-3 py-2 text-xs font-semibold', view === v ? 'bg-brand text-black' : 'bg-white/5 text-zinc-300')}>
              {v === 'create' ? 'Crear' : v === 'products' ? 'Productos' : v === 'orders' ? 'Pedidos' : 'Conexiones'}
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1 px-3 py-4 sm:px-6 sm:py-6">
        {msg && <div className={cn('mb-4 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm', msg.type === 'error' && 'bg-rose-500/5 text-rose-200', msg.type === 'success' && 'bg-emerald-500/5 text-emerald-200', msg.type === 'info' && 'bg-sky-500/5 text-sky-200')}>{msg.type === 'error' ? <AlertCircle className="h-4 w-4" /> : msg.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <RefreshCw className="h-4 w-4 animate-spin" />}<span>{msg.text}</span></div>}

        {view === 'create' && (
          <div className="mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
            <form onSubmit={(e) => void submitCreate(e)} className="rounded-3xl border border-white/5 bg-white/[0.02] p-4 sm:p-6">
              {renderTypeCrud()}
              <div className="grid gap-4 md:grid-cols-2">
                <input value={form.title} required onChange={(e) => setForm((c) => ({ ...c, title: e.target.value, slug: !slugTouched || !c.slug.trim() ? slugify(e.target.value) : c.slug }))} placeholder="Titulo" className="w-full rounded-xl border border-white/5 bg-surface100 px-3 py-3 text-sm outline-none" />
                <input value={form.slug} required onChange={(e) => { setSlugTouched(true); setForm((c) => ({ ...c, slug: slugify(e.target.value) })) }} placeholder="slug" className="w-full rounded-xl border border-white/5 bg-surface100 px-3 py-3 text-sm outline-none" />
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <label className="relative block"><DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" /><input value={form.price} required type="number" min="0" step="0.01" onChange={(e) => setForm((c) => ({ ...c, price: e.target.value }))} placeholder="Precio MXN" className="w-full rounded-xl border border-white/5 bg-surface100 py-3 pl-9 pr-3 text-sm outline-none" /></label>
                <input value={form.stock} required type="number" min="0" step="1" onChange={(e) => setForm((c) => ({ ...c, stock: e.target.value }))} placeholder="Stock" className="w-full rounded-xl border border-white/5 bg-surface100 px-3 py-3 text-sm outline-none" />
                <select
                  value={form.type}
                  onChange={(e) => setForm((c) => ({ ...c, type: e.target.value }))}
                  disabled={productTypes.length === 0}
                  className="w-full rounded-xl border border-white/5 bg-surface100 px-3 py-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {productTypes.length === 0 ? (
                    <option value="">Sin types</option>
                  ) : (
                    productTypes.map((type) => (
                      <option key={type.id} value={type.type}>
                        {type.type}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <input value={form.short_desc} required onChange={(e) => setForm((c) => ({ ...c, short_desc: e.target.value }))} placeholder="Descripcion corta" className="mt-4 w-full rounded-xl border border-white/5 bg-surface100 px-3 py-3 text-sm outline-none" />
              <textarea value={form.description} rows={4} onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))} placeholder="Descripcion completa" className="mt-4 w-full resize-none rounded-xl border border-white/5 bg-surface100 px-3 py-3 text-sm outline-none" />
              {msg && <div className={cn('mt-4 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm', msg.type === 'error' && 'bg-rose-500/5 text-rose-200', msg.type === 'success' && 'bg-emerald-500/5 text-emerald-200', msg.type === 'info' && 'bg-sky-500/5 text-sky-200')}>{msg.type === 'error' ? <AlertCircle className="h-4 w-4" /> : msg.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <RefreshCw className="h-4 w-4 animate-spin" />}<span>{msg.text}</span></div>}
              <button type="submit" disabled={submitting || !connected || !selectedImage || !form.type} className={cn('mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold', submitting || !connected || !selectedImage || !form.type ? 'bg-surface200 text-zinc-500' : 'bg-brand text-black')}><UploadCloud className="h-4 w-4" />{submitting ? 'Procesando...' : 'Subir y crear producto'}</button>
            </form>
            <aside className="rounded-3xl border border-white/5 bg-white/[0.02] p-4 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold">Selector local web</h3>
                <button
                  onClick={() => inputRef.current?.click()}
                  className="rounded-xl bg-white/5 px-3 py-2 text-xs font-semibold"
                >
                  Elegir imagenes
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={chooseFiles}
                  className="hidden"
                />
              </div>

              {selectedImage && (
                <div className="mt-4 rounded-2xl bg-black/20 p-3">
                  <img
                    src={selectedImage.url}
                    alt={selectedImage.name}
                    className="h-40 w-full rounded-xl object-cover sm:h-48"
                    onError={(e) => err('image selected preview', e)}
                  />

                  <div className="mt-2 space-y-1">
                    <p className="text-sm text-zinc-300">{selectedImage.name}</p>
                    <p className="text-xs text-zinc-500">Peso original: {fmtSize(selectedImage.originalSize)}</p>
                    <p className="text-xs text-zinc-400">
                      {selectedImage.optimization
                        ? `Peso optimizado: ${fmtSize(selectedImage.optimization.optimizedSize)} (${selectedImage.optimization.savedPercent.toFixed(1)}% menos)`
                        : `Peso actual: ${fmtSize(selectedImage.size)}`}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void optimizeSelectedImage()}
                    disabled={optimizingImageId === selectedImage.id || submitting}
                    className={cn(
                      'mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold',
                      optimizingImageId === selectedImage.id || submitting
                        ? 'cursor-not-allowed bg-surface200 text-zinc-500'
                        : 'bg-white/10 text-zinc-100 hover:bg-white/15'
                    )}
                  >
                    <RefreshCw className={cn('h-4 w-4', optimizingImageId === selectedImage.id && 'animate-spin')} />
                    {optimizingImageId === selectedImage.id ? 'Optimizando...' : 'Optimizar tamaño'}
                  </button>
                </div>
              )}

              {images.length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2">
                  {images.map((img) => (
                    <button
                      key={img.id}
                      type="button"
                      onClick={() => setSelectedImageId(img.id)}
                      className={cn(
                        'overflow-hidden rounded-xl border',
                        selectedImageId === img.id ? 'border-brand' : 'border-white/10'
                      )}
                    >
                      <img
                        src={img.url}
                        alt={img.name}
                        className="aspect-square w-full object-cover"
                        onError={(e) => err(`image grid ${img.name}`, e)}
                      />
                    </button>
                  ))}
                </div>
              )}
            </aside>
          </div>
        )}

        {view === 'products' && (
          <div className="mx-auto w-full max-w-7xl">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-3xl border border-white/5 bg-white/[0.02] p-4"><h2 className="text-xl font-semibold">Productos ({loadingProducts ? '...' : filteredProducts.length})</h2><div className="flex flex-wrap items-center gap-2"><select value={productTypeFilter} onChange={(e) => setProductTypeFilter(e.target.value)} className="rounded-xl border border-white/10 bg-surface100 px-3 py-2 text-xs"><option value="all">Todos los types</option>{productTypes.map((type) => <option key={type.id} value={type.type}>{type.type}</option>)}</select><button onClick={() => void loadProducts()} className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm font-semibold"><RefreshCw className="h-4 w-4" />Recargar</button></div></div>
            {loadingProducts ? <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 text-sm text-zinc-500">Cargando productos...</div> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{filteredProducts.map((p) => <article key={p.id} className="rounded-3xl border border-white/5 bg-white/[0.02] p-4">{editingId === p.id ? <div className="space-y-2"><input value={edit.title} onChange={(e) => setEdit((c) => ({ ...c, title: e.target.value }))} className="w-full rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm" /><input value={edit.slug} onChange={(e) => setEdit((c) => ({ ...c, slug: e.target.value }))} className="w-full rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm" /><select value={edit.type} onChange={(e) => setEdit((c) => ({ ...c, type: e.target.value }))} className="w-full rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm">{productTypes.map((type) => <option key={type.id} value={type.type}>{type.type}</option>)}{!productTypes.some((type) => type.type === edit.type) && <option value={edit.type}>{edit.type || 'sin-type'}</option>}</select><div className="grid grid-cols-2 gap-2"><input value={edit.price_cents} onChange={(e) => setEdit((c) => ({ ...c, price_cents: e.target.value }))} className="w-full rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm" /><input value={edit.stock} onChange={(e) => setEdit((c) => ({ ...c, stock: e.target.value }))} className="w-full rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm" /></div><input value={edit.image_key} onChange={(e) => setEdit((c) => ({ ...c, image_key: e.target.value }))} className="w-full rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm" /><div className="flex gap-2"><button onClick={() => void saveEdit()} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-black"><Save className="h-4 w-4" />Guardar</button><button onClick={() => { setEditingId(null); setEdit(EMPTY_EDIT) }} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm font-semibold"><XCircle className="h-4 w-4" />Cancelar</button></div></div> : <div className="space-y-2"><h3 className="text-lg font-semibold">{p.title}</h3><p className="text-xs text-zinc-500">/{p.slug}</p><p className="text-xs text-zinc-500">Type: {p.type}</p><p className="text-xs text-zinc-500">Precio: ${fmtMoney(p.price_cents)} | Stock: {p.stock}</p><p className="truncate text-xs text-zinc-500">image_key: {p.image_key || 'N/A'}</p><div className="flex gap-2"><button onClick={() => startEdit(p)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm font-semibold"><Pencil className="h-4 w-4" />Editar</button><button onClick={() => void deleteProduct(p.id, p.title)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-500/15 px-3 py-2 text-sm font-semibold text-rose-200"><Trash2 className="h-4 w-4" />Eliminar</button></div></div>}</article>)}</div>}
          </div>
        )}

        {view === 'orders' && <OrdersManager />}

        {view === 'connections' && (
          <div className="mx-auto w-full max-w-5xl space-y-4">
            <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-4"><h2 className="text-xl font-semibold">Conexiones</h2><p className="mt-2 text-sm text-zinc-500">URL actual: {window.location.origin}</p></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-4"><p className="text-xs uppercase text-zinc-500">R2</p><p className={cn('mt-2 text-sm font-semibold', conn.r2.ok ? 'text-emerald-300' : 'text-rose-300')}>{conn.r2.ok ? 'Conectado' : 'Con error'}</p>{conn.r2.error && <p className="mt-2 text-xs text-zinc-400">{conn.r2.error}</p>}</div>
              <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-4"><p className="text-xs uppercase text-zinc-500">D1</p><p className={cn('mt-2 text-sm font-semibold', conn.d1.ok ? 'text-emerald-300' : 'text-rose-300')}>{conn.d1.ok ? 'Conectado' : 'Con error'}</p>{conn.d1.error && <p className="mt-2 text-xs text-zinc-400">{conn.d1.error}</p>}</div>
            </div>
            <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-4 text-sm text-zinc-400">
              <p className="flex items-center gap-2"><Wifi className="h-4 w-4" />Para telefono usa la IP LAN real (ejemplo: 192.168.100.4), no la host-only 192.168.56.1.</p>
              <p className="mt-2 flex items-center gap-2"><WifiOff className="h-4 w-4" />Si no abre, revisa firewall para puertos 5173 y 8787.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
