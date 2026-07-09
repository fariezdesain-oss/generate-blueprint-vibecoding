import { NextResponse } from 'next/server';

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function checkRateLimit(key: string, limit: number, windowMs: number, now: number = Date.now()) {
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }

  if (bucket.count >= limit) {
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }

  bucket.count += 1;
  return { allowed: true, retryAfter: 0 };
}

export function rateLimitResponse(key: string, limit: number, windowMs: number) {
  // ponytail: in-memory per server instance; move to DB/Redis if abuse across many instances matters.
  const result = checkRateLimit(key, limit, windowMs);
  if (result.allowed) return null;

  return NextResponse.json(
    { success: false, error: { code: 'RATE_LIMITED', message: 'Terlalu banyak request. Coba lagi sebentar.' } },
    { status: 429, headers: { 'Retry-After': String(result.retryAfter) } },
  );
}

export function resetRateLimitForTests() {
  buckets.clear();
}
