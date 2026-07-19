import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/utils/apiAuth';

export const POST = withAuth(async (req, _context, supabase, user) => {
  const { sessionId } = await req.json();

  if (!sessionId) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'sessionId is required' } },
      { status: 400 },
    );
  }

  const { data: session } = await supabase
    .from('sessions')
    .select('id, user_id')
    .eq('id', sessionId)
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

  const { error } = await supabase
    .from('sessions')
    .update({
      generation_status: 'cancelled',
      generation_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json(
      { success: false, error: { code: 'CANCEL_FAILED', message: 'Gagal menghentikan generate.' } },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
});
