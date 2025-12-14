import { OpenAI } from "openai"
import { configHelper } from "../../ConfigHelper"
import { API } from "../../constants/app-constants"
import { AIProvider } from "./AIProvider.interface"

export class GroqProvider implements AIProvider {
  name = "Groq";
  private client: OpenAI | null = null;
  private isUsingFallback: boolean = false;
  private fallbackUntil: number = 0; // Timestamp when to switch back to Maverick

  private getClient(): OpenAI {
    if (this.client) return this.client;

    const config = configHelper.loadConfig();
    if (!config.groqApiKey) {
      throw new Error("Groq API key not configured");
    }

    this.client = new OpenAI({
      apiKey: config.groqApiKey,
      baseURL: "https://api.groq.com/openai/v1",
      timeout: API.TIMEOUT_MS,
      maxRetries: 0 // We handle retries manually in ProcessingHelper
    });

    console.log(`[Groq] Client initialized with ${API.TIMEOUT_MS}ms timeout`);

    return this.client;
  }

  /**
   * Get the appropriate model to use (Maverick or GPT-OSS fallback)
   */
  private getModelToUse(configModel: string): string {
    const now = Date.now();
    
    // Check if we should switch back to Maverick
    if (this.isUsingFallback && now >= this.fallbackUntil) {
      console.log('[Groq] Cooldown period ended, switching back to Maverick model');
      this.isUsingFallback = false;
      this.fallbackUntil = 0;
    }
    
    // If using fallback, return GPT-OSS text model
    if (this.isUsingFallback) {
      const remainingTime = Math.ceil((this.fallbackUntil - now) / 1000);
      console.log(`[Groq] Using GPT-OSS fallback model with OCR (${remainingTime}s remaining)`);
      return API.GROQ_MODELS.GPT_OSS_TEXT;
    }
    
    // Otherwise use configured model
    return configModel;
  }

  /**
   * Handle rate limit by switching to GPT-OSS fallback model with OCR
   * Groq uses sliding window rate limits (60s from first request), so we wait 40s to be safe
   */
  private handleRateLimit(): void {
    if (!this.isUsingFallback) {
      this.isUsingFallback = true;
      this.fallbackUntil = Date.now() + API.FALLBACK_COOLDOWN_MS;
      
      const cooldownSeconds = API.FALLBACK_COOLDOWN_MS / 1000;
      console.log(`[Groq] ⚠️ Rate limit detected! Switching to GPT-OSS + OCR for ${cooldownSeconds}s`);
      console.log(`[Groq] ⚠️ Using OCR text extraction with GPT-OSS-120B model`);
      console.log(`[Groq] ℹ️ Groq uses sliding window rate limits - waiting ${cooldownSeconds}s before retrying Maverick`);
    }
  }

  /**
   * Check if currently using fallback model
   */
  public isUsingFallbackModel(): boolean {
    return this.isUsingFallback;
  }

