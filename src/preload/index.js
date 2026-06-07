import { contextBridge, ipcRenderer, webUtils } from 'electron'

contextBridge.exposeInMainWorld('api', {
  selectVideos: () => ipcRenderer.invoke('select-videos'),
  selectOutput: () => ipcRenderer.invoke('select-output'),
  mergeVideos: (data) => ipcRenderer.invoke('merge-videos', data),
  showInFolder: (path) => ipcRenderer.invoke('show-in-folder', path),
  getFilePath: (file) => webUtils.getPathForFile(file),
  onMergeProgress: (cb) => {
    const handler = (_, data) => cb(data)
    ipcRenderer.on('merge-progress', handler)
    return () => ipcRenderer.removeListener('merge-progress', handler)
  }
})
