import { globalShortcut, app, clipboard } from "electron"
import { IShortcutsHelperDeps } from "./main"
import { configHelper } from "./ConfigHelper"
import { keyboard, Key } from "@nut-tree-fork/nut-js"

// Helper to safely register global shortcuts
function safeRegister(accelerator: string, callback: () => void): boolean {
  try {
    if (globalShortcut.isRegistered(accelerator)) {
      globalShortcut.unregister(accelerator)
    }
    return globalShortcut.register(accelerator, callback)
  } catch (error) {
    console.error(`Failed to register shortcut ${accelerator}:`, error)
    return false
  }
}

export class ShortcutsHelper {
  private deps: IShortcutsHelperDeps
  private isTyping: boolean = false
  private shouldStopTyping: boolean = false
  private isPaused: boolean = false
  private typingSpeed: number = 75 // Default speed in ms
  private keypressListener: any = null
  private processedClipboard: string = "" // Store processed clipboard for Ctrl+Shift+V

  constructor(deps: IShortcutsHelperDeps) {
    this.deps = deps
  }

  private adjustTypingSpeed(delta: number): void {
    this.typingSpeed = Math.max(10, Math.min(500, this.typingSpeed + delta))
    keyboard.config.autoDelayMs = this.typingSpeed
    console.log(`Typing speed adjusted to ${this.typingSpeed}ms (${delta > 0 ? 'slower' : 'faster'})`)
    
    // Show notification to user
    const mainWindow = this.deps.getMainWindow()
    if (mainWindow) {
      const speedLabel = this.typingSpeed <= 30 ? 'Very Fast' : 
                        this.typingSpeed <= 60 ? 'Fast' : 
                        this.typingSpeed <= 100 ? 'Normal' : 
                        this.typingSpeed <= 200 ? 'Slow' : 'Very Slow'
      mainWindow.webContents.send("show-notification", {
        title: "Typing Speed",
        message: `${speedLabel} (${this.typingSpeed}ms)`,
        type: "info"
      })
    }
  }

  private togglePause(): void {
    if (!this.isTyping) {
      console.log("Not currently typing, cannot pause")
      return
    }
    
    this.isPaused = !this.isPaused
    console.log(`Typing ${this.isPaused ? 'paused' : 'resumed'}`)
    
    // Show notification to user
    const mainWindow = this.deps.getMainWindow()
    if (mainWindow) {
      mainWindow.webContents.send("show-notification", {
        title: this.isPaused ? "Typing Paused" : "Typing Resumed",
        message: this.isPaused ? "Press Alt+Backspace to resume" : "Typing continues...",
        type: "info"
      })
    }
  }

  private setupKeypressListener(): void {
    // Set up a listener that stops typing on any keypress
    if (this.keypressListener) {
      return // Already set up
    }

    // Use nut-js keyboard events if available, otherwise use a timer-based approach
    const checkInterval = setInterval(() => {
      if (!this.isTyping) {
        // Clean up if not typing
        if (this.keypressListener) {
          clearInterval(this.keypressListener)
          this.keypressListener = null
        }
      }
    }, 100)

    this.keypressListener = checkInterval
  }

  private stopTypingOnKeypress(): void {
    if (this.isTyping) {
      console.log("Keypress detected - stopping typing")
      this.shouldStopTyping = true
    }
  }

  // Public method to store processed clipboard from renderer
  public setProcessedClipboard(text: string): void {
    this.processedClipboard = text
    console.log(`Stored ${text.length} characters in processed clipboard`)
  }

  private adjustOpacity(delta: number): void {
    try {
      const mainWindow = this.deps.getMainWindow();
      if (!mainWindow || mainWindow.isDestroyed()) return;

      let currentOpacity = mainWindow.getOpacity();
      if (typeof currentOpacity !== 'number' || isNaN(currentOpacity)) {
        currentOpacity = 1.0;
      }
      
      let newOpacity = Math.max(0.1, Math.min(1.0, currentOpacity + delta));
      console.log(`Adjusting opacity from ${currentOpacity} to ${newOpacity}`);

      mainWindow.setOpacity(newOpacity);

      // Save the opacity setting to config without re-initializing the client
      try {
        const config = configHelper.loadConfig();
        config.opacity = newOpacity;
        configHelper.saveConfig(config);
      } catch (error) {
        console.error('Error saving opacity to config:', error);
      }

      // If we're making the window visible, also make sure it's shown and interaction is enabled
      if (newOpacity > 0.1 && !this.deps.isVisible()) {
        this.deps.toggleMainWindow();
      }
    } catch (error) {
      console.error('Error adjusting opacity:', error);
    }
  }

