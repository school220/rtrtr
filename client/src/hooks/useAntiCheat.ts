import { useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';

interface AntiCheatOptions {
  gameId: string;
  studentId: number;
  socket: Socket | null;
  isActive: boolean;
  onSecurityIncident?: (type: string) => void;
}

export function useAntiCheat({
  gameId,
  studentId,
  socket,
  isActive,
  onSecurityIncident,
}: AntiCheatOptions) {
  const lastVisibilityRef = useRef<number>(0);
  const lastFullscreenRef = useRef<number>(0);

  useEffect(() => {
    if (!isActive || !gameId || !studentId) return;

    // Helper to report event via socket and fallback HTTP
    const reportEvent = (eventType: 'PAGE_HIDDEN' | 'FULLSCREEN_EXIT', metadata: Record<string, any> = {}) => {
      if (onSecurityIncident) {
        onSecurityIncident(eventType);
      }

      if (socket && socket.connected) {
        socket.emit('student:security_event', {
          gameId,
          studentId,
          eventType,
          metadata,
        });
      } else {
        // Fallback HTTP beacon
        fetch(`/api/games/${gameId}/student/${studentId}/event`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventType, metadata }),
          keepalive: true,
        }).catch(() => {});
      }
    };

    // 1. Visibility change listener (tab switch or app minimized)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        const now = Date.now();
        // Debounce within 1 second
        if (now - lastVisibilityRef.current > 1000) {
          lastVisibilityRef.current = now;
          reportEvent('PAGE_HIDDEN', { hiddenAt: new Date().toISOString() });
        }
      }
    };

    // 2. Pagehide listener
    const handlePageHide = () => {
      reportEvent('PAGE_HIDDEN', { reason: 'pagehide' });
    };

    // 3. Fullscreen exit listener
    const handleFullscreenChange = () => {
      const isFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement
      );

      if (!isFullscreen) {
        const now = Date.now();
        if (now - lastFullscreenRef.current > 1500) {
          lastFullscreenRef.current = now;
          reportEvent('FULLSCREEN_EXIT', { exitedAt: new Date().toISOString() });
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [isActive, gameId, studentId, socket, onSecurityIncident]);
}
