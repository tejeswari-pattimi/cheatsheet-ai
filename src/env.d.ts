/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly NODE_ENV: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface ElectronAPI {
  openSubscriptionPortal: (authData: {
    id: string
    email: string
  }) => Promise<{ success: boolean; error?: string }>
  updateContentDimensions: (dimensions: {
    width: number
    height: number
  }) => Promise<void>
  clearStore: () => Promise<{ success: boolean; error?: string }>
  getScreenshots: () => Promise<Array<{ path: string; preview: string }>>
  deleteScreenshot: (
    path: string
  ) => Promise<{ success: boolean; error?: string }>
  onScreenshotTaken: (
    callback: (data: { path: string; preview: string }) => void
  ) => () => void
  onResetView: (callback: () => void) => () => void
  onSolutionStart: (callback: () => void) => () => void
  onDebugStart: (callback: () => void) => () => void
  onDebugSuccess: (callback: (data: any) => void) => () => void
  onSolutionError: (callback: (error: string) => void) => () => void
  onProcessingNoScreenshots: (callback: () => void) => () => void
  onProblemExtracted: (callback: (data: any) => void) => () => void
  onSolutionSuccess: (callback: (data: any) => void) => () => void
  onUnauthorized: (callback: () => void) => () => void
  onDebugError: (callback: (error: string) => void) => () => void
  openExternal: (url: string) => void
  toggleMainWindow: () => Promise<{ success: boolean; error?: string }>
  triggerScreenshot: () => Promise<{ success: boolean; error?: string }>
  triggerProcessScreenshots: () => Promise<{ success: boolean; error?: string }>
  triggerReset: () => Promise<{ success: boolean; error?: string }>
  triggerMoveLeft: () => Promise<{ success: boolean; error?: string }>
  triggerMoveRight: () => Promise<{ success: boolean; error?: string }>
  triggerMoveUp: () => Promise<{ success: boolean; error?: string }>
  triggerMoveDown: () => Promise<{ success: boolean; error?: string }>
  onSubscriptionUpdated: (callback: () => void) => () => void
  onSubscriptionPortalClosed: (callback: () => void) => () => void
  // Add update-related methods
  startUpdate: () => Promise<{ success: boolean; error?: string }>
  installUpdate: () => void
  onUpdateAvailable: (callback: (info: any) => void) => () => void
  onUpdateDownloaded: (callback: (info: any) => void) => () => void
  // Config methods
  getConfig: () => Promise<any>
  updateConfig: (updates: any) => Promise<any>
  checkApiKey: () => Promise<boolean>
  // Event listeners
  onShowSettings: (callback: () => void) => () => void
  onApiKeyInvalid: (callback: () => void) => () => void
  onModelChanged: (callback: (data: { model: string; provider: string }) => void) => () => void
  onModeChanged: (callback: (data: { mode: string; icon: string; description: string }) => void) => () => void
  onShowErrorNotification: (callback: (data: { title: string; message: string }) => void) => () => void
  onDeleteLastScreenshot: (callback: () => void) => () => void
  onCopyCodeToClipboard: (callback: () => void) => () => void
  onCopyHtmlToClipboard: (callback: () => void) => () => void
  onCopyCssToClipboard: (callback: () => void) => () => void
  // Other methods
  openSettingsPortal: () => Promise<{ success: boolean; error?: string }>
  openLink: (url: string) => Promise<{ success: boolean; error?: string }>
  storeProcessedClipboard: (text: string) => void
  getPlatform: () => string
  removeListener: (channel: string, callback: (...args: any[]) => void) => void
}

interface Window {
  electronAPI: ElectronAPI
  electron: {
    ipcRenderer: {
      on(channel: string, func: (...args: any[]) => void): void
      removeListener(channel: string, func: (...args: any[]) => void): void
    }
  }
  __CREDITS__: number
  __LANGUAGE__: string
  __IS_INITIALIZED__: boolean
  __AUTH_TOKEN__: string
}
