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
          className="group relative flex items-center gap-1.5 rounded-lg border border-subtle bg-tertiary px-2 py-1.5 transition-all duration-200 hover:bg-tertiary hover:border-hover-color"
        >
          {isImage(att.mimeType) ? (
            <ImageIcon size={14} className="text-gemini-blue/70" />
          ) : (
            <FileIcon size={14} className="text-amber-400/70" />
          )}
          <span className="max-w-[100px] truncate text-xs text-secondary">{att.name}</span>
          <div
            onClick={(e) => {
              e.stopPropagation();
              removeFile(att.id);
            }}
            className="ml-0.5 rounded-full p-0.5 text-tertiary opacity-0 transition-all duration-200 group-hover:opacity-100 hover:bg-tertiary hover:text-secondary"
          >
            <X size={12} />
          </div>
        </button>
      ))}

      {attachments.length < MAX_FILES && (
        <>
          {uploading ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-subtle bg-secondary px-3 py-1.5">
              <Wand2 size={14} className="animate-wand-swing text-primary" />
              <span className="text-xs text-tertiary">Uploading...</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={disabled}
              className="flex items-center gap-1.5 rounded-lg border border-dashed border-subtle px-3 py-1.5 text-xs text-tertiary transition-all duration-200 hover:border-hover-color hover:text-secondary disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Paperclip size={14} />
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
