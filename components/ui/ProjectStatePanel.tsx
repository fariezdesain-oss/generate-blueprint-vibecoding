'use client';

import { useState, useEffect } from 'react';
import { ChevronRight, FileJson, Wand2 } from 'lucide-react';
import type { ProjectState } from '@/lib/utils/projectState';

interface ProjectStatePanelProps {
  sessionId: string;
}

export function ProjectStatePanel({ sessionId }: ProjectStatePanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [projectState, setProjectState] = useState<ProjectState | null>(null);
  const [rollingSummary, setRollingSummary] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasInitialFetch, setHasInitialFetch] = useState(false);

  useEffect(() => {
    setProjectState(null);
    setRollingSummary('');
    setHasInitialFetch(false);
  }, [sessionId]);

  useEffect(() => {
    async function fetchState() {
      setIsRefreshing(true);
      try {
        const res = await fetch(`/api/chat?session_id=${sessionId}`);
        const json = await res.json();
        if (json.success && json.data) {
          setProjectState(json.data.project_state);
          setRollingSummary(json.data.rolling_summary);
        }
      } catch {
        // ignore
      } finally {
        setIsRefreshing(false);
        setHasInitialFetch(true);
      }
    }

    if (isOpen && !hasInitialFetch) {
      fetchState();
    }
    
    const handleRefresh = () => {
      if (isOpen) fetchState();
    };
    window.addEventListener('project-state-refresh', handleRefresh);
    return () => window.removeEventListener('project-state-refresh', handleRefresh);
  }, [sessionId, isOpen, hasInitialFetch]);

  const hasData = projectState && Object.keys(projectState).length > 0;

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="absolute right-0 top-1/2 -translate-y-1/2 bg-gemini-orange border-2 border-r-0 border-border !rounded-none p-2.5 text-[#111] hover:bg-gemini-blue hover:text-white transition-colors shadow-[-4px_4px_0_var(--border)] z-40 active:translate-x-[-2px] active:shadow-[-2px_4px_0_var(--border)]"
        title="Buka Project State"
      >
        <FileJson size={20} className="stroke-[2.5px]" />
      </button>
    );
  }

  const renderValue = (value: unknown) => {
    if (Array.isArray(value)) {
      if (value.length === 0) return <span className="text-tertiary font-bold italic">- Kosong -</span>;
      return (
        <ul className="list-disc pl-4 space-y-1 font-medium">
          {value.map((item, i) => (
            <li key={i}>{String(item)}</li>
          ))}
        </ul>
      );
    }
    if (typeof value === 'object' && value !== null) {
      return (
        <pre className="font-mono text-[10px] sm:text-xs overflow-x-auto text-secondary font-semibold">
          {JSON.stringify(value, null, 2)}
        </pre>
      );
    }
    return <span className="font-medium">{String(value || '-')}</span>;
  };

  const panelContent = (
    <>
      <div className="flex items-center justify-between p-4 border-b-2 border-border shrink-0 bg-gemini-orange">
        <h2 className="font-black uppercase tracking-widest text-[#111] flex items-center gap-2 text-sm">
          <FileJson size={18} className="text-[#111] stroke-[2.5px]" />
          Project State
          {isRefreshing && <Wand2 className="size-3 animate-wand-swing text-[#111] ml-2 stroke-[2.5px]" />}
        </h2>
        <button
          onClick={() => setIsOpen(false)}
          className="p-1 !rounded-none border-2 border-transparent hover:border-[#111] text-[#111] transition-all active:translate-x-[1px] active:translate-y-[1px]"
        >
          <ChevronRight size={18} className="stroke-[2.5px]" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 text-xs sm:text-sm bg-secondary">
        {!hasData && !rollingSummary ? (
          <p className="text-tertiary text-center mt-10 font-bold">
            State belum terbentuk. Lanjutkan chat untuk mengisi state.
          </p>
        ) : (
          <>
            {hasData && (
              <div className="space-y-4">
                <h3 className="font-black text-[10px] sm:text-xs tracking-widest text-primary uppercase flex items-center gap-2">
                  <span className="bg-gemini-blue text-white px-2 py-0.5 border-2 border-border shadow-[2px_2px_0_var(--border)]">State Terstruktur</span>
                  <div className="h-0.5 flex-1 bg-border ml-2" />
                </h3>
                {Object.entries(projectState!).map(([key, value]) => (
                  <div key={key} className="space-y-1.5">
                    <p className="font-black text-gemini-blue uppercase tracking-wide">
                      {key.replace(/_/g, ' ')}
                    </p>
                    <div className="bg-tertiary !rounded-none p-3 text-primary leading-relaxed border-2 border-border shadow-[3px_3px_0_var(--border)]">
                      {renderValue(value)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {rollingSummary && (
              <div className="space-y-4 pt-4 border-t-2 border-border border-dashed">
                <h3 className="font-black text-[10px] sm:text-xs tracking-widest text-primary uppercase flex items-center gap-2">
                  <span className="bg-gemini-teal text-[#111] px-2 py-0.5 border-2 border-border shadow-[2px_2px_0_var(--border)]">Ringkasan Berjalan</span>
                  <div className="h-0.5 flex-1 bg-border ml-2" />
                </h3>
                <div className="bg-tertiary !rounded-none p-3 text-primary leading-relaxed whitespace-pre-wrap border-2 border-border shadow-[3px_3px_0_var(--border)] font-medium">
                  {rollingSummary}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        className="fixed inset-0 bg-overlay z-40 md:hidden animate-fade-in"
        onClick={() => setIsOpen(false)}
      />

      {/* Desktop Sidebar & Mobile Floating Tab */}
      <div className={`
        fixed inset-y-0 right-0 z-50 h-full w-[85%] sm:w-80 flex flex-col bg-secondary !rounded-none border-l-2 border-border shadow-[-4px_0_0_var(--border)] transition-transform duration-300
        md:relative md:inset-auto md:h-full md:w-80 md:z-auto
      `}>
        {panelContent}
      </div>
    </>
  );
}
