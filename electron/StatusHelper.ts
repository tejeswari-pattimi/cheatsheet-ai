// StatusHelper.ts - Check application status from remote server
import https from 'https';
import http from 'http';

interface AppStatus {
  enabled: boolean;
  mode: 'all' | 'maverick' | 'gpt';
  message: string;
}

export class StatusHelper {
  private static instance: StatusHelper;
  private status: AppStatus | null = null;
  private readonly STATUS_URL = 'https://raw.githubusercontent.com/pragnyanramtha/cheatsheet-ai/refs/heads/main/status.json';
  private readonly TIMEOUT_MS = 5000; // 5 second timeout

  private constructor() {}

  public static getInstance(): StatusHelper {
    if (!StatusHelper.instance) {
      StatusHelper.instance = new StatusHelper();
    }
    return StatusHelper.instance;
  }

  /**
   * Fetch status from remote server
   */
  public async fetchStatus(): Promise<AppStatus> {
    // Add timestamp to bust cache
    const cacheBuster = `?t=${Date.now()}`;
    const urlWithCacheBuster = this.STATUS_URL + cacheBuster;
    
    console.log('[Status] Fetching status from:', urlWithCacheBuster);
    
    return new Promise((resolve) => {
      const url = new URL(urlWithCacheBuster);
      const protocol = url.protocol === 'https:' ? https : http;

      const request = protocol.get(url, {
        timeout: this.TIMEOUT_MS,
        headers: {
          'User-Agent': 'CheatSheet-AI',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }, (response) => {
        console.log('[Status] Response status code:', response.statusCode);
        
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          console.log('[Status] Redirect to:', response.headers.location);
        }
        
        let data = '';

        response.on('data', (chunk) => {
          data += chunk;
        });

        response.on('end', () => {
          try {
            console.log('[Status] Raw response:', data);
            const status = JSON.parse(data) as AppStatus;
            
            // Validate status structure
            if (typeof status.enabled !== 'boolean' ||
                !['all', 'maverick', 'gpt'].includes(status.mode) ||
                typeof status.message !== 'string') {
              console.error('[Status] Invalid status format:', status);
              throw new Error('Invalid status format');
            }

            this.status = status;
            console.log('[Status] Successfully fetched status:', status);
            resolve(status);
          } catch (error) {
            console.error('[Status] Failed to parse status:', error);
            // Default to enabled if fetch fails
            const defaultStatus: AppStatus = {
              enabled: true,
              mode: 'all',
              message: ''
            };
            this.status = defaultStatus;
            console.log('[Status] Using default status (enabled)');
            resolve(defaultStatus);
          }
        });
      });

      request.on('error', (error) => {
        console.error('[Status] Failed to fetch status:', error);
        // Default to enabled if fetch fails
        const defaultStatus: AppStatus = {
          enabled: true,
          mode: 'all',
          message: ''
        };
        this.status = defaultStatus;
        console.log('[Status] Using default status due to error (enabled)');
        resolve(defaultStatus);
      });

      request.on('timeout', () => {
        request.destroy();
        console.error('[Status] Request timed out');
        // Default to enabled if fetch fails
        const defaultStatus: AppStatus = {
          enabled: true,
          mode: 'all',
          message: ''
        };
        this.status = defaultStatus;
        console.log('[Status] Using default status due to timeout (enabled)');
        resolve(defaultStatus);
      });
    });
  }

  /**
   * Get current status (cached)
   */
  public getStatus(): AppStatus | null {
    return this.status;
  }

  /**
   * Check if app is enabled
   */
  public isEnabled(): boolean {
    return this.status?.enabled ?? true;
  }

  /**
   * Get current mode
   */
  public getMode(): 'all' | 'maverick' | 'gpt' {
    return this.status?.mode ?? 'all';
  }

  /**
   * Get status message
   */
  public getMessage(): string {
    return this.status?.message ?? '';
  }

  /**
   * Check if maverick model is allowed
   */
  public isMaverickAllowed(): boolean {
    const mode = this.getMode();
    return mode === 'all' || mode === 'maverick';
  }

  /**
   * Check if GPT-OSS fallback is allowed
   */
  public isGptFallbackAllowed(): boolean {
    const mode = this.getMode();
    return mode === 'all' || mode === 'gpt';
  }

  /**
   * Check if OCR is required (GPT mode)
   */
  public isOcrRequired(): boolean {
    return this.getMode() === 'gpt';
  }
}

export const statusHelper = StatusHelper.getInstance();
