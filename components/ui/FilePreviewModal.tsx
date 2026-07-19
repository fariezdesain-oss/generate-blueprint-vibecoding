'use client';

import { useEffect, useState } from 'react';
import { X, FileIcon, Download , Wand2} from 'lucide-react';
import { createClient } from '@/lib/db/supabaseBrowserClient';
import type { Attachment } from '@/types/chat';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface FilePreviewModalProps {
  attachment: Attachment;
  onClose: () => void;
}

export function FilePreviewModal({ attachment, onClose }: FilePreviewModalProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const isImage = attachment.mimeType.startsWith('image/');

  useEffect(() => {
    if (attachment.url) {
      setUrl(attachment.url);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    supabase.storage
      .from('chat-attachments')
      .createSignedUrl(attachment.storagePath, 3600)
      .then(({ data }) => {
        if (data?.signedUrl) setUrl(data.signedUrl);
        setLoading(false);
      });
  }, [attachment]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative mx-4 flex max-h-[85vh] w-full max-w-[95vw] sm:max-w-3xl flex-col overflow-hidden rounded-md border border-subtle bg-secondary shadow-[var(--shadow)] animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-subtle px-3 sm:px-5 py-2 sm:py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium text-primary">{attachment.name}</span>
            <span className="shrink-0 text-xs text-tertiary">{formatSize(attachment.size)}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (url) window.open(url, '_blank');
              }}
              className="rounded-lg p-1.5 text-tertiary transition-colors hover:bg-tertiary hover:text-secondary"
              title="Download"
            >
              <Download size={16} />
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-tertiary transition-colors hover:bg-tertiary hover:text-secondary"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <Wand2 className="size-8 animate-wand-swing text-gemini-blue" />
              <p className="text-xs text-tertiary">Loading...</p>
            </div>
          ) : isImage && url ? (
            <img
              src={url}
              alt={attachment.name}
              className="max-h-[65vh] w-full rounded-lg object-contain"
            />
          ) : (
            <div className="flex flex-col items-center gap-4 py-12">
              <div className="flex size-20 items-center justify-center rounded-md bg-tertiary border-2 border-subtle">
                <FileIcon size={36} className="text-amber-400/70" />
              </div>
              <div className="text-center">
                <p className="text-sm text-secondary">{attachment.name}</p>
                <p className="mt-1 text-xs text-tertiary">
                  {formatSize(attachment.size)} &middot; {attachment.mimeType}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
