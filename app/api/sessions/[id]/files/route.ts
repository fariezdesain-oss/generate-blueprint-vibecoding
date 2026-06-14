import { NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabaseServerClient';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_UNAUTHORIZED', message: 'Unauthorized' } },
      { status: 401 },
    );
  }

  const { data: session, error: selectError } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', params.id)
    .single();

  if (selectError || !session) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_GENERATED', message: 'No generated files' } },
      { status: 404 },
    );
  }

  if (session.user_id !== userData.user.id) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_FORBIDDEN', message: 'Forbidden' } },
      { status: 403 },
    );
  }

  const n8nWorkflow = session.n8n_workflow as Record<string, unknown> | null | undefined;
  const hasN8n = !!n8nWorkflow && typeof n8nWorkflow === 'object' && Object.keys(n8nWorkflow).length > 0;
  const hasDocs = !!session.generated_files && typeof session.generated_files === 'object';

  if (!hasDocs && !hasN8n) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_GENERATED', message: 'No generated files for this session' } },
      { status: 404 },
    );
  }

  const result: Record<string, unknown> = {};
  if (hasDocs) {
    result.files = session.generated_files;
    result.generated_at = session.generated_at;
  }
  if (hasN8n) {
    result.n8n_workflow = n8nWorkflow;
    result.n8n_generated_at = session.n8n_generated_at;
    result.setup_instructions = session.n8n_setup_instructions || '';
  }

  return NextResponse.json({
    success: true,
    data: result,
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_UNAUTHORIZED', message: 'Unauthorized' } },
      { status: 401 },
    );
  }

  const { data: session } = await supabase
    .from('sessions')
    .select('user_id')
    .eq('id', params.id)
    .single();

  if (!session) {
    return NextResponse.json(
      { success: false, error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' } },
      { status: 404 },
    );
  }

  if (session.user_id !== userData.user.id) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_FORBIDDEN', message: 'Forbidden' } },
      { status: 403 },
    );
  }

  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { error: updateError } = await supabaseAdmin
    .from('sessions')
    .update({
      generated_files: null,
      generated_at: null,
      n8n_workflow: null,
      n8n_template_name: null,
      n8n_generated_at: null,
      n8n_setup_instructions: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .eq('user_id', userData.user.id);

  if (updateError) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: updateError.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
