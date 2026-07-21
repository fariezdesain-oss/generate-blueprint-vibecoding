'use client';

import { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Copy, Download, FileText, Archive, RefreshCw, Wand2, Workflow } from 'lucide-react';
import { FILE_ORDER, FILE_LABELS } from '@/lib/utils/sequentialPrompts';
const N8nVisualizer = dynamic(
  () => import('@/components/ui/n8n/N8nVisualizer').then((m) => m.N8nVisualizer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[400px] items-center justify-center !rounded-none border-2 border-border bg-tertiary shadow-[6px_6px_0_var(--border)]">
        <Wand2 className="size-6 animate-wand-swing text-tertiary" />
      </div>
    ),
  }
);

const MarkdownRenderer = dynamic(
  () => import('@/components/ui/MarkdownRenderer').then((m) => m.MarkdownRenderer),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-3 p-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-4 !rounded-none bg-border animate-pulse" style={{ width: `${70 + (i % 3) * 10}%` }} />
        ))}
      </div>
    ),
  }
);

interface GenerateData {
  content?: string;
  files: Record<string, string>;
}

interface N8nData {
  workflow_json: Record<string, unknown>;
  template_name: string;
  template_label: string;
  setup_instructions?: string;
}

import { useChatStore } from '@/store/useChatStore';

