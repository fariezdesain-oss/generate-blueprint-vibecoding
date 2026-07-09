import { NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabaseServerClient';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { FILE_ORDER, countGeneratedSpecFiles, getNextMissingSpecFile } from '@/lib/utils/sequentialPrompts';

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

  let genProgressMeta: Record<string, unknown> | null = null;
  let cleanFiles: Record<string, unknown> | null = null;

  if (hasDocs) {
    const raw = session.generated_files as Record<string, unknown>;
    const { _progress, ...rest } = raw;
    cleanFiles = rest;
    genProgressMeta = (session.generation_progress as Record<string, unknown>) || (_progress as Record<string, unknown>) || null;
  }

  if (!hasDocs && !hasN8n) {
    return NextResponse.json({
      success: true,
      data: {
        files: null,
        generated_at: null,
        generation_status: session.generation_status || null,
        generation_error: session.generation_error || null,
        generation_progress: genProgressMeta,
        progress: { current: 0, total: FILE_ORDER.length, next_file: FILE_ORDER[0] },
      },
    });
  }

  const result: Record<string, unknown> = {};
  if (hasDocs) {
    const fileCount = countGeneratedSpecFiles(cleanFiles as Record<string, string>);
    const docsStatus = fileCount >= FILE_ORDER.length ? 'completed' : null;
    result.files = cleanFiles;
    result.generated_at = session.generated_at;
    result.generation_status = session.generation_status || docsStatus || null;
    result.generation_error = session.generation_error || null;
    result.generation_progress = genProgressMeta;
    result.progress = {
      current: fileCount,
      total: FILE_ORDER.length,
      next_file: getNextMissingSpecFile(cleanFiles as Record<string, string>),
    };
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
      generation_progress: null,
      generation_status: null,
      generation_error: null,
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
