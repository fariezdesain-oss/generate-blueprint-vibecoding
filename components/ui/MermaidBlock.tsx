'use client';
import { Wand2 } from 'lucide-react';

import { useEffect, useRef, useState } from 'react';

interface MermaidBlockProps {
  code: string;
}

export function MermaidBlock({ code }: MermaidBlockProps) {
  const ref = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const render = async () => {
      try {
        const mermaid = (await import('mermaid')).default;

        if (!initializedRef.current) {
          mermaid.initialize({
            startOnLoad: false,
            theme: 'dark',
            themeVariables: {
              primaryColor: '#3b82f6',
              primaryTextColor: '#ffffff',
              primaryBorderColor: 'rgba(255,255,255,0.1)',
              lineColor: 'rgba(255,255,255,0.3)',
              secondaryColor: 'rgba(255,255,255,0.05)',
              tertiaryColor: 'rgba(59,130,246,0.1)',
              background: '#0a0a0f',
              mainBkg: 'rgba(255,255,255,0.03)',
              nodeBorder: 'rgba(59,130,246,0.4)',
              clusterBkg: 'rgba(255,255,255,0.03)',
              titleColor: '#ffffff',
              edgeLabelBackground: 'rgba(10,10,15,0.8)',
              fontFamily: 'ui-sans-serif, system-ui, sans-serif',
            },
            flowchart: { curve: 'basis', useMaxWidth: true },
            sequence: { useMaxWidth: true },
          });
          initializedRef.current = true;
        }

        if (!ref.current || cancelled) return;

        const id = `mermaid-${Math.random().toString(36).slice(2)}`;
        const { svg } = await mermaid.render(id, code.trim());

        if (!ref.current || cancelled) return;
        ref.current.innerHTML = svg;

        const svgEl = ref.current.querySelector('svg');
        if (svgEl) {
          svgEl.style.maxWidth = '100%';
          svgEl.style.height = 'auto';
          svgEl.removeAttribute('width');
        }

        setRendered(true);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Diagram render gagal');
        }
      }
    };

    render();
    return () => { cancelled = true; };
  }, [code]);

  if (error) {
    return (
      <div className="my-4 !rounded-none border-2 border-border shadow-[3px_3px_0_var(--border)] bg-red-500/5 p-4">
        <p className="mb-2 text-xs font-bold text-red-400">Diagram tidak bisa dirender</p>
        <pre className="overflow-x-auto font-mono text-xs text-tertiary">{code}</pre>
      </div>
    );
  }

  return (
    <div className="my-4 overflow-x-auto">
      {!rendered && (
        <div className="flex items-center gap-2 !rounded-none border-2 border-border shadow-[3px_3px_0_var(--border)] bg-tertiary p-4">
          <Wand2 className="size-3 animate-wand-swing text-gemini-blue" />
          <span className="text-xs text-tertiary">Merender diagram...</span>
        </div>
      )}
      <div
        ref={ref}
        className="flex justify-center !rounded-none border-2 border-border shadow-[3px_3px_0_var(--border)] bg-[rgba(255,255,255,0.02)] p-4"
        style={{ display: rendered ? 'flex' : 'none' }}
      />
    </div>
  );
}
