import React from 'react';
import { User, GraduationCap, FileSpreadsheet, Sparkles } from 'lucide-react';

interface HomeProps {
  onSelectRole: (role: 'student' | 'teacher' | 'import') => void;
}

export const Home: React.FC<HomeProps> = ({ onSelectRole }) => {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 select-none">
      <div className="w-full max-w-md space-y-8 text-center animate-in fade-in duration-300">
        {/* Brand / Logo */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold tracking-wide">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Классная система тестирования 2.0</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Класс<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Тест</span>
          </h1>
          <p className="text-sm sm:text-base text-slate-400 max-w-sm mx-auto">
            Быстрое тестирование в реальном времени для 37+ учеников с защитой от списывания
          </p>
        </div>

        {/* Role Selection Cards */}
        <div className="space-y-3.5 pt-2">
          {/* Student Join Button */}
          <button
            onClick={() => onSelectRole('student')}
            className="w-full p-5 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white shadow-xl shadow-indigo-950/50 flex items-center gap-4 transition-all active:scale-98 group border border-indigo-400/20 min-h-[72px]"
          >
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <User className="w-6 h-6 text-white" />
            </div>
            <div className="text-left flex-1">
              <div className="text-lg font-bold">Я — Ученик</div>
              <div className="text-xs text-indigo-200">Ввести код игры и начать тест</div>
            </div>
          </button>

          {/* Teacher Dashboard Button */}
          <button
            onClick={() => onSelectRole('teacher')}
            className="w-full p-5 rounded-2xl bg-slate-900 hover:bg-slate-800/80 text-white border border-slate-800 hover:border-slate-700 shadow-xl flex items-center gap-4 transition-all active:scale-98 group min-h-[72px]"
          >
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <GraduationCap className="w-6 h-6 text-purple-400" />
            </div>
            <div className="text-left flex-1">
              <div className="text-lg font-bold">Я — Учитель</div>
              <div className="text-xs text-slate-400">Создать комнату и следить за классом</div>
            </div>
          </button>

          {/* Form Import & Inspection Button */}
          <button
            onClick={() => onSelectRole('import')}
            className="w-full p-4 rounded-xl bg-slate-900/60 hover:bg-slate-900 text-slate-300 border border-slate-800/60 flex items-center gap-3 transition-colors text-sm font-medium"
          >
            <FileSpreadsheet className="w-5 h-5 text-slate-400 shrink-0" />
            <span>Управление бланками и импорт JSON</span>
          </button>
        </div>

        {/* Feature Highlights */}
        <div className="pt-6 grid grid-cols-3 gap-2 text-center text-[11px] text-slate-500 border-t border-slate-900">
          <div>
            <strong className="block text-slate-300 text-xs font-semibold">50 Бланков</strong>
            уникальные варианты
          </div>
          <div>
            <strong className="block text-slate-300 text-xs font-semibold">Real-time</strong>
            мгновенные ответы
          </div>
          <div>
            <strong className="block text-slate-300 text-xs font-semibold">KaTeX</strong>
            чёткая математика
          </div>
        </div>
      </div>
    </div>
  );
};
