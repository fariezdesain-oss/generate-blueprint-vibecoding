export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  storagePath: string;
  url?: string;
}

export interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  attachments?: Attachment[];
}
