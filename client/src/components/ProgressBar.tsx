import React from 'react';

interface ProgressBarProps {
  current: number;
  total: number;
  answeredCount?: number;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  current,
  total,
  answeredCount,
  className = '',
}) => {
  const percentage = Math.min(100, Math.max(0, Math.round((current / total) * 100)));

  return (
    <div className={`w-full ${className}`}>
      <div className="flex justify-between items-center text-xs font-semibold text-slate-300 mb-1.5 select-none">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
          Вопрос <span className="text-white font-bold text-sm">{current}</span> из {total}
        </span>
        {answeredCount !== undefined && (
          <span className="text-slate-400">
            Отвечено: <strong className="text-slate-200">{answeredCount}</strong>/{total}
          </span>
        )}
      </div>

      <div
        className="w-full h-2.5 bg-slate-800/80 rounded-full overflow-hidden border border-slate-700/60 p-0.5"
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={1}
        aria-valuemax={total}
      >
        <div
          className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
