'use client';

import { memo, useEffect, useRef } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { MessageBubble } from './MessageBubble';
import { Sparkles } from 'lucide-react';

export const ChatWindow = memo(function ChatWindow() {
  const messages = useChatStore((s) => s.messages);
  const isGenerating = useChatStore((s) => s.isGenerating);
  const streamingContent = useChatStore((s) => s.streamingContent);
  const bottomRef = useRef<HTMLDivElement>(null);
  const initialScrollDone = useRef(false);

  useEffect(() => {
    if (!bottomRef.current) return;
    if (!initialScrollDone.current && messages.length > 0) {
      bottomRef.current.scrollIntoView();
      initialScrollDone.current = true;
    } else {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamingContent]);

  if (messages.length === 0 && !isGenerating) {
    return (
      <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-4 animate-float">
          <div className="flex size-12 sm:size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-gemini-blue/10 to-gemini-blue/10 ring-1 ring-[var(--border)]">
            <Sparkles className="size-8 text-gemini-blue" />
          </div>
          <div className="text-center">
            <h2 className="text-gradient text-base sm:text-lg font-semibold">Mulai Percakapan</h2>
            <p className="mt-1 text-sm text-tertiary">Tanyakan sesuatu untuk memulai</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:px-4 sm:py-6">
      <div className="mx-auto max-w-3xl space-y-3">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {isGenerating && streamingContent && (
          <div className="flex justify-start animate-fade-in">
            <div className="max-w-[80%] rounded-2xl rounded-bl-sm px-4 py-3 ai-glow">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-primary">
                {streamingContent}
                <span className="inline-block size-1.5 animate-pulse rounded-full bg-gemini-blue ml-0.5 shadow-[0_0_6px_rgba(59,130,246,0.5)]" />
              </p>
            </div>
          </div>
        )}

        {isGenerating && !streamingContent && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm px-4 py-4 ai-glow">
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
