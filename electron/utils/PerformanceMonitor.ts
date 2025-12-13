import { app } from 'electron';

export class PerformanceMonitor {
  private timers: Map<string, number> = new Map();
  private metrics: Map<string, number[]> = new Map();
  private isDev: boolean;

  constructor() {
    this.isDev = !app.isPackaged || process.env.NODE_ENV === 'development';
  }

  public startTimer(label: string): void {
    if (!this.isDev) return;
    this.timers.set(label, performance.now());
  }

  public endTimer(label: string): number {
    if (!this.isDev) return 0;

    const startTime = this.timers.get(label);
    if (startTime === undefined) {
      console.warn(`PerformanceMonitor: Timer '${label}' ended but never started.`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.timers.delete(label);

    this.recordMetric(label, duration);
    this.logMetric(label, duration);

    return duration;
  }

  private recordMetric(label: string, duration: number): void {
    if (!this.metrics.has(label)) {
      this.metrics.set(label, []);
    }
    this.metrics.get(label)?.push(duration);
  }

  private logMetric(label: string, duration: number): void {
    console.log(`[PERF] ${label}: ${duration.toFixed(2)}ms`);
  }

  public getAverageMetric(label: string): number {
    const values = this.metrics.get(label);
    if (!values || values.length === 0) return 0;

    const sum = values.reduce((a, b) => a + b, 0);
    return sum / values.length;
  }

  public logSummary(): void {
    if (!this.isDev) return;

    console.log('--- Performance Summary ---');
    for (const [label, values] of this.metrics.entries()) {
      const avg = this.getAverageMetric(label);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const count = values.length;
      console.log(`${label}: Avg=${avg.toFixed(2)}ms, Min=${min.toFixed(2)}ms, Max=${max.toFixed(2)}ms, Count=${count}`);
    }
    console.log('---------------------------');
  }
}

export const performanceMonitor = new PerformanceMonitor();
