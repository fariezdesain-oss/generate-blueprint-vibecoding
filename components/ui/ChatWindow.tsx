'use client';

import { memo, useEffect, useRef } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { MessageBubble } from './MessageBubble';
import { Wand2 } from 'lucide-react';

export const ChatWindow = memo(function ChatWindow({ loadingMessages }: { loadingMessages?: boolean }) {
  const messages = useChatStore((s) => s.messages);
  const isGenerating = useChatStore((s) => s.isGenerating);
  const streamingContent = useChatStore((s) => s.streamingContent);
  const sessionId = useChatStore((s) => s.sessionId);
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const justSwitchedRef = useRef(true);
  const prevSessionId = useRef<string | null>(null);

  useEffect(() => {
    if (sessionId !== prevSessionId.current) {
      prevSessionId.current = sessionId;
      justSwitchedRef.current = true;
    }
  }, [sessionId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (justSwitchedRef.current) {
      container.scrollTop = container.scrollHeight;
      if (messages.length > 0) justSwitchedRef.current = false;
    } else if (isGenerating) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamingContent, isGenerating]);

  if (loadingMessages) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-3 sm:gap-4">
          <div className="size-10 sm:size-12 lg:size-16 !rounded-none border-2 border-border bg-tertiary shadow-[2px_2px_0_var(--border)] flex items-center justify-center">
            <Wand2 className="size-4 animate-wand-swing text-gemini-blue" />
          </div>
          <div className="text-center">
            <h2 className="font-display text-primary text-sm sm:text-base lg:text-lg font-semibold">Memuat Percakapan</h2>
            <p className="mt-1 text-xs sm:text-sm text-tertiary">Sabar sebentar...</p>
          </div>
        </div>
      </div>
    );
  }

  if (messages.length === 0 && !isGenerating) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-3 sm:gap-4 ">
          <div className="flex size-10 sm:size-12 lg:size-16 items-center justify-center !rounded-none border-2 border-border bg-gemini-blue shadow-[2px_2px_0_var(--border)]">
            <Wand2 className="size-6 sm:size-8 text-white" />
          </div>
          <div className="text-center">
            <h2 className="font-display text-primary text-sm sm:text-base lg:text-lg font-semibold">Mulai Percakapan</h2>
            <p className="mt-1 text-xs sm:text-sm text-tertiary">Tanyakan sesuatu untuk memulai</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:px-4 sm:py-6">
      <div className="mx-auto max-w-3xl space-y-3">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {isGenerating && streamingContent && (
          <div className="flex justify-start animate-fade-in">
            <div className="max-w-[80%] !rounded-none border-2 border-border shadow-[4px_4px_0_var(--border)] px-4 py-3 brutal-panel">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-primary">
                {streamingContent}
                <span className="inline-block size-1.5 animate-pulse rounded-full bg-gemini-blue ml-0.5 " />
              </p>
            </div>
          </div>
        )}

        {isGenerating && !streamingContent && (
          <div className="flex justify-start">
            <div className="!rounded-none border-2 border-border shadow-[4px_4px_0_var(--border)] px-4 py-4 brutal-panel transition-all duration-200 active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_var(--border)]">
              <div className="flex gap-1.5">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            </div>
          </div>
        )}
      </div>

      <div ref={bottomRef} />
    </div>
  );
});
