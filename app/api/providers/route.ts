import { NextResponse } from 'next/server';
import { ensureProfile } from '@/lib/db/ensureProfile';
import { decrypt, encrypt } from '@/lib/utils/encryption';
import { maskApiKey, serializeProviderConfig } from '@/lib/utils/providerConfig';
import { withAuth } from '@/lib/utils/apiAuth';

export const GET = withAuth(async (
  _req,
  _,
  supabase,
  user
) => {
  const { data, error } = await supabase
    .from('provider_configs')
    .select('id, provider_name, model_name, api_key, base_url, is_active, created_at, updated_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: error.message } },
      { status: 500 },
    );
  }

  const providers = data.map((p) => {
    let masked = '';
    try { masked = maskApiKey(decrypt(p.api_key)); } catch { masked = '[INVALID]'; }
    return serializeProviderConfig(p, masked);
  });

  return NextResponse.json({ success: true, data: { providers } });
});

export const POST = withAuth(async (
  req,
  _,
  supabase,
  user
) => {
  await ensureProfile(supabase, user);

  const { provider_name, api_key, model_name, base_url } = await req.json();

  if (!provider_name || !api_key || !model_name) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'provider_name, api_key, and model_name are required',
        },
      },
      { status: 400 },
    );
  }

  const encryptedKey = encrypt(api_key);

  const { data: existing } = await supabase
    .from('provider_configs')
    .select('id')
    .eq('user_id', user.id)
    .eq('provider_name', provider_name)
    .eq('model_name', model_name)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from('provider_configs')
      .update({
        api_key: encryptedKey,
        base_url: base_url || null,
        model_name,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('id, provider_name, model_name, api_key, base_url, is_active, created_at, updated_at')
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: error.message } },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data: { provider: serializeProviderConfig(data, maskApiKey(api_key)) } });
  }

  const { data, error } = await supabase
    .from('provider_configs')
    .insert({
      user_id: user.id,
      provider_name,
      api_key: encryptedKey,
      base_url: base_url || null,
      model_name,
    })
    .select('id, provider_name, model_name, api_key, base_url, is_active, created_at, updated_at')
    .single();

  if (error) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, data: { provider: serializeProviderConfig(data, maskApiKey(api_key)) } }, { status: 201 });
});

export const PUT = withAuth(async (
  req,
  _,
  supabase,
  user
) => {
  await ensureProfile(supabase, user);

  const { provider_name, api_key, model_name, base_url } = await req.json();

  if (!provider_name || typeof provider_name !== 'string') {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'provider_name is required' } },
      { status: 400 },
    );
  }

  const updateData: Record<string, string | null> = {};
  if (api_key) updateData.api_key = encrypt(api_key);
  if (model_name) updateData.model_name = model_name;
  if (base_url !== undefined) updateData.base_url = base_url || null;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Nothing to update' } },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from('provider_configs')
    .update({ ...updateData, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('provider_name', provider_name)
    .eq('model_name', model_name)
    .select('id, provider_name, model_name, api_key, base_url, is_active, created_at, updated_at')
    .single();

  if (error) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, data: { provider: serializeProviderConfig(data, maskApiKey(decrypt(data.api_key))) } });
});

