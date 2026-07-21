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
      className={`fixed inset-0 z-50 flex items-center justify-center bg-overlay transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="mx-4 w-full max-w-md animate-fade-in-up brutal-card !rounded-none p-6 !shadow-[8px_8px_0_var(--border)] bg-secondary">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center !rounded-none bg-amber-500 border-2 border-border shadow-[2px_2px_0_var(--border)]">
            <Clock className="size-5 text-[#111]" />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase text-primary">Sesi Akan Berakhir</h2>
            <p className="text-xs font-semibold text-tertiary">Tidak ada aktivitas terdeteksi</p>
          </div>
        </div>

        <p className="mb-4 text-sm font-medium leading-relaxed text-secondary">
          Sesi Anda akan otomatis logout karena tidak ada aktivitas dalam beberapa waktu.
          Klik tombol di bawah untuk tetap login.
        </p>

        <div className="mb-5 flex items-center justify-center">
          <div className="flex items-baseline gap-1 !rounded-none bg-tertiary px-4 py-3 border-2 border-border shadow-[4px_4px_0_var(--border)]">
            <span className="text-2xl font-black text-primary tabular-nums">
              {String(minutes).padStart(2, '0')}
            </span>
            <span className="text-sm font-black text-tertiary">:</span>
            <span className="text-2xl font-black text-amber-500 tabular-nums">
              {String(secs).padStart(2, '0')}
            </span>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-3">
          <button
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST' });
              window.location.href = '/login';
            }}
            className="flex-1 items-center justify-center gap-2 !rounded-none border-2 border-border bg-tertiary px-4 py-2.5 text-sm font-bold uppercase text-secondary transition-all duration-200 hover:bg-secondary shadow-[3px_3px_0_var(--border)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_var(--border)] flex"
          >
            <LogOut size={16} />
            Logout
          </button>
          <button
            onClick={onStayLoggedIn}
            className="flex-1 items-center justify-center gap-2 !rounded-none border-2 border-border bg-gemini-blue px-4 py-2.5 text-sm font-black uppercase text-white transition-all duration-200 hover:bg-gemini-blue/90 shadow-[3px_3px_0_var(--border)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_var(--border)] flex"
          >
            Tetap Login
          </button>
        </div>
      </div>
    </div>
  );
}
