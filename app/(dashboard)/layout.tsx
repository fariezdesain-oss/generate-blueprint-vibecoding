import { createClient } from '@/lib/db/supabaseServerClient';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Wand2, History, Settings } from 'lucide-react';
import { LogoutButton } from '@/components/ui/LogoutButton';
import { SidebarHistory } from '@/components/ui/SidebarHistory';
import { MobileNav } from '@/components/ui/MobileNav';
import { ProviderBadge } from '@/components/ui/ProviderBadge';
import { SessionManager } from '@/components/ui/SessionManager';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { AnimatedBackground } from '@/components/ui/AnimatedBackground';
import { NewChatButton } from '@/components/ui/NewChatButton';

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
      <div className="flex h-screen overflow-hidden bg-primary text-primary selection:bg-gemini-blue/30">
        <AnimatedBackground />
        
        <MobileNav />

        <aside className="relative z-10 hidden w-72 flex-col border-r-2 border-border bg-secondary shadow-[4px_0_0_var(--border)] md:flex">
          <div className="flex items-center gap-3 p-4 border-b-2 border-border mb-4 bg-tertiary">
            <div className="brutal-icon size-10 !rounded-none bg-gemini-orange border-2 border-border shadow-[2px_2px_0_var(--border)]">
              <Wand2 className="size-5 text-[#111] stroke-[2.5px]" />
            </div>
            <div>
              <h1 className="font-display text-lg font-black uppercase tracking-widest text-primary leading-none mb-1">Vibecoding</h1>
              <p className="text-[10px] font-black uppercase tracking-widest text-tertiary">Docs Generator</p>
            </div>
          </div>

          <div className="mb-4 px-3">
            <ProviderBadge />
          </div>

          <nav className="mb-4 flex flex-col gap-2 px-3">
            <p className="mb-1 text-[11px] font-black uppercase tracking-widest text-tertiary">Navigasi</p>
            <NewChatButton />
            <Link
              href="/history"
              className="group flex items-center gap-3 !rounded-none border-2 border-transparent px-2 py-1.5 text-xs font-bold uppercase text-secondary transition-all duration-200 hover:border-border hover:bg-tertiary hover:text-primary hover:shadow-[3px_3px_0_var(--border)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_var(--border)]"
            >
              <History size={16} className="stroke-[2.5px]" />
              History
            </Link>
            <Link
              href="/settings"
              className="group flex items-center gap-3 !rounded-none border-2 border-transparent px-2 py-1.5 text-xs font-bold uppercase text-secondary transition-all duration-200 hover:border-border hover:bg-tertiary hover:text-primary hover:shadow-[3px_3px_0_var(--border)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_var(--border)]"
            >
              <Settings size={16} className="stroke-[2.5px]" />
              Settings
            </Link>
          </nav>

          <div className="flex flex-1 flex-col overflow-hidden pt-4 border-t-4 border-solid border-border">
            <SidebarHistory />
          </div>

          <div className="mt-auto flex flex-col gap-2 px-3 pb-3 pt-3 border-t-4 border-solid border-border">
            <ThemeToggle />
            <LogoutButton />
          </div>
        </aside>

        <main className="relative flex flex-1 flex-col overflow-y-auto pt-16 md:pt-0">{children}</main>
      </div>
    </SessionManager>
  );
}
