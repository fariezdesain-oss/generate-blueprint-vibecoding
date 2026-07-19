'use client';

import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Wand2 } from 'lucide-react';
import { createClient } from '@/lib/db/supabaseBrowserClient';
import { GeminiDots } from '@/components/ui/GeminiLoader';

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [success, setSuccess] = useState(false);
  const readyRef = useRef(false);
  const supabase = createClient();

  useEffect(() => {
    let poll: ReturnType<typeof setInterval>;
    let timeout: ReturnType<typeof setTimeout>;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') && session) {
        readyRef.current = true;
        setReady(true);
        clearInterval(poll);
        clearTimeout(timeout);
      }
    });

    poll = setInterval(async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        readyRef.current = true;
        setReady(true);
        clearInterval(poll);
        clearTimeout(timeout);
      }
    }, 500);

    timeout = setTimeout(() => {
      clearInterval(poll);
      if (!readyRef.current) {
        setError('Link reset tidak valid atau sudah kedaluwarsa. Silakan coba reset password lagi.');
      }
    }, 15000);

    return () => {
      subscription.unsubscribe();
      clearInterval(poll);
      clearTimeout(timeout);
    };
  }, [supabase.auth]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError('Password tidak cocok');
      return;
    }

    if (password.length < 6) {
      setError('Password minimal 6 karakter');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess(true);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      <div className="animate-fade-in-up relative z-10 mx-4 w-full max-w-sm">
        <div className="brutal-card rounded-md p-4 sm:p-6 lg:p-8 shadow-[var(--shadow)]">
          <div className="mb-4 sm:mb-6 lg:mb-8 text-center">
            <div className="brutal-icon mx-auto mb-3 sm:mb-4 size-10 sm:size-12 lg:size-14 rounded-md bg-gemini-orange">
              <Wand2 className="size-5 sm:size-6 lg:size-7 text-[#111]" />
            </div>
            <h1 className="font-display text-primary text-lg sm:text-xl lg:text-2xl font-bold">Reset Password</h1>
            <p className="mt-1 text-xs sm:text-sm text-tertiary">
              {success
                ? 'Password berhasil diubah'
                : 'Masukkan password baru Anda'}
            </p>
          </div>

          {error && (
            <div className="mb-4 animate-fade-in rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3">
              <p className="text-center text-sm text-red-400">{error}</p>
            </div>
          )}

          {success ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-4">
                <p className="text-center text-sm text-emerald-600 dark:text-emerald-300">
                  Password Anda berhasil diubah. Klik tombol di bawah untuk kembali.
                </p>
              </div>
              <a
                href="/chat"
                className="btn-gradient flex items-center justify-center gap-2 w-full py-2.5 sm:py-3 text-sm font-semibold"
              >
                Kembali ke Chat
              </a>
            </div>
          ) : ready ? (
            <form onSubmit={handleUpdate} className="space-y-3 sm:space-y-4">
              <div>
                <label className="mb-1.5 block text-sm text-secondary">Password Baru</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="input-gemini pr-10"
                    placeholder="Minimal 6 karakter"
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

              <div>
                <label className="mb-1.5 block text-sm text-secondary">Konfirmasi Password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={6}
                  className="input-gemini input-password"
                  placeholder="Ulangi password baru"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-gradient w-full py-2.5 sm:py-3 text-sm font-semibold flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    Mengubah <GeminiDots />
                  </span>
                ) : (
                  'Ubah Password'
                )}
              </button>
            </form>
          ) : (
            <div className="flex flex-col items-center gap-4 py-6 sm:py-8">
              <Wand2 size={24} className="animate-wand-swing text-gemini-blue" />
              <p className="text-sm text-tertiary">Memverifikasi link reset...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
