'use client';

import { useEffect } from 'react';
import { ShieldAlert, RefreshCw } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled Auth Error:', error);
  }, [error]);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center p-4">
      <div className="mx-auto w-full max-w-md brutal-card rounded-xl p-6 sm:p-8 text-center shadow-[var(--shadow)]">
        <div className="mx-auto mb-4 flex size-14 sm:size-16 items-center justify-center rounded-full bg-red-500/10 border-2 border-red-500/20">
          <ShieldAlert className="size-6 sm:size-8 text-red-400" />
        </div>
        <h1 className="mb-2 font-display text-lg sm:text-xl font-bold text-primary">
          Terjadi Kesalahan
        </h1>
        <p className="mb-6 text-sm text-secondary">
          Maaf, terjadi kesalahan saat memuat halaman otentikasi.
        </p>
        <button
          onClick={() => reset()}
          className="btn-gradient flex w-full items-center justify-center gap-2 py-2.5 sm:py-3 text-sm font-semibold"
        >
          <RefreshCw size={16} />
          Coba Lagi
        </button>
      </div>
    </div>
  );
}
