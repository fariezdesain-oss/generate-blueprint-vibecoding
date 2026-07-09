'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

const ChatContent = dynamic(
  () => import('./ChatContent').then((mod) => mod.ChatContent),
  {
    ssr: false,
    loading: () => <div className="flex flex-1" />,
  },
);

export default function ChatPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return <ChatContent />;
}
