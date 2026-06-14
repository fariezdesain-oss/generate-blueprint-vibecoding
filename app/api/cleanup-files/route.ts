import { NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabaseServerClient';

const EXPIRY_MS = 24 * 60 * 60 * 1000;

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createClient();
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
