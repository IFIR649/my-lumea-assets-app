import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

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

const api = {
  getConfig: (key: ConfigKey): Promise<string> => ipcRenderer.invoke('get-config', key),
  setConfig: (key: ConfigKey, value: string): Promise<boolean> =>
    ipcRenderer.invoke('set-config', key, value),
  selectFolder: (): Promise<string | null> => ipcRenderer.invoke('select-folder'),
  readDirectory: (folderPath: string): Promise<LocalImage[]> =>
    ipcRenderer.invoke('read-directory', folderPath),
  uploadFile: (fileData: UploadFilePayload): Promise<UploadFileResult> =>
    ipcRenderer.invoke('upload-file', fileData)
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
