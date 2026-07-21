'use client';

import { useEffect, useState } from 'react';

const CACHE_KEY = 'vibe_provider_badge';
const CACHE_TTL = 5 * 60 * 1000;

interface CachedProvider {
  label: string;
  ts: number;
}

export function ProviderBadge() {
  const [label, setLabel] = useState('');

  useEffect(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const parsed: CachedProvider = JSON.parse(cached);
        if (Date.now() - parsed.ts < CACHE_TTL) {
          setLabel(parsed.label);
          return;
        }
      } catch {
        localStorage.removeItem(CACHE_KEY);
      }
    }

    const fetchProvider = () => {
      fetch('/api/providers')
        .then((r) => r.json())
        .then((json) => {
          if (!json.success) return;
          const active = json.data.providers.find(
            (p: { is_active: boolean }) => p.is_active,
          );
          const newLabel = active
            ? `${active.provider_name} / ${active.model_name}`
            : 'No Active Provider';
          setLabel(newLabel);
          localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ label: newLabel, ts: Date.now() }),
          );
        })
        .catch(() => {});
    };

    fetchProvider();

    const onProviderChanged = () => {
      localStorage.removeItem(CACHE_KEY);
      fetchProvider();
    };

    window.addEventListener('provider-changed', onProviderChanged);
    return () => window.removeEventListener('provider-changed', onProviderChanged);
  }, []);

  if (!label) return null;

  return (
    <div className="inline-flex items-center gap-1.5 rounded-xl bg-tertiary border border-subtle px-2 py-1">
      <span className="size-1.5 rounded-full bg-gemini-teal " />
      <span className="text-[10px] text-tertiary truncate max-w-[140px]">{label}</span>
    </div>
  );
}
