import React from 'react';
import { ShieldAlert, Maximize2, AlertOctagon, CameraOff } from 'lucide-react';

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
  // 1. Screenshot intercept overlay
  if (isScreenshotBlocked) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 bg-black text-white select-none animate-in fade-in duration-100">
        <div className="w-20 h-20 rounded-3xl bg-rose-500/20 border-2 border-rose-500 flex items-center justify-center mb-6 text-rose-500 animate-pulse">
          <CameraOff className="w-10 h-10" />
        </div>
        <div className="max-w-md text-center space-y-3">
          <span className="px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 text-xs font-bold tracking-wider uppercase font-mono">
            Система защиты от захвата экрана
          </span>
          <h2 className="text-2xl font-black text-white uppercase tracking-tight">
            Снимок экрана заблокирован
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            Попытка создания скриншота перехвачена. Буфер обмена очищен. Инцидент занесён в протокол председателя экзаменационной комиссии.
          </p>
        </div>
      </div>
    );
  }

  // 2. Fullscreen exit lockdown
  if (!isFullscreen) {
    return (
      <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-950/98 backdrop-blur-xl select-none">
        <div className="w-full max-w-md bg-slate-900 border-2 border-rose-600/60 rounded-3xl p-6 sm:p-8 text-center shadow-2xl shadow-rose-950/50 space-y-6">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-rose-500/10 border-2 border-rose-500/40 flex items-center justify-center text-rose-400 shadow-xl shadow-rose-950/30">
            <AlertOctagon className="w-10 h-10 animate-bounce" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-mono font-bold tracking-wider uppercase">
              <span>● НАРУШЕНИЕ РЕЖИМА БЕЗОПАСНОСТИ</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
              Выход из полноэкранного режима
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Экзамен проводится в защищённом полноэкранном режиме. Все экзаменационные задания скрыты. Таймер экзамена продолжает обратный отсчёт.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-800/40 text-left text-xs text-rose-200/90 space-y-1.5 font-mono">
            <div className="font-bold flex items-center gap-1 text-rose-300">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
              <span>ПРОТОКОЛ ПРОКТОРИНГА:</span>
            </div>
            <div>• Время инцидента зафиксировано на сервере</div>
            <div>• Попытка сворачивания окна передана преподавателю</div>
            <div>• Повторные выходы могут повлечь аннулирование работы</div>
          </div>

          <button
            onClick={onRequestFullscreen}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 active:scale-98 text-white font-black text-sm uppercase tracking-wider shadow-xl shadow-rose-950/60 flex items-center justify-center gap-2.5 transition-all min-h-[54px]"
          >
            <Maximize2 className="w-5 h-5" />
            <span>Вернуться в полноэкранный режим</span>
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
        <div className="w-full max-w-sm bg-slate-900 border-2 border-amber-500/50 rounded-3xl p-6 text-center shadow-2xl space-y-5">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <ShieldAlert className="w-8 h-8 animate-pulse" />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
              Внимание: потеря фокуса
            </span>
            <h2 className="text-xl font-black text-white">Окно экзамена неактивно</h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Обнаружен переход к стороннему приложению. Кликните по экрану, чтобы вернуться к выполнению заданий.
            </p>
          </div>

          <button
            onClick={onFocusWindow}
            className="w-full py-3.5 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all min-h-[48px]"
          >
            Кликните для возврата к тесту
          </button>
        </div>
      </div>
    );
  }

  return null;
};
