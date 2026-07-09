import { NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabaseServerClient';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { decrypt } from '@/lib/utils/encryption';
import type { AIProviderConfig } from '@/lib/ai/provider.interface';
import { hasAllSpecFiles } from '@/lib/utils/sequentialPrompts';
import { formatAIError } from '@/lib/utils/aiErrorHandler';
import { processSequential, processN8nSync } from '@/lib/utils/generate';
import { detectModelCapabilities } from '@/lib/utils/modelCapabilities';
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

  const limited = rateLimitResponse(`${userData.user.id}:generate`, 6, 10 * 60_000);
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

  if (session.user_id !== userData.user.id) {
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

  const { data: providerConfig } = await supabase
    .from('provider_configs')
    .select('*')
    .eq('user_id', userData.user.id)
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

  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  try { await supabaseAdmin.from('sessions').update({ generation_status: 'generating', generation_error: null }).eq('id', sessionId).eq('user_id', userData.user.id); } catch { /* kolom mungkin belum ada */ }

  try {
    if (mode === 'n8n') {
      await processN8nSync(supabaseAdmin, sessionId, userData.user.id, messages, aiConfig);
    } else {
      await processSequential(supabaseAdmin, sessionId, userData.user.id, messages, aiConfig);
    }

    try { await supabaseAdmin.from('sessions').update({ generation_status: 'completed' }).eq('id', sessionId).eq('user_id', userData.user.id); } catch { /* kolom mungkin belum ada */ }

    return NextResponse.json({ success: true, data: { jobId: sessionId, mode, resumed: true } });
  } catch (err) {
    const { code, message } = formatAIError(err);
    try { await supabaseAdmin.from('sessions').update({ generation_status: 'failed', generation_error: message }).eq('id', sessionId).eq('user_id', userData.user.id); } catch { /* kolom mungkin belum ada */ }
    return NextResponse.json(
      { success: false, error: { code, message } },
      { status: 500 },
    );
  }
}
