import { app, BrowserWindow } from "electron"
import path from "path"
import { ScreenshotHelper } from "./ScreenshotHelper"
import { ProcessingHelper } from "./ProcessingHelper"
import { ShortcutsHelper } from "./shortcuts"
import { AppInitializer } from "./initialization/AppInitializer"
import { appState, PROCESSING_EVENTS } from "./state/AppState"
import { WindowManager } from "./window/WindowManager"

// Global error handlers to prevent crashes
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
  // Log but don't crash - allow app to continue if possible
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
  // Log but don't crash - allow app to continue if possible
})

// Handle process termination signals (for dev server cleanup)
process.on('SIGINT', () => {
  console.log('SIGINT received, quitting app...')
  app.quit()
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('SIGTERM received, quitting app...')
  app.quit()
  process.exit(0)
})

// In development, also listen for parent process exit
if (process.env.NODE_ENV === 'development') {
  process.on('disconnect', () => {
    console.log('Parent process disconnected, quitting app...')
    app.quit()
    process.exit(0)
  })
}

// Register the cheatsheet-ai protocol
if (process.platform === "darwin") {
  app.setAsDefaultProtocolClient("cheatsheet-ai")
} else {
  app.setAsDefaultProtocolClient("cheatsheet-ai", process.execPath, [
    path.resolve(process.argv[1] || "")
  ])
}

// Handle the protocol. In this case, we choose to show an Error Box.
if (process.defaultApp && process.argv.length >= 2) {
  app.setAsDefaultProtocolClient("cheatsheet-ai", process.execPath, [
    path.resolve(process.argv[1])
  ])
}

// Force Single Instance Lock - Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  console.log("Another instance is already running. Quitting this instance.")
  app.quit()
} else {
  console.log("Single instance lock acquired successfully")

  app.on("second-instance", (_event, _commandLine) => {
    console.log("Second instance attempted to start. Focusing existing window.")
    // Someone tried to run a second instance, we should focus our window.
    if (appState.mainWindow) {
      if (appState.mainWindow.isMinimized()) {
        appState.mainWindow.restore()
      }
      appState.mainWindow.show()
      appState.mainWindow.focus()
    }
  })
}

// Auth callback handling removed - no longer needed
app.on("open-url", (event, url) => {
  console.log("open-url event received:", url)
  event.preventDefault()
})

// Window lifecycle management
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
    appState.setMainWindow(null)
  }
})

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    WindowManager.createWindow()
  }
})

// Initialize application
app.whenReady().then(() => AppInitializer.initialize())

// Interfaces needed for other files
// Re-exporting interfaces used by other files (or define them here if they need to be)
// Note: Ideally these interfaces should be in a shared types file or in their respective helper files.
// But to avoid breaking changes in other files that import from './main', we can keep them here or redirect.

export interface IProcessingHelperDeps {
  getScreenshotHelper: () => ScreenshotHelper | null
  getMainWindow: () => BrowserWindow | null
  getView: () => "queue" | "solutions" | "debug"
  setView: (view: "queue" | "solutions" | "debug") => void
  getProblemInfo: () => any
  setProblemInfo: (info: any) => void
  getScreenshotQueue: () => string[]
  getExtraScreenshotQueue: () => string[]
  clearQueues: () => void
  takeScreenshot: () => Promise<string>
  getImagePreview: (filepath: string) => Promise<string>
  deleteScreenshot: (
    path: string
  ) => Promise<{ success: boolean; error?: string }>
  setHasDebugged: (value: boolean) => void
  getHasDebugged: () => boolean
  PROCESSING_EVENTS: typeof PROCESSING_EVENTS
}

export interface IShortcutsHelperDeps {
  getMainWindow: () => BrowserWindow | null
  takeScreenshot: () => Promise<string>
  getImagePreview: (filepath: string) => Promise<string>
  processingHelper: ProcessingHelper | null
  clearQueues: () => void
  setView: (view: "queue" | "solutions" | "debug") => void
  isVisible: () => boolean
  toggleMainWindow: () => void
  moveWindowLeft: () => void
  moveWindowRight: () => void
  moveWindowUp: () => void
  moveWindowDown: () => void
  centerWindow: () => void
}

export interface IIpcHandlerDeps {
  getMainWindow: () => BrowserWindow | null
  setWindowDimensions: (width: number, height: number) => void
  getScreenshotQueue: () => string[]
  getExtraScreenshotQueue: () => string[]
  deleteScreenshot: (
    path: string
  ) => Promise<{ success: boolean; error?: string }>
  getImagePreview: (filepath: string) => Promise<string>
  processingHelper: ProcessingHelper | null
  shortcutsHelper: ShortcutsHelper | null
  PROCESSING_EVENTS: typeof PROCESSING_EVENTS
  takeScreenshot: () => Promise<string>
  getView: () => "queue" | "solutions" | "debug"
  toggleMainWindow: () => void
  clearQueues: () => void
  setView: (view: "queue" | "solutions" | "debug") => void
  moveWindowLeft: () => void
  moveWindowRight: () => void
  moveWindowUp: () => void
  moveWindowDown: () => void
}
