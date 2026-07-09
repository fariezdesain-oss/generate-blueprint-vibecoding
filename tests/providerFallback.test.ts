import { buildProviderFallbackCandidates, isFallbackableAIError } from '@/lib/utils/providerFallback';
import { encrypt } from '@/lib/utils/encryption';

process.env.ENCRYPTION_SECRET = 'test-secret-key-for-unit-testing-32ch';

const encrypted1 = encrypt('test-key-1');
const encrypted2 = encrypt('test-key-2');

describe('providerFallback', () => {
  const rows = [
    {
      id: 'p1',
      provider_name: 'gemini',
      model_name: 'gemini-2.5-flash',
      api_key: encrypted1,
      base_url: null,
      is_active: true,
      created_at: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'p2',
      provider_name: 'groq',
      model_name: 'free-model',
      api_key: encrypted2,
      base_url: null,
      is_active: false,
      created_at: '2026-01-02T00:00:00.000Z',
    },
  ];

  it('should return primary then fallback sorted by capability', () => {
    const candidates = buildProviderFallbackCandidates(rows);

    expect(candidates).toHaveLength(2);
    expect(candidates[0].isPrimary).toBe(true);
    expect(candidates[0].id).toBe('p1');
    expect(candidates[1].isPrimary).toBe(false);
    expect(candidates[1].id).toBe('p2');
  });

  it('should filter out candidates without api key', () => {
    const candidates = buildProviderFallbackCandidates([
      { ...rows[0], api_key: '' },
    ]);

    expect(candidates).toHaveLength(0);
  });

  it('should classify quota/timeout errors as fallbackable', () => {
    expect(isFallbackableAIError(new Error('quota exceeded'))).toBe(true);
    expect(isFallbackableAIError(new Error('429 Too Many Requests'))).toBe(true);
    expect(isFallbackableAIError(new Error('timeout after 120s'))).toBe(true);
    expect(isFallbackableAIError(new Error('empty response'))).toBe(true);
    expect(isFallbackableAIError(new Error('service unavailable'))).toBe(true);
    expect(isFallbackableAIError(new Error('503 Service Unavailable'))).toBe(true);
    expect(isFallbackableAIError(new Error('insufficient credits'))).toBe(true);
    expect(isFallbackableAIError(new Error('payment required'))).toBe(true);
  });

  it('should NOT classify auth/model errors as fallbackable', () => {
    expect(isFallbackableAIError(new Error('invalid API key'))).toBe(false);
    expect(isFallbackableAIError(new Error('model not found'))).toBe(false);
    expect(isFallbackableAIError(new Error('unauthorized'))).toBe(false);
    expect(isFallbackableAIError(new Error('context length exceeded'))).toBe(false);
  });
});
