import { NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabaseServerClient';
import { createProvider } from '@/lib/ai/provider.factory';
import { decrypt } from '@/lib/utils/encryption';
import type { AIProviderConfig } from '@/lib/ai/provider.interface';
import { buildN8nPrompt } from '@/lib/utils/n8nPrompt';
import { validateN8nWorkflow } from '@/lib/utils/n8nValidator';
import { formatAIError } from '@/lib/utils/aiErrorHandler';
import { detectModelCapabilities } from '@/lib/utils/modelCapabilities';
import { rateLimitResponse } from '@/lib/utils/rateLimit';

function extractJson(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
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
    if (!connections) {
      connections = {};
    }

    const connectionsObj = connections as Record<string, unknown>;
    const webhookConns = connectionsObj[webhookName] as Array<Array<Record<string, unknown>>> | undefined;
    if (webhookConns && webhookConns.length > 0) {
      const firstTarget = webhookConns[0]?.[0]?.node;
      if (firstTarget) {
        connectionsObj[respondNode.name] = [
          [{ node: firstTarget as string, type: 'main', index: 0 }],
        ];
        webhookConns[0] = [{ node: respondNode.name, type: 'main', index: 0 }];
      }
    }

    workflow.connections = connectionsObj;
    fixes.push('Auto-fix: Menambahkan Respond to Webhook node karena Webhook trigger ditemukan tanpa Respond to Webhook');
  }

  for (const node of nodes) {
    if (!node.id || node.id === '') {
      node.id = generateId();
      fixes.push(`Auto-fix: Mengisi ID kosong untuk node "${node.name}"`);
    }
    if (!node.typeVersion && node.typeVersion !== 0) {
      const typeStr = node.type as string || '';
      if (typeStr.includes('webhook') || typeStr.includes('httpRequest') || typeStr.includes('set')) {
        node.typeVersion = 2;
      } else {
        node.typeVersion = 1;
      }
      fixes.push(`Auto-fix: Mengisi typeVersion untuk node "${node.name}"`);
    }
  }

  return { workflow, fixes };
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

  const limited = rateLimitResponse(`${userData.user.id}:generate`, 6, 10 * 60_000);
  if (limited) return limited;

  const { session_id } = await req.json();

  if (!session_id) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'session_id is required' } },
      { status: 400 },
    );
  }

  const { data: session } = await supabase
    .from('sessions')
    .select('user_id')
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
      { success: false, error: { code: 'AI_CONFIG_MISSING', message: 'API Key AI tidak dikonfigurasi. Silakan tambahkan provider di menu Settings terlebih dahulu.' } },
      { status: 400 },
    );
  }

  try {
    const provider = createProvider(aiConfig.providerName);

    let parsed: { workflow: Record<string, unknown>; setupInstructions?: string } | null = null;
    let lastError = '';
    const MAX_ATTEMPTS = 3;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      let prompt = buildN8nPrompt(messages);

      if (attempt > 0 && lastError) {
        prompt += `\n\nPERBAIKAN (Attempt ${attempt + 1}):\nGenerate sebelumnya memiliki error:\n${lastError}\n\nPerbaiki workflow dan pastikan tidak ada error yang sama.`;
      }

      const aiResponse = await provider.generateChat(prompt, aiConfig);

      try {
        const cleaned = aiResponse.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
        const jsonStr = extractJson(cleaned);
        if (!jsonStr) {
          lastError = 'AI response tidak mengandung JSON valid';
          continue;
        }
        const raw = JSON.parse(jsonStr) as Record<string, unknown>;

        if (raw.workflow && typeof raw.workflow === 'object') {
          const fixed = autoFixWorkflow(raw.workflow as Record<string, unknown>);
          raw.workflow = fixed.workflow;

          const workflowJson = JSON.stringify(raw.workflow, null, 2);
          const validation = validateN8nWorkflow(workflowJson);

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
            if (validation.warnings.length > 0) {
              lastError += ' | Warnings: ' + validation.warnings.join('; ');
            }
          }
        } else {
          lastError = 'Response tidak memiliki field "workflow"';
        }
      } catch (e) {
        lastError = 'Gagal parse JSON: ' + (e instanceof Error ? e.message : String(e));
      }
    }

    if (!parsed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'AI_INVALID_RESPONSE',
            message: `AI gagal menghasilkan workflow yang valid setelah ${MAX_ATTEMPTS} percobaan. ${lastError ? 'Error terakhir: ' + lastError : 'Silakan coba lagi.'}`,
          },
        },
        { status: 500 },
      );
    }

    const updateData: Record<string, unknown> = {
      n8n_workflow: parsed.workflow,
      n8n_generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (parsed.setupInstructions) {
      updateData.n8n_setup_instructions = parsed.setupInstructions;
    }

    const { error: updateError } = await supabase
      .from('sessions')
      .update(updateData)
      .eq('id', session_id)
      .eq('user_id', userData.user.id);

    if (updateError) {
      return NextResponse.json(
        { success: false, error: { code: 'DB_SAVE_FAILED', message: 'Gagal menyimpan workflow. Silakan coba lagi.' } },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          workflow_json: parsed.workflow,
          setup_instructions: parsed.setupInstructions || '',
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
