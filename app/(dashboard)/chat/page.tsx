'use client';

import dynamic from 'next/dynamic';

const ChatContent = dynamic(
  () => import('./ChatContent').then((mod) => mod.ChatContent),
  {
    ssr: false,
    loading: () => <div className="flex flex-1" />,
  },
);

export default function ChatPage() {
  return <ChatContent />;
}
