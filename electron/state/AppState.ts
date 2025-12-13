import { BrowserWindow } from "electron"
import { ProcessingHelper } from "../ProcessingHelper"
import { ScreenshotHelper } from "../ScreenshotHelper"
import { ShortcutsHelper } from "../shortcuts"

// View types
export type ViewType = "queue" | "solutions" | "debug"

// Processing events
export const PROCESSING_EVENTS = {
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
  DEBUG_ERROR: "debug-error"
} as const

// Application State Interface
export interface IAppState {
  // Window management properties
  mainWindow: BrowserWindow | null
  isWindowVisible: boolean
  windowPosition: { x: number; y: number } | null
  windowSize: { width: number; height: number } | null
  screenWidth: number
  screenHeight: number
  step: number
  currentX: number
  currentY: number

  // Application helpers
  screenshotHelper: ScreenshotHelper | null
  shortcutsHelper: ShortcutsHelper | null
  processingHelper: ProcessingHelper | null

  // View and state management
  view: ViewType
  problemInfo: any
  hasDebugged: boolean
}

// Global state container
export class AppState {
  private state: IAppState = {
    mainWindow: null,
    isWindowVisible: false,
    windowPosition: null,
    windowSize: null,
    screenWidth: 0,
    screenHeight: 0,
    step: 0,
    currentX: 0,
    currentY: 0,
    screenshotHelper: null,
    shortcutsHelper: null,
    processingHelper: null,
    view: "queue",
    problemInfo: null,
    hasDebugged: false
  }

  // Getters
  get mainWindow() { return this.state.mainWindow }
  get isWindowVisible() { return this.state.isWindowVisible }
  get windowPosition() { return this.state.windowPosition }
  get windowSize() { return this.state.windowSize }
  get screenWidth() { return this.state.screenWidth }
  get screenHeight() { return this.state.screenHeight }
  get step() { return this.state.step }
  get currentX() { return this.state.currentX }
  get currentY() { return this.state.currentY }
  get screenshotHelper() { return this.state.screenshotHelper }
  get shortcutsHelper() { return this.state.shortcutsHelper }
  get processingHelper() { return this.state.processingHelper }
  get view() { return this.state.view }
  get problemInfo() { return this.state.problemInfo }
  get hasDebugged() { return this.state.hasDebugged }

  // Setters
  setMainWindow(window: BrowserWindow | null) { this.state.mainWindow = window }
  setIsWindowVisible(visible: boolean) { this.state.isWindowVisible = visible }
  setWindowPosition(pos: { x: number; y: number } | null) { this.state.windowPosition = pos }
  setWindowSize(size: { width: number; height: number } | null) { this.state.windowSize = size }
  setScreenWidth(width: number) { this.state.screenWidth = width }
  setScreenHeight(height: number) { this.state.screenHeight = height }
  setStep(step: number) { this.state.step = step }
  setCurrentX(x: number) { this.state.currentX = x }
  setCurrentY(y: number) { this.state.currentY = y }
  setScreenshotHelper(helper: ScreenshotHelper | null) { this.state.screenshotHelper = helper }
  setShortcutsHelper(helper: ShortcutsHelper | null) { this.state.shortcutsHelper = helper }
  setProcessingHelper(helper: ProcessingHelper | null) { this.state.processingHelper = helper }
  setView(view: ViewType) { this.state.view = view }
  setProblemInfo(info: any) { this.state.problemInfo = info }
  setHasDebugged(debugged: boolean) { this.state.hasDebugged = debugged }

  // Direct state access (careful with this)
  getRawState() { return this.state }
}

export const appState = new AppState()
