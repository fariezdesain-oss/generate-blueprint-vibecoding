'use client';

import { useEffect, useState } from 'react';
import { Clock, LogOut } from 'lucide-react';

interface SessionTimeoutModalProps {
  timeRemaining: number;
  onStayLoggedIn: () => void;
}

export function SessionTimeoutModal({ timeRemaining, onStayLoggedIn }: SessionTimeoutModalProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const seconds = Math.ceil(timeRemaining / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-sm transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="mx-4 w-full max-w-md animate-fade-in-up rounded-2xl border border-subtle bg-secondary p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 ring-1 ring-amber-500/20">
            <Clock className="size-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-primary">Sesi Akan Berakhir</h2>
            <p className="text-xs text-tertiary">Tidak ada aktivitas terdeteksi</p>
          </div>
        </div>

        <p className="mb-4 text-sm leading-relaxed text-secondary">
          Sesi Anda akan otomatis logout karena tidak ada aktivitas dalam beberapa waktu.
          Klik tombol di bawah untuk tetap login.
        </p>

        <div className="mb-5 flex items-center justify-center">
          <div className="flex items-baseline gap-1 rounded-xl bg-tertiary px-4 py-3 ring-1 ring-[var(--border)]">
            <span className="text-2xl font-bold text-primary tabular-nums">
              {String(minutes).padStart(2, '0')}
            </span>
            <span className="text-sm text-tertiary">:</span>
            <span className="text-2xl font-bold text-amber-400 tabular-nums">
              {String(secs).padStart(2, '0')}
            </span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onStayLoggedIn}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gemini-blue px-4 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:bg-gemini-blue/80 active:scale-[0.98]"
          >
            Tetap Login
          </button>
          <button
            onClick={() => {
              window.location.href = '/api/auth/logout';
            }}
            className="flex items-center justify-center gap-2 rounded-xl border border-subtle bg-tertiary px-4 py-2.5 text-sm text-secondary transition-all duration-200 hover:bg-tertiary hover:text-primary"
          >
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
