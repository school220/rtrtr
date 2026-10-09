import React, { useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { ShieldCheck, CheckCircle2, Clock } from 'lucide-react';
import { JoinGameResponse } from '../services/api.js';

interface StudentWaitingProps {
  studentData: JoinGameResponse;
  socket: Socket | null;
  onGameStarted: (data: { startedAt: string; endsAt: string }) => void;
}

export const StudentWaiting: React.FC<StudentWaitingProps> = ({
  studentData,
  socket,
  onGameStarted,
}) => {
  useEffect(() => {
    if (!socket) return;

    socket.emit('student:join', {
      gameId: studentData.gameId,
      studentId: studentData.studentId,
      sessionToken: studentData.sessionToken,
    });

    const handleStart = (data: { startedAt: string; endsAt: string }) => {
      onGameStarted(data);
    };

    socket.on('game:started', handleStart);

    return () => {
      socket.off('game:started', handleStart);
    };
  }, [socket, studentData, onGameStarted]);

  return (
    <div className="min-h-screen bg-[#0a0f1d] text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 select-none font-sans">
      <div className="w-full max-w-md space-y-6 animate-in zoom-in-95 duration-300">
        {/* Radar Pulse Symbol */}
        <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping" />
          <div className="relative w-16 h-16 rounded-2xl bg-blue-900/30 border border-blue-500/50 flex items-center justify-center text-blue-400 shadow-xl shadow-blue-950">
            <Clock className="w-8 h-8 animate-pulse" />
          </div>
        </div>

        {/* Status Header */}
        <div className="space-y-1.5 text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-bold tracking-wider">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>ДОПУСК ПОДТВЕРЖДЁН СЕРВЕРОМ</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase">
            Ожидание запуска экзамена
          </h2>
          <p className="text-xs text-slate-400 font-mono">
            Тестирование начнется централизованно по команде преподавателя.
          </p>
        </div>

        {/* Official Candidate Voucher */}
        <div className="bg-[#0f172a] border border-slate-700/80 rounded-2xl p-6 space-y-4 shadow-2xl">
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400 uppercase">Экзаменуемый:</span>
            <span className="text-sm font-bold text-white font-mono">
              {studentData.lastName} {studentData.firstName}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-center">
            {/* Student ID */}
            <div className="p-3.5 rounded-xl bg-slate-900 border border-blue-500/30">
              <span className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                Персональный ID
              </span>
              <span className="text-2xl font-black text-blue-400 font-mono">
                #{String(studentData.studentId).padStart(2, '0')}
              </span>
            </div>

            {/* Form Variant */}
            <div className="p-3.5 rounded-xl bg-slate-900 border border-purple-500/30">
              <span className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                Вариант КИМ
              </span>
              <span className="text-2xl font-black text-purple-400 font-mono">
                Бланк №{String(studentData.formId).padStart(2, '0')}
              </span>
            </div>
          </div>

          {/* Exam Specifications */}
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl text-xs font-mono text-slate-300 space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span>Сессия:</span>
              <strong className="text-blue-300">#{studentData.gameCode}</strong>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>Количество заданий:</span>
              <strong className="text-white">30 вопросов (1–20 выбор, 21–30 ввод)</strong>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>Экзаменационное время:</span>
              <strong className="text-white">20 минут</strong>
            </div>
          </div>

          <div className="text-[11px] font-mono text-slate-400 flex items-center justify-center gap-1.5 pt-1">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Защита от списывания и прокторинг активированы</span>
          </div>
        </div>
      </div>
    </div>
  );
};
