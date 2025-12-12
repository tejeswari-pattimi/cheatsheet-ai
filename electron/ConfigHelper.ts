// ConfigHelper.ts
import fs from "node:fs"
import path from "node:path"
import { app } from "electron"
import { EventEmitter } from "events"
import { API, WINDOW, PATHS } from "./constants/app-constants"
import { SecureConfigHelper } from "./SecureConfigHelper"

interface Config {
  groqApiKey: string;
  geminiApiKey: string;
  mode: "mcq" | "general";  // MCQ mode (Groq) or General mode (Gemini)
  groqModel: string;
  geminiModel: string;
  language: string;
  opacity: number;
}

export class ConfigHelper extends EventEmitter {
  private configPath: string;
  private defaultConfig: Config = {
    groqApiKey: "",
    geminiApiKey: "",
    mode: "mcq", // Default to MCQ mode (Groq)
    groqModel: API.DEFAULT_GROQ_MODEL,
    geminiModel: API.DEFAULT_GEMINI_MODEL,
    language: API.DEFAULT_LANGUAGE,
    opacity: WINDOW.MAX_OPACITY
  };

  constructor() {
    super();
    // Use the app's user data directory to store the config
    try {
      this.configPath = path.join(app.getPath('userData'), PATHS.CONFIG_FILE);
      console.log('Config path:', this.configPath);
    } catch (err) {
      console.warn('Could not access user data path, using fallback');
      this.configPath = path.join(process.cwd(), PATHS.CONFIG_FILE);
    }
    
    // Ensure the initial config file exists
    this.ensureConfigExists();
  }

  /**
   * Ensure config file exists
   */
  private ensureConfigExists(): void {
    try {
      if (!fs.existsSync(this.configPath)) {
        this.saveConfig(this.defaultConfig);
      }
    } catch (err) {
      console.error("Error ensuring config exists:", err);
    }
  }

  /**
   * Validate and sanitize model selection to ensure only allowed models are used
   */
  private sanitizeGroqModel(model: string): string {
    const allowedModels = API.GROQ_MODELS as unknown as string[];
    if (!allowedModels.includes(model)) {
      console.warn(`Invalid Groq model specified: ${model}. Using default model: ${API.DEFAULT_GROQ_MODEL}`);
      return API.DEFAULT_GROQ_MODEL;
    }
    return model;
  }

  private sanitizeGeminiModel(model: string): string {
    const allowedModels = API.GEMINI_MODELS as unknown as string[];
    if (!allowedModels.includes(model)) {
      console.warn(`Invalid Gemini model specified: ${model}. Using default model: ${API.DEFAULT_GEMINI_MODEL}`);
      return API.DEFAULT_GEMINI_MODEL;
    }
    return model;
  }

  public loadConfig(): Config {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf8');
        
        // Handle empty file
        if (!configData || configData.trim() === '') {
          console.warn('Config file is empty, using defaults');
          this.saveConfig(this.defaultConfig);
          return { ...this.defaultConfig };
        }
        
        let config: any;
        try {
          config = JSON.parse(configData);
        } catch (parseError) {
          console.error('Error parsing config JSON:', parseError);
          // Backup corrupted file and create new one
          try {
            const backupPath = this.configPath + '.backup';
            fs.writeFileSync(backupPath, configData);
            console.log('Backed up corrupted config to:', backupPath);
          } catch (backupErr) {
            console.error('Error backing up config:', backupErr);
          }
          this.saveConfig(this.defaultConfig);
          return { ...this.defaultConfig };
        }
        
        // Ensure mode is valid
        if (config.mode !== "mcq" && config.mode !== "general") {
          config.mode = "mcq"; // Default to MCQ mode
        }
        
        // Sanitize model selections
        if (config.groqModel) {
          config.groqModel = this.sanitizeGroqModel(config.groqModel);
        }
        if (config.geminiModel) {
          config.geminiModel = this.sanitizeGeminiModel(config.geminiModel);
        }

        // Decrypt keys
        if (config.groqApiKey) {
           config.groqApiKey = SecureConfigHelper.decrypt(config.groqApiKey);
        }
        if (config.geminiApiKey) {
           config.geminiApiKey = SecureConfigHelper.decrypt(config.geminiApiKey);
        }
        
        return {
          ...this.defaultConfig,
          ...config
        };
      }
      
