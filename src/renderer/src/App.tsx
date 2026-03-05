import { startTransition, useEffect, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  FolderOpen,
  Image as ImageIcon,
  UploadCloud,
  X
} from 'lucide-react'
import { cn } from './lib/utils'

type ImageRecord = {
  id: string
  name: string
  path: string
  url: string
  size: number
  modifiedAt: number
}

type UploadStatus = 'uploading' | 'success' | 'error'

function formatFileSize(size: number): string {
  if (size < 1024) {
    return `${size} B`
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function App(): React.JSX.Element {
  const [folderPath, setFolderPath] = useState<string | null>(null)
  const [images, setImages] = useState<ImageRecord[]>([])
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set())
  const [uploadStatus, setUploadStatus] = useState<Record<string, UploadStatus>>({})
  const [isLoadingImages, setIsLoadingImages] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([])
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)

  const selectedCount = selectedImages.size
  const allSelected = images.length > 0 && selectedCount === images.length

  useEffect(() => {
    void loadInitialConfig()
  }, [])

  const loadInitialConfig = async (): Promise<void> => {
    const savedPath = await window.api.getConfig('defaultFolderPath')

    if (savedPath) {
      setFolderPath(savedPath)
      await loadImages(savedPath)
      return
    }

    setIsLoadingImages(false)
  }

  const loadImages = async (targetPath: string): Promise<void> => {
    setIsLoadingImages(true)

    try {
      const files = await window.api.readDirectory(targetPath)

      startTransition(() => {
        setImages(files)
        setSelectedImages(new Set())
        setUploadStatus({})
      })
    } finally {
      setIsLoadingImages(false)
    }
  }

  const handleSelectFolder = async (): Promise<void> => {
    const newPath = await window.api.selectFolder()

    if (!newPath) {
      return
    }

    setFolderPath(newPath)
    await loadImages(newPath)
  }

  const handleForgetFolder = async (): Promise<void> => {
    await window.api.setConfig('defaultFolderPath', '')
    setFolderPath(null)
    setImages([])
    setSelectedImages(new Set())
    setUploadStatus({})
    setIsLoadingImages(false)
  }

  const toggleSelection = (id: string): void => {
    setSelectedImages((current) => {
      const next = new Set(current)

      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }

      return next
    })
  }

  const handleSelectAll = (): void => {
    if (allSelected) {
      setSelectedImages(new Set())
      return
    }

    setSelectedImages(new Set(images.map((image) => image.id)))
  }

  const handleUpload = async (): Promise<void> => {
    if (selectedCount === 0 || isUploading) {
      return
    }

    setIsUploading(true)

    const filesToUpload = images.filter((image) => selectedImages.has(image.id))
    const nextSelected = new Set<string>()
    const newUrls: string[] = []

    for (const file of filesToUpload) {
      setUploadStatus((current) => ({ ...current, [file.id]: 'uploading' }))

      const response = await window.api.uploadFile({
        filePath: file.path,
        fileName: file.name
      })

      if (response.success) {
        setUploadStatus((current) => ({ ...current, [file.id]: 'success' }))
        newUrls.unshift(response.url)
      } else {
        setUploadStatus((current) => ({ ...current, [file.id]: 'error' }))
        nextSelected.add(file.id)
      }
    }

    if (newUrls.length > 0) {
      setUploadedUrls((current) => [...newUrls, ...current])
    }

    setSelectedImages(nextSelected)
    setIsUploading(false)
  }

  const copyToClipboard = async (url: string): Promise<void> => {
    await navigator.clipboard.writeText(url)
    setCopiedUrl(url)
    window.setTimeout(() => {
      setCopiedUrl((current) => (current === url ? null : current))
    }, 1400)
  }

  return (
    <div className="h-screen overflow-hidden bg-surface text-gray-200">
      <header className="drag-region flex h-14 shrink-0 items-center justify-between border-b border-white/5 bg-gradient-to-r from-surface100 via-surface100 to-surface px-6 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-brand/20 bg-brand/10 shadow-glow">
            <UploadCloud className="h-5 w-5 text-brand" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-brand/70">Lumea Imperium</p>
            <h1 className="text-sm font-semibold tracking-[0.18em] text-zinc-100">Assets Manager</h1>
          </div>
        </div>

        <div className="no-drag flex items-center gap-3">
          {folderPath && (
            <button
              onClick={() => void handleForgetFolder()}
              className="inline-flex items-center gap-2 rounded-lg border border-white/5 px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:border-white/10 hover:text-zinc-100"
            >
              <X className="h-4 w-4" />
              Olvidar carpeta
            </button>
          )}
          <button
            onClick={() => void handleSelectFolder()}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-black transition-colors hover:bg-brand-light"
          >
            <FolderOpen className="h-4 w-4" />
            Cambiar carpeta
          </button>
        </div>
      </header>

      <main className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 items-start justify-between px-6 pb-3 pt-6">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Directorio local</p>
              <h2 className="mt-2 text-2xl font-semibold text-zinc-100">Previsualizacion segura</h2>
              <p className="mt-2 max-w-2xl truncate text-sm text-zinc-500" title={folderPath ?? ''}>
                {folderPath || 'Ninguna carpeta seleccionada'}
              </p>
            </div>

            {images.length > 0 && (
              <div className="ml-6 flex shrink-0 items-center gap-4 rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3">
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Seleccion</p>
                  <p className="mt-1 text-sm font-medium text-zinc-200">
                    {selectedCount} de {images.length}
                  </p>
                </div>
                <button
                  onClick={handleSelectAll}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-brand transition-colors hover:bg-brand/10 hover:text-brand-light"
                >
                  {allSelected ? 'Deseleccionar' : 'Seleccionar todo'}
                </button>
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
            {!folderPath ? (
              <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-black/10 px-8 text-center">
                <FolderOpen className="h-16 w-16 text-brand/30" />
                <h3 className="mt-5 text-xl font-semibold text-zinc-100">Selecciona una carpeta</h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500">
                  Guarda una carpeta por defecto para abrir la app y continuar tu flujo sin buscarla de nuevo.
                </p>
                <button
                  onClick={() => void handleSelectFolder()}
                  className="mt-6 rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-brand-light"
                >
                  Elegir carpeta
                </button>
              </div>
            ) : isLoadingImages ? (
              <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-white/5 bg-white/[0.02]">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand/80 border-t-transparent" />
                <p className="mt-4 text-sm text-zinc-500">Leyendo imagenes del directorio...</p>
              </div>
            ) : images.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-white/5 bg-white/[0.02] px-8 text-center">
                <ImageIcon className="h-16 w-16 text-zinc-700" />
                <h3 className="mt-5 text-lg font-semibold text-zinc-100">No hay imagenes en esta carpeta</h3>
                <p className="mt-2 max-w-md text-sm text-zinc-500">
                  Busca archivos JPG, PNG, WEBP o GIF y se mostraran aqui con carga diferida.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {images.map((image) => {
                  const isSelected = selectedImages.has(image.id)
                  const status = uploadStatus[image.id]

                  return (
                    <button
                      key={image.id}
                      type="button"
                      disabled={isUploading}
                      onClick={() => toggleSelection(image.id)}
                      className={cn(
                        'group relative aspect-square overflow-hidden rounded-2xl border bg-surface100 text-left transition-all',
                        isSelected
                          ? 'border-brand shadow-[0_0_0_1px_rgba(212,175,55,0.2)]'
                          : 'border-white/5 hover:border-white/15',
                        isUploading && 'cursor-not-allowed opacity-90'
                      )}
                    >
                      <img
                        src={image.url}
                        alt={image.name}
                        className="h-full w-full object-cover bg-surface200"
                        loading="lazy"
                      />

                      <div
                        className={cn(
                          'absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/10 transition-opacity',
                          isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        )}
                      />

                      <div className="absolute left-3 top-3 flex h-6 w-6 items-center justify-center rounded-full border border-white/30 bg-black/40 shadow-lg backdrop-blur-sm">
                        <div
                          className={cn(
                            'h-3 w-3 rounded-full transition-all',
                            isSelected ? 'bg-brand' : 'bg-transparent'
                          )}
                        />
                      </div>

                      {status && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                          {status === 'uploading' && (
                            <div className="h-9 w-9 animate-spin rounded-full border-4 border-brand border-t-transparent" />
                          )}
                          {status === 'success' && <CheckCircle2 className="h-10 w-10 text-emerald-400" />}
                          {status === 'error' && <AlertCircle className="h-10 w-10 text-rose-400" />}
                        </div>
                      )}

                      <div className="absolute inset-x-0 bottom-0 space-y-1 p-3">
                        <p className="truncate text-xs font-medium text-zinc-100">{image.name}</p>
                        <p className="text-[11px] text-zinc-300/80">{formatFileSize(image.size)}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        <aside className="flex w-80 shrink-0 flex-col border-l border-white/5 bg-gradient-to-b from-surface100 to-surface">
          <div className="border-b border-white/5 p-6">
            <div className="rounded-2xl border border-brand/10 bg-brand/5 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-brand/70">Carga por lote</p>
              <p className="mt-2 text-sm text-zinc-400">
                Selecciona imagenes locales y subelas con nombres saneados a Cloudflare R2.
              </p>
              <button
                onClick={() => void handleUpload()}
                disabled={selectedCount === 0 || isUploading}
                className={cn(
                  'mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all',
                  selectedCount === 0 || isUploading
                    ? 'cursor-not-allowed bg-surface200 text-zinc-500'
                    : 'bg-brand text-black shadow-glow hover:bg-brand-light'
                )}
              >
                {isUploading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                    Subiendo...
                  </>
                ) : (
                  <>
                    <UploadCloud className="h-4 w-4" />
                    Subir {selectedCount > 0 ? selectedCount : ''} a R2
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Subidas recientes</p>
                <h3 className="mt-2 text-base font-semibold text-zinc-100">URLs publicas</h3>
              </div>
              <span className="rounded-full border border-white/5 px-2.5 py-1 text-[11px] text-zinc-500">
                {uploadedUrls.length}
              </span>
            </div>

            {uploadedUrls.length === 0 ? (
              <div className="mt-10 rounded-2xl border border-dashed border-white/10 bg-black/10 p-5 text-center text-sm leading-6 text-zinc-600">
                Las URLs disponibles apareceran aqui para copiarlas al terminar cada carga.
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {uploadedUrls.map((url) => (
                  <div
                    key={url}
                    className="group rounded-2xl border border-white/5 bg-white/[0.02] p-3 transition-colors hover:border-brand/20"
                  >
                    <p className="truncate text-xs text-zinc-300" title={url}>
                      {url}
                    </p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-[11px] text-zinc-500">
                        {copiedUrl === url ? 'Copiado' : 'Lista para pegar'}
                      </span>
                      <button
                        type="button"
                        onClick={() => void copyToClipboard(url)}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-brand transition-colors hover:bg-brand/10 hover:text-brand-light"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copiar URL
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </main>
    </div>
  )
}

export default App
