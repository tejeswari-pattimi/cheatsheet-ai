import { describe, it, expect, vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/user/data'),
  },
}));

vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(() => true),
    readFileSync: vi.fn(() => Buffer.from('mock-image')),
  },
}));

describe('ProcessingHelper', () => {
  it('should handle empty screenshot queue', async () => {
    const mockDeps = {
      getView: vi.fn(() => 'queue'),
      getScreenshotQueue: vi.fn(() => []),
      getExtraScreenshotQueue: vi.fn(() => []),
      setView: vi.fn(),
      getMainWindow: vi.fn(() => null),
      getScreenshotHelper: vi.fn(() => null),
      PROCESSING_EVENTS: {},
    };

    const { ProcessingHelper } = await import('../../electron/ProcessingHelper');
    const helper = new ProcessingHelper(mockDeps as any);
    
    const result = await helper.processScreenshots();
    expect(result.success).toBe(false);
    expect(result.error).toContain('No screenshots');
  }, 10000); // 10 second timeout for OCR initialization
});
