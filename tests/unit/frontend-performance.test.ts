import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { frontendPerformance } from '../../src/utils/frontend-performance';

describe('frontendPerformance', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(performance, 'mark');
    vi.spyOn(performance, 'measure');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env.NODE_ENV = originalEnv;
  });

  it('should track performance in development mode', () => {
    process.env.NODE_ENV = 'development';
    
    frontendPerformance.start('test-operation');
    frontendPerformance.end('test-operation');

    expect(performance.mark).toHaveBeenCalledWith('test-operation-start');
    expect(performance.mark).toHaveBeenCalledWith('test-operation-end');
    expect(performance.measure).toHaveBeenCalled();
  });

  it('should not track in production mode', () => {
    process.env.NODE_ENV = 'production';
    
    frontendPerformance.start('test-operation');
    frontendPerformance.end('test-operation');

    expect(performance.mark).not.toHaveBeenCalled();
  });
});
