import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/utils/apiAuth';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export const DELETE = withAuth(async (
  _req,
  { params },
  supabase,
  user,
) => {
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

  if (session.user_id !== user.id) {
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

  // Strategy 1: delete by paths from messages.attachments
  const { data: messages } = await supabase
    .from('messages')
    .select('attachments')
    .eq('session_id', params.id);

  const storagePaths: string[] = [];
  if (messages) {
    for (const msg of messages) {
      if (!msg.attachments || !Array.isArray(msg.attachments)) continue;
      for (const att of msg.attachments) {
        if (att.storagePath) storagePaths.push(att.storagePath);
      }

    }
  }

  if (storagePaths.length > 0) {
    const { error: removeError } = await supabaseAdmin.storage
      .from('chat-attachments')
      .remove(storagePaths);
    if (removeError) {
      console.error('Storage delete by path error:', removeError);
    }
  }

  // Strategy 2: fallback — list & delete all files under session prefix
  const sessionPrefix = `${session.user_id}/${params.id}/`;
  const { data: listed } = await supabaseAdmin.storage
    .from('chat-attachments')
    .list(sessionPrefix);

  if (listed && listed.length > 0) {
    const orphanPaths = listed.map((f) => `${sessionPrefix}${f.name}`);
    const { error: fallbackError } = await supabaseAdmin.storage
      .from('chat-attachments')
      .remove(orphanPaths);
    if (fallbackError) {
      console.error('Storage fallback delete error:', fallbackError);
    }
  }

  const { error } = await supabase
    .from('sessions')
    .delete()
    .eq('id', params.id);

  if (error) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, data: { message: 'Session deleted' } });
});
