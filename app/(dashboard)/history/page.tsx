'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, MessageSquare, Plus, FileText, Wand2 } from 'lucide-react';
import { useChatStore } from '@/store/useChatStore';

interface SessionItem {
  id: string;
  title: string;
  created_at: string;
  mode?: string;
  has_generated?: boolean;
  has_n8n?: boolean;
}

export default function HistoryPage() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [navigating, setNavigating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SessionItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

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
  }, []);

  const handleDeleteClick = (s: SessionItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteError(null);
    setDeleteTarget(s);
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/sessions/${deleteTarget.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || 'Gagal menghapus sesi');

      setSessions((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      useChatStore.getState().bumpSidebar();
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Gagal menghapus sesi');
    } finally {
      setDeleting(false);
    }
  };

  const cancelDelete = () => {
    setDeleteError(null);
    setDeleteTarget(null);
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Wand2 className="size-6 animate-wand-swing text-gemini-blue" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl p-4 sm:p-6">
      <div className="mb-4 sm:mb-6 lg:mb-8 flex items-center justify-between">
        <div>
          <h1 data-testid="history-heading" className="font-display text-primary text-lg sm:text-xl lg:text-2xl font-bold">History</h1>
          <p className="mt-1 text-xs sm:text-sm text-tertiary">Riwayat sesi percakapan</p>
        </div>
        <button
          onClick={async () => {
            setNavigating(true);
            useChatStore.getState().reset();
            sessionStorage.removeItem('activeSessionId');
            await new Promise(r => setTimeout(r, 400)); // Sedikit delay agar user lihat loading
            router.push('/chat');
          }}
          disabled={navigating}
          className="btn-gradient flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 lg:px-5 lg:py-2.5 text-xs sm:text-sm disabled:opacity-50"
        >
          {navigating ? <Wand2 size={16} className="animate-wand-swing" /> : <Plus size={16} />}
          {navigating ? 'Memuat...' : 'New Chat'}
        </button>
      </div>

      {sessions.length === 0 && (
        <div className="flex flex-col items-center gap-3 sm:gap-4 py-8 sm:py-12">
          <div className="flex size-12 sm:size-16 items-center justify-center !rounded-none border-2 border-border shadow-[4px_4px_0_var(--border)]">
            <Wand2 className="size-8 text-tertiary" />
          </div>
          <p className="text-sm text-tertiary">Belum ada sesi</p>
        </div>
      )}

      <div className="space-y-3">
        {sessions.map((s) => (
              <div
                data-testid="session-item"
                key={s.id}
                onClick={() => router.push(`/chat?id=${s.id}`)}
            className="card-gemini group flex cursor-pointer items-center justify-between"
          >
            <div className="flex items-center gap-5">
              <div className="flex size-10 sm:size-12 items-center justify-center !rounded-none border-2 border-border bg-secondary shadow-[4px_4px_0_var(--border)] transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0_var(--border)]">
                <MessageSquare size={18} className="text-tertiary" />
              </div>
              <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-primary transition-colors">
                      {s.title}
                    </p>
                    {s.has_generated && (
                      <span className="!rounded-none border-2 border-border shadow-[1px_1px_0_var(--border)] bg-gemini-blue text-white uppercase px-2.5 py-0.5 text-[10px] font-bold text-white">
                        DOCS
                      </span>
                    )}
                    {s.has_n8n && (
                      <span className="!rounded-none border-2 border-border shadow-[1px_1px_0_var(--border)] bg-gemini-blue text-white uppercase px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
                        N8N
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-tertiary">
                    {new Date(s.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {s.has_n8n && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/generate/results?session_id=${s.id}&mode=n8n`);
                    }}
                    className="!rounded-none border-2 border-transparent p-2 text-tertiary transition-all duration-200 hover:bg-tertiary hover:text-emerald-400"
                    title="View n8n Workflow"
                  >
                    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                    </svg>
                  </button>
                )}
                {s.has_generated && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/generate/results?session_id=${s.id}`);
                    }}
                    className="!rounded-none border-2 border-transparent p-2 text-tertiary transition-all duration-200 hover:bg-tertiary hover:text-gemini-teal"
                    title="View Docs"
                  >
                    <FileText size={16} />
                  </button>
                )}
              <button
                onClick={(e) => handleDeleteClick(s, e)}
                className="!rounded-none border-2 border-transparent p-2 text-tertiary transition-all duration-200 hover:bg-red-500/10 hover:text-red-400"
                title="Delete session"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay ">
          <div className="animate-fade-in-up mx-4 w-full max-w-sm brutal-card !rounded-none p-6 sm:p-8 text-center !shadow-[6px_6px_0_var(--border)]">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center !rounded-none bg-gemini-red border-2 border-border">
              <svg className="size-7 text-[#111]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>
            <h3 className="mb-2 text-xl font-black uppercase tracking-widest text-primary">Hapus Sesi Percakapan</h3>
            <div className="mx-auto mb-4 mt-2 h-[2px] w-16 bg-border" />
            <p className="mb-2 text-sm text-secondary">
              Anda yakin ingin menghapus sesi ini?
            </p>
            <div className="mb-6 border-l-4 border-gemini-red bg-tertiary px-3 py-2 text-left font-mono text-sm font-bold text-primary">
              {deleteTarget.title.length > 40 ? deleteTarget.title.slice(0, 40) + '...' : deleteTarget.title}
            </div>
            {deleteError && (
              <p className="mb-4 !rounded-none border-2 border-border bg-gemini-red text-white font-black uppercase shadow-[2px_2px_0_var(--border)] px-3 py-2 text-sm text-red-400">
                {deleteError}
              </p>
            )}
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
