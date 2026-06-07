import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join } from 'path'
import { writeFileSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { spawn } from 'child_process'
import ffmpegStaticPath from 'ffmpeg-static'

function getFfmpegPath() {
  if (app.isPackaged) {
    return ffmpegStaticPath.replace('app.asar', 'app.asar.unpacked')
  }
  return ffmpegStaticPath
}

function createWindow() {
  const win = new BrowserWindow({
    width: 820,
    height: 640,
    minWidth: 600,
    minHeight: 500,
    title: 'Videos Linker',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  win.setMenuBarVisibility(false)

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

ipcMain.handle('select-videos', async () => {
  const { filePaths } = await dialog.showOpenDialog({
    title: 'Sélectionner des vidéos',
    properties: ['openFile', 'multiSelections'],
    filters: [
      {
        name: 'Vidéos',
        extensions: ['mp4', 'avi', 'mkv', 'mov', 'webm', 'flv', 'wmv', 'ts', 'm4v', '3gp']
      }
    ]
  })
  return filePaths
})

ipcMain.handle('select-output', async () => {
  const { filePath } = await dialog.showSaveDialog({
    title: 'Choisir le fichier de sortie',
    defaultPath: 'output.mp4',
    filters: [{ name: 'Vidéo MP4', extensions: ['mp4'] }]
  })
  return filePath || null
})

ipcMain.handle('merge-videos', async (event, { videoPaths, outputPath }) => {
  if (!Array.isArray(videoPaths) || videoPaths.length < 2) {
    throw new Error('Au moins 2 vidéos sont requises.')
  }
  if (!outputPath || typeof outputPath !== 'string') {
    throw new Error('Chemin de sortie invalide.')
  }

  const ffmpegPath = getFfmpegPath()
  const listPath = join(tmpdir(), `vl_concat_${Date.now()}.txt`)

  // Double-quoted paths handle apostrophes; escape only double quotes (rare in filenames)
  const listContent = videoPaths
    .map(p => `file "${p.replace(/\\/g, '/').replace(/"/g, '\\"')}"`)
    .join('\n')

  writeFileSync(listPath, listContent, 'utf8')

  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, [
      '-fflags', '+genpts',
      '-f', 'concat',
      '-safe', '0',
      '-i', listPath,
      '-c', 'copy',
      '-movflags', '+faststart',
      '-y',
      outputPath
    ])

    let stderr = ''

    proc.stderr.on('data', (data) => {
      const chunk = data.toString()
      stderr += chunk

      const timeMatch = chunk.match(/time=(\d{2}:\d{2}:\d{2}\.\d{2})/)
      if (timeMatch) {
        event.sender.send('merge-progress', { time: timeMatch[1] })
      }
    })

    proc.on('close', (code) => {
      try { unlinkSync(listPath) } catch {}
      if (code === 0) {
        resolve({ success: true, outputPath })
      } else {
        reject(new Error(`FFmpeg a échoué (code ${code}).\n${stderr.slice(-500)}`))
      }
    })

    proc.on('error', (err) => {
      try { unlinkSync(listPath) } catch {}
      reject(err)
    })
  })
})

ipcMain.handle('show-in-folder', (_, filePath) => {
  shell.showItemInFolder(filePath)
})
