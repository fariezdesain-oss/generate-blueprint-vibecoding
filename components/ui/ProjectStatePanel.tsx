'use client';

import { useState, useEffect } from 'react';
import { ChevronRight, FileJson } from 'lucide-react';
import type { ProjectState } from '@/lib/utils/projectState';

interface ProjectStatePanelProps {
  sessionId: string;
}

export function ProjectStatePanel({ sessionId }: ProjectStatePanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [projectState, setProjectState] = useState<ProjectState | null>(null);
  const [rollingSummary, setRollingSummary] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchState() {
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
        setLoading(false);
      }
    }

    if (isOpen && !projectState) {
      fetchState();
    }
    
    // Auto-refresh when new message completes
    const handleRefresh = () => {
      if (isOpen) fetchState();
    };
    window.addEventListener('project-state-refresh', handleRefresh);
    return () => window.removeEventListener('project-state-refresh', handleRefresh);
  }, [sessionId, isOpen, projectState]);

  if (loading && isOpen) {
    return (
      <div className="w-80 h-full border-l border-subtle bg-secondary p-4 flex items-center justify-center">
        <div className="size-5 rounded-full border-2 border-subtle border-t-gemini-blue animate-spin" />
      </div>
    );
  }

  const hasData = projectState && Object.keys(projectState).length > 0;

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="absolute right-0 top-1/2 -translate-y-1/2 bg-tertiary border border-subtle border-r-0 rounded-l-xl p-2 text-tertiary hover:text-primary transition-colors"
        title="Buka Project State"
      >
        <FileJson size={20} />
      </button>
    );
  }

  return (
    <div className="w-80 h-full flex flex-col border-l border-subtle bg-secondary relative overflow-hidden transition-all duration-300 animate-fade-in">
      <div className="flex items-center justify-between p-4 border-b border-subtle">
        <h2 className="font-bold text-primary flex items-center gap-2 text-sm">
          <FileJson size={18} className="text-gemini-blue" />
          Project State
        </h2>
        <button
          onClick={() => setIsOpen(false)}
          className="p-1 rounded-lg hover:bg-tertiary text-tertiary hover:text-primary transition-colors"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 text-sm">
        {!hasData && !rollingSummary ? (
          <p className="text-tertiary text-center text-xs mt-10">
            State belum terbentuk. Lanjutkan chat untuk mengisi state.
          </p>
        ) : (
          <>
            {hasData && (
              <div className="space-y-4">
                <h3 className="font-semibold text-xs tracking-wider text-tertiary uppercase">State Terstruktur</h3>
                {Object.entries(projectState!).map(([key, value]) => (
                  <div key={key} className="space-y-1">
                    <p className="text-xs font-semibold text-secondary capitalize">{key.replace(/_/g, ' ')}</p>
                    <div className="bg-tertiary rounded-xl p-3 text-xs text-primary font-mono whitespace-pre-wrap">
                      {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {rollingSummary && (
              <div className="space-y-2">
                <h3 className="font-semibold text-xs tracking-wider text-tertiary uppercase">Ringkasan Berjalan</h3>
                <div className="bg-tertiary rounded-xl p-3 text-xs text-primary leading-relaxed whitespace-pre-wrap">
                  {rollingSummary}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
