import React from 'react';
import { Award, CheckCircle, Percent, Home, AlertCircle } from 'lucide-react';
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

  // Grade color theme
  const gradeColor =
    grade === 5
      ? 'from-emerald-500 to-teal-500 border-emerald-400/40 text-emerald-400'
      : grade === 4
      ? 'from-indigo-500 to-blue-500 border-indigo-400/40 text-indigo-400'
      : grade === 3
      ? 'from-amber-500 to-yellow-500 border-amber-400/40 text-amber-400'
      : 'from-rose-500 to-red-500 border-rose-400/40 text-rose-400';

  const gradeBg =
    grade === 5
      ? 'bg-emerald-500/10'
      : grade === 4
      ? 'bg-indigo-500/10'
      : grade === 3
      ? 'bg-amber-500/10'
      : 'bg-rose-500/10';

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 select-none text-center">
      <div className="w-full max-w-sm space-y-6 animate-in zoom-in-95 duration-300">
        {/* Top Celebration Badge */}
        <div className={`w-20 h-20 mx-auto rounded-3xl ${gradeBg} border border-slate-700/60 flex items-center justify-center shadow-2xl`}>
          <Award className={`w-10 h-10 ${gradeColor}`} />
        </div>

        {/* Title and Student Name */}
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Тест завершён
          </h1>
          <div className="text-base font-bold text-slate-300">
            {student.firstName} {student.lastName}
          </div>
          <div className="text-xs text-slate-500 font-mono">
            ID #{String(student.studentId).padStart(2, '0')} • Бланк #{String(student.formId).padStart(2, '0')}
          </div>
        </div>

        {/* Result Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-2xl">
          {/* Main Grade Display */}
          <div className={`py-4 px-6 rounded-2xl ${gradeBg} border border-slate-700/50 space-y-1`}>
            <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Ваша оценка
            </span>
            <div className="text-5xl font-black font-mono tracking-tight text-white flex items-baseline justify-center gap-1">
              <span className={`text-transparent bg-clip-text bg-gradient-to-r ${gradeColor}`}>
                {grade}
              </span>
              <span className="text-2xl text-slate-500 font-semibold">/ 5</span>
            </div>
          </div>

          {/* Stats Breakdown */}
          <div className="grid grid-cols-2 gap-3 text-center">
            {/* Correct count */}
            <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/50 space-y-1">
              <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-slate-400">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>Правильных</span>
              </div>
              <div className="text-xl font-black text-white font-mono">
                {correct} <span className="text-xs text-slate-500 font-normal">из {total}</span>
              </div>
            </div>

            {/* Percentage */}
            <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/50 space-y-1">
              <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-slate-400">
                <Percent className="w-3.5 h-3.5 text-indigo-400" />
                <span>Результат</span>
              </div>
              <div className="text-xl font-black text-white font-mono">
                {percentage}%
              </div>
            </div>
          </div>

          {/* Locked Notice */}
          <div className="flex items-center gap-2 p-3 bg-slate-800/40 rounded-xl text-xs text-slate-400 text-left border border-slate-800">
            <AlertCircle className="w-4 h-4 text-slate-500 shrink-0" />
            <span>Тест зафиксирован на сервере. Повторное прохождение заблокировано.</span>
          </div>
        </div>

        {/* Back to Home Action */}
        <button
          onClick={onHome}
          className="w-full py-4 px-6 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold text-sm shadow-lg transition-all active:scale-98 flex items-center justify-center gap-2 min-h-[52px]"
        >
          <Home className="w-4 h-4 text-slate-400" />
          <span>Вернуться на главный экран</span>
        </button>
      </div>
    </div>
  );
};
