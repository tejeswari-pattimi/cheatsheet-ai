import { OpenAI } from "openai"
import { configHelper } from "../../ConfigHelper"
import { API } from "../../constants/app-constants"
import { AIProvider } from "./AIProvider.interface"

export class GroqProvider implements AIProvider {
  name = "Groq";
  private client: OpenAI | null = null;

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
      maxRetries: API.MAX_RETRIES - 1
    });

    return this.client;
  }

  async generateContent(prompt: string, images: string[], signal: AbortSignal, systemPrompt?: string, extractedText?: string): Promise<string> {
    const client = this.getClient();
    const config = configHelper.loadConfig();
    const model = config.groqModel || API.DEFAULT_GROQ_MODEL;

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
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: `${prompt}\n\nExtracted text from image:\n${extractedText}` }
        ],
        max_tokens: 2000,
        temperature: 0.2
      }, { signal });

      return response.choices[0].message.content || "";
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

      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content }
        ],
        max_tokens: 2000,
        temperature: 0.2
      }, { signal });

      return response.choices[0].message.content || "";
    }
  }

  async generateContentWithHistory(prompt: string, images: string[], history: any[], signal: AbortSignal, extractedText?: string): Promise<string> {
    const client = this.getClient();
    const config = configHelper.loadConfig();
    const model = config.groqModel || API.DEFAULT_GROQ_MODEL;

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

    const response = await client.chat.completions.create({
      model,
      messages,
      max_tokens: 2000,
      temperature: 0.2
    }, { signal });

    return response.choices[0].message.content || "";
  }
}
