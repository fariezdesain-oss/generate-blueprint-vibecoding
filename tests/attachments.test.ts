import { isOwnedAttachmentPath, sanitizeChatAttachments } from '@/lib/utils/attachments';

describe('attachments', () => {
  const userId = 'user-123';
  const sessionId = 'session-456';

  it('should allow paths under the current user and session', () => {
    expect(isOwnedAttachmentPath('user-123/session-456/file.txt', userId, sessionId)).toBe(true);
  });

  it('should reject paths for another user or session', () => {
    expect(isOwnedAttachmentPath('other-user/session-456/file.txt', userId, sessionId)).toBe(false);
    expect(isOwnedAttachmentPath('user-123/other-session/file.txt', userId, sessionId)).toBe(false);
  });

  it('should sanitize valid attachment metadata', () => {
    const attachments = sanitizeChatAttachments([
      {
        id: 'file-1',
        name: 'brief.pdf',
        mimeType: 'application/pdf',
        size: 1234,
        storagePath: 'user-123/session-456/brief.pdf',
      },
    ], userId, sessionId);

    expect(attachments).toEqual([
      {
        id: 'file-1',
        name: 'brief.pdf',
        mimeType: 'application/pdf',
        size: 1234,
        storagePath: 'user-123/session-456/brief.pdf',
      },
    ]);
  });

  it('should reject invalid attachment metadata', () => {
    expect(() => sanitizeChatAttachments([{ storagePath: 'user-123/session-456/file.txt' }], userId, sessionId)).toThrow(
      'Invalid attachment metadata',
    );
  });

  it('should reject attachment metadata that points outside the session', () => {
    expect(() => sanitizeChatAttachments([
      {
        id: 'file-1',
        name: 'brief.pdf',
        mimeType: 'application/pdf',
        size: 1234,
        storagePath: 'user-123/other-session/brief.pdf',
      },
    ], userId, sessionId)).toThrow('Attachment does not belong to this session');
  });
});
