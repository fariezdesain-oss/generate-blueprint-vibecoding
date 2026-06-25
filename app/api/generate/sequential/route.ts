import { NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabaseServerClient';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createProvider } from '@/lib/ai/provider.factory';
import { decrypt } from '@/lib/utils/encryption';
import type { AIProviderConfig } from '@/lib/ai/provider.interface';
import { buildFilePrompt, FILE_ORDER } from '@/lib/utils/sequentialPrompts';
import { formatAIError } from '@/lib/utils/aiErrorHandler';

async function retryAI(
  provider: any,
  prompt: string,
  config: AIProviderConfig,
  maxAttempts: number = 3,
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await provider.generateChat(prompt, config);
    } catch (err: any) {
      if (attempt < maxAttempts - 1) {
        const msg = err?.message || '';
        const isRateLimit = msg.includes('quota') || msg.includes('rate') || msg.includes('429');
        const delay = isRateLimit ? 30000 * (attempt + 1) : 2000 * Math.pow(2, attempt);
        console.log(`AI retry ${attempt + 1}/${maxAttempts} after ${delay}ms: ${msg.slice(0, 100)}`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
  throw new Error('AI call failed after all retries');
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_UNAUTHORIZED', message: 'Unauthorized' } },
      { status: 401 },
    );
  }

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

  const { data: providerConfig } = await supabase
    .from('provider_configs')
    .select('*')
    .eq('user_id', userData.user.id)
    .eq('is_active', true)
    .single();

  const decryptedKey = providerConfig?.api_key ? decrypt(providerConfig.api_key) : '';

  const aiConfig: AIProviderConfig = {
    providerName: providerConfig?.provider_name || 'gemini',
    apiKey: decryptedKey || '',
    modelName: providerConfig?.model_name || 'gemini-2.5-flash',
    baseUrl: providerConfig?.base_url || undefined,
    maxTokens: 32000,
  };

  if (!aiConfig.apiKey) {
    return NextResponse.json(
      { success: false, error: { code: 'AI_CONFIG_MISSING', message: 'API Key AI tidak dikonfigurasi. Silakan tambahkan provider di menu Settings terlebih dahulu.' } },
      { status: 400 },
    );
  }

  try {
    const provider = createProvider(aiConfig.providerName);
    const prompt = buildFilePrompt(file_index, messages, existingFiles, preview_limit || 0);

    const insufficientPrefix = 'INSUFFICIENT_CONTEXT:';
    if (prompt.trim().startsWith(insufficientPrefix)) {
      const userMessage = prompt.trim().slice(insufficientPrefix.length).trim();
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

    let aiResponse = await retryAI(provider, prompt, aiConfig, 3);

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
      const correctionPrompt = `${prompt}\n\nPERINGATAN: Hasil generate sebelumnya mengandung placeholder (TODO, "sesuaikan", "ganti dengan", dll). HARAM menggunakan placeholder. Tulis ulang dengan konten SPESIFIK dan LENGKAP. Jangan gunakan kata "TODO", "sesuaikan", "ganti dengan", "contoh", atau "misalnya".`;
      aiResponse = await retryAI(provider, correctionPrompt, aiConfig, 2);
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
    if (file_index === FILE_ORDER.length - 1) {
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
