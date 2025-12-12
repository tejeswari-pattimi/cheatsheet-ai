# CheatSheet AI - Maintainability Improvement Plan

> **Current Maintainability Score: 6.5/10**  
> This document outlines actionable steps to improve code quality, reduce technical debt, and make the codebase more maintainable.

---

## 🔴 Critical Priority (Do First)

### 1. Add Testing Infrastructure
**Problem**: Zero test coverage makes refactoring risky and bugs hard to catch.

**Action Items**:
- [x] Install testing frameworks: `vitest`, `@testing-library/react`, `playwright`
- [x] Create `tests/` directory structure:
  ```
  tests/
    ├── unit/
    │   ├── ConfigHelper.test.ts
    │   ├── ProcessingHelper.test.ts
    │   └── ScreenshotHelper.test.ts
    ├── integration/
    │   └── ipc-handlers.test.ts
    └── e2e/
        └── screenshot-workflow.spec.ts
  ```
- [x] Add test scripts to `package.json`:
  ```json
  "test": "vitest",
  "test:ui": "vitest --ui",
  "test:e2e": "playwright test"
  ```
- [ ] Target: 60%+ code coverage for core logic

**Files to Test First**:
- `electron/ConfigHelper.ts` (easiest, pure functions)
- `electron/ProcessingHelper.ts` (critical business logic)
- `electron/ScreenshotHelper.ts` (file operations)

---

### 2. Secure API Key Storage
**Problem**: API keys stored in plain text in `config.json`.

**Action Items**:
- [x] Install `keytar` or use Electron's `safeStorage` API
- [x] Create `SecureConfigHelper` class:
  ```typescript
  import { safeStorage } from 'electron'
  
  class SecureConfigHelper {
    encryptApiKey(key: string): string {
      return safeStorage.encryptString(key).toString('base64')
    }
    
    decryptApiKey(encrypted: string): string {
      return safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
    }
  }
  ```
- [x] Migrate existing config.json to encrypted format
- [x] Update `ConfigHelper.ts` to use encryption
- [x] Add migration script for existing users

**Estimated Time**: 4-6 hours

---

### 3. Break Up Large Files
**Problem**: Files over 500 lines are hard to understand and modify.

#### 3.1 Split `electron/main.ts` (817 lines)
**Current Structure**: Window management + state + initialization + helpers

**New Structure**:
```
electron/
  ├── main.ts (entry point, ~150 lines)
  ├── window/
  │   ├── WindowManager.ts (create, show, hide, move)
  │   ├── WindowState.ts (position, size, opacity)
  │   └── WindowConfig.ts (settings, bounds)
  ├── state/
  │   ├── AppState.ts (global state management)
  │   └── StateManager.ts (getters/setters)
  └── initialization/
      └── AppInitializer.ts (setup, env, paths)
```

**Action Items**:
- [ ] Create `WindowManager` class
- [ ] Create `AppState` class with typed state
- [ ] Extract initialization logic to `AppInitializer`
- [ ] Update imports in dependent files
- [ ] Test window operations still work

**Estimated Time**: 8-12 hours

---

#### 3.2 Split `electron/ProcessingHelper.ts` (1,212 lines)
**Current Structure**: API calls + parsing + prompts + retry logic

**New Structure**:
```
electron/
  ├── processing/
  │   ├── ProcessingHelper.ts (orchestrator, ~200 lines)
  │   ├── ai-providers/
  │   │   ├── GeminiProvider.ts
  │   │   ├── GroqProvider.ts
  │   │   └── AIProvider.interface.ts
  │   ├── parsers/
  │   │   ├── MCQParser.ts
  │   │   ├── WebDevParser.ts
  │   │   ├── PythonParser.ts
  │   │   └── TextParser.ts
  │   ├── prompts/
  │   │   ├── system-prompts.json
  │   │   ├── mcq-prompt.txt
  │   │   └── webdev-prompt.txt
  │   └── retry/
  │       └── RetryStrategy.ts
```

**Action Items**:
- [ ] Create `AIProvider` interface
- [ ] Implement `GeminiProvider` and `GroqProvider`
- [ ] Extract parsers to separate classes
- [ ] Move prompts to external files
- [ ] Create `RetryStrategy` utility
- [ ] Update `ProcessingHelper` to use new structure

