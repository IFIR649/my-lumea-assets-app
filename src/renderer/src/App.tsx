import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  ImagePlus,
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
import AnalyticsManager from './components/AnalyticsManager'
import ShipmentsManager from './components/ShipmentsManager'
import VariantsManager from './components/VariantsManager'
import ReviewsManager from './components/ReviewsManager'
import AssetsManager from './components/AssetsManager'
import {
  createImageRecord,
  fmtSize,
  optimizeImageFile,
  revokeImageRecordUrls,
  type ImageRecord
} from './lib/image-tools'

type View =
  | 'create'
  | 'assets'
  | 'products'
  | 'variants'
  | 'reviews'
  | 'orders'
  | 'shipments'
  | 'connections'
  | 'analytics'
type Msg = { type: 'error' | 'success' | 'info'; text: string } | null

type ProductImage = {
  id: number
  position: number
  image_key: string
  alt: string
  url: string
}

type EditGalleryImage = {
  id: string
  image_key: string
  alt_text: string
  localImage: ImageRecord | null
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
  images?: ProductImage[]
}

type ProductType = {
  id: number
  type: string
  sort: number
}

type SchemaHealth = {
  products_enriched: boolean
  product_variants: boolean
  product_reviews: boolean
  order_shipments: boolean
}

type EnviaHealth = {
  configured: boolean
  mode: 'test' | 'prod'
  shipping: { ok: boolean; error: string | null }
  queries: { ok: boolean; error: string | null }
  geocodes: { ok: boolean; error: string | null }
  checked_at: string
}

type ConnectionStatus = {
  r2: { ok: boolean; error: string | null }
  d1: { ok: boolean; error: string | null }
  schema: SchemaHealth
  envia: EnviaHealth
  checking: boolean
}

type ProductForm = {
  title: string
  slug: string
  seo_slug: string
  type: string
  price: string
  stock: string
  short_desc: string
  description: string
  sku: string
  brand: string
  material: string
  base_metal: string
  finish_text: string
  main_color: string
  hypoallergenic: boolean
  care_instructions: string
  gift_ready: boolean
  package_includes: string
  shipping_time_min_days: string
  shipping_time_max_days: string
  return_window_days: string
  is_bestseller: boolean
  is_new_arrival: boolean
  is_active: boolean
  is_featured: boolean
  currency: string
  sort: string
}

type EditForm = {
  title: string
  slug: string
  seo_slug: string
  type: string
  short_desc: string
  description: string
  price_cents: string
  stock: string
  image_key: string
  sku: string
  brand: string
  material: string
  base_metal: string
  finish_text: string
  main_color: string
  hypoallergenic: boolean
  care_instructions: string
  gift_ready: boolean
  package_includes: string
  shipping_time_min_days: string
  shipping_time_max_days: string
  return_window_days: string
  is_bestseller: boolean
  is_new_arrival: boolean
  is_active: boolean
  is_featured: boolean
  currency: string
  sort: string
}

const EMPTY_FORM: ProductForm = {
  title: '',
  slug: '',
  seo_slug: '',
  type: '',
  price: '',
  stock: '1',
  short_desc: '',
  description: '',
  sku: '',
  brand: 'Lumea Imperium',
  material: '',
  base_metal: '',
  finish_text: '',
  main_color: '',
  hypoallergenic: false,
  care_instructions: '',
  gift_ready: true,
  package_includes: '',
  shipping_time_min_days: '',
  shipping_time_max_days: '',
  return_window_days: '30',
  is_bestseller: false,
  is_new_arrival: false,
  is_active: true,
  is_featured: false,
  currency: 'MXN',
  sort: '0'
}

const EMPTY_EDIT: EditForm = {
  title: '',
  slug: '',
  seo_slug: '',
  type: '',
  short_desc: '',
  description: '',
  price_cents: '0',
  stock: '0',
  image_key: '',
  sku: '',
  brand: '',
  material: '',
  base_metal: '',
  finish_text: '',
  main_color: '',
  hypoallergenic: false,
  care_instructions: '',
  gift_ready: true,
  package_includes: '',
  shipping_time_min_days: '',
  shipping_time_max_days: '',
  return_window_days: '',
  is_bestseller: false,
  is_new_arrival: false,
  is_active: true,
  is_featured: false,
  currency: 'MXN',
  sort: ''
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

function fmtMoney(cents: number): string {
  return (cents / 100).toFixed(2)
}

function toNullableText(value: unknown): string | undefined {
  const normalized = String(value || '').trim()
  return normalized || undefined
}

function boolFromFlag(value: number | null | undefined, fallback = false): boolean {
  if (value === null || value === undefined) return fallback
  return Number(value) > 0
}

function parseOptionalNonNegativeInt(value: string): number | null | typeof Number.NaN {
  const normalized = value.trim()
  if (!normalized) return null
  const parsed = Number.parseInt(normalized, 10)
  if (!Number.isInteger(parsed) || parsed < 0) return Number.NaN
  return parsed
}

function moveListItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (
    fromIndex < 0 ||
    fromIndex >= items.length ||
    toIndex < 0 ||
    toIndex >= items.length ||
    fromIndex === toIndex
  ) {
    return items
  }

  const next = [...items]
  const [item] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, item)
  return next
}

function defaultImageAlt(title: string, index: number): string {
  const normalizedTitle = title.trim()
  if (!normalizedTitle) return `Imagen ${index + 1}`
  return `${normalizedTitle} imagen ${index + 1}`
}

function toStoredEditGalleryImage(image: ProductImage, index: number): EditGalleryImage {
  return {
    id: `stored-${image.id || index}-${image.image_key}`,
    image_key: image.image_key,
    alt_text: image.alt || '',
    localImage: null
  }
}

function getEditImagePreviewUrl(image: EditGalleryImage): string {
  if (image.localImage?.url) return image.localImage.url
  const imageKey = String(image.image_key || '').trim()
  return imageKey ? `/api/assets/${encodeURIComponent(imageKey)}` : '/product-placeholder.svg'
}

