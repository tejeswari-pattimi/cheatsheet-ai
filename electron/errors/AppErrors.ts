export class APIError extends Error {
  constructor(
    message: string,
    public provider: string,
    public statusCode?: number,
    public originalError?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export class ConfigError extends Error {
  constructor(message: string, public key?: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export class ScreenshotError extends Error {
  constructor(message: string, public path?: string) {
    super(message);
    this.name = 'ScreenshotError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
