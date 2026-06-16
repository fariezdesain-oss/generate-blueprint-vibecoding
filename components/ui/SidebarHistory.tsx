'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Plus, X, FileText, Loader2 } from 'lucide-react';
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
  const pathname = usePathname();
  const sidebarVersion = useChatStore((s) => s.sidebarVersion);
  const sessionId = useChatStore((s) => s.sessionId);
  const resetChatStore = useChatStore((s) => s.reset);

  const fetchSessions = async () => {
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
  }, [pathname, sidebarVersion]);

  useEffect(() => {
    const interval = setInterval(fetchSessions, 30000);
    return () => clearInterval(interval);
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
    <div className="flex flex-1 flex-col">
      <button
        onClick={() => {
          onItemClick?.();
          resetChatStore();
          sessionStorage.removeItem('activeSessionId');
          router.push('/chat');
        }}
        className="group mb-4 flex items-center gap-2 rounded-xl border border-dashed border-subtle px-3 py-3 text-sm font-semibold text-tertiary transition-all duration-200 hover:border-gemini-blue/30 hover:bg-tertiary hover:text-gemini-blue"
      >
        <Plus size={16} />
        <span>New Chat</span>
      </button>

      {loading && sessions.length === 0 ? (
        <div className="flex justify-center py-4">
          <div className="size-4 rounded-full border-2 border-white/20 border-t-gemini-blue animate-spin" />
        </div>
      ) : sessions.length === 0 ? (
        <p className="px-3 text-xs text-white/20">No sessions yet</p>
      ) : (
        <div className="flex flex-col gap-1">
          {sessions.map((s) => {
            const isActive = s.id === sessionId;
            return (
              <div
                key={s.id}
                onClick={() => {
                  onItemClick?.();
                  router.push(`/chat?id=${s.id}`);
                }}
                className={`group flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 ${
                  isActive
                    ? 'bg-tertiary text-primary font-bold ring-1 ring-gemini-blue/20'
                    : 'text-tertiary font-semibold hover:bg-tertiary hover:text-secondary'
                }`}
              >
                <span className="flex-1 truncate">{s.title}</span>
                {s.has_generated && (
                  <span className="shrink-0 rounded-full bg-gradient-to-r from-gemini-blue/20 to-gemini-blue/20 px-2.5 py-0.5 text-[10px] font-bold text-gemini-blue">
                    DOCS
                  </span>
                )}
                {s.has_n8n && (
                  <span className="shrink-0 rounded-full bg-gradient-to-r from-emerald-500/20 to-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
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
                    className="shrink-0 rounded-lg p-1.5 max-md:opacity-100 md:opacity-0 transition-all duration-200 hover:bg-tertiary hover:text-gemini-teal md:group-hover:opacity-100"
                    title={s.has_n8n ? 'View n8n Workflow' : 'View Docs'}
                  >
                    <FileText size={12} />
                  </button>
                )}
                <button
                  onClick={(e) => handleDeleteClick(s, e)}
                  className="shrink-0 rounded-lg p-1.5 max-md:opacity-100 md:opacity-0 transition-all duration-200 hover:bg-red-500/10 hover:text-red-400 md:group-hover:opacity-100"
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-sm">
          <div className="animate-fade-in-up mx-4 w-full max-w-sm glass rounded-2xl p-6 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-red-500/10 ring-1 ring-red-500/20">
              <svg className="size-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-semibold text-primary">Hapus Sesi Percakapan</h3>
            <p className="mb-1 text-sm text-secondary">
              Anda yakin ingin menghapus sesi ini?
            </p>
            <p className="mb-6 text-sm font-medium text-gemini-blue">
              &ldquo;{deleteTarget.title.length > 40 ? deleteTarget.title.slice(0, 40) + '...' : deleteTarget.title}&rdquo;
            </p>
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <button
                onClick={cancelDelete}
                disabled={deleting}
                className="flex-1 rounded-xl border border-subtle py-2.5 text-sm font-medium text-secondary transition-all duration-200 hover:bg-tertiary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
              >
                Tidak
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex items-center justify-center gap-2 flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting ? (
                  <><Loader2 size={16} className="animate-spin" /> Menghapus...</>
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
