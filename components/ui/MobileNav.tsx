'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X, Sparkles } from 'lucide-react';
import { SidebarHistory } from './SidebarHistory';
import { LogoutButton } from './LogoutButton';
import { ProviderBadge } from './ProviderBadge';

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-subtle backdrop-blur-xl px-4 py-3 md:hidden" style={{ backgroundColor: `rgba(var(--bg-primary-rgb), 0.8)` }}>
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
            <ProviderBadge />
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

            <nav className="mb-4 flex flex-col gap-1">
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-tertiary">Navigasi</p>
              <Link
                href="/history"
                onClick={() => setOpen(false)}
                className="group flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-secondary transition-all duration-200 hover:bg-tertiary hover:text-primary"
              >
                <span className="size-1.5 rounded-full bg-tertiary group-hover:bg-gemini-blue transition-colors" />
                History
              </Link>
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                className="group flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-secondary transition-all duration-200 hover:bg-tertiary hover:text-primary"
              >
                <span className="size-1.5 rounded-full bg-tertiary group-hover:bg-gemini-blue transition-colors" />
                Settings
              </Link>
            </nav>

            <div className="mb-4 flex-1 overflow-y-auto">
              <SidebarHistory />
            </div>

            <div className="mb-4">
              <LogoutButton />
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
