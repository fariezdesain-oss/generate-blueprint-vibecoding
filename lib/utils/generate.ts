import { createProvider } from '@/lib/ai/provider.factory';
import type { AIProviderConfig } from '@/lib/ai/provider.interface';
import { buildFilePrompt, FILE_ORDER, FILE_LABELS, buildConsistencyPrompt, countGeneratedSpecFiles } from '@/lib/utils/sequentialPrompts';
import { buildN8nPrompt } from '@/lib/utils/n8nPrompt';
import { validateN8nWorkflow } from '@/lib/utils/n8nValidator';
import type { ProviderFallbackCandidate } from '@/lib/utils/providerFallback';
import { isFallbackableAIError } from '@/lib/utils/providerFallback';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface GenerationProgress {
  currentFileIndex: number;
  currentFileName: string;
  currentFileProgress: number;
  overallProgress: number;
  stage: 'preparing' | 'generating' | 'fixing_placeholders' | 'saving' | 'consistency_check' | 'done';
  message: string;
}

async function updateGenerationProgress(
  supabaseAdmin: SupabaseClient,
  sessionId: string,
  userId: string,
  progress: GenerationProgress,
) {
  try {
    const { error } = await supabaseAdmin
      .from('sessions')
      .update({ generation_progress: progress, updated_at: new Date().toISOString() })
      .eq('id', sessionId)
      .eq('user_id', userId);

    if (!error) return;

    // ponytail: legacy fallback until all deployed DBs have generation_progress.
    const { data: session } = await supabaseAdmin
      .from('sessions')
      .select('generated_files')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();
    const files = (session?.generated_files as Record<string, unknown>) || {};
    files._progress = progress;
    await supabaseAdmin
      .from('sessions')
      .update({ generated_files: files, updated_at: new Date().toISOString() })
      .eq('id', sessionId)
      .eq('user_id', userId);
  } catch {
    // kolom mungkin belum ada — aman diabaikan
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timeout after ${ms / 1000}s: ${label}`)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer!));
}

export async function retryAI(
  provider: any,
  prompt: string,
  _config: AIProviderConfig,
  maxAttempts: number = _config.retryCount || 3,
  timeoutMs: number = _config.timeoutMs || 120000,
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const rawResponse = await withTimeout(provider.generateChat(prompt, _config), _config.timeoutMs || timeoutMs, 'AI generateChat');
      const response = String(rawResponse || '');
      if (!response.trim()) throw new Error('AI empty response');
      return response;
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

export async function generateWithProviderFallback(
  candidates: ProviderFallbackCandidate[],
  buildPromptForConfig: (_config: AIProviderConfig) => string,
  maxAttemptsOverride?: number,
): Promise<{ response: string; config: AIProviderConfig; usedFallback: boolean }> {
  let lastError: unknown;

  for (const candidate of candidates) {
    const provider = createProvider(candidate.config.providerName);
    const prompt = buildPromptForConfig(candidate.config);

    try {
      const response = await retryAI(provider, prompt, candidate.config, maxAttemptsOverride ?? candidate.config.retryCount ?? 3);
      return { response, config: candidate.config, usedFallback: !candidate.isPrimary };
    } catch (err) {
      lastError = err;
      if (!isFallbackableAIError(err)) throw err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('AI generation failed on all providers');
}

export async function processSequential(
  supabaseAdmin: SupabaseClient,
  sessionId: string,
  userId: string,
  messages: { role: string; content: string }[],
  aiConfig: AIProviderConfig,
  fallbackCandidates?: ProviderFallbackCandidate[],
  maxFiles: number = Number.POSITIVE_INFINITY,
): Promise<{ completed: boolean; generatedCount: number; totalFiles: number; nextFile: string }> {
  const { data: session } = await supabaseAdmin
    .from('sessions')
    .select('generated_files')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single();

  let existingFiles = (session?.generated_files as Record<string, string>) || {};
  const candidates = fallbackCandidates && fallbackCandidates.length > 0
    ? fallbackCandidates
    : [{ id: 'primary', config: aiConfig, isPrimary: true }];

  const pushProgress = async (i: number, fileName: string, progress: number, stage: GenerationProgress['stage'], message: string) => {
    await updateGenerationProgress(supabaseAdmin, sessionId, userId, {
      currentFileIndex: i,
      currentFileName: fileName,
      currentFileProgress: progress,
      overallProgress: Math.round(((i + progress / 100) / FILE_ORDER.length) * 100),
      stage,
      message,
    });
  };

  let generatedThisRun = 0;

  for (let i = 0; i < FILE_ORDER.length; i++) {
    const fileName = FILE_ORDER[i];
    if (existingFiles[fileName]) continue;
    if (generatedThisRun >= maxFiles) break;

    const fileLabel = FILE_LABELS[fileName] || fileName;

    await pushProgress(i, fileName, 0, 'preparing', `Menganalisis konteks untuk ${fileLabel}...`);
    const buildPromptForConfig = (config: AIProviderConfig) => {
      const previewLimit = countGeneratedSpecFiles(existingFiles) > 2 ? (config.previewLimit ?? 2000) : 0;
      return buildFilePrompt(i, messages, existingFiles, previewLimit, config.contextLevel || 'high');
    };

    await pushProgress(i, fileName, 25, 'generating', `Menulis ${fileLabel}...`);
    let result = await generateWithProviderFallback(candidates, buildPromptForConfig);
    let aiResponse = result.response;
    let fileContent = `# ${fileName}\n\n${aiResponse.replace(/^#\s*.*\n/, '').trim()}`;

    await pushProgress(i, fileName, 70, 'generating', `Memeriksa kualitas ${fileLabel}...`);
    const placeholderPatterns = [
      /TODO/i, /TBD/i, /placeholder/i,
      /sesuaikan\s+dengan\s+kebutuhan/i, /ganti\s+dengan/i,
      /ubah\s+sesuai/i, /isi\s+dengan/i,
      /contoh:\s*\w+/i, /misalnya:?\s*\w+/i,
    ];
    if (placeholderPatterns.some(p => p.test(fileContent))) {
      await pushProgress(i, fileName, 80, 'fixing_placeholders', `Memperbaiki placeholder di ${fileLabel}...`);
      const correctionPrompt = `${buildPromptForConfig(result.config)}\n\nPERINGATAN: Hasil generate sebelumnya mengandung placeholder. HARAM menggunakan placeholder. Tulis ulang dengan konten SPESIFIK dan LENGKAP.`;
      result = await generateWithProviderFallback(candidates, () => correctionPrompt, 2);
      aiResponse = result.response;
      fileContent = `# ${fileName}\n\n${aiResponse.replace(/^#\s*.*\n/, '').trim()}`;
    }

    await pushProgress(i, fileName, 95, 'saving', `Menyimpan ${fileLabel}...`);
    const { data: latestSession } = await supabaseAdmin
      .from('sessions')
      .select('generated_files')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();

    const latestFiles = (latestSession?.generated_files as Record<string, string>) || {};
    if (latestFiles[fileName]) {
      existingFiles = latestFiles;
      continue;
    }

    existingFiles = { ...latestFiles, [fileName]: fileContent };

    const updateData: Record<string, unknown> = {
      generated_files: existingFiles,
      updated_at: new Date().toISOString(),
    };
    await supabaseAdmin.from('sessions').update(updateData).eq('id', sessionId).eq('user_id', userId);
    generatedThisRun++;
    await new Promise(r => setTimeout(r, 300));
  }

  const generatedCount = countGeneratedSpecFiles(existingFiles);
  const nextFile = FILE_ORDER.find((name) => !existingFiles[name] || existingFiles[name].trim().length === 0) || '';

  if (generatedCount < FILE_ORDER.length) {
    await updateGenerationProgress(supabaseAdmin, sessionId, userId, {
      currentFileIndex: Math.max(0, generatedCount - 1),
      currentFileName: nextFile,
      currentFileProgress: 0,
      overallProgress: Math.round((generatedCount / FILE_ORDER.length) * 100),
      stage: 'preparing',
      message: `${generatedCount}/${FILE_ORDER.length} dokumen selesai. Lanjut ke ${nextFile}.`,
    });

    return { completed: false, generatedCount, totalFiles: FILE_ORDER.length, nextFile };
  }

  // Final consistency check against PRD
  await updateGenerationProgress(supabaseAdmin, sessionId, userId, {
    currentFileIndex: FILE_ORDER.length - 1,
    currentFileName: FILE_ORDER[FILE_ORDER.length - 1],
    currentFileProgress: 100,
    overallProgress: 95,
    stage: 'consistency_check',
    message: 'Final consistency check...',
  });

  const { data: latestBeforeConsistency } = await supabaseAdmin
    .from('sessions')
    .select('generated_files')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single();
  existingFiles = (latestBeforeConsistency?.generated_files as Record<string, string>) || existingFiles;

  const consistencyPrompt = aiConfig.consistencyMode === 'light' ? '' : buildConsistencyPrompt(existingFiles);
  if (consistencyPrompt) {
    try {
      const consistencyResponse = (await generateWithProviderFallback(candidates, () => consistencyPrompt, 2)).response;
      if (!consistencyResponse.includes('SEMUA KONSISTEN')) {
        const sections = consistencyResponse.split(/\n(?=# .+\.md)/);
        let repairedCount = 0;
        for (const section of sections) {
          const firstNewline = section.indexOf('\n');
          if (firstNewline === -1) continue;
          const header = section.slice(0, firstNewline).trim();
          const content = section.slice(firstNewline + 1).trim();
          const match = header.match(/^# (.+\.md)$/);
          if (match && existingFiles[match[1]] && match[1] !== '01_PRD.md') {
            existingFiles[match[1]] = `# ${match[1]}\n\n${content}`;
            repairedCount++;
          }
        }
        if (repairedCount === 0) {
          throw new Error('Consistency check did not return valid document repairs');
        }
        await supabaseAdmin.from('sessions').update({ generated_files: existingFiles, updated_at: new Date().toISOString() }).eq('id', sessionId).eq('user_id', userId);
      }
    } catch (err) {
      throw err;
    }
  }

  await updateGenerationProgress(supabaseAdmin, sessionId, userId, {
    currentFileIndex: FILE_ORDER.length - 1,
    currentFileName: FILE_ORDER[FILE_ORDER.length - 1],
    currentFileProgress: 100,
    overallProgress: 100,
    stage: 'done',
    message: 'Selesai',
  });

  await supabaseAdmin
    .from('sessions')
    .update({ generated_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('user_id', userId);

  return { completed: true, generatedCount: FILE_ORDER.length, totalFiles: FILE_ORDER.length, nextFile: '' };
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
  supabaseAdmin: SupabaseClient,
  sessionId: string,
  userId: string,
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

  await supabaseAdmin.from('sessions').update(updateData).eq('id', sessionId).eq('user_id', userId);
}
