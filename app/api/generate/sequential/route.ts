import { NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabaseServerClient';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { decrypt } from '@/lib/utils/encryption';
import type { AIProviderConfig } from '@/lib/ai/provider.interface';
import { buildFilePrompt, FILE_ORDER, hasAllSpecFiles } from '@/lib/utils/sequentialPrompts';
import { formatAIError } from '@/lib/utils/aiErrorHandler';
import { detectModelCapabilities } from '@/lib/utils/modelCapabilities';
import { buildProviderFallbackCandidates } from '@/lib/utils/providerFallback';
import { generateWithProviderFallback } from '@/lib/utils/generate';
import { rateLimitResponse } from '@/lib/utils/rateLimit';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_UNAUTHORIZED', message: 'Unauthorized' } },
      { status: 401 },
    );
  }

  const limited = rateLimitResponse(`${userData.user.id}:generate`, 20, 10 * 60_000);
  if (limited) return limited;

  const { session_id, file_index, preview_limit } = await req.json();

  if (!session_id || typeof file_index !== 'number' || file_index < 0 || file_index >= FILE_ORDER.length) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'session_id and valid file_index are required' } },
      { status: 400 },
    );
  }

  const { data: session } = await supabase
    .from('sessions')
    .select('user_id, generated_files')
    .eq('id', session_id)
    .single();

  if (!session) {
    return NextResponse.json(
      { success: false, error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' } },
      { status: 404 },
    );
  }

  if (session.user_id !== userData.user.id) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_FORBIDDEN', message: 'Forbidden' } },
      { status: 403 },
    );
  }

  const existingFiles = (session.generated_files as Record<string, string>) || {};

  const { data: messages } = await supabase
    .from('messages')
    .select('role, content')
    .eq('session_id', session_id)
    .order('created_at', { ascending: true });

  if (!messages || messages.length === 0) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'No messages in session' } },
      { status: 400 },
    );
  }

  const { data: providerConfigs } = await supabase
    .from('provider_configs')
    .select('id, provider_name, model_name, api_key, base_url, is_active, created_at')
    .eq('user_id', userData.user.id)
    .order('created_at', { ascending: true });

  const providerConfig = providerConfigs?.find((config) => config.is_active) || providerConfigs?.[0];
  const decryptedKey = providerConfig?.api_key ? decrypt(providerConfig.api_key) : '';

  const providerName = providerConfig?.provider_name || 'gemini';
  const modelName = providerConfig?.model_name || 'gemini-2.5-flash';
  const capabilities = detectModelCapabilities(providerName, modelName);

  const aiConfig: AIProviderConfig = {
    providerName,
    apiKey: decryptedKey || '',
    modelName,
    baseUrl: providerConfig?.base_url || undefined,
    maxTokens: capabilities.maxTokens,
    contextLevel: capabilities.contextLevel,
    timeoutMs: capabilities.timeoutMs,
    retryCount: capabilities.retryCount,
    previewLimit: capabilities.previewLimit,
    consistencyMode: capabilities.consistencyMode,
  };

  const fallbackCandidates = buildProviderFallbackCandidates(providerConfigs || []);

  if (!aiConfig.apiKey) {
    return NextResponse.json(
      { success: false, error: { code: 'AI_CONFIG_MISSING', message: 'API Key AI tidak dikonfigurasi. Silakan tambahkan provider di menu Settings terlebih dahulu.' } },
      { status: 400 },
    );
  }

  try {
    const buildPromptForConfig = (config: AIProviderConfig) => buildFilePrompt(
      file_index,
      messages,
      existingFiles,
      preview_limit ?? config.previewLimit ?? 0,
      config.contextLevel || 'high',
    );

    const initialPrompt = buildPromptForConfig(aiConfig);
    const insufficientPrefix = 'INSUFFICIENT_CONTEXT:';
    if (initialPrompt.trim().startsWith(insufficientPrefix)) {
      const userMessage = initialPrompt.trim().slice(insufficientPrefix.length).trim();
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INSUFFICIENT_CONTEXT',
            message: userMessage || 'Lanjutkan diskusi proyek Anda terlebih dahulu.',
          },
        },
        { status: 400 },
      );
    }

    let result = await generateWithProviderFallback(fallbackCandidates, buildPromptForConfig);
    let aiResponse = result.response;

    const fileName = FILE_ORDER[file_index];
    let fileContent = `# ${fileName}\n\n${aiResponse.replace(/^#\s*.*\n/, '').trim()}`;

    const placeholderPatterns = [
      /TODO/i, /TBD/i, /placeholder/i,
      /sesuaikan\s+dengan\s+kebutuhan/i,
      /ganti\s+dengan/i, /ubah\s+sesuai/i,
      /isi\s+dengan/i, /contoh:\s*\w+/i,
      /misalnya:?\s*\w+/i,
    ];

    const hasPlaceholder = placeholderPatterns.some(p => p.test(fileContent));
    if (hasPlaceholder) {
      const correctionPrompt = `${buildPromptForConfig(result.config)}\n\nPERINGATAN: Hasil generate sebelumnya mengandung placeholder (TODO, "sesuaikan", "ganti dengan", dll). HARAM menggunakan placeholder. Tulis ulang dengan konten SPESIFIK dan LENGKAP. Jangan gunakan kata "TODO", "sesuaikan", "ganti dengan", "contoh", atau "misalnya".`;
      result = await generateWithProviderFallback(fallbackCandidates, () => correctionPrompt, 2);
      aiResponse = result.response;
      fileContent = `# ${fileName}\n\n${aiResponse.replace(/^#\s*.*\n/, '').trim()}`;
    }

    const updatedFiles = { ...existingFiles, [fileName]: fileContent };

    // sessions table tidak punya UPDATE policy, bypass RLS via service role key
    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const updateData: Record<string, unknown> = {
      generated_files: updatedFiles,
      updated_at: new Date().toISOString(),
    };
    if (hasAllSpecFiles(updatedFiles)) {
      updateData.generated_at = new Date().toISOString();
    }

    const { error: updateError } = await supabaseAdmin
      .from('sessions')
      .update(updateData)
      .eq('id', session_id)
      .eq('user_id', userData.user.id);

    if (updateError) {
      return NextResponse.json(
        { success: false, error: { code: 'DB_SAVE_FAILED', message: 'Gagal menyimpan dokumen. Silakan coba lagi.' } },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          file_name: fileName,
          file_index,
          total_files: FILE_ORDER.length,
          content: fileContent,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    const { code, message } = formatAIError(err);
    return NextResponse.json(
      { success: false, error: { code, message } },
      { status: 500 },
    );
  }
}
