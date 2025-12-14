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
   * Get the appropriate model to use (Maverick or Scout fallback)
   */
  private getModelToUse(configModel: string): string {
    const now = Date.now();
    
    // Check if we should switch back to Maverick
    if (this.isUsingFallback && now >= this.fallbackUntil) {
      console.log('[Groq] Cooldown period ended, switching back to Maverick model');
      this.isUsingFallback = false;
      this.fallbackUntil = 0;
    }
    
    // If using fallback, return Scout model
    if (this.isUsingFallback) {
      const remainingTime = Math.ceil((this.fallbackUntil - now) / 1000);
      console.log(`[Groq] Using Scout fallback model (${remainingTime}s remaining)`);
      return API.GROQ_MODELS.SCOUT_VISION;
    }
    
    // Otherwise use configured model
    return configModel;
  }

  /**
   * Handle rate limit by switching to Scout fallback model
   */
  private handleRateLimit(): void {
    if (!this.isUsingFallback) {
      this.isUsingFallback = true;
      this.fallbackUntil = Date.now() + API.FALLBACK_COOLDOWN_MS;
      console.log(`[Groq] ⚠️ Rate limit detected! Switching to Scout model for ${API.FALLBACK_COOLDOWN_MS / 1000}s`);
      console.log(`[Groq] ⚠️ WARNING: Scout model is less accurate than Maverick. Answers may be incorrect.`);
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

    const systemMessage = `${systemPrompt || ""}

CRITICAL FOR ACCURACY AND FORMAT:
- Calculate the correct answer yourself - don't just pick from options
- ALWAYS use format: "FINAL ANSWER: option {number}) {your answer}"
- For multiple answer MCQs, use: "option 1, 3, 4) Multiple answers"
- For fill in the blanks, provide the exact word/phrase needed
- For Q&A questions, give clear, concise answers (1-3 sentences)
- If you calculate 6600 but option says 6500, answer with YOUR calculation (6600)
- OCR may misread values - trust your math over the extracted text
- Prioritize CORRECTNESS over matching given options exactly
- Give the right answer even if it doesn't match any option perfectly

MANDATORY FORMAT EXAMPLES:
- "FINAL ANSWER: option 1) True"
- "FINAL ANSWER: option 3) 6600"
- "FINAL ANSWER: option 2) The correct statement"
- "FINAL ANSWER: option 1, 3) Multiple correct"`;

    // Check if this is a text-only model (GPT-OSS)
    const isTextOnlyModel = model.includes('gpt-oss');

    if (isTextOnlyModel && extractedText) {
      // Text-only model: use OCR text
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
        
        // Detect rate limiting - switch to Scout and retry immediately
        if (error.status === 429 || error.code === 'rate_limit_exceeded') {
          console.error(`[Groq] Rate limit hit after ${duration}ms on model: ${model}`);
          
          // If we were using Maverick, switch to Scout and retry
          if (model === API.GROQ_MODELS.MAVERICK_VISION) {
            this.handleRateLimit();
            console.log('[Groq] Retrying immediately with Scout model...');
            
            // Retry with Scout model - add extra emphasis on accuracy
            const scoutSystemMessage = `${systemMessage}

⚠️ CRITICAL: You are a backup model. Be EXTRA CAREFUL with your answers.
- Double-check your calculations
- Think step-by-step before answering
- If unsure, explain your reasoning clearly
- For Python questions, trace through the code line by line
- For MCQs, verify your answer matches the question exactly`;

            const retryStartTime = Date.now();
            const response = await client.chat.completions.create({
              model: API.GROQ_MODELS.SCOUT_VISION,
              messages: [
                { role: "system", content: scoutSystemMessage },
                { role: "user", content }
              ],
              max_tokens: 2000,
              temperature: 0.1 // Lower temperature for more deterministic answers
            }, { signal });
            
            const retryDuration = Date.now() - retryStartTime;
            console.log(`[Groq] ✓ Scout fallback succeeded in ${retryDuration}ms`);
            console.log(`[Groq] ⚠️ Using Scout model - answer accuracy may be lower than Maverick`);
            
            return response.choices[0].message.content || "";
          } else {
            // Already using Scout, can't fallback further
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

    if (isTextOnlyModel && extractedText) {
      // Text-only model: use OCR text
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
      
      // Detect rate limiting - switch to Scout and retry immediately
      if (error.status === 429 || error.code === 'rate_limit_exceeded') {
        console.error(`[Groq] Rate limit hit after ${duration}ms on debug call`);
        
        // If we were using Maverick, switch to Scout and retry
        if (model === API.GROQ_MODELS.MAVERICK_VISION) {
          this.handleRateLimit();
          console.log('[Groq] Retrying debug call with Scout model...');
          
          // Retry with Scout model - add extra emphasis on accuracy
          // Update system message for Scout
          messages[0].content = `${messages[0].content}

⚠️ CRITICAL: You are a backup model. Be EXTRA CAREFUL with your debugging.
- Double-check your fixes
- Think step-by-step before providing solutions
- Verify your code changes are correct`;

          const retryStartTime = Date.now();
          const response = await client.chat.completions.create({
            model: API.GROQ_MODELS.SCOUT_VISION,
            messages,
            max_tokens: 2000,
            temperature: 0.1 // Lower temperature for more deterministic answers
          }, { signal });
          
          const retryDuration = Date.now() - retryStartTime;
          console.log(`[Groq] ✓ Scout fallback succeeded in ${retryDuration}ms`);
          
          return response.choices[0].message.content || "";
        } else {
          throw new Error('Groq API rate limit exceeded on fallback model. Please wait a moment.');
        }
      }
      
      console.error(`[Groq] Debug API error after ${duration}ms:`, error.message);
      throw error;
    }
  }
}
