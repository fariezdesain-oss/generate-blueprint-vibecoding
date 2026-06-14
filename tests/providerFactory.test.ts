import { createProvider } from '@/lib/ai/provider.factory';

describe('providerFactory', () => {
  const validProviders = ['gemini', 'openrouter', 'groq', 'deepseek', 'custom'];

  it.each(validProviders)('should create %s provider', (name) => {
    const provider = createProvider(name);
    expect(provider).toBeDefined();
    expect(typeof provider.generateChat).toBe('function');
    expect(typeof provider.streamChat).toBe('function');
    expect(typeof provider.validateConfig).toBe('function');
  });

  it('should throw PROVIDER_NOT_FOUND for invalid provider', () => {
    expect(() => createProvider('invalid-provider')).toThrow('PROVIDER_NOT_FOUND');
  });
});
