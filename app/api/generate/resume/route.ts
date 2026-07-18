import { NextResponse } from 'next/server';
import { decrypt } from '@/lib/utils/encryption';
import type { AIProviderConfig } from '@/lib/ai/provider.interface';
import { hasAllSpecFiles } from '@/lib/utils/sequentialPrompts';
import { formatAIError } from '@/lib/utils/aiErrorHandler';
import { processSequential, processN8nSync } from '@/lib/utils/generate';
import { detectModelCapabilities } from '@/lib/utils/modelCapabilities';
import { rateLimitResponse } from '@/lib/utils/rateLimit';
import { withAuth } from '@/lib/utils/apiAuth';

export const POST = withAuth(async (req, _context, supabase, user) => {
  const limited = await rateLimitResponse(supabase, `${user.id}:generate`, 6, 10 * 60_000);
  if (limited) return limited;

  const { sessionId, mode } = await req.json();

  if (!sessionId) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'sessionId is required' } },
      { status: 400 },
    );
  }

  const { data: session } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
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

  if (session.generation_status === 'completed') {
    const filesCount = await supabase
      .from('sessions')
      .select('generated_files')
      .eq('id', sessionId)
      .single();

    const files = (filesCount.data?.generated_files as Record<string, string>) || {};
    if (hasAllSpecFiles(files)) {
      return NextResponse.json(
        { success: false, error: { code: 'ALREADY_COMPLETED', message: 'Semua dokumen sudah selesai dibuat. Tidak perlu resume.' } },
        { status: 400 },
      );
    }
  }

  const generationStartedAt = session.generation_started_at
    ? Date.parse(session.generation_started_at as string)
    : 0;
  const isGenerationStale =
    session.generation_status === 'generating' &&
    (!generationStartedAt || Date.now() - generationStartedAt > 10 * 60_000);

  if (session.generation_status === 'generating' && !isGenerationStale) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'GENERATION_IN_PROGRESS',
          message: 'Generate masih berjalan. Tunggu proses selesai atau coba resume lagi jika sudah macet lebih dari 10 menit.',
        },
      },
      { status: 409 },
    );
  }

  const { data: providerConfig } = await supabase
    .from('provider_configs')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  if (!providerConfig) {
    return NextResponse.json(
      { success: false, error: { code: 'AI_CONFIG_MISSING', message: 'Tidak ada provider AI aktif. Silakan tambahkan provider di menu Settings.' } },
      { status: 400 },
    );
  }

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

  if (!aiConfig.apiKey) {
    return NextResponse.json(
      { success: false, error: { code: 'AI_CONFIG_MISSING', message: 'API Key tidak valid.' } },
      { status: 400 },
    );
  }

  const { data: messages } = await supabase
    .from('messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (!messages || messages.length === 0) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'No messages in session' } },
      { status: 400 },
    );
  }

  const resumeStartedAt = new Date().toISOString();
  try {
    const { error: startUpdateError } = await supabase
      .from('sessions')
      .update({ generation_status: 'generating', generation_error: null, generation_started_at: resumeStartedAt, updated_at: resumeStartedAt })
      .eq('id', sessionId)
      .eq('user_id', user.id);

    if (startUpdateError) {
      await supabase
        .from('sessions')
        .update({ generation_status: 'generating', generation_error: null, updated_at: resumeStartedAt })
        .eq('id', sessionId)
        .eq('user_id', user.id);
    }
  } catch {}

  try {
    if (mode === 'n8n') {
      await processN8nSync(supabase, sessionId, user.id, messages, aiConfig);
    } else {
      await processSequential(supabase, sessionId, user.id, messages, aiConfig);
    }

    try { await supabase.from('sessions').update({ generation_status: 'completed' }).eq('id', sessionId).eq('user_id', user.id); } catch { /* kolom mungkin belum ada */ }

    return NextResponse.json({ success: true, data: { jobId: sessionId, mode, resumed: true } });
  } catch (err) {
    const { code, message } = formatAIError(err);
    try { await supabase.from('sessions').update({ generation_status: 'failed', generation_error: message }).eq('id', sessionId).eq('user_id', user.id); } catch { /* kolom mungkin belum ada */ }
    return NextResponse.json(
      { success: false, error: { code, message } },
      { status: 500 },
    );
  }
});
