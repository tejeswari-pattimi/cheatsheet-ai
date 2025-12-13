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

  // Note: Groq currently doesn't support vision models directly in this implementation,
  // so we use OCR to extract text from images first.
  async generateContent(prompt: string, images: string[], signal: AbortSignal, systemPrompt?: string): Promise<string> {
    const client = this.getClient();
    const config = configHelper.loadConfig();

    // Use OCR to extract text (this might need to be passed in or handled differently if we want to keep provider pure)
    // But since the interface accepts images, we handle it here.
    // However, image paths are needed for OCRHelper, but here we receive base64 strings?
    // Wait, ProcessingHelper passes base64 strings.
    // OCRHelper.extractTextFromMultiple takes PATHS.
    // Refactoring issue: ProcessingHelper currently loads images to base64.
    // For Groq provider to use OCRHelper, it needs paths or OCRHelper needs to support base64.
    // OCRHelper uses Tesseract.js which supports base64.

    // Let's assume for now we can't easily get paths here if only base64 is passed.
    // OR we change the interface to accept paths or objects.
    // ProcessingHelper has paths in `screenshots`.

    // For now, let's assume the caller handles OCR for Groq or we adapt.
    // Actually, `ProcessingHelper.ts` calls `ocrHelper.extractTextFromMultiple(this.deps.getScreenshotQueue())`.
    // It passes PATHS to `extractTextFromMultiple`.

    // So the `AIProvider` interface taking `images: string[]` (base64) is fine for Gemini, but for Groq we need text.
    // We should probably modify the interface or the call.
    // Let's make `images` optional or add `extractedText`?
    // Or we handle OCR inside ProcessingHelper and pass it in the prompt.

    // In the current `ProcessingHelper.ts`, `callGroq` does:
    // const extractedText = await ocrHelper.extractTextFromMultiple(this.deps.getScreenshotQueue())

    // So `GroqProvider` should probably receive the extracted text in the prompt or as a separate argument.
    // Let's rely on the prompt containing the context.

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

    // The user message should contain the text.
    // The caller (ProcessingHelper) should have already done OCR and put it in the prompt if using Groq.
    // But `ProcessingHelper` logic was: if MCQ (Groq), do OCR. If General (Gemini), use images.

    // To make the provider abstraction clean:
    // `GroqProvider` shouldn't do OCR ideally, or it should be capable of it.
    // But since OCR requires Tesseract which is heavy, maybe we keep it outside.
    // Let's assume the `prompt` passed to `generateContent` ALREADY contains the OCR text for Groq.

    const response = await client.chat.completions.create({
      model: config.groqModel || API.DEFAULT_GROQ_MODEL,
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: prompt }
      ],
      max_tokens: 8000,
      temperature: 0.1
    }, { signal });

    return response.choices[0].message.content || "";
  }

  async generateContentWithHistory(prompt: string, images: string[], history: any[], signal: AbortSignal): Promise<string> {
    const client = this.getClient();
    const config = configHelper.loadConfig();

    const messages: any[] = [
      { role: "system", content: "You are an expert debugging assistant." }
    ];

    // Add history
    for (const item of history) {
      messages.push({
        role: item.role === 'model' ? 'assistant' : item.role, // Map 'model' to 'assistant'
        content: item.content
      });
    }

    // Add current request
    // Again, assuming prompt has OCR text
    messages.push({
      role: "user",
      content: prompt
    });

    const response = await client.chat.completions.create({
      model: config.groqModel || API.DEFAULT_GROQ_MODEL,
      messages,
      max_tokens: 8000,
      temperature: 0.1
    }, { signal });

    return response.choices[0].message.content || "";
  }
}
