import axios from "axios"
import { configHelper } from "../../ConfigHelper"
import { API } from "../../constants/app-constants"
import { AIProvider } from "./AIProvider.interface"

interface GeminiMessage {
  role: string;
  parts: Array<{
    text?: string;
    inlineData?: {
      mimeType: string;
      data: string;
    }
  }>;
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

export class GeminiProvider implements AIProvider {
  name = "Gemini";

  async generateContent(prompt: string, images: string[], signal: AbortSignal, systemPrompt?: string): Promise<string> {
    const config = configHelper.loadConfig()
    const apiKey = config.geminiApiKey;

    if (!apiKey) throw new Error("Gemini API key not configured")

    const messages: GeminiMessage[] = [{
      role: "user",
      parts: [
        { text: (systemPrompt || "") + "\n\n" + prompt + "\n\nAnalyze these screenshots:" },
        ...images.map(img => ({
          inlineData: {
            mimeType: "image/png",
            data: img
          }
        }))
      ]
    }]

    return this.callApi(messages, apiKey, config.geminiModel, signal);
  }

  async generateContentWithHistory(prompt: string, images: string[], history: any[], signal: AbortSignal): Promise<string> {
    const config = configHelper.loadConfig()
    const apiKey = config.geminiApiKey;

    if (!apiKey) throw new Error("Gemini API key not configured")

    const messages: GeminiMessage[] = [];

    // Add history
    // Assuming history is in a compatible format or adapting it
    // History usually contains { role, content }
    for (const item of history) {
      if (item.role === 'user') {
        messages.push({
          role: "user",
          parts: [{ text: item.content }] // Assuming content is text for history items for now
        })
      } else if (item.role === 'assistant') {
        messages.push({
          role: "model",
          parts: [{ text: item.content }]
        })
      }
    }

    // Add current request
    messages.push({
      role: "user",
      parts: [
        { text: prompt },
        ...images.map(img => ({
          inlineData: {
            mimeType: "image/png",
            data: img
          }
        }))
      ]
    })

    return this.callApi(messages, apiKey, config.geminiModel, signal);
  }

  private async callApi(messages: GeminiMessage[], apiKey: string, model: string | undefined, signal: AbortSignal): Promise<string> {
    const payload = {
      contents: messages,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 32000
      }
    }

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${model || API.DEFAULT_GEMINI_MODEL}:generateContent?key=${apiKey}`,
      payload,
      {
        signal,
        headers: {
          'Content-Type': 'application/json'
        },
        transformRequest: [(data) => JSON.stringify(data)]
      }
    )

    const data = response.data as GeminiResponse

    if (!data || !data.candidates || data.candidates.length === 0) {
      throw new Error("Gemini API returned invalid response structure. Please try again.")
    }

    if (!data.candidates[0].content || !data.candidates[0].content.parts || data.candidates[0].content.parts.length === 0) {
      throw new Error("Gemini API returned empty response. Please try again.")
    }

    const text = data.candidates[0].content.parts[0].text
    if (!text) {
      throw new Error("Gemini API returned empty text. Please try again.")
    }

    return text
  }
}
