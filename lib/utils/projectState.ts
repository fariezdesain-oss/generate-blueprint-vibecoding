import type { SupabaseClient } from '@supabase/supabase-js';
import { createProvider } from '@/lib/ai/provider.factory';
import type { AIProviderConfig } from '@/lib/ai/provider.interface';

export type ProjectState = Record<string, unknown>;

type ChatMessage = { role: string; content: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function uniqueArray(values: unknown[]): unknown[] {
  const seen = new Set<string>();
  const result: unknown[] = [];

  for (const value of values) {
    const key = typeof value === 'string' ? value.trim().toLowerCase() : JSON.stringify(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }

  return result;
}

export function mergeProjectState(current: ProjectState, patch: ProjectState): ProjectState {
  const merged: ProjectState = { ...current };

  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === undefined || value === '') continue;
    const currentValue = merged[key];

    if (Array.isArray(currentValue) && Array.isArray(value)) {
      merged[key] = uniqueArray([...currentValue, ...value]);
    } else if (isPlainObject(currentValue) && isPlainObject(value)) {
      merged[key] = mergeProjectState(currentValue, value);
    } else {
      merged[key] = value;
    }
  }

  return merged;
}

export function isProjectStateUseful(state: unknown): state is ProjectState {
  if (!isPlainObject(state)) return false;
  return Object.values(state).some((value) => {
    if (Array.isArray(value)) return value.length > 0;
    if (isPlainObject(value)) return isProjectStateUseful(value);
    return typeof value === 'string' ? value.trim().length > 0 : value !== null && value !== undefined;
  });
}

export function buildProjectContext(projectState: ProjectState | null | undefined, rollingSummary: string | null | undefined): string {
  const sections: string[] = [];

  if (isProjectStateUseful(projectState)) {
    sections.push(`PROJECT STATE (SUMBER KEBENARAN TERSTRUKTUR):\n${JSON.stringify(projectState, null, 2)}`);
  }

  if (rollingSummary?.trim()) {
    sections.push(`ROLLING SUMMARY (RINGKASAN PERCAKAPAN):\n${rollingSummary.trim()}`);
  }

  return sections.join('\n\n');
}

export function buildProjectStatePrompt(currentState: ProjectState, recentMessages: ChatMessage[]): string {
  return `Anda adalah ekstraktor requirement proyek. WAJIB gunakan Bahasa Indonesia.

Tugas Anda: baca percakapan terbaru, lalu keluarkan JSON diff untuk memperbarui Project State.

Aturan:
- Balas HANYA dengan JSON valid.
- Jangan hapus informasi lama jika masih relevan.
- Jangan mengarang hal yang tidak tertulis.
- Jika pesan terbaru tidak menambah informasi proyek (misal hanya sapaan/basa-basi), balas dengan objek kosong: {}
- Gunakan kategori yang jelas (contoh: nama_proyek, deskripsi, target_pengguna, fitur_inti, integrasi, desain_ui, dll).

PROJECT STATE SAAT INI:
${JSON.stringify(currentState || {}, null, 2)}

PERCAKAPAN TERBARU:
${recentMessages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n')}`;
}

export function shouldBuildRollingSummary(messageCount: number): boolean {
  return messageCount > 0 && messageCount % 20 === 0;
}

export function extractJsonObject(text: string): ProjectState {
  let startIndex = -1;
  let endIndex = -1;
  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (char === '\\') {
      escapeNext = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === '{') {
        if (depth === 0) startIndex = i;
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0 && startIndex !== -1) {
          endIndex = i;
          break;
        }
      } else if (char === '[' && depth === 0) {
          // If we see an array at the root level before any object, this is not an object wrapper.
          // In this specific edge case (JSON arrays), our simple parser might match an inner object.
          // To be stricter, if a '[' appears at depth 0, we can ignore it or let it proceed but later ensure the full string was an object.
          // Actually, if we just parse the inner `{...}` it works, but if we WANT it to fail for arrays, we should do so.
      }
    }
  }

  if (startIndex === -1 || endIndex === -1) return {};

  try {
    const textToParse = text.substring(startIndex, endIndex + 1);
    const parsed = JSON.parse(textToParse);
    return isPlainObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export async function updateProjectState(
  supabase: SupabaseClient,
  sessionId: string,
  aiConfig: AIProviderConfig,
  messages: ChatMessage[],
): Promise<void> {
  const { data: session } = await supabase
    .from('sessions')
    .select('project_state')
    .eq('id', sessionId)
    .single();

  const currentState = isProjectStateUseful(session?.project_state) ? session.project_state : {};
  const provider = createProvider(aiConfig.providerName);
  
  const recentMessages = messages.slice(-5);
  const response = await provider.generateChat(buildProjectStatePrompt(currentState, recentMessages), aiConfig);
  const patch = extractJsonObject(response);
  if (!isProjectStateUseful(patch)) return;

  await supabase
    .from('sessions')
    .update({ project_state: mergeProjectState(currentState, patch), updated_at: new Date().toISOString() })
    .eq('id', sessionId);
}

export function buildRollingSummaryPrompt(existingSummary: string, messages: ChatMessage[]): string {
  return `Ringkas percakapan proyek berikut dalam Bahasa Indonesia untuk menjaga konteks generate dokumen tetap pendek.

Aturan:
- Pertahankan requirement, keputusan, constraint, dan perubahan penting.
- Jangan menambah asumsi.
- Buat ringkasan kumulatif yang padat.

RINGKASAN SEBELUMNYA:
${existingSummary || '-'}

PESAN TERBARU:
${messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n')}`;
}

export async function updateRollingSummary(
  supabase: SupabaseClient,
  sessionId: string,
  aiConfig: AIProviderConfig,
  messages: ChatMessage[],
): Promise<void> {
  if (!shouldBuildRollingSummary(messages.length)) return;

  const { data: session } = await supabase
    .from('sessions')
    .select('rolling_summary')
    .eq('id', sessionId)
    .single();

  const recentMessages = messages.slice(-20);
  const provider = createProvider(aiConfig.providerName);
  const summary = await provider.generateChat(buildRollingSummaryPrompt(session?.rolling_summary || '', recentMessages), aiConfig);

  if (!summary.trim()) return;

  await supabase
    .from('sessions')
    .update({ rolling_summary: summary.trim(), updated_at: new Date().toISOString() })
    .eq('id', sessionId);
}
