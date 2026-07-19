'use client';

import { useState } from 'react';
import { Wand2, ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/db/supabaseBrowserClient';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSent(true);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      <div className="animate-fade-in-up relative z-10 mx-4 w-full max-w-sm">
        <div className="brutal-card rounded-md p-4 sm:p-6 lg:p-8 shadow-[var(--shadow)]">
          <div className="mb-4 sm:mb-6 lg:mb-8 text-center">
            <div className="brutal-icon mx-auto mb-3 sm:mb-4 size-10 sm:size-12 lg:size-14 rounded-md bg-gemini-orange">
              <Wand2 className="size-5 sm:size-6 lg:size-7 text-[#111]" />
            </div>
            <h1 className="font-display text-primary text-lg sm:text-xl lg:text-2xl font-bold">Lupa Password</h1>
            <p className="mt-1 text-xs sm:text-sm text-tertiary">
              {sent
                ? 'Cek email Anda untuk link reset password'
                : 'Masukkan email untuk menerima link reset'}
            </p>
          </div>

          {error && (
            <div className="mb-4 animate-fade-in rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3">
              <p className="text-center text-sm text-red-400">{error}</p>
            </div>
          )}

          {sent ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-4">
                <p className="text-center text-sm text-emerald-600 dark:text-emerald-300 break-words">
                  Link reset password telah dikirim ke <strong className="break-all">{email}</strong>.
                  Cek inbox atau folder spam Anda.
                </p>
              </div>
              <a
                href="/login"
                className="btn-gradient flex items-center justify-center gap-2 w-full py-2.5 sm:py-3 text-sm font-semibold"
              >
                <ArrowLeft size={16} />
                Kembali ke Login
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
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

              <button
                type="submit"
                disabled={loading}
                className="btn-gradient w-full py-2.5 sm:py-3 text-sm font-semibold flex items-center justify-center gap-2"
              >
                {loading ? 'Mengirim...' : 'Kirim Link Reset'}
              </button>

              <p className="text-center text-sm text-tertiary">
                <a
                  href="/login"
                  className="text-gemini-blue/60 hover:text-gemini-blue transition-colors font-medium"
                >
                  Kembali ke Login
                </a>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