  async generateContent(prompt: string, images: string[], signal: AbortSignal, systemPrompt?: string, extractedText?: string): Promise<string> {
    const startTime = Date.now();
    const client = this.getClient();
    const config = configHelper.loadConfig();
    const configuredModel = config.groqModel || API.DEFAULT_GROQ_MODEL;
    const model = this.getModelToUse(configuredModel);

    console.log(`[Groq] Starting API call with model: ${model}`);

    // Use the provided system prompt directly (already optimized in ProcessingHelper)
    let systemMessage = systemPrompt || "You are an expert problem solver.";
    
    // Extra reinforcement for MCQ mode to prevent code blocks
    const mode = configHelper.getMode();
    if (mode === 'mcq') {
      systemMessage += `\n\n🚨 CRITICAL REMINDER: You are in MCQ MODE. DO NOT include any code blocks (no \`\`\`python, \`\`\`javascript, etc.). Only provide reasoning and final answer.`;
    }

    // Check if this is a text-only model (GPT-OSS)
    const isTextOnlyModel = model.includes('gpt-oss');

    if (isTextOnlyModel) {
      // Text-only model: use OCR text (must have extractedText)
      if (!extractedText) {
        throw new Error('GPT-OSS text-only model requires OCR extracted text');
      }
      
      try {
        const response = await client.chat.completions.create({
          model,
          messages: [
            { role: "system", content: systemMessage },
            { role: "user", content: `${prompt}\n\nExtracted text from image:\n${extractedText}` }
          ],
          max_tokens: 2000,
          temperature: 0.2
        }, { signal });

        const duration = Date.now() - startTime;
        console.log(`[Groq] API call completed in ${duration}ms (text-only mode)`);

        return response.choices[0].message.content || "";
      } catch (error: any) {
        const duration = Date.now() - startTime;
        
        // Handle rate limiting for text-only mode
        if (error.status === 429 || error.code === 'rate_limit_exceeded') {
          console.error(`[Groq] Rate limit hit after ${duration}ms on text-only model`);
          throw new Error('Groq API rate limit exceeded. Please wait a moment and try again.');
        }
        
        console.error(`[Groq] API error after ${duration}ms:`, error.message);
        throw error;
      }
    } else {
      // Vision model: use images
      const content: any[] = [
        { type: "text", text: prompt }
      ];

      // Add images as base64 data URLs (max 5 images per Groq API limit)
      const imageLimit = Math.min(images.length, 5);
      for (let i = 0; i < imageLimit; i++) {
        content.push({
          type: "image_url",
          image_url: {
            url: `data:image/jpeg;base64,${images[i]}`
          }
        });
      }

      console.log(`[Groq] Sending ${imageLimit} images to vision API`);
      
      try {
        const response = await client.chat.completions.create({
          model,
          messages: [
            { role: "system", content: systemMessage },
            { role: "user", content }
          ],
          max_tokens: 2000,
          temperature: 0.2
        }, { signal });

        const duration = Date.now() - startTime;
        console.log(`[Groq] API call completed in ${duration}ms (vision mode with ${imageLimit} images)`);

        return response.choices[0].message.content || "";
      } catch (error: any) {
        const duration = Date.now() - startTime;
        
        // Detect rate limiting - switch to GPT-OSS + OCR and retry
        if (error.status === 429 || error.code === 'rate_limit_exceeded') {
          console.error(`[Groq] Rate limit hit after ${duration}ms on model: ${model}`);
          
          // If we were using Maverick, switch to GPT-OSS + OCR and retry
          if (model === API.GROQ_MODELS.MAVERICK_VISION) {
            this.handleRateLimit();
            
            // Show error notification to user
            console.log('[Groq] ⚠️ Maverick rate-limited. Falling back to GPT-OSS + OCR...');
            
            // We need the screenshot paths, not base64. This is a limitation.
            // Throw an error and let ProcessingHelper handle it with OCR
            console.log('[Groq] Switching to OCR extraction mode...');
            throw new Error('RATE_LIMIT_USE_OCR_FALLBACK');
          } else {
            // Already using GPT-OSS, can't fallback further
            throw new Error('Groq API rate limit exceeded on fallback model. Please wait a moment.');
          }
        }
        
        // Detect timeout
        if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
          console.error(`[Groq] Request timed out after ${duration}ms`);
          throw new Error('Groq API request timed out. The service may be slow right now.');
        }
        
        console.error(`[Groq] API error after ${duration}ms:`, error.message);
        throw error;
      }
    }
  }

  async generateContentWithHistory(prompt: string, images: string[], history: any[], signal: AbortSignal, extractedText?: string): Promise<string> {
    const startTime = Date.now();
    const client = this.getClient();
    const config = configHelper.loadConfig();
    const configuredModel = config.groqModel || API.DEFAULT_GROQ_MODEL;
    const model = this.getModelToUse(configuredModel);

    console.log(`[Groq] Starting debug API call with model: ${model}, history length: ${history.length}`);

    const messages: any[] = [
      { role: "system", content: "You are an expert debugging assistant." }
    ];

    // Add history
    for (const item of history) {
      messages.push({
        role: item.role === 'model' ? 'assistant' : item.role,
        content: item.content
      });
    }

    // Check if this is a text-only model
    const isTextOnlyModel = model.includes('gpt-oss');

    if (isTextOnlyModel) {
      // Text-only model: use OCR text (must have extractedText)
      if (!extractedText) {
        throw new Error('GPT-OSS text-only model requires OCR extracted text');
      }
      
      messages.push({
        role: "user",
        content: `${prompt}\n\nExtracted text from image:\n${extractedText}`
      });
    } else {
      // Vision model: use images
      const content: any[] = [
        { type: "text", text: prompt }
      ];

      const imageLimit = Math.min(images.length, 5);
      for (let i = 0; i < imageLimit; i++) {
        content.push({
          type: "image_url",
          image_url: {
            url: `data:image/jpeg;base64,${images[i]}`
          }
        });
      }

      messages.push({
        role: "user",
        content
      });
    }

    try {
      const response = await client.chat.completions.create({
        model,
        messages,
        max_tokens: 2000,
        temperature: 0.2
      }, { signal });

      const duration = Date.now() - startTime;
      console.log(`[Groq] Debug API call completed in ${duration}ms`);

      return response.choices[0].message.content || "";
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      // Detect rate limiting - switch to GPT-OSS + OCR
      if (error.status === 429 || error.code === 'rate_limit_exceeded') {
        console.error(`[Groq] Rate limit hit after ${duration}ms on debug call`);
        
        // If we were using Maverick, switch to GPT-OSS + OCR
        if (model === API.GROQ_MODELS.MAVERICK_VISION) {
          this.handleRateLimit();
          console.log('[Groq] ⚠️ Maverick rate-limited in debug. Falling back to GPT-OSS + OCR...');
          
          // Throw special error to let ProcessingHelper handle OCR extraction
          throw new Error('RATE_LIMIT_USE_OCR_FALLBACK');
        } else {
          throw new Error('Groq API rate limit exceeded on fallback model. Please wait a moment.');
        }
      }
      
      console.error(`[Groq] Debug API error after ${duration}ms:`, error.message);
      throw error;
    }
  }
}
