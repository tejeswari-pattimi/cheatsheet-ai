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

      // Parse lines and calculate original indentation BEFORE trimming
      const rawLines = clipboardText.split('\n')
      const linesWithIndent = rawLines.map(line => {
        const indent = line.length - line.trimStart().length
        const content = line.trimStart()
        return { indent, content }
      })

      console.log(`Processing ${linesWithIndent.length} lines from clipboard`)
      console.log('First 3 lines:', linesWithIndent.slice(0, 3).map(l => `indent:${l.indent} "${l.content}"`))
      this.isTyping = true
      this.shouldStopTyping = false

      // Register temporary stop shortcuts
      const stopShortcuts = [
        'Escape',
        'F3'
      ]

      stopShortcuts.forEach(key => {
        ShortcutsManager.register(key, () => {
          if (this.isTyping) {
            console.log(`Key ${key} pressed - stopping typing`)
            this.shouldStopTyping = true
          }
        })
      })

      // Delay to allow user to focus target window and position cursor
      await new Promise(resolve => setTimeout(resolve, 300))

      keyboard.config.autoDelayMs = this.typingSpeed

      // let previousIndent = 0 // Track indentation of previous line (not currently used)

      for (let lineIndex = 0; lineIndex < linesWithIndent.length; lineIndex++) {
        if (this.shouldStopTyping) {
          console.log(`Typing stopped at line ${lineIndex + 1}/${linesWithIndent.length}`)
          break
        }

        while (this.isPaused && !this.shouldStopTyping) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }

        if (this.shouldStopTyping) break

        const { indent: currentIndent, content } = linesWithIndent[lineIndex]

        // Type the line content (already trimmed)
        for (let charIndex = 0; charIndex < content.length; charIndex++) {
          if (this.shouldStopTyping) break

          while (this.isPaused && !this.shouldStopTyping) {
            await new Promise(resolve => setTimeout(resolve, 100))
          }

          if (!this.shouldStopTyping) {
            await keyboard.type(content[charIndex])
          }
        }

        // Press Enter to go to next line (except for last line)
        if (lineIndex < linesWithIndent.length - 1 && !this.shouldStopTyping) {
          // Wait a bit after typing the line content before pressing Enter
          await new Promise(resolve => setTimeout(resolve, 50))
          
          await keyboard.type(Key.Enter)
          
          // NOW check if next line needs less indentation and send backspaces
          const nextLineIndent = linesWithIndent[lineIndex + 1].indent
          if (nextLineIndent < currentIndent) {
            // IDE treats indentation as single units (e.g., 4 spaces = 1 tab stop)
            // Calculate how many indentation levels to go back
            const indentDiff = currentIndent - nextLineIndent
            const backspaceCount = Math.ceil(indentDiff / 4) // Assuming 4 spaces per indent level
            
            console.log(`Line ${lineIndex + 2}: Reducing indent from ${currentIndent} to ${nextLineIndent} (${indentDiff} spaces = ${backspaceCount} backspace)`)
            
            // Wait longer for IDE to auto-indent
            await new Promise(resolve => setTimeout(resolve, 100))
            
            console.log(`Sending ${backspaceCount} backspace(s)`)
            for (let i = 0; i < backspaceCount; i++) {
              if (this.shouldStopTyping) break
              await keyboard.type(Key.Backspace)
              await new Promise(resolve => setTimeout(resolve, 30))
            }
          }
        }
        
        // Update previous indent for next iteration (not currently used)
        // previousIndent = currentIndent
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
        'F3'
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
