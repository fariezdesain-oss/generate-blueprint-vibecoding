import type { AIProvider } from './provider.interface';
import { GeminiProvider } from './gemini.provider';
import { OpenRouterProvider } from './openrouter.provider';
import { GroqProvider } from './groq.provider';
import { DeepSeekProvider } from './deepseek.provider';
import { OpenAICompatibleProvider } from './custom.provider';
import { NinerouterProvider } from './ninerouter.provider';

export function createProvider(providerName: string): AIProvider {
  switch (providerName) {
    case 'gemini':
      return new GeminiProvider();
    case 'openrouter':
      return new OpenRouterProvider();
    case 'groq':
      return new GroqProvider();
    case 'deepseek':
      return new DeepSeekProvider();
    case 'custom':
      return new OpenAICompatibleProvider();
    case 'ninerouter':
      return new NinerouterProvider();
    default:
      throw new Error('PROVIDER_NOT_FOUND');
  }
}
