'use client';
import { useEffect, useRef } from 'react';

const HEARTBEAT_INTERVAL_MS = 60_000; // 1 min max

export function useActivityHeartbeat(active: boolean) {
  const lastSentRef = useRef(0);

  useEffect(() => {
    if (!active) return;

    const send = () => {
      const now = Date.now();
      if (now - lastSentRef.current < HEARTBEAT_INTERVAL_MS) return;
      lastSentRef.current = now;
      fetch('/api/auth/activity', { method: 'PATCH' }).catch(() => {});
    };

    send();

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    const handler = () => send();
    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    const interval = setInterval(send, HEARTBEAT_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      events.forEach((e) => window.removeEventListener(e, handler));
    };
  }, [active]);
}
