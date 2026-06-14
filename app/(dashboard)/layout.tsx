import { createClient } from '@/lib/db/supabaseServerClient';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { LogoutButton } from '@/components/ui/LogoutButton';
import { SidebarHistory } from '@/components/ui/SidebarHistory';
import { MobileNav } from '@/components/ui/MobileNav';
import { ProviderBadge } from '@/components/ui/ProviderBadge';
import { SessionManager } from '@/components/ui/SessionManager';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Providers } from '@/app/providers';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect('/login');
  }

  return (
    <Providers>
    <SessionManager>
      <div className="relative flex h-screen flex-col overflow-hidden md:flex-row">
        <MobileNav />

        <aside className="relative hidden w-72 shrink-0 flex-col overflow-y-auto border-r border-subtle bg-secondary p-5 md:flex">
          <div className="mb-8 flex items-center gap-3 px-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-gemini-blue/20 to-gemini-blue/20 ring-1 ring-[var(--border)]">
              <Sparkles className="size-5 text-gemini-blue" />
            </div>
            <div>
              <h1 className="text-gradient text-base font-extrabold leading-tight">Vibecoding</h1>
              <p className="text-xs font-semibold text-tertiary">Docs Generator</p>
            </div>
          </div>

          <div className="mb-6 px-3">
            <ProviderBadge />
          </div>

          <nav className="mb-6 flex flex-col gap-2 px-3">
            <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-tertiary">Navigasi</p>
            <Link
              href="/history"
              className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-secondary transition-all duration-200 hover:bg-tertiary hover:text-primary"
            >
              <span className="size-1.5 rounded-full bg-tertiary group-hover:bg-gemini-blue transition-colors" />
              History
            </Link>
            <Link
              href="/settings"
              className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-secondary transition-all duration-200 hover:bg-tertiary hover:text-primary"
            >
              <span className="size-1.5 rounded-full bg-tertiary group-hover:bg-gemini-blue transition-colors" />
              Settings
            </Link>
          </nav>

          <div className="mb-6">
            <SidebarHistory />
          </div>

          <div className="mt-auto space-y-1.5 px-3">
            <ThemeToggle />
            <LogoutButton />
          </div>
        </aside>

        <main className="relative flex flex-1 flex-col overflow-y-auto">{children}</main>
      </div>
    </SessionManager>
    </Providers>
  );
}
