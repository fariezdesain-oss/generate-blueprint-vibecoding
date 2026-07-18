import type { SupabaseClient } from '@supabase/supabase-js';

export async function updateSessionWithRetry(
  supabase: SupabaseClient,
  sessionId: string,
  userId: string,
  updateData: Record<string, unknown>,
): Promise<void> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    const { error } = await supabase
      .from('sessions')
      .update(updateData)
      .eq('id', sessionId)
      .eq('user_id', userId);

    if (!error) return;
    lastError = error;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw lastError instanceof Error ? lastError : new Error('Failed to update session');
}