**Estimated Time**: 12-16 hours

---

#### 3.3 Split `electron/shortcuts.ts` (600+ lines)
**Current Structure**: All shortcuts + typing automation + opacity

**New Structure**:
```
electron/
  ├── shortcuts/
  │   ├── ShortcutsManager.ts (registration, ~150 lines)
  │   ├── handlers/
  │   │   ├── ScreenshotHandlers.ts
  │   │   ├── WindowHandlers.ts
  │   │   ├── ProcessingHandlers.ts
  │   │   └── TypingHandlers.ts
  │   └── typing/
  │       ├── ClipboardTyper.ts
  │       └── TypingConfig.ts
```

**Action Items**:
- [ ] Create handler classes for each category
- [ ] Extract typing automation to `ClipboardTyper`
- [ ] Create `ShortcutsManager` to coordinate
- [ ] Add shortcut configuration file
- [ ] Document all shortcuts in code

**Estimated Time**: 6-8 hours

---

## 🟡 High Priority (Do Next)

### 4. Standardize Error Handling
**Problem**: Inconsistent error patterns across codebase.

**Action Items**:
- [x] Create error types:
  ```typescript
  // errors/AppErrors.ts
  export class APIError extends Error {
    constructor(
      message: string,
      public provider: string,
      public statusCode?: number
    ) {
      super(message)
      this.name = 'APIError'
    }
  }
  
  export class ScreenshotError extends Error { /* ... */ }
  export class ConfigError extends Error { /* ... */ }
  ```
- [x] Create error handler utility:
  ```typescript
  // errors/ErrorHandler.ts
  export class ErrorHandler {
    static handle(error: Error, context: string): ErrorResult {
      // Log, notify user, return standardized result
    }
  }
  ```
- [x] Update all try-catch blocks to use standard errors
- [ ] Add error boundary in React components
- [ ] Create error reporting service (optional)

**Estimated Time**: 6-8 hours

---

### 5. Implement Proper State Management
**Problem**: Global `state` object in main.ts is hard to track and debug.

**Action Items**:
- [ ] Choose state management approach:
  - Option A: Event-driven (EventEmitter pattern)
  - Option B: Redux-like (for predictability)
  - Option C: MobX (for reactivity)
- [ ] Create state management layer:
  ```typescript
  // state/AppStateManager.ts
  export class AppStateManager extends EventEmitter {
    private state: AppState
    
    getState(): Readonly<AppState> { /* ... */ }
    setState(updates: Partial<AppState>): void { /* ... */ }
    subscribe(listener: StateListener): Unsubscribe { /* ... */ }
  }
  ```
- [ ] Replace direct state access with state manager
- [ ] Add state change logging (dev mode)
- [ ] Create state persistence layer

**Estimated Time**: 10-12 hours

---

### 6. Add IPC Type Safety
**Problem**: IPC messages use string channels with no type checking.

**Action Items**:
- [ ] Create IPC contract definitions:
  ```typescript
  // ipc/contracts.ts
  export interface IPCContract {
    'get-config': {
      request: void
      response: Config
    }
    'update-config': {
      request: Partial<Config>
      response: Config
    }
    'trigger-screenshot': {
      request: void
      response: { success: boolean; error?: string }
    }
    // ... all other IPC channels
  }
  ```
- [ ] Create typed IPC helpers:
  ```typescript
  // ipc/typed-ipc.ts
  export function typedIpcHandle<K extends keyof IPCContract>(
    channel: K,
    handler: (event: IpcMainInvokeEvent, data: IPCContract[K]['request']) 
      => Promise<IPCContract[K]['response']>
  ): void
  ```
- [ ] Replace all `ipcMain.handle` with typed version
- [ ] Update renderer IPC calls to use types
- [ ] Generate IPC documentation from types

**Estimated Time**: 8-10 hours

---

### 7. Extract Configuration Constants
**Problem**: Magic numbers and hardcoded values scattered throughout.

