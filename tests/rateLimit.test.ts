import { checkRateLimit, resetRateLimitForTests } from '@/lib/utils/rateLimit';

describe('rateLimit', () => {
  beforeEach(() => resetRateLimitForTests());

  it('blocks requests after the limit until the window resets', () => {
    expect(checkRateLimit('u1:chat', 2, 1000, 0).allowed).toBe(true);
    expect(checkRateLimit('u1:chat', 2, 1000, 100).allowed).toBe(true);

    const blocked = checkRateLimit('u1:chat', 2, 1000, 200);
    expect(blocked).toEqual({ allowed: false, retryAfter: 1 });

    expect(checkRateLimit('u1:chat', 2, 1000, 1000).allowed).toBe(true);
  });
});
