import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/utils/apiAuth';

export const PATCH = withAuth(async (_req, _ctx, supabase, user) => {
  await supabase
    .from('profiles')
    .update({ last_activity_at: new Date().toISOString() })
    .eq('id', user.id);

  return NextResponse.json({ ok: true });
});
