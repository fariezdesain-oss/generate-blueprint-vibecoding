import { NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabaseServerClient';
import { createProvider } from '@/lib/ai/provider.factory';
import { decrypt } from '@/lib/utils/encryption';
import type { AIProviderConfig, ContentFile } from '@/lib/ai/provider.interface';
import { formatAIError } from '@/lib/utils/aiErrorHandler';
import { sanitizeChatAttachments, type ChatAttachment } from '@/lib/utils/attachments';

async function getActiveProviderConfig(userId: string): Promise<{
  providerName: string;
  apiKey: string;
  modelName: string;
  baseUrl?: string;
} | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('provider_configs')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();

  if (!data) return null;

  return {
    providerName: data.provider_name,
    apiKey: decrypt(data.api_key),
    modelName: data.model_name,
    baseUrl: data.base_url || undefined,
  };
}

const SYSTEM_PROMPT_DOCS = `You are a Senior Requirements Analyst and Software Architect. Your role is to help users who often don't know exactly what they want to build.

WAJIB GUNAKAN BAHASA INDONESIA. Selalu jawab dalam Bahasa Indonesia.

CRITICAL — GENERATE BUTTON ACTIVATION:
Tombol "Generate Documentation" diaktifkan oleh frontend HANYA jika respons Anda mengandung kalimat:
"Saya rasa informasi sudah cukup. Klik 'Generate Documentation' untuk menghasilkan 7 dokumen spesifikasi."
Jika kalimat itu tidak ada, tombol tetap NONAKTIF. Jadi pastikan Anda hanya mengucapkannya saat benar-benar siap.

BEHAVIOR RULES:

1. **Natural greeting** — If user just says "halo", "hai", "hello", or similar, respond naturally like a friendly consultant. Do NOT jump into questions.

2. **Detect project intent** — When the user mentions wanting to build something (e.g., "saya mau buat program...", "bikin aplikasi...", "ide saya..."), switch to discovery mode immediately.

3. **Adaptive probing (maksimal 5 pertanyaan per respons)** — Gali kebutuhan secara natural. Boleh 1-3 pertanyaan per respons, jangan lebih dari 5. Jangan sungkan atau ragu — jika ada yang kurang jelas, tanyakan. Bangun pertanyaan dari jawaban sebelumnya. Cakup area ini secara alami:
   - Masalah apa yang ingin diselesaikan?
   - Siapa target penggunanya?
   - Platform apa (web/mobile/desktop)?
   - Fitur inti apa saja yang dibutuhkan?
   - Ada preferensi tech stack? (boleh di-skip jika user belum tahu)
   - Apakah sudah ada codebase existing atau mulai dari nol?
   - Apakah ada constraint teknis (budget, timeline, hosting, tim size)?
   - Siapa yang akan menggunakan aplikasi ini? (developer internal, publik, client?)

4. **Keep digging** — Jika jawaban user masih vague atau kurang jelas, jangan sungkan untuk tanya lebih detail. Boleh lanjut bertanya di respons berikutnya jika masih ada yang belum tergali. Jangan berhenti sampai Anda punya gambaran jelas.

5. **Signal readiness (generate gate)** — Hanya ketika Anda merasa sudah memiliki konteks CUKUP untuk menulis 7 dokumen spesifikasi (problem statement, target user, platform, fitur inti sudah jelas), KIRIMKAN sinyal generate dengan mengakhiri respons menggunakan kalimat PERSIS:
"Saya rasa informasi sudah cukup. Klik 'Generate Documentation' untuk menghasilkan 7 dokumen spesifikasi."
Jangan pernah mengirim sinyal ini jika informasi masih kurang.

6. **User requests generate early** — Jika user meminta generate (misal: "generate sekarang", "buat dokumentasinya", "ayo generate"), EVALUASI apakah informasi proyek sudah cukup mengikuti kriteria di rule #5. Jika sudah cukup, kirim sinyal generate. Jika belum, jelaskan data apa yang masih diperlukan dan JANGAN kirim sinyal.

7. **No false positive signals** — Jangan pernah mengirim sinyal generate jika percakapan baru sampai sapaan ("halo", "hai"), basa-basi, atau informasi proyek belum spesifik/tidak lengkap. Tombol hanya aktif lewat sinyal Anda.

8. **Never generate code or docs** — Only gather requirements. No code snippets, no architecture plans.

9. **Regenerate from scratch** — Jika user meminta membuat ulang hasil generate (misal: "buat ulang", "generate ulang", "hasilnya kurang", "reset", "dari awal"), EVALUASI apakah informasi proyek sudah cukup (sama seperti rule #5). Jika sudah, kirim KEDUA sinyal berikut secara berurutan dalam respons:
   "Saya akan generate ulang dari awal."
   "Saya rasa informasi sudah cukup. Klik 'Generate Documentation' untuk menghasilkan 7 dokumen spesifikasi."
   Jika informasi belum cukup, jelaskan apa yang kurang dan JANGAN kirim kedua sinyal tersebut.
   Jika user hanya menyebut "lanjutkan" atau "generate" tanpa "ulang"/"reset"/"dari awal", jangan kirim sinyal regenerate.

Jaga respons tetap ringkas dan fokus.`;

