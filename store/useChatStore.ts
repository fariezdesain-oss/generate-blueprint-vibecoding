import { create } from 'zustand';
import type { Message } from '@/types/chat';

type GenerationMode = 'docs' | 'n8n';

interface ChatState {
  messages: Message[];
  sessionId: string | null;
  sessionTitle: string;
  isGenerating: boolean;
  streamingContent: string;
  chatError: string | null;
  sidebarVersion: number;
  canGenerate: boolean;
  mode: GenerationMode;

  setSessionId: (id: string | null) => void;
  setSessionTitle: (title: string) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  setIsGenerating: (value: boolean) => void;
  setStreamingContent: (content: string) => void;
  appendStreamingContent: (token: string) => void;
  setChatError: (error: string | null) => void;
  bumpSidebar: () => void;
  setCanGenerate: (value: boolean) => void;
  setMode: (mode: GenerationMode) => void;
  reset: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  sessionId: null,
  sessionTitle: '',
  isGenerating: false,
  streamingContent: '',
  chatError: null,
  sidebarVersion: 0,
  canGenerate: false,
  mode: 'docs',

  setSessionId: (id) => set({ sessionId: id }),
  setSessionTitle: (title) => set({ sessionTitle: title }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  setIsGenerating: (value) => set({ isGenerating: value }),
  setStreamingContent: (content) => set({ streamingContent: content }),
  appendStreamingContent: (token) =>
    set((state) => ({ streamingContent: state.streamingContent + token })),
  setChatError: (error) => set({ chatError: error }),
  bumpSidebar: () => set((s) => ({ sidebarVersion: s.sidebarVersion + 1 })),
  setCanGenerate: (value) => set({ canGenerate: value }),
  setMode: (mode) => set({ mode }),
  reset: () =>
    set({
      messages: [],
      sessionId: null,
      sessionTitle: '',
      isGenerating: false,
      streamingContent: '',
      chatError: null,
      sidebarVersion: 0,
      canGenerate: false,
          mode: 'docs',
    }),
}));
