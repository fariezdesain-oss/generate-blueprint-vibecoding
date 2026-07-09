import { memo, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/db/supabaseBrowserClient';
import { FileIcon, ImageIcon } from 'lucide-react';
import type { Message, Attachment } from '@/types/chat';

const MarkdownRenderer = dynamic(
  () => import('./MarkdownRenderer').then((m) => m.MarkdownRenderer),
  { ssr: false }
);

function AttachmentPreview({ att }: { att: Attachment }) {
  const [url, setUrl] = useState<string | null>(att.url || null);

  useEffect(() => {
    if (url) return;
    if (!att.storagePath) return;

    const supabase = createClient();
    supabase.storage
      .from('chat-attachments')
      .createSignedUrl(att.storagePath, 3600)
      .then(({ data }) => {
        if (data?.signedUrl) setUrl(data.signedUrl);
      });
  }, [att.storagePath, url]);

  const isImage = att.mimeType.startsWith('image/');

  if (isImage && url) {
    return (
      <div className="mb-2 overflow-hidden rounded-xl border border-subtle">
        <img
          src={url}
          alt={att.name}
          className="max-h-48 w-full object-contain"
          loading="lazy"
        />
      </div>
    );
  }

  return (
      <div className="mb-2 flex items-center gap-2 rounded-lg border border-subtle bg-tertiary px-3 py-2">
      {isImage ? (
        <ImageIcon size={16} className="text-gemini-blue/70" />
      ) : (
        <FileIcon size={16} className="text-amber-400/70" />
      )}
      <span className="truncate text-xs text-secondary">{att.name}</span>
    </div>
  );
}

function Attachments({ attachments }: { attachments: Attachment[] }) {
  if (!attachments || attachments.length === 0) return null;
  return (
    <div className="mb-2 flex flex-col gap-1.5">
      {attachments.map((att) => (
        <AttachmentPreview key={att.id} att={att} />
      ))}
    </div>
  );
}

interface MessageBubbleProps {
  message: Message;
}

export const MessageBubble = memo(function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'rounded-br-sm bg-gradient-to-br from-gemini-blue to-gemini-green text-white shadow-[0_0_20px_rgba(59,130,246,0.15)]'
            : 'rounded-bl-sm px-4 py-3 ai-glow-slow text-primary'
        }`}
      >
        <Attachments attachments={message.attachments || []} />
        {message.content && (
          isUser ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
          ) : (
            <div className="text-sm leading-relaxed">
              <MarkdownRenderer content={message.content} />
            </div>
          )
        )}
        <p className={`mt-1 text-right text-[10px] ${isUser ? 'text-secondary' : 'text-tertiary'}`}>
          {new Date(message.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
});
