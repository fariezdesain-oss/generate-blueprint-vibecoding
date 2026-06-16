export interface AIProviderConfig {
  providerName: string;
  apiKey: string;
  modelName: string;
  baseUrl?: string;
  maxTokens?: number;
}

export interface ContentFile {
  mimeType: string;
  data: string;
  name: string;
}

export interface AIProvider {
  generateChat(_prompt: string, _config: AIProviderConfig, _files?: ContentFile[]): Promise<string>;
  streamChat(
    _prompt: string,
    _config: AIProviderConfig,
    _signal?: AbortSignal,
    _files?: ContentFile[],
  ): AsyncGenerator<string>;
  validateConfig(_config: AIProviderConfig): boolean;
}
