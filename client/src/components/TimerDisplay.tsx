import React, { useState, useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';

interface TimerDisplayProps {
  endsAt: string;
  serverTime?: string;
  onExpire?: () => void;
  className?: string;
}

/**
 * Server-authoritative countdown timer.
 * Uses monotonic performance.now() to ensure that changing the device clock
 * or timezone cannot manipulate the test countdown.
 */
export const TimerDisplay: React.FC<TimerDisplayProps> = ({
  endsAt,
  serverTime,
  onExpire,
  className = '',
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);
  const baselineRef = useRef<{ serverBaseMs: number; perfBaseMs: number } | null>(null);
  const hasExpiredRef = useRef(false);

  useEffect(() => {
    if (!endsAt) return;

    const targetMs = new Date(endsAt).getTime();
    const serverMs = serverTime ? new Date(serverTime).getTime() : Date.now();
    const perfMs = performance.now();

    baselineRef.current = {
      serverBaseMs: serverMs,
      perfBaseMs: perfMs,
    };
    hasExpiredRef.current = false;

    const updateTimer = () => {
      if (!baselineRef.current) return;
      const elapsed = performance.now() - baselineRef.current.perfBaseMs;
      const currentServerTime = baselineRef.current.serverBaseMs + elapsed;
      const diffMs = targetMs - currentServerTime;
      const secs = Math.max(0, Math.floor(diffMs / 1000));

      setSecondsRemaining(secs);

      if (secs <= 0 && !hasExpiredRef.current) {
        hasExpiredRef.current = true;
        if (onExpire) {
          onExpire();
        }
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 500);

    return () => clearInterval(interval);
  }, [endsAt, serverTime, onExpire]);

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  // Visual urgency styling
  const isCritical = secondsRemaining > 0 && secondsRemaining <= 60;
  const isWarning = secondsRemaining > 60 && secondsRemaining <= 180;

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono font-bold text-sm tracking-wider select-none transition-colors ${
        isCritical
          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse'
          : isWarning
          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
          : 'bg-slate-800 text-slate-200 border border-slate-700'
      } ${className}`}
    >
      <Clock className={`w-4 h-4 ${isCritical ? 'text-rose-400 animate-spin' : isWarning ? 'text-amber-400' : 'text-slate-400'}`} />
      <span>{formatted}</span>
    </div>
  );
};
