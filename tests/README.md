# Tests

This directory contains unit and e2e tests for CheatSheet AI.

## Running Tests

```bash
# Run all tests in watch mode
npm test

# Run tests once (for CI/pre-commit)
npm run test:run

# Run tests with UI
npm run test:ui

# Run e2e tests
npm run test:e2e
```

## Test Structure

- `tests/unit/` - Unit tests for individual modules
  - `ConfigHelper.test.ts` - Configuration management tests
  - `PerformanceMonitor.test.ts` - Performance tracking tests
  - `ScreenshotHelper.test.ts` - Screenshot queue management tests
  - `ProcessingHelper.test.ts` - AI processing logic tests
  - `frontend-performance.test.ts` - Frontend performance utilities tests

- `tests/e2e/` - End-to-end tests (Playwright)

- `tests/setup.ts` - Test environment setup

## Pre-commit Hook

Tests automatically run on each commit via Husky. If tests fail, the commit will be blocked.

To bypass (not recommended):
```bash
git commit --no-verify -m "your message"
```

## Writing Tests

Tests use Vitest and Testing Library. Example:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('MyModule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should do something', () => {
    expect(true).toBe(true);
  });
});
```