function disposeEditGalleryImages(images: EditGalleryImage[]): void {
  const localImages = images
    .map((image) => image.localImage)
    .filter((image): image is ImageRecord => Boolean(image))
  if (localImages.length > 0) {
    revokeImageRecordUrls(localImages)
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
    const text = await res.text()
    let payload: unknown = null
    if (text) {
      try {
        payload = JSON.parse(text)
      } catch {
        payload = text
      }
    }
    if (!res.ok) {
      if (payload && typeof payload === 'object' && 'error' in payload) {
        const message = String((payload as { error?: unknown }).error || '').trim()
        throw new Error(message || `Request failed (${res.status})`)
      }
      throw new Error(
        typeof payload === 'string' && payload ? payload : `Request failed (${res.status})`
      )
    }
    return payload as T
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
  const editImageInputRef = useRef<HTMLInputElement>(null)
  const editImageTargetRef = useRef<string | null>(null)
  const imagesRef = useRef<ImageRecord[]>([])
  const editImagesRef = useRef<EditGalleryImage[]>([])
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
  const [createImageAlts, setCreateImageAlts] = useState<Record<string, string>>({})
  const [editImages, setEditImages] = useState<EditGalleryImage[]>([])
  const [msg, setMsg] = useState<Msg>(null)
  const [typeMsg, setTypeMsg] = useState<Msg>(null)
  const [slugTouched, setSlugTouched] = useState(false)
  const [seoSlugTouched, setSeoSlugTouched] = useState(false)
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM)
  const [conn, setConn] = useState<ConnectionStatus>({
    r2: { ok: false, error: null },
    d1: { ok: false, error: null },
    schema: {
      products_enriched: false,
      product_variants: false,
      product_reviews: false,
      order_shipments: false
    },
    envia: {
      configured: false,
      mode: 'test',
      shipping: { ok: false, error: null },
      queries: { ok: false, error: null },
      geocodes: { ok: false, error: null },
      checked_at: ''
    },
    checking: true
  })

  const selectedImage = images.find((x) => x.id === selectedImageId) ?? null
  const connected = conn.r2.ok && conn.d1.ok
  const apiProxyTarget = import.meta.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8787'
  const productOptions = useMemo(
    () => products.map((product) => ({ id: product.id, title: product.title, slug: product.slug })),
    [products]
  )

  useEffect(() => {
    void checkConnections()
    void loadProducts()
    void loadProductTypes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    imagesRef.current = images
  }, [images])

  useEffect(() => {
    editImagesRef.current = editImages
  }, [editImages])

  useEffect(() => {
    return () => {
      revokeImageRecordUrls(imagesRef.current)
      disposeEditGalleryImages(editImagesRef.current)
    }
  }, [])

  const checkConnections = async (): Promise<void> => {
    setConn((c) => ({ ...c, checking: true }))
    try {
      const status = await requestJson<{
        r2: { ok: boolean; error: string | null }
        d1: { ok: boolean; error: string | null }
        schema?: Partial<SchemaHealth>
        envia?: Partial<EnviaHealth>
      }>('/api/health', undefined, 12000)
      setConn({
        r2: status.r2,
        d1: status.d1,
        schema: {
          products_enriched: Boolean(status.schema?.products_enriched),
          product_variants: Boolean(status.schema?.product_variants),
          product_reviews: Boolean(status.schema?.product_reviews),
          order_shipments: Boolean(status.schema?.order_shipments)
        },
        envia: {
          configured: Boolean(status.envia?.configured),
          mode: status.envia?.mode === 'prod' ? 'prod' : 'test',
          shipping: {
            ok: Boolean(status.envia?.shipping?.ok),
            error: status.envia?.shipping?.error || null
          },
          queries: {
            ok: Boolean(status.envia?.queries?.ok),
            error: status.envia?.queries?.error || null
          },
          geocodes: {
            ok: Boolean(status.envia?.geocodes?.ok),
            error: status.envia?.geocodes?.error || null
          },
          checked_at: status.envia?.checked_at || ''
        },
        checking: false
      })
    } catch (e) {
      const text = e instanceof Error ? e.message : 'error'
      setConn({
        r2: { ok: false, error: `No se pudo verificar R2: ${text}` },
        d1: { ok: false, error: `No se pudo verificar D1: ${text}` },
        schema: {
          products_enriched: false,
          product_variants: false,
          product_reviews: false,
          order_shipments: false
        },
        envia: {
          configured: false,
          mode: 'test',
          shipping: { ok: false, error: text },
          queries: { ok: false, error: text },
          geocodes: { ok: false, error: text },
          checked_at: ''
        },
        checking: false
      })
    }
  }

  const loadProducts = async (): Promise<void> => {
    setLoadingProducts(true)
    try {
      const data = await requestJson<{ success: boolean; products?: Product[]; error?: string }>(
        '/api/products'
      )
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
      const next = [...productTypes, res.type].sort(
        (a, b) => b.sort - a.sort || a.type.localeCompare(b.type)
      )
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
      const res = await requestJson<{ success: boolean; error?: string }>(
        `/api/product-types/${type.id}`,
        {
          method: 'DELETE'
        }
      )
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

    const limitedFiles = files.slice(0, 3)
    if (files.length > 3) {
      setMsg({ type: 'info', text: 'Solo se tomaran las primeras 3 imagenes.' })
    }

    const next = limitedFiles.map(createImageRecord)
    setImages((prev) => {
      revokeImageRecordUrls(prev)
      return next
    })
    setCreateImageAlts(() =>
      Object.fromEntries(next.map((image, index) => [image.id, defaultImageAlt(form.title, index)]))
    )
    setSelectedImageId(next[0]?.id ?? null)
    e.target.value = ''
  }

  const updateCreateImageAlt = (imageId: string, value: string): void => {
    setCreateImageAlts((current) => ({ ...current, [imageId]: value }))
  }

  const moveCreateImage = (fromIndex: number, toIndex: number): void => {
    setImages((current) => {
      const next = moveListItem(current, fromIndex, toIndex)
      setSelectedImageId((selected) => {
        if (!selected) return selected
        return next.some((image) => image.id === selected) ? selected : (next[0]?.id ?? null)
      })
      setCreateImageAlts((currentAlts) =>
        Object.fromEntries(
          next.map((image, index) => [
            image.id,
            currentAlts[image.id] || defaultImageAlt(form.title, index)
          ])
        )
      )
      return next
    })
  }

  const removeCreateImage = (imageId: string): void => {
    setImages((current) => {
      const target = current.find((image) => image.id === imageId)
      if (target) revokeImageRecordUrls([target])
      const next = current.filter((image) => image.id !== imageId)
      setSelectedImageId((selected) => {
        if (selected && selected !== imageId) return selected
        return next[0]?.id ?? null
      })
      setCreateImageAlts((currentAlts) => {
        const nextAlts = { ...currentAlts }
        delete nextAlts[imageId]
        return Object.fromEntries(
          next.map((image, index) => [
            image.id,
            nextAlts[image.id] || defaultImageAlt(form.title, index)
          ])
        )
      })
      return next
    })
  }

  const uploadImageRecord = async (image: ImageRecord): Promise<string> => {
    const fd = new FormData()
    fd.set('file', image.file, image.name)
    const upload = await requestJson<{ success: boolean; key?: string; error?: string }>(
      '/api/upload',
      { method: 'POST', body: fd },
      60000
    )
    if (!upload.success || !upload.key) {
      throw new Error(upload.error || 'Upload fallo')
    }
    return upload.key
  }

  const replaceEditImageWithFile = (targetId: string, file: File): void => {
    const nextRecord = createImageRecord(file)
    setEditImages((current) =>
      current.map((image) => {
        if (image.id !== targetId) return image
        if (image.localImage) revokeImageRecordUrls([image.localImage])
        return {
          ...image,
          localImage: nextRecord
        }
      })
    )
  }

  const addEditImageFromFile = (file: File): void => {
    setEditImages((current) => {
      if (current.length >= 3) return current
      return [
        ...current,
        {
          id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          image_key: '',
          alt_text: defaultImageAlt(edit.title || form.title, current.length),
          localImage: createImageRecord(file)
        }
      ]
    })
  }

  const addEmptyEditImage = (): void => {
    setEditImages((current) => {
      if (current.length >= 3) return current
      return [
        ...current,
        {
          id: `empty-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          image_key: '',
          alt_text: defaultImageAlt(edit.title || form.title, current.length),
          localImage: null
        }
      ]
    })
  }

  const triggerEditFilePicker = (targetId: string | null = null): void => {
    editImageTargetRef.current = targetId
    editImageInputRef.current?.click()
  }

  const chooseEditImageFile = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(e.target.files ?? []).filter((file) => file.type.startsWith('image/'))
    if (!files.length) return

    const targetId = editImageTargetRef.current
    if (targetId) {
      replaceEditImageWithFile(targetId, files[0])
    } else {
      for (const file of files.slice(0, Math.max(0, 3 - editImages.length))) {
        addEditImageFromFile(file)
      }
      if (files.length > Math.max(0, 3 - editImages.length)) {
        setMsg({ type: 'info', text: 'El maximo es 3 imagenes por producto.' })
      }
    }

    editImageTargetRef.current = null
    e.target.value = ''
  }

  const moveEditImage = (fromIndex: number, toIndex: number): void => {
    setEditImages((current) => moveListItem(current, fromIndex, toIndex))
  }

  const updateEditImage = (targetId: string, patch: Partial<EditGalleryImage>): void => {
    setEditImages((current) =>
      current.map((image) => (image.id === targetId ? { ...image, ...patch } : image))
    )
  }

  const removeEditImage = (targetId: string): void => {
    setEditImages((current) => {
      const target = current.find((image) => image.id === targetId)
      if (target?.localImage) revokeImageRecordUrls([target.localImage])
      return current.filter((image) => image.id !== targetId)
    })
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
          revokeImageRecordUrls([img])
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
    if (images.length === 0)
      return setMsg({ type: 'error', text: 'Selecciona al menos una imagen.' })
    const slug = slugify(form.slug || form.title)
    const seoSlug = slugify(form.seo_slug || slug)
    const selectedType = normalizeType(form.type)
    const price = Math.round(Number.parseFloat(form.price) * 100)
    const stock = Number.parseInt(form.stock, 10)
    const shippingMin = parseOptionalNonNegativeInt(form.shipping_time_min_days)
    const shippingMax = parseOptionalNonNegativeInt(form.shipping_time_max_days)
    const returnWindow = parseOptionalNonNegativeInt(form.return_window_days)
    const sort = parseOptionalNonNegativeInt(form.sort)
    if (
      !slug ||
      !seoSlug ||
      !selectedType ||
      !Number.isFinite(price) ||
      price < 0 ||
      !Number.isInteger(stock) ||
      stock < 0
    ) {
      return setMsg({ type: 'error', text: 'Datos invalidos en formulario.' })
    }
    if (
      Number.isNaN(shippingMin) ||
      Number.isNaN(shippingMax) ||
      Number.isNaN(returnWindow) ||
      Number.isNaN(sort)
    ) {
      return setMsg({
        type: 'error',
        text: 'Tiempos de envio, devolucion y sort deben ser enteros >= 0 o vacios.'
      })
    }
    if (shippingMin !== null && shippingMax !== null && shippingMax < shippingMin) {
      return setMsg({
        type: 'error',
        text: 'shipping_time_max_days no puede ser menor a shipping_time_min_days.'
      })
    }

    setSubmitting(true)
    setMsg({ type: 'info', text: 'Subiendo imagenes y creando producto...' })
    try {
      const uploadedKeys = await Promise.all(images.map((image) => uploadImageRecord(image)))
      const galleryPayload = uploadedKeys.map((imageKey, index) => ({
        position: index + 1,
        image_key: imageKey,
        alt: (createImageAlts[images[index]?.id] || '').trim() || defaultImageAlt(form.title, index)
      }))
      const res = await requestJson<{ success: boolean; error?: string }>(
        '/api/products',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: form.title.trim(),
            slug,
            seo_slug: seoSlug,
            type: selectedType,
            short_desc: form.short_desc.trim(),
            description: form.description.trim(),
            price_cents: price,
            stock,
            image_key: galleryPayload[0]?.image_key || '',
            images: galleryPayload,
            sku: toNullableText(form.sku),
            brand: toNullableText(form.brand),
            material: form.material.trim(),
            base_metal: form.base_metal.trim(),
            finish_text: form.finish_text.trim(),
            main_color: form.main_color.trim(),
            hypoallergenic: form.hypoallergenic ? 1 : 0,
            care_instructions: form.care_instructions.trim(),
            gift_ready: form.gift_ready ? 1 : 0,
            package_includes: form.package_includes.trim(),
            shipping_time_min_days: shippingMin,
            shipping_time_max_days: shippingMax,
            return_window_days: returnWindow === null ? undefined : returnWindow,
            is_bestseller: form.is_bestseller ? 1 : 0,
            is_new_arrival: form.is_new_arrival ? 1 : 0,
            is_active: form.is_active ? 1 : 0,
            is_featured: form.is_featured ? 1 : 0,
            currency: form.currency.trim().toUpperCase() || 'MXN',
            sort: sort === null ? 0 : sort
          })
        },
        15000
      )
      if (!res.success) throw new Error(res.error || 'No se pudo crear')
      setMsg({ type: 'success', text: 'Producto creado.' })
      setForm({ ...EMPTY_FORM, type: selectedType })
      setSlugTouched(false)
      setSeoSlugTouched(false)
      revokeImageRecordUrls(images)
      setImages([])
      setCreateImageAlts({})
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
    disposeEditGalleryImages(editImagesRef.current)
    setEditingId(p.id)
    setEdit({
      title: p.title,
      slug: p.slug,
      seo_slug: p.seo_slug || p.slug,
      type: p.type,
      short_desc: p.short_desc || '',
      description: p.description || '',
      price_cents: String(p.price_cents),
      stock: String(p.stock),
      image_key: p.image_key || '',
      sku: p.sku || '',
      brand: p.brand || '',
      material: p.material || '',
      base_metal: p.base_metal || '',
      finish_text: p.finish_text || '',
      main_color: p.main_color || '',
      hypoallergenic: boolFromFlag(p.hypoallergenic, false),
      care_instructions: p.care_instructions || '',
      gift_ready: boolFromFlag(p.gift_ready, true),
      package_includes: p.package_includes || '',
      shipping_time_min_days:
        p.shipping_time_min_days == null ? '' : String(p.shipping_time_min_days),
      shipping_time_max_days:
        p.shipping_time_max_days == null ? '' : String(p.shipping_time_max_days),
      return_window_days: p.return_window_days == null ? '' : String(p.return_window_days),
      is_bestseller: boolFromFlag(p.is_bestseller, false),
      is_new_arrival: boolFromFlag(p.is_new_arrival, false),
      is_active: boolFromFlag(p.is_active, true),
      is_featured: boolFromFlag(p.is_featured, false),
      currency: (p.currency || 'MXN').toUpperCase(),
      sort: p.sort == null ? '' : String(p.sort)
    })
    setEditImages(
      (Array.isArray(p.images) && p.images.length > 0
        ? p.images
        : p.image_key
          ? [
              {
                id: 0,
                position: 1,
                image_key: p.image_key,
                alt: defaultImageAlt(p.title, 0),
                url: `/api/assets/${encodeURIComponent(p.image_key)}`
              }
            ]
          : []
      ).map((image, index) => toStoredEditGalleryImage(image, index))
    )
  }

  const saveEdit = async (): Promise<void> => {
    if (!editingId) return
    const slug = slugify(edit.slug)
    const seoSlug = slugify(edit.seo_slug || slug)
    const normalizedType = normalizeType(edit.type)
    const shippingMin = parseOptionalNonNegativeInt(edit.shipping_time_min_days)
    const shippingMax = parseOptionalNonNegativeInt(edit.shipping_time_max_days)
    const returnWindow = parseOptionalNonNegativeInt(edit.return_window_days)
    const sort = parseOptionalNonNegativeInt(edit.sort)
    if (!slug || !normalizedType) {
      setMsg({ type: 'error', text: 'Datos invalidos para editar producto.' })
      return
    }
    if (
      Number.isNaN(shippingMin) ||
      Number.isNaN(shippingMax) ||
      Number.isNaN(returnWindow) ||
      Number.isNaN(sort)
    ) {
      setMsg({
        type: 'error',
        text: 'Tiempos de envio, devolucion y sort deben ser enteros >= 0 o vacios.'
      })
      return
    }
    if (shippingMin !== null && shippingMax !== null && shippingMax < shippingMin) {
      setMsg({
        type: 'error',
        text: 'shipping_time_max_days no puede ser menor a shipping_time_min_days.'
      })
      return
    }

    setMsg({ type: 'info', text: 'Subiendo imagenes y actualizando producto...' })

    let galleryPayload: Array<{ position: number; image_key: string; alt: string }> = []
    try {
      galleryPayload = (
        await Promise.all(
          editImages.map(async (image, index) => {
            const imageKey = image.localImage
              ? await uploadImageRecord(image.localImage)
              : image.image_key.trim()
            return {
              position: index + 1,
              image_key: imageKey,
              alt: image.alt_text.trim() || defaultImageAlt(edit.title, index)
            }
          })
        )
      ).filter((image) => image.image_key)
    } catch (e) {
      setMsg({
        type: 'error',
        text: e instanceof Error ? e.message : 'No se pudieron subir imagenes.'
      })
      return
    }

    const payload = {
      title: edit.title.trim(),
      slug,
      seo_slug: seoSlug,
      type: normalizedType,
      short_desc: edit.short_desc.trim(),
      description: edit.description.trim(),
      price_cents: Number.parseInt(edit.price_cents, 10),
      stock: Number.parseInt(edit.stock, 10),
      image_key: galleryPayload[0]?.image_key,
      images: galleryPayload,
      sku: toNullableText(edit.sku),
      brand: toNullableText(edit.brand),
      material: edit.material.trim(),
      base_metal: edit.base_metal.trim(),
      finish_text: edit.finish_text.trim(),
      main_color: edit.main_color.trim(),
      hypoallergenic: edit.hypoallergenic ? 1 : 0,
      care_instructions: edit.care_instructions.trim(),
      gift_ready: edit.gift_ready ? 1 : 0,
      package_includes: edit.package_includes.trim(),
      shipping_time_min_days: shippingMin,
      shipping_time_max_days: shippingMax,
      return_window_days: returnWindow === null ? undefined : returnWindow,
      is_bestseller: edit.is_bestseller ? 1 : 0,
      is_new_arrival: edit.is_new_arrival ? 1 : 0,
      is_active: edit.is_active ? 1 : 0,
      is_featured: edit.is_featured ? 1 : 0,
      currency: edit.currency.trim().toUpperCase() || 'MXN',
      sort: sort === null ? undefined : sort
    }
    try {
      const res = await requestJson<{ success: boolean; error?: string }>(
        `/api/products/${editingId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      )
      if (!res.success) throw new Error(res.error || 'No se pudo actualizar')
      disposeEditGalleryImages(editImagesRef.current)
      setEditingId(null)
      setEdit(EMPTY_EDIT)
      setEditImages([])
      setMsg({ type: 'success', text: 'Producto actualizado.' })
      await loadProducts()
    } catch (e) {
      setMsg({ type: 'error', text: e instanceof Error ? e.message : 'Error' })
    }
  }

  const deleteProduct = async (id: number, title: string): Promise<void> => {
    if (!window.confirm(`Eliminar "${title}"?`)) return
    try {
      const res = await requestJson<{ success: boolean; error?: string }>(`/api/products/${id}`, {
        method: 'DELETE'
      })
      if (!res.success) throw new Error(res.error || 'No se pudo eliminar')
      setMsg({ type: 'success', text: 'Producto eliminado.' })
      await loadProducts()
    } catch (e) {
      setMsg({ type: 'error', text: e instanceof Error ? e.message : 'Error' })
    }
  }

  const cancelEditProduct = (): void => {
    disposeEditGalleryImages(editImagesRef.current)
    editImageTargetRef.current = null
    setEditingId(null)
    setEdit(EMPTY_EDIT)
    setEditImages([])
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
            typeActionId === -1
              ? 'cursor-not-allowed bg-surface200 text-zinc-500'
              : 'bg-brand text-black'
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

  const viewTabs: Array<{ id: View; label: string; hint: string }> = [
    { id: 'create', label: 'Crear', hint: 'Alta de catalogo' },
    { id: 'assets', label: 'Assets', hint: 'Biblioteca R2' },
    { id: 'products', label: 'Productos', hint: 'Edicion completa' },
    { id: 'variants', label: 'Variantes', hint: 'Opciones SKU' },
    { id: 'reviews', label: 'Resenas', hint: 'Moderacion' },
    { id: 'orders', label: 'Pedidos', hint: 'Flujo comercial' },
    { id: 'shipments', label: 'Envios', hint: 'Cotizar y guias' },
    { id: 'connections', label: 'Conexiones', hint: 'Health y entorno' },
    { id: 'analytics', label: 'Inteligencia', hint: 'KPIs y reportes' }
  ]
  const activeView = viewTabs.find((item) => item.id === view) || viewTabs[0]

  return (
    <div className="min-h-screen bg-surface text-zinc-100">
      <div className="mx-auto grid min-h-screen w-full max-w-[1800px] lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="hidden border-r border-white/10 bg-surface100/90 px-4 py-5 lg:flex lg:flex-col lg:gap-5">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand/30 bg-brand/15 shadow-glow">
                <PackagePlus className="h-5 w-5 text-brand" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-brand/70">Lumea</p>
                <h1 className="text-sm font-semibold tracking-[0.1em] text-zinc-100">Gestor Web</h1>
              </div>
            </div>
            <p className="mt-3 text-xs text-zinc-400">Panel operativo del catalogo y logistica.</p>
          </div>

          <nav className="space-y-1 rounded-2xl border border-white/10 bg-black/20 p-2">
            {viewTabs.map((item) => (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={cn(
                  'flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition',
                  view === item.id
                    ? 'bg-brand text-black shadow-sm'
                    : 'text-zinc-300 hover:bg-white/10 hover:text-zinc-100'
                )}
              >
                <span className="font-semibold">{item.label}</span>
                <span
                  className={cn(
                    'text-[11px] uppercase tracking-[0.15em]',
                    view === item.id ? 'text-black/70' : 'text-zinc-500'
                  )}
                >
                  {item.hint}
                </span>
              </button>
            ))}
          </nav>

          <button
            onClick={() => void checkConnections()}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10"
          >
            Recargar conexiones
          </button>
        </aside>

        <div className="flex min-w-0 flex-col">
          <header className="sticky top-0 z-20 border-b border-white/10 bg-surface/95 backdrop-blur">
            <div className="flex min-h-14 items-center justify-between gap-3 px-3 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-brand/25 bg-brand/15 lg:hidden">
                  <PackagePlus className="h-5 w-5 text-brand" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-zinc-100">{activeView.label}</p>
                  <p className="text-[11px] text-zinc-400">{activeView.hint}</p>
                </div>
              </div>
              <button
                onClick={() => void checkConnections()}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-white/10 lg:hidden"
              >
                Recargar
              </button>
            </div>
            <nav className="flex gap-2 overflow-x-auto border-t border-white/10 px-3 py-2 sm:px-6 lg:hidden">
              {viewTabs.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setView(item.id)}
                  className={cn(
                    'whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold',
                    view === item.id ? 'bg-brand text-black' : 'bg-white/5 text-zinc-300'
                  )}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </header>

          <main className="flex-1 px-3 py-4 sm:px-6 sm:py-6">
            <input
              ref={editImageInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={chooseEditImageFile}
              className="hidden"
            />

            {msg && (
              <div
                className={cn(
                  'mb-4 flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm',
                  msg.type === 'error' && 'border-rose-400/30 bg-rose-500/10 text-rose-200',
                  msg.type === 'success' &&
                    'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
                  msg.type === 'info' && 'border-sky-400/30 bg-sky-500/10 text-sky-100'
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

            {view === 'create' && (
              <div className="mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
                <form
                  onSubmit={(e) => void submitCreate(e)}
                  className="rounded-3xl border border-white/5 bg-white/[0.02] p-4 sm:p-6"
                >
                  {renderTypeCrud()}
                  <div className="grid gap-4 md:grid-cols-3">
                    <input
                      value={form.title}
                      required
                      onChange={(e) => {
                        const nextTitle = e.target.value
                        const nextSlug =
                          !slugTouched || !form.slug.trim() ? slugify(nextTitle) : form.slug
                        const nextSeoSlug =
                          !seoSlugTouched || !form.seo_slug.trim()
                            ? slugify(nextSlug || nextTitle)
                            : form.seo_slug
                        setForm((c) => ({
                          ...c,
                          title: nextTitle,
                          slug: nextSlug,
                          seo_slug: nextSeoSlug
                        }))
                      }}
                      placeholder="Titulo"
                      className="w-full rounded-xl border border-white/5 bg-surface100 px-3 py-3 text-sm outline-none"
                    />
                    <input
                      value={form.slug}
                      required
                      onChange={(e) => {
                        const nextSlug = slugify(e.target.value)
                        setSlugTouched(true)
                        setForm((c) => ({
                          ...c,
                          slug: nextSlug,
                          seo_slug: seoSlugTouched ? c.seo_slug : slugify(nextSlug)
                        }))
                      }}
                      placeholder="slug"
                      className="w-full rounded-xl border border-white/5 bg-surface100 px-3 py-3 text-sm outline-none"
                    />
                    <input
                      value={form.seo_slug}
                      required
                      onChange={(e) => {
                        setSeoSlugTouched(true)
                        setForm((c) => ({ ...c, seo_slug: slugify(e.target.value) }))
                      }}
                      placeholder="seo_slug"
                      className="w-full rounded-xl border border-white/5 bg-surface100 px-3 py-3 text-sm outline-none"
                    />
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <label className="relative block">
                      <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                      <input
                        value={form.price}
                        required
                        type="number"
                        min="0"
                        step="0.01"
                        onChange={(e) => setForm((c) => ({ ...c, price: e.target.value }))}
                        placeholder="Precio MXN"
                        className="w-full rounded-xl border border-white/5 bg-surface100 py-3 pl-9 pr-3 text-sm outline-none"
                      />
                    </label>
                    <input
                      value={form.stock}
                      required
                      type="number"
                      min="0"
                      step="1"
                      onChange={(e) => setForm((c) => ({ ...c, stock: e.target.value }))}
                      placeholder="Stock"
                      className="w-full rounded-xl border border-white/5 bg-surface100 px-3 py-3 text-sm outline-none"
                    />
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
                  <input
                    value={form.short_desc}
                    required
                    onChange={(e) => setForm((c) => ({ ...c, short_desc: e.target.value }))}
                    placeholder="Descripcion corta"
                    className="mt-4 w-full rounded-xl border border-white/5 bg-surface100 px-3 py-3 text-sm outline-none"
                  />
                  <textarea
                    value={form.description}
                    rows={4}
                    onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))}
                    placeholder="Descripcion completa"
                    className="mt-4 w-full resize-none rounded-xl border border-white/5 bg-surface100 px-3 py-3 text-sm outline-none"
                  />
                  <section className="mt-6 rounded-2xl border border-white/5 bg-black/20 p-4">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-zinc-300">
                      SEO y comercial
                    </h3>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <input
                        value={form.sku}
                        onChange={(e) => setForm((c) => ({ ...c, sku: e.target.value }))}
                        placeholder="SKU (opcional, backend autocompleta)"
                        className="rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm"
                      />
                      <input
                        value={form.brand}
                        onChange={(e) => setForm((c) => ({ ...c, brand: e.target.value }))}
                        placeholder="Marca"
                        className="rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm"
                      />
                      <input
                        value={form.material}
                        onChange={(e) => setForm((c) => ({ ...c, material: e.target.value }))}
                        placeholder="Material"
                        className="rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm"
                      />
                      <input
                        value={form.base_metal}
                        onChange={(e) => setForm((c) => ({ ...c, base_metal: e.target.value }))}
                        placeholder="Metal base"
                        className="rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm"
                      />
                      <input
                        value={form.finish_text}
                        onChange={(e) => setForm((c) => ({ ...c, finish_text: e.target.value }))}
                        placeholder="Acabado (ej. chapado en oro 18k)"
                        className="rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm"
                      />
                      <input
                        value={form.main_color}
                        onChange={(e) => setForm((c) => ({ ...c, main_color: e.target.value }))}
                        placeholder="Color principal"
                        className="rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm"
                      />
                    </div>
                    <textarea
                      value={form.care_instructions}
                      rows={2}
                      onChange={(e) =>
                        setForm((c) => ({ ...c, care_instructions: e.target.value }))
                      }
                      placeholder="Instrucciones de cuidado"
                      className="mt-3 w-full rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm"
                    />
                    <textarea
                      value={form.package_includes}
                      rows={2}
                      onChange={(e) => setForm((c) => ({ ...c, package_includes: e.target.value }))}
                      placeholder="Incluye empaque"
                      className="mt-3 w-full rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm"
                    />
                    <div className="mt-3 grid gap-3 md:grid-cols-4">
                      <input
                        value={form.shipping_time_min_days}
                        onChange={(e) =>
                          setForm((c) => ({ ...c, shipping_time_min_days: e.target.value }))
                        }
                        placeholder="Envio min dias"
                        className="rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm"
                      />
                      <input
                        value={form.shipping_time_max_days}
                        onChange={(e) =>
                          setForm((c) => ({ ...c, shipping_time_max_days: e.target.value }))
                        }
                        placeholder="Envio max dias"
                        className="rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm"
                      />
                      <input
                        value={form.return_window_days}
                        onChange={(e) =>
                          setForm((c) => ({ ...c, return_window_days: e.target.value }))
                        }
                        placeholder="Ventana devolucion dias"
                        className="rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm"
                      />
                      <input
                        value={form.sort}
                        onChange={(e) => setForm((c) => ({ ...c, sort: e.target.value }))}
                        placeholder="Sort"
                        className="rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <input
                        value={form.currency}
                        onChange={(e) =>
                          setForm((c) => ({ ...c, currency: e.target.value.toUpperCase() }))
                        }
                        placeholder="Moneda (MXN)"
                        className="rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="mt-3 grid gap-2 md:grid-cols-3">
                      <label className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-surface100 px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          checked={form.hypoallergenic}
                          onChange={(e) =>
                            setForm((c) => ({ ...c, hypoallergenic: e.target.checked }))
                          }
                        />
                        Hipoalergenico
                      </label>
                      <label className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-surface100 px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          checked={form.gift_ready}
                          onChange={(e) => setForm((c) => ({ ...c, gift_ready: e.target.checked }))}
                        />
                        Listo para regalo
                      </label>
                      <label className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-surface100 px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          checked={form.is_featured}
                          onChange={(e) =>
                            setForm((c) => ({ ...c, is_featured: e.target.checked }))
                          }
                        />
                        Featured
                      </label>
                      <label className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-surface100 px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          checked={form.is_bestseller}
                          onChange={(e) =>
                            setForm((c) => ({ ...c, is_bestseller: e.target.checked }))
                          }
                        />
                        Bestseller
                      </label>
                      <label className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-surface100 px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          checked={form.is_new_arrival}
                          onChange={(e) =>
                            setForm((c) => ({ ...c, is_new_arrival: e.target.checked }))
                          }
                        />
                        New arrival
                      </label>
                      <label className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-surface100 px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          checked={form.is_active}
                          onChange={(e) => setForm((c) => ({ ...c, is_active: e.target.checked }))}
                        />
                        Activo
                      </label>
                    </div>
                  </section>
                  <button
                    type="submit"
                    disabled={submitting || !connected || images.length === 0 || !form.type}
                    className={cn(
                      'mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold',
                      submitting || !connected || images.length === 0 || !form.type
                        ? 'bg-surface200 text-zinc-500'
                        : 'bg-brand text-black'
                    )}
                  >
                    <UploadCloud className="h-4 w-4" />
                    {submitting ? 'Procesando...' : 'Subir y crear producto'}
                  </button>
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
                        <p className="text-xs text-zinc-500">
                          Posicion {images.findIndex((image) => image.id === selectedImage.id) + 1}{' '}
                          de {images.length}
                        </p>
                        <p className="text-xs text-zinc-500">
                          Peso original: {fmtSize(selectedImage.originalSize)}
                        </p>
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
                        <RefreshCw
                          className={cn(
                            'h-4 w-4',
                            optimizingImageId === selectedImage.id && 'animate-spin'
                          )}
                        />
                        {optimizingImageId === selectedImage.id
                          ? 'Optimizando...'
                          : 'Optimizar tamaño'}
                      </button>

                      <input
                        value={createImageAlts[selectedImage.id] || ''}
                        onChange={(e) => updateCreateImageAlt(selectedImage.id, e.target.value)}
                        placeholder="Texto alternativo"
                        className="mt-3 w-full rounded-xl border border-white/10 bg-surface100 px-3 py-2 text-sm"
                      />

                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const currentIndex = images.findIndex(
                              (image) => image.id === selectedImage.id
                            )
                            moveCreateImage(currentIndex, currentIndex - 1)
                          }}
                          disabled={images.findIndex((image) => image.id === selectedImage.id) <= 0}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:bg-surface200 disabled:text-zinc-500"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Antes
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const currentIndex = images.findIndex(
                              (image) => image.id === selectedImage.id
                            )
                            moveCreateImage(currentIndex, currentIndex + 1)
                          }}
                          disabled={
                            images.findIndex((image) => image.id === selectedImage.id) ===
                            images.length - 1
                          }
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:bg-surface200 disabled:text-zinc-500"
                        >
                          Despues
                          <ChevronRight className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeCreateImage(selectedImage.id)}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-200"
                        >
                          <Trash2 className="h-4 w-4" />
                          Quitar
                        </button>
                      </div>
                    </div>
                  )}

                  {images.length > 0 && (
                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2">
                      {images.map((img) => (
                        <div
                          key={img.id}
                          className={cn(
                            'overflow-hidden rounded-xl border p-2 text-left',
                            selectedImageId === img.id
                              ? 'border-brand bg-brand/5'
                              : 'border-white/10'
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedImageId(img.id)}
                            className="w-full"
                          >
                            <img
                              src={img.url}
                              alt={img.name}
                              className="aspect-square w-full rounded-lg object-cover"
                              onError={(e) => err(`image grid ${img.name}`, e)}
                            />
                          </button>
                          <p className="mt-2 text-[11px] uppercase tracking-[0.22em] text-zinc-500">
                            Slot {images.findIndex((image) => image.id === img.id) + 1}
                          </p>
                          <p className="mt-1 truncate text-xs text-zinc-400">
                            {createImageAlts[img.id] ||
                              defaultImageAlt(
                                form.title,
                                images.findIndex((image) => image.id === img.id)
                              )}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </aside>
              </div>
            )}

            {view === 'assets' && <AssetsManager />}

            {view === 'products' && (
              <div className="flex h-[calc(100vh-80px)] w-full flex-col gap-4 overflow-hidden xl:flex-row">
                {/* Left Panel: Master View (Products List) */}
                <div className="flex flex-1 flex-col overflow-hidden rounded-3xl border border-white/5 bg-white/[0.02]">
                  <div className="flex-shrink-0 border-b border-white/5 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-xl font-semibold">
                        Productos ({loadingProducts ? '...' : filteredProducts.length})
                      </h2>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={productTypeFilter}
                          onChange={(e) => setProductTypeFilter(e.target.value)}
                          className="rounded-xl border border-white/10 bg-surface100 px-3 py-2 text-xs"
                        >
                          <option value="all">Todos los types</option>
                          {productTypes.map((type) => (
                            <option key={type.id} value={type.type}>
                              {type.type}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => void loadProducts()}
                          className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm font-semibold"
                        >
                          <RefreshCw className="h-4 w-4" />
                          Recargar
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="custom-scrollbar flex-1 overflow-y-auto p-4">
                    {loadingProducts ? (
                      <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 text-sm text-zinc-500">
                        Cargando productos...
                      </div>
                    ) : (
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {filteredProducts.map((p) => (
                          <article
                            key={p.id}
                            className={cn(
                              'rounded-3xl border p-4 transition',
                              editingId === p.id
                                ? 'border-brand bg-brand/5'
                                : 'border-white/5 bg-white/[0.02]'
                            )}
                          >
                            <div className="space-y-2">
                              <h3 className="text-lg font-semibold">{p.title}</h3>
                              <p className="text-xs text-zinc-500">/{p.slug}</p>
                              <p className="text-xs text-zinc-500">
                                seo_slug: {p.seo_slug || 'N/A'}
                              </p>
                              <p className="text-xs text-zinc-500">
                                canonical: {p.canonical_path || 'N/A'}
                              </p>
                              <p className="text-xs text-zinc-500">Type: {p.type}</p>
                              <p className="text-xs text-zinc-500">
                                SKU: {p.sku || 'N/A'} | Marca: {p.brand || 'N/A'}
                              </p>
                              <p className="text-xs text-zinc-500">
                                Precio: ${fmtMoney(p.price_cents)} | Stock: {p.stock}
                              </p>
                              {Array.isArray(p.images) && p.images.length > 0 && (
                                <div className="flex items-center gap-2">
                                  <img
                                    src={p.images[0].url}
                                    alt={p.images[0].alt || p.title}
                                    className="h-14 w-14 rounded-lg object-cover"
                                    onError={(e) => err(`product preview ${p.id}`, e)}
                                  />
                                  <p className="text-xs text-zinc-500">
                                    {p.images.length} imagen{p.images.length === 1 ? '' : 'es'}
                                  </p>
                                </div>
                              )}
                              <p className="text-xs text-zinc-500">
                                featured: {boolFromFlag(p.is_featured) ? '1' : '0'} | bestseller:{' '}
                                {boolFromFlag(p.is_bestseller) ? '1' : '0'} | new:{' '}
                                {boolFromFlag(p.is_new_arrival) ? '1' : '0'} | active:{' '}
                                {boolFromFlag(p.is_active, true) ? '1' : '0'}
                              </p>
                              <p className="text-xs text-zinc-500">
                                envio: {p.shipping_time_min_days ?? 'N/A'}-
                                {p.shipping_time_max_days ?? 'N/A'} dias | devolucion:{' '}
                                {p.return_window_days ?? 'N/A'} dias
                              </p>
                              <p className="truncate text-xs text-zinc-500">
                                image_key: {p.image_key || 'N/A'}
                              </p>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => startEdit(p)}
                                  className={cn(
                                    'inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold',
                                    editingId === p.id
                                      ? 'bg-brand text-black'
                                      : 'bg-white/5 text-zinc-100 hover:bg-white/10'
                                  )}
                                >
                                  <Pencil className="h-4 w-4" />
                                  {editingId === p.id ? 'Editando...' : 'Editar'}
                                </button>
                                <button
                                  onClick={() => void deleteProduct(p.id, p.title)}
                                  disabled={editingId === p.id}
                                  className={cn(
                                    'inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold',
                                    editingId === p.id
                                      ? 'cursor-not-allowed bg-surface200 text-zinc-500'
                                      : 'bg-rose-500/15 text-rose-200 hover:bg-rose-500/20'
                                  )}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Eliminar
                                </button>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Panel: Detail View (Edit Form) */}
                <div className="flex flex-shrink-0 flex-col overflow-hidden rounded-3xl border border-white/5 bg-white/[0.02] xl:w-[45%] xl:min-w-[450px]">
                  {editingId ? (
                    <>
                      <div className="flex items-center justify-between border-b border-white/5 p-4">
                        <h2 className="text-xl font-semibold">Editar Producto</h2>
                        <button
                          type="button"
                          onClick={cancelEditProduct}
                          className="inline-flex items-center justify-center rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-white"
                        >
                          <XCircle className="h-5 w-5" />
                        </button>
                      </div>
                      <div className="custom-scrollbar flex-1 overflow-y-auto p-4">
                        <div className="space-y-3">
                          <input
                            value={edit.title}
                            onChange={(e) => setEdit((c) => ({ ...c, title: e.target.value }))}
                            placeholder="title"
                            className="w-full rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm"
                          />
                          <input
                            value={edit.slug}
                            onChange={(e) => setEdit((c) => ({ ...c, slug: e.target.value }))}
                            placeholder="slug"
                            className="w-full rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm"
                          />
                          <input
                            value={edit.seo_slug}
                            onChange={(e) => setEdit((c) => ({ ...c, seo_slug: e.target.value }))}
                            placeholder="seo_slug"
                            className="w-full rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm"
                          />
                          <select
                            value={edit.type}
                            onChange={(e) => setEdit((c) => ({ ...c, type: e.target.value }))}
                            className="w-full rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm"
                          >
                            {productTypes.map((type) => (
                              <option key={type.id} value={type.type}>
                                {type.type}
                              </option>
                            ))}
                            {!productTypes.some((type) => type.type === edit.type) && (
                              <option value={edit.type}>{edit.type || 'sin-type'}</option>
                            )}
                          </select>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              value={edit.price_cents}
                              onChange={(e) =>
                                setEdit((c) => ({ ...c, price_cents: e.target.value }))
                              }
                              placeholder="price_cents"
                              className="w-full rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm"
                            />
                            <input
                              value={edit.stock}
                              onChange={(e) => setEdit((c) => ({ ...c, stock: e.target.value }))}
                              placeholder="stock"
                              className="w-full rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm"
                            />
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                                  Galeria
                                </p>
                                <p className="mt-1 text-xs text-zinc-400">
                                  Hasta 3 imagenes. La primera sera la portada principal.
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={addEmptyEditImage}
                                disabled={editImages.length >= 3}
                                className={cn(
                                  'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold',
                                  editImages.length >= 3
                                    ? 'cursor-not-allowed bg-surface200 text-zinc-500'
                                    : 'bg-white/10 text-zinc-100 hover:bg-white/15'
                                )}
                              >
                                <ImagePlus className="h-4 w-4" />
                                Agregar imagen
                              </button>
                            </div>

                            <div className="mt-3 space-y-3">
                              {editImages.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-sm text-zinc-500">
                                  Este producto aun no tiene imagenes.
                                </div>
                              ) : (
                                editImages.map((image, index) => (
                                  <div
                                    key={image.id}
                                    className="grid gap-3 rounded-xl border border-white/10 bg-surface100/70 p-3"
                                  >
                                    <div className="grid gap-3 sm:grid-cols-[88px_minmax(0,1fr)]">
                                      <img
                                        src={getEditImagePreviewUrl(image)}
                                        alt={image.alt_text || `Imagen ${index + 1}`}
                                        className="aspect-square w-full rounded-lg object-cover"
                                        onError={(e) => err(`edit image preview ${image.id}`, e)}
                                      />
                                      <div className="space-y-2">
                                        <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">
                                          Slot {index + 1}
                                        </p>
                                        <input
                                          value={image.image_key}
                                          onChange={(e) =>
                                            updateEditImage(image.id, { image_key: e.target.value })
                                          }
                                          placeholder="image_key"
                                          className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm"
                                        />
                                        <input
                                          value={image.alt_text}
                                          onChange={(e) =>
                                            updateEditImage(image.id, { alt_text: e.target.value })
                                          }
                                          placeholder="Texto alternativo"
                                          className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm"
                                        />
                                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                          <button
                                            type="button"
                                            onClick={() => triggerEditFilePicker(image.id)}
                                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold"
                                          >
                                            <UploadCloud className="h-4 w-4" />
                                            Reemplazar
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => moveEditImage(index, index - 1)}
                                            disabled={index === 0}
                                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:bg-surface200 disabled:text-zinc-500"
                                          >
                                            <ChevronLeft className="h-4 w-4" />
                                            Antes
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => moveEditImage(index, index + 1)}
                                            disabled={index === editImages.length - 1}
                                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:bg-surface200 disabled:text-zinc-500"
                                          >
                                            Despues
                                            <ChevronRight className="h-4 w-4" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => removeEditImage(image.id)}
                                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-200"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                            Quitar
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                          <input
                            value={edit.sku}
                            onChange={(e) => setEdit((c) => ({ ...c, sku: e.target.value }))}
                            placeholder="sku"
                            className="w-full rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm"
                          />
                          <input
                            value={edit.brand}
                            onChange={(e) => setEdit((c) => ({ ...c, brand: e.target.value }))}
                            placeholder="brand"
                            className="w-full rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm"
                          />
                          <textarea
                            value={edit.short_desc}
                            rows={2}
                            onChange={(e) => setEdit((c) => ({ ...c, short_desc: e.target.value }))}
                            placeholder="short_desc"
                            className="w-full rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm"
                          />
                          <textarea
                            value={edit.description}
                            rows={3}
                            onChange={(e) =>
                              setEdit((c) => ({ ...c, description: e.target.value }))
                            }
                            placeholder="description"
                            className="w-full rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              value={edit.material}
                              onChange={(e) => setEdit((c) => ({ ...c, material: e.target.value }))}
                              placeholder="material"
                              className="w-full rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm"
                            />
                            <input
                              value={edit.base_metal}
                              onChange={(e) =>
                                setEdit((c) => ({ ...c, base_metal: e.target.value }))
                              }
                              placeholder="base_metal"
                              className="w-full rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm"
                            />
                            <input
                              value={edit.finish_text}
                              onChange={(e) =>
                                setEdit((c) => ({ ...c, finish_text: e.target.value }))
                              }
                              placeholder="finish_text"
                              className="w-full rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm"
                            />
                            <input
                              value={edit.main_color}
                              onChange={(e) =>
                                setEdit((c) => ({ ...c, main_color: e.target.value }))
                              }
                              placeholder="main_color"
                              className="w-full rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm"
                            />
                          </div>
                          <textarea
                            value={edit.care_instructions}
                            rows={2}
                            onChange={(e) =>
                              setEdit((c) => ({ ...c, care_instructions: e.target.value }))
                            }
                            placeholder="care_instructions"
                            className="w-full rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm"
                          />
                          <textarea
                            value={edit.package_includes}
                            rows={2}
                            onChange={(e) =>
                              setEdit((c) => ({ ...c, package_includes: e.target.value }))
                            }
                            placeholder="package_includes"
                            className="w-full rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              value={edit.shipping_time_min_days}
                              onChange={(e) =>
                                setEdit((c) => ({ ...c, shipping_time_min_days: e.target.value }))
                              }
                              placeholder="shipping_time_min_days"
                              className="w-full rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm"
                            />
                            <input
                              value={edit.shipping_time_max_days}
                              onChange={(e) =>
                                setEdit((c) => ({ ...c, shipping_time_max_days: e.target.value }))
                              }
                              placeholder="shipping_time_max_days"
                              className="w-full rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm"
                            />
                            <input
                              value={edit.return_window_days}
                              onChange={(e) =>
                                setEdit((c) => ({ ...c, return_window_days: e.target.value }))
                              }
                              placeholder="return_window_days"
                              className="w-full rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm"
                            />
                            <input
                              value={edit.sort}
                              onChange={(e) => setEdit((c) => ({ ...c, sort: e.target.value }))}
                              placeholder="sort"
                              className="w-full rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm"
                            />
                          </div>
                          <input
                            value={edit.currency}
                            onChange={(e) =>
                              setEdit((c) => ({ ...c, currency: e.target.value.toUpperCase() }))
                            }
                            placeholder="currency"
                            className="w-full rounded-xl border border-white/5 bg-surface100 px-3 py-2 text-sm"
                          />
                          <div className="grid gap-2 md:grid-cols-2">
                            <label className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-surface100 px-3 py-2 text-xs">
                              <input
                                type="checkbox"
                                checked={edit.hypoallergenic}
                                onChange={(e) =>
                                  setEdit((c) => ({ ...c, hypoallergenic: e.target.checked }))
                                }
                              />
                              hypoallergenic
                            </label>
                            <label className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-surface100 px-3 py-2 text-xs">
                              <input
                                type="checkbox"
                                checked={edit.gift_ready}
                                onChange={(e) =>
                                  setEdit((c) => ({ ...c, gift_ready: e.target.checked }))
                                }
                              />
                              gift_ready
                            </label>
                            <label className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-surface100 px-3 py-2 text-xs">
                              <input
                                type="checkbox"
                                checked={edit.is_featured}
                                onChange={(e) =>
                                  setEdit((c) => ({ ...c, is_featured: e.target.checked }))
                                }
                              />
                              is_featured
                            </label>
                            <label className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-surface100 px-3 py-2 text-xs">
                              <input
                                type="checkbox"
                                checked={edit.is_bestseller}
                                onChange={(e) =>
                                  setEdit((c) => ({ ...c, is_bestseller: e.target.checked }))
                                }
                              />
                              is_bestseller
                            </label>
                            <label className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-surface100 px-3 py-2 text-xs">
                              <input
                                type="checkbox"
                                checked={edit.is_new_arrival}
                                onChange={(e) =>
                                  setEdit((c) => ({ ...c, is_new_arrival: e.target.checked }))
                                }
                              />
                              is_new_arrival
                            </label>
                            <label className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-surface100 px-3 py-2 text-xs">
                              <input
                                type="checkbox"
                                checked={edit.is_active}
                                onChange={(e) =>
                                  setEdit((c) => ({ ...c, is_active: e.target.checked }))
                                }
                              />
                              is_active
                            </label>
                          </div>
                          <p className="text-xs text-zinc-500">
                            Canonica preview: /producto/{slugify(edit.seo_slug || edit.slug)}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-shrink-0 gap-2 border-t border-white/5 p-4">
                        <button
                          onClick={() => void saveEdit()}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-black hover:bg-brand/90"
                        >
                          <Save className="h-4 w-4" />
                          Guardar cambios
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center p-6 text-center text-zinc-500">
                      <div className="mb-4 rounded-full bg-white/5 p-4">
                        <PackagePlus className="h-8 w-8 text-zinc-400" />
                      </div>
                      <p className="text-sm">Selecciona un producto de la lista</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {view === 'variants' && <VariantsManager products={productOptions} />}

            {view === 'reviews' && <ReviewsManager products={productOptions} />}

            {view === 'orders' && <OrdersManager />}

            {view === 'shipments' && <ShipmentsManager />}

            {view === 'analytics' && <AnalyticsManager />}

            {view === 'connections' && (
              <div className="mx-auto w-full max-w-5xl space-y-4">
                <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-4">
                  <h2 className="text-xl font-semibold">Conexiones</h2>
                  <p className="mt-2 text-sm text-zinc-500">URL actual: {window.location.origin}</p>
                  <p className="mt-2 text-sm text-zinc-500">API actual: {apiProxyTarget}</p>
                  <p className="mt-2 text-sm text-zinc-500">
                    Estado health:{' '}
                    {conn.checking ? 'verificando...' : connected ? 'OK' : 'con incidencias'}
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-4">
                    <p className="text-xs uppercase text-zinc-500">R2</p>
                    <p
                      className={cn(
                        'mt-2 text-sm font-semibold',
                        conn.r2.ok ? 'text-emerald-300' : 'text-rose-300'
                      )}
                    >
                      {conn.r2.ok ? 'Conectado' : 'Con error'}
                    </p>
                    {conn.r2.error && <p className="mt-2 text-xs text-zinc-400">{conn.r2.error}</p>}
                  </div>
                  <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-4">
                    <p className="text-xs uppercase text-zinc-500">D1</p>
                    <p
                      className={cn(
                        'mt-2 text-sm font-semibold',
                        conn.d1.ok ? 'text-emerald-300' : 'text-rose-300'
                      )}
                    >
                      {conn.d1.ok ? 'Conectado' : 'Con error'}
                    </p>
                    {conn.d1.error && <p className="mt-2 text-xs text-zinc-400">{conn.d1.error}</p>}
                  </div>
                  <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase text-zinc-500">Envia</p>
                        <p
                          className={cn(
                            'mt-2 text-sm font-semibold',
                            conn.envia.configured &&
                              conn.envia.shipping.ok &&
                              conn.envia.queries.ok &&
                              conn.envia.geocodes.ok
                              ? 'text-emerald-300'
                              : 'text-amber-300'
                          )}
                        >
                          {conn.envia.configured ? `Modo ${conn.envia.mode}` : 'Sin configurar'}
                        </p>
                      </div>
                      <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] text-zinc-400">
                        {conn.envia.checked_at || 'sin check'}
                      </span>
                    </div>
                    <div className="mt-3 space-y-2 text-xs text-zinc-400">
                      <p>
                        Shipping:{' '}
                        <span
                          className={conn.envia.shipping.ok ? 'text-emerald-300' : 'text-rose-300'}
                        >
                          {conn.envia.shipping.ok ? 'ok' : conn.envia.shipping.error || 'error'}
                        </span>
                      </p>
                      <p>
                        Queries:{' '}
                        <span
                          className={conn.envia.queries.ok ? 'text-emerald-300' : 'text-rose-300'}
                        >
                          {conn.envia.queries.ok ? 'ok' : conn.envia.queries.error || 'error'}
                        </span>
                      </p>
                      <p>
                        Geocodes:{' '}
                        <span
                          className={conn.envia.geocodes.ok ? 'text-emerald-300' : 'text-rose-300'}
                        >
                          {conn.envia.geocodes.ok ? 'ok' : conn.envia.geocodes.error || 'error'}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-4">
                  <p className="text-xs uppercase text-zinc-500">Compatibilidad de esquema</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-4">
                    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs">
                      products_enriched:{' '}
                      <span
                        className={
                          conn.schema.products_enriched ? 'text-emerald-300' : 'text-rose-300'
                        }
                      >
                        {conn.schema.products_enriched ? 'listo' : 'pendiente'}
                      </span>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs">
                      product_variants:{' '}
                      <span
                        className={
                          conn.schema.product_variants ? 'text-emerald-300' : 'text-rose-300'
                        }
                      >
                        {conn.schema.product_variants ? 'listo' : 'pendiente'}
                      </span>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs">
                      product_reviews:{' '}
                      <span
                        className={
                          conn.schema.product_reviews ? 'text-emerald-300' : 'text-rose-300'
                        }
                      >
                        {conn.schema.product_reviews ? 'listo' : 'pendiente'}
                      </span>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs">
                      order_shipments:{' '}
                      <span
                        className={
                          conn.schema.order_shipments ? 'text-emerald-300' : 'text-rose-300'
                        }
                      >
                        {conn.schema.order_shipments ? 'listo' : 'pendiente'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-4 text-sm text-zinc-400">
                  <p className="flex items-center gap-2">
                    <Wifi className="h-4 w-4" />
                    Para telefono usa la IP LAN real (ejemplo: 192.168.100.4), no la host-only
                    192.168.56.1.
                  </p>
                  <p className="mt-2 flex items-center gap-2">
                    <WifiOff className="h-4 w-4" />
                    Si no abre, revisa firewall para puertos 5173 y 8787.
                  </p>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}

export default App
