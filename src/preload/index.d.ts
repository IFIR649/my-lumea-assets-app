import { ElectronAPI } from '@electron-toolkit/preload'

type ConfigKey = 'defaultFolderPath'

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

type AppAPI = {
  getConfig: (key: ConfigKey) => Promise<string>
  setConfig: (key: ConfigKey, value: string) => Promise<boolean>
  selectFolder: () => Promise<string | null>
  readDirectory: (folderPath: string) => Promise<LocalImage[]>
  uploadFile: (fileData: UploadFilePayload) => Promise<UploadFileResult>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: AppAPI
  }
}
