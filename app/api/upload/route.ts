import { NextResponse } from 'next/server';
import { rateLimitResponse } from '@/lib/utils/rateLimit';
import { withAuth } from '@/lib/utils/apiAuth';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/markdown',
]);

export const POST = withAuth(async (req, _context, supabase, user) => {
  const limited = await rateLimitResponse(supabase, `${user.id}:upload`, 30, 60_000);
  if (limited) return limited;

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const sessionId = formData.get('sessionId') as string | null;

  if (!file || !sessionId) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'File and sessionId are required' } },
      { status: 400 },
    );
  }

  if (!ALLOWED_MIMES.has(file.type)) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_FILE_TYPE', message: `File type ${file.type} is not supported` } },
      { status: 400 },
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { success: false, error: { code: 'FILE_TOO_LARGE', message: 'File size exceeds 10MB limit' } },
      { status: 400 },
    );
  }

  const { data: session } = await supabase
    .from('sessions')
    .select('user_id')
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

  const fileName = `${crypto.randomUUID()}-${encodeURIComponent(file.name)}`;
  const storagePath = `${user.id}/${sessionId}/${fileName}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from('chat-attachments')
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { success: false, error: { code: 'UPLOAD_FAILED', message: uploadError.message } },
      { status: 500 },
    );
  }

  const attachment = {
    id: crypto.randomUUID(),
    name: file.name,
    mimeType: file.type,
    size: file.size,
    storagePath,
  };

  return NextResponse.json({ success: true, data: attachment }, { status: 201 });
});
