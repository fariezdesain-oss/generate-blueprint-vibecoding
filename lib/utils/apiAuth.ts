import { NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabaseServerClient';
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
