import React, { useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { Clock, ShieldCheck, CheckCircle2 } from 'lucide-react';
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

    // Join room if not already
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
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 select-none text-center">
      <div className="w-full max-w-sm space-y-6 animate-in zoom-in-95 duration-300">
        {/* Animated radar pulse */}
        <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping" />
          <div className="relative w-20 h-20 rounded-full bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-xl shadow-indigo-950">
            <Clock className="w-10 h-10 animate-pulse" />
          </div>
        </div>

        {/* Status Text */}
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold tracking-wide">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Вы успешно подключены
          </span>
          <h2 className="text-2xl font-extrabold text-white">Ожидаем учителя...</h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Тест начнётся одновременно для всех учеников, как только учитель нажмёт «Начать».
          </p>
        </div>

        {/* Assigned ID & Blank Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
          <div className="text-sm font-bold text-white border-b border-slate-800 pb-3">
            {studentData.firstName} {studentData.lastName}
          </div>

          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/50">
              <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Ваш ID
              </span>
              <span className="text-2xl font-black text-indigo-400 font-mono">
                #{String(studentData.studentId).padStart(2, '0')}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/50">
              <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Ваш Бланк
              </span>
              <span className="text-2xl font-black text-purple-400 font-mono">
                №{String(studentData.formId).padStart(2, '0')}
              </span>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>30 вопросов • 20 минут</span>
          </div>
        </div>
      </div>
    </div>
  );
};
