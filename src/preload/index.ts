import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

type ConfigKey = 'defaultFolderPath' | 'shipmentLabelsFolderPath'

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

const api = {
  getConfig: (key: ConfigKey): Promise<string> => ipcRenderer.invoke('get-config', key),
  setConfig: (key: ConfigKey, value: string): Promise<boolean> =>
    ipcRenderer.invoke('set-config', key, value),
  selectFolder: (): Promise<string | null> => ipcRenderer.invoke('select-folder'),
  selectShipmentLabelsFolder: (): Promise<string | null> =>
    ipcRenderer.invoke('select-shipment-labels-folder'),
  readDirectory: (folderPath: string): Promise<LocalImage[]> =>
    ipcRenderer.invoke('read-directory', folderPath),
  uploadFile: (fileData: UploadFilePayload): Promise<UploadFileResult> =>
    ipcRenderer.invoke('upload-file', fileData),
  ensureShipmentLabelFiles: (
    payload: EnsureShipmentLabelFilesPayload
  ): Promise<EnsureShipmentLabelFilesResult> =>
    ipcRenderer.invoke('ensure-shipment-label-files', payload),
  clearShipmentLabelFiles: (): Promise<LocalFileActionResult> =>
    ipcRenderer.invoke('clear-shipment-label-files'),
  openLocalFile: (filePath: string): Promise<LocalFileActionResult> =>
    ipcRenderer.invoke('open-local-file', filePath),
  showItemInFolder: (filePath: string): Promise<LocalFileActionResult> =>
    ipcRenderer.invoke('show-item-in-folder', filePath),
  printLocalPdf: (filePath: string): Promise<LocalFileActionResult> =>
    ipcRenderer.invoke('print-local-pdf', filePath)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
