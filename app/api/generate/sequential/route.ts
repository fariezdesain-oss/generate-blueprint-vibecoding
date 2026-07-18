import { NextResponse } from 'next/server';
import { decrypt } from '@/lib/utils/encryption';
import type { AIProviderConfig } from '@/lib/ai/provider.interface';
import { buildFilePrompt, buildSingleFileConsistencyPrompt, FILE_ORDER, hasAllSpecFiles } from '@/lib/utils/sequentialPrompts';
import { formatAIError } from '@/lib/utils/aiErrorHandler';
import { detectModelCapabilities } from '@/lib/utils/modelCapabilities';
import { buildProviderFallbackCandidates } from '@/lib/utils/providerFallback';
import { generateWithProviderFallback } from '@/lib/utils/generate';
import { rateLimitResponse } from '@/lib/utils/rateLimit';
import { withAuth } from '@/lib/utils/apiAuth';
import { updateSessionWithRetry } from '@/lib/utils/generationDb';
import { hasPlaceholder } from '@/lib/utils/docQuality';

export const POST = withAuth(async (req, _context, supabase, user) => {
  const limited = await rateLimitResponse(supabase, `${user.id}:generate`, 20, 10 * 60_000);
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
    .select('user_id, generated_files, project_state, rolling_summary')
    .eq('id', session_id)
    .single();

  if (!session) {
    return NextResponse.json(
      { success: false, error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' } },
      { status: 404 },
    );
  }

  if (session.user_id !== user.id) {
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
    .eq('user_id', user.id)
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
    const fileName = FILE_ORDER[file_index];
    const filesForContext = { ...existingFiles };
    delete filesForContext[fileName];

    const buildPromptForConfig = (config: AIProviderConfig) => buildFilePrompt(
      file_index,
      messages,
      filesForContext,
      preview_limit ?? config.previewLimit ?? 0,
      config.contextLevel || 'high',
      session.project_state as Record<string, unknown>,
      session.rolling_summary as string,
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

    let fileContent = `# ${fileName}\n\n${aiResponse.replace(/^#\s*.*\n/, '').trim()}`;

    const hasPlaceholderContent = hasPlaceholder(fileContent);
    if (hasPlaceholderContent) {
      const correctionPrompt = `${buildPromptForConfig(result.config)}\n\nPERINGATAN: Hasil generate sebelumnya mengandung placeholder (TODO, "sesuaikan", "ganti dengan", dll). HARAM menggunakan placeholder. Tulis ulang dengan konten SPESIFIK dan LENGKAP. Jangan gunakan kata "TODO", "sesuaikan", "ganti dengan", "contoh", atau "misalnya".`;
      result = await generateWithProviderFallback(fallbackCandidates, () => correctionPrompt, 2);
      aiResponse = result.response;
      fileContent = `# ${fileName}\n\n${aiResponse.replace(/^#\s*.*\n/, '').trim()}`;
    }

    if (fileName !== '01_PRD.md' && aiConfig.consistencyMode !== 'light') {
      const filesForCheck = { ...existingFiles, [fileName]: fileContent };
      const consistencyPrompt = buildSingleFileConsistencyPrompt(fileName, fileContent, filesForCheck, aiConfig.previewLimit ?? 1200);

      if (consistencyPrompt) {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const consistency = await generateWithProviderFallback(fallbackCandidates, () => consistencyPrompt, 2);
            const response = consistency.response.trim();
            if (/^KONSISTEN$/i.test(response)) break;

            if (response.includes(fileName)) {
              fileContent = `# ${fileName}\n\n${response.replace(/^#\s*.*\n/, '').trim()}`;
            }

            break;
          } catch {
            if (attempt === 0) continue;
          }
        }
      }
    }

    const updatedFiles = { ...existingFiles, [fileName]: fileContent };

    const updateData: Record<string, unknown> = {
      generated_files: updatedFiles,
      updated_at: new Date().toISOString(),
    };
    if (hasAllSpecFiles(updatedFiles)) {
      updateData.generated_at = new Date().toISOString();
    }

    try {
      await updateSessionWithRetry(supabase, session_id, user.id, updateData);
    } catch {
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
});
