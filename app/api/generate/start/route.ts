import { NextResponse } from 'next/server';
import { decrypt } from '@/lib/utils/encryption';
import type { AIProviderConfig } from '@/lib/ai/provider.interface';
import { formatAIError } from '@/lib/utils/aiErrorHandler';
import { processSequential, processN8nSync } from '@/lib/utils/generate';
import { detectModelCapabilities } from '@/lib/utils/modelCapabilities';
import { loadProviderFallbackCandidates } from '@/lib/utils/providerFallback';
import { rateLimitResponse } from '@/lib/utils/rateLimit';
import { GENERATION_REQUEST_LIMIT } from '@/lib/utils/generationControl';
import { withAuth } from '@/lib/utils/apiAuth';

export const POST = withAuth(async (req, _context, supabase, user) => {
  const limited = await rateLimitResponse(supabase, `${user.id}:generate`, GENERATION_REQUEST_LIMIT, 10 * 60_000);
  if (limited) return limited;

  const { sessionId, mode } = await req.json();

  if (!sessionId || !mode) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'sessionId and mode are required' } },
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

  const generationStartedAt = new Date().toISOString();
  try {
    const { error: startUpdateError } = await supabase
      .from('sessions')
      .update({ generation_status: 'generating', generation_error: null, generation_started_at: generationStartedAt, updated_at: generationStartedAt })
      .eq('id', sessionId)
      .eq('user_id', user.id);

    if (startUpdateError) {
      await supabase
        .from('sessions')
        .update({ generation_status: 'generating', generation_error: null, updated_at: generationStartedAt })
        .eq('id', sessionId)
        .eq('user_id', user.id);
    }
  } catch {}

  // Try background function first (production), fallback to sync (local dev)
  const isDev = process.env.NODE_ENV === 'development' || (!process.env.DEPLOY_URL && !process.env.URL);

  if (!isDev) {
    const siteUrl = process.env.DEPLOY_URL || process.env.URL!;
    const fnUrl = `${siteUrl}/.netlify/functions/generate-background`;
    try {
      const fnRes = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Background-Secret': process.env.BACKGROUND_SECRET || '',
        },
        body: JSON.stringify({ sessionId, mode }),
        signal: AbortSignal.timeout(5000),
      });

      if (fnRes.ok) {
        return NextResponse.json({ success: true, data: { jobId: sessionId, mode } });
      }
    } catch (err) {
      if (err instanceof DOMException && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
        return NextResponse.json({ success: true, data: { jobId: sessionId, mode, backgroundPending: true } });
      }
      // Background function unavailable before accepting the job, fall through to sync
    }
  }

  // Synchronous fallback (auto-used in dev, fallback in production)
  try {
    if (mode === 'n8n') {
      await processN8nSync(supabase, sessionId, user.id, messages, aiConfig);
    } else {
      const fallbackCandidates = await loadProviderFallbackCandidates(supabase, user.id);
      const result = await processSequential(supabase, sessionId, user.id, messages, aiConfig, fallbackCandidates, 1);
      const status = result.completed ? 'completed' : 'waiting_next';
      try { await supabase.from('sessions').update({ generation_status: status }).eq('id', sessionId).eq('user_id', user.id); } catch { /* kolom mungkin belum ada */ }
      return NextResponse.json({ success: true, data: { jobId: sessionId, mode, ...result } });
    }

    try { await supabase.from('sessions').update({ generation_status: 'completed' }).eq('id', sessionId).eq('user_id', user.id); } catch { /* kolom mungkin belum ada */ }

    return NextResponse.json({ success: true, data: { jobId: sessionId, mode, completed: true } });
  } catch (err) {
    const { code, message } = formatAIError(err);
    try { await supabase.from('sessions').update({ generation_status: 'failed', generation_error: message }).eq('id', sessionId).eq('user_id', user.id); } catch { /* kolom mungkin belum ada */ }
    return NextResponse.json(
      { success: false, error: { code, message } },
      { status: 500 },
    );
  }
});
