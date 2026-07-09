'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Menu, X, Sparkles, Plus, History, Settings, LogOut } from 'lucide-react';
import { ProviderBadge } from './ProviderBadge';
import { useChatStore } from '@/store/useChatStore';

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const resetChatStore = useChatStore((s) => s.reset);

  const handleNewChat = () => {
    resetChatStore();
    sessionStorage.removeItem('activeSessionId');
    router.push('/chat');
    setOpen(false);
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-20 flex items-center justify-between gap-2 border-b border-subtle backdrop-blur-xl px-4 py-3 md:hidden" style={{ backgroundColor: `rgba(var(--bg-primary-rgb), 0.8)` }}>
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-gemini-blue/20 to-gemini-blue/20 ring-1 ring-[var(--border)]">
              <Sparkles className="size-4 text-gemini-blue" />
            </div>
            <div>
              <h1 className="text-gradient text-base font-extrabold leading-tight">Vibecoding</h1>
              <p className="text-xs font-semibold text-tertiary">Docs Generator</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
            onClick={() => setOpen(true)}
            className="rounded-xl p-3 md:p-2 text-tertiary transition-all duration-200 hover:bg-tertiary hover:text-primary"
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-overlay backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <aside className="glass relative flex h-full w-72 flex-col p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-gemini-blue/20 to-gemini-blue/20 ring-1 ring-[var(--border)]">
                  <Sparkles className="size-4 text-gemini-blue" />
                </div>
                <div>
                  <h1 className="text-gradient text-base font-extrabold leading-tight">Vibecoding</h1>
                  <p className="text-xs font-semibold text-tertiary">Docs Generator</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-xl p-3 md:p-2 text-tertiary transition-all duration-200 hover:bg-tertiary hover:text-primary"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mb-4 px-3">
              <ProviderBadge />
            </div>

            <nav className="mb-4 flex flex-col gap-1">
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-tertiary">Navigasi</p>
              <button
                onClick={handleNewChat}
                className="group flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-secondary transition-all duration-200 hover:bg-tertiary hover:text-primary"
              >
                <Plus size={16} className="text-gemini-blue" />
                New Chat
              </button>
              <Link
                href="/history"
                onClick={() => setOpen(false)}
                className="group flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-secondary transition-all duration-200 hover:bg-tertiary hover:text-primary"
              >
                <History size={16} />
                History
              </Link>
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                className="group flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-secondary transition-all duration-200 hover:bg-tertiary hover:text-primary"
              >
                <Settings size={16} />
                Settings
              </Link>
            </nav>

            <div className="mt-auto">
              <button
                onClick={() => {
                  setOpen(false);
                  fetch('/api/auth/logout', { method: 'POST' }).then(() => {
                    sessionStorage.clear();
                    router.push('/login');
                  });
                }}
                className="group flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-secondary transition-all duration-200 hover:bg-red-500/10 hover:text-red-400"
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
