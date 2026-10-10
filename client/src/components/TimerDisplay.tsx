import React, { useState, useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';
import { timeSync, TimerTickData } from '../services/timeSync.js';

interface TimerDisplayProps {
  endsAt: string;
  serverTime?: string;
  onExpire?: () => void;
  className?: string;
}

/**
 * Server-authoritative, monotonic, synchronized countdown timer.
 * Eliminates jitter and time jumps by:
 * 1. Synchronizing with server ticks (game:timer_tick) via WebSocket.
 * 2. Enforcing smooth monotonic 1-second local decrement (no jumping back and forth).
 * 3. Correcting for device clock skew using Cristian's NTP algorithm.
 */
export const TimerDisplay: React.FC<TimerDisplayProps> = ({
  endsAt,
  onExpire,
  className = '',
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
    if (!endsAt) return 0;
    const targetMs = new Date(endsAt).getTime();
    const serverNow = timeSync.getServerNow();
    return Math.max(0, Math.floor((targetMs - serverNow) / 1000));
  });

  const localSecondsRef = useRef<number>(secondsRemaining);
  const hasExpiredRef = useRef<boolean>(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  // Initialize or re-anchor target time when endsAt changes
  useEffect(() => {
    if (!endsAt) return;

    const targetMs = new Date(endsAt).getTime();
    const serverNow = timeSync.getServerNow();
    const initialSecs = Math.max(0, Math.floor((targetMs - serverNow) / 1000));

    localSecondsRef.current = initialSecs;
    setSecondsRemaining(initialSecs);
    hasExpiredRef.current = false;
  }, [endsAt]);

  // Subscribe to authoritative 1-second server heartbeat ticks
  useEffect(() => {
    if (!endsAt) return;

    const handleTick = (tick: TimerTickData) => {
      const serverSecs = tick.remainingSeconds;
      const currentLocal = localSecondsRef.current;

      // If local time matches server within 1 second, DO NOT JUMP (smooth local ticker)
      const diff = Math.abs(currentLocal - serverSecs);
      if (diff > 1) {
        // Device drifted (e.g. tab was minimized / phone locked screen for a while)
        localSecondsRef.current = serverSecs;
        setSecondsRemaining(serverSecs);
      }

      if (serverSecs <= 0 && !hasExpiredRef.current) {
        hasExpiredRef.current = true;
        onExpireRef.current?.();
      }
    };

    const unsubscribe = timeSync.subscribeTicks(handleTick);
    return () => {
      unsubscribe();
    };
  }, [endsAt]);

  // Smooth local 1-second ticker between server heartbeats
  useEffect(() => {
    if (!endsAt) return;

    const interval = setInterval(() => {
      if (localSecondsRef.current > 0) {
        localSecondsRef.current -= 1;
        setSecondsRemaining(localSecondsRef.current);

        if (localSecondsRef.current <= 0 && !hasExpiredRef.current) {
          hasExpiredRef.current = true;
          onExpireRef.current?.();
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [endsAt]);

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
