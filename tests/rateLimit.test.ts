import type { SupabaseClient } from '@supabase/supabase-js';
import { checkRateLimit, rateLimitResponse } from '@/lib/utils/rateLimit';

function mockSupabase(result: { data: unknown; error: unknown }) {
  return {
    rpc: jest.fn().mockResolvedValue(result),
  } as unknown as SupabaseClient;
}

describe('rateLimit', () => {
  it('mengembalikan allowed dari RPC dengan argumen yang benar', async () => {
    const supabase = mockSupabase({ data: [{ allowed: true, retry_after: 0 }], error: null });

    await expect(checkRateLimit(supabase, 'user-1:chat', 30, 60_000)).resolves.toEqual({
      allowed: true,
      retryAfter: 0,
    });
    expect(supabase.rpc).toHaveBeenCalledWith('check_rate_limit', {
      p_key: 'user-1:chat',
      p_limit: 30,
      p_window_ms: 60_000,
    });
  });

  it('mengembalikan blocked beserta retryAfter dari RPC', async () => {
    const supabase = mockSupabase({ data: { allowed: false, retry_after: 7 }, error: null });

    await expect(checkRateLimit(supabase, 'user-1:chat', 30, 60_000)).resolves.toEqual({
      allowed: false,
      retryAfter: 7,
    });
  });

  it('menghasilkan response 429 untuk request yang diblokir', async () => {
    const supabase = mockSupabase({ data: [{ allowed: false, retry_after: 4 }], error: null });

    const response = await rateLimitResponse(supabase, 'user-1:chat', 30, 60_000);

    expect(response?.status).toBe(429);
    expect(response?.headers.get('Retry-After')).toBe('4');
    await expect(response?.json()).resolves.toEqual({
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Terlalu banyak request. Coba lagi sebentar.' },
    });
  });

  it('melempar error ketika RPC gagal', async () => {
    const supabase = mockSupabase({ data: null, error: { message: 'database detail' } });

    await expect(checkRateLimit(supabase, 'user-1:chat', 30, 60_000)).rejects.toThrow();
  });

  it('menolak response RPC berupa array kosong', async () => {
    const supabase = mockSupabase({ data: [], error: null });

    await expect(checkRateLimit(supabase, 'user-1:chat', 30, 60_000)).rejects.toThrow();
  });

  it('menghasilkan response 503 untuk response RPC dengan tipe salah', async () => {
    const supabase = mockSupabase({ data: [{ allowed: 'yes', retry_after: 4 }], error: null });

    const response = await rateLimitResponse(supabase, 'user-1:chat', 30, 60_000);

    expect(response?.status).toBe(503);
  });

  it('menghasilkan response 503 tanpa detail database ketika backend gagal', async () => {
    const supabase = mockSupabase({ data: null, error: { message: 'database detail' } });

    const response = await rateLimitResponse(supabase, 'user-1:chat', 30, 60_000);

    expect(response?.status).toBe(503);
    await expect(response?.json()).resolves.toEqual({
      success: false,
      error: {
        code: 'RATE_LIMIT_UNAVAILABLE',
        message: 'Layanan pembatasan request sedang tidak tersedia. Silakan coba lagi.',
      },
    });
  });
});
