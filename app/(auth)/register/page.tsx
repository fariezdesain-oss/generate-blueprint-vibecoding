'use client';

import { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, Wand2, Mail, CheckCircle } from 'lucide-react';
import { createClient } from '@/lib/db/supabaseBrowserClient';
import { GeminiDots } from '@/components/ui/GeminiLoader';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successEmail, setSuccessEmail] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const supabase = createClient();

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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSuccessEmail(email);
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || !successEmail) return;

    setResendLoading(true);
    setResendMessage(null);

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: successEmail,
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

  if (successEmail) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
        <div className="animate-fade-in-up relative z-10 mx-4 w-full max-w-sm">
          <div className="brutal-card rounded-md p-4 sm:p-6 lg:p-8 shadow-[var(--shadow)]">
            <div className="mb-4 sm:mb-6 lg:mb-8 text-center">
              <div className="brutal-icon mx-auto mb-3 sm:mb-4 size-10 sm:size-12 lg:size-14 rounded-md bg-gemini-orange">
                <Mail className="size-5 sm:size-6 lg:size-7 text-gemini-orange" />
              </div>
              <h1 className="font-display text-primary text-lg sm:text-xl lg:text-2xl font-bold">Cek Email Anda</h1>
              <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-tertiary">
                Kami telah mengirim link verifikasi ke:
              </p>
              <p className="mt-1 text-xs sm:text-sm font-medium text-primary truncate">{successEmail}</p>
            </div>

            <div className="rounded-xl bg-tertiary border border-subtle px-4 py-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="mt-0.5 size-5 text-green-400 shrink-0" />
                <div className="text-sm text-secondary">
                  Klik link di email untuk mengaktifkan akun Anda. Jika tidak muncul, periksa folder <strong>Spam</strong>.
                </div>
              </div>
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

          <p className="mt-5 sm:mt-6 text-center text-xs sm:text-sm text-tertiary">
              Sudah verifikasi?{' '}
              <a
                href="/login"
                className="text-gemini-orange hover:text-gemini-red transition-colors font-medium"
              >
                Masuk
              </a>
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
                <h1 data-testid="register-heading" className="font-display text-primary text-lg sm:text-xl lg:text-2xl font-bold">Buat Akun</h1>
            <p className="mt-1 text-xs sm:text-sm text-tertiary">Daftar untuk mulai menggunakan</p>
          </div>

          {error && (
            <div className="mb-4 animate-fade-in rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3">
              <p className="text-center text-sm text-red-400">{error}</p>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-3 sm:space-y-4">
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-tertiary hover:text-gemini-orange transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-gradient-google w-full py-2.5 sm:py-3 text-sm font-semibold flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  Mendaftarkan
                  <GeminiDots />
                </span>
              ) : (
                'Daftar'
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-tertiary">
            Sudah punya akun?{' '}
            <a
              href="/login"
              className="text-gemini-orange hover:text-gemini-red transition-colors font-medium"
            >
              Masuk
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