**Action Items**:
- [x] Create constants file:
  ```typescript
  // constants/app-constants.ts
  export const WINDOW = {
    MIN_WIDTH: 750,
    MIN_HEIGHT: 550,
    DEFAULT_WIDTH: 800,
    DEFAULT_HEIGHT: 600,
    HIDE_DELAY_WINDOWS: 500,
    HIDE_DELAY_OTHER: 300,
    MOVEMENT_STEP: 60,
  } as const
  
  export const SCREENSHOTS = {
    MAX_QUEUE_SIZE: 5,
    SUPPORTED_FORMATS: ['png', 'jpg'] as const,
  } as const
  
  export const API = {
    MAX_RETRIES: 3,
    TIMEOUT_MS: 120000,
    RETRY_DELAY_BASE: 1000,
  } as const
  ```
- [x] Replace all magic numbers with constants
- [ ] Add JSDoc comments explaining each constant
- [ ] Make constants configurable where appropriate

**Estimated Time**: 4-6 hours

---

## 🟢 Medium Priority (Improve Quality)

### 8. Refactor React Components
**Problem**: Large components with multiple responsibilities.

#### 8.1 Split `Solutions.tsx` (700+ lines)
**New Structure**:
```
src/
  ├── _pages/
  │   └── Solutions.tsx (~150 lines, orchestrator)
  └── components/
      ├── Solutions/
      │   ├── SolutionContent.tsx
      │   ├── SolutionCode.tsx
      │   ├── SolutionThoughts.tsx
      │   ├── MCQAnswer.tsx
      │   └── ScreenshotDebugQueue.tsx
      └── hooks/
          ├── useSolutionData.ts
          ├── useScreenshots.ts
          └── useClipboard.ts
```

**Action Items**:
- [ ] Extract custom hooks for data fetching
- [ ] Create presentational components
- [ ] Use React.memo for expensive renders
- [ ] Add PropTypes or TypeScript interfaces
- [ ] Reduce useEffect dependencies

**Estimated Time**: 8-10 hours

---

### 9. Improve Screenshot Management
**Problem**: Complex queue management with manual synchronization.

**Action Items**:
- [ ] Create screenshot storage abstraction:
  ```typescript
  // storage/ScreenshotStorage.interface.ts
  export interface IScreenshotStorage {
    save(buffer: Buffer, type: 'main' | 'extra'): Promise<string>
    get(path: string): Promise<Buffer>
    delete(path: string): Promise<void>
    list(type: 'main' | 'extra'): Promise<string[]>
    clear(type: 'main' | 'extra'): Promise<void>
  }
  ```
- [ ] Implement file system storage
- [ ] Add in-memory cache layer
- [ ] Create screenshot queue manager
- [ ] Add automatic cleanup on app exit
- [ ] Implement max storage size limit

**Estimated Time**: 6-8 hours

---

### 10. Platform Abstraction Layer
**Problem**: Platform-specific code mixed with business logic.

**Action Items**:
- [ ] Create platform interfaces:
  ```typescript
  // platform/IPlatformService.ts
  export interface IPlatformService {
    captureScreen(): Promise<Buffer>
    getAppDataPath(): string
    getTempPath(): string
    showNotification(title: string, body: string): void
  }
  ```
- [ ] Implement platform-specific services:
  ```
  platform/
    ├── WindowsPlatformService.ts
    ├── MacOSPlatformService.ts
    ├── LinuxPlatformService.ts
    └── PlatformServiceFactory.ts
  ```
- [ ] Replace platform checks with service calls
- [ ] Add platform-specific tests
- [ ] Document platform differences

**Estimated Time**: 10-12 hours

---

### 11. Extract Prompts to Configuration
**Problem**: 300+ line prompts embedded in code.

**Action Items**:
- [ ] Create prompts directory:
  ```
  prompts/
    ├── system/
    │   ├── base.txt
    │   ├── mcq.txt
    │   ├── python.txt
    │   └── webdev.txt
    ├── templates/
    │   └── debug.txt
    └── prompt-loader.ts
  ```
- [ ] Create prompt template system:
  ```typescript
  // prompts/PromptManager.ts
  export class PromptManager {
    loadPrompt(type: PromptType, variables?: Record<string, string>): string
    compileTemplate(template: string, vars: Record<string, string>): string
  }
  ```
