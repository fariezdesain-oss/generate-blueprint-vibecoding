'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Menu, X, Wand2, Plus, History, Settings } from 'lucide-react';
import { ProviderBadge } from './ProviderBadge';
import { LogoutButton } from './LogoutButton';
import { ThemeToggle } from './ThemeToggle';
import { SidebarHistory } from './SidebarHistory';
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
      <header className="fixed top-0 left-0 right-0 z-20 flex items-center justify-between gap-2 border-b border-subtle px-4 py-3 md:hidden" style={{ backgroundColor: `rgba(var(--bg-primary-rgb), 0.8)` }}>
          <div className="flex items-center gap-2.5">
            <div className="brutal-icon size-8 min-w-8 min-h-8 rounded-md bg-gemini-orange shadow-[2px_2px_0_var(--border)]">
              <Wand2 className="size-4 text-[#111]" />
            </div>
            <div>
              <h1 className="font-display text-primary text-base font-extrabold leading-tight">Vibecoding</h1>
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
            className="absolute inset-0 bg-overlay "
            onClick={() => setOpen(false)}
          />
          <aside className="brutal-card relative flex h-full w-72 flex-col p-4 shadow-[var(--shadow)]">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="brutal-icon size-8 min-w-8 min-h-8 rounded-md bg-gemini-orange shadow-[2px_2px_0_var(--border)]">
                  <Wand2 className="size-4 text-[#111]" />
                </div>
                <div>
                  <h1 className="font-display text-primary text-base font-extrabold leading-tight">Vibecoding</h1>
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

            <div className="mb-3 px-3">
              <ProviderBadge />
            </div>

            <nav className="mb-3 flex flex-col gap-1">
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-tertiary">Navigasi</p>
              <button
                onClick={handleNewChat}
                className="group flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-secondary transition-all duration-200 hover:bg-tertiary hover:text-primary"
              >
                <Plus size={16} className="text-primary" />
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

            <div className="flex flex-1 flex-col overflow-hidden mb-2">
              <SidebarHistory onItemClick={() => setOpen(false)} />
            </div>

            <div className="mt-auto flex flex-col gap-2 pb-2 pt-2 border-t border-subtle">
              <ThemeToggle />
              <div onClick={() => setOpen(false)}>
                <LogoutButton />
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