const SYSTEM_PROMPT_N8N = `Anda adalah senior automation engineer dan n8n workflow specialist. Tugas Anda adalah menggali informasi untuk membangun n8n workflow automation.

WAJIB GUNAKAN BAHASA INDONESIA.

CRITICAL — GENERATE BUTTON ACTIVATION:
Tombol "Generate n8n Workflow" diaktifkan oleh frontend HANYA jika respons Anda mengandung kalimat:
"Informasi sudah cukup. Klik 'Generate n8n Workflow' untuk membuat workflow."
Jika kalimat itu tidak ada, tombol tetap NONAKTIF. Pastikan Anda hanya mengucapkannya saat benar-benar siap.

BEHAVIOR RULES:

1. **Natural greeting** — Jika user hanya menyapa ("halo", "hai"), responslah secara natural. Jangan langsung bertanya teknis.

2. **Detect automation intent** — Ketika user menyebut ingin membuat workflow/otomatisasi, segera gali detail teknisnya.

3. **Adaptive probing (maksimal 5 pertanyaan per respons)** — Gali kebutuhan workflow secara bertahap:
   - Trigger: bagaimana workflow akan dipicu? (Webhook, Schedule/Cron, Manual, Form submission)
   - Sumber data: API eksternal apa yang terlibat? Database? Spreadsheet? RSS?
   - Transformasi: apakah data perlu difilter, digabung, atau diubah formatnya?
   - Logika kondisional: apakah ada if/then/else branching?
   - Output/tujuan: kemana hasilnya dikirim? (Slack, Email, Database, API, Notion, Telegram)
   - Autentikasi: API key, OAuth2, atau Basic Auth?
   - Apakah workflow melibatkan WhatsApp / Telegram / platform messaging lain? (penting — jika ya, probing detail nomor tujuan, format pesan, webhook setup)
   - n8n self-hosted atau n8n.cloud? (mempengaruhi format webhook URL dan cara setting)
   - Berapa volume perkiraan eksekusi per hari? (untuk menentukan skalabilitas)
   - Apakah perlu penanganan error khusus? Notifikasi jika workflow gagal?
   - Apakah perlu webhook validation / secret token untuk keamanan?

4. **Keep digging** — Jika jawaban user masih vague, gali lebih dalam. Jangan menyerah sampai kebutuhan workflow jelas.

5. **Signal readiness** — Hanya ketika trigger, sumber data, transformasi, logika, dan output sudah jelas, kirim sinyal:
   "Informasi sudah cukup. Klik 'Generate n8n Workflow' untuk membuat workflow."

6. **No false positive signals** — Jangan kirim sinyal jika percakapan baru sapaan atau informasi workflow masih kurang.

7. **Never generate workflow JSON directly** — Hanya kumpulkan spesifikasi. Jangan generate kode atau workflow JSON di chat.

8. **Regenerate from scratch** — Jika user minta buat ulang, evaluasi ulang apakah informasi cukup. Jika cukup, kirim KEDUA sinyal:
   "Saya akan generate ulang dari awal."
   "Informasi sudah cukup. Klik 'Generate n8n Workflow' untuk membuat workflow."

9. **Stay on topic** — Jika user bertanya di luar konteks workflow n8n, arahkan kembali ke kebutuhan workflow automation.`;

const MODE_PREFIX: Record<string, string> = {
  docs: '📄 ',
  n8n: '⚙️ ',
};

function buildPrompt(messages: { role: string; content: string }[], mode: string): string {
  const systemPrompt = mode === 'n8n' ? SYSTEM_PROMPT_N8N : SYSTEM_PROMPT_DOCS;
  const systemBlock = `SYSTEM: ${systemPrompt}`;
  const conversation = messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
  return `${systemBlock}\n\n${conversation}\nASSISTANT:`;
}