  public registerGlobalShortcuts(): void {
    safeRegister("CommandOrControl+H", async () => {
      try {
        const mainWindow = this.deps.getMainWindow()
        if (mainWindow && !mainWindow.isDestroyed()) {
          console.log("Taking screenshot...")
          const screenshotPath = await this.deps.takeScreenshot()
          if (screenshotPath) {
            const preview = await this.deps.getImagePreview(screenshotPath)
            mainWindow.webContents.send("screenshot-taken", {
              path: screenshotPath,
              preview
            })
          }
        }
      } catch (error) {
        console.error("Error capturing screenshot:", error)
      }
    })

    // Alias for Ctrl+H - Ctrl+M to take screenshot
    safeRegister("CommandOrControl+M", async () => {
      try {
        const mainWindow = this.deps.getMainWindow()
        if (mainWindow && !mainWindow.isDestroyed()) {
          console.log("Taking screenshot (alias for Ctrl+H)...")
          const screenshotPath = await this.deps.takeScreenshot()
          if (screenshotPath) {
            const preview = await this.deps.getImagePreview(screenshotPath)
            mainWindow.webContents.send("screenshot-taken", {
              path: screenshotPath,
              preview
            })
          }
        }
      } catch (error) {
        console.error("Error capturing screenshot:", error)
      }
    })

    safeRegister("CommandOrControl+Enter", async () => {
      console.log("Ctrl+Enter pressed - Processing screenshots...")
      try {
        const result = await this.deps.processingHelper?.processScreenshots()
        if (result) {
          console.log("Processing result:", result.success ? "SUCCESS" : `FAILED: ${result.error}`)
        }
      } catch (error) {
        console.error("Unexpected error in Ctrl+Enter handler:", error)
      }
    })

    // Quick Answer function - Reset, Capture, and Process in one go
    const quickAnswer = async () => {
      console.log("Quick Answer triggered: Reset → Capture → Process")
      const mainWindow = this.deps.getMainWindow()

      try {
        // Step 1: Reset (like Ctrl+R)
        console.log("Step 1: Resetting queues...")
        this.deps.processingHelper?.cancelOngoingRequests()
        this.deps.clearQueues()
        this.deps.setView("queue")

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("reset-view")
          mainWindow.webContents.send("reset")
        }

        // Small delay to ensure reset completes
        await new Promise(resolve => setTimeout(resolve, 100))

        // Step 2: Capture screenshot (like Ctrl+H)
        console.log("Step 2: Capturing screenshot...")
        if (mainWindow && !mainWindow.isDestroyed()) {
          const screenshotPath = await this.deps.takeScreenshot()
          if (screenshotPath) {
            const preview = await this.deps.getImagePreview(screenshotPath)
            mainWindow.webContents.send("screenshot-taken", {
              path: screenshotPath,
              preview
            })

            // Small delay to ensure screenshot is added to queue
            await new Promise(resolve => setTimeout(resolve, 200))

            // Step 3: Process (like Ctrl+Enter)
            console.log("Step 3: Processing screenshot...")
            const result = await this.deps.processingHelper?.processScreenshots()
            if (result) {
              console.log("Quick Answer result:", result.success ? "SUCCESS" : `FAILED: ${result.error}`)
            }
          }
        }
      } catch (error) {
        console.error("Error in Quick Answer:", error)
      }
    }

    // Quick Answer shortcut - Ctrl+D
    safeRegister("CommandOrControl+D", quickAnswer)

