import { detectModelCapabilities } from '@/lib/utils/modelCapabilities';

describe('modelCapabilities', () => {
  it('should detect high context models', () => {
    const capabilities = detectModelCapabilities('gemini', 'gemini-2.5-flash');

    expect(capabilities.contextLevel).toBe('high');
    expect(capabilities.consistencyMode).toBe('full');
    expect(capabilities.maxTokens).toBe(32000);
  });

  it('should detect low context models', () => {
    const capabilities = detectModelCapabilities('openrouter', 'meta-llama/llama-3.1-8b-instruct:free');

    expect(capabilities.contextLevel).toBe('low');
    expect(capabilities.consistencyMode).toBe('light');
    expect(capabilities.previewLimit).toBeLessThan(1000);
    expect(capabilities.retryCount).toBe(4);
  });

  it('should default unknown models to medium context', () => {
    const capabilities = detectModelCapabilities('custom', 'unknown-model');

    expect(capabilities.contextLevel).toBe('medium');
    expect(capabilities.previewLimit).toBe(1600);
  });
});
