import React from 'react';
import { ShieldAlert, Maximize2, AlertOctagon, CameraOff } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext.js';

interface SecurityLockdownModalProps {
  isFullscreen: boolean;
  isWindowBlurred: boolean;
  isScreenshotBlocked: boolean;
  onRequestFullscreen: () => void;
  onFocusWindow: () => void;
}

export const SecurityLockdownModal: React.FC<SecurityLockdownModalProps> = ({
  isFullscreen,
  isWindowBlurred,
  isScreenshotBlocked,
  onRequestFullscreen,
  onFocusWindow,
}) => {
  const { t } = useLanguage();

  // 1. Screenshot intercept overlay
  if (isScreenshotBlocked) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 bg-black text-white select-none animate-in fade-in duration-100">
        <div className="w-20 h-20 rounded-2xl bg-rose-500/20 border-2 border-rose-500 flex items-center justify-center mb-6 text-rose-500 animate-pulse">
          <CameraOff className="w-10 h-10" />
        </div>
        <div className="max-w-md text-center space-y-3">
          <span className="px-3 py-1 rounded bg-rose-500/20 border border-rose-500/40 text-rose-400 text-xs font-bold tracking-wider uppercase font-mono">
            {t.lockScreenshotBadge}
          </span>
          <h2 className="text-2xl font-black text-white uppercase tracking-tight">
            {t.lockScreenshotTitle}
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed font-mono">
            {t.lockScreenshotDesc}
          </p>
        </div>
      </div>
    );
  }

  // 2. Fullscreen exit lockdown
  if (!isFullscreen) {
    return (
      <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-950/98 backdrop-blur-xl select-none">
        <div className="w-full max-w-md bg-white border-2 border-rose-600 rounded-lg p-6 sm:p-8 text-center shadow-2xl space-y-5 text-gray-900">
          <div className="w-16 h-16 mx-auto rounded-full bg-rose-100 border-2 border-rose-400 flex items-center justify-center text-rose-600">
            <AlertOctagon className="w-8 h-8 animate-bounce" />
          </div>

          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded bg-rose-100 text-rose-800 text-xs font-mono font-bold tracking-wider uppercase">
              <span>{t.lockFullscreenBadge}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 uppercase tracking-tight">
              {t.lockFullscreenTitle}
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed font-mono">
              {t.lockFullscreenDesc}
            </p>
          </div>

          <div className="p-3 rounded bg-rose-50 border border-rose-200 text-left text-xs text-rose-900 space-y-1 font-mono">
            <div className="font-bold flex items-center gap-1 text-rose-700">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
              <span>{t.lockFullscreenProtocol}</span>
            </div>
            <div>{t.lockFullscreenP1}</div>
            <div>{t.lockFullscreenP2}</div>
            <div>{t.lockFullscreenP3}</div>
          </div>

          <button
            onClick={onRequestFullscreen}
            className="w-full py-3.5 px-6 rounded bg-rose-600 hover:bg-rose-700 active:scale-98 text-white font-bold text-xs uppercase tracking-wider shadow flex items-center justify-center gap-2 transition-all"
          >
            <Maximize2 className="w-4 h-4" />
            <span>{t.lockFullscreenReturnBtn}</span>
          </button>
        </div>
      </div>
    );
  }

  // 3. Window blur / switch application alert
  if (isWindowBlurred) {
    return (
      <div
        onClick={onFocusWindow}
        className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-md select-none cursor-pointer"
      >
        <div className="w-full max-w-sm bg-white border-2 border-amber-500 rounded-lg p-6 text-center shadow-2xl space-y-4 text-gray-900">
          <div className="w-14 h-14 mx-auto rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-600">
            <ShieldAlert className="w-7 h-7 animate-pulse" />
          </div>

          <div className="space-y-1">
            <span className="text-xs font-mono font-bold text-amber-700 uppercase tracking-wider">
              {t.lockBlurBadge}
            </span>
            <h2 className="text-lg font-black text-gray-900">{t.lockBlurTitle}</h2>
            <p className="text-xs text-gray-600 leading-relaxed font-mono">
              {t.lockBlurDesc}
            </p>
          </div>

          <button
            onClick={onFocusWindow}
            className="w-full py-2.5 px-4 rounded bg-[#25718f] hover:bg-[#1f5f79] text-white font-bold text-xs uppercase tracking-wider font-mono"
          >
            {t.lockBlurReturnBtn}
          </button>
        </div>
      </div>
    );
  }

  return null;
};
