import { Suspense } from 'react';
import { ChatContent } from './ChatContent';

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="flex flex-1" />}>
      <ChatContent />
    </Suspense>
  );
}