      // If no config exists, create a default one
      this.saveConfig(this.defaultConfig);
      return { ...this.defaultConfig };
    } catch (err) {
      console.error("Error loading config:", err);
      return { ...this.defaultConfig };
    }
  }

  /**
   * Save configuration to disk
   */
  public saveConfig(config: Config): void {
    try {
      // Validate config object
      if (!config || typeof config !== 'object') {
        console.error('Invalid config object provided to saveConfig');
        return;
      }
      
      // Create a copy to encrypt sensitive data before saving
      const configToSave = { ...config };

      if (configToSave.groqApiKey) {
        configToSave.groqApiKey = SecureConfigHelper.encrypt(configToSave.groqApiKey);
      }
      if (configToSave.geminiApiKey) {
        configToSave.geminiApiKey = SecureConfigHelper.encrypt(configToSave.geminiApiKey);
      }

      // Ensure the directory exists
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      
      // Write the config file atomically (write to temp, then rename)
      const tempPath = this.configPath + '.tmp';
      const configString = JSON.stringify(configToSave, null, 2);
      
      fs.writeFileSync(tempPath, configString, 'utf8');
      
      // Rename temp file to actual config file (atomic on most systems)
      fs.renameSync(tempPath, this.configPath);
    } catch (err) {
      console.error("Error saving config:", err);
      
      // Fallback: try direct write if atomic write fails
      try {
        // Encrypt for fallback save too
        const configToSave = { ...config };
        if (configToSave.groqApiKey) {
          configToSave.groqApiKey = SecureConfigHelper.encrypt(configToSave.groqApiKey);
        }
        if (configToSave.geminiApiKey) {
          configToSave.geminiApiKey = SecureConfigHelper.encrypt(configToSave.geminiApiKey);
        }
        fs.writeFileSync(this.configPath, JSON.stringify(configToSave, null, 2), 'utf8');
      } catch (fallbackErr) {
        console.error('Fallback config save also failed:', fallbackErr);
      }
    }
  }

  /**
   * Update specific configuration values
   */
  public updateConfig(updates: Partial<Config>): Config {
    try {
      if (!updates || typeof updates !== 'object') {
        console.error('Invalid updates provided to updateConfig');
        return this.loadConfig();
      }
      
      const currentConfig = this.loadConfig();
      
      // Sanitize model selections in the updates
      if (updates.groqModel) {
        updates.groqModel = this.sanitizeGroqModel(updates.groqModel);
      }
      if (updates.geminiModel) {
        updates.geminiModel = this.sanitizeGeminiModel(updates.geminiModel);
      }
      
      const newConfig = { ...currentConfig, ...updates };
      this.saveConfig(newConfig);
      
      // Emit update event for API key or model changes
      if (updates.groqApiKey !== undefined || updates.geminiApiKey !== undefined || 
          updates.groqModel !== undefined || updates.geminiModel !== undefined || 
          updates.mode !== undefined || updates.language !== undefined) {
        try {
          this.emit('config-updated', newConfig);
        } catch (emitError) {
          console.error('Error emitting config-updated event:', emitError);
        }
      }
      
      return newConfig;
    } catch (error) {
      console.error('Error updating config:', error);
      return this.loadConfig();
    }
  }

  /**
   * Check if at least one API key is configured
   */
  public hasApiKey(): boolean {
    const config = this.loadConfig();
    const hasGroq = !!config.groqApiKey && config.groqApiKey.trim().length > 0;
    const hasGemini = !!config.geminiApiKey && config.geminiApiKey.trim().length > 0;
    return hasGroq || hasGemini;
  }

  /**
   * Check if the current mode has its required API key
   */
  public hasRequiredApiKey(): boolean {
    const config = this.loadConfig();
    if (config.mode === "mcq") {
      return !!config.groqApiKey && config.groqApiKey.trim().length > 0;
    } else {
      return !!config.geminiApiKey && config.geminiApiKey.trim().length > 0;
    }
  }
  
  /**
   * Validate Groq API key format
   */
  public isValidGroqApiKey(apiKey: string): boolean {
    return /^gsk_[a-zA-Z0-9]{32,}$/.test(apiKey.trim());
  }

  /**
   * Validate Gemini API key format
   */
  public isValidGeminiApiKey(apiKey: string): boolean {
    return apiKey.trim().length >= 20; // Gemini keys are typically longer
  }
  
  /**
   * Get the stored opacity value
   */
  public getOpacity(): number {
    try {
      const config = this.loadConfig();
      const opacity = config.opacity;
      // Ensure opacity is a valid number between 0.1 and 1.0
      if (typeof opacity === 'number' && !isNaN(opacity) && opacity >= WINDOW.MIN_OPACITY && opacity <= WINDOW.MAX_OPACITY) {
        return opacity;
      }
      return WINDOW.MAX_OPACITY;
    } catch (error) {
      console.error('Error getting opacity:', error);
      return WINDOW.MAX_OPACITY;
    }
  }

  /**
   * Set the window opacity value
   */
  public setOpacity(opacity: number): void {
    // Ensure opacity is between 0.1 and 1.0
    const validOpacity = Math.min(WINDOW.MAX_OPACITY, Math.max(WINDOW.MIN_OPACITY, opacity));
    this.updateConfig({ opacity: validOpacity });
  }  
  
  /**
   * Get the preferred programming language
   */
  public getLanguage(): string {
    const config = this.loadConfig();
    return config.language || "python";
  }

  /**
   * Set the preferred programming language
   */
  public setLanguage(language: string): void {
    this.updateConfig({ language });
  }
  
  /**
   * Get the processing mode (mcq or general)
   */
  public getMode(): "mcq" | "general" {
    const config = this.loadConfig();
    return config.mode || "mcq";
  }

  /**
   * Set the processing mode
   */
  public setMode(mode: "mcq" | "general"): void {
    this.updateConfig({ mode });
    console.log(`Processing mode set to: ${mode}`);
  }
  
  /**
   * Toggle between MCQ and General mode
   */
  public toggleMode(): "mcq" | "general" {
    const currentMode = this.getMode();
    const newMode = currentMode === "mcq" ? "general" : "mcq";
    this.setMode(newMode);
    return newMode;
  }
  

}

// Export a singleton instance
export const configHelper = new ConfigHelper();
