'use client';

import { useEffect, useState } from 'react';

export function ProviderBadge() {
  const [label, setLabel] = useState('');

  useEffect(() => {
    const fetchProvider = () => {
      fetch('/api/providers')
        .then((r) => r.json())
        .then((json) => {
          if (!json.success) return;
          const active = json.data.providers.find(
            (p: { is_active: boolean }) => p.is_active,
          );
          if (active) {
            setLabel(`${active.provider_name} / ${active.model_name}`);
          } else {
            setLabel('No Active Provider');
          }
        })
        .catch(() => setLabel('No Active Provider'));
    };

    fetchProvider();
    window.addEventListener('provider-changed', fetchProvider);
    return () => window.removeEventListener('provider-changed', fetchProvider);
  }, []);

  if (!label) return null;

  return (
    <div className="inline-flex items-center gap-1.5 rounded-xl bg-tertiary border border-subtle px-2.5 py-1.5">
      <span className="size-1.5 rounded-full bg-gemini-teal shadow-[0_0_6px_rgba(20,184,166,0.5)]" />
      <span className="text-[10px] text-tertiary truncate max-w-[140px]">{label}</span>
    </div>
  );
}
