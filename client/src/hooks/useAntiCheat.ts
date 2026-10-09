import { useEffect, useRef, useState, useCallback } from 'react';
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
  const [isFullscreen, setIsFullscreen] = useState<boolean>(true);
  const [isWindowBlurred, setIsWindowBlurred] = useState<boolean>(false);
  const [isScreenshotBlocked, setIsScreenshotBlocked] = useState<boolean>(false);

  const lastVisibilityRef = useRef<number>(0);
  const lastFullscreenRef = useRef<number>(0);
  const lastBlurRef = useRef<number>(0);
  const screenshotTimeoutRef = useRef<any>(null);

  // Helper to report event via socket and fallback HTTP
  const reportEvent = useCallback(
    (
      eventType:
        | 'PAGE_HIDDEN'
        | 'FULLSCREEN_EXIT'
        | 'WINDOW_BLUR'
        | 'SCREENSHOT_ATTEMPT'
        | 'CLIPBOARD_VIOLATION',
      metadata: Record<string, any> = {}
    ) => {
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
        fetch(`/api/games/${gameId}/student/${studentId}/event`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventType, metadata }),
          keepalive: true,
        }).catch(() => {});
      }
    },
    [gameId, studentId, socket, onSecurityIncident]
  );

  // Request fullscreen programmatically
  const requestFullscreen = useCallback(async () => {
    try {
      const docEl = document.documentElement as any;
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen();
      } else if (docEl.webkitRequestFullscreen) {
        await docEl.webkitRequestFullscreen();
      } else if (docEl.mozRequestFullScreen) {
        await docEl.mozRequestFullScreen();
      }
      setIsFullscreen(true);
    } catch (err) {
      console.warn('Fullscreen request failed:', err);
    }
  }, []);

  const clearBlur = useCallback(() => {
    setIsWindowBlurred(false);
  }, []);

  useEffect(() => {
    if (!isActive || !gameId || !studentId) return;

    // 1. Right Click Prevention
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    // 2. Clipboard & Drag Prevention
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      try {
        e.clipboardData?.setData('text/plain', '');
      } catch {}
      reportEvent('CLIPBOARD_VIOLATION', { action: 'copy' });
      return false;
    };

    const handleCut = (e: ClipboardEvent) => {
      e.preventDefault();
      reportEvent('CLIPBOARD_VIOLATION', { action: 'cut' });
      return false;
    };

    const handleSelectStart = (e: Event) => {
      // Allow selection inside text inputs only
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return true;
      }
      e.preventDefault();
      return false;
    };

    const handleDragStart = (e: DragEvent) => {
      e.preventDefault();
      return false;
    };

    // 3. Keystroke Interception (PrintScreen, DevTools, Ctrl+C, Ctrl+P, etc.)
    const handleKeyDown = (e: KeyboardEvent) => {
      // PrintScreen interception
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen') {
        e.preventDefault();
        setIsScreenshotBlocked(true);

        // Clear system clipboard
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard
            .writeText('ВНИМАНИЕ: Снимок экрана заблокирован системой экзаменационного прокторинга.')
            .catch(() => {});
        }

        reportEvent('SCREENSHOT_ATTEMPT', { key: 'PrintScreen' });

        if (screenshotTimeoutRef.current) {
          clearTimeout(screenshotTimeoutRef.current);
        }
        screenshotTimeoutRef.current = setTimeout(() => {
          setIsScreenshotBlocked(false);
        }, 2500);

        return false;
      }

      // Block F12 (DevTools)
      if (e.key === 'F12' || e.code === 'F12') {
        e.preventDefault();
        return false;
      }

      // Block Ctrl combinations: Ctrl+U, Ctrl+S, Ctrl+P, Ctrl+Shift+I/J/C
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;
      if (isCtrlOrMeta) {
        const key = e.key.toLowerCase();
        if (
          key === 'u' || // View Source
          key === 's' || // Save
          key === 'p' || // Print
          key === 'c' || // Copy
          key === 'x' || // Cut
          key === 'a'    // Select All
        ) {
          // Allow inside input for typing navigation
          const target = e.target as HTMLElement;
          if (
            (key === 'a' || key === 'c' || key === 'x') &&
            target &&
            (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
          ) {
            return true;
          }
          e.preventDefault();
          return false;
        }

        // Ctrl+Shift+I / J / C (DevTools)
        if (e.shiftKey && (key === 'i' || key === 'j' || key === 'c')) {
          e.preventDefault();
          return false;
        }
      }
    };

    // Keyup for Printscreen on Windows
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen') {
        e.preventDefault();
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard
            .writeText('ВНИМАНИЕ: Снимок экрана заблокирован.')
            .catch(() => {});
        }
      }
    };

    // 4. Fullscreen State Monitoring
    const checkFullscreenState = () => {
      const fs = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement
      );
      setIsFullscreen(fs);

      if (!fs) {
        const now = Date.now();
        if (now - lastFullscreenRef.current > 1500) {
          lastFullscreenRef.current = now;
          reportEvent('FULLSCREEN_EXIT', { exitedAt: new Date().toISOString() });
        }
      }
    };

    // 5. Window Blur (Alt-Tab, lost focus to snipping tool, Telegram, etc.)
    const handleWindowBlur = () => {
      setIsWindowBlurred(true);
      const now = Date.now();
      if (now - lastBlurRef.current > 1500) {
        lastBlurRef.current = now;
        reportEvent('WINDOW_BLUR', { blurredAt: new Date().toISOString() });
      }
    };

    const handleWindowFocus = () => {
      setIsWindowBlurred(false);
    };

    // 6. Page Visibility (tab minimized / switched)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsWindowBlurred(true);
        const now = Date.now();
        if (now - lastVisibilityRef.current > 1000) {
          lastVisibilityRef.current = now;
          reportEvent('PAGE_HIDDEN', { hiddenAt: new Date().toISOString() });
        }
      }
    };

    // Register all security listeners
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('cut', handleCut);
    document.addEventListener('selectstart', handleSelectStart);
    document.addEventListener('dragstart', handleDragStart);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', checkFullscreenState);
    document.addEventListener('webkitfullscreenchange', checkFullscreenState);

    // Initial check
    checkFullscreenState();

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('cut', handleCut);
      document.removeEventListener('selectstart', handleSelectStart);
      document.removeEventListener('dragstart', handleDragStart);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', checkFullscreenState);
      document.removeEventListener('webkitfullscreenchange', checkFullscreenState);
      if (screenshotTimeoutRef.current) {
        clearTimeout(screenshotTimeoutRef.current);
      }
    };
  }, [isActive, gameId, studentId, reportEvent]);

  return {
    isFullscreen,
    isWindowBlurred,
    isScreenshotBlocked,
    requestFullscreen,
    clearBlur,
  };
}
