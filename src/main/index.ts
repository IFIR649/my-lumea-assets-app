import { app, shell, BrowserWindow, dialog, ipcMain, net, protocol } from 'electron'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { lookup as lookupMimeType } from 'mime-types'
import * as dotenv from 'dotenv'
import Store from 'electron-store'
import icon from '../../resources/icon.png?asset'

dotenv.config({ path: join(process.cwd(), '.env') })

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local',
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
])

const IMAGE_FILE_PATTERN = /\.(jpg|jpeg|png|webp|gif)$/i

type ConfigKey = 'defaultFolderPath' | 'shipmentLabelsFolderPath'

type StoreSchema = {
  defaultFolderPath: string
  shipmentLabelsFolderPath: string
}

type LocalImage = {
  id: string
  name: string
  path: string
  url: string
  size: number
  modifiedAt: number
}

type UploadFilePayload = {
  filePath: string
  fileName: string
}

type UploadFileResult = { success: true; url: string } | { success: false; error: string }

type ShipmentLabelFileRequest = {
  orderId: string
  guideIndex: number
  trackingNumber: string | null
  sourceUrl: string
}

type ShipmentLabelFile = {
  orderId: string
  guideIndex: number
  trackingNumber: string | null
  fileName: string
  path: string
  url: string
  exists: boolean
}

type EnsureShipmentLabelFilesPayload = {
  labels: ShipmentLabelFileRequest[]
  force?: boolean
}

type EnsureShipmentLabelFilesResult =
  | { success: true; files: ShipmentLabelFile[] }
  | { success: false; error: string }

type LocalFileActionResult = { success: true } | { success: false; error: string }

const store = new Store<StoreSchema>({
  defaults: {
    defaultFolderPath: '',
    shipmentLabelsFolderPath: ''
  }
})

let s3Client: S3Client | null = null

