import React, { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  variant?: 'danger' | 'warning' | 'primary';
  confirmDisabled?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  confirmText,
  cancelText = 'Отмена',
  onConfirm,
  variant = 'primary',
  confirmDisabled = false,
}) => {
  // Prevent background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const confirmBtnStyles =
    variant === 'danger'
      ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/30'
      : variant === 'warning'
      ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/30'
      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/30';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl transition-all transform animate-in slide-in-from-bottom duration-250 select-none"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            {variant === 'danger' && <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />}
            <h3 className="text-lg font-bold text-slate-100">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4 text-sm text-slate-300 leading-relaxed">{children}</div>

        <div className="flex flex-col-reverse sm:flex-row gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-1/2 py-3.5 px-4 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-200 font-semibold text-sm transition-colors active:scale-98 min-h-[48px]"
          >
            {cancelText}
          </button>

          {confirmText && onConfirm && (
            <button
              type="button"
              disabled={confirmDisabled}
              onClick={onConfirm}
              className={`w-full sm:w-1/2 py-3.5 px-4 rounded-xl font-bold text-sm shadow-lg transition-all active:scale-98 disabled:opacity-50 disabled:pointer-events-none min-h-[48px] ${confirmBtnStyles}`}
            >
              {confirmText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
