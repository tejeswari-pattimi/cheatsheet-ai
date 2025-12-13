import { BrowserWindow, screen, shell } from "electron"
import path from "path"
import fs from "fs"
import { appState } from "../state/AppState"
import { configHelper } from "../ConfigHelper"

const isDev = process.env.NODE_ENV === "development"

export class WindowManager {
  static async createWindow(): Promise<void> {
    if (appState.mainWindow) {
      if (appState.mainWindow.isMinimized()) appState.mainWindow.restore()
      appState.mainWindow.focus()
      return
    }

    const primaryDisplay = screen.getPrimaryDisplay()
    const workArea = primaryDisplay.workAreaSize
    appState.setScreenWidth(workArea.width)
    appState.setScreenHeight(workArea.height)
    appState.setStep(60)
    appState.setCurrentY(50)

    // Try to load custom icon from multiple possible locations
    let iconPath: string | undefined
    const possibleIconPaths = [
      // ICO file (priority for Windows)
      path.join(__dirname, '..', '..', 'assets', 'icons', 'win', 'icon.ico'),
      path.join(__dirname, '..', '..', '..', 'assets', 'icons', 'win', 'icon.ico'),
      path.join(process.resourcesPath, 'assets', 'icons', 'win', 'icon.ico'),
      path.join(__dirname, '../../build/icon.ico'),
      // PNG fallbacks
      path.join(__dirname, '../../build/icon.png'),
      path.join(process.resourcesPath, 'build', 'icon.png'),
      // Modern style icon
      path.join(__dirname, '..', '..', 'assets', 'icons', 'win', 'modern style icon fo.png'),
      path.join(__dirname, '..', '..', '..', 'assets', 'icons', 'win', 'modern style icon fo.png'),
      path.join(process.resourcesPath, 'assets', 'icons', 'win', 'modern style icon fo.png')
    ]

    for (const testPath of possibleIconPaths) {
      if (fs.existsSync(testPath)) {
        iconPath = testPath
        console.log('Using icon from:', iconPath)
        break
      }
    }

    if (!iconPath) {
      console.log('No custom icon found, using Electron default icon')
    }

    const windowSettings: Electron.BrowserWindowConstructorOptions = {
      width: 800,
      height: 600,
      minWidth: 750,
      minHeight: 550,
      x: appState.currentX,
      y: 50,
      alwaysOnTop: true,
      ...(iconPath && { icon: iconPath }),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: isDev
          ? path.join(__dirname, "../../dist-electron/preload.js")
          : path.join(__dirname, "../preload.js"),
        scrollBounce: true
      },
      show: true,
      frame: false,
      transparent: true,
      fullscreenable: false,
      hasShadow: false,
      opacity: 1.0,  // Start with full opacity
      backgroundColor: "#00000000",
      focusable: true,
      skipTaskbar: true,
      type: "panel",
      paintWhenInitiallyHidden: true,
      titleBarStyle: "hidden",
      enableLargerThanScreen: false,
      movable: true
    }

    const mainWindow = new BrowserWindow(windowSettings)
    appState.setMainWindow(mainWindow)

    // Add more detailed logging for window events
    mainWindow.webContents.on("did-finish-load", () => {
      console.log("Window finished loading")
    })
    mainWindow.webContents.on(
      "did-fail-load",
      async (event, errorCode, errorDescription) => {
        console.error("Window failed to load:", errorCode, errorDescription)
        if (isDev) {
          // In development, retry loading after a short delay
          console.log("Retrying to load development server...")
          setTimeout(() => {
            mainWindow?.loadURL("http://localhost:54321").catch((error) => {
              console.error("Failed to load dev server on retry:", error)
            })
          }, 1000)
        }
      }
    )

