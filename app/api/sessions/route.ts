import { NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabaseServerClient';
import { ensureProfile } from '@/lib/db/ensureProfile';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export async function GET() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_UNAUTHORIZED', message: 'Unauthorized' } },
      { status: 401 },
    );
  }

  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userData.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: error.message } },
      { status: 500 },
    );
  }

  const sessions = data.map((s) => ({
    id: s.id,
    title: s.title,
    mode: s.mode || 'docs',
    created_at: s.created_at,
    updated_at: s.updated_at,
    has_generated: !!s.generated_files,
    has_n8n: !!(s.n8n_workflow && Object.keys(s.n8n_workflow || {}).length > 0),
  }));

  return NextResponse.json({ success: true, data: { sessions } });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_UNAUTHORIZED', message: 'Unauthorized' } },
      { status: 401 },
    );
  }

  await ensureProfile(supabase, userData.user);

  const { title, mode } = await req.json();

  if (!title || typeof title !== 'string') {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Title is required' } },
      { status: 400 },
    );
  }

  const safeMode = mode === 'n8n' ? 'n8n' : 'docs';

  const { data, error } = await supabase
    .from('sessions')
    .insert({ user_id: userData.user.id, title, mode: safeMode })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, data: { session: data } }, { status: 201 });
}

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  // Verifikasi auth dulu
  if (!userData.user) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_UNAUTHORIZED', message: 'Unauthorized' } },
      { status: 401 },
    );
  }

  const { session_id, title } = await req.json();

  if (!session_id || !title) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'session_id and title are required' } },
      { status: 400 },
    );
  }

  // Bypass RLS via service role key (RLS tidak punya UPDATE policy untuk sessions)
  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );

  const { data: updated, error } = await supabaseAdmin
    .from('sessions')
    .update({ title, updated_at: new Date().toISOString() })
    .eq('id', session_id)
    .eq('user_id', userData.user.id)
    .select('id, title');

  if (error) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: error.message } },
      { status: 500 },
    );
  }

  if (!updated || updated.length === 0) {
    return NextResponse.json(
      { success: false, error: { code: 'SESSION_NOT_FOUND', message: 'Session not found or access denied' } },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true, data: { session: updated[0] } });
}
