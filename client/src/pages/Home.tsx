import React from 'react';
import { UserCheck, ShieldCheck, FileSpreadsheet, Award, BookOpen } from 'lucide-react';

interface HomeProps {
  onSelectRole: (role: 'student' | 'teacher' | 'import') => void;
}

export const Home: React.FC<HomeProps> = ({ onSelectRole }) => {
  return (
    <div className="min-h-screen bg-[#0a0f1d] text-slate-100 flex flex-col justify-between p-4 sm:p-6 select-none font-sans">
      {/* Top Academic Department Header */}
      <header className="max-w-4xl w-full mx-auto text-center pt-4 sm:pt-8 space-y-2">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-950/60 border border-blue-800/60 text-blue-300 text-[11px] font-mono uppercase tracking-widest font-bold">
          <ShieldCheck className="w-4 h-4 text-blue-400" />
          <span>СИСТЕМА НЕЗАВИСИМОЙ ОЦЕНКИ КАЧЕСТВА ОБРАЗОВАНИЯ</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight uppercase">
          Единая система экзаменационного тестирования
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto font-mono">
          Программно-аппаратный комплекс проведения синхронного аудиторного тестирования обучающихся с защитой от списывания
        </p>
      </header>

      {/* Main Role Selection Centerpiece */}
      <main className="max-w-md w-full mx-auto my-auto py-6 space-y-4">
        {/* Student Entry Card */}
        <button
          type="button"
          onClick={() => onSelectRole('student')}
          className="w-full p-5 sm:p-6 rounded-2xl bg-[#0f172a] hover:bg-[#162035] border-2 border-blue-500/50 hover:border-blue-400 text-white shadow-xl shadow-blue-950/30 flex items-center gap-4 transition-all active:scale-98 group text-left min-h-[84px]"
        >
          <div className="w-14 h-14 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform text-blue-400">
            <UserCheck className="w-7 h-7" />
          </div>
          <div className="flex-1">
            <div className="text-base sm:text-lg font-bold uppercase tracking-wide flex items-center gap-2">
              <span>Вход экзаменуемого</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                УЧЕНИК
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-0.5 font-mono">
              Ввод кода допуска и автоматическое получение КИМ
            </div>
          </div>
        </button>

        {/* Teacher / Proctor Entry Card */}
        <button
          type="button"
          onClick={() => onSelectRole('teacher')}
          className="w-full p-5 sm:p-6 rounded-2xl bg-[#0f172a] hover:bg-[#162035] border border-slate-700/80 hover:border-slate-500 text-white shadow-lg flex items-center gap-4 transition-all active:scale-98 group text-left min-h-[84px]"
        >
          <div className="w-14 h-14 rounded-xl bg-purple-600/10 border border-purple-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform text-purple-400">
            <Award className="w-7 h-7" />
          </div>
          <div className="flex-1">
            <div className="text-base sm:text-lg font-bold uppercase tracking-wide flex items-center gap-2">
              <span>Пульт преподавателя</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                ПРОКТОР
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-0.5 font-mono">
              Управление сессией, мониторинг аудитории и экспорт ведомости
            </div>
          </div>
        </button>

        {/* KIM Registry & Import */}
        <button
          type="button"
          onClick={() => onSelectRole('import')}
          className="w-full p-4 rounded-xl bg-slate-900/60 hover:bg-slate-900 text-slate-300 border border-slate-800 flex items-center justify-between text-xs font-mono transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-4 h-4 text-slate-400" />
            <span>Реестр контрольно-измерительных материалов (50 бланков)</span>
          </div>
          <FileSpreadsheet className="w-4 h-4 text-slate-500" />
        </button>
      </main>

      {/* Official Footprint & Specifications */}
      <footer className="max-w-4xl w-full mx-auto border-t border-slate-800/80 pt-4 text-center space-y-2 text-[11px] font-mono text-slate-500">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="p-2 bg-slate-900/40 rounded border border-slate-800/50">
            <strong className="block text-slate-300 text-xs">50 Уникальных КИМ</strong>
            индивидуальные варианты на класс
          </div>
          <div className="p-2 bg-slate-900/40 rounded border border-slate-800/50">
            <strong className="block text-slate-300 text-xs">Античит & Прокторинг</strong>
            блокировка скриншотов и вкладок
          </div>
          <div className="p-2 bg-slate-900/40 rounded border border-slate-800/50">
            <strong className="block text-slate-300 text-xs">Ведомость Excel (.xlsx)</strong>
            официальный протокол с датой и баллами
          </div>
        </div>
        <div className="text-[10px] text-slate-600 pt-1">
          СПК «КОНТРОЛЬ-ЭКЗАМЕН» • ПРОТОКОЛ БЕЗОПАСНОСТИ WSS / TLS 1.3 • ВСЕ ПРАВА ЗАЩИЩЕНЫ
        </div>
      </footer>
    </div>
  );
};
