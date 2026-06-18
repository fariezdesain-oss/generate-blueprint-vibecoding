import { NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabaseServerClient';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createProvider } from '@/lib/ai/provider.factory';
import { decrypt } from '@/lib/utils/encryption';
import type { AIProviderConfig } from '@/lib/ai/provider.interface';
import { buildFilePrompt, FILE_ORDER } from '@/lib/utils/sequentialPrompts';
import { buildN8nPrompt } from '@/lib/utils/n8nPrompt';
import { validateN8nWorkflow } from '@/lib/utils/n8nValidator';
import { formatAIError } from '@/lib/utils/aiErrorHandler';

function extractJson(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0, inString = false, escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    if (depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

function generateId(): string {
  return 'node-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

function autoFixWorkflow(workflow: Record<string, unknown>): { workflow: Record<string, unknown>; fixes: string[] } {
  const fixes: string[] = [];
  const nodes = workflow.nodes as Array<Record<string, unknown>> | undefined;
  if (!nodes) return { workflow, fixes };

  const hasWebhook = nodes.some(n => n.type === 'n8n-nodes-base.webhook');
  const hasRespond = nodes.some(n => n.type === 'n8n-nodes-base.respondToWebhook');

  if (hasWebhook && !hasRespond) {
    const webhookNode = nodes.find(n => n.type === 'n8n-nodes-base.webhook');
    const webhookName = (webhookNode?.name as string) || 'Webhook';
    const respondId = generateId();
    const respondNode = {
      id: respondId,
      name: 'Balas Webhook',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1,
      position: [250, 300],
      parameters: { respondWith: 'json', options: {} },
    };

    const lastNode = nodes[nodes.length - 1];
    const lastX = ((lastNode?.position as number[])?.[0] || 250) + 250;
    respondNode.position = [lastX, 300];
    nodes.push(respondNode);

    let connections = workflow.connections as Record<string, unknown> | undefined;
    if (!connections) connections = {};
    const c = connections;
    const webhookConns = c[webhookName] as Array<Array<Record<string, unknown>>> | undefined;
    if (webhookConns && webhookConns.length > 0) {
      const firstTarget = webhookConns[0]?.[0]?.node;
      if (firstTarget) {
        c[respondNode.name] = [[{ node: firstTarget, type: 'main', index: 0 }]];
        webhookConns[0] = [{ node: respondNode.name, type: 'main', index: 0 }];
      }
    }
    workflow.connections = c;
    fixes.push('Auto-fix: Menambahkan Respond to Webhook node');
  }

  for (const node of nodes) {
    if (!node.id || node.id === '') {
      node.id = generateId();
      fixes.push(`Auto-fix: Mengisi ID untuk node "${node.name}"`);
    }
    if (node.typeVersion === undefined || node.typeVersion === null) {
      const typeStr = (node.type as string) || '';
      node.typeVersion = typeStr.includes('webhook') || typeStr.includes('httpRequest') || typeStr.includes('set') ? 2 : 1;
      fixes.push(`Auto-fix: Mengisi typeVersion untuk node "${node.name}"`);
    }
  }

  return { workflow, fixes };
}

async function processSequential(
  supabaseAdmin: any,
  sessionId: string,
  messages: { role: string; content: string }[],
  aiConfig: AIProviderConfig,
) {
  const { data: session } = await supabaseAdmin
    .from('sessions')
    .select('generated_files')
    .eq('id', sessionId)
    .single();

  let existingFiles = (session?.generated_files as Record<string, string>) || {};
  const provider = createProvider(aiConfig.providerName);

  for (let i = 0; i < FILE_ORDER.length; i++) {
    const fileName = FILE_ORDER[i];
    if (existingFiles[fileName]) continue;

    const previewLimit = Object.keys(existingFiles).length > 2 ? 2000 : 0;
    const prompt = buildFilePrompt(i, messages, existingFiles, previewLimit);

    let aiResponse = await provider.generateChat(prompt, aiConfig);
    let fileContent = `# ${fileName}\n\n${aiResponse.replace(/^#\s*.*\n/, '').trim()}`;

    const placeholderPatterns = [
      /TODO/i, /TBD/i, /placeholder/i,
      /sesuaikan\s+dengan\s+kebutuhan/i, /ganti\s+dengan/i,
      /ubah\s+sesuai/i, /isi\s+dengan/i,
      /contoh:\s*\w+/i, /misalnya:?\s*\w+/i,
    ];
    if (placeholderPatterns.some(p => p.test(fileContent))) {
      const correctionPrompt = `${prompt}\n\nPERINGATAN: Hasil generate sebelumnya mengandung placeholder. HARAM menggunakan placeholder. Tulis ulang dengan konten SPESIFIK dan LENGKAP.`;
      aiResponse = await provider.generateChat(correctionPrompt, aiConfig);
      fileContent = `# ${fileName}\n\n${aiResponse.replace(/^#\s*.*\n/, '').trim()}`;
    }

    existingFiles[fileName] = fileContent;

    const updateData: Record<string, unknown> = {
      generated_files: existingFiles,
      updated_at: new Date().toISOString(),
    };
    if (i === FILE_ORDER.length - 1) {
      updateData.generated_at = new Date().toISOString();
    }

    await supabaseAdmin.from('sessions').update(updateData).eq('id', sessionId);
    await new Promise(r => setTimeout(r, 1500));
  }
}

async function processN8nSync(
  supabaseAdmin: any,
  sessionId: string,
  messages: { role: string; content: string }[],
  aiConfig: AIProviderConfig,
) {
  const provider = createProvider(aiConfig.providerName);
  const prompt = buildN8nPrompt(messages);

  let parsed: { workflow: Record<string, unknown>; setupInstructions?: string } | null = null;
  let lastError = '';

  for (let attempt = 0; attempt < 3; attempt++) {
    let currentPrompt = prompt;
    if (attempt > 0 && lastError) {
      currentPrompt += `\n\nPERBAIKAN (Attempt ${attempt + 1}):\nGenerate sebelumnya memiliki error:\n${lastError}\n\nPerbaiki workflow.`;
    }

    const aiResponse = await provider.generateChat(currentPrompt, aiConfig);

    try {
      const cleaned = aiResponse.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
      const jsonStr = extractJson(cleaned);
      if (!jsonStr) { lastError = 'AI response tidak mengandung JSON valid'; continue; }
      const raw = JSON.parse(jsonStr) as Record<string, unknown>;

      if (raw.workflow && typeof raw.workflow === 'object') {
        const fixed = autoFixWorkflow(raw.workflow as Record<string, unknown>);
        raw.workflow = fixed.workflow;
        const validation = validateN8nWorkflow(JSON.stringify(raw.workflow, null, 2));

        if (validation.valid) {
          parsed = {
            workflow: raw.workflow as Record<string, unknown>,
            setupInstructions: typeof raw.setupInstructions === 'string' ? raw.setupInstructions : '',
          };
          if (fixed.fixes.length > 0) {
            parsed.setupInstructions = (parsed.setupInstructions || '') +
              '\n\n### Catatan Auto-Fix\n' + fixed.fixes.map(f => `- ${f}`).join('\n');
          }
          break;
        } else {
          lastError = 'Workflow tidak valid: ' + validation.errors.join('; ');
        }
      } else {
        lastError = 'Response tidak memiliki field "workflow"';
      }
    } catch (e) {
      lastError = 'Gagal parse JSON: ' + (e instanceof Error ? e.message : String(e));
    }
  }

  if (!parsed) {
    throw new Error(`Gagal generate n8n workflow setelah 3 percobaan. ${lastError ? 'Error: ' + lastError : ''}`);
  }

  const updateData: Record<string, unknown> = {
    n8n_workflow: parsed.workflow,
    n8n_generated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (parsed.setupInstructions) {
    updateData.n8n_setup_instructions = parsed.setupInstructions;
  }

  await supabaseAdmin.from('sessions').update(updateData).eq('id', sessionId);
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

  const { sessionId, mode } = await req.json();

  if (!sessionId || !mode) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'sessionId and mode are required' } },
      { status: 400 },
    );
  }

  const { data: session } = await supabase
    .from('sessions')
    .select('user_id')
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

  const aiConfig: AIProviderConfig = {
    providerName: providerConfig?.provider_name || 'gemini',
    apiKey: decryptedKey || '',
    modelName: providerConfig?.model_name || 'gemini-2.5-flash',
    baseUrl: providerConfig?.base_url || undefined,
    maxTokens: 32000,
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

  // Try background function first (production), fallback to sync (local dev)
  const siteUrl = process.env.DEPLOY_URL || process.env.URL || `https://${req.headers.get('host') || 'localhost:8888'}`;
  const fnUrl = `${siteUrl}/.netlify/functions/generate-background`;

  const isDev = process.env.NODE_ENV === 'development' || (!process.env.DEPLOY_URL && !process.env.URL);

  if (!isDev) {
    try {
      const fnRes = await fetch(fnUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, mode }),
        signal: AbortSignal.timeout(5000),
      });

      if (fnRes.ok) {
        return NextResponse.json({ success: true, data: { jobId: sessionId, mode } });
      }
    } catch {
      // Background function unavailable, fall through to sync
    }
  }

  // Synchronous fallback (auto-used in dev, fallback in production)
  try {
    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    if (mode === 'n8n') {
      await processN8nSync(supabaseAdmin, sessionId, messages, aiConfig);
    } else {
      await processSequential(supabaseAdmin, sessionId, messages, aiConfig);
    }

    return NextResponse.json({ success: true, data: { jobId: sessionId, mode } });
  } catch (err) {
    const { code, message } = formatAIError(err);
    return NextResponse.json(
      { success: false, error: { code, message } },
      { status: 500 },
    );
  }
}
