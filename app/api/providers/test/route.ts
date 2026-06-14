import { NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabaseServerClient';
import { createProvider } from '@/lib/ai/provider.factory';
import { decrypt } from '@/lib/utils/encryption';
import { formatAIError } from '@/lib/utils/aiErrorHandler';
import type { AIProviderConfig } from '@/lib/ai/provider.interface';

export async function POST(req: Request) {
  const body = await req.json();
  const { provider_name, api_key, model_name, base_url, provider_id } = body;

  let resolvedName = provider_name;
  let resolvedKey = api_key;
  let resolvedModel = model_name;
  let resolvedBaseUrl = base_url;

  // Test saved provider by ID
  if (provider_id) {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json(
        { success: false, error: { code: 'AUTH_UNAUTHORIZED', message: 'Unauthorized' } },
        { status: 401 },
      );
    }

    const { data: config } = await supabase
      .from('provider_configs')
      .select('*')
      .eq('id', provider_id)
      .single();

    if (!config || config.user_id !== userData.user.id) {
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

  const aiConfig: AIProviderConfig = {
    providerName: resolvedName,
    apiKey: resolvedKey,
    modelName: resolvedModel,
    baseUrl: resolvedBaseUrl,
  };

  try {
    const provider = createProvider(aiConfig.providerName);
    const testPrompt = 'Balas dengan satu kata: "OK"';
    await provider.generateChat(testPrompt, aiConfig);

    return NextResponse.json({
      success: true,
      data: { message: `Berhasil terhubung ke ${resolvedName} / ${resolvedModel}` },
    });
  } catch (err) {
    const { code, message } = formatAIError(err);
    return NextResponse.json(
      { success: false, error: { code, message } },
      { status: 500 },
    );
  }
}
