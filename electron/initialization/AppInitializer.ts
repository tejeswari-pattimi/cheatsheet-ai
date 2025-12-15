import { app } from "electron"
import path from "path"
import fs from "fs"
import * as dotenv from "dotenv"
import { configHelper } from "../ConfigHelper"
import { initAutoUpdater } from "../autoUpdater"
import { WindowManager } from "../window/WindowManager"
import { appState } from "../state/AppState"
import { initializeIpcHandlers } from "../ipcHandlers"
import { ProcessingHelper } from "../ProcessingHelper"
import { ScreenshotHelper } from "../ScreenshotHelper"
import { ShortcutsHelper } from "../shortcuts"
import { IProcessingHelperDeps, IShortcutsHelperDeps } from "../main"

const isDev = process.env.NODE_ENV === "development"

export class AppInitializer {
  static loadEnvVariables(): void {
    if (isDev) {
      console.log("Loading env variables from:", path.join(process.cwd(), ".env"))
      dotenv.config({ path: path.join(process.cwd(), ".env") })
    } else {
      console.log(
        "Loading env variables from:",
        path.join(process.resourcesPath, ".env")
      )
      dotenv.config({ path: path.join(process.resourcesPath, ".env") })
    }
    console.log("Environment variables loaded for open-source version")
  }

