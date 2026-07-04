import { NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabaseServerClient';
import { encrypt, decrypt } from '@/lib/utils/encryption';
import { maskApiKey, serializeProviderConfig } from '@/lib/utils/providerConfig';

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

  const { data: config } = await supabase
    .from('provider_configs')
    .select('user_id')
    .eq('id', params.id)
    .single();

  if (!config) {
    return NextResponse.json(
      { success: false, error: { code: 'PROVIDER_NOT_FOUND', message: 'Provider config not found' } },
      { status: 404 },
    );
  }

  if (config.user_id !== userData.user.id) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_FORBIDDEN', message: 'Forbidden' } },
      { status: 403 },
    );
  }

  const { error } = await supabase
    .from('provider_configs')
    .delete()
    .eq('id', params.id);

  if (error) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, data: { message: 'Provider config deleted' } });
}

export async function PATCH(
  req: Request,
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

  const body = await req.json();
  const { is_active } = body;

  if (typeof is_active !== 'boolean') {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'is_active is required' } },
      { status: 400 },
    );
  }

  const { data: config } = await supabase
    .from('provider_configs')
    .select('user_id')
    .eq('id', params.id)
    .single();

  if (!config) {
    return NextResponse.json(
      { success: false, error: { code: 'PROVIDER_NOT_FOUND', message: 'Provider config not found' } },
      { status: 404 },
    );
  }

  if (config.user_id !== userData.user.id) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_FORBIDDEN', message: 'Forbidden' } },
      { status: 403 },
    );
  }

  if (is_active) {
    await supabase
      .from('provider_configs')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('user_id', userData.user.id)
      .neq('id', params.id);
  }

  const { data, error } = await supabase
    .from('provider_configs')
    .update({ is_active, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select('id, provider_name, model_name, is_active, created_at, updated_at')
    .single();

  if (error) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, data: { provider: data } });
}

export async function PUT(
  req: Request,
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

  const { model_name, base_url, api_key } = await req.json();

  if (!model_name || typeof model_name !== 'string') {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'model_name is required' } },
      { status: 400 },
    );
  }

  const { data: config } = await supabase
    .from('provider_configs')
    .select('user_id, provider_name')
    .eq('id', params.id)
    .single();

  if (!config) {
    return NextResponse.json(
      { success: false, error: { code: 'PROVIDER_NOT_FOUND', message: 'Provider config not found' } },
      { status: 404 },
    );
  }

  if (config.user_id !== userData.user.id) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_FORBIDDEN', message: 'Forbidden' } },
      { status: 403 },
    );
  }

  const updateData: Record<string, string | null> = {
    model_name,
    base_url: base_url || null,
    updated_at: new Date().toISOString(),
  };

  if (typeof api_key === 'string' && api_key.trim().length > 0) {
    updateData.api_key = encrypt(api_key.trim());
  }

  const { data, error } = await supabase
    .from('provider_configs')
    .update(updateData)
    .eq('id', params.id)
    .eq('user_id', userData.user.id)
    .select('id, provider_name, model_name, api_key, base_url, is_active, created_at, updated_at')
    .single();

  if (error) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    data: { provider: serializeProviderConfig(data, maskApiKey(decrypt(data.api_key))) },
  });
}
