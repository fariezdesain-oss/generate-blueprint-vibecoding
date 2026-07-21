'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useChatStore } from '@/store/useChatStore';

export function NewChatButton() {
  const router = useRouter();
  const resetChatStore = useChatStore((s) => s.reset);

  const handleNewChat = () => {
    resetChatStore();
    sessionStorage.removeItem('activeSessionId');
    router.push('/chat');
  };

  return (
    <button
      onClick={handleNewChat}
      className="group flex w-full items-center gap-3 !rounded-none border-2 border-transparent px-2 py-1.5 text-xs font-bold uppercase transition-all duration-200 hover:border-border hover:bg-tertiary hover:text-primary text-secondary hover:shadow-[3px_3px_0_var(--border)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_var(--border)]"
    >
      <Plus size={16} className="text-primary stroke-[2.5px]" />
      New Chat
    </button>
  );
}
