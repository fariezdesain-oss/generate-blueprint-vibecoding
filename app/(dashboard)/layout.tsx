import { createClient } from '@/lib/db/supabaseServerClient';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Wand2 } from 'lucide-react';
import { LogoutButton } from '@/components/ui/LogoutButton';
import { SidebarHistory } from '@/components/ui/SidebarHistory';
import { MobileNav } from '@/components/ui/MobileNav';
import { ProviderBadge } from '@/components/ui/ProviderBadge';
import { SessionManager } from '@/components/ui/SessionManager';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { AnimatedBackground } from '@/components/ui/AnimatedBackground';

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
    <SessionManager>
      <div className="relative flex h-screen flex-col overflow-hidden md:flex-row">
        <AnimatedBackground />
        <MobileNav />

        <aside className="relative hidden w-72 shrink-0 flex-col overflow-hidden border-r border-subtle bg-secondary p-4 md:flex">
          <div className="mb-4 flex items-center gap-3 px-3">
            <div className="brutal-icon size-10 rounded-md bg-gemini-orange">
              <Wand2 className="size-5 text-[#111]" />
            </div>
            <div>
              <h1 className="font-display text-primary text-base font-extrabold leading-tight">Vibecoding</h1>
              <p className="text-xs font-semibold text-tertiary">Docs Generator</p>
            </div>
          </div>

          <div className="mb-4 px-3">
            <ProviderBadge />
          </div>

          <nav className="mb-4 flex flex-col gap-1 px-3">
            <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-tertiary">Navigasi</p>
            <Link
              href="/history"
              className="group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-secondary transition-all duration-200 hover:bg-tertiary hover:text-primary"
            >
              <span className="size-1.5 rounded-full bg-tertiary group-hover:bg-gemini-blue transition-colors" />
              History
            </Link>
            <Link
              href="/settings"
              className="group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-secondary transition-all duration-200 hover:bg-tertiary hover:text-primary"
            >
              <span className="size-1.5 rounded-full bg-tertiary group-hover:bg-gemini-blue transition-colors" />
              Settings
            </Link>
          </nav>

          <div className="flex flex-1 flex-col overflow-hidden">
            <SidebarHistory />
          </div>

          <div className="mt-auto flex flex-col gap-2 px-3 pb-2 pt-2 border-t border-subtle">
            <ThemeToggle />
            <LogoutButton />
          </div>
        </aside>

        <main className="relative flex flex-1 flex-col overflow-y-auto pt-16 md:pt-0">{children}</main>
      </div>
    </SessionManager>
  );
}
