const QUOTA_EXHAUSTED_PATTERNS = [
  /resource exhausted/i,
  /quota.*exceeded/i,
  /credit.*exhaust/i,
  /insufficient.*quota/i,
  /daily.*limit/i,
  /request.*limit.*exceeded/i,
  /rate.*limit.*exceeded/i,
  /monthly.*limit/i,
];

const CONTEXT_OVERFLOW_PATTERNS = [
  /context.*length/i,
  /too (long|large|big)/i,
  /maximum.*(length|size|context)/i,
  /token.*limit/i,
  /input.*too/i,
  /content.*too/i,
  /prompt.*too/i,
  /max.*token/i,
  /exceeds.*limit/i,
  /exceeded.*(length|size)/i,
];

const TRANSIENT_PATTERNS = [
  /503/i,
  /service unavailable/i,
  /too many requests/i,
  /429/i,
  /rate limit/i,
  /high demand/i,
  /try again later/i,
  /overloaded/i,
  /temporarily unavailable/i,
  /please.*retry/i,
  /server.*error/i,
];

const AUTH_PATTERNS = [
  /api key/i,
  /unauthorized/i,
  /403/i,
  /401/i,
  /permission/i,
  /not found/i,
  /model.*not/i,
  /not supported/i,
  /invalid.*key/i,
];

const PAYMENT_PATTERNS = [
  /402/i,
  /payment required/i,
  /insufficient credits/i,
  /never purchased credits/i,
  /insufficient.*credit/i,
  /purchase.*credit/i,
  /billing/i,
  /payment/i,
];

export function formatAIError(err: unknown): { code: string; message: string } {
  const message = err instanceof Error ? err.message : 'Terjadi kesalahan tak terduga';

  const isQuotaExhausted = QUOTA_EXHAUSTED_PATTERNS.some((p) => p.test(message));
  const isPayment = PAYMENT_PATTERNS.some((p) => p.test(message));
  const isContextOverflow = CONTEXT_OVERFLOW_PATTERNS.some((p) => p.test(message));
  const isAuth = AUTH_PATTERNS.some((p) => p.test(message));
  const isTransient = TRANSIENT_PATTERNS.some((p) => p.test(message));

  if (isPayment || isQuotaExhausted) {
    return {
      code: 'AI_PAYMENT_REQUIRED',
      message:
        'Kredit/kuota akun provider AI Anda tidak mencukupi atau telah habis. ' +
        'Top up akun Anda, reset kuota (jika gratis), atau ganti ke provider lain di pengaturan.',
    };
  }

  if (isContextOverflow) {
    return {
      code: 'AI_CONTEXT_OVERFLOW',
      message:
        'Percakapan dan/atau dokumen yang sudah ada terlalu panjang untuk diproses AI. ' +
        'Coba mulai sesi baru atau kurangi panjang percakapan sebelum generate ulang.',
    };
  }

  if (isAuth) {
    return {
      code: 'AI_CONFIG_ERROR',
      message:
        'Terjadi masalah dengan konfigurasi AI. Periksa kembali API Key dan model yang dipilih di pengaturan provider.',
    };
  }

  if (isTransient) {
    return {
      code: 'AI_SERVICE_BUSY',
      message:
        'Maaf, layanan AI sedang sibuk. Silakan tunggu beberapa saat dan coba lagi. ' +
        'Jika masalah berlanjut, coba ganti model atau provider AI lain di pengaturan.',
    };
  }

  return { code: 'AI_GENERATION_FAILED', message };
}
