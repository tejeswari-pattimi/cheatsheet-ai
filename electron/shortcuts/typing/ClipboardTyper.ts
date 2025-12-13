import { keyboard, Key } from "@nut-tree-fork/nut-js"
import { clipboard } from "electron"
import { ShortcutsManager } from "../ShortcutsManager"

export class ClipboardTyper {
  private isTyping: boolean = false
  private shouldStopTyping: boolean = false
  private isPaused: boolean = false
  private typingSpeed: number = 75 // Default speed in ms
  private processedClipboard: string = ""
  private keypressListener: any = null
  private onNotification: (title: string, message: string, type?: string) => void

  constructor(onNotification: (title: string, message: string, type?: string) => void) {
    this.onNotification = onNotification
  }

  public setProcessedClipboard(text: string): void {
    this.processedClipboard = text
    console.log(`Stored ${text.length} characters in processed clipboard`)
  }

  public adjustTypingSpeed(delta: number): void {
    this.typingSpeed = Math.max(10, Math.min(500, this.typingSpeed + delta))
    keyboard.config.autoDelayMs = this.typingSpeed
    console.log(`Typing speed adjusted to ${this.typingSpeed}ms (${delta > 0 ? 'slower' : 'faster'})`)

    const speedLabel = this.typingSpeed <= 30 ? 'Very Fast' :
                      this.typingSpeed <= 60 ? 'Fast' :
                      this.typingSpeed <= 100 ? 'Normal' :
                      this.typingSpeed <= 200 ? 'Slow' : 'Very Slow'

    this.onNotification("Typing Speed", `${speedLabel} (${this.typingSpeed}ms)`, "info")
  }

  public togglePause(): void {
    if (!this.isTyping) {
      console.log("Not currently typing, cannot pause")
      return
    }

    this.isPaused = !this.isPaused
    console.log(`Typing ${this.isPaused ? 'paused' : 'resumed'}`)

    this.onNotification(
      this.isPaused ? "Typing Paused" : "Typing Resumed",
      this.isPaused ? "Press Alt+Backspace to resume" : "Typing continues...",
      "info"
    )
  }

  public async typeClipboardContent(): Promise<void> {
    console.log("Ctrl+Shift+V pressed. Typing out clipboard content...")

    if (this.isTyping) {
      console.log("Already typing, ignoring request")
      return
    }

    try {
      let clipboardText = this.processedClipboard || clipboard.readText()

      if (!clipboardText) {
        console.log("Clipboard is empty")
        return
      }

      console.log(`Using ${this.processedClipboard ? 'processed' : 'regular'} clipboard`)

      const lines = this.processedClipboard
        ? clipboardText.split('\n')
        : clipboardText.split('\n').map(line => line.trimStart())

      console.log(`Processing ${lines.length} lines from clipboard`)
      this.isTyping = true
      this.shouldStopTyping = false

      // Register temporary stop shortcuts
      const stopShortcuts = [
        'Escape',
        'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'
      ]

      stopShortcuts.forEach(key => {
        ShortcutsManager.register(key, () => {
          if (this.isTyping) {
            console.log(`Key ${key} pressed - stopping typing`)
            this.shouldStopTyping = true
          }
        })
      })

      // Small delay to allow user to focus target window
      await new Promise(resolve => setTimeout(resolve, 500))

      keyboard.config.autoDelayMs = this.typingSpeed

      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        if (this.shouldStopTyping) {
          console.log(`Typing stopped at line ${lineIndex + 1}/${lines.length}`)
          break
        }

        while (this.isPaused && !this.shouldStopTyping) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }

        if (this.shouldStopTyping) break

        const line = lines[lineIndex]

        for (let charIndex = 0; charIndex < line.length; charIndex++) {
          if (this.shouldStopTyping) break

          while (this.isPaused && !this.shouldStopTyping) {
            await new Promise(resolve => setTimeout(resolve, 100))
          }

          if (!this.shouldStopTyping) {
            await keyboard.type(line[charIndex])
          }
        }

        if (lineIndex < lines.length - 1 && !this.shouldStopTyping) {
          await keyboard.type(Key.Enter)
        }
      }

      if (!this.shouldStopTyping) {
        console.log('Successfully typed clipboard content')
      }

    } catch (error) {
      console.error("Error in typing handler:", error)
    } finally {
      this.isTyping = false
      this.shouldStopTyping = false
      this.isPaused = false

      // Unregister temp shortcuts
      const stopShortcuts = [
        'Escape',
        'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'
      ]

      stopShortcuts.forEach(key => {
        ShortcutsManager.unregister(key)
      })

      keyboard.config.autoDelayMs = 100
    }
  }

  public stopTyping(): void {
    console.log("Stopping typing...")
    if (this.isTyping) {
      this.shouldStopTyping = true
      console.log("Typing will stop after current character")
    } else {
      console.log("No typing in progress")
    }
  }
}
