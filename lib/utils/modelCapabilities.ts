export type ContextLevel = 'low' | 'medium' | 'high';

export interface ModelCapabilities {
  contextLevel: ContextLevel;
  maxTokens: number;
  previewLimit: number;
  timeoutMs: number;
  retryCount: number;
  consistencyMode: 'light' | 'full';
}

const HIGH_CONTEXT_PATTERNS = [
  /gemini-1\.5-pro/i,
  /gemini-1\.5-flash/i,
  /gemini-2\./i,
  /claude-3\.?5/i,
  /claude-3\.?7/i,
  /claude-sonnet-4/i,
  /gpt-4o/i,
  /gpt-4\.1/i,
  /o1/i,
  /o3/i,
  /128k/i,
  /200k/i,
  /1m/i,
];

const LOW_CONTEXT_PATTERNS = [
  /free/i,
  /8b/i,
  /7b/i,
  /(^|[-_/:])mini($|[-_/:])/i,
  /(^|[-_/:])small($|[-_/:])/i,
  /flash-lite/i,
  /gemma/i,
  /llama-3\.1-8b/i,
  /llama-3\.2-3b/i,
];

function hasMatch(modelName: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(modelName));
}

export function detectModelCapabilities(providerName: string, modelName: string): ModelCapabilities {
  const provider = providerName.toLowerCase();
  const model = modelName.toLowerCase();

  if (hasMatch(model, LOW_CONTEXT_PATTERNS)) {
    return {
      contextLevel: 'low',
      maxTokens: 12000,
      previewLimit: 900,
      timeoutMs: provider === 'groq' ? 120000 : 150000,
      retryCount: 5,
      consistencyMode: 'light',
    };
  }

  if (hasMatch(model, HIGH_CONTEXT_PATTERNS) || provider === 'gemini' || provider === 'ninerouter') {
    return {
      contextLevel: 'high',
      maxTokens: 32000,
      previewLimit: 25000, // Dramatically increased to preserve full context (tables, architectures) for capable models
      timeoutMs: 240000,
      retryCount: 3,
      consistencyMode: 'full',
    };
  }

  return {
    contextLevel: 'medium',
    maxTokens: 20000,
    previewLimit: 1600,
    timeoutMs: 180000,
    retryCount: 4,
    consistencyMode: 'light',
  };
}
