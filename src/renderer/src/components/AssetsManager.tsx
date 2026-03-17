import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  FolderOpen,
  ImageUp,
  RefreshCw,
  Trash2,
  UploadCloud
} from 'lucide-react'
import { cn } from '../lib/utils'
import {
  createImageRecord,
  fmtSize,
  optimizeImageFile,
  revokeImageRecordUrls,
  type ImageRecord
} from '../lib/image-tools'

type Msg = { type: 'error' | 'success' | 'info'; text: string } | null
type QueueStatus = 'pending' | 'optimized' | 'uploading' | 'uploaded' | 'error'

type QueueItem = ImageRecord & {
  uploadStatus: QueueStatus
  uploadedKey: string | null
  uploadedUrl: string | null
  uploadError: string | null
}

type AssetUsageProduct = {
  product_id: number
  title: string
  slug: string
  seo_slug: string | null
  canonical_path: string
  role: 'primary' | 'gallery'
}

type AssetItem = {
  key: string
  url: string
  preview_url: string
  size: number
  uploaded_at: string | null
  content_type: string | null
  usage_count: number
  usage_products?: AssetUsageProduct[]
  can_delete: boolean
}

type ListAssetsResponse = {
  success: boolean
  assets?: AssetItem[]
  next_cursor?: string | null
  has_more?: boolean
  error?: string
}

type UploadResponse = {
  success: boolean
  key?: string
  url?: string
  error?: string
}

type DeleteAssetResponse = {
  success: boolean
  error?: string
}

function normalizePrefixInput(value: string): string {
  const trimmed = String(value || '')
    .trim()
    .replace(/\\/g, '/')
  const normalized = trimmed.replace(/^\/+/, '').replace(/\/+/g, '/')
  if (!normalized) return 'products/'
  return normalized.endsWith('/') ? normalized : `${normalized}/`
}

function formatDate(value: string | null): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date)
}

function splitFileName(name: string): { baseName: string; extension: string } {
  const normalized = String(name || '').trim()
  const dotIndex = normalized.lastIndexOf('.')
  if (dotIndex <= 0) {
    return { baseName: normalized || 'asset', extension: '' }
  }

  return {
    baseName: normalized.slice(0, dotIndex) || 'asset',
    extension: normalized.slice(dotIndex + 1).toLowerCase()
  }
}

function buildFileName(baseName: string, extension: string): string {
  const normalizedBaseName =
    String(baseName || '')
      .trim()
      .replace(/\.(webp|png|jpe?g)$/i, '') || 'asset'
  const normalizedExtension = String(extension || '')
    .trim()
    .replace(/^\.+/, '')
    .toLowerCase()
  return normalizedExtension ? `${normalizedBaseName}.${normalizedExtension}` : normalizedBaseName
}

function renameFile(file: File, nextName: string): File {
  return new File([file], nextName, {
    type: file.type,
    lastModified: Date.now()
  })
}

function isQueueItemWebpReady(item: QueueItem): boolean {
  const { extension } = splitFileName(item.name)
  return (
    extension === 'webp' ||
    item.file.type === 'image/webp' ||
    item.optimization?.outputType === 'image/webp'
  )
}

function canEditQueueItemName(item: QueueItem): boolean {
  return (
    isQueueItemWebpReady(item) &&
    item.uploadStatus !== 'uploading' &&
    item.uploadStatus !== 'uploaded'
  )
}

function usageRoleLabel(role: AssetUsageProduct['role']): string {
  return role === 'primary' ? 'Portada' : 'Galeria'
}

function formatUsageSummary(usageProducts: AssetUsageProduct[] | undefined, maxItems = 3): string {
  const items = Array.isArray(usageProducts) ? usageProducts : []
  if (!items.length) return ''

  const visible = items
    .slice(0, maxItems)
    .map((product) => `${product.title} (${usageRoleLabel(product.role)})`)
  const remaining = items.length - visible.length

  return remaining > 0 ? `${visible.join(', ')} +${remaining} mas` : visible.join(', ')
}

