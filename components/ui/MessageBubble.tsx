import { memo, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
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
      <div className="mb-2 relative h-48 w-full overflow-hidden !rounded-none border-2 border-border shadow-[4px_4px_0_var(--border)]">
        <Image
          src={url}
          alt={att.name}
          fill
          className="object-contain"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
      </div>
    );
  }

  return (
      <div className="mb-2 flex items-center gap-2 !rounded-none border-2 border-border bg-secondary shadow-[2px_2px_0_var(--border)] px-3 py-2 transition-all duration-200 active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0_var(--border)] cursor-pointer">
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
        className={`max-w-[80%] !rounded-none px-4 py-3 ${
          isUser
            ? '!rounded-none bg-gemini-blue text-white '
            : '!rounded-none px-4 py-3 bg-tertiary border-2 border-border shadow-[4px_4px_0_var(--border)] text-primary'
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
        <p className={`mt-1.5 text-right text-[10px] font-bold ${isUser ? 'text-white/90' : 'text-primary opacity-60'}`}>
          {new Date(message.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
});
