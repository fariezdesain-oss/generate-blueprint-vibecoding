export const ensureProfile = async (supabase: any, user: { id: string; email?: string }) => {
  await supabase
    .from('profiles')
    .upsert({ id: user.id, email: user.email || '' }, { onConflict: 'id' });
};
