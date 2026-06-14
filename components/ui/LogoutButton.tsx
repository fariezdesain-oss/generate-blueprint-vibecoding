'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';

export function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  return (
    <button
      onClick={handleLogout}
      className="group flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-tertiary transition-all duration-200 hover:bg-red-500/10 hover:text-red-400"
    >
      <LogOut size={16} />
      <span>Logout</span>
    </button>
  );
}
