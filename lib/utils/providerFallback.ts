import type { AIProviderConfig } from '@/lib/ai/provider.interface';
import { decrypt } from '@/lib/utils/encryption';
import { detectModelCapabilities } from '@/lib/utils/modelCapabilities';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface ProviderFallbackCandidate {
  id: string;
  config: AIProviderConfig;
  isPrimary: boolean;
}

interface ProviderRow {
  id: string;
  provider_name: string;
  model_name: string;
  api_key: string;
  base_url?: string | null;
  is_active: boolean;
  created_at?: string;
}

const CONTEXT_SCORE: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export function isFallbackableAIError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err || '');
  return [
    /timeout/i,
    /quota/i,
    /rate/i,
    /429/i,
    /500/i,
    /502/i,
    /503/i,
    /504/i,
    /service unavailable/i,
    /overloaded/i,
    /temporarily unavailable/i,
    /payment required/i,
    /insufficient.*credit/i,
    /credit.*exhaust/i,
    /resource exhausted/i,
    /empty response/i,
    /failed to generate/i,
  ].some((pattern) => pattern.test(message));
}

function buildConfig(row: ProviderRow): AIProviderConfig {
  const capabilities = detectModelCapabilities(row.provider_name, row.model_name);

  return {
    providerName: row.provider_name,
    apiKey: decrypt(row.api_key),
    modelName: row.model_name,
    baseUrl: row.base_url || undefined,
    maxTokens: capabilities.maxTokens,
    contextLevel: capabilities.contextLevel,
    timeoutMs: capabilities.timeoutMs,
    retryCount: capabilities.retryCount,
    previewLimit: capabilities.previewLimit,
    consistencyMode: capabilities.consistencyMode,
  };
}

export function buildProviderFallbackCandidates(rows: ProviderRow[]): ProviderFallbackCandidate[] {
  const active = rows.filter((row) => row.api_key && row.api_key.length > 0);
  const primary = active.find((row) => row.is_active) || active[0];
  if (!primary) return [];

  const fallbackRows = active
    .filter((row) => row.id !== primary.id)
    .sort((a, b) => {
      const aCapabilities = detectModelCapabilities(a.provider_name, a.model_name);
      const bCapabilities = detectModelCapabilities(b.provider_name, b.model_name);
      const scoreDiff = CONTEXT_SCORE[bCapabilities.contextLevel] - CONTEXT_SCORE[aCapabilities.contextLevel];
      if (scoreDiff !== 0) return scoreDiff;
      return (a.created_at || '').localeCompare(b.created_at || '');
    });

  return [primary, ...fallbackRows]
    .map((row) => ({ id: row.id, config: buildConfig(row), isPrimary: row.id === primary.id }));
}

export async function loadProviderFallbackCandidates(supabase: SupabaseClient, userId: string): Promise<ProviderFallbackCandidate[]> {
  const { data } = await supabase
    .from('provider_configs')
    .select('id, provider_name, model_name, api_key, base_url, is_active, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  return buildProviderFallbackCandidates((data || []) as ProviderRow[]);
}
