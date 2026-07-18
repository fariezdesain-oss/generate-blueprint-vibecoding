import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

type RateLimitResult = {
  allowed: boolean;
  retryAfter: number;
};

export async function checkRateLimit(
  supabase: SupabaseClient,
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const { data, error } = await supabase.rpc('check_rate_limit', {
    p_key: key,
    p_limit: limit,
    p_window_ms: windowMs,
  });

  if (error) throw new Error('Rate limit RPC gagal');

  const value = Array.isArray(data) ? data[0] : data;
  if (
    !value ||
    typeof value !== 'object' ||
    typeof value.allowed !== 'boolean' ||
    typeof value.retry_after !== 'number' ||
    !Number.isFinite(value.retry_after)
  ) {
    throw new Error('Respons rate limit tidak valid');
  }

  return {
    allowed: value.allowed,
    retryAfter: Math.max(0, Math.ceil(value.retry_after)),
  };
}

export async function rateLimitResponse(
  supabase: SupabaseClient,
  key: string,
  limit: number,
  windowMs: number,
) {
  try {
    const result = await checkRateLimit(supabase, key, limit, windowMs);
    if (result.allowed) return null;

    return NextResponse.json(
      { success: false, error: { code: 'RATE_LIMITED', message: 'Terlalu banyak request. Coba lagi sebentar.' } },
      { status: 429, headers: { 'Retry-After': String(result.retryAfter) } },
    );
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'RATE_LIMIT_UNAVAILABLE',
          message: 'Layanan pembatasan request sedang tidak tersedia. Silakan coba lagi.',
        },
      },
      { status: 503 },
    );
  }
}
