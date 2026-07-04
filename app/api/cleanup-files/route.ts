import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const EXPIRY_MS = 24 * 60 * 60 * 1000;

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const cutoff = new Date(Date.now() - EXPIRY_MS).toISOString();

  const { data: messages, error: msgError } = await supabase
    .from('messages')
    .select('attachments, created_at')
    .lt('created_at', cutoff)
    .not('attachments', 'is', null);

  if (msgError) {
    return NextResponse.json({ success: false, error: msgError.message }, { status: 500 });
  }

  let deletedCount = 0;

  for (const msg of messages) {
    if (!msg.attachments || !Array.isArray(msg.attachments)) continue;

    for (const att of msg.attachments) {
      if (!att || typeof att.storagePath !== 'string') continue;

      const { error } = await supabase.storage
        .from('chat-attachments')
        .remove([att.storagePath]);

      if (!error) deletedCount++;
    }
  }

  return NextResponse.json({
    success: true,
    data: { deletedCount, checkedCount: messages.length },
  });
}
