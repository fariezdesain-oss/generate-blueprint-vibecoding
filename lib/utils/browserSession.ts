type SessionStorage = Pick<Storage, 'removeItem'>;

export function clearActiveChatSession(storage: SessionStorage): void {
  storage.removeItem('activeSessionId');
}
