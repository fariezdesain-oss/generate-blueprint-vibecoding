import { NextResponse } from 'next/server';
import { createProvider } from '@/lib/ai/provider.factory';
import { decrypt } from '@/lib/utils/encryption';
import { formatAIError } from '@/lib/utils/aiErrorHandler';
import type { AIProviderConfig } from '@/lib/ai/provider.interface';
import { detectModelCapabilities } from '@/lib/utils/modelCapabilities';
import { rateLimitResponse } from '@/lib/utils/rateLimit';
import { withAuth } from '@/lib/utils/apiAuth';

const TEST_TIMEOUT_MS = 18000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('AI_TEST_TIMEOUT')), timeoutMs);
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timeout));
  });
}

export const POST = withAuth(async (req, _context, supabase, user) => {
  const limited = await rateLimitResponse(supabase, `${user.id}:provider-test`, 10, 60_000);
  if (limited) return limited;

  const body = await req.json();
  const { provider_name, api_key, model_name, base_url, provider_id } = body;

  let resolvedName = provider_name;
  let resolvedKey = api_key;
  let resolvedModel = model_name;
  let resolvedBaseUrl = base_url;

  // Test saved provider by ID
  if (provider_id) {
    const { data: config } = await supabase
      .from('provider_configs')
      .select('*')
      .eq('id', provider_id)
      .eq('user_id', user.id)
      .single();

    if (!config) {
      return NextResponse.json(
        { success: false, error: { code: 'PROVIDER_NOT_FOUND', message: 'Provider not found' } },
        { status: 404 },
      );
    }

    resolvedName = config.provider_name;
    resolvedKey = decrypt(config.api_key);
    resolvedModel = config.model_name;
    resolvedBaseUrl = config.base_url || undefined;
  }

  if (!resolvedName || !resolvedKey || !resolvedModel) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'provider_name, api_key, and model_name are required' } },
      { status: 400 },
    );
  }

  const capabilities = detectModelCapabilities(resolvedName, resolvedModel);

  const aiConfig: AIProviderConfig = {
    providerName: resolvedName,
    apiKey: resolvedKey,
    modelName: resolvedModel,
    baseUrl: resolvedBaseUrl,
    maxTokens: 16,
    contextLevel: capabilities.contextLevel,
    timeoutMs: capabilities.timeoutMs,
    retryCount: capabilities.retryCount,
    previewLimit: capabilities.previewLimit,
    consistencyMode: capabilities.consistencyMode,
  };

  try {
    const provider = createProvider(aiConfig.providerName);
    const testPrompt = 'Balas dengan satu kata: "OK"';
    await withTimeout(provider.generateChat(testPrompt, aiConfig), TEST_TIMEOUT_MS);

    return NextResponse.json({
      success: true,
      data: {
        message: `Berhasil terhubung ke ${resolvedName} / ${resolvedModel}. Mode konteks: ${capabilities.contextLevel}.`,
        capabilities,
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'AI_TEST_TIMEOUT') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'AI_TEST_TIMEOUT',
            message: 'Test koneksi melebihi batas waktu. Periksa API key/model atau coba provider lain.',
          },
        },
        { status: 504 },
      );
    }

    const { code, message } = formatAIError(err);
    return NextResponse.json(
      { success: false, error: { code, message } },
      { status: 500 },
    );
  }
});
