'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;
const DEFAULT_WARNING_MS = 60 * 1000;

function getTimeout(): number {
  if (typeof window === 'undefined') return DEFAULT_TIMEOUT_MS;
  const env = process.env.NEXT_PUBLIC_SESSION_TIMEOUT_MINUTES;
  if (!env) return DEFAULT_TIMEOUT_MS;
  const minutes = parseInt(env, 10);
  if (isNaN(minutes) || minutes < 1) return DEFAULT_TIMEOUT_MS;
  return minutes * 60 * 1000;
}

const TIMEOUT_MS = getTimeout();
const WARNING_MS = Math.min(DEFAULT_WARNING_MS, TIMEOUT_MS - 1000);

export function useInactivityTimeout(onTimeout: () => void) {
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(WARNING_MS);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTimeoutRef = useRef(onTimeout);
  const isExpiredRef = useRef(false);

  onTimeoutRef.current = onTimeout;

  const clearAllTimers = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  const startTimers = useCallback(() => {
    clearAllTimers();
    setShowWarning(false);

    if (isExpiredRef.current) return;

    warningTimerRef.current = setTimeout(() => {
      if (isExpiredRef.current) return;
      setShowWarning(true);
      setTimeRemaining(WARNING_MS);

      countdownRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          const next = prev - 1000;
          if (next <= 0) {
            isExpiredRef.current = true;
            clearAllTimers();
            onTimeoutRef.current();
            return 0;
          }
          return next;
        });
      }, 1000);
    }, TIMEOUT_MS - WARNING_MS);
  }, [clearAllTimers]);

  const resetTimer = useCallback(() => {
    isExpiredRef.current = false;
    startTimers();
  }, [startTimers]);

  useEffect(() => {
    startTimers();

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    let throttleId: ReturnType<typeof setTimeout> | null = null;

    const handleActivity = () => {
      if (isExpiredRef.current) return;
      if (throttleId) return;
      throttleId = setTimeout(() => {
        throttleId = null;
      }, 1000);
      resetTimer();
    };

    events.forEach((event) => window.addEventListener(event, handleActivity));

    return () => {
      clearAllTimers();
      events.forEach((event) => window.removeEventListener(event, handleActivity));
      if (throttleId) clearTimeout(throttleId);
    };
  }, [startTimers, resetTimer, clearAllTimers]);

  return { showWarning, timeRemaining, resetTimer };
}