    safeRegister("CommandOrControl+R", () => {
      try {
        console.log(
          "Command + R pressed. Canceling requests and resetting queues..."
        )

        // Cancel ongoing API requests
        this.deps.processingHelper?.cancelOngoingRequests()

        // Clear both screenshot queues
        this.deps.clearQueues()

        console.log("Cleared queues.")

        // Update the view state to 'queue'
        this.deps.setView("queue")

        // Notify renderer process to switch view to 'queue'
        const mainWindow = this.deps.getMainWindow()
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("reset-view")
          mainWindow.webContents.send("reset")
        }
      } catch (error) {
        console.error("Error in reset handler:", error)
      }
    })

    // New shortcuts for moving the window
    safeRegister("CommandOrControl+Left", () => {
      try {
        console.log("Command/Ctrl + Left pressed. Moving window left.")
        this.deps.moveWindowLeft()
      } catch (error) {
        console.error("Error moving window left:", error)
      }
    })

    safeRegister("CommandOrControl+Right", () => {
      try {
        console.log("Command/Ctrl + Right pressed. Moving window right.")
        this.deps.moveWindowRight()
      } catch (error) {
        console.error("Error moving window right:", error)
      }
    })

    safeRegister("CommandOrControl+Down", () => {
      try {
        console.log("Command/Ctrl + down pressed. Moving window down.")
        this.deps.moveWindowDown()
      } catch (error) {
        console.error("Error moving window down:", error)
      }
    })

    safeRegister("CommandOrControl+Up", () => {
      try {
        console.log("Command/Ctrl + Up pressed. Moving window Up.")
        this.deps.moveWindowUp()
      } catch (error) {
        console.error("Error moving window up:", error)
      }
    })

    // Center window shortcut - Ctrl+N
    safeRegister("CommandOrControl+N", () => {
      try {
        console.log("Command/Ctrl + N pressed. Centering window and making it visible.")
        this.deps.centerWindow()
      } catch (error) {
        console.error("Error centering window:", error)
      }
    })

    safeRegister("CommandOrControl+B", () => {
      try {
        console.log("Command/Ctrl + B pressed. Toggling window visibility.")
        this.deps.toggleMainWindow()
      } catch (error) {
        console.error("Error toggling window:", error)
      }
    })

    // Alias for Ctrl+B - Alt+1 to toggle visibility
    safeRegister("Alt+1", () => {
      try {
        console.log("Alt+1 pressed. Toggling window visibility (alias for Ctrl+B).")
        this.deps.toggleMainWindow()
      } catch (error) {
        console.error("Error toggling window:", error)
      }
    })

    // Alias for Ctrl+B - Ctrl+I to toggle visibility
    safeRegister("CommandOrControl+I", () => {
      try {
        console.log("Command/Ctrl + I pressed. Toggling window visibility (alias for Ctrl+B).")
        this.deps.toggleMainWindow()
      } catch (error) {
        console.error("Error toggling window:", error)
      }
    })

    safeRegister("CommandOrControl+Q", () => {
      console.log("Command/Ctrl + Q pressed. Quitting application.")
      app.quit()
    })

    // Adjust opacity shortcuts
    safeRegister("CommandOrControl+[", () => {
      console.log("Command/Ctrl + [ pressed. Decreasing opacity.")
      this.adjustOpacity(-0.1)
    })

    safeRegister("CommandOrControl+]", () => {
      console.log("Command/Ctrl + ] pressed. Increasing opacity.")
      this.adjustOpacity(0.1)
    })

    // Zoom controls
    safeRegister("CommandOrControl+-", () => {
      try {
        console.log("Command/Ctrl + - pressed. Zooming out.")
        const mainWindow = this.deps.getMainWindow()
        if (mainWindow && !mainWindow.isDestroyed()) {
          const currentZoom = mainWindow.webContents.getZoomLevel()
          mainWindow.webContents.setZoomLevel(currentZoom - 0.5)
        }
      } catch (error) {
        console.error("Error zooming out:", error)
      }
    })

    safeRegister("CommandOrControl+0", () => {
      try {
        console.log("Command/Ctrl + 0 pressed. Resetting zoom.")
        const mainWindow = this.deps.getMainWindow()
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.setZoomLevel(0)
        }
      } catch (error) {
        console.error("Error resetting zoom:", error)
      }
    })

    safeRegister("CommandOrControl+=", () => {
      try {
        console.log("Command/Ctrl + = pressed. Zooming in.")
        const mainWindow = this.deps.getMainWindow()
        if (mainWindow && !mainWindow.isDestroyed()) {
          const currentZoom = mainWindow.webContents.getZoomLevel()
          mainWindow.webContents.setZoomLevel(currentZoom + 0.5)
        }
      } catch (error) {
        console.error("Error zooming in:", error)
      }
    })

    // Model cycling function - cycles models based on current mode
    const cycleModels = () => {
      console.log("Cycling through models based on current mode.")
      try {
        const config = configHelper.loadConfig()
        const mode = config.mode

        if (mode === "mcq") {
          // Cycle through Groq models
          const groqModels = ["llama-3.3-70b-versatile", "meta-llama/llama-4-maverick-17b-128e-instruct", "openai/gpt-oss-120b"]
          const currentIndex = groqModels.indexOf(config.groqModel)
          const nextIndex = (currentIndex + 1) % groqModels.length
          const newModel = groqModels[nextIndex]
          
          configHelper.updateConfig({ groqModel: newModel })
          console.log(`Switched Groq model to: ${newModel}`)

          // Notify the renderer process
          const mainWindow = this.deps.getMainWindow()
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("model-changed", { model: newModel, mode: "mcq" })
          }
        } else {
          // Cycle through Gemini models
          const geminiModels = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.5-flash-lite"]
          const currentIndex = geminiModels.indexOf(config.geminiModel)
          const nextIndex = (currentIndex + 1) % geminiModels.length
          const newModel = geminiModels[nextIndex]
          
          configHelper.updateConfig({ geminiModel: newModel })
          console.log(`Switched Gemini model to: ${newModel}`)

          // Notify the renderer process
          const mainWindow = this.deps.getMainWindow()
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("model-changed", { model: newModel, mode: "general" })
          }
        }
      } catch (error) {
        console.error("Error cycling models:", error)
      }
    }

    // Ctrl+\ to cycle through models in the same family
    safeRegister("CommandOrControl+\\", cycleModels)

    // Alt+2 alias for cycling models
    safeRegister("Alt+2", cycleModels)

    // Ctrl+/ to toggle between MCQ and General mode
    safeRegister("CommandOrControl+/", () => {
      console.log("Ctrl+/ pressed. Toggling processing mode...")
      try {
        const newMode = configHelper.toggleMode()
        const modeIcon = newMode === "mcq" ? "⚡" : "🎯"
        const modeDescription = newMode === "mcq" 
          ? "MCQ Mode - Ultra-fast with Groq" 
          : "General Mode - All questions with Gemini"
        
        console.log(`${modeIcon} Switched to ${newMode.toUpperCase()} MODE - ${modeDescription}`)

        // Notify the renderer process about the mode change
        const mainWindow = this.deps.getMainWindow()
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("mode-changed", { 
            mode: newMode,
            icon: modeIcon,
            description: modeDescription
          })
        }
      } catch (error) {
        console.error("Error toggling mode:", error)
      }
    })

    // Copy HTML to clipboard shortcut (for web dev questions)
    safeRegister("CommandOrControl+Shift+C", () => {
      console.log("Command/Ctrl + Shift + C pressed. Copying HTML to clipboard.")
      const mainWindow = this.deps.getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        // Send an event to the renderer to copy HTML
        mainWindow.webContents.send("copy-html-to-clipboard")
      }
    })

    // Copy CSS to clipboard shortcut (for web dev questions)
    safeRegister("CommandOrControl+Shift+D", () => {
      console.log("Command/Ctrl + Shift + D pressed. Copying CSS to clipboard.")
      const mainWindow = this.deps.getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        // Send an event to the renderer to copy CSS
        mainWindow.webContents.send("copy-css-to-clipboard")
      }
    })

    // Delete last screenshot shortcut
    safeRegister("CommandOrControl+Backspace", () => {
      console.log("Command/Ctrl + Backspace pressed. Deleting last screenshot.")
      const mainWindow = this.deps.getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        // Send an event to the renderer to delete the last screenshot
        mainWindow.webContents.send("delete-last-screenshot")
      }
    })



    // Ctrl+Shift+V: Type clipboard content line by line with NO indentation
    safeRegister("CommandOrControl+Shift+V", async () => {
      console.log("Ctrl+Shift+V pressed. Typing out clipboard content...")

      if (this.isTyping) {
        console.log("Already typing, ignoring request")
        return
      }

      try {
        // Use processed clipboard if available, otherwise fall back to regular clipboard
        let clipboardText = this.processedClipboard || clipboard.readText()

        if (!clipboardText) {
          console.log("Clipboard is empty")
          return
        }

        console.log(`Using ${this.processedClipboard ? 'processed' : 'regular'} clipboard`)

        // Split into lines (already processed if from Ctrl+Shift+C, otherwise process now)
        const lines = this.processedClipboard 
          ? clipboardText.split('\n')  // Already processed
          : clipboardText.split('\n').map(line => line.trimStart())  // Process now
        
        console.log(`Processing ${lines.length} lines from clipboard`)
        this.isTyping = true
        this.shouldStopTyping = false

        // Register ONLY special key shortcuts (not letters/numbers to avoid conflicts)
        const stopShortcuts = [
          'Escape',
          'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'
        ]

        // Register stop shortcuts
        stopShortcuts.forEach(key => {
          try {
            safeRegister(key, () => {
              if (this.isTyping) {
                console.log(`Key ${key} pressed - stopping typing`)
                this.shouldStopTyping = true
              }
            })
          } catch (err) {
            // Some keys might already be registered, ignore
          }
        })

        // Small delay to allow user to focus the target window
        await new Promise(resolve => setTimeout(resolve, 500))

        // Configure keyboard with current typing speed
        keyboard.config.autoDelayMs = this.typingSpeed

        // Type line by line
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
          // Check if should stop
          if (this.shouldStopTyping) {
            console.log(`Typing stopped at line ${lineIndex + 1}/${lines.length}`)
            break
          }
          
          // Check if paused
          while (this.isPaused && !this.shouldStopTyping) {
            await new Promise(resolve => setTimeout(resolve, 100))
          }
          
          if (this.shouldStopTyping) break
          
          const line = lines[lineIndex]
          
          // Type each character in the line (with NO leading spaces)
          for (let charIndex = 0; charIndex < line.length; charIndex++) {
            if (this.shouldStopTyping) break
            
            // Check if paused
            while (this.isPaused && !this.shouldStopTyping) {
              await new Promise(resolve => setTimeout(resolve, 100))
            }
            
            if (!this.shouldStopTyping) {
              await keyboard.type(line[charIndex])
            }
          }
          
          // Press Enter after each line (except the last line)
          if (lineIndex < lines.length - 1 && !this.shouldStopTyping) {
            await keyboard.type(Key.Enter)
          }
        }

        if (!this.shouldStopTyping) {
          console.log('Successfully typed clipboard content')
        }

      } catch (error) {
        console.error("Error in Ctrl+Shift+V handler:", error)
      } finally {
        this.isTyping = false
        this.shouldStopTyping = false
        this.isPaused = false
        
        // Unregister all temporary stop shortcuts
        const stopShortcuts = [
          'Escape',
          'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'
        ]
        
        stopShortcuts.forEach(key => {
          try {
            if (globalShortcut.isRegistered(key)) {
              globalShortcut.unregister(key)
            }
          } catch (err) {
            // Ignore errors
          }
        })
        
        // Reset to default speed
        keyboard.config.autoDelayMs = 100
      }
    })

    // Ctrl+Shift+X: Stop typing
    safeRegister("CommandOrControl+Shift+X", () => {
      console.log("Ctrl+Shift+X pressed. Stopping typing...")
      if (this.isTyping) {
        this.shouldStopTyping = true
        console.log("Typing will stop after current character")
      } else {
        console.log("No typing in progress")
      }
    })

    // Alt+Backspace: Pause/Resume typing
    safeRegister("Alt+Backspace", () => {
      console.log("Alt+Backspace pressed. Toggling pause...")
      this.togglePause()
    })

    // Alt+=: Increase typing speed (faster)
    safeRegister("Alt+=", () => {
      console.log("Alt+= pressed. Increasing typing speed (faster)...")
      this.adjustTypingSpeed(-15) // Decrease delay = faster
    })

    // Alt+-: Decrease typing speed (slower)
    safeRegister("Alt+-", () => {
      console.log("Alt+- pressed. Decreasing typing speed (slower)...")
      this.adjustTypingSpeed(15) // Increase delay = slower
    })

    // Unregister shortcuts when quitting
    app.on("will-quit", () => {
      try {
        globalShortcut.unregisterAll()
      } catch (error) {
        console.error("Error unregistering shortcuts on quit:", error)
      }
    })
  }
}
