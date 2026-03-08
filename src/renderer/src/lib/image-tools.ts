export type ImageOptimization = {
  optimizedSize: number
  savedBytes: number
  savedPercent: number
  outputType: string
}

export type ImageRecord = {
  id: string
  name: string
  url: string
  size: number
  file: File
  originalSize: number
  optimization: ImageOptimization | null
}

export function fmtSize(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export function createImageRecord(file: File): ImageRecord {
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

export function revokeImageRecordUrls(records: Array<Pick<ImageRecord, 'url'>>): void {
  for (const record of records) {
    URL.revokeObjectURL(record.url)
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

export async function optimizeImageFile(file: File): Promise<File> {
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
    const ext = outputType.includes('png') ? 'png' : outputType.includes('jpeg') ? 'jpg' : 'webp'
    const nextName = replaceExt(file.name, ext)

    return new File([blob], nextName, {
      type: outputType,
      lastModified: Date.now()
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}
