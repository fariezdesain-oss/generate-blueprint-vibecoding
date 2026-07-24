import { maskApiKey, serializeProviderConfig } from '@/lib/utils/providerConfig';

describe('providerConfig', () => {
  it('should not expose the stored API key', () => {
    const serialized = serializeProviderConfig(
      {
        id: 'provider-1',
        provider_name: 'gemini',
        model_name: 'gemini-2.5-flash',
        api_key: 'decrypted-or-encrypted-secret',
        base_url: null,
        is_active: true,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      '••••cret',
    );

    expect(serialized).toEqual({
      id: 'provider-1',
      provider_name: 'gemini',
      model_name: 'gemini-2.5-flash',
      has_api_key: true,
      masked_api_key: '••••cret',
      base_url: '',
      context_level: 'high',
      model_capabilities: {
        contextLevel: 'high',
        maxTokens: 32000,
        previewLimit: 25000,
        timeoutMs: 240000,
        retryCount: 3,
        consistencyMode: 'full',
      },
      is_active: true,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    });
    expect(serialized).not.toHaveProperty('api_key');
  });

  it('should mask API keys without exposing the original value', () => {
    expect(maskApiKey('sk-test-secret-1234')).toBe('••••••••••••••••••••••••1234');
    expect(maskApiKey('')).toBe('••••••••');
  });
});
