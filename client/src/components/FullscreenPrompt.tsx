import React, { useState } from 'react';
import { Maximize2, ShieldCheck } from 'lucide-react';

interface FullscreenPromptProps {
  onProceed: () => void;
}

export const FullscreenPrompt: React.FC<FullscreenPromptProps> = ({ onProceed }) => {
  const [loading, setLoading] = useState(false);

  const handleRequestFullscreen = async () => {
    setLoading(true);
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      } else if ((document.documentElement as any).webkitRequestFullscreen) {
        await (document.documentElement as any).webkitRequestFullscreen();
      }
    } catch {
      // Browsers or devices like iOS Safari without Fullscreen API silently continue
      console.warn('Fullscreen request was declined or is unsupported on this device.');
    } finally {
      onProceed();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-md">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
          <Maximize2 className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white">Режим тестирования</h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            Для начала теста нажмите <strong className="text-indigo-400">«Продолжить»</strong>, чтобы включить полноэкранный режим.
          </p>
        </div>

        <div className="flex items-center gap-2 p-3 bg-slate-800/60 rounded-xl text-xs text-slate-400 text-left border border-slate-700/50">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>Переключение вкладок и выход из режима фиксируются системой.</span>
        </div>

        <button
          onClick={handleRequestFullscreen}
          disabled={loading}
          className="w-full py-4 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-white font-bold text-base shadow-lg shadow-indigo-900/40 transition-all min-h-[52px]"
        >
          {loading ? 'Запуск...' : 'Продолжить'}
        </button>
      </div>
    </div>
  );
};
