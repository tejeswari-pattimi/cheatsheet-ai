import { globalShortcut } from "electron"

export class ShortcutsManager {
  private static registeredShortcuts: Map<string, () => void> = new Map();

  static register(accelerator: string, callback: () => void): boolean {
    try {
      if (globalShortcut.isRegistered(accelerator)) {
        globalShortcut.unregister(accelerator)
      }
      const success = globalShortcut.register(accelerator, callback)
      if (success) {
        this.registeredShortcuts.set(accelerator, callback)
      }
      return success
    } catch (error) {
      console.error(`Failed to register shortcut ${accelerator}:`, error)
      return false
    }
  }

  static unregisterAll(): void {
    try {
      globalShortcut.unregisterAll()
      this.registeredShortcuts.clear()
    } catch (error) {
      console.error("Error unregistering shortcuts:", error)
    }
  }

  static unregister(accelerator: string): void {
    try {
      if (globalShortcut.isRegistered(accelerator)) {
        globalShortcut.unregister(accelerator)
        this.registeredShortcuts.delete(accelerator)
      }
    } catch (error) {
      console.error(`Error unregistering shortcut ${accelerator}:`, error)
    }
  }

  static isRegistered(accelerator: string): boolean {
    return globalShortcut.isRegistered(accelerator)
  }
}
