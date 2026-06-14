'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, MessageSquare, Plus, FileText, Sparkles } from 'lucide-react';
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
  const [deleteTarget, setDeleteTarget] = useState<SessionItem | null>(null);
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
    setDeleteTarget(s);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const res = await fetch(`/api/sessions/${deleteTarget.id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      setSessions((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      useChatStore.getState().bumpSidebar();
    }
    setDeleteTarget(null);
  };

  const cancelDelete = () => setDeleteTarget(null);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="size-6 rounded-full border-2 border-subtle border-t-gemini-blue animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl p-4 sm:p-6">
      <div className="mb-5 sm:mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-gradient text-xl sm:text-2xl font-bold">History</h1>
          <p className="mt-1 text-sm text-tertiary">Riwayat sesi percakapan</p>
        </div>
        <button
          onClick={() => {
            useChatStore.getState().bumpNewChat();
            router.push('/chat');
          }}
          className="btn-gradient flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 text-sm"
        >
          <Plus size={16} />
          New Chat
        </button>
      </div>

      {sessions.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-10 sm:py-16">
          <div className="flex size-12 sm:size-16 items-center justify-center rounded-2xl bg-tertiary ring-1 ring-[var(--border)]">
            <Sparkles className="size-8 text-tertiary" />
          </div>
          <p className="text-sm text-tertiary">Belum ada sesi</p>
        </div>
      )}

      <div className="space-y-3">
        {sessions.map((s) => (
          <div
            key={s.id}
            onClick={() => router.push(`/chat?id=${s.id}`)}
            className="card-gemini group flex cursor-pointer items-center justify-between"
          >
            <div className="flex items-center gap-5">
              <div className="flex size-10 sm:size-12 items-center justify-center rounded-xl bg-tertiary ring-1 ring-[var(--border)]">
                <MessageSquare size={18} className="text-tertiary" />
              </div>
              <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-primary transition-colors">
                      {s.title}
                    </p>
                    {s.has_generated && (
                      <span className="rounded-full bg-gradient-to-r from-gemini-blue/20 to-gemini-blue/20 px-2.5 py-0.5 text-[10px] font-bold text-gemini-blue">
                        DOCS
                      </span>
                    )}
                    {s.has_n8n && (
                      <span className="rounded-full bg-gradient-to-r from-emerald-500/20 to-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
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
                    className="rounded-xl p-2.5 text-tertiary transition-all duration-200 hover:bg-tertiary hover:text-emerald-400"
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
                    className="rounded-xl p-2.5 text-tertiary transition-all duration-200 hover:bg-tertiary hover:text-gemini-teal"
                    title="View Docs"
                  >
                    <FileText size={16} />
                  </button>
                )}
              <button
                onClick={(e) => handleDeleteClick(s, e)}
                className="rounded-xl p-2.5 text-tertiary transition-all duration-200 hover:bg-red-500/10 hover:text-red-400"
                title="Delete session"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-sm">
          <div className="animate-fade-in-up mx-4 w-full max-w-sm glass rounded-2xl p-4 sm:p-6 text-center shadow-2xl">
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
            <div className="flex gap-3">
              <button
                onClick={cancelDelete}
                className="flex-1 rounded-xl border border-subtle py-2.5 text-sm font-medium text-secondary transition-all duration-200 hover:bg-tertiary hover:text-primary"
              >
                Tidak
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:bg-red-400"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
