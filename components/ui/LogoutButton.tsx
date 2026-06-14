'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="group flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-tertiary transition-all duration-200 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? (
        <span className="size-4 rounded-full border-2 border-red-400/50 border-t-red-400 animate-spin" />
      ) : (
        <LogOut size={16} />
      )}
      <span>{loading ? 'Logging out...' : 'Logout'}</span>
    </button>
  );
}
