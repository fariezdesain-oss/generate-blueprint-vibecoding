export interface ChatAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  storagePath: string;
}

function isPlainAttachment(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function isOwnedAttachmentPath(storagePath: string, userId: string, sessionId: string): boolean {
  const parts = storagePath.split('/');
  return (
    parts.length >= 3 &&
    parts[0] === userId &&
    parts[1] === sessionId &&
    parts.every((part) => part.length > 0 && part !== '..')
  );
}

export function sanitizeChatAttachments(files: unknown, userId: string, sessionId: string): ChatAttachment[] {
  if (files === undefined || files === null) return [];
  if (!Array.isArray(files)) throw new Error('files must be an array');

  return files.map((file) => {
    if (!isPlainAttachment(file)) throw new Error('Invalid attachment metadata');

    const { id, name, mimeType, size, storagePath } = file;
    if (
      typeof id !== 'string' ||
      typeof name !== 'string' ||
      typeof mimeType !== 'string' ||
      typeof size !== 'number' ||
      typeof storagePath !== 'string'
    ) {
      throw new Error('Invalid attachment metadata');
    }

    if (!isOwnedAttachmentPath(storagePath, userId, sessionId)) {
      throw new Error('Attachment does not belong to this session');
    }

    return { id, name, mimeType, size, storagePath };
  });
}
