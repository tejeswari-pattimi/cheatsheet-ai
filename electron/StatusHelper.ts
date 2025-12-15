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
  // Primary URL - JSONBin for instant updates (no caching)
  // Fallback to GitHub if primary fails
  private readonly PRIMARY_STATUS_URL = process.env.STATUS_URL || 'https://api.jsonbin.io/v3/b/69403696d0ea881f402b41e6/latest';
  private readonly FALLBACK_STATUS_URL = 'https://raw.githubusercontent.com/pragnyanramtha/cheatsheet-ai/refs/heads/main/status.json';
  private readonly TIMEOUT_MS = 5000; // 5 second timeout

  private constructor() {}

  public static getInstance(): StatusHelper {
    if (!StatusHelper.instance) {
      StatusHelper.instance = new StatusHelper();
    }
    return StatusHelper.instance;
  }

  /**
   * Fetch status from a URL
   */
  private async fetchFromUrl(url: string): Promise<AppStatus> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const protocol = urlObj.protocol === 'https:' ? https : http;

      const request = protocol.get(urlObj, {
        timeout: this.TIMEOUT_MS,
        headers: {
          'User-Agent': 'CheatSheet-AI',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }, (response) => {
        console.log('[Status] Response status code:', response.statusCode);
        
        let data = '';

        response.on('data', (chunk) => {
          data += chunk;
        });

        response.on('end', () => {
          try {
            console.log('[Status] Raw response:', data);
            
            // Handle JSONBin response format (has 'record' wrapper)
            let parsed = JSON.parse(data);
            const status = parsed.record || parsed; // JSONBin wraps in 'record', GitHub doesn't
            
            // Validate status structure
            if (typeof status.enabled !== 'boolean' ||
                !['all', 'maverick', 'gpt'].includes(status.mode) ||
                typeof status.message !== 'string') {
              console.error('[Status] Invalid status format:', status);
              throw new Error('Invalid status format');
            }

            console.log('[Status] Successfully fetched status:', status);
            resolve(status as AppStatus);
          } catch (error) {
            console.error('[Status] Failed to parse status:', error);
            reject(error);
          }
        });
      });

      request.on('error', (error) => {
        console.error('[Status] Request failed:', error);
        reject(error);
      });

      request.on('timeout', () => {
        request.destroy();
        console.error('[Status] Request timed out');
        reject(new Error('Timeout'));
      });
    });
  }

  /**
   * Fetch status from remote server with fallback
   */
  public async fetchStatus(): Promise<AppStatus> {
    // Add timestamp to bust cache
    const cacheBuster = `?t=${Date.now()}`;
    
    // Try primary URL first
    try {
      console.log('[Status] Fetching from primary URL:', this.PRIMARY_STATUS_URL);
      const status = await this.fetchFromUrl(this.PRIMARY_STATUS_URL + cacheBuster);
      this.status = status;
      return status;
    } catch (primaryError) {
      console.warn('[Status] Primary URL failed, trying fallback:', primaryError);
      
      // Try fallback URL
      try {
        console.log('[Status] Fetching from fallback URL:', this.FALLBACK_STATUS_URL);
        const status = await this.fetchFromUrl(this.FALLBACK_STATUS_URL + cacheBuster);
        this.status = status;
        return status;
      } catch (fallbackError) {
        console.error('[Status] Both URLs failed, using default (enabled)');
        
        // Default to enabled if all fetches fail
        const defaultStatus: AppStatus = {
          enabled: true,
          mode: 'all',
          message: ''
        };
        this.status = defaultStatus;
        return defaultStatus;
      }
    }
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