- [ ] Support prompt versioning
- [ ] Add prompt testing utilities
- [ ] Allow user-customizable prompts (advanced)

**Estimated Time**: 6-8 hours

---

### 12. Add Performance Monitoring
**Problem**: No visibility into performance bottlenecks.

**Action Items**:
- [ ] Add performance markers:
  ```typescript
  // utils/performance.ts
  export class PerformanceMonitor {
    startTimer(label: string): void
    endTimer(label: string): number
    logMetrics(): void
  }
  ```
- [ ] Monitor key operations:
  - Screenshot capture time
  - API response time
  - File I/O operations
  - React render time
- [ ] Add performance dashboard (dev mode)
- [ ] Set performance budgets
- [ ] Create performance regression tests

**Estimated Time**: 6-8 hours

---

## 🔵 Low Priority (Nice to Have)

### 13. Implement Caching Strategy
**Action Items**:
- [ ] Add LRU cache for screenshot previews
- [ ] Cache API responses (with TTL)
- [ ] Implement request deduplication
- [ ] Add cache invalidation strategy
- [ ] Monitor cache hit rates

**Estimated Time**: 4-6 hours

---

### 14. Add Logging Infrastructure
**Action Items**:
- [ ] Install `winston` or `pino`
- [ ] Create log levels (debug, info, warn, error)
- [ ] Add structured logging
- [ ] Implement log rotation
- [ ] Add log viewer in dev tools

**Estimated Time**: 4-6 hours

---

### 15. Improve Build Process
**Action Items**:
- [ ] Add pre-commit hooks (husky + lint-staged)
- [ ] Set up CI/CD pipeline (GitHub Actions)
- [ ] Add automated testing in CI
- [ ] Implement semantic versioning
- [ ] Add changelog generation
- [ ] Create release automation

**Estimated Time**: 6-8 hours

---

### 16. Documentation Improvements
**Action Items**:
- [ ] Add JSDoc comments to all public APIs
- [ ] Generate API documentation (TypeDoc)
- [ ] Create architecture diagrams
- [ ] Add troubleshooting guide
- [ ] Document common development tasks
- [ ] Create contribution guidelines

**Estimated Time**: 8-10 hours

---

### 17. Code Quality Tools
**Action Items**:
- [ ] Configure ESLint with stricter rules
- [ ] Add Prettier for consistent formatting
- [ ] Set up SonarQube or similar
- [ ] Add complexity metrics (plato)
- [ ] Create code review checklist
- [ ] Add automated code review (Danger.js)

**Estimated Time**: 4-6 hours

---

## 📊 Implementation Roadmap

### Phase 1: Foundation (2-3 weeks)
**Goal**: Make codebase safe to refactor
- ✅ Add testing infrastructure
- ✅ Secure API key storage
- ✅ Standardize error handling
- ✅ Extract configuration constants

**Success Metrics**:
- 60%+ test coverage
- Zero plain-text API keys
- All errors use standard types
- No magic numbers in code

---

### Phase 2: Architecture (3-4 weeks)
**Goal**: Improve code organization
- ✅ Break up large files
- ✅ Implement state management
- ✅ Add IPC type safety
- ✅ Create platform abstraction

**Success Metrics**:
- No files over 400 lines
- State changes are traceable
- Type-safe IPC communication
- Platform code isolated

---

### Phase 3: Quality (2-3 weeks)
**Goal**: Enhance developer experience
- ✅ Refactor React components
- ✅ Improve screenshot management
- ✅ Extract prompts to config
- ✅ Add performance monitoring

**Success Metrics**:
- Components under 200 lines
- Screenshot operations < 100ms
- Prompts externalized
- Performance metrics tracked

---

### Phase 4: Polish (1-2 weeks)
**Goal**: Production-ready quality
- ✅ Implement caching
- ✅ Add logging infrastructure
- ✅ Improve build process
- ✅ Complete documentation

**Success Metrics**:
- Cache hit rate > 80%
- Structured logs everywhere
- CI/CD pipeline working
- Full API documentation

---

## 🎯 Quick Wins (Do Anytime)

These can be done independently without blocking other work:

1. **Add TypeScript strict mode** (2 hours)
   - Enable `strict: true` in tsconfig.json
   - Fix type errors incrementally

