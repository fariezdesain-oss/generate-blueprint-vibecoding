import { ChatContent } from './ChatContent';

export default function ChatPage({
  searchParams,
}: {
  searchParams: { id?: string };
}) {
  return <ChatContent sessionIdParam={searchParams.id ?? null} />;
}
