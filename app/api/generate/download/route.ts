import { NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabaseServerClient';
import { generateZip } from '@/lib/utils/zipGenerator';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_UNAUTHORIZED', message: 'Unauthorized' } },
      { status: 401 },
    );
  }

  const { files } = await req.json();

  if (!files || typeof files !== 'object') {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'files object is required' } },
      { status: 400 },
    );
  }

  try {
    const blob = await generateZip(files);
    const buffer = Buffer.from(await blob.arrayBuffer());

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="documentation.zip"',
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'ZIP_FAILED', message: 'Failed to generate ZIP' } },
      { status: 500 },
    );
  }
}