function toQueueItem(file: File): QueueItem {
  return {
    ...createImageRecord(file),
    uploadStatus: 'pending',
    uploadedKey: null,
    uploadedUrl: null,
    uploadError: null
  }
}

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value)
      return
    } catch {
      // Ignore and continue with the DOM fallback.
    }
  }

  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  textarea.style.pointerEvents = 'none'
  textarea.style.left = '-9999px'
  textarea.style.top = '0'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()
  textarea.setSelectionRange(0, textarea.value.length)

  const copied = document.execCommand('copy')
  document.body.removeChild(textarea)

  if (!copied) {
    throw new Error('No se pudo copiar al portapapeles.')
  }
}

async function requestJson<T>(path: string, init?: RequestInit, timeoutMs = 20000): Promise<T> {
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
  } finally {
    window.clearTimeout(timeoutId)
  }
}

function queueStatusLabel(status: QueueStatus): string {
  if (status === 'optimized') return 'Optimizada'
  if (status === 'uploading') return 'Subiendo'
  if (status === 'uploaded') return 'Subida'
  if (status === 'error') return 'Con error'
  return 'Pendiente'
}

function queueStatusClass(status: QueueStatus): string {
  if (status === 'optimized') return 'border-brand/30 bg-gold/10 text-brand'
  if (status === 'uploading') return 'border-sky-400/30 bg-sky-500/10 text-sky-200'
  if (status === 'uploaded') return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
  if (status === 'error') return 'border-rose-400/30 bg-rose-500/10 text-rose-200'
  return 'border-white/10 bg-white/5 text-zinc-300'
}

function hasDraggedFiles(dataTransfer: DataTransfer | null | undefined): boolean {
  if (!dataTransfer) return false
  return Array.from(dataTransfer.types || []).includes('Files')
}

