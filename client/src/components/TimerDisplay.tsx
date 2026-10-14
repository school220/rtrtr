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
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono font-bold text-xs sm:text-sm tracking-wider select-none shadow-xs border transition-colors ${
        isCritical
          ? 'bg-rose-600 text-white border-rose-700 animate-pulse shadow-rose-600/30'
          : isWarning
          ? 'bg-amber-100 text-amber-950 border-amber-300 shadow-amber-500/10'
          : 'bg-white text-[#1f5f79] border-gray-200'
      } ${className}`}
    >
      <Clock className={`w-3.5 h-3.5 shrink-0 ${isCritical ? 'text-white animate-spin' : isWarning ? 'text-amber-700' : 'text-[#25718f]'}`} />
      <span>{formatted}</span>
    </div>
  );
};
