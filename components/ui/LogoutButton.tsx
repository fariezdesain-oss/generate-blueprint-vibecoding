'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Wand2 } from 'lucide-react';
import { clearActiveChatSession } from '@/lib/utils/browserSession';
import { useChatStore } from '@/store/useChatStore';

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore network/logout errors and clear local session anyway
    }
    clearActiveChatSession(sessionStorage);
    useChatStore.getState().reset();
    router.push('/login');
    router.refresh();
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="brutal-button flex w-full items-center justify-center gap-2.5 rounded-md px-2 py-1 text-xs !border-gemini-red !text-gemini-red !bg-transparent hover:!bg-gemini-red hover:!text-white dark:hover:!text-black !shadow-[3px_3px_0_var(--gemini-red)] hover:!shadow-[3px_3px_0_#111] dark:hover:!shadow-[3px_3px_0_#fff] active:!shadow-[1px_1px_0_#111] dark:active:!shadow-[1px_1px_0_#fff] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? (
        <Wand2 size={16} className="animate-wand-swing" />
      ) : (
        <LogOut size={16} />
      )}
      <span>{loading ? 'Keluar...' : 'Keluar'}</span>
    </button>
  );
}
