import { createProvider } from '@/lib/ai/provider.factory';
import type { AIProvider, AIProviderConfig } from '@/lib/ai/provider.interface';
import { buildFilePrompt, FILE_ORDER, FILE_LABELS, buildConsistencyPrompt, countGeneratedSpecFiles } from '@/lib/utils/sequentialPrompts';
import { buildN8nPrompt } from '@/lib/utils/n8nPrompt';
import { validateN8nWorkflow } from '@/lib/utils/n8nValidator';
import type { ProviderFallbackCandidate } from '@/lib/utils/providerFallback';
import { isFallbackableAIError } from '@/lib/utils/providerFallback';
import { updateSessionWithRetry } from '@/lib/utils/generationDb';
import { hasPlaceholder } from '@/lib/utils/docQuality';
import { autoFixWorkflow, extractJson } from '@/lib/utils/workflowJson';
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
  supabase: SupabaseClient,
  sessionId: string,
  userId: string,
  progress: GenerationProgress,
) {
  try {
    const { error } = await supabase
      .from('sessions')
      .update({ generation_progress: progress, updated_at: new Date().toISOString() })
      .eq('id', sessionId)
      .eq('user_id', userId);

    if (!error) return;

    // ponytail: legacy fallback until all deployed DBs have generation_progress.
    const { data: session } = await supabase
      .from('sessions')
      .select('generated_files')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();
    const files = (session?.generated_files as Record<string, unknown>) || {};
    files._progress = progress;
    await supabase
      .from('sessions')
      .update({ generated_files: files, updated_at: new Date().toISOString() })
      .eq('id', sessionId)
      .eq('user_id', userId);
  } catch {
    // kolom mungkin belum ada — aman diabaikan
  }
}

