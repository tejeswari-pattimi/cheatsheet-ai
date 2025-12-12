import { BrowserWindow } from 'electron';
import { APIError, ConfigError, ScreenshotError } from './AppErrors';

export interface ErrorResult {
  success: boolean;
  error: string;
  code?: string;
  retryable?: boolean;
}

export class ErrorHandler {
  static handle(error: Error, context: string, window?: BrowserWindow): ErrorResult {
    console.error(`Error in ${context}:`, error);

    let message = error.message || 'An unexpected error occurred';
    let code = 'UNKNOWN_ERROR';
    let retryable = false;

    if (error instanceof APIError) {
      code = 'API_ERROR';
      message = `API Error (${error.provider}): ${error.message}`;
      retryable = error.statusCode === 503 || error.statusCode === 429;
    } else if (error instanceof ConfigError) {
      code = 'CONFIG_ERROR';
    } else if (error instanceof ScreenshotError) {
      code = 'SCREENSHOT_ERROR';
    }

    // Notify user via UI if window is provided
    if (window) {
      window.webContents.send('show-error-notification', {
        title: code.replace('_', ' '),
        message: message,
      });

      // Update status to failed
      window.webContents.send('processing-status', {
        message: message,
        progress: 0,
        error: true,
      });

      // Ensure UI is not stuck
      window.webContents.send('reset-view');
    }

    return {
      success: false,
      error: message,
      code,
      retryable,
    };
  }
}