export default function AssetsManager(): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  const queueRef = useRef<QueueItem[]>([])
  const dragDepthRef = useRef(0)
  const [msg, setMsg] = useState<Msg>(null)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [optimizingId, setOptimizingId] = useState<string | null>(null)
  const [optimizingAll, setOptimizingAll] = useState(false)
  const [uploadingAll, setUploadingAll] = useState(false)
  const [prefixDraft, setPrefixDraft] = useState('products/')
  const [activePrefix, setActivePrefix] = useState('products/')
  const [assets, setAssets] = useState<AssetItem[]>([])
  const [loadingAssets, setLoadingAssets] = useState(false)
  const [currentCursor, setCurrentCursor] = useState<string | null>(null)
  const [cursorHistory, setCursorHistory] = useState<string[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [assetActionKey, setAssetActionKey] = useState<string | null>(null)

  const selectedQueueItem = queue.find((item) => item.id === selectedQueueId) ?? null
  const selectedQueueNameParts = useMemo(
    () => splitFileName(selectedQueueItem?.name || ''),
    [selectedQueueItem?.name]
  )
  const selectedQueueCanRename = selectedQueueItem ? canEditQueueItemName(selectedQueueItem) : false
  const uploadedCount = useMemo(
    () => queue.filter((item) => item.uploadStatus === 'uploaded').length,
    [queue]
  )

  useEffect(() => {
    queueRef.current = queue
  }, [queue])

  useEffect(() => {
    return () => {
      revokeImageRecordUrls(queueRef.current)
    }
  }, [])

  useEffect(() => {
    const handleDragEnter = (event: DragEvent): void => {
      if (!hasDraggedFiles(event.dataTransfer)) return
      event.preventDefault()
      dragDepthRef.current += 1
      setDragActive(true)
    }

    const handleDragOver = (event: DragEvent): void => {
      if (!hasDraggedFiles(event.dataTransfer)) return
      event.preventDefault()
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy'
      }
      setDragActive(true)
    }

    const handleDragLeave = (event: DragEvent): void => {
      if (!hasDraggedFiles(event.dataTransfer)) return
      event.preventDefault()
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
      if (dragDepthRef.current === 0) {
        setDragActive(false)
      }
    }

    const handleDrop = (event: DragEvent): void => {
      if (!hasDraggedFiles(event.dataTransfer)) return
      event.preventDefault()
      dragDepthRef.current = 0
      setDragActive(false)
      const files = Array.from(event.dataTransfer?.files || []).filter((file) =>
        file.type.startsWith('image/')
      )
      if (!files.length) {
        setMsg({ type: 'error', text: 'Solo puedes soltar archivos de imagen.' })
        return
      }
      const nextItems = files.map(toQueueItem)
      setQueue((current) => [...current, ...nextItems])
      setSelectedQueueId((current) => current || nextItems[0]?.id || null)
      setMsg({ type: 'success', text: `${nextItems.length} imagen(es) cargadas por arrastre.` })
    }

    window.addEventListener('dragenter', handleDragEnter)
    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('dragleave', handleDragLeave)
    window.addEventListener('drop', handleDrop)

    return () => {
      window.removeEventListener('dragenter', handleDragEnter)
      window.removeEventListener('dragover', handleDragOver)
      window.removeEventListener('dragleave', handleDragLeave)
      window.removeEventListener('drop', handleDrop)
    }
  }, [])

  useEffect(() => {
    let alive = true

    const loadAssets = async (): Promise<void> => {
      setLoadingAssets(true)
      try {
        const params = new URLSearchParams()
        params.set('prefix', activePrefix)
        params.set('limit', '50')
        if (currentCursor) params.set('cursor', currentCursor)

        const data = await requestJson<ListAssetsResponse>(`/api/assets?${params.toString()}`)
        if (!alive) return
        if (!data.success) throw new Error(data.error || 'No se pudo listar assets.')

        setAssets(data.assets || [])
        setNextCursor(data.next_cursor || null)
        setHasMore(Boolean(data.has_more && data.next_cursor))
      } catch (error) {
        if (!alive) return
        setAssets([])
        setNextCursor(null)
        setHasMore(false)
        setMsg({
          type: 'error',
          text:
            error instanceof Error ? error.message : 'No se pudo cargar la biblioteca de assets.'
        })
      } finally {
        if (alive) setLoadingAssets(false)
      }
    }

    void loadAssets()

    return () => {
      alive = false
    }
  }, [activePrefix, currentCursor, reloadKey])

  const appendFiles = (files: File[], sourceLabel: string): void => {
    const imageFiles = files.filter((file) => file.type.startsWith('image/'))
    if (!imageFiles.length) {
      setMsg({ type: 'error', text: 'Solo puedes cargar archivos de imagen.' })
      return
    }

    const nextItems = imageFiles.map(toQueueItem)
    setQueue((current) => [...current, ...nextItems])
    setSelectedQueueId((current) => current || nextItems[0]?.id || null)
    setMsg({
      type: 'success',
      text: `${nextItems.length} imagen(es) agregadas a la cola desde ${sourceLabel}.`
    })
  }

  const chooseFiles = (event: React.ChangeEvent<HTMLInputElement>): void => {
    appendFiles(Array.from(event.target.files ?? []), 'selector')
    event.target.value = ''
  }

  const clearQueue = (): void => {
    if (!queueRef.current.length) return
    revokeImageRecordUrls(queueRef.current)
    setQueue([])
    setSelectedQueueId(null)
    setMsg({ type: 'info', text: 'Cola local vaciada.' })
  }

  const applyPrefix = (): void => {
    const normalized = normalizePrefixInput(prefixDraft)
    setPrefixDraft(normalized)
    setActivePrefix(normalized)
    setCurrentCursor(null)
    setCursorHistory([])
    setMsg({ type: 'info', text: `Prefijo activo: ${normalized}` })
  }

  const updateQueueItemBaseName = (itemId: string, nextBaseName: string): void => {
    setQueue((items) =>
      items.map((item) => {
        if (item.id !== itemId) return item
        if (!canEditQueueItemName(item)) return item

        const currentParts = splitFileName(item.name)
        const nextName = buildFileName(nextBaseName || currentParts.baseName, 'webp')

        return {
          ...item,
          name: nextName,
          file: renameFile(item.file, nextName),
          uploadedKey: null,
          uploadedUrl: null,
          uploadError: null
        }
      })
    )
  }

  const optimizeQueueItem = async (itemId: string, silent = false): Promise<boolean> => {
    const currentItem = queueRef.current.find((item) => item.id === itemId)
    if (!currentItem) return false

    setOptimizingId(itemId)

    try {
      const optimizedFile = await optimizeImageFile(currentItem.file)
      const optimizedSize = optimizedFile.size
      const desiredBaseName = splitFileName(currentItem.name).baseName
      const nextOptimizedName = buildFileName(desiredBaseName, 'webp')
      const namedOptimizedFile =
        optimizedFile.name === nextOptimizedName
          ? optimizedFile
          : renameFile(optimizedFile, nextOptimizedName)

      if (optimizedSize >= currentItem.size) {
        if (!silent) {
          setMsg({
            type: 'info',
            text: `No hubo mejora de peso. Se conserva ${currentItem.name} (${fmtSize(currentItem.size)}).`
          })
        }
        return false
      }

      const originalSize = currentItem.originalSize
      const savedBytes = Math.max(0, originalSize - optimizedSize)
      const savedPercent = originalSize > 0 ? (savedBytes / originalSize) * 100 : 0

      setQueue((items) =>
        items.map((item) => {
          if (item.id !== itemId) return item
          URL.revokeObjectURL(item.url)
          return {
            ...item,
            name: nextOptimizedName,
            file: namedOptimizedFile,
            url: URL.createObjectURL(namedOptimizedFile),
            size: optimizedSize,
            optimization: {
              optimizedSize,
              savedBytes,
              savedPercent,
              outputType: optimizedFile.type || 'image/webp'
            },
            uploadStatus: 'optimized',
            uploadedKey: null,
            uploadedUrl: null,
            uploadError: null
          }
        })
      )

      if (!silent) {
        setMsg({
          type: 'success',
          text: `${currentItem.name}: ${fmtSize(originalSize)} -> ${fmtSize(optimizedSize)} (${savedPercent.toFixed(1)}% menos).`
        })
      }
      return true
    } catch (error) {
      if (!silent) {
        setMsg({
          type: 'error',
          text: error instanceof Error ? error.message : 'No se pudo optimizar la imagen.'
        })
      }
      return false
    } finally {
      setOptimizingId(null)
    }
  }

  const optimizeSelected = async (): Promise<void> => {
    if (!selectedQueueItem) {
      setMsg({ type: 'error', text: 'Selecciona una imagen de la cola.' })
      return
    }
    void optimizeQueueItem(selectedQueueItem.id)
  }

  const optimizeAll = async (): Promise<void> => {
    if (!queueRef.current.length) {
      setMsg({ type: 'error', text: 'No hay imagenes en la cola.' })
      return
    }

    setOptimizingAll(true)
    let improved = 0

    try {
      for (const item of queueRef.current) {
        const didImprove = await optimizeQueueItem(item.id, true)
        if (didImprove) improved += 1
      }
      setMsg({
        type: improved > 0 ? 'success' : 'info',
        text:
          improved > 0
            ? `${improved} imagen(es) optimizadas.`
            : 'No hubo mejoras de peso en la cola seleccionada.'
      })
    } finally {
      setOptimizingAll(false)
    }
  }

  const uploadQueueItem = async (itemId: string): Promise<boolean> => {
    const item = queueRef.current.find((entry) => entry.id === itemId)
    if (!item) return false

    setQueue((items) =>
      items.map((entry) =>
        entry.id === itemId
          ? {
              ...entry,
              uploadStatus: 'uploading',
              uploadError: null
            }
          : entry
      )
    )

    try {
      const formData = new FormData()
      formData.set('file', item.file, item.name)
      formData.set('prefix', activePrefix)
      const response = await requestJson<UploadResponse>(
        '/api/upload',
        {
          method: 'POST',
          body: formData
        },
        60000
      )

      if (!response.success || !response.key || !response.url) {
        throw new Error(response.error || 'No se pudo subir el asset.')
      }

      setQueue((items) =>
        items.map((entry) =>
          entry.id === itemId
            ? {
                ...entry,
                uploadStatus: 'uploaded',
                uploadedKey: response.key || null,
                uploadedUrl: response.url || null,
                uploadError: null
              }
            : entry
        )
      )

      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo subir el asset.'
      setQueue((items) =>
        items.map((entry) =>
          entry.id === itemId
            ? {
                ...entry,
                uploadStatus: 'error',
                uploadedKey: null,
                uploadedUrl: null,
                uploadError: message
              }
            : entry
        )
      )
      return false
    }
  }

  const uploadAll = async (): Promise<void> => {
    if (!queueRef.current.length) {
      setMsg({ type: 'error', text: 'No hay imagenes en la cola.' })
      return
    }

    setUploadingAll(true)
    let successCount = 0

    try {
      for (const item of queueRef.current) {
        const success = await uploadQueueItem(item.id)
        if (success) successCount += 1
      }
      setReloadKey((value) => value + 1)
      setMsg({
        type: successCount > 0 ? 'success' : 'error',
        text:
          successCount > 0
            ? `${successCount} imagen(es) subidas a ${activePrefix}.`
            : 'No se pudo subir ningun asset.'
      })
    } finally {
      setUploadingAll(false)
    }
  }

  const copyValue = async (label: string, value: string): Promise<void> => {
    try {
      await copyText(value)
      setMsg({ type: 'success', text: `${label} copiado.` })
    } catch (error) {
      setMsg({
        type: 'error',
        text: error instanceof Error ? error.message : `No se pudo copiar ${label.toLowerCase()}.`
      })
    }
  }

  const deleteAsset = async (asset: AssetItem): Promise<void> => {
    if (!asset.can_delete) {
      setMsg({
        type: 'error',
        text: `No se puede borrar ${asset.key}; esta referenciado por ${asset.usage_count} producto(s).`
      })
      return
    }
    if (!window.confirm(`Eliminar asset "${asset.key}"?`)) return

    setAssetActionKey(asset.key)
    try {
      const response = await requestJson<DeleteAssetResponse>(
        `/api/assets/${encodeURIComponent(asset.key)}`,
        { method: 'DELETE' }
      )
      if (!response.success) throw new Error(response.error || 'No se pudo eliminar el asset.')
      setReloadKey((value) => value + 1)
      setMsg({ type: 'success', text: `Asset eliminado: ${asset.key}` })
    } catch (error) {
      setMsg({
        type: 'error',
        text: error instanceof Error ? error.message : 'No se pudo eliminar el asset.'
      })
    } finally {
      setAssetActionKey(null)
    }
  }

  const goNextPage = (): void => {
    if (!nextCursor) return
    setCursorHistory((history) => [...history, currentCursor || ''])
    setCurrentCursor(nextCursor)
  }

  const goPrevPage = (): void => {
    setCursorHistory((history) => {
      if (!history.length) return history
      const nextHistory = history.slice(0, -1)
      const previousCursor = history[history.length - 1] || null
      setCurrentCursor(previousCursor)
      return nextHistory
    })
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      {dragActive && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-2xl rounded-[2rem] border border-brand/35 bg-surface100/95 p-8 text-center shadow-glow backdrop-blur">
            <p className="text-[11px] uppercase tracking-[0.32em] text-brand/70">Dropzone</p>
            <h3 className="mt-3 text-2xl font-semibold text-zinc-100">
              Suelta las imagenes para agregarlas a la cola
            </h3>
            <p className="mt-3 text-sm text-zinc-400">
              Se cargaran directo en esta vista y quedaran listas para optimizar y subir a R2.
            </p>
          </div>
        </div>
      )}

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
            <RefreshCw className="h-4 w-4" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      <div className="grid h-[calc(100vh-80px)] gap-6 rounded-[32px] border border-white/10 bg-surface/80 p-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section className="custom-scrollbar flex flex-col overflow-y-auto rounded-3xl border border-white/10 bg-surface100 p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-brand/70">Assets R2</p>
              <h2 className="mt-1 text-xl font-semibold">Cola local con optimizacion</h2>
              <p className="mt-2 text-sm text-zinc-500">
                El destino se aplica a todo el lote activo. Si no especificas nada, se usa
                `products/`.
              </p>
              <p className="mt-2 text-sm text-zinc-500">
                Tambien puedes arrastrar imagenes encima de la pagina para cargarlas al instante.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-100 hover:bg-white/10"
              >
                <ImageUp className="h-4 w-4" />
                Elegir imagenes
              </button>
              <button
                type="button"
                onClick={clearQueue}
                disabled={!queue.length}
                className={cn(
                  'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold',
                  queue.length
                    ? 'bg-white/5 text-zinc-300 hover:bg-white/10'
                    : 'cursor-not-allowed bg-surface200 text-zinc-500'
                )}
              >
                <Trash2 className="h-4 w-4" />
                Vaciar cola
              </button>
            </div>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={chooseFiles}
              className="hidden"
            />
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
            <div className="flex flex-col gap-3 lg:flex-row">
              <label className="flex-1">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  Prefijo R2
                </span>
                <input
                  value={prefixDraft}
                  onChange={(event) => setPrefixDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      applyPrefix()
                    }
                  }}
                  placeholder="products/anillos/"
                  className="w-full rounded-xl border border-white/10 bg-surface100 px-3 py-2 text-sm"
                />
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={applyPrefix}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-black"
                >
                  <FolderOpen className="h-4 w-4" />
                  Aplicar prefijo
                </button>
              </div>
            </div>
            <p className="mt-3 text-xs text-zinc-500">Destino activo: {activePrefix}</p>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div className="rounded-2xl bg-black/25 p-4">
              {selectedQueueItem ? (
                <>
                  <img
                    src={selectedQueueItem.url}
                    alt={selectedQueueItem.name}
                    className="h-56 w-full rounded-2xl object-cover"
                  />
                  <div className="mt-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-zinc-100">{selectedQueueItem.name}</p>
                      <span
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]',
                          queueStatusClass(selectedQueueItem.uploadStatus)
                        )}
                      >
                        {queueStatusLabel(selectedQueueItem.uploadStatus)}
                      </span>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
                        Nombre de upload
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          value={selectedQueueNameParts.baseName}
                          onChange={(event) =>
                            selectedQueueItem
                              ? updateQueueItemBaseName(selectedQueueItem.id, event.target.value)
                              : undefined
                          }
                          readOnly={!selectedQueueCanRename}
                          className={cn(
                            'min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm',
                            selectedQueueCanRename
                              ? 'border-white/10 bg-surface100 text-zinc-100'
                              : 'cursor-not-allowed border-white/5 bg-black/20 text-zinc-400'
                          )}
                        />
                        <span className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-300">
                          {selectedQueueNameParts.extension
                            ? `.${selectedQueueNameParts.extension}`
                            : 'sin ext'}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-zinc-500">
                        {selectedQueueCanRename
                          ? 'Puedes editar el basename. La extension .webp se mantiene fija.'
                          : isQueueItemWebpReady(selectedQueueItem)
                            ? 'El rename queda bloqueado mientras se sube o despues de subir.'
                            : 'Optimiza a WebP para habilitar el rename con extension fija .webp.'}
                      </p>
                    </div>
                    <p className="text-xs text-zinc-500">
                      Peso original: {fmtSize(selectedQueueItem.originalSize)}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {selectedQueueItem.optimization
                        ? `Peso actual: ${fmtSize(selectedQueueItem.optimization.optimizedSize)} (${selectedQueueItem.optimization.savedPercent.toFixed(1)}% menos)`
                        : `Peso actual: ${fmtSize(selectedQueueItem.size)}`}
                    </p>
                    {selectedQueueItem.uploadedKey && (
                      <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/5 p-3 text-xs text-emerald-100">
                        <p className="break-all">{selectedQueueItem.uploadedKey}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void copyValue('Key', selectedQueueItem.uploadedKey!)}
                            className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 font-semibold"
                          >
                            <Copy className="h-3.5 w-3.5" />
                            Copiar key
                          </button>
                          {selectedQueueItem.uploadedUrl && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  void copyValue('URL', String(selectedQueueItem.uploadedUrl))
                                }
                                className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 font-semibold"
                              >
                                <Copy className="h-3.5 w-3.5" />
                                Copiar URL
                              </button>
                              <a
                                href={selectedQueueItem.uploadedUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 font-semibold"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                Abrir
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                    {selectedQueueItem.uploadError && (
                      <p className="text-xs text-rose-300">{selectedQueueItem.uploadError}</p>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex h-full min-h-56 items-center justify-center rounded-2xl border border-dashed border-white/10 text-sm text-zinc-500">
                  Selecciona una imagen para ver preview y optimizarla.
                </div>
              )}
            </div>

            <div className="space-y-3 rounded-2xl bg-black/25 p-4">
              <button
                type="button"
                onClick={() => void optimizeSelected()}
                disabled={
                  !selectedQueueItem || Boolean(optimizingId) || optimizingAll || uploadingAll
                }
                className={cn(
                  'inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold',
                  !selectedQueueItem || Boolean(optimizingId) || optimizingAll || uploadingAll
                    ? 'cursor-not-allowed bg-surface200 text-zinc-500'
                    : 'bg-white/10 text-zinc-100 hover:bg-white/15'
                )}
              >
                <RefreshCw className={cn('h-4 w-4', optimizingId && 'animate-spin')} />
                {optimizingId ? 'Optimizando...' : 'Optimizar seleccionada'}
              </button>

              <button
                type="button"
                onClick={() => void optimizeAll()}
                disabled={!queue.length || Boolean(optimizingId) || optimizingAll || uploadingAll}
                className={cn(
                  'inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold',
                  !queue.length || Boolean(optimizingId) || optimizingAll || uploadingAll
                    ? 'cursor-not-allowed bg-surface200 text-zinc-500'
                    : 'bg-white/10 text-zinc-100 hover:bg-white/15'
                )}
              >
                <RefreshCw className={cn('h-4 w-4', optimizingAll && 'animate-spin')} />
                {optimizingAll ? 'Optimizando lote...' : 'Optimizar todas'}
              </button>

              <button
                type="button"
                onClick={() => void uploadAll()}
                disabled={!queue.length || Boolean(optimizingId) || optimizingAll || uploadingAll}
                className={cn(
                  'inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold',
                  !queue.length || Boolean(optimizingId) || optimizingAll || uploadingAll
                    ? 'cursor-not-allowed bg-surface200 text-zinc-500'
                    : 'bg-brand text-black'
                )}
              >
                <UploadCloud className="h-4 w-4" />
                {uploadingAll ? 'Subiendo lote...' : 'Subir todas'}
              </button>

              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-zinc-400">
                <p>Total en cola: {queue.length}</p>
                <p className="mt-1">Subidas completadas: {uploadedCount}</p>
              </div>
            </div>
          </div>

          <div className="mt-5">
            {queue.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {queue.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedQueueId(item.id)}
                    className={cn(
                      'overflow-hidden rounded-2xl border bg-black/20 text-left transition',
                      selectedQueueId === item.id ? 'border-brand shadow-glow' : 'border-white/10'
                    )}
                  >
                    <img
                      src={item.url}
                      alt={item.name}
                      className="aspect-square w-full object-cover"
                    />
                    <div className="space-y-1 p-3">
                      <p className="truncate text-xs font-medium text-zinc-200">{item.name}</p>
                      <p className="text-[11px] text-zinc-500">{fmtSize(item.size)}</p>
                      <span
                        className={cn(
                          'inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em]',
                          queueStatusClass(item.uploadStatus)
                        )}
                      >
                        {queueStatusLabel(item.uploadStatus)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-zinc-500">
                Aun no hay imagenes en la cola local.
              </div>
            )}
          </div>
        </section>

        <section className="custom-scrollbar flex flex-col overflow-y-auto rounded-3xl border border-white/10 bg-surface100 p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-brand/70">Biblioteca</p>
              <h2 className="mt-1 text-xl font-semibold">Assets existentes en R2</h2>
              <p className="mt-2 text-sm text-zinc-500">Vista enfocada en el prefijo activo.</p>
            </div>
            <button
              type="button"
              onClick={() => setReloadKey((value) => value + 1)}
              className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/10"
            >
              <RefreshCw className={cn('h-4 w-4', loadingAssets && 'animate-spin')} />
              Refrescar
            </button>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4 text-xs text-zinc-400">
            Prefijo mostrado: <span className="font-semibold text-zinc-200">{activePrefix}</span>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={goPrevPage}
              disabled={!cursorHistory.length || loadingAssets}
              className={cn(
                'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold',
                !cursorHistory.length || loadingAssets
                  ? 'cursor-not-allowed bg-surface200 text-zinc-500'
                  : 'bg-white/5 text-zinc-300 hover:bg-white/10'
              )}
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </button>
            <button
              type="button"
              onClick={goNextPage}
              disabled={!hasMore || loadingAssets}
              className={cn(
                'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold',
                !hasMore || loadingAssets
                  ? 'cursor-not-allowed bg-surface200 text-zinc-500'
                  : 'bg-white/5 text-zinc-300 hover:bg-white/10'
              )}
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-5 space-y-3">
            {loadingAssets ? (
              <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-zinc-500">
                Cargando assets...
              </div>
            ) : assets.length > 0 ? (
              assets.map((asset) => (
                <article
                  key={asset.key}
                  className="overflow-hidden rounded-2xl border border-white/10 bg-black/25"
                >
                  <div className="grid gap-0 sm:grid-cols-[112px_minmax(0,1fr)]">
                    <div className="bg-white/5">
                      <img
                        src={asset.preview_url}
                        alt={asset.key}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="space-y-3 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="break-all text-sm font-medium text-zinc-100">{asset.key}</p>
                        <span
                          className={cn(
                            'rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]',
                            asset.can_delete
                              ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
                              : 'border-amber-400/30 bg-amber-500/10 text-amber-200'
                          )}
                        >
                          {asset.can_delete ? 'Libre' : `Usado en ${asset.usage_count}`}
                        </span>
                      </div>
                      {asset.usage_count > 0 && (
                        <div className="rounded-xl border border-amber-400/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-100">
                          <span className="font-semibold">Usado en:</span>{' '}
                          <span>{formatUsageSummary(asset.usage_products)}</span>
                        </div>
                      )}
                      <div className="grid gap-1 text-xs text-zinc-500">
                        <p>Tamano: {fmtSize(asset.size)}</p>
                        <p>Subido: {formatDate(asset.uploaded_at)}</p>
                        <p>Tipo: {asset.content_type || 'desconocido'}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void copyValue('Key', asset.key)}
                          className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-zinc-200"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Key
                        </button>
                        <button
                          type="button"
                          onClick={() => void copyValue('URL', asset.url || asset.preview_url)}
                          className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-zinc-200"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          URL
                        </button>
                        <a
                          href={asset.preview_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-zinc-200"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Abrir
                        </a>
                        <button
                          type="button"
                          onClick={() => void deleteAsset(asset)}
                          disabled={!asset.can_delete || assetActionKey === asset.key}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold',
                            !asset.can_delete || assetActionKey === asset.key
                              ? 'cursor-not-allowed bg-surface200 text-zinc-500'
                              : 'bg-rose-500/15 text-rose-200 hover:bg-rose-500/20'
                          )}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {assetActionKey === asset.key ? 'Eliminando...' : 'Eliminar'}
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-zinc-500">
                No hay assets para el prefijo actual.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
