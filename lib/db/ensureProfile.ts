import type { SupabaseClient } from '@supabase/supabase-js';

export const ensureProfile = async (supabase: SupabaseClient, user: { id: string; email?: string }) => {
  await supabase
    .from('profiles')
    .upsert({ id: user.id, email: user.email || '' }, { onConflict: 'id' });
};