function GenerateResultsContent() {
  const [data, setData] = useState<GenerateData | null>(null);
  const [n8nData, setN8nData] = useState<N8nData | null>(null);
  const [activeFile, setActiveFile] = useState(FILE_ORDER[0]);
  const [copied, setCopied] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [genProgress, setGenProgress] = useState<{
    fileName: string;
    fileProgress: number;
    overallProgress: number;
    stageMessage: string;
    showModal: boolean;
  } | null>(null);
  const [n8nTab, setN8nTab] = useState<'json' | 'setup'>('json');
  const [error, setError] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const isN8n = searchParams.get('mode') === 'n8n';

  const setIsGeneratingDocs = useChatStore((s) => s.setIsGeneratingDocs);

  useEffect(() => {
    setIsGeneratingDocs(!!regenerating);
    return () => setIsGeneratingDocs(false);
  }, [regenerating, setIsGeneratingDocs]);

  const loadFiles = useCallback(async () => {
    if (!sessionId) {
      setLoading(false);
      router.replace('/chat');
      return;
    }

    setLoading(true);
    setError(null);

  if (isN8n) {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/files`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data.n8n_workflow) {
            setN8nData({
              workflow_json: json.data.n8n_workflow,
              template_name: json.data.n8n_template_name || '',
              template_label: json.data.n8n_template_label || 'n8n Workflow',
              setup_instructions: json.data.setup_instructions || '',
            });
            setLoading(false);
            return;
          }
        }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Gagal memuat workflow n8n');
        }
        setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/sessions/${sessionId}/files`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data.files && Object.keys(json.data.files).length > 0) {
          setData({ files: json.data.files });
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat dokumen');
    }

    const raw = sessionStorage.getItem(`generateResult_${sessionId}`);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.files && Object.keys(parsed.files).length > 0) {
          setData({ files: parsed.files });
          setLoading(false);
          return;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Data hasil generate lokal tidak valid');
      }
    }

    setLoading(false);
  }, [sessionId, router, isN8n]);

  useEffect(() => {
    setLoading(true);
    loadFiles();
  }, [loadFiles]);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [activeFile]);

  const handleCopy = async (content: string, name: string) => {
    await navigator.clipboard.writeText(content);
    setCopied(name);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDownload = (content: string, name: string) => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadAll = async () => {
    if (!data) return;
    try {
      const res = await fetch('/api/generate/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: data.files }),
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'documentation.zip';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      setError(err instanceof Error ? err.message : 'Gagal mengunduh ZIP');
    }
  };

  const handleRegenerate = async (fileName: string) => {
    const files = data?.files || {};
    const currentGeneratedCount = FILE_ORDER.filter((name) => name in files).length;
    if (!sessionId || regenerating) return;
    const fileIndex = FILE_ORDER.indexOf(fileName);
    if (fileIndex === -1) return;

    // Freeze overall progress exactly at what it was before regenerating
    const frozenOverallProgress = Math.round((currentGeneratedCount / FILE_ORDER.length) * 100);

    setRegenerating(fileName);
    setError(null);
    setGenProgress({
      fileName,
      fileProgress: 25,
      overallProgress: frozenOverallProgress,
      stageMessage: `Mempersiapkan regenerasi ${FILE_LABELS[fileName] || fileName}...`,
      showModal: true,
    });

    const progressInterval = setInterval(() => {
      setGenProgress((prev) => {
        if (!prev || prev.fileProgress >= 95) return prev;
        const increment = prev.fileProgress < 60 ? 5 : 2;
        const newFileProgress = Math.min(prev.fileProgress + increment, 95);
        return {
          ...prev,
          fileProgress: newFileProgress,
          overallProgress: frozenOverallProgress // Tetap membekukan nilai untuk keseluruhan
        };
      });
    }, 800);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120000);

    try {
      const res = await fetch('/api/generate/sequential', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, file_index: fileIndex }),
        signal: controller.signal,
      });
      
      clearTimeout(timer);
      clearInterval(progressInterval);

      const json = await res.json();
      if (json.success) {
        sessionStorage.removeItem(`generateResult_${sessionId}`);
        setGenProgress({
          fileName,
          fileProgress: 100,
          overallProgress: frozenOverallProgress,
          stageMessage: `${FILE_LABELS[fileName] || fileName} selesai di-regenerate.`,
          showModal: true,
        });
        await loadFiles();
        setTimeout(() => {
          setGenProgress(null);
        }, 1000);
      } else {
        setError(json.error?.message || 'Gagal regenerate dokumen');
        setGenProgress(null);
      }
    } catch (err) {
      clearTimeout(timer);
      clearInterval(progressInterval);
      setGenProgress(null);
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('Regenerate memakan waktu terlalu lama. Coba lagi atau gunakan provider yang lebih cepat.');
      } else {
        setError(err instanceof Error ? err.message : 'Gagal regenerate dokumen');
      }
    } finally {
      setRegenerating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Wand2 className="size-5 sm:size-6 animate-wand-swing text-gemini-blue" />
      </div>
    );
  }

  if (error && !data && !n8nData) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 sm:gap-4 px-4 text-center">
        <p className="text-sm sm:text-lg text-red-400">{error}</p>
        <button
          onClick={() => router.push('/chat')}
          className="btn-gradient px-4 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-sm"
        >
          Kembali ke Chat
        </button>
      </div>
    );
  }

  if (isN8n) {
    if (!n8nData) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 sm:gap-4 ">
          <div className="flex size-12 sm:size-16 items-center justify-center !rounded-none border-2 border-border shadow-[4px_4px_0_var(--border)]">
            <Workflow className="size-6 sm:size-8 text-tertiary" />
          </div>
          <p className="text-sm sm:text-lg text-tertiary">Belum ada n8n workflow untuk sesi ini</p>
          <button
            onClick={() => router.push('/chat')}
            className="btn-gradient px-4 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-sm"
          >
            Kembali ke Chat
          </button>
        </div>
      );
    }

    const jsonStr = JSON.stringify(n8nData.workflow_json, null, 2);
    const hasSetup = !!n8nData.setup_instructions;

    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-subtle px-4 sm:px-6 py-3 sm:py-5 gap-2 sm:gap-0">
          <div>
            <h1 data-testid="results-heading" className="font-display text-primary text-lg sm:text-xl lg:text-2xl font-extrabold">n8n Workflow</h1>
            <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs font-semibold text-tertiary">Generated berdasarkan percakapan Anda</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 self-end sm:self-auto">
            <button
              onClick={() => router.push('/chat')}
              className="!rounded-none border-2 border-border shadow-[3px_3px_0_var(--border)] px-3 sm:px-4 lg:px-5 py-1.5 sm:py-2 lg:py-2.5 text-xs sm:text-sm font-semibold text-secondary transition-all duration-200 hover:bg-tertiary hover:text-primary"
            >
              Back to Chat
            </button>
            {n8nTab === 'json' && (
              <>
                <button
                  onClick={() => handleCopy(jsonStr, 'n8n')}
                  className="flex items-center gap-1.5 sm:gap-2 !rounded-none border-2 border-border shadow-[3px_3px_0_var(--border)] px-3 sm:px-4 py-1.5 sm:py-2 lg:py-2.5 text-xs sm:text-sm font-semibold text-secondary transition-all duration-200 hover:bg-tertiary hover:text-primary"
                >
                  <Copy className="size-3 sm:size-4" />
                  <span className="hidden sm:inline">{copied === 'n8n' ? 'Copied!' : 'Copy'}</span>
                  <span className="sm:hidden">{copied === 'n8n' ? 'Copied!' : 'Copy'}</span>
                </button>
                <button
                  data-testid="download-button"
                  onClick={() => handleDownload(jsonStr, 'n8n-workflow.json')}
                  className="btn-gradient flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 lg:px-5 py-1.5 sm:py-2 lg:py-2.5 text-xs sm:text-sm font-semibold"
                >
                  <Download className="size-3 sm:size-4" />
                  <span className="hidden sm:inline">Download .json</span>
                  <span className="sm:hidden">.json</span>
                </button>
              </>
            )}
          </div>
        </div>

        {hasSetup && (
          <div className="flex border-b border-subtle px-4 sm:px-6 overflow-x-auto">
            <button
              onClick={() => setN8nTab('json')}
              className={`shrink-0 border-b-2 px-3 sm:px-5 py-2 sm:py-3 text-xs sm:text-sm font-bold transition-all duration-200 ${
                n8nTab === 'json'
                  ? 'border-gemini-blue text-gemini-blue'
                  : 'border-transparent text-tertiary hover:text-secondary'
              }`}
            >
              Workflow JSON
            </button>
            <button
              onClick={() => setN8nTab('setup')}
              className={`shrink-0 border-b-2 px-3 sm:px-5 py-2 sm:py-3 text-xs sm:text-sm font-bold transition-all duration-200 ${
                n8nTab === 'setup'
                  ? 'border-emerald-400 text-emerald-400'
                  : 'border-transparent text-tertiary hover:text-secondary'
              }`}
            >
              Setup Instructions
            </button>
          </div>
        )}

        <div className="flex-1 overflow-hidden p-0 m-0 relative">
          {n8nTab === 'json' ? (
            <N8nVisualizer workflowJson={jsonStr} />
          ) : (
            <div className="mx-auto max-w-3xl overflow-y-auto h-full p-4 sm:p-8">
              <div className="mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3 !rounded-none border-2 border-border bg-secondary shadow-[4px_4px_0_var(--border)] px-4 sm:px-5 py-3 sm:py-4">
                <div className="flex size-8 sm:size-10 shrink-0 items-center justify-center !rounded-none border-2 border-border bg-gemini-blue shadow-[2px_2px_0_var(--border)] text-[#111]">
                  <svg className="size-4 sm:size-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-bold text-primary">Yang Perlu Disetup</p>
                  <p className="text-[10px] sm:text-xs text-tertiary">Ikuti panduan di bawah agar workflow berjalan dengan semestinya</p>
                </div>
              </div>
              <div className="prose prose-invert max-w-none text-sm leading-relaxed text-primary">
                <MarkdownRenderer content={n8nData.setup_instructions!} />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 sm:gap-4 ">
        <div className="flex size-12 sm:size-16 items-center justify-center !rounded-none border-2 border-border shadow-[4px_4px_0_var(--border)]">
          <FileText className="size-6 sm:size-8 text-tertiary" />
        </div>
        <p className="text-sm sm:text-lg text-tertiary">Belum ada hasil generate untuk sesi ini</p>
        <button
          onClick={() => router.push('/chat')}
          className="btn-gradient px-4 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-sm"
        >
          Kembali ke Chat
        </button>
      </div>
    );
  }

  const files = data.files || {};
  const generatedCount = FILE_ORDER.filter((name) => name in files).length;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-subtle px-4 sm:px-6 py-3 sm:py-5 gap-2 sm:gap-0">
        <div>
          <h1 className="font-display text-primary text-lg sm:text-xl lg:text-2xl font-extrabold">Generated Documentation</h1>
          <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs font-semibold text-tertiary">{generatedCount} / {FILE_ORDER.length} files generated</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 self-end sm:self-auto">
          <button
            onClick={() => router.push(`/chat?id=${sessionId}`)}
            className="!rounded-none border-2 border-border shadow-[3px_3px_0_var(--border)] px-3 sm:px-4 lg:px-5 py-1.5 sm:py-2 lg:py-2.5 text-xs sm:text-sm font-semibold text-secondary transition-all duration-200 hover:bg-tertiary hover:text-primary"
          >
            Back to Chat
          </button>
          <button
                  data-testid="download-button"
                  onClick={handleDownloadAll}
            className="btn-gradient flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 lg:px-5 py-1.5 sm:py-2 lg:py-2.5 text-xs sm:text-sm font-semibold"
          >
            <Archive className="size-3 sm:size-4" />
            <span className="hidden sm:inline">Download All (.zip)</span>
            <span className="sm:hidden">.zip</span>
          </button>
        </div>
      </div>

      {/* Mobile: horizontal file selector row */}
      <div className="flex md:hidden overflow-x-auto border-b border-subtle px-3 sm:px-4 py-2 gap-1.5">
        {FILE_ORDER.map((name) => {
          const hasFile = name in files;
          const isRegenerating = regenerating === name;
          const isActive = activeFile === name;
          return (
            <button
              key={name}
              onClick={() => hasFile && !isRegenerating && setActiveFile(name)}
              disabled={!hasFile || isRegenerating}
              className={`shrink-0 !rounded-none border-2 border-border shadow-[2px_2px_0_var(--border)] px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                isActive && hasFile
                  ? 'bg-gemini-blue/10 text-gemini-blue border border-gemini-blue/20'
                  : hasFile
                    ? 'bg-tertiary text-secondary border border-subtle hover:bg-tertiary hover:text-primary'
                    : 'bg-tertiary/50 text-tertiary border border-subtle'
              }`}
            >
              {name}
              {!hasFile && !isRegenerating && <span className="ml-1 text-[10px]">—</span>}
              {isRegenerating && <Wand2 className="ml-1.5 size-3 animate-wand-swing text-gemini-blue" />}
            </button>
          );
        })}
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="hidden md:block w-60 lg:w-72 overflow-y-auto border-r border-subtle p-4 lg:p-5">
          <div className="space-y-1">
            {FILE_ORDER.map((name) => {
              const hasFile = name in files;
              const isRegenerating = regenerating === name;
              const isActive = activeFile === name;
              return (
                <button
                  key={name}
                  onClick={() => hasFile && !isRegenerating && setActiveFile(name)}
                  disabled={!hasFile || isRegenerating}
                  className={`flex w-full items-center gap-2.5 lg:gap-3 !rounded-none border-2 border-border shadow-[2px_2px_0_var(--border)] px-2.5 lg:px-3 py-2 lg:py-3 text-left text-xs lg:text-sm transition-all duration-200 ${
                    isActive && hasFile
                      ? 'card-gemini-active text-gemini-blue font-bold'
                      : hasFile
                        ? 'text-secondary font-semibold hover:bg-tertiary hover:text-primary'
                        : 'text-tertiary font-semibold'
                  }`}
                >
                  <FileText className="size-3.5 lg:size-4 shrink-0" />
                  <span className="truncate">{name}</span>
                  {isRegenerating && (
                    <Wand2 className="ml-auto size-3 animate-wand-swing text-gemini-blue" />
                  )}
                  {!hasFile && !isRegenerating && <span className="ml-auto text-[10px] lg:text-[11px] font-bold text-tertiary">—</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden">
          {files[activeFile] ? (
            <>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-subtle px-4 sm:px-6 py-3 sm:py-4 gap-2 sm:gap-0">
                <div>
                  <h2 className="text-sm sm:text-base font-extrabold text-primary">{activeFile}</h2>
                  <p className="text-[10px] sm:text-[11px] font-semibold text-tertiary">{FILE_LABELS[activeFile] || ''}</p>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 self-end sm:self-auto">
                  <button
                    onClick={() => handleRegenerate(activeFile)}
                    disabled={regenerating !== null}
                    className="flex items-center gap-1 sm:gap-2 !rounded-none border-2 border-border shadow-[2px_2px_0_var(--border)] px-2.5 sm:px-4 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold text-secondary transition-all duration-200 hover:bg-tertiary hover:text-primary disabled:opacity-40"
                  >
                    <RefreshCw className={`size-3 sm:size-3.5 ${regenerating === activeFile ? 'animate-spin text-gemini-blue' : ''}`} />
                    <span className="hidden sm:inline">{regenerating === activeFile ? `Regenerating...` : 'Regenerate'}</span>
                  </button>
                  <button
                    onClick={() => handleCopy(files[activeFile], activeFile)}
                    className="flex items-center gap-1 sm:gap-2 !rounded-none border-2 border-border shadow-[2px_2px_0_var(--border)] px-2.5 sm:px-4 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold text-secondary transition-all duration-200 hover:bg-tertiary hover:text-primary"
                  >
                    <Copy className="size-3 sm:size-3.5" />
                    {copied === activeFile ? 'Copied!' : 'Copy'}
                  </button>
                  <button
                    onClick={() => handleDownload(files[activeFile], activeFile)}
                    className="flex items-center gap-1 sm:gap-2 !rounded-none border-2 border-border shadow-[2px_2px_0_var(--border)] px-2.5 sm:px-4 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold text-secondary transition-all duration-200 hover:bg-tertiary hover:text-primary"
                  >
                    <Download className="size-3 sm:size-3.5" />
                    Download
                  </button>
                </div>
              </div>
              <div ref={contentRef} className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                <div className="mx-auto max-w-3xl">
                  <MarkdownRenderer content={files[activeFile]} />
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 sm:gap-4 ">
              <div className="flex size-12 sm:size-16 items-center justify-center !rounded-none border-2 border-border shadow-[4px_4px_0_var(--border)]">
                <Wand2 className="size-6 sm:size-8 text-tertiary" />
              </div>
              <p className="text-sm sm:text-lg text-tertiary">File not available</p>
            </div>
          )}
        </div>
      </div>

      {genProgress?.showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-sm animate-fade-in" data-testid="regenerate-progress-modal">
          <div className="animate-fade-in-up mx-4 w-full max-w-md brutal-card !rounded-none p-6 sm:p-8 !shadow-[6px_6px_0_var(--border)] bg-secondary">
            <div className="flex flex-col items-center gap-4 sm:gap-6">
              <div className="flex size-12 sm:size-16 items-center justify-center !rounded-none border-2 border-border bg-gemini-blue/20">
                <Wand2 className="size-6 sm:size-8 text-gemini-blue animate-wand-swing stroke-[2.5px]" />
              </div>
              <div className="flex flex-col items-center gap-2">
                <p className="text-sm font-bold text-primary">{genProgress.stageMessage}</p>
                <p className="text-xs text-secondary">{FILE_LABELS[genProgress.fileName] || genProgress.fileName}</p>
              </div>
              <div className="w-full space-y-4">
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-xs font-black uppercase text-secondary">
                    <span>Progres Dokumen Saat Ini</span>
                    <span>{genProgress.fileProgress}%</span>
                  </div>
                  <div className="h-4 w-full !rounded-none border-2 border-border bg-secondary shadow-[3px_3px_0_var(--border)] overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 border-r-2 border-border transition-all duration-300 ease-out"
                      style={{ width: `${genProgress.fileProgress}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-xs font-black uppercase text-secondary">
                    <span>Progres Keseluruhan</span>
                    <span>{genProgress.overallProgress}%</span>
                  </div>
                  <div className="h-3 w-full !rounded-none border-2 border-border bg-secondary shadow-[2px_2px_0_var(--border)] overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 border-r-2 border-border transition-all duration-300 ease-out"
                      style={{ width: `${genProgress.overallProgress}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap justify-center gap-1.5">
                {FILE_ORDER.map((name) => {
                  const isCurrent = genProgress.fileName === name;
                  const isCompleted = name in files && !isCurrent;
                  
                  return (
                    <div
                      key={name}
                      className={`size-3 border-2 border-border !rounded-none transition-all duration-300 ${
                        isCurrent
                          ? 'bg-emerald-400 animate-pulse'
                          : isCompleted 
                            ? 'bg-emerald-500 shadow-[1px_1px_0_var(--border)]' 
                            : 'bg-secondary'
                      }`}
                      title={FILE_LABELS[name] || name}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GenerateResultsPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-primary text-secondary">
        Memuat...
      </div>
    }>
      <GenerateResultsContent />
    </Suspense>
  );
}
