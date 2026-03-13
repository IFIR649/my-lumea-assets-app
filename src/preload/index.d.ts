import { ElectronAPI } from '@electron-toolkit/preload'

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

type AppAPI = {
  getConfig: (key: ConfigKey) => Promise<string>
  setConfig: (key: ConfigKey, value: string) => Promise<boolean>
  selectFolder: () => Promise<string | null>
  selectShipmentLabelsFolder: () => Promise<string | null>
  readDirectory: (folderPath: string) => Promise<LocalImage[]>
  uploadFile: (fileData: UploadFilePayload) => Promise<UploadFileResult>
  ensureShipmentLabelFiles: (payload: EnsureShipmentLabelFilesPayload) => Promise<EnsureShipmentLabelFilesResult>
  clearShipmentLabelFiles: () => Promise<LocalFileActionResult>
  openLocalFile: (filePath: string) => Promise<LocalFileActionResult>
  showItemInFolder: (filePath: string) => Promise<LocalFileActionResult>
  printLocalPdf: (filePath: string) => Promise<LocalFileActionResult>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: AppAPI
  }
}
