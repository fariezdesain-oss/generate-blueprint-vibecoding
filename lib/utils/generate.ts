import { createProvider } from '@/lib/ai/provider.factory';
import type { AIProviderConfig } from '@/lib/ai/provider.interface';
import { buildFilePrompt, FILE_ORDER, buildConsistencyPrompt } from '@/lib/utils/sequentialPrompts';
import { buildN8nPrompt } from '@/lib/utils/n8nPrompt';
import { validateN8nWorkflow } from '@/lib/utils/n8nValidator';

export async function retryAI(
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

export async function processSequential(
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

    let aiResponse = await retryAI(provider, prompt, aiConfig, 3);
    let fileContent = `# ${fileName}\n\n${aiResponse.replace(/^#\s*.*\n/, '').trim()}`;

    const placeholderPatterns = [
      /TODO/i, /TBD/i, /placeholder/i,
      /sesuaikan\s+dengan\s+kebutuhan/i, /ganti\s+dengan/i,
      /ubah\s+sesuai/i, /isi\s+dengan/i,
      /contoh:\s*\w+/i, /misalnya:?\s*\w+/i,
    ];
    if (placeholderPatterns.some(p => p.test(fileContent))) {
      const correctionPrompt = `${prompt}\n\nPERINGATAN: Hasil generate sebelumnya mengandung placeholder. HARAM menggunakan placeholder. Tulis ulang dengan konten SPESIFIK dan LENGKAP.`;
      aiResponse = await retryAI(provider, correctionPrompt, aiConfig, 2);
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

  // Final consistency check against PRD
  const consistencyPrompt = buildConsistencyPrompt(existingFiles);
  if (consistencyPrompt) {
    try {
      const consistencyResponse = await retryAI(provider, consistencyPrompt, aiConfig, 2);
      if (!consistencyResponse.includes('SEMUA KONSISTEN')) {
        const sections = consistencyResponse.split(/\n(?=# .+\.md)/);
        for (const section of sections) {
          const firstNewline = section.indexOf('\n');
          if (firstNewline === -1) continue;
          const header = section.slice(0, firstNewline).trim();
          const content = section.slice(firstNewline + 1).trim();
          const match = header.match(/^# (.+\.md)$/);
          if (match && existingFiles[match[1]] && match[1] !== 'PRD.md') {
            existingFiles[match[1]] = `# ${match[1]}\n\n${content}`;
          }
        }
        await supabaseAdmin.from('sessions').update({ generated_files: existingFiles, updated_at: new Date().toISOString() }).eq('id', sessionId);
      }
    } catch {
      // Consistency check is optional; ignore errors
    }
  }
}

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

export async function processN8nSync(
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
