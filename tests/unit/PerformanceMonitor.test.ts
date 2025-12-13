import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PerformanceMonitor } from '../../electron/utils/PerformanceMonitor';

// Mock electron app
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
  },
}));

describe('PerformanceMonitor', () => {
  let perfMonitor: PerformanceMonitor;

  beforeEach(() => {
    perfMonitor = new PerformanceMonitor();
  });

  it('should track duration', async () => {
    perfMonitor.startTimer('test-op');
    await new Promise(resolve => setTimeout(resolve, 10));
    const duration = perfMonitor.endTimer('test-op');

    expect(duration).toBeGreaterThan(0);
  });

  it('should store metrics', () => {
    perfMonitor.startTimer('test-metric');
    perfMonitor.endTimer('test-metric');

    const avg = perfMonitor.getAverageMetric('test-metric');
    expect(avg).toBeGreaterThanOrEqual(0);
  });

  it('should handle missing start timer', () => {
    const duration = perfMonitor.endTimer('non-existent');
    expect(duration).toBe(0);
  });
});
