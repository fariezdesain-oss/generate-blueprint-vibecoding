import { clearActiveChatSession } from '@/lib/utils/browserSession';

describe('clearActiveChatSession', () => {
  it('menghapus sesi chat aktif dari session storage', () => {
    const removeItem = jest.fn();

    clearActiveChatSession({ removeItem });

    expect(removeItem).toHaveBeenCalledWith('activeSessionId');
  });
});
