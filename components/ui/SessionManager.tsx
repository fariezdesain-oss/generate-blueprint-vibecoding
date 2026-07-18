'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useInactivityTimeout } from '@/hooks/useInactivityTimeout';
import { SessionTimeoutModal } from './SessionTimeoutModal';
import { clearActiveChatSession } from '@/lib/utils/browserSession';
import { useChatStore } from '@/store/useChatStore';

export function SessionManager({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const logoutRef = useRef<AbortController | null>(null);

  const handleTimeout = useCallback(async () => {
    if (logoutRef.current) return;
    const controller = new AbortController();
    logoutRef.current = controller;

    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        signal: controller.signal,
      });
    } catch {
      // ignore if aborted
    } finally {
      logoutRef.current = null;
    }

    clearActiveChatSession(sessionStorage);
    useChatStore.getState().reset();
    router.push('/login');
    router.refresh();
  }, [router]);

  const { showWarning, timeRemaining, resetTimer } = useInactivityTimeout(handleTimeout);

  useEffect(() => {
    return () => {
      logoutRef.current?.abort();
    };
  }, []);

  return (
    <>
      {children}
      {showWarning && (
        <SessionTimeoutModal timeRemaining={timeRemaining} onStayLoggedIn={resetTimer} />
      )}
    </>
  );
}
