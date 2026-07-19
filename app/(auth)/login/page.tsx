'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Wand2, Mail } from 'lucide-react';
import { createClient } from '@/lib/db/supabaseBrowserClient';
import { GeminiDots } from '@/components/ui/GeminiLoader';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();
  const supabase = createClient();
  const searchParams = useSearchParams();
  const message = searchParams.get('message');

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const startCooldown = () => {
    setResendCooldown(30);
    intervalRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          intervalRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setUnconfirmedEmail(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setLoading(false);
      if (
        error.message.toLowerCase().includes('email not confirmed') ||
        error.code === 'email_not_confirmed'
      ) {
        setUnconfirmedEmail(email);
        return;
      }
      setError(error.message);
      return;
    }

    router.push('/chat');
    router.refresh();
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || !unconfirmedEmail) return;

    setResendLoading(true);
    setResendMessage(null);

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: unconfirmedEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setResendLoading(false);

    if (error) {
      setResendMessage(error.message);
      return;
    }

    setResendMessage('Email verifikasi telah dikirim ulang');
    startCooldown();
  };

  if (unconfirmedEmail) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
        <div className="animate-fade-in-up relative z-10 mx-4 w-full max-w-sm">
          <div className="brutal-card rounded-md p-4 sm:p-6 lg:p-8 shadow-[var(--shadow)]">
            <div className="mb-4 sm:mb-6 lg:mb-8 text-center">
              <div className="brutal-icon mx-auto mb-3 sm:mb-4 size-10 sm:size-12 lg:size-14 rounded-md bg-gemini-orange">
                <Mail className="size-5 sm:size-6 lg:size-7 text-white" />
              </div>
              <h1 className="font-display text-primary text-lg sm:text-xl lg:text-2xl font-bold">Email Belum Diverifikasi</h1>
              <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-tertiary">
                Silakan cek email Anda untuk verifikasi:
              </p>
              <p className="mt-1 text-xs sm:text-sm font-medium text-primary truncate">{unconfirmedEmail}</p>
            </div>

            <div className="rounded-xl bg-tertiary border border-subtle px-4 py-4 text-sm text-secondary">
              Klik link yang kami kirim ke email Anda untuk mengaktifkan akun. Jika tidak muncul, periksa folder <strong>Spam</strong>.
            </div>

            <button
              onClick={handleResend}
              disabled={resendLoading || resendCooldown > 0}
              className="brutal-button mt-6 flex w-full items-center justify-center gap-2 py-2.5 text-sm sm:py-3"
            >
              {resendLoading ? (
                <span className="flex items-center justify-center gap-2">
                  Mengirim ulang
                  <GeminiDots />
                </span>
              ) : resendCooldown > 0 ? (
                `Kirim ulang (${resendCooldown}s)`
              ) : (
                'Kirim Ulang Email'
              )}
            </button>

            {resendMessage && (
              <div className={`mt-3 animate-fade-in rounded-xl px-4 py-3 border ${
                resendMessage === 'Email verifikasi telah dikirim ulang'
                  ? 'bg-green-500/10 border-green-500/20'
                  : 'bg-red-500/10 border-red-500/20'
              }`}>
                <p className={`text-center text-sm ${
                  resendMessage === 'Email verifikasi telah dikirim ulang'
                    ? 'text-green-400'
                    : 'text-red-400'
                }`}>{resendMessage}</p>
              </div>
            )}

            <p className="mt-6 text-center text-sm text-tertiary">
              Gunakan email lain?{' '}
              <button
                onClick={() => setUnconfirmedEmail(null)}
                className="text-gemini-blue hover:text-gemini-blue transition-colors font-medium underline"
              >
                Kembali
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      <div className="animate-fade-in-up relative z-10 mx-4 w-full max-w-sm">
        <div className="brutal-card rounded-md p-4 sm:p-6 lg:p-8 shadow-[var(--shadow)]">
          <div className="mb-4 sm:mb-6 lg:mb-8 text-center">
            <div className="brutal-icon mx-auto mb-3 sm:mb-4 size-10 sm:size-12 lg:size-14 rounded-md bg-gemini-orange">
              <Wand2 className="size-5 sm:size-6 lg:size-7 text-[#111]" />
            </div>
                <h1 data-testid="login-heading" className="font-display text-primary text-lg sm:text-xl lg:text-2xl font-bold">Vibecoding Docs</h1>
            <p className="mt-1 text-xs sm:text-sm text-tertiary">Masuk ke akun Anda</p>
          </div>

          {message && (
            <div className="mb-4 animate-fade-in rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-3">
              <p className="text-center text-sm text-green-400">{message}</p>
            </div>
          )}

          {error && (
            <div className="mb-4 animate-fade-in rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3">
              <p className="text-center text-sm text-red-400">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-3 sm:space-y-4">
            <div>
              <label className="mb-1.5 block text-sm text-secondary">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input-gemini input-email"
                placeholder="nama@email.com"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm text-secondary">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="input-gemini input-password pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-tertiary hover:text-gemini-blue transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

              <div className="text-right">
                <a
                  href="/forgot-password"
                  className="text-xs text-gemini-blue/60 hover:text-gemini-blue transition-colors font-medium"
                >
                  Lupa password?
                </a>
              </div>

                  <button
                    data-testid="login-submit"
                    type="submit"
              disabled={loading}
              className="btn-gradient-google w-full py-2.5 sm:py-3 text-sm font-semibold flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  Memverifikasi
                  <GeminiDots />
                </span>
              ) : (
                'Masuk'
              )}
            </button>
          </form>

          <p className="mt-4 sm:mt-5 lg:mt-6 text-center text-xs sm:text-sm text-tertiary">
            Belum punya akun?{' '}
            <a
              href="/register"
              className="text-gemini-blue hover:text-gemini-blue transition-colors font-medium"
            >
              Daftar
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-tertiary">Memuat...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
