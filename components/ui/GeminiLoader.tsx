'use client';

import { useEffect, useState } from 'react';

const loadingTexts = [
  'Memproses...',
  'Hampir selesai...',
];

export function GeminiLoader({ text }: { text?: string }) {
  const [textIndex, setTextIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTextIndex((prev) => (prev + 1) % loadingTexts.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-1.5">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
      <p className="text-xs text-tertiary">
        {text || loadingTexts[textIndex]}
      </p>
    </div>
  );
}

export function GeminiDots() {
  return (
    <span className="inline-flex items-center gap-0.5" style={{ color: 'var(--text-tertiary)' }}>
      <span className="inline-block size-1 rounded-full bg-current animate-bounce-dot" style={{ animationDelay: '-0.32s' }} />
      <span className="inline-block size-1 rounded-full bg-current animate-bounce-dot" style={{ animationDelay: '-0.16s' }} />
      <span className="inline-block size-1 rounded-full bg-current animate-bounce-dot" style={{ animationDelay: '0s' }} />
    </span>
  );
}
