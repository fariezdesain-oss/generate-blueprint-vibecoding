'use client';

import { useState, useEffect } from 'react';
import { ChevronRight, FileJson, X , Wand2} from 'lucide-react';
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
      <>
        <button
          onClick={() => setIsOpen(true)}
          className="absolute right-0 top-1/2 -translate-y-1/2 bg-tertiary border border-subtle border-r-0 rounded-l-xl p-2.5 text-tertiary hover:text-primary transition-all shadow-[var(--shadow)]  hidden md:block z-40"
          title="Buka Project State"
        >
          <FileJson size={20} />
        </button>
        
        <button
          onClick={() => setIsOpen(true)}
          className="absolute right-4 bottom-24 bg-gemini-blue text-white rounded-full p-3 shadow-[var(--shadow)]  md:hidden z-40 animate-fade-in-up"
          title="Buka Project State"
        >
          <FileJson size={20} />
        </button>
      </>
    );
  }

  const renderValue = (value: unknown) => {
    if (Array.isArray(value)) {
      if (value.length === 0) return <span className="text-tertiary italic">- Kosong -</span>;
      return (
        <ul className="list-disc pl-4 space-y-1">
          {value.map((item, i) => (
            <li key={i}>{String(item)}</li>
          ))}
        </ul>
      );
    }
    if (typeof value === 'object' && value !== null) {
      return (
        <pre className="font-mono text-[10px] sm:text-xs overflow-x-auto text-secondary">
          {JSON.stringify(value, null, 2)}
        </pre>
      );
    }
    return <span>{String(value || '-')}</span>;
  };

  const panelContent = (
    <>
      <div className="flex items-center justify-between p-4 border-b border-subtle shrink-0">
        <h2 className="font-bold text-primary flex items-center gap-2 text-sm">
          <FileJson size={18} className="text-secondary" />
          Project State
          {isRefreshing && <Wand2 className="size-3 animate-wand-swing text-gemini-blue ml-2" />}
        </h2>
        <button
          onClick={() => setIsOpen(false)}
          className="p-1.5 rounded-lg hover:bg-tertiary text-tertiary hover:text-primary transition-colors"
        >
          <span className="hidden md:block"><ChevronRight size={18} /></span>
          <span className="block md:hidden"><X size={18} /></span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 text-xs sm:text-sm">
        {!hasData && !rollingSummary ? (
          <p className="text-tertiary text-center mt-10">
            State belum terbentuk. Lanjutkan chat untuk mengisi state.
          </p>
        ) : (
          <>
            {hasData && (
              <div className="space-y-4">
                <h3 className="font-semibold text-[10px] sm:text-xs tracking-wider text-tertiary uppercase flex items-center gap-2">
                  <span>State Terstruktur</span>
                  <div className="h-px flex-1 bg-subtle" />
                </h3>
                {Object.entries(projectState!).map(([key, value]) => (
                  <div key={key} className="space-y-1.5">
                    <p className="font-bold text-gemini-blue capitalize">
                      {key.replace(/_/g, ' ')}
                    </p>
                    <div className="bg-tertiary/50 rounded-xl p-3 text-primary leading-relaxed border border-subtle/50">
                      {renderValue(value)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {rollingSummary && (
              <div className="space-y-4 pt-2">
                <h3 className="font-semibold text-[10px] sm:text-xs tracking-wider text-tertiary uppercase flex items-center gap-2">
                  <span>Ringkasan Berjalan</span>
                  <div className="h-px flex-1 bg-subtle" />
                </h3>
                <div className="bg-tertiary/50 rounded-xl p-3 text-primary leading-relaxed whitespace-pre-wrap border border-subtle/50">
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
        className="fixed inset-0 bg-overlay/50 z-40 md:hidden animate-fade-in"
        onClick={() => setIsOpen(false)}
      />
      
      {/* Desktop Sidebar & Mobile Bottom Sheet */}
      <div className={`
        fixed inset-x-0 bottom-0 z-50 h-[75vh] flex flex-col bg-secondary rounded-t-3xl border-t border-subtle shadow-[var(--shadow)] transition-transform duration-300 transform translate-y-0
        md:relative md:inset-auto md:h-full md:w-80 md:rounded-none md:border-t-0 md:border-l md:shadow-none md:translate-y-0 md:flex md:z-auto
      `}>
        {/* Mobile Pull Indicator */}
        <div className="w-full flex justify-center py-2 md:hidden cursor-pointer" onClick={() => setIsOpen(false)}>
          <div className="w-12 h-1.5 bg-tertiary rounded-full" />
        </div>
        {panelContent}
      </div>
    </>
  );
}
