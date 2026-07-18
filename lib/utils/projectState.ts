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

export function buildProjectStatePrompt(currentState: ProjectState, latestContent: string): string {
  return `Anda adalah ekstraktor requirement proyek. WAJIB gunakan Bahasa Indonesia.

Tugas Anda: baca pesan terbaru, lalu keluarkan JSON diff untuk memperbarui Project State.

Aturan:
- Balas hanya JSON valid, tanpa markdown.
- jangan hapus informasi lama.
- Jangan mengarang hal yang tidak tertulis.
- Jika pesan tidak menambah informasi proyek, balas {}.
- Gunakan kategori yang jelas seperti nama_proyek, deskripsi, target_pengguna, fitur, tech_stack, database_schema, api_endpoints, ui_design, alur_pengguna, constraint, catatan_tambahan.

PROJECT STATE SAAT INI:
${JSON.stringify(currentState || {}, null, 2)}

PESAN TERBARU:
${latestContent}`;
}

export function shouldBuildRollingSummary(messageCount: number): boolean {
  return messageCount > 0 && messageCount % 20 === 0;
}

function extractJsonObject(text: string): ProjectState {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return {};

  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return isPlainObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export async function updateProjectState(
  supabase: SupabaseClient,
  sessionId: string,
  aiConfig: AIProviderConfig,
  latestContent: string,
): Promise<void> {
  const { data: session } = await supabase
    .from('sessions')
    .select('project_state')
    .eq('id', sessionId)
    .single();

  const currentState = isProjectStateUseful(session?.project_state) ? session.project_state : {};
  const provider = createProvider(aiConfig.providerName);
  const response = await provider.generateChat(buildProjectStatePrompt(currentState, latestContent), aiConfig);
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