function getRequiredEnvVar(name: keyof NodeJS.ProcessEnv): string {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

function getS3Client(): S3Client {
  if (s3Client) {
    return s3Client
  }

  s3Client = new S3Client({
    region: 'auto',
    endpoint: getRequiredEnvVar('CF_R2_ENDPOINT'),
    credentials: {
      accessKeyId: getRequiredEnvVar('CF_R2_ACCESS_KEY_ID'),
      secretAccessKey: getRequiredEnvVar('CF_R2_SECRET_ACCESS_KEY')
    }
  })

  return s3Client
}

function sanitizeFileName(fileName: string): string {
  const cleaned = fileName
    .replace(/[^a-zA-Z0-9.-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()

  return cleaned || `asset-${Date.now()}`
}

function buildLocalFileUrl(filePath: string): string {
  return `local://${encodeURIComponent(filePath)}`
}

function getDefaultShipmentLabelsFolderPath(): string {
  return join(app.getPath('documents'), 'Lumea Imperium', 'Guias')
}

function resolveShipmentLabelsFolderPath(): string {
  return store.get('shipmentLabelsFolderPath') || getDefaultShipmentLabelsFolderPath()
}

async function ensureShipmentLabelsFolderPath(): Promise<string> {
  const folderPath = resolveShipmentLabelsFolderPath()
  await mkdir(folderPath, { recursive: true })
  return folderPath
}

function buildShipmentLabelFilePath(request: ShipmentLabelFileRequest, folderPath: string): ShipmentLabelFile {
  const orderFolder = join(folderPath, sanitizeFileName(request.orderId))
  const trackingPart = sanitizeFileName(request.trackingNumber || `guia-${request.guideIndex}`)
  const fileName = `${String(request.guideIndex).padStart(2, '0')}-${trackingPart}.pdf`
  const fullPath = join(orderFolder, fileName)
  return {
    orderId: request.orderId,
    guideIndex: request.guideIndex,
    trackingNumber: request.trackingNumber,
    fileName,
    path: fullPath,
    url: buildLocalFileUrl(fullPath),
    exists: existsSync(fullPath)
  }
}

async function downloadShipmentLabelFile(
  request: ShipmentLabelFileRequest,
  force = false
): Promise<ShipmentLabelFile> {
  const folderPath = await ensureShipmentLabelsFolderPath()
  const labelFile = buildShipmentLabelFilePath(request, folderPath)
  await mkdir(join(folderPath, sanitizeFileName(request.orderId)), { recursive: true })

  if (!force && labelFile.exists) {
    return labelFile
  }

  const response = await net.fetch(request.sourceUrl)
  if (!response.ok) {
    throw new Error(`No se pudo descargar la guia (${response.status}).`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  await writeFile(labelFile.path, buffer)
  return { ...labelFile, exists: true }
}

async function printLocalPdf(filePath: string): Promise<void> {
  const viewer = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  try {
    await viewer.loadURL(buildLocalFileUrl(filePath))
    await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => reject(new Error('Timeout imprimiendo PDF.')), 15000)
      viewer.webContents.print({ silent: false, printBackground: true }, (success, failureReason) => {
        clearTimeout(timeoutId)
        if (success) {
          resolve()
          return
        }
        reject(new Error(failureReason || 'No se pudo enviar el PDF a impresion.'))
      })
    })
  } finally {
    viewer.close()
  }
}

function createWindow(): void {
  const titleBarOptions =
    process.platform === 'win32'
      ? {
          titleBarStyle: 'hidden' as const,
          titleBarOverlay: {
            color: '#0f0f0f',
            symbolColor: '#f5f5f5',
            height: 56
          }
        }
      : process.platform === 'darwin'
        ? { titleBarStyle: 'hiddenInset' as const }
        : {}

  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1080,
    minHeight: 720,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0b0b0c',
    ...(process.platform === 'linux' ? { icon } : {}),
    ...titleBarOptions,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  protocol.handle('local', (request) => {
    const encodedPath = request.url.replace('local://', '')
    const filePath = decodeURIComponent(encodedPath)
    return net.fetch(pathToFileURL(filePath).toString())
  })

  ipcMain.handle('get-config', (_, key: ConfigKey): string => {
    if (key === 'shipmentLabelsFolderPath') {
      return resolveShipmentLabelsFolderPath()
    }
    return store.get(key)
  })

  ipcMain.handle('set-config', (_, key: ConfigKey, value: string): boolean => {
    store.set(key, value)
    return true
  })

  ipcMain.handle('select-folder', async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Selecciona la carpeta de imagenes por defecto'
    })

    if (result.canceled) {
      return null
    }

    const folderPath = result.filePaths[0]
    store.set('defaultFolderPath', folderPath)

    return folderPath
  })

  ipcMain.handle('select-shipment-labels-folder', async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Selecciona la carpeta local para guardar guias'
    })

    if (result.canceled) {
      return null
    }

    const folderPath = result.filePaths[0]
    store.set('shipmentLabelsFolderPath', folderPath)

    return folderPath
  })

  ipcMain.handle('read-directory', async (_, folderPath: string): Promise<LocalImage[]> => {
    if (!folderPath || !existsSync(folderPath)) {
      return []
    }

    try {
      const files = await readdir(folderPath)
      const images = await Promise.all(
        files.filter((file) => IMAGE_FILE_PATTERN.test(file)).map(async (file) => {
          const fullPath = join(folderPath, file)
          const fileStats = await stat(fullPath)

          return {
            id: file,
            name: file,
            path: fullPath,
            url: `local://${encodeURIComponent(fullPath)}`,
            size: fileStats.size,
            modifiedAt: fileStats.mtimeMs
          }
        })
      )

      return images.sort((left, right) => right.modifiedAt - left.modifiedAt)
    } catch (error) {
      console.error('Error leyendo directorio:', error)
      return []
    }
  })

  ipcMain.handle(
    'upload-file',
    async (_, { filePath, fileName }: UploadFilePayload): Promise<UploadFileResult> => {
      try {
        if (!existsSync(filePath)) {
          throw new Error('The selected file no longer exists.')
        }

        const fileBuffer = await readFile(filePath)
        const contentType = lookupMimeType(filePath) || 'application/octet-stream'
        const cleanFileName = sanitizeFileName(fileName)
        const s3Key = `productos/${Date.now()}-${cleanFileName}`

        const command = new PutObjectCommand({
          Bucket: getRequiredEnvVar('CF_R2_BUCKET_NAME'),
          Key: s3Key,
          Body: fileBuffer,
          ContentType: contentType
        })

        await getS3Client().send(command)

        return {
          success: true,
          url: `${getRequiredEnvVar('CF_R2_PUBLIC_BASE_URL')}/${s3Key}`
        }
      } catch (error) {
        console.error(`Error subiendo ${fileName}:`, error)

        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown upload error'
        }
      }
    }
  )

  ipcMain.handle(
    'ensure-shipment-label-files',
    async (_, payload: EnsureShipmentLabelFilesPayload): Promise<EnsureShipmentLabelFilesResult> => {
      try {
        const labels = Array.isArray(payload?.labels) ? payload.labels : []
        const files = await Promise.all(
          labels.map((label) => downloadShipmentLabelFile(label, Boolean(payload?.force)))
        )
        return { success: true, files }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'No se pudieron preparar las guias.'
        }
      }
    }
  )

  ipcMain.handle('open-local-file', async (_, filePath: string): Promise<LocalFileActionResult> => {
    try {
      if (!filePath || !existsSync(filePath)) {
        throw new Error('El archivo local no existe.')
      }
      const result = await shell.openPath(filePath)
      if (result) {
        throw new Error(result)
      }
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'No se pudo abrir el archivo.'
      }
    }
  })

  ipcMain.handle(
    'show-item-in-folder',
    async (_, filePath: string): Promise<LocalFileActionResult> => {
      try {
        if (!filePath || !existsSync(filePath)) {
          throw new Error('El archivo local no existe.')
        }
        shell.showItemInFolder(filePath)
        return { success: true }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'No se pudo abrir la carpeta.'
        }
      }
    }
  )

  ipcMain.handle('print-local-pdf', async (_, filePath: string): Promise<LocalFileActionResult> => {
    try {
      if (!filePath || !existsSync(filePath)) {
        throw new Error('El archivo PDF local no existe.')
      }
      await printLocalPdf(filePath)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'No se pudo imprimir el PDF.'
      }
    }
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('before-quit', () => {
  protocol.unhandle('local')
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
