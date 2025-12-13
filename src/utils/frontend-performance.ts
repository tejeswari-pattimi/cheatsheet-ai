// src/utils/frontend-performance.ts

export const frontendPerformance = {
  start: (label: string) => {
    if (process.env.NODE_ENV === 'development') {
      performance.mark(`${label}-start`);
    }
  },

  end: (label: string) => {
    if (process.env.NODE_ENV === 'development') {
      performance.mark(`${label}-end`);
      const measure = performance.measure(label, `${label}-start`, `${label}-end`);
      console.log(`[FRONTEND PERF] ${label}: ${measure.duration.toFixed(2)}ms`);

      // Send to main process if needed (optional)
      // window.ipcRenderer?.invoke('log-perf', label, measure.duration);
    }
  }
};
