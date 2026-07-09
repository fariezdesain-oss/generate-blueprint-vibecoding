import { detectModelCapabilities } from '@/lib/utils/modelCapabilities';

export interface ProviderConfigRow {
  id: string;
  provider_name: string;
  model_name: string;
  api_key?: string | null;
  base_url?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export function maskApiKey(apiKey: string | null | undefined): string {
  if (!apiKey || apiKey.length <= 4) return '••••••••';
  const visible = apiKey.slice(-4);
  return `${'•'.repeat(24)}${visible}`;
}

export function serializeProviderConfig(provider: ProviderConfigRow, maskedApiKey: string = '') {
  const capabilities = detectModelCapabilities(provider.provider_name, provider.model_name);

  return {
    id: provider.id,
    provider_name: provider.provider_name,
    model_name: provider.model_name,
    has_api_key: !!provider.api_key,
    masked_api_key: maskedApiKey,
    base_url: provider.base_url || '',
    context_level: capabilities.contextLevel,
    model_capabilities: capabilities,
    is_active: provider.is_active,
    created_at: provider.created_at,
    updated_at: provider.updated_at,
  };
}
