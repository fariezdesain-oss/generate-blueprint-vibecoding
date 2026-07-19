'use client';

import { useEffect, useState } from 'react';
import { Wand2 } from 'lucide-react';

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
    <div className="flex flex-col items-center gap-4">
      <div className="brutal-icon size-12 sm:size-14 rounded-md bg-gemini-orange">
        <Wand2 className="size-6 sm:size-7 text-[#111] animate-wand-swing" />
      </div>
      <p className="font-bold text-sm tracking-widest uppercase text-tertiary">
        {text || loadingTexts[textIndex]}
      </p>
    </div>
  );
}

// Digunakan sebagai loader kecil (inline) di dalam tombol dsb
export function GeminiDots() {
  return (
    <span className="inline-flex items-center justify-center">
      <Wand2 size={16} className="animate-wand-swing" />
    </span>
  );
}