async function loadContentFiles(files: { storagePath: string; mimeType: string; name: string }[]): Promise<ContentFile[]> {
  const supabase = await createClient();
  const result: ContentFile[] = [];

  for (const f of files) {
    const { data, error } = await supabase.storage
      .from('chat-attachments')
      .download(f.storagePath);

    if (error || !data) continue;

    const buffer = Buffer.from(await data.arrayBuffer());
    result.push({
      mimeType: f.mimeType,
      data: buffer.toString('base64'),
      name: f.name,
    });
  }

  return result;
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_UNAUTHORIZED', message: 'Unauthorized' } },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('session_id');

  if (!sessionId) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'session_id is required' } },
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

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, data: { messages: data, title: session.title, mode: session.mode || 'docs' } });
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

  const { session_id, content, files } = await req.json();

  if (!session_id || typeof session_id !== 'string') {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'session_id is required' } },
      { status: 400 },
    );
  }

  if ((!content || typeof content !== 'string') && (!files || files.length === 0)) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Content or files are required' } },
      { status: 400 },
    );
  }

  const { data: session } = await supabase
    .from('sessions')
    .select('user_id, title, mode')
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

  let userAttachments: ChatAttachment[];
  try {
    userAttachments = sanitizeChatAttachments(files, userData.user.id, session_id);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid attachment metadata';
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message } },
      { status: 400 },
    );
  }

  const { error: userMsgError } = await supabase
    .from('messages')
    .insert({
      session_id,
      role: 'user',
      content: content || '',
      attachments: userAttachments,
    });

  if (userMsgError) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: userMsgError.message } },
      { status: 500 },
    );
  }

  const providerConfig = await getActiveProviderConfig(userData.user.id);

  const aiConfig: AIProviderConfig = {
    providerName: providerConfig?.providerName || 'gemini',
    apiKey: providerConfig?.apiKey || '',
    modelName: providerConfig?.modelName || 'gemini-2.5-flash',
    baseUrl: providerConfig?.baseUrl,
    maxTokens: 32000,
  };

  const { data: history } = await supabase
    .from('messages')
    .select('role, content')
    .eq('session_id', session_id)
    .order('created_at', { ascending: true });

  const url = new URL(req.url);
  const isStream = url.searchParams.get('stream') === '1';

  if (!aiConfig.apiKey) {
    return NextResponse.json(
      { success: false, error: { code: 'AI_CONFIG_MISSING', message: 'API Key AI tidak dikonfigurasi. Silakan tambahkan provider di menu Settings terlebih dahulu.' } },
      { status: 400 },
    );
  }

  if (!isStream) {
    try {
      const provider = createProvider(aiConfig.providerName);
      const prompt = buildPrompt(history || [], session.mode || 'docs');
      const aiResponse = await provider.generateChat(prompt, aiConfig);

      const { data: aiMessage, error: aiMsgError } = await supabase
        .from('messages')
        .insert({ session_id, role: 'assistant', content: aiResponse })
        .select()
        .single();

      if (aiMsgError) {
        return NextResponse.json(
          { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: aiMsgError.message } },
          { status: 500 },
        );
      }

      await supabase
        .from('sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', session_id);

      return NextResponse.json(
        { success: true, data: { message: aiMessage } },
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

  const encoder = new TextEncoder();
  let fullResponse = '';
  const signal = req.signal;

  let contentFiles: ContentFile[] = [];
  if (userAttachments.length > 0) {
    contentFiles = await loadContentFiles(userAttachments);
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const provider = createProvider(aiConfig.providerName);
        const prompt = buildPrompt(history || [], session.mode || 'docs');

        const gen = provider.streamChat(prompt, aiConfig, signal, contentFiles);

        for await (const token of gen) {
          if (signal?.aborted) break;
          fullResponse += token;
          controller.enqueue(
            encoder.encode(JSON.stringify({ token }) + '\n'),
          );
        }

        if (signal?.aborted) {
          controller.close();
          return;
        }

        const { data: inserted, error: aiMsgError } = await supabase
          .from('messages')
          .insert({ session_id, role: 'assistant', content: fullResponse })
          .select('id, session_id, role, content, created_at')
          .single();

        if (!aiMsgError) {
          await supabase
            .from('sessions')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', session_id);
        }

        // Auto-set session title from first user message
        let sessionTitle: string | undefined;
        if (session.title === 'New Chat') {
          try {
            const firstFileName = userAttachments.length > 0 ? userAttachments[0].name : '';
            const titleSource = (content || firstFileName || 'New Chat');
            const raw = titleSource.length > 35 ? titleSource.substring(0, 35) + '...' : titleSource;
            const mode = session.mode || 'docs';
            const prefix = MODE_PREFIX[mode] || '';
            sessionTitle = prefix + (mode === 'n8n' ? raw : raw);
            await supabase
              .from('sessions')
              .update({ title: sessionTitle, updated_at: new Date().toISOString() })
              .eq('id', session_id);
          } catch {
            sessionTitle = undefined;
          }
        }

        const messageData = inserted
          ? {
              id: inserted.id,
              sessionId: inserted.session_id,
              role: inserted.role,
              content: inserted.content,
              createdAt: inserted.created_at,
            }
          : null;

        controller.enqueue(
          encoder.encode(
            JSON.stringify({ done: true, message: messageData, title: sessionTitle }) + '\n',
          ),
        );
        controller.close();
      } catch (err) {
        const { message } = formatAIError(err);
        controller.enqueue(
          encoder.encode(JSON.stringify({ error: message }) + '\n'),
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
