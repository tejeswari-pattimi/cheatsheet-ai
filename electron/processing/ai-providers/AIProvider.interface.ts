export interface AIProvider {
  name: string;
  generateContent(prompt: string, images: string[], signal: AbortSignal, systemPrompt?: string): Promise<string>;
  generateContentWithHistory?(prompt: string, images: string[], history: any[], signal: AbortSignal): Promise<string>;
}
