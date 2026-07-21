'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useChatStore } from '@/store/useChatStore';
import { ChatWindow } from '@/components/ui/ChatWindow';
import { Send, FileText, Square } from 'lucide-react';
import { FILE_ORDER, FILE_LABELS, countGeneratedSpecFiles, getNextMissingSpecFile } from '@/lib/utils/sequentialPrompts';
import { shouldContinueGeneration } from '@/lib/utils/generationControl';
import { clearActiveChatSession } from '@/lib/utils/browserSession';
import { FilePicker } from '@/components/ui/FilePicker';
import { ProjectStatePanel } from '@/components/ui/ProjectStatePanel';
import type { Attachment } from '@/types/chat';

export function ChatContent({ sessionIdParam }: { sessionIdParam: string | null }) {
  const [input, setInput] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState<{
    current: number;
    total: number;
    fileName: string;
    fileProgress: number;
    overallProgress: number;
    stage: string;
    stageMessage: string;
    targetFiles?: string[];
    initialExistingFiles?: Record<string, string>;
  }>({
    current: 0,
    total: FILE_ORDER.length,
    fileName: '',
    fileProgress: 0,
    overallProgress: 0,
    stage: '',
    stageMessage: '',
  });
  const [pendingFiles, setPendingFiles] = useState<Attachment[]>([]);
  const [filePickerKey, setFilePickerKey] = useState(0);
  const [showModePicker, setShowModePicker] = useState(false);
  const [pickingMode, setPickingMode] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [pickedModeTemp, setPickedModeTemp] = useState<'docs' | 'n8n' | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  const sessionIdUrlParam = sessionIdParam;

  const sessionId = useChatStore((s) => s.sessionId);
  const setSessionId = useChatStore((s) => s.setSessionId);
  const setSessionTitle = useChatStore((s) => s.setSessionTitle);
  const setMessages = useChatStore((s) => s.setMessages);
  const addMessage = useChatStore((s) => s.addMessage);
  const setIsGenerating = useChatStore((s) => s.setIsGenerating);
  const setStreamingContent = useChatStore((s) => s.setStreamingContent);
  const appendStreamingContent = useChatStore((s) => s.appendStreamingContent);
  const setChatError = useChatStore((s) => s.setChatError);
  const bumpSidebar = useChatStore((s) => s.bumpSidebar);
  const isGenerating = useChatStore((s) => s.isGenerating);
  const canGenerate = useChatStore((s) => s.canGenerate);
  const setCanGenerate = useChatStore((s) => s.setCanGenerate);
  const chatError = useChatStore((s) => s.chatError);
  const mode = useChatStore((s) => s.mode);
  const setMode = useChatStore((s) => s.setMode);
  const setIsGeneratingDocs = useChatStore((s) => s.setIsGeneratingDocs);
  const titleSet = useRef(false);
  const activeSessionRef = useRef<string | null>(null);
  const justCreatedRef = useRef(false);

  useEffect(() => {
    setIsGeneratingDocs(generating);
    return () => setIsGeneratingDocs(false);
  }, [generating, setIsGeneratingDocs]);

  useEffect(() => {
    if (chatError) {
      const timer = setTimeout(() => setChatError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [chatError, setChatError]);
  const abortRef = useRef<AbortController | null>(null);
  const generateCooldownRef = useRef(false);
  const regenerateRequestedRef = useRef<{ all: true } | { files: string[] } | null>(null);
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingActiveRef = useRef(false);
  const partialGenerationAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearTimeout(pollingRef.current);
    };
  }, []);

  useEffect(() => {
    regenerateRequestedRef.current = null;
  }, [sessionId]);

  useEffect(() => {
    if (!generating || mode !== 'n8n') return;
    
    setGenProgress((prev) => ({ 
      ...prev, 
      overallProgress: 20,
      stageMessage: 'Menganalisis percakapan...' 
    }));
    
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      
      setGenProgress((prev) => {
        let newProgress = prev.overallProgress;
        let newMessage = prev.stageMessage;
        
        if (elapsed > 70000) {
          newProgress = 90;
          newMessage = 'Finalisasi workflow...';
        } else if (elapsed > 40000) {
          newProgress = 80;
          newMessage = 'Menyempurnakan konfigurasi...';
        } else if (elapsed > 20000) {
          newProgress = 60;
          newMessage = 'Memvalidasi struktur workflow...';
        } else if (elapsed > 8000) {
          newProgress = 40;
          newMessage = 'Membuat node workflow...';
        }
        
        return { 
          ...prev, 
          overallProgress: newProgress,
          stageMessage: newMessage 
        };
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [generating, mode]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  const hasReadinessSignal = (content: string) => {
    const lower = content.toLowerCase();
    return (
      lower.includes('informasi sudah cukup') &&
      (lower.includes('generate documentation') || lower.includes('generate n8n workflow'))
    );
  };

  const hasRegenerateSignal = (content: string) => {
    return content.toLowerCase().includes('generate ulang dari awal');
  };

  const extractPartialRegenerateFiles = (content: string) => {
    const lower = content.toLowerCase();
    if (!lower.includes('saya akan regenerate')) return [];
    return FILE_ORDER.filter((fileName) => lower.includes(fileName.toLowerCase()));
  };

  const switchingSession = !!sessionIdUrlParam && sessionId !== sessionIdUrlParam;

  useEffect(() => {
    if (sessionIdUrlParam) {
      setLoadingMessages(true);
      setGenerating(false); setGenProgress({ current: 0, total: FILE_ORDER.length, fileName: '', fileProgress: 0, overallProgress: 0, stage: '', stageMessage: '' }); useChatStore.getState().reset();
      fetch(`/api/chat?session_id=${sessionIdUrlParam}`)
        .then((r) => {
          if (r.status === 401) {
            clearActiveChatSession(sessionStorage);
            setGenerating(false); setGenProgress({ current: 0, total: FILE_ORDER.length, fileName: '', fileProgress: 0, overallProgress: 0, stage: '', stageMessage: '' }); useChatStore.getState().reset();
            router.replace('/login');
            return null;
          }
          if (!r.ok) {
            clearActiveChatSession(sessionStorage);
            setGenerating(false); setGenProgress({ current: 0, total: FILE_ORDER.length, fileName: '', fileProgress: 0, overallProgress: 0, stage: '', stageMessage: '' }); useChatStore.getState().reset();
            router.replace('/chat');
            return null;
          }
          return r.json();
        })
        .then((json) => {
          if (!json?.success || !json?.data) return;
          if (json.data.mode) setMode(json.data.mode || 'docs');
          setShowModePicker(false);
          setSessionId(sessionIdUrlParam);
          sessionStorage.setItem('activeSessionId', sessionIdUrlParam);
          if (json.data.messages?.length > 0) {
            const mapped = json.data.messages.map((m: { id: string; session_id: string; role: string; content: string; created_at: string }) => ({
              id: m.id,
              sessionId: m.session_id,
              role: m.role,
              content: m.content,
              createdAt: m.created_at,
            }));
            setMessages(mapped);
          }
          if (json.data.title) setSessionTitle(json.data.title);
          const hasSignal = json.data.messages?.some(
            (m: { role: string; content: string }) =>
              m.role === 'assistant' && hasReadinessSignal(m.content)
          );
          setCanGenerate(!!hasSignal);
        })
        .catch(() => {
          clearActiveChatSession(sessionStorage);
          setGenerating(false); setGenProgress({ current: 0, total: FILE_ORDER.length, fileName: '', fileProgress: 0, overallProgress: 0, stage: '', stageMessage: '' }); useChatStore.getState().reset();
          router.replace('/chat');
        })
        .finally(() => setLoadingMessages(false));
      return;
    }

    if (!sessionId && useChatStore.getState().sessionId) {
      setGenerating(false); setGenProgress({ current: 0, total: FILE_ORDER.length, fileName: '', fileProgress: 0, overallProgress: 0, stage: '', stageMessage: '' }); useChatStore.getState().reset();
    }

    const savedSessionId =
      typeof window !== 'undefined' &&
      sessionStorage.getItem('activeSessionId');
    if (savedSessionId) {
      router.replace(`/chat?id=${savedSessionId}`);
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionIdUrlParam]);

  useEffect(() => {
    if (!sessionId && !sessionIdUrlParam) {
      setShowModePicker(true);
    }
  }, [sessionId, sessionIdUrlParam]);

  const openTitleInput = (pickedMode: 'docs' | 'n8n') => {
    setPickedModeTemp(pickedMode);
    setMode(pickedMode);
    setTitleInput('');
  };

  const handleModePick = async () => {
    if (pickingMode || !pickedModeTemp) return;
    const customTitle = titleInput.trim();
    if (!customTitle) return;
    setPickingMode(true);
    setMode(pickedModeTemp);

    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: customTitle, mode: pickedModeTemp }),
      });
      const json = await res.json();
      if (json.success) {
        justCreatedRef.current = true;
        titleSet.current = true;
        setSessionId(json.data.session.id);
        setSessionTitle(customTitle);
        sessionStorage.setItem('activeSessionId', json.data.session.id);
        useChatStore.getState().bumpSidebar();
        setShowModePicker(false);
        setPickedModeTemp(null);
        setTitleInput('');
      } else {
        setShowModePicker(true);
      }
    } catch {
      setShowModePicker(true);
    } finally {
      setPickingMode(false);
    }
  };

  useEffect(() => {
    if (!sessionId || loadingMessages) return;
    if (sessionIdUrlParam && sessionId === sessionIdUrlParam) return;
    if (justCreatedRef.current) {
      justCreatedRef.current = false;
      return;
    }
    titleSet.current = false;
    activeSessionRef.current = sessionId;
    setLoadingMessages(true);

    const targetId = sessionId;
    const abort = new AbortController();

    const load = async () => {
      try {
        const res = await fetch(`/api/chat?session_id=${targetId}`, {
          signal: abort.signal,
        });
        if (res.status === 401) {
          if (activeSessionRef.current === targetId) {
            clearActiveChatSession(sessionStorage);
            setGenerating(false); setGenProgress({ current: 0, total: FILE_ORDER.length, fileName: '', fileProgress: 0, overallProgress: 0, stage: '', stageMessage: '' }); useChatStore.getState().reset();
            router.replace('/login');
          }
          return;
        }
        if (res.status === 404) {
          if (activeSessionRef.current === targetId) {
            clearActiveChatSession(sessionStorage);
            setSessionId(null);
            router.replace('/chat');
          }
          return;
        }
        const json = await res.json();
        if (json.success && activeSessionRef.current === targetId) {
          if (json.data.mode) setMode(json.data.mode);
          if (json.data.messages?.length > 0) {
            const mapped = json.data.messages.map((m: { id: string; session_id: string; role: string; content: string; created_at: string }) => ({
              id: m.id,
              sessionId: m.session_id,
              role: m.role,
              content: m.content,
              createdAt: m.created_at,
            }));
            setMessages(mapped);
          }
          if (json.data.title && !titleSet.current) {
            setSessionTitle(json.data.title);
            if (json.data.title !== 'New Chat') titleSet.current = true;
          }
          const hasSignal = json.data.messages?.some(
            (m: { role: string; content: string }) =>
              m.role === 'assistant' && hasReadinessSignal(m.content)
          );
          setCanGenerate(!!hasSignal);
        }
      } catch {
        // silently ignore aborted requests
      } finally {
        if (activeSessionRef.current === targetId) {
          setLoadingMessages(false);
        }
      }
    };

    load();
    return () => abort.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, sessionIdUrlParam]);

  const sendingRef = useRef(false);
  const lastMessageRef = useRef<{ content: string; time: number } | null>(null);

  const sendMessage = async () => {
    if (loadingMessages || switchingSession || sendingRef.current || isGenerating || generating) return;
    const content = input.trim();
    const hasFiles = pendingFiles.length > 0;
    if (!content && !hasFiles) return;

    if (content) {
      const now = Date.now();
      if (lastMessageRef.current && lastMessageRef.current.content === content && now - lastMessageRef.current.time < 3000) {
        return;
      }
      lastMessageRef.current = { content, time: now };
    }

    const filesToSend = pendingFiles;
    setPendingFiles([]);
    setFilePickerKey((k) => k + 1);
    sendingRef.current = true;

    const currentSessionId = sessionId;
    if (!currentSessionId) {
      sendingRef.current = false;
      setShowModePicker(true);
      return;
    }

    setInput('');
    setIsGenerating(true);
    setStreamingContent('');
    setChatError(null);


    const tempId = crypto.randomUUID();
    addMessage({
      id: tempId,
      sessionId: currentSessionId,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
      attachments: filesToSend,
    });

    abortRef.current = new AbortController();

    try {
      const res = await fetch(`/api/chat?stream=1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: currentSessionId,
          content,
          files: filesToSend.length > 0 ? filesToSend : undefined,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const json = await res.json();
        setChatError(json?.error?.message || 'Request failed');
        return;
      }

      if (!res.body) return;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.token) {
              appendStreamingContent(parsed.token);
            }
            if (parsed.done) {
              if (parsed.title) {
                titleSet.current = true;
                setSessionTitle(parsed.title);
              }
              if (parsed.message) {
                addMessage(parsed.message);
                if (!canGenerate && hasReadinessSignal(parsed.message.content)) {
                  setCanGenerate(true);
                }
                const targetFiles = extractPartialRegenerateFiles(parsed.message.content);
                if (targetFiles.length > 0) {
                  regenerateRequestedRef.current = { files: targetFiles };
                } else if (hasRegenerateSignal(parsed.message.content)) {
                  regenerateRequestedRef.current = { all: true };
                }
              }
            }
            if (parsed.error) {
              setChatError(parsed.error);
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // User stopped generation
      }
    } finally {
      setIsGenerating(false);
      setStreamingContent('');
      abortRef.current = null;
      sendingRef.current = false;
      bumpSidebar();
      window.dispatchEvent(new CustomEvent('project-state-refresh'));
    }
  };

  const stopGeneration = () => {
    abortRef.current?.abort();
  };

  const pollStartRef = useRef(0);

  async function stopPolling(isUserAction: boolean = false) {
    const activeFile = genProgress.fileName;
    pollingActiveRef.current = false;
    partialGenerationAbortRef.current?.abort();
    partialGenerationAbortRef.current = null;
    if (pollingRef.current) clearTimeout(pollingRef.current);
    pollingRef.current = null;
    setGenerating(false);
    
    // Pastikan progress interval palsu dibersihkan dan reset state visual dokumen berjalan agar tak nyangkut
    setGenProgress(prev => ({
      ...prev,
      fileProgress: 0,
      fileName: '',
      stageMessage: ''
    }));
    
    generateCooldownRef.current = true;
    setTimeout(() => { generateCooldownRef.current = false; }, 2000);

    if (isUserAction) {
      let msg = '';
      if (mode === 'n8n') {
        msg = 'proses generate n8n Workflow dihentikan';
      } else {
        const fileName = activeFile || 'dokumen';
        msg = `proses generate ${fileName} dihentikan`;
      }
      setChatError(msg);

      try {
        await fetch('/api/generate/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
      } catch (err) {
        console.error('Gagal membatalkan generate di backend:', err);
      }
    }
  }

  const pollForResults = (mode: string) => {
    if (pollingRef.current) clearTimeout(pollingRef.current);
    pollingActiveRef.current = true;
    pollStartRef.current = Date.now();

    const poll = async () => {
      if (!pollingActiveRef.current) return;

      if (Date.now() - pollStartRef.current > 3600000) {
        stopPolling();
        setChatError('Generate melebihi batas waktu 60 menit. Silakan coba lagi.');
        return;
      }

      try {
        const res = await fetch(`/api/sessions/${sessionId}/files`);
        const json = await res.json();
        if (!json.success) {
          stopPolling();
          setChatError(json?.error?.message || 'Gagal memuat status generate. Silakan coba lagi.');
          return;
        }

        if (mode === 'n8n') {
          if (json.data.n8n_workflow) {
            stopPolling();
            router.push(`/generate/results?session_id=${sessionId}&mode=n8n`);
          }
        } else {
          const files = json.data.files;
          const fileCount = files ? countGeneratedSpecFiles(files) : 0;
          const genProgressMeta = json.data.generation_progress;
          if (genProgressMeta) {
            const { currentFileIndex, currentFileName, currentFileProgress, stage, message } = genProgressMeta;
            const count = currentFileIndex + (currentFileProgress >= 100 ? 1 : 0);
            setGenProgress((prev) => ({
              current: Math.max(prev.current, Math.min(count, FILE_ORDER.length)),
              total: FILE_ORDER.length,
              fileName: currentFileName || '',
              // Fix maju-mundur: fileProgress hanya boleh naik, tidak boleh turun
              fileProgress: Math.max(prev.fileProgress, currentFileProgress || 0),
              overallProgress: Math.round((fileCount / FILE_ORDER.length) * 100),
              stage: stage || '',
              stageMessage: message || '',
              // Fix dot: perbarui initialExistingFiles secara live dari server
              initialExistingFiles: files || prev.initialExistingFiles,
            }));
          } else if (files) {
            const count = json.data.progress?.current ?? countGeneratedSpecFiles(files);
            const nextFile = json.data.progress?.next_file ?? getNextMissingSpecFile(files);
            const status = json.data.generation_status;
            const fileName = count >= FILE_ORDER.length && status === 'generating'
              ? 'Final consistency check'
              : nextFile;
            setGenProgress((prev) => ({
              current: Math.max(prev.current, Math.min(count, FILE_ORDER.length)),
              total: FILE_ORDER.length,
              fileName,
              fileProgress: count >= FILE_ORDER.length ? 100 : Math.max(prev.fileProgress, 0),
              overallProgress: Math.round((count / FILE_ORDER.length) * 100),
              stage: count >= FILE_ORDER.length ? 'done' : '',
              stageMessage: '',
              // Fix dot: perbarui initialExistingFiles secara live dari server
              initialExistingFiles: files || prev.initialExistingFiles,
            }));
          }

          if ((json.data.generation_status === 'completed' || genProgressMeta?.stage === 'done') && fileCount >= FILE_ORDER.length) {
            stopPolling();
            router.push(`/generate/results?session_id=${sessionId}`);
          }
          if (json.data.generation_status === 'failed') {
            stopPolling();
            setChatError(json.data.generation_error || 'Generate gagal. Silakan coba lagi.');
          }
        }
      } catch {
        // polling error, will retry on next interval
      }
      if (pollingActiveRef.current) {
        pollingRef.current = setTimeout(poll, 2000);
      }
    };

    poll();
  };

  const handleGenerate = async () => {
    if (!sessionId || generating || generateCooldownRef.current) return;

    const regenerateRequest = regenerateRequestedRef.current;
    regenerateRequestedRef.current = null;
    const targetFiles = regenerateRequest && 'files' in regenerateRequest ? regenerateRequest.files : [];
    const shouldRegenerateAll = !!regenerateRequest && 'all' in regenerateRequest;
    const shouldRegeneratePartial = targetFiles.length > 0;

    if (shouldRegenerateAll) {
      await fetch(`/api/sessions/${sessionId}/files`, { method: 'DELETE' }).catch(() => {});
    } else if (shouldRegeneratePartial) {
      await fetch(`/api/sessions/${sessionId}/files`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_files: targetFiles }),
      }).catch(() => {});
    }

    const filesRes = await fetch(`/api/sessions/${sessionId}/files`);
    let existingCount = 0;
    let hasN8nExisting = false;
    let generationStatus: string | null = null;
    let initialFiles: Record<string, string> = {};
    if (filesRes.ok) {
      const filesJson = await filesRes.json();
      if (filesJson.success) {
        generationStatus = filesJson.data.generation_status || null;
        if (mode === 'n8n' && filesJson.data.n8n_workflow) {
          hasN8nExisting = true;
        }
        if (mode !== 'n8n' && filesJson.data.files) {
          initialFiles = filesJson.data.files;
          existingCount = countGeneratedSpecFiles(filesJson.data.files);
        }
      }
    }

    if (mode === 'n8n' && hasN8nExisting && !shouldRegenerateAll && !shouldRegeneratePartial) {
      router.push(`/generate/results?session_id=${sessionId}&mode=n8n`);
      return;
    }

    if (mode !== 'n8n' && existingCount >= FILE_ORDER.length && !shouldRegenerateAll && !shouldRegeneratePartial) {
      router.push(`/generate/results?session_id=${sessionId}`);
      return;
    }

    setGenerating(true);
    setChatError(null);
    const initialOverallProgress = Math.round((existingCount / FILE_ORDER.length) * 100);
    setGenProgress({
      current: existingCount,
      total: FILE_ORDER.length,
      fileName: '',
      fileProgress: 0,
      overallProgress: initialOverallProgress,
      stage: '',
      stageMessage: '',
      targetFiles: shouldRegeneratePartial ? targetFiles : undefined,
      initialExistingFiles: initialFiles
    });

    if (shouldRegeneratePartial) {
      pollingActiveRef.current = true;
      try {
        for (let i = 0; i < targetFiles.length; i++) {
          if (!pollingActiveRef.current) break;
          const fileName = targetFiles[i];
          const fileIndex = FILE_ORDER.indexOf(fileName);
          if (fileIndex === -1) {
            stopPolling();
            setChatError(`File target ${fileName} tidak valid.`);
            return;
          }

          setGenProgress({
            current: i,
            total: targetFiles.length,
            fileName,
            fileProgress: 25,
            overallProgress: initialOverallProgress, // Bekukan di sini saat memulai iterasi
            stage: 'generating',
            stageMessage: `Regenerate ${FILE_LABELS[fileName] || fileName}...`,
            targetFiles,
            initialExistingFiles: initialFiles
          });

          // Fake interval progress during sequential generation
          const progressInterval = setInterval(() => {
            setGenProgress((prev) => {
              if (prev.fileProgress >= 95) return prev;
              const increment = prev.fileProgress < 60 ? 5 : 2;
              const newFileProgress = Math.min(prev.fileProgress + increment, 95);
              // Tidak lagi mencampur newFileProgress ke overallProgress
              return {
                ...prev,
                fileProgress: newFileProgress,
                overallProgress: prev.overallProgress // Tetap gunakan progress keseluruhan yang dibekukan
              };
            });
          }, 800);

          const controller = new AbortController();
          partialGenerationAbortRef.current = controller;
          const res = await fetch('/api/generate/sequential', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId, file_index: fileIndex }),
            signal: controller.signal,
          });
          partialGenerationAbortRef.current = null;
          clearInterval(progressInterval);

          if (!res.ok) {
            stopPolling();
            if (res.status === 401) {
              clearActiveChatSession(sessionStorage);
              setGenerating(false); setGenProgress({ current: 0, total: FILE_ORDER.length, fileName: '', fileProgress: 0, overallProgress: 0, stage: '', stageMessage: '' }); useChatStore.getState().reset();
              router.replace('/login');
            } else {
              setChatError(`Gagal regenerate ${fileName}. Silakan coba lagi.`);
            }
            return;
          }

          const json = await res.json();
          if (!json.success) {
            stopPolling();
            setChatError(json?.error?.message || `Gagal regenerate ${fileName}.`);
            return;
          }

          if (!pollingActiveRef.current) break;
          setGenProgress({
            current: i + 1,
            total: targetFiles.length,
            fileName,
            fileProgress: 100,
            overallProgress: initialOverallProgress, // Tetap dibekukan
            stage: 'done',
            stageMessage: `${FILE_LABELS[fileName] || fileName} selesai di-regenerate.`,
            targetFiles,
            initialExistingFiles: initialFiles
          });
        }

        if (!pollingActiveRef.current) return;
        stopPolling();
        router.push(`/generate/results?session_id=${sessionId}`);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        stopPolling();
        setChatError('Gagal regenerate file pilihan. Silakan coba lagi.');
      }
      return;
    }

    pollForResults(mode);

    if (generationStatus === 'generating') return;

    const runNext = async () => {
      if (!pollingActiveRef.current) return;
      try {
        const res = await fetch('/api/generate/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, mode }),
        });
        const json = await res.json();
        if (!json.success) {
          stopPolling();
          setChatError(json?.error?.message || 'Gagal memulai generate. Silakan coba lagi.');
          return;
        }
        if (shouldContinueGeneration(json.data, pollingActiveRef.current)) {
          setTimeout(runNext, 500);
        }
      } catch {
        stopPolling();
        setChatError('Gagal terhubung ke server. Silakan coba lagi.');
      }
    };

    runNext();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isGenerating) return;
      sendMessage();
    }
  };

  if (showModePicker) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-5 sm:p-8">
        <div className="animate-fade-in-up mx-auto w-full max-w-2xl">
          <div className="mb-8 text-center">
            <h1 className="text-gradient text-xl sm:text-2xl lg:text-3xl font-extrabold">Generate Instruksi Vibecoding</h1>
            <p className="mt-2 sm:mt-3 text-xs sm:text-sm font-semibold text-secondary">Pilih mode generate sebelum memulai sesi</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:gap-5 sm:grid-cols-2">
            <button
              onClick={() => openTitleInput('docs')}
              disabled={pickingMode}
              className="group relative flex flex-col items-center gap-4 sm:gap-5 !rounded-none border-2 border-border bg-tertiary shadow-[4px_4px_0_var(--border)] p-4 sm:p-6 lg:p-8 text-center transition-all duration-300 hover:shadow-[6px_6px_0_var(--gemini-blue)] hover:-translate-x-1 hover:-translate-y-1 active:translate-x-1 active:translate-y-1 active:shadow-[2px_2px_0_var(--gemini-blue)] hover:border-gemini-blue disabled:opacity-50"
            >
              <div className="flex size-10 sm:size-12 lg:size-16 items-center justify-center !rounded-none border-2 border-border shadow-[2px_2px_0_var(--border)] bg-gemini-blue/10 text-gemini-blue group-hover:bg-gemini-blue group-hover:text-[#111] transition-colors duration-300">
                <FileText className="size-6 lg:size-8" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base lg:text-lg font-bold text-primary">Dokumen Instruksi Vibecoding</h2>
                <p className="mt-2 text-xs font-semibold text-tertiary leading-relaxed">
                  Generate 9 dokumen engineering standar plus Tasks dan AI Rules
                  berdasarkan diskusi proyek dengan AI.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-1.5">
                {['PRD', 'Arch', 'Data', 'Standard', 'Delivery'].map((tag) => (
                  <span key={tag} className="!rounded-none border-2 border-border shadow-[2px_2px_0_var(--border)] px-2.5 py-1 text-[10px] font-black uppercase tracking-widest bg-gemini-blue/10 text-gemini-blue">
                    {tag}
                  </span>
                ))}
              </div>
            </button>
            <button
              onClick={() => openTitleInput('n8n')}
              disabled={pickingMode}
              className="group relative flex flex-col items-center gap-4 sm:gap-5 !rounded-none border-2 border-border bg-tertiary shadow-[4px_4px_0_var(--border)] p-4 sm:p-6 lg:p-8 text-center transition-all duration-300 hover:shadow-[6px_6px_0_var(--gemini-green)] hover:-translate-x-1 hover:-translate-y-1 active:translate-x-1 active:translate-y-1 active:shadow-[2px_2px_0_var(--gemini-green)] hover:border-gemini-green disabled:opacity-50"
            >
              <div className="flex size-10 sm:size-12 lg:size-16 items-center justify-center !rounded-none border-2 border-border shadow-[2px_2px_0_var(--border)] bg-emerald-500/10 text-emerald-500 group-hover:bg-gemini-green group-hover:text-[#111] transition-colors duration-300">
                <svg className="size-6 lg:size-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm sm:text-base lg:text-lg font-bold text-primary">Generate Workflow n8n</h2>
                <p className="mt-2 text-xs font-semibold text-tertiary leading-relaxed">
                  AI akan menggali kebutuhan automation Anda dan menghasilkan file .json workflow
                  n8n yang siap di-import langsung ke n8n.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-1.5">
                {['Webhook', 'Schedule', 'API', 'AI', 'Slack'].map((tag) => (
                  <span key={tag} className="!rounded-none border-2 border-border shadow-[2px_2px_0_var(--border)] px-2.5 py-1 text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-500">
                    {tag}
                  </span>
                ))}
              </div>
            </button>
          </div>
        </div>
        {pickedModeTemp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4 backdrop-blur-md">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleModePick();
              }}
              className="animate-fade-in-up w-full max-w-md glass !rounded-none border-2 border-border shadow-[8px_8px_0_var(--border)] bg-secondary p-5 sm:p-6 shadow-2xl"
            >
              <div className="mb-5 flex items-center gap-3">
                <div className={`flex size-11 shrink-0 items-center justify-center !rounded-none border-2 border-border shadow-[2px_2px_0_var(--border)] ${pickedModeTemp === 'n8n' ? 'bg-emerald-500/10 text-emerald-500 ring-emerald-500/20' : 'bg-gemini-blue/10  ring-gemini-blue/20'}`}>
                  {pickedModeTemp === 'n8n' ? (
                    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                    </svg>
                  ) : (
                    <FileText className="size-5" />
                  )}
                </div>
                <div>
                  <h2 className="text-base font-bold text-primary">Beri Judul Chat</h2>
                  <p className="mt-1 text-xs font-semibold text-tertiary">Judul wajib diisi agar riwayat mudah dikenali.</p>
                </div>
              </div>

              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-tertiary">
                Judul sesi
              </label>
              <input
                autoFocus
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                disabled={pickingMode}
                placeholder={pickedModeTemp === 'n8n' ? 'Contoh: Workflow notifikasi Slack' : 'Contoh: Aplikasi kasir toko'}
                className="min-h-12 w-full !rounded-none border-2 border-border bg-secondary shadow-[inset_2px_2px_0_rgba(0,0,0,0.05)] px-4 text-sm font-semibold text-primary outline-none transition-all duration-300 placeholder:text-tertiary focus:border-gemini-blue/40 focus:shadow-[0_0_24px_rgba(59,130,246,0.08)] disabled:cursor-not-allowed disabled:opacity-50"
              />

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={pickingMode}
                  onClick={() => {
                    setPickedModeTemp(null);
                    setTitleInput('');
                  }}
                  className="min-h-11 !rounded-none border-2 border-border bg-tertiary shadow-[3px_3px_0_var(--border)] px-4 text-sm font-bold text-secondary transition-all duration-200 hover:bg-tertiary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Kembali
                </button>
                <button
                  type="submit"
                  disabled={pickingMode || !titleInput.trim()}
                  className="min-h-11 !rounded-none btn-gradient shadow-[3px_3px_0_var(--border)] px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:transform-none"
                >
                  {pickingMode ? 'Membuat...' : 'Mulai Chat'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      {generating && mode === 'n8n' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-sm">
          <div className="animate-fade-in-up mx-4 w-full max-w-sm brutal-card !rounded-none p-6 sm:p-8 !shadow-[6px_6px_0_var(--border)]">
            <div className="flex flex-col items-center gap-4 sm:gap-6">
              <div className="flex size-12 sm:size-16 items-center justify-center !rounded-none border-2 border-border bg-emerald-500/20">
                <svg className="size-6 sm:size-8 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </div>
              <div className="flex flex-col items-center gap-2">
                <p className="text-sm font-bold text-primary">Membuat workflow n8n...</p>
                <p className="text-xs text-tertiary">Menganalisis percakapan dan menyusun template</p>
              </div>
              <div className="w-full space-y-4">
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-xs font-black uppercase text-secondary">
                    <span>Progres Pembuatan Workflow</span>
                    <span>{genProgress.overallProgress}%</span>
                  </div>
                  <div className="h-4 w-full !rounded-none border-2 border-border bg-secondary shadow-[3px_3px_0_var(--border)] overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 border-r-2 border-border transition-all duration-300 ease-out"
                      style={{ width: `${genProgress.overallProgress}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block size-3 !rounded-none border-2 border-border bg-emerald-500 animate-bounce-dot shadow-[1px_1px_0_var(--border)]" style={{ animationDelay: '-0.32s' }} />
                <span className="inline-block size-3 !rounded-none border-2 border-border bg-emerald-500 animate-bounce-dot shadow-[1px_1px_0_var(--border)]" style={{ animationDelay: '-0.16s' }} />
                <span className="inline-block size-3 !rounded-none border-2 border-border bg-emerald-500 animate-bounce-dot shadow-[1px_1px_0_var(--border)]" style={{ animationDelay: '0s' }} />
              </div>
              <button
                onClick={() => stopPolling(true)}
                className="flex min-h-11 items-center gap-2 !rounded-none border-2 border-border bg-gemini-red py-2 px-4 text-sm font-black uppercase text-[#111] transition-all duration-200 hover:bg-gemini-red/90 shadow-[3px_3px_0_var(--border)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_var(--border)]"
              >
                <Square className="size-4 fill-current" />
                Hentikan Generate
              </button>
              <p className="text-center text-xs font-semibold text-tertiary">
                File yang sudah selesai tetap tersimpan dan bisa dilanjutkan.
              </p>
            </div>
          </div>
        </div>
      )}

      {generating && mode !== 'n8n' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-sm">
          <div className="animate-fade-in-up mx-4 w-full max-w-md brutal-card !rounded-none p-6 sm:p-8 !shadow-[6px_6px_0_var(--border)]">
            <div className="flex flex-col items-center gap-4 sm:gap-6">
              <div className="flex size-12 sm:size-16 items-center justify-center !rounded-none border-2 border-border bg-gemini-blue/20">
                <svg className="size-6 sm:size-8 " viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </div>
              <div className="flex flex-col items-center gap-2">
                <p className="text-sm font-bold text-primary">{genProgress.stageMessage || 'Membuat dokumen...'}</p>
                <p className="text-xs text-secondary">{genProgress.fileName ? FILE_LABELS[genProgress.fileName] || genProgress.fileName : 'Mempersiapkan dokumen...'}</p>
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
                  const initialFiles = genProgress.initialExistingFiles || {};
                  
                  let dotState: 'completed' | 'active' | 'pending' = 'pending';

                  if (isCurrent) {
                    dotState = 'active';
                  } else {
                    const hasExisting = initialFiles[name] !== undefined;
                    dotState = hasExisting ? 'completed' : 'pending';
                  }

                  return (
                    <div
                      key={name}
                      className={`size-3 border-2 border-border !rounded-none transition-all duration-300 ${
                        dotState === 'completed'
                          ? 'bg-emerald-500 shadow-[1px_1px_0_var(--border)]'
                          : dotState === 'active'
                            ? 'bg-emerald-400 animate-pulse'
                            : 'bg-tertiary shadow-none'
                      }`}
                      title={name}
                    />
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block size-3 !rounded-none border-2 border-border bg-emerald-500 animate-bounce-dot shadow-[1px_1px_0_var(--border)]" style={{ animationDelay: '-0.32s' }} />
                <span className="inline-block size-3 !rounded-none border-2 border-border bg-emerald-500 animate-bounce-dot shadow-[1px_1px_0_var(--border)]" style={{ animationDelay: '-0.16s' }} />
                <span className="inline-block size-3 !rounded-none border-2 border-border bg-emerald-500 animate-bounce-dot shadow-[1px_1px_0_var(--border)]" style={{ animationDelay: '0s' }} />
              </div>
              <button
                onClick={() => stopPolling(true)}
                className="flex min-h-11 items-center gap-2 !rounded-none border-2 border-border bg-gemini-red py-2 px-4 text-sm font-black uppercase text-[#111] transition-all duration-200 hover:bg-gemini-red/90 shadow-[3px_3px_0_var(--border)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
              >
                <Square className="size-4 fill-current" />
                Hentikan Generate
              </button>
              <p className="text-center text-xs font-semibold text-tertiary">
                File yang sudah selesai tetap tersimpan dan bisa dilanjutkan.
              </p>
            </div>
          </div>
        </div>
      )}

      {chatError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-sm">
          <div className="animate-fade-in-up mx-4 w-full max-w-sm glass !rounded-none border-2 border-border bg-secondary shadow-[6px_6px_0_var(--border)] p-5 sm:p-6 text-center shadow-2xl">
            <div className="mx-auto mb-3 sm:mb-4 flex size-12 sm:size-14 items-center justify-center !rounded-none bg-gemini-red border-2 border-border shadow-[2px_2px_0_var(--border)]">
              <svg className="size-5 sm:size-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-xs sm:text-sm text-secondary">{chatError}</p>
            <button
              onClick={() => setChatError(null)}
              className="mt-4 sm:mt-5 w-full !rounded-none bg-gemini-red border-2 border-border text-[#111] font-black uppercase shadow-[3px_3px_0_var(--border)] hover:bg-gemini-red/90 py-2 sm:py-2.5 text-xs sm:text-sm font-medium text-white transition-all duration-200 hover:bg-red-400"
            >
              OK
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-1 min-h-0 relative">
        <ChatWindow loadingMessages={loadingMessages || switchingSession} />
        {sessionId && !switchingSession && mode === 'docs' && (
          <ProjectStatePanel sessionId={sessionId} />
        )}
      </div>

      <div className="border-t-4 border-solid border-border p-3 sm:p-6 bg-primary">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:gap-4">
          <FilePicker key={filePickerKey} sessionId={sessionId} onFilesReady={setPendingFiles} disabled={isGenerating || switchingSession} />
          <div className="flex gap-2 sm:gap-3">
            <div className="relative flex-1">
              <textarea
                data-testid="chat-textarea"
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isGenerating || switchingSession}
                placeholder={isGenerating || switchingSession ? "Tunggu hingga sesi siap..." : "Ketik pesan..."}
                className="w-full resize-none overflow-y-auto !rounded-none border-2 border-border bg-secondary shadow-[4px_4px_0_var(--border)] px-3 py-2.5 sm:px-4 sm:py-3 lg:px-6 lg:py-4 text-sm font-semibold text-primary outline-none transition-all duration-300 placeholder:text-tertiary placeholder:font-medium focus:border-gemini-blue/30 focus:bg-tertiary focus:shadow-[0_0_20px_rgba(59,130,246,0.05)] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ maxHeight: '240px' }}
              />
            </div>

            {isGenerating ? (
              <button
                onClick={stopGeneration}
                className="flex size-10 md:size-12 lg:size-14 shrink-0 items-center justify-center !rounded-none border-2 border-border bg-gemini-red text-white shadow-[3px_3px_0_var(--border)] hover:bg-gemini-red/90 transition-all duration-200 hover:bg-red-500/30 hover:text-red-300 border border-red-500/20"
              >
                <Square className="size-4 md:size-[18px] fill-current" />
              </button>
            ) : (
              <div className="flex gap-1.5 sm:gap-2">
                <button
                  onClick={sendMessage}
                  disabled={(!input.trim() && pendingFiles.length === 0) || isGenerating}
                  className="flex size-10 md:size-12 lg:size-14 shrink-0 items-center justify-center !rounded-none btn-gradient shadow-[3px_3px_0_var(--border)] disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none disabled:transform-none"
                >
                  <Send className="size-4 md:size-[18px]" />
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={!canGenerate || generating}
                  className={`flex size-10 md:size-12 lg:size-14 shrink-0 items-center justify-center !rounded-none border-2 border-border shadow-[3px_3px_0_var(--border)] transition-all duration-200 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-30 disabled:cursor-not-allowed disabled:active:translate-x-0 disabled:active:translate-y-0 disabled:active:shadow-[3px_3px_0_var(--border)] ${
                    canGenerate
                      ? mode === 'n8n'
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20'
                        : 'bg-gemini-blue text-white hover:bg-gemini-orange hover:text-[#111]'
                      : 'bg-secondary border-subtle text-tertiary'
                  }`}
                  aria-label={mode === 'n8n' ? 'Generate workflow n8n' : 'Generate dokumentasi'}
                  title={
                    canGenerate
                      ? mode === 'n8n' ? 'Generate n8n Workflow' : 'Generate 9 Engineering Documents'
                      : 'Selesaikan dulu sesi diskusi proyek Anda'
                  }
                >
                  {mode === 'n8n' ? (
                    <svg className="size-4 md:size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                    </svg>
                  ) : (
                    <FileText className="size-4 md:size-5" />
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
