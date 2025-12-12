# CheatSheet AI Codebase Guide

This document provides a comprehensive overview of the CheatSheet AI application for LLMs and developers. It details the architecture, key components, data flow, and specific functionalities to render the codebase easily understandable.

## 1. High-Level Architecture

**Type**: Electron Application (Desktop)
**Stack**: 
- **Backend (Main Process)**: Electron, Node.js, TypeScript.
- **Frontend (Renderer Process)**: React, Vite, Tailwind CSS, TypeScript.
- **Database/Storage**: `electron-store` (local config), local filesystem (screenshots).
- **AI Integration**: Direct API calls to OpenAI, Gemini, Anthropic (via `ProcessingHelper`).

**Core Concept**: An "invisible", overlay-based tool that captures screen content, processes it via OCR/Vision LLMs, and presents solutions to the user. Key emphasis is on stealth (hiding from screen recorders) and speed (global shortcuts).

---

## 2. Directory Structure & Key Files

### Root
- `package.json`: Dependencies and scripts (build, start, package).
- `stealth-run.sh/bat`: Scripts to launch the app in stealth mode.

### `electron/` (Main Process)
Handles OS-level interactions, window management, screenshotting, and heavy processing.

| File | Purpose |
|------|---------|
| `main.ts` | **Entry Point**. Configures the Electron window (opacity, always-on-top, ignore-mouse), handles lifecycle events, and manages global state (`state` object). |
| `ProcessingHelper.ts` | **The Brain**. Handles interaction with LLMs (Gemini, Groq). Contains prompts, retry logic, and parses AI responses for MCQs/Code. |
| `ScreenshotHelper.ts` | Wraps `screenshot-desktop`. Manages screenshot queues (`mainQueue` for questions, `extraQueue` for debug). Handles saving/deleting images. |
| `shortcuts.ts` | Registers global keyboard shortcuts (e.g., `Ctrl+H` capture, `Ctrl+Enter` process) using `electron-localshortcut` or similar. |
| `ipcHandlers.ts` | Defines `ipcMain` handlers for communication with the Renderer process. |
| `ConfigHelper.ts` | Manages persistent user configuration (API keys, preferred models). |
| `OCRHelper.ts` | (Likely) legacy or helper for specific text extraction, though `ProcessingHelper` often sends raw images to Vision models. |

### `src/` (Renderer Process)
The UI presented to the user.

| File/Directory | Purpose |
|----------------|---------|
| `App.tsx` | Main routing/layout logic. Listens for initial IPC events. |
| `_pages/Queue.tsx` | View showing captured screenshots waiting to be processed. |
| `_pages/Solutions.tsx` | View displaying the AI-generated solution. |
| `_pages/Debug.tsx` | Chat-like interface for refining answers or debugging errors (sending more screenshots). |
| `components/` | UI components. `Settings/` contains the config dialog. `WelcomeScreen.tsx` is the onboarding. |
| `lib/`, `utils/` | Shared utilities. |

---

## 3. Key Workflows

### A. The Capture & Process Loop
1.  **Capture**: User presses Global Shortcut (e.g., `Ctrl+H`).
    *   `shortcuts.ts` triggers `takeScreenshot`.
    *   `ScreenshotHelper.ts` captures screen, saves to temp, adds path to `state.screenshotHelper.queue`.
    *   **IPC**: Sends `screenshot-taken` to Renderer to update `Queue.tsx`.
2.  **Process**: User presses `Ctrl+Enter`.
    *   `shortcuts.ts` triggers `state.processingHelper.processScreenshots()`.
    *   `ProcessingHelper.ts` reads images from queue.
    *   **Prompting**: Constructs a system prompt (MCQ, Python, Web Dev rules) + Images.
    *   **API Call**: Sends to configured LLM (Groq for fast MCQs, Gemini/OpenAI for complex).
    *   **Response**: Parses text response.
    *   **IPC**: Sends `solution-success` event with data to Renderer.
    *   **UI Update**: Renderer switches view to `Solutions.tsx`.

### B. Stealth & Window Management
*   **Overlay Mode**: The window is often `transparent: true`, `frame: false`, `alwaysOnTop: true`.
*   **Invisibility**: Uses `setContentProtection(true)` and specific flags (`hiddenInMissionControl`) to try and hide from screen sharing/recording tools.
*   **Interaction**: Users can toggle visibility (`Ctrl+B`) or change opacity (`Ctrl+[`/`]`).
*   **Mouse Events**: window can `setIgnoreMouseEvents` to let clicks pass through when "hidden".

### C. Debugging/Refinement
1.  If the solution is wrong, user takes *more* screenshots (e.g., of error messages).
2.  These go into the `extraScreenshotQueue`.
3.  User triggers process again (while in `Solutions` view).
4.  `ProcessingHelper` detects `view === 'solutions'` + extra screenshots -> runs `processDebugging`.
5.  Prompt includes: `Previous Response` + `New Screenshots` + "Fix this".

---

## 4. State Management (Global)

The `electron/main.ts` file maintains a global `state` object that acts as the single source of truth for the background process:

```typescript
const state = {
  mainWindow: BrowserWindow | null,
  view: "queue" | "solutions" | "debug", // Current UI state
  screenshotHelper: ScreenshotHelper, // Manages queues
  processingHelper: ProcessingHelper, // Manages AI calls
  // ... window position, size, etc.
}
```

The Renderer stays in sync via IPC events (`processing-status`, `reset-view`, `solution-success`).

## 5. Developer Guide for LLMs

If you are an AI assistant asked to modify this codebase, observe these rules:

1.  **Context separation**: `electron/` is Node.js environment. `src/` is Browser environment. You cannot import Electron modules directly in React components (use `window.electron` bridge if it existed, or `ipcRenderer` via preload). *Note: This project seems to use a secure preload script or direct IPC depending on build config.*
2.  **Shortcuts**: If adding a new feature that needs a trigger, add it to `electron/shortcuts.ts` and update `README.md`.
3.  **Prompts**: Logic for *how* the AI answers questions is in `electron/ProcessingHelper.ts`. Modify the `systemPrompt` variable there to change behavior.
4.  **Config**: New settings (e.g., new API provider) need updates in:
    *   `electron/ConfigHelper.ts` (backend storage).
    *   `src/components/Settings/SettingsDialog.tsx` (frontend UI).
    *   `electron/ProcessingHelper.ts` (API implementation).

## 6. Common Tasks

*   **Change Default Model**: Edit `electron/ProcessingHelper.ts` (look for `gemini-2.0-flash` or similar constants).
*   **Fix "Window not showing"**: Check `state.expectingWindowVisible` or opacity logic in `main.ts`.
*   **Add new Shortcut**: Add to `shortcuts.ts` -> `registerGlobalShortcuts`.