function getPreviewLimit(config: AIProviderConfig): number {
  if (typeof config.previewLimit === 'number') return config.previewLimit;
  if (config.contextLevel === 'low') return 900;
  if (config.contextLevel === 'medium') return 1600;
  return 3000;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timeout after ${ms / 1000}s: ${label}`)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer!));
}

export async function retryAI(
  provider: AIProvider,
  prompt: string,
  _config: AIProviderConfig,
  maxAttempts: number = _config.retryCount || 3,
  timeoutMs: number = _config.timeoutMs || 120000,
  onChunk?: (_chunk: string, _total: string) => void,
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      if (typeof provider.streamChat === 'function') {
        let fullResponse = '';
        let timer: ReturnType<typeof setTimeout> | null = null;
        let isDone = false;

        const streamPromise = (async () => {
          try {
            const gen = provider.streamChat(prompt, _config);
            for await (const token of gen) {
              if (timer) clearTimeout(timer); // reset idle timer on chunk
              fullResponse += token;
              if (onChunk) onChunk(token, fullResponse);
              timer = setTimeout(() => {
                if (!isDone) throw new Error(`Timeout after ${timeoutMs / 1000}s idle stream: AI streamChat`);
              }, timeoutMs);
            }
          } finally {
            isDone = true;
            if (timer) clearTimeout(timer);
          }
        })();

        // Start initial timer
        timer = setTimeout(() => {
          if (!isDone) throw new Error(`Timeout after ${timeoutMs / 1000}s idle stream: AI streamChat`);
        }, timeoutMs);

        await streamPromise;

        if (!fullResponse.trim()) throw new Error('AI empty response');
        return fullResponse;
      } else {
        const rawResponse = await withTimeout(provider.generateChat(prompt, _config), timeoutMs, 'AI generateChat');
        const response = String(rawResponse || '');
        if (!response.trim()) throw new Error('AI empty response');
        return response;
      }
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
  onChunk?: (_chunk: string, _total: string) => void,
): Promise<{ response: string; config: AIProviderConfig; usedFallback: boolean }> {
  let lastError: unknown;

  for (const candidate of candidates) {
    const provider = createProvider(candidate.config.providerName);
    const prompt = buildPromptForConfig(candidate.config);

    try {
      const response = await retryAI(
        provider,
        prompt,
        candidate.config,
        maxAttemptsOverride ?? candidate.config.retryCount ?? 3,
        undefined,
        onChunk
      );
      return { response, config: candidate.config, usedFallback: !candidate.isPrimary };
    } catch (err) {
      lastError = err;
      if (!isFallbackableAIError(err)) throw err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('AI generation failed on all providers');
}

export async function processSequential(
  supabase: SupabaseClient,
  sessionId: string,
  userId: string,
  messages: { role: string; content: string }[],
  aiConfig: AIProviderConfig,
  fallbackCandidates?: ProviderFallbackCandidate[],
  maxFiles: number = Number.POSITIVE_INFINITY,
): Promise<{ completed: boolean; generatedCount: number; totalFiles: number; nextFile: string }> {
  const { data: session } = await supabase
    .from('sessions')
    .select('generated_files, project_state, rolling_summary')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single();

  let existingFiles = (session?.generated_files as Record<string, string>) || {};
  const candidates = fallbackCandidates && fallbackCandidates.length > 0
    ? fallbackCandidates
    : [{ id: 'primary', config: aiConfig, isPrimary: true }];

  const pushProgress = async (i: number, fileName: string, progress: number, stage: GenerationProgress['stage'], message: string) => {
    await updateGenerationProgress(supabase, sessionId, userId, {
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
      const previewLimit = countGeneratedSpecFiles(existingFiles) > 2 ? getPreviewLimit(config) : 0;
      return buildFilePrompt(
        i,
        messages,
        existingFiles,
        previewLimit,
        config.contextLevel || 'high',
        session?.project_state as Record<string, unknown>,
        session?.rolling_summary as string,
      );
    };

    await pushProgress(i, fileName, 25, 'generating', `Menulis ${fileLabel}...`);
    let lastProgressUpdate = Date.now();
    let result = await generateWithProviderFallback(candidates, buildPromptForConfig, undefined, (chunk, total) => {
      // Throttle DB updates during stream to avoid overwhelming Supabase
      if (Date.now() - lastProgressUpdate > 3000) {
        lastProgressUpdate = Date.now();
        // Estimated completion percentage based on typical doc sizes
        const estTotal = 4000;
        const subProgress = Math.min(40, Math.round((total.length / estTotal) * 40));
        pushProgress(i, fileName, 25 + subProgress, 'generating', `Menulis ${fileLabel}... (${total.length} chars)`);
      }
    });
    let aiResponse = result.response;
    let fileContent = `# ${fileName}\n\n${aiResponse.replace(/^#\s*.*\n/, '').trim()}`;

    await pushProgress(i, fileName, 70, 'generating', `Memeriksa kualitas ${fileLabel}...`);
    if (hasPlaceholder(fileContent)) {
      await pushProgress(i, fileName, 80, 'fixing_placeholders', `Memperbaiki placeholder di ${fileLabel}...`);
      const correctionPrompt = `${buildPromptForConfig(result.config)}\n\nPERINGATAN: Hasil generate sebelumnya mengandung placeholder. HARAM menggunakan placeholder. Tulis ulang dengan konten SPESIFIK dan LENGKAP.`;
      result = await generateWithProviderFallback(candidates, () => correctionPrompt, 2);
      aiResponse = result.response;
      fileContent = `# ${fileName}\n\n${aiResponse.replace(/^#\s*.*\n/, '').trim()}`;
    }

    await pushProgress(i, fileName, 95, 'saving', `Menyimpan ${fileLabel}...`);
    const { data: latestSession } = await supabase
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
    await updateSessionWithRetry(supabase, sessionId, userId, updateData);
    generatedThisRun++;
    await new Promise(r => setTimeout(r, 300));
  }

  const generatedCount = countGeneratedSpecFiles(existingFiles);
  const nextFile = FILE_ORDER.find((name) => !existingFiles[name] || existingFiles[name].trim().length === 0) || '';

  if (generatedCount < FILE_ORDER.length) {
    await updateGenerationProgress(supabase, sessionId, userId, {
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
  await updateGenerationProgress(supabase, sessionId, userId, {
    currentFileIndex: FILE_ORDER.length - 1,
    currentFileName: FILE_ORDER[FILE_ORDER.length - 1],
    currentFileProgress: 100,
    overallProgress: 95,
    stage: 'consistency_check',
    message: 'Final consistency check...',
  });

  const { data: latestBeforeConsistency } = await supabase
    .from('sessions')
    .select('generated_files')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single();
  existingFiles = (latestBeforeConsistency?.generated_files as Record<string, string>) || existingFiles;

  const consistencyPrompt = aiConfig.consistencyMode === 'light' ? '' : buildConsistencyPrompt(existingFiles);
  if (consistencyPrompt) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const consistencyResponse = (await generateWithProviderFallback(candidates, () => consistencyPrompt, 2)).response;
        if (consistencyResponse.includes('SEMUA KONSISTEN')) break;

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

        if (repairedCount > 0) {
          await updateSessionWithRetry(supabase, sessionId, userId, { generated_files: existingFiles, updated_at: new Date().toISOString() });
        }
        break;
      } catch {
        if (attempt === 0) continue;
      }
    }
  }

  await updateGenerationProgress(supabase, sessionId, userId, {
    currentFileIndex: FILE_ORDER.length - 1,
    currentFileName: FILE_ORDER[FILE_ORDER.length - 1],
    currentFileProgress: 100,
    overallProgress: 100,
    stage: 'done',
    message: 'Selesai',
  });

  await updateSessionWithRetry(supabase, sessionId, userId, { generated_at: new Date().toISOString(), updated_at: new Date().toISOString() });

  return { completed: true, generatedCount: FILE_ORDER.length, totalFiles: FILE_ORDER.length, nextFile: '' };
}

export async function processN8nSync(
  supabase: SupabaseClient,
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

  await supabase.from('sessions').update(updateData).eq('id', sessionId).eq('user_id', userId);
}
