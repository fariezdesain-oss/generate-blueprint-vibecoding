'use client';

import { useRef, useState } from 'react';
import { Paperclip, X, FileIcon, ImageIcon, Wand2 } from 'lucide-react';
import { FilePreviewModal } from './FilePreviewModal';
import type { Attachment } from '@/types/chat';

const MAX_FILES = 5;
const ACCEPT = '.png,.jpg,.jpeg,.gif,.webp,.pdf,.txt,.md';

interface FilePickerProps {
  sessionId: string | null;
  onFilesReady: (_files: Attachment[]) => void;
  disabled?: boolean;
}

export function FilePicker({ sessionId, onFilesReady, disabled }: FilePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState<Attachment | null>(null);

  const handleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || !sessionId) return;

    const remaining = MAX_FILES - attachments.length;
    const toUpload = Array.from(fileList).slice(0, remaining);

    if (toUpload.length === 0) return;

    setUploading(true);

    const uploaded: Attachment[] = [];

    for (const file of toUpload) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sessionId', sessionId);

      try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const json = await res.json();
        if (json.success) {
          uploaded.push(json.data);
        }
      } catch {
        // skip failed upload
      }
    }

    const all = [...attachments, ...uploaded];
    setAttachments(all);
    onFilesReady(all);
    setUploading(false);

    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const removeFile = (id: string) => {
    const filtered = attachments.filter((a) => a.id !== id);
    setAttachments(filtered);
    onFilesReady(filtered);
  };

  const isImage = (mime: string) => mime.startsWith('image/');

  return (
    <div className="flex flex-wrap items-center gap-2">
      {attachments.map((att) => (
        <button
          key={att.id}
          type="button"
          onClick={() => setPreviewFile(att)}
          className="group relative flex items-center gap-2 !rounded-none border-2 border-border bg-tertiary px-2 py-1.5 transition-all duration-200 hover:bg-secondary hover:shadow-[3px_3px_0_var(--border)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_var(--border)]"
        >
          {isImage(att.mimeType) ? (
            <ImageIcon size={14} className="text-gemini-blue stroke-[2.5px]" />
          ) : (
            <FileIcon size={14} className="text-gemini-orange stroke-[2.5px]" />
          )}
          <span className="max-w-[100px] truncate text-xs font-bold text-primary">{att.name}</span>
          <div
            onClick={(e) => {
              e.stopPropagation();
              removeFile(att.id);
            }}
            className="ml-0.5 !rounded-none border-2 border-transparent p-0.5 text-tertiary opacity-0 transition-all duration-200 group-hover:opacity-100 hover:border-border hover:bg-gemini-red hover:text-white active:translate-y-[1px]"
          >
            <X size={12} className="stroke-[2.5px]" />
          </div>
        </button>
      ))}

      {attachments.length < MAX_FILES && (
        <>
          {uploading ? (
            <div className="flex items-center gap-2 !rounded-none border-2 border-border bg-secondary px-3 py-1.5 shadow-[2px_2px_0_var(--border)]">
              <Wand2 size={14} className="animate-wand-swing text-primary stroke-[2.5px]" />
              <span className="text-xs font-bold uppercase tracking-widest text-primary">Uploading...</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={disabled}
              className="flex items-center gap-2 !rounded-none border-2 border-dashed border-[#10b981] dark:border-border px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-secondary transition-all duration-200 hover:border-solid hover:bg-tertiary hover:text-primary hover:shadow-[3px_3px_0_var(--border)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_var(--border)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:active:translate-x-0 disabled:active:translate-y-0"
            >
              <Paperclip size={14} className="stroke-[2.5px]" />
              Attach
            </button>
          )}
        </>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        onChange={handleSelect}
        className="hidden"
      />

      {previewFile && (
        <FilePreviewModal attachment={previewFile} onClose={() => setPreviewFile(null)} />
      )}
    </div>
  );
}
