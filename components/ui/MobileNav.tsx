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
      <header className="fixed top-0 left-0 right-0 z-20 flex items-center justify-between gap-2 border-b-2 border-border px-4 py-3 md:hidden shadow-[0_4px_0_var(--border)]" style={{ backgroundColor: `rgba(var(--bg-primary-rgb), 1)` }}>
          <div className="flex items-center gap-2.5">
            <div className="brutal-icon size-8 min-w-8 min-h-8 !rounded-none bg-gemini-orange shadow-[2px_2px_0_var(--border)] border-2 border-border">
              <Wand2 className="size-4 text-[#111] stroke-[2.5px]" />
            </div>
            <div>
              <h1 className="font-display text-primary text-base font-black uppercase tracking-widest leading-tight">Vibecoding</h1>
              <p className="text-[10px] font-black uppercase text-tertiary">Docs Generator</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
            onClick={() => setOpen(true)}
            className="!rounded-none border-2 border-transparent p-1 text-tertiary transition-all duration-200 hover:border-border hover:bg-tertiary hover:text-primary active:translate-x-[1px] active:translate-y-[1px]"
          >
            <Menu size={24} className="stroke-[2.5px]" />
          </button>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-overlay"
            onClick={() => setOpen(false)}
          />
          <aside className="brutal-card relative flex h-full w-[80%] max-w-sm flex-col p-4 !shadow-[8px_0_0_var(--border)] !rounded-none border-r-2 border-y-0 border-l-0 border-border bg-primary">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="brutal-icon size-8 min-w-8 min-h-8 !rounded-none bg-gemini-orange shadow-[2px_2px_0_var(--border)] border-2 border-border">
                  <Wand2 className="size-4 text-[#111] stroke-[2.5px]" />
                </div>
                <div>
                  <h1 className="font-display text-primary text-base font-black uppercase tracking-widest leading-tight">Vibecoding</h1>
                  <p className="text-[10px] font-black uppercase text-tertiary">Docs Generator</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="!rounded-none border-2 border-transparent p-1 text-tertiary transition-all duration-200 hover:border-border hover:bg-tertiary hover:text-primary active:translate-x-[1px] active:translate-y-[1px]"
              >
                <X size={20} className="stroke-[2.5px]" />
              </button>
            </div>

            <div className="mb-4 px-1">
              <ProviderBadge />
            </div>

            <nav className="mb-4 flex flex-col gap-2">
              <p className="mb-1 px-1 text-[10px] font-black uppercase tracking-widest text-tertiary">Navigasi</p>
              <button
                onClick={handleNewChat}
                className="group flex items-center gap-3 !rounded-none border-2 border-transparent px-2 py-1.5 text-xs font-bold uppercase transition-all duration-200 hover:border-border hover:bg-tertiary hover:text-primary text-secondary hover:shadow-[3px_3px_0_var(--border)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_var(--border)]"
              >
                <Plus size={16} className="text-primary stroke-[2.5px]" />
                New Chat
              </button>
              <Link
                href="/history"
                onClick={() => setOpen(false)}
                className="group flex items-center gap-3 !rounded-none border-2 border-transparent px-2 py-1.5 text-xs font-bold uppercase transition-all duration-200 hover:border-border hover:bg-tertiary hover:text-primary text-secondary hover:shadow-[3px_3px_0_var(--border)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_var(--border)]"
              >
                <History size={16} className="stroke-[2.5px]" />
                History
              </Link>
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                className="group flex items-center gap-3 !rounded-none border-2 border-transparent px-2 py-1.5 text-xs font-bold uppercase transition-all duration-200 hover:border-border hover:bg-tertiary hover:text-primary text-secondary hover:shadow-[3px_3px_0_var(--border)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_var(--border)]"
              >
                <Settings size={16} className="stroke-[2.5px]" />
                Settings
              </Link>
            </nav>

            <div className="flex flex-1 flex-col overflow-hidden mb-2 border-t-4 border-solid border-border pt-4">
              <SidebarHistory onItemClick={() => setOpen(false)} />
            </div>

            <div className="mt-auto flex flex-col gap-3 pb-2 pt-4 border-t-4 border-solid border-border">
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