2. **Extract magic strings** (2 hours)
   - Create `constants/events.ts` for event names
   - Replace all string literals

3. **Add input validation** (3 hours)
   - Use `zod` or `yup` for runtime validation
   - Validate all user inputs and API responses

4. **Improve error messages** (2 hours)
   - Make errors user-friendly
   - Add actionable suggestions

5. **Add keyboard shortcut help** (3 hours)
   - Create in-app shortcut reference
   - Add tooltips for all actions

6. **Optimize bundle size** (4 hours)
   - Analyze with `webpack-bundle-analyzer`
   - Remove unused dependencies
   - Implement code splitting

---

## 📈 Measuring Success

### Code Quality Metrics
- **Maintainability Index**: Target > 70
- **Cyclomatic Complexity**: Target < 10 per function
- **Test Coverage**: Target > 80%
- **Type Coverage**: Target > 95%
- **Bundle Size**: Target < 50MB

### Developer Experience Metrics
- **Build Time**: Target < 30s
- **Test Execution**: Target < 10s
- **Hot Reload**: Target < 2s
- **Time to First Contribution**: Target < 1 hour

### Code Health Indicators
- ✅ No files over 400 lines
- ✅ No functions over 50 lines
- ✅ No duplicate code blocks
- ✅ All TODOs have tickets
- ✅ All public APIs documented

---

## 🛠️ Tools & Dependencies to Add

### Testing
```bash
npm install -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom
npm install -D playwright @playwright/test
npm install -D msw # Mock Service Worker for API mocking
```

### Code Quality
```bash
npm install -D eslint-plugin-sonarjs
npm install -D eslint-plugin-import
npm install -D prettier eslint-config-prettier
npm install -D husky lint-staged
```

### Type Safety
```bash
npm install zod # Runtime validation
npm install type-fest # Advanced TypeScript utilities
```

### Logging & Monitoring
```bash
npm install winston # Logging
npm install pino pino-pretty # Alternative logging
```

### Documentation
```bash
npm install -D typedoc # API documentation
npm install -D jsdoc-to-markdown # Markdown docs
```

---

## 💡 Best Practices to Adopt

### 1. Code Organization
- **One responsibility per file**
- **Max 400 lines per file**
- **Max 50 lines per function**
- **Group related files in folders**

### 2. Naming Conventions
- **Classes**: PascalCase (`WindowManager`)
- **Functions**: camelCase (`captureScreen`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRIES`)
- **Files**: kebab-case (`window-manager.ts`)
- **Interfaces**: Prefix with `I` (`IScreenshotStorage`)

### 3. Error Handling
- **Always catch errors**
- **Use typed errors**
- **Log with context**
- **Provide user-friendly messages**
- **Never swallow errors silently**

### 4. Testing
- **Test public APIs**
- **Mock external dependencies**
- **Test error cases**
- **Keep tests simple**
- **One assertion per test (when possible)**

### 5. Documentation
- **JSDoc for all public APIs**
- **README for each major module**
- **Inline comments for complex logic**
- **Architecture diagrams for system design**
- **Changelog for all releases**

---

## 🚀 Getting Started

### For New Contributors
1. Read `CODEBASE_GUIDE.md`
2. Set up development environment
3. Run existing tests (once added)
4. Pick a "Quick Win" task
5. Submit PR with tests

### For Maintainers
1. Review this document
2. Prioritize based on team capacity
3. Create GitHub issues for each task
4. Assign to milestones
5. Track progress weekly

---

## 📝 Notes

- **Estimated Total Time**: 120-160 hours (3-4 months part-time)
- **Team Size**: 1-2 developers
- **Risk Level**: Medium (requires careful refactoring)
- **Impact**: High (significantly improves maintainability)

**Remember**: Don't try to do everything at once. Pick one phase, complete it, then move to the next. Incremental improvements are better than a massive rewrite.

---

## 🤝 Contributing

If you're working on any of these improvements:
1. Create a GitHub issue first
2. Reference this document
3. Break large tasks into smaller PRs
4. Add tests for all changes
5. Update documentation

---

**Last Updated**: December 2025  
**Maintainability Score Goal**: 8.5/10  
**Target Completion**: Q2 2026
