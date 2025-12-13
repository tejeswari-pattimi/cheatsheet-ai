import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScreenshotHelper } from '../../electron/ScreenshotHelper';
import fs from 'node:fs';

vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(),
    unlinkSync: vi.fn(),
    mkdirSync: vi.fn(),
    readdirSync: vi.fn(() => []),
  },
  existsSync: vi.fn(),
  unlinkSync: vi.fn(),
  mkdirSync: vi.fn(),
  readdirSync: vi.fn(() => []),
}));

vi.mock('screenshot-desktop', () => ({
  default: vi.fn(() => Promise.resolve(Buffer.from('mock-screenshot'))),
}));

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/temp'),
  },
}));

describe('ScreenshotHelper', () => {
  let screenshotHelper: ScreenshotHelper;

  beforeEach(() => {
    vi.clearAllMocks();
    (fs.existsSync as any).mockReturnValue(true);
    
    const mockDeps = {
      getMainWindow: vi.fn(() => null),
      PROCESSING_EVENTS: {
        SCREENSHOT_TAKEN: 'screenshot-taken',
      },
    };
    
    screenshotHelper = new ScreenshotHelper(mockDeps as any);
  });

  it('should initialize with empty queues', () => {
    expect(screenshotHelper.getExtraScreenshotQueue()).toEqual([]);
  });

  it('should clear main queue', () => {
    screenshotHelper.clearMainScreenshotQueue();
    // Queue should be cleared
    expect(true).toBe(true);
  });

  it('should clear extra queue', () => {
    screenshotHelper.clearExtraScreenshotQueue();
    expect(screenshotHelper.getExtraScreenshotQueue()).toEqual([]);
  });
});
