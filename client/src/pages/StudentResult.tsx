import React from 'react';
import { Home, ShieldCheck, FileCheck } from 'lucide-react';
import { StudentStateResponse } from '../services/api.js';

interface StudentResultProps {
  state: StudentStateResponse;
  onHome: () => void;
}

export const StudentResult: React.FC<StudentResultProps> = ({ state, onHome }) => {
  const report = state.scoreReport;
  const student = state.student;

  const grade = report?.grade ?? 2;
  const percentage = report?.percentage ?? 0;
  const correct = report?.correctAnswers ?? 0;
  const total = report?.totalQuestions ?? 30;

  const gradeTitle =
    grade === 5
      ? 'ОТЛИЧНО (5)'
      : grade === 4
      ? 'ХОРОШО (4)'
      : grade === 3
      ? 'УДОВЛЕТВОРИТЕЛЬНО (3)'
      : 'НЕУДОВЛЕТВОРИТЕЛЬНО (2)';

  const gradeColor =
    grade === 5
      ? 'text-emerald-400 border-emerald-500/50 bg-emerald-950/40'
      : grade === 4
      ? 'text-blue-400 border-blue-500/50 bg-blue-950/40'
      : grade === 3
      ? 'text-amber-400 border-amber-500/50 bg-amber-950/40'
      : 'text-rose-400 border-rose-500/50 bg-rose-950/40';

  return (
    <div className="min-h-screen bg-[#0a0f1d] text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 select-none font-sans">
      <div className="w-full max-w-md space-y-6 animate-in zoom-in-95 duration-300">
        {/* Protocol Header */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-950/60 border border-blue-500/40 text-blue-300 text-xs font-mono font-bold tracking-wider">
            <FileCheck className="w-4 h-4 text-blue-400" />
            <span>ОФИЦИАЛЬНЫЙ ПРОТОКОЛ СДАЧИ</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
            Экзамен завершён
          </h1>
          <div className="text-sm font-bold text-slate-300 font-mono">
            {student.lastName} {student.firstName}
          </div>
          <div className="text-xs text-slate-400 font-mono">
            ID #{String(student.studentId).padStart(2, '0')} • КИМ Вариант №{String(student.formId).padStart(2, '0')}
          </div>
        </div>

        {/* Official Score Card */}
        <div className="bg-[#0f172a] border border-slate-700/80 rounded-2xl p-6 space-y-5 shadow-2xl">
          {/* Grade Display */}
          <div className={`p-5 rounded-xl border text-center space-y-1 ${gradeColor}`}>
            <span className="block text-[11px] font-mono font-bold uppercase tracking-widest text-slate-300">
              ИТОГОВАЯ ЭКЗАМЕНАЦИОННАЯ ОТМЕТКА
            </span>
            <div className="text-5xl font-black font-mono tracking-tight text-white flex items-baseline justify-center gap-1">
              <span>{grade}</span>
              <span className="text-xl text-slate-400 font-semibold">/ 5</span>
            </div>
            <div className="text-xs font-bold font-mono tracking-wider uppercase">
              {gradeTitle}
            </div>
          </div>

          {/* Points Breakdown */}
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider block">
                Первичные баллы
              </span>
              <div className="text-xl font-black text-white font-mono">
                {correct} <span className="text-xs text-slate-500 font-normal">из {total}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider block">
                Процент выполнения
              </span>
              <div className="text-xl font-black text-white font-mono">
                {percentage}%
              </div>
            </div>
          </div>

          {/* Verification Statement */}
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl text-xs font-mono text-slate-300 space-y-1 text-left">
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <ShieldCheck className="w-4 h-4" />
              <span>ЭЛЕКТРОННЫЙ ПРОТОКОЛ ЗАВЕРЕН:</span>
            </div>
            <div>• Результаты внесены в единую ведомость преподавателя.</div>
            <div>• Ответы сохранены в защищённой базе данных.</div>
          </div>

          <button
            onClick={onHome}
            className="w-full py-3.5 px-6 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all min-h-[48px]"
          >
            <Home className="w-4 h-4" />
            <span>Вернуться на портал</span>
          </button>
        </div>
      </div>
    </div>
  );
};