    if (isDev) {
      // In development, load from the dev server
      console.log("Loading from development server: http://localhost:54321")
      mainWindow.loadURL("http://localhost:54321").catch((error) => {
        console.error("Failed to load dev server, falling back to local file:", error)
        // Fallback to local file if dev server is not available
        const indexPath = path.join(__dirname, "../../dist/index.html")
        console.log("Falling back to:", indexPath)
        if (fs.existsSync(indexPath)) {
          mainWindow.loadFile(indexPath)
        } else {
          console.error("Could not find index.html in dist folder")
        }
      })
    } else {
      // In production, load from the built files
      const indexPath = path.join(__dirname, "../../dist/index.html")
      console.log("Loading production build:", indexPath)

      if (fs.existsSync(indexPath)) {
        mainWindow.loadFile(indexPath)
      } else {
        console.error("Could not find index.html in dist folder")
      }
    }

    // Configure window behavior
    mainWindow.webContents.setZoomFactor(1)
    if (isDev) {
      mainWindow.webContents.openDevTools()
    }
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      console.log("Attempting to open URL:", url)
      try {
        const parsedURL = new URL(url);
        const hostname = parsedURL.hostname;
        const allowedHosts = ["google.com", "supabase.co"];
        if (allowedHosts.includes(hostname) || hostname.endsWith(".google.com") || hostname.endsWith(".supabase.co")) {
          shell.openExternal(url);
          return { action: "deny" }; // Do not open this URL in a new Electron window
        }
      } catch (error) {
        console.error("Invalid URL %d in setWindowOpenHandler: %d" , url , error);
        return { action: "deny" }; // Deny access as URL string is malformed or invalid
      }
      return { action: "allow" };
    })

    // Enhanced screen capture resistance
    mainWindow.setContentProtection(true)

    mainWindow.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true
    })
    mainWindow.setAlwaysOnTop(true, "screen-saver", 1)

    // Additional screen capture resistance settings
    if (process.platform === "darwin") {
      // Prevent window from being captured in screenshots
      mainWindow.setHiddenInMissionControl(true)
      mainWindow.setWindowButtonVisibility(false)
      mainWindow.setBackgroundColor("#00000000")

      // Prevent window from being included in window switcher
      mainWindow.setSkipTaskbar(true)

      // Disable window shadow
      mainWindow.setHasShadow(false)
    }

    // Prevent the window from being captured by screen recording
    mainWindow.webContents.setBackgroundThrottling(false)
    mainWindow.webContents.setFrameRate(60)

    // Set up window listeners
    mainWindow.on("move", WindowManager.handleWindowMove)
    mainWindow.on("resize", WindowManager.handleWindowResize)
    mainWindow.on("closed", WindowManager.handleWindowClosed)

    // Initialize window state
    const bounds = mainWindow.getBounds()
    appState.setWindowPosition({ x: bounds.x, y: bounds.y })
    appState.setWindowSize({ width: bounds.width, height: bounds.height })
    appState.setCurrentX(bounds.x)
    appState.setCurrentY(bounds.y)
    appState.setIsWindowVisible(true)

    // Set opacity based on user preferences or hide initially
    const savedOpacity = configHelper.getOpacity();
    console.log(`Initial opacity from config: ${savedOpacity}`);

    // Always make sure window is shown first
    mainWindow.showInactive(); // Use showInactive for consistency

    if (savedOpacity <= 0.1) {
      console.log('Initial opacity too low, setting to 0 and hiding window');
      mainWindow.setOpacity(0);
      appState.setIsWindowVisible(false);
    } else {
      console.log(`Setting initial opacity to ${savedOpacity}`);
      mainWindow.setOpacity(savedOpacity);
      appState.setIsWindowVisible(true);
    }
  }

  static handleWindowMove(): void {
    if (!appState.mainWindow) return
    const bounds = appState.mainWindow.getBounds()
    appState.setWindowPosition({ x: bounds.x, y: bounds.y })
    appState.setCurrentX(bounds.x)
    appState.setCurrentY(bounds.y)
  }

  static handleWindowResize(): void {
    if (!appState.mainWindow) return
    const bounds = appState.mainWindow.getBounds()
    appState.setWindowSize({ width: bounds.width, height: bounds.height })
  }

  static handleWindowClosed(): void {
    appState.setMainWindow(null)
    appState.setIsWindowVisible(false)
    appState.setWindowPosition(null)
    appState.setWindowSize(null)
  }

  static isWindowValid(): boolean {
    return appState.mainWindow !== null && !appState.mainWindow.isDestroyed()
  }

  static hideMainWindow(): void {
    try {
      if (!WindowManager.isWindowValid()) return

      const window = appState.mainWindow!
      const bounds = window.getBounds();
      appState.setWindowPosition({ x: bounds.x, y: bounds.y });
      appState.setWindowSize({ width: bounds.width, height: bounds.height });
      window.setIgnoreMouseEvents(true, { forward: true });
      window.setOpacity(0);
      appState.setIsWindowVisible(false);
      console.log('Window hidden, opacity set to 0');
    } catch (error) {
      console.error('Error hiding main window:', error);
    }
  }

  static showMainWindow(): void {
    try {
      if (!WindowManager.isWindowValid()) return

      const window = appState.mainWindow!
      const position = appState.windowPosition
      const size = appState.windowSize

      if (position && size) {
        window.setBounds({
          ...position,
          ...size
        });
      }
      window.setIgnoreMouseEvents(false);
      window.setAlwaysOnTop(true, "screen-saver", 1);
      window.setVisibleOnAllWorkspaces(true, {
        visibleOnFullScreen: true
      });
      window.setContentProtection(true);
      window.setOpacity(0); // Set opacity to 0 before showing
      window.showInactive(); // Use showInactive instead of show+focus
      window.setOpacity(1); // Then set opacity to 1 after showing
      appState.setIsWindowVisible(true);
      console.log('Window shown with showInactive(), opacity set to 1');
    } catch (error) {
      console.error('Error showing main window:', error);
    }
  }

  static toggleMainWindow(): void {
    console.log(`Toggling window. Current state: ${appState.isWindowVisible ? 'visible' : 'hidden'}`);
    if (appState.isWindowVisible) {
      WindowManager.hideMainWindow();
    } else {
      WindowManager.showMainWindow();
    }
  }

  static moveWindowHorizontal(updateFn: (x: number) => number): void {
    if (!appState.mainWindow) return

    const newX = updateFn(appState.currentX)
    appState.setCurrentX(newX)
    appState.mainWindow.setPosition(
      Math.round(appState.currentX),
      Math.round(appState.currentY)
    )
  }

  static moveWindowVertical(updateFn: (y: number) => number): void {
    if (!appState.mainWindow) return

    const newY = updateFn(appState.currentY)
    appState.setCurrentY(newY)
    appState.mainWindow.setPosition(
      Math.round(appState.currentX),
      Math.round(appState.currentY)
    )
  }

  static centerWindow(): void {
    if (!appState.mainWindow) return

    const windowWidth = appState.windowSize?.width || 0
    const windowHeight = appState.windowSize?.height || 0

    // Calculate center position
    const centerX = Math.floor((appState.screenWidth - windowWidth) / 2)
    const centerY = Math.floor((appState.screenHeight - windowHeight) / 2)

    // Update state
    appState.setCurrentX(centerX)
    appState.setCurrentY(centerY)

    // Set position
    appState.mainWindow.setPosition(
      Math.round(centerX),
      Math.round(centerY)
    )

    // Make sure window is visible
    if (!appState.isWindowVisible) {
      WindowManager.toggleMainWindow()
    }

    console.log(`Window centered at (${centerX}, ${centerY})`)
  }

  static setWindowDimensions(width: number, height: number): void {
    try {
      if (!WindowManager.isWindowValid()) return

      // Validate input dimensions
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        console.warn('Invalid window dimensions:', { width, height })
        return
      }

      const window = appState.mainWindow!
      const [currentX, currentY] = window.getPosition()
      const primaryDisplay = screen.getPrimaryDisplay()
      const workArea = primaryDisplay.workAreaSize
      const maxWidth = Math.floor(workArea.width * 0.5)

      window.setBounds({
        x: Math.min(currentX, workArea.width - maxWidth),
        y: currentY,
        width: Math.min(Math.max(width + 32, 400), maxWidth),
        height: Math.max(Math.ceil(height), 300)
      })
    } catch (error) {
      console.error('Error setting window dimensions:', error)
    }
  }
}
