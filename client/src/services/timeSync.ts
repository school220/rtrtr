import { Socket } from 'socket.io-client';
import { getSharedSocket } from '../hooks/useSocket.js';

export interface TimerTickData {
  gameId: string;
  remainingSeconds: number;
  totalTimeSeconds: number;
  serverTime: number;
  endsAt: string;
}

type TickListener = (tick: TimerTickData) => void;

class TimeSyncManager {
  private offsetMs: number = 0;
  private isSynced: boolean = false;
  private listeners: Set<TickListener> = new Set();
  private lastTick: TimerTickData | null = null;
  private syncCount: number = 0;

  constructor() {
    this.init();
  }

  private init() {
    if (typeof window === 'undefined') return;

    const socket = getSharedSocket();

    socket.on('connect', () => {
      this.syncClock(socket);
    });

    socket.on('time:pong', (data: { clientTimestamp: number; serverTime: number }) => {
      const now = performance.now();
      const rtt = now - data.clientTimestamp;
      const estimatedServerNow = data.serverTime + Math.round(rtt / 2);
      const measuredOffset = estimatedServerNow - Date.now();

      // Exponential moving average for clock offset smoothing
      if (!this.isSynced) {
        this.offsetMs = measuredOffset;
        this.isSynced = true;
      } else {
        this.offsetMs = Math.round(this.offsetMs * 0.7 + measuredOffset * 0.3);
      }
      this.syncCount++;
    });

    socket.on('game:timer_tick', (data: TimerTickData) => {
      this.lastTick = data;
      this.listeners.forEach((listener) => {
        try {
          listener(data);
        } catch (err) {
          console.error('Error in timer tick listener:', err);
        }
      });
    });

    // Re-sync on window focus or when device comes out of sleep/lock screen
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.syncClock(socket);
      }
    });

    window.addEventListener('focus', () => {
      this.syncClock(socket);
    });

    // Periodic background clock drift check every 20 seconds
    setInterval(() => {
      this.syncClock(socket);
    }, 20000);

    // Initial sync
    if (socket.connected) {
      this.syncClock(socket);
    } else {
      // Fallback via HTTP if socket not yet connected
      this.syncViaHttp();
    }
  }

  public async syncViaHttp() {
    try {
      const t0 = performance.now();
      const res = await fetch('/api/time');
      if (res.ok) {
        const json = await res.json();
        const t1 = performance.now();
        const rtt = t1 - t0;
        const estimatedServerNow = json.serverTime + Math.round(rtt / 2);
        this.offsetMs = estimatedServerNow - Date.now();
        this.isSynced = true;
      }
    } catch {
      // Silently ignore HTTP sync errors
    }
  }

  public syncClock(socket?: Socket) {
    const s = socket || getSharedSocket();
    if (s.connected) {
      s.emit('time:ping', { clientTimestamp: performance.now() });
    }
  }

  /**
   * Returns authoritative server timestamp in milliseconds (independent of device clock error)
   */
  public getServerNow(): number {
    return Date.now() + this.offsetMs;
  }

  /**
   * Subscribe to authoritative 1-second server heartbeat ticks
   */
  public subscribeTicks(listener: TickListener): () => void {
    this.listeners.add(listener);
    if (this.lastTick) {
      listener(this.lastTick);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getLastTick(): TimerTickData | null {
    return this.lastTick;
  }

  public getIsSynced(): boolean {
    return this.isSynced;
  }
}

export const timeSync = new TimeSyncManager();
