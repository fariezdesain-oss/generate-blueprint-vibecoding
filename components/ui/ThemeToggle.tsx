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
      className={`brutal-button !bg-gemini-orange flex items-center justify-center gap-2.5 px-3 text-sm ${compact ? 'size-11 p-0' : 'w-full'}`}
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
      {!compact && <span>{isDark ? 'Mode Terang' : 'Mode Gelap'}</span>}
    </button>
  );
}