  static setupPaths(): void {
    try {
      // Set custom cache directory to prevent permission issues
      let appDataPath: string
      try {
        appDataPath = path.join(app.getPath('appData'), 'cheatsheet-ai')
      } catch (pathError) {
        console.error('Error getting appData path, using fallback:', pathError)
        appDataPath = path.join(process.cwd(), 'cheatsheet-ai-data')
      }

      const sessionPath = path.join(appDataPath, 'session')
      const tempPath = path.join(appDataPath, 'temp')
      const cachePath = path.join(appDataPath, 'cache')

      // Create directories if they don't exist
      for (const dir of [appDataPath, sessionPath, tempPath, cachePath]) {
        try {
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
          }
        } catch (mkdirError) {
          console.error(`Error creating directory ${dir}:`, mkdirError)
        }
      }

      try {
        app.setPath('userData', appDataPath)
        app.setPath('sessionData', sessionPath)
        app.setPath('temp', tempPath)
        app.setPath('cache', cachePath)
      } catch (setPathError) {
        console.error('Error setting app paths:', setPathError)
      }
    } catch (error) {
      console.error("Error setting up paths:", error)
    }
  }

  static initializeHelpers(): void {
    // Need to import these from main.ts or define them here?
    // Since main.ts exports getters/setters, we can use those via a wrapper or pass callbacks.
    // However, AppInitializer is importing from main.ts which might cause circular dep.
    // We should refactor main.ts to expose these via a cleaner interface or move getters to AppState.

    // Using AppState directly
    appState.setScreenshotHelper(new ScreenshotHelper(appState.view))

    // We need to construct the dependencies objects.
    // Since AppState has the data, we can define the functions here or in AppState.
    // But ProcessingHelper/ShortcutsHelper expect specific interfaces.
    // Let's rely on getters/setters from AppState/WindowManager

    // We'll define the deps here using the new architecture
    const processingDeps: IProcessingHelperDeps = {
      getScreenshotHelper: () => appState.screenshotHelper,
      getMainWindow: () => appState.mainWindow,
      getView: () => appState.view,
      setView: (view) => {
        appState.setView(view)
        appState.screenshotHelper?.setView(view)
      },
      getProblemInfo: () => appState.problemInfo,
      setProblemInfo: (info) => appState.setProblemInfo(info),
      getScreenshotQueue: () => appState.screenshotHelper?.getScreenshotQueue() || [],
      getExtraScreenshotQueue: () => appState.screenshotHelper?.getExtraScreenshotQueue() || [],
      clearQueues: () => {
        appState.screenshotHelper?.clearQueues()
        appState.setProblemInfo(null)
        appState.setView("queue")
        appState.screenshotHelper?.setView("queue")
      },
      takeScreenshot: async () => {
        if (!appState.mainWindow) throw new Error("No main window available")
        return (
          appState.screenshotHelper?.takeScreenshot(
            () => WindowManager.hideMainWindow(),
            () => WindowManager.showMainWindow()
          ) || ""
        )
      },
      getImagePreview: async (filepath) => appState.screenshotHelper?.getImagePreview(filepath) || "",
      deleteScreenshot: async (path) => appState.screenshotHelper?.deleteScreenshot(path) || { success: false, error: "Not initialized" },
      setHasDebugged: (val) => appState.setHasDebugged(val),
      getHasDebugged: () => appState.hasDebugged,
      PROCESSING_EVENTS: {
        UNAUTHORIZED: "processing-unauthorized",
        NO_SCREENSHOTS: "processing-no-screenshots",
        OUT_OF_CREDITS: "out-of-credits",
        API_KEY_INVALID: "api-key-invalid",
        INITIAL_START: "initial-start",
        PROBLEM_EXTRACTED: "problem-extracted",
        SOLUTION_SUCCESS: "solution-success",
        INITIAL_SOLUTION_ERROR: "solution-error",
        DEBUG_START: "debug-start",
        DEBUG_SUCCESS: "debug-success",
        DEBUG_ERROR: "debug-error",
        SHOW_ERROR_NOTIFICATION: "show-error-notification"
      }
    }

    appState.setProcessingHelper(new ProcessingHelper(processingDeps))

    const shortcutsDeps: IShortcutsHelperDeps = {
      getMainWindow: () => appState.mainWindow,
      takeScreenshot: async () => {
        if (!appState.mainWindow) throw new Error("No main window available")
        return (
          appState.screenshotHelper?.takeScreenshot(
            () => WindowManager.hideMainWindow(),
            () => WindowManager.showMainWindow()
          ) || ""
        )
      },
      getImagePreview: async (filepath) => appState.screenshotHelper?.getImagePreview(filepath) || "",
      processingHelper: appState.processingHelper,
      clearQueues: () => {
        appState.screenshotHelper?.clearQueues()
        appState.setProblemInfo(null)
        appState.setView("queue")
        appState.screenshotHelper?.setView("queue")
      },
      setView: (view) => {
        appState.setView(view)
        appState.screenshotHelper?.setView(view)
      },
      isVisible: () => appState.isWindowVisible,
      toggleMainWindow: WindowManager.toggleMainWindow,
      moveWindowLeft: () => WindowManager.moveWindowHorizontal((x) => Math.max(-(appState.windowSize?.width || 0) / 2, x - appState.step)),
      moveWindowRight: () => WindowManager.moveWindowHorizontal((x) => Math.min(appState.screenWidth - (appState.windowSize?.width || 0) / 2, x + appState.step)),
      moveWindowUp: () => WindowManager.moveWindowVertical((y) => y - appState.step),
      moveWindowDown: () => WindowManager.moveWindowVertical((y) => y + appState.step),
      centerWindow: WindowManager.centerWindow
    }

    appState.setShortcutsHelper(new ShortcutsHelper(shortcutsDeps))
  }

  static async initialize(): Promise<void> {
    try {
      this.setupPaths()
      this.loadEnvVariables()

      // Check application status from remote server
      const { statusHelper } = await import("../StatusHelper")
      await statusHelper.fetchStatus()
      
      if (!statusHelper.isEnabled()) {
        const message = statusHelper.getMessage() || "Application is currently disabled. Please try again later."
        console.error("[Status] Application disabled:", message)
        // Show error dialog and quit
        const { dialog } = await import("electron")
        dialog.showErrorBox("Application Disabled", message)
        app.quit()
        return
      }
      
      console.log("[Status] Application enabled, mode:", statusHelper.getMode())

      // Ensure a configuration file exists
      if (!configHelper.hasApiKey()) {
        console.log("No API key found in configuration. User will need to set up.")
      }

      this.initializeHelpers()

      // Initialize IPC Handlers
      // We need to pass deps to initializeIpcHandlers
      // Instead of duplicating the logic, we should probably construct a deps object
      // But IPC handlers expect a specific interface.

      const ipcDeps = {
        getMainWindow: () => appState.mainWindow,
        setWindowDimensions: WindowManager.setWindowDimensions,
        getScreenshotQueue: () => appState.screenshotHelper?.getScreenshotQueue() || [],
        getExtraScreenshotQueue: () => appState.screenshotHelper?.getExtraScreenshotQueue() || [],
        deleteScreenshot: async (path: string) => appState.screenshotHelper?.deleteScreenshot(path) || { success: false, error: "Not initialized" },
        getImagePreview: async (filepath: string) => appState.screenshotHelper?.getImagePreview(filepath) || "",
        processingHelper: appState.processingHelper,
        shortcutsHelper: appState.shortcutsHelper,
        PROCESSING_EVENTS: {
            UNAUTHORIZED: "processing-unauthorized",
            NO_SCREENSHOTS: "processing-no-screenshots",
            OUT_OF_CREDITS: "out-of-credits",
            API_KEY_INVALID: "api-key-invalid",
            INITIAL_START: "initial-start",
            PROBLEM_EXTRACTED: "problem-extracted",
            SOLUTION_SUCCESS: "solution-success",
            INITIAL_SOLUTION_ERROR: "solution-error",
            DEBUG_START: "debug-start",
            DEBUG_SUCCESS: "debug-success",
            DEBUG_ERROR: "debug-error",
            SHOW_ERROR_NOTIFICATION: "show-error-notification"
        }, // We can import this from AppState
        takeScreenshot: async () => {
            if (!appState.mainWindow) throw new Error("No main window available")
            return (
              appState.screenshotHelper?.takeScreenshot(
                () => WindowManager.hideMainWindow(),
                () => WindowManager.showMainWindow()
              ) || ""
            )
        },
        getView: () => appState.view,
        toggleMainWindow: WindowManager.toggleMainWindow,
        clearQueues: () => {
            appState.screenshotHelper?.clearQueues()
            appState.setProblemInfo(null)
            appState.setView("queue")
            appState.screenshotHelper?.setView("queue")
        },
        setView: (view: any) => {
            appState.setView(view)
            appState.screenshotHelper?.setView(view)
        },
        moveWindowLeft: () => WindowManager.moveWindowHorizontal((x) => Math.max(-(appState.windowSize?.width || 0) / 2, x - appState.step)),
        moveWindowRight: () => WindowManager.moveWindowHorizontal((x) => Math.min(appState.screenWidth - (appState.windowSize?.width || 0) / 2, x + appState.step)),
        moveWindowUp: () => WindowManager.moveWindowVertical((y) => y - appState.step),
        moveWindowDown: () => WindowManager.moveWindowVertical((y) => y + appState.step)
      }

      initializeIpcHandlers(ipcDeps as any) // Casting because interface might be slightly different or stricter

      await WindowManager.createWindow()
      appState.shortcutsHelper?.registerGlobalShortcuts()

      // Initialize auto-updater regardless of environment
      initAutoUpdater()
      console.log(
        "Auto-updater initialized in",
        isDev ? "development" : "production",
        "mode"
      )
    } catch (error) {
      console.error("Failed to initialize application:", error)
      app.quit()
    }
  }
}
