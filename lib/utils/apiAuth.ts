import { NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabaseServerClient';
import { createAdminClient } from '@/lib/db/supabaseAdminClient';
import type { SupabaseClient, User } from '@supabase/supabase-js';

type RouteContext = { params: Record<string, string> };

type AuthenticatedApiHandler = (
  _req: Request,
  _context: RouteContext,
  _supabase: SupabaseClient,
  _user: User
) => Promise<Response>;

export function withAuth(handler: AuthenticatedApiHandler) {
  return async function (req: Request, context: RouteContext) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'AUTH_UNAUTHORIZED', message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    const adminClient = createAdminClient();
    const { data: profile } = await adminClient
      .from('profiles')
      .select('last_activity_at')
      .eq('id', user.id)
      .single();

    const THIRTY_MIN_MS = 30 * 60 * 1000;
    const lastActivity = profile?.last_activity_at
      ? new Date(profile.last_activity_at as string).getTime()
      : Date.now(); // Jika null, anggap baru aktif (mencegah user baru ter-kick)

    // Ignore inactivity check on the heartbeat endpoint itself to avoid infinite loops or deadlocks on session resume.
    const isActivityRoute = req.url.includes('/api/auth/activity');

    if (!isActivityRoute && Date.now() - lastActivity > THIRTY_MIN_MS) {
      await adminClient.auth.admin.signOut(user.id);
      return NextResponse.json(
        { success: false, error: { code: 'AUTH_SESSION_EXPIRED', message: 'Sesi telah berakhir karena tidak ada aktivitas selama 30 menit.' } },
        { status: 401 }
      );
    }

    return handler(req, context, supabase, user);
  };
}

// ponytail: Reusable ownership check.
export async function checkOwnership(
    supabase: SupabaseClient,
    user: User,
    tableName: string,
    recordId: string
): Promise<{ notFound: boolean, forbidden: boolean }> {
    const { data, error } = await supabase
        .from(tableName)
        .select('user_id')
        .eq('id', recordId)
        .single();

    if (error || !data) {
        return { notFound: true, forbidden: false };
    }

    if (data.user_id !== user.id) {
        return { notFound: false, forbidden: true };
    }

    return { notFound: false, forbidden: false };
}
