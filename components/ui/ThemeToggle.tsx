'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) {
    return (
      <button className="group flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-tertiary">
        <div className="size-4 shrink-0" />
        <span>Theme</span>
      </button>
    );
  }

  const isDark = theme === 'dark';

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="group flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-tertiary transition-all duration-200 hover:text-primary"
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
      <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
    </button>
  );
}
