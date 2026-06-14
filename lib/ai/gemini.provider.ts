import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AIProvider, AIProviderConfig, ContentFile } from './provider.interface';

const INLINE_MIMES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf']);

function buildParts(prompt: string, files?: ContentFile[]) {
  const parts: ({ text: string } | { inlineData: { mimeType: string; data: string } })[] = [
    { text: prompt },
  ];

  if (files) {
    for (const file of files) {
      if (INLINE_MIMES.has(file.mimeType)) {
        parts.push({ inlineData: { mimeType: file.mimeType, data: file.data } });
      }
    }
  }

  return parts;
}

export class GeminiProvider implements AIProvider {
  private getClient(config: AIProviderConfig) {
    const apiKey = config.apiKey || '';
    return new GoogleGenerativeAI(apiKey);
  }

  async generateChat(prompt: string, config: AIProviderConfig, files?: ContentFile[]): Promise<string> {
    const genAI = this.getClient(config);
    const model = genAI.getGenerativeModel({
      model: config.modelName || 'gemini-2.5-flash',
    });

    const parts = buildParts(prompt, files);
    const result = await model.generateContent(parts);
    const response = result.response;
    return response.text();
  }

  async *streamChat(
    prompt: string,
    config: AIProviderConfig,
    signal?: AbortSignal,
    files?: ContentFile[],
  ): AsyncGenerator<string> {
    const genAI = this.getClient(config);
    const model = genAI.getGenerativeModel({
      model: config.modelName || 'gemini-2.5-flash',
    });

    const parts = buildParts(prompt, files);
    const result = await model.generateContentStream(parts);

    for await (const chunk of result.stream) {
      if (signal?.aborted) break;

      const text = chunk.text();
      if (text) {
        yield text;
      }
    }
  }

  validateConfig(config: AIProviderConfig): boolean {
    return config.apiKey.length > 0;
  }
}
