import type { AIProvider, AIProviderConfig, ContentFile } from './provider.interface';

const IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

function buildOpenAIContent(prompt: string, files?: ContentFile[]) {
  if (!files || files.length === 0) {
    return prompt;
  }

  const content: ({ type: string; text: string } | { type: string; image_url: { url: string } })[] = [
    { type: 'text', text: prompt },
  ];

  for (const file of files) {
    if (IMAGE_MIMES.has(file.mimeType)) {
      content.push({
        type: 'image_url',
        image_url: { url: `data:${file.mimeType};base64,${file.data}` },
      });
    }
  }

  return content;
}

export class NinerouterProvider implements AIProvider {
  private defaultBaseUrl = 'http://127.0.0.1:20128/v1';

  private getBaseUrl(config: AIProviderConfig): string {
    return config.baseUrl || this.defaultBaseUrl;
  }

  private buildHeaders(config: AIProviderConfig): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    };
  }

  async generateChat(prompt: string, config: AIProviderConfig, files?: ContentFile[]): Promise<string> {
    const baseUrl = this.getBaseUrl(config);
    const content = buildOpenAIContent(prompt, files);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? 120000);

    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.buildHeaders(config),
        body: JSON.stringify({
          model: config.modelName,
          messages: [{ role: 'user', content }],
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`API error (${res.status}): ${err}`);
      }

      const json = await res.json();
      return json.choices?.[0]?.message?.content || '';
    } finally {
      clearTimeout(timeout);
    }
  }

  async *streamChat(
    prompt: string,
    config: AIProviderConfig,
    signal?: AbortSignal,
    files?: ContentFile[],
  ): AsyncGenerator<string> {
    const baseUrl = this.getBaseUrl(config);
    const content = buildOpenAIContent(prompt, files);

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.buildHeaders(config),
      body: JSON.stringify({
        model: config.modelName,
        messages: [{ role: 'user', content }],
        stream: true,
      }),
      signal,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`API error (${res.status}): ${err}`);
    }

    const reader = res.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') return;

        try {
          const parsed = JSON.parse(data);
          const token = parsed.choices?.[0]?.delta?.content;
          if (token) yield token;
        } catch {
          // skip malformed
        }
      }
    }
  }

  validateConfig(config: AIProviderConfig): boolean {
    return config.apiKey.length > 0 && config.modelName.length > 0;
  }
}
