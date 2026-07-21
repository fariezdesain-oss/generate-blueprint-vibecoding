'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, FileText, Wand2 } from 'lucide-react';
import { useChatStore } from '@/store/useChatStore';

interface SessionItem {
  id: string;
  title: string;
  mode?: string;
  created_at: string;
  updated_at?: string;
  has_generated?: boolean;
  has_n8n?: boolean;
}

export function SidebarHistory({ onItemClick }: { onItemClick?: () => void }) {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<SessionItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const sidebarVersion = useChatStore((s) => s.sidebarVersion);
  const sessionId = useChatStore((s) => s.sessionId);
  const resetChatStore = useChatStore((s) => s.reset);

  const fetchSessions = async () => {
    if (document.hidden) return;
    try {
      const res = await fetch('/api/sessions');
      const json = await res.json();
      if (json.success) {
        setSessions(json.data.sessions);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [sidebarVersion]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    
    const startPolling = () => {
      interval = setInterval(fetchSessions, 30000);
    };
    
    const handleVisibility = () => {
      if (document.hidden) {
        clearInterval(interval);
      } else {
        fetchSessions();
        startPolling();
      }
    };

    startPolling();
    document.addEventListener('visibilitychange', handleVisibility);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const handleDeleteClick = (s: SessionItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTarget(s);
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/sessions/${deleteTarget.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setSessions((prev) => prev.filter((s) => s.id !== deleteTarget.id));
        if (deleteTarget.id === sessionId) {
          resetChatStore();
          sessionStorage.removeItem('activeSessionId');
          router.push('/chat');
        }
      }
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const cancelDelete = () => setDeleteTarget(null);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">

      {loading && sessions.length === 0 ? (
        <div className="flex justify-center py-4 border-2 border-border !rounded-none bg-secondary shadow-[4px_4px_0_var(--border)]">
          <Wand2 size={24} className="animate-wand-swing text-primary stroke-[2.5px]" />
        </div>
      ) : sessions.length === 0 ? (
        <p className="px-3 text-xs font-bold text-tertiary uppercase tracking-widest text-center mt-4">No sessions yet</p>
      ) : (
        <div className="flex flex-col gap-2 flex-1 overflow-y-auto pr-2 pb-2 pt-1">
          {sessions.map((s) => {
            const isActive = s.id === sessionId;
            return (
              <div
                key={s.id}
                onClick={() => {
                  onItemClick?.();
                  router.push(`/chat?id=${s.id}`);
                }}
                className={`group flex cursor-pointer items-center gap-2 !rounded-none px-3 py-2.5 text-sm transition-all duration-200 border-2 border-border ${
                  isActive
                    ? 'bg-gemini-blue text-white font-bold shadow-[3px_3px_0_var(--border)] translate-x-[1px] translate-y-[1px]'
                    : 'bg-secondary text-secondary font-semibold hover:bg-tertiary hover:text-primary hover:shadow-[3px_3px_0_var(--border)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_var(--border)]'
                }`}
              >
                <span className="flex-1 truncate font-bold">{s.title}</span>
                {s.has_generated && (
                  <span className={`shrink-0 !rounded-none border-2 border-border px-2 py-0.5 text-[10px] font-black shadow-[1px_1px_0_var(--border)] ${isActive ? 'bg-gemini-orange text-[#111]' : 'bg-gemini-blue text-white'}`}>
                    DOCS
                  </span>
                )}
                {s.has_n8n && (
                  <span className={`shrink-0 !rounded-none border-2 border-border px-2 py-0.5 text-[10px] font-black shadow-[1px_1px_0_var(--border)] ${isActive ? 'bg-gemini-teal text-[#111]' : 'bg-[#111] text-emerald-400'}`}>
                    N8N
                  </span>
                )}
                    {(s.has_generated || s.has_n8n) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onItemClick?.();
                          const modeParam = s.has_n8n ? '&mode=n8n' : '';
                          router.push(`/generate/results?session_id=${s.id}${modeParam}`);
                        }}
                        className={`shrink-0 !rounded-none p-1.5 max-md:opacity-100 md:opacity-0 transition-all duration-200 border-2 border-transparent md:group-hover:opacity-100 active:translate-y-[1px] ${
                          isActive ? 'hover:border-border hover:bg-white/20' : 'hover:border-border hover:bg-white hover:text-gemini-teal hover:shadow-[2px_2px_0_var(--border)]'
                        }`}
                        title={s.has_n8n ? 'View n8n Workflow' : 'View Docs'}
                      >
                        <FileText size={14} className="stroke-[2.5px]" />
                      </button>
                    )}
                    <button
                      onClick={(e) => handleDeleteClick(s, e)}
                      className={`shrink-0 !rounded-none p-1.5 max-md:opacity-100 md:opacity-0 transition-all duration-200 border-2 border-transparent md:group-hover:opacity-100 active:translate-y-[1px] ${
                        isActive ? 'hover:border-border hover:bg-gemini-red/50 hover:text-[#fff]' : 'hover:border-border hover:bg-gemini-red hover:text-[#fff] hover:shadow-[2px_2px_0_var(--border)]'
                      }`}
                    >
                      <X size={14} className="stroke-[2.5px]" />
                    </button>
              </div>
            );
          })}
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay ">
          <div className="animate-fade-in-up mx-4 w-full max-w-sm brutal-card !rounded-none p-6 sm:p-8 text-center !shadow-[6px_6px_0_var(--border)] bg-secondary">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center !rounded-none bg-gemini-red border-2 border-border shadow-[2px_2px_0_var(--border)]">
              <svg className="size-7 text-[#111] stroke-[2.5px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>
            <h3 className="mb-2 text-xl font-black uppercase tracking-widest text-primary">Hapus Sesi Percakapan</h3>
            <div className="mx-auto mb-4 mt-2 h-[2px] w-16 bg-border" />
            <p className="mb-2 text-sm font-semibold text-secondary">
              Anda yakin ingin menghapus sesi ini?
            </p>
            <div className="mb-6 !rounded-none border-2 border-border bg-tertiary px-3 py-2 text-left font-mono text-sm font-black text-primary shadow-[inset_2px_2px_0_rgba(0,0,0,0.1)]">
              {deleteTarget.title.length > 40 ? deleteTarget.title.slice(0, 40) + '...' : deleteTarget.title}
            </div>
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <button
                onClick={cancelDelete}
                disabled={deleting}
                className="flex-1 !rounded-none border-2 border-border py-2.5 text-sm font-bold uppercase text-secondary transition-all duration-200 hover:bg-tertiary shadow-[3px_3px_0_var(--border)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_var(--border)] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:translate-x-0 disabled:active:translate-y-0 disabled:active:shadow-[3px_3px_0_var(--border)]"
              >
                Tidak
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex items-center justify-center gap-2 flex-1 !rounded-none border-2 border-border bg-gemini-red py-2.5 text-sm font-black uppercase text-white transition-all duration-200 hover:bg-gemini-red/90 shadow-[3px_3px_0_var(--border)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_var(--border)] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-x-0 disabled:active:translate-y-0 disabled:active:shadow-[3px_3px_0_var(--border)]"
              >
                {deleting ? (
                  <><Wand2 size={16} className="animate-wand-swing" /> Menghapus...</>
                ) : (
                  'Ya, Hapus'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
