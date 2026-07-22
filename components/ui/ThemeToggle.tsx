'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const isDark = mounted && theme === 'dark';
  const label = isDark ? 'Aktifkan mode terang' : 'Aktifkan mode gelap';

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => mounted && setTheme(isDark ? 'light' : 'dark')}
      className={`brutal-button !bg-gemini-orange flex items-center justify-center gap-3 px-2 py-1.5 text-xs font-bold uppercase rounded-md ${compact ? 'size-9 p-0' : 'w-full'}`}
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
      {!compact && <span>{isDark ? 'Mode Terang' : 'Mode Gelap'}</span>}
    </button>
  );
}
