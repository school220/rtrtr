import React, { useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { ShieldCheck, CheckCircle2, Clock, GraduationCap, Building2 } from 'lucide-react';
import { JoinGameResponse } from '../services/api.js';
import { useLanguage } from '../context/LanguageContext.js';
import { LanguageSelector } from '../components/LanguageSelector.js';

interface StudentWaitingProps {
  studentData: JoinGameResponse;
  socket: Socket | null;
  onGameStarted: (data: { startedAt: string; endsAt: string; totalTimeSeconds?: number; remainingSeconds?: number; serverTime?: number }) => void;
}

export const StudentWaiting: React.FC<StudentWaitingProps> = ({
  studentData,
  socket,
  onGameStarted,
}) => {
  const { t } = useLanguage();

  useEffect(() => {
    if (!socket) return;

    socket.emit('student:join', {
      gameId: studentData.gameId,
      studentId: studentData.studentId,
      sessionToken: studentData.sessionToken,
    });

    const handleStart = (data: { startedAt: string; endsAt: string; totalTimeSeconds?: number; remainingSeconds?: number; serverTime?: number }) => {
      onGameStarted(data);
    };

    socket.on('game:started', handleStart);

    return () => {
      socket.off('game:started', handleStart);
    };
  }, [socket, studentData, onGameStarted]);

  return (
    <div className="min-h-screen bg-[#f4f6f9] text-[#222d32] flex flex-col font-sans select-none">
      {/* Top Header */}
      <header className="bg-[#25718f] text-white h-14 flex items-center justify-between px-4 sm:px-6 shadow-sm sticky top-0 z-40">
        <div className="flex items-center gap-2 font-bold text-base">
          <GraduationCap className="w-5 h-5 text-cyan-200" />
          <span>{t.waitingHeader}</span>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono text-cyan-100">
          <div className="hidden sm:flex items-center gap-1.5">
            <Building2 className="w-4 h-4" />
            <span>{t.waitingRoomBadge} #{studentData.gameCode}</span>
          </div>
          <LanguageSelector />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md space-y-4 animate-in zoom-in-95 duration-300">
          {/* Radar Pulse Symbol */}
          <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-[#25718f]/20 animate-ping" />
            <div className="relative w-14 h-14 rounded-full bg-[#25718f] text-white flex items-center justify-center shadow-md">
              <Clock className="w-7 h-7 animate-pulse" />
            </div>
          </div>

          {/* Status Header */}
          <div className="space-y-1 text-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-100 text-emerald-800 text-xs font-mono font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{t.waitingConfirmedBadge}</span>
            </div>
            <h2 className="text-xl font-black text-gray-800 uppercase tracking-tight">
              {t.waitingHeading}
            </h2>
            <p className="text-xs text-gray-500 font-mono">
              {t.waitingSubheading}
            </p>
          </div>

          {/* Official Candidate Voucher Card */}
          <div className="bg-white border border-gray-200 rounded-lg p-5 sm:p-6 space-y-4 shadow-sm">
            <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
              <span className="text-xs font-mono text-gray-500 uppercase">{t.waitingCandidate}</span>
              <span className="text-sm font-bold text-gray-900 font-mono">
                {studentData.lastName} {studentData.firstName}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-center">
              {/* Student ID */}
              <div className="p-3 rounded bg-cyan-50/50 border border-cyan-200">
                <span className="block text-[10px] font-mono font-bold text-cyan-800 uppercase tracking-wider">
                  {t.waitingStudentId}
                </span>
                <span className="text-2xl font-black text-[#25718f] font-mono">
                  #{String(studentData.studentId).padStart(2, '0')}
                </span>
              </div>

              {/* Form Variant */}
              <div className="p-3 rounded bg-purple-50/50 border border-purple-200">
                <span className="block text-[10px] font-mono font-bold text-purple-800 uppercase tracking-wider">
                  {t.waitingVariant}
                </span>
                <span className="text-2xl font-black text-purple-700 font-mono">
                  №{String(studentData.formId).padStart(2, '0')}
                </span>
              </div>
            </div>

            {/* Exam Specifications */}
            <div className="p-3 bg-gray-50 border border-gray-200 rounded text-xs font-mono text-gray-600 space-y-1">
              <div className="flex items-center justify-between">
                <span>{t.waitingSpecRoom}</span>
                <strong className="text-gray-900 font-bold">#{studentData.gameCode}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>{t.waitingSpecQuestions}</span>
                <strong className="text-gray-900">{t.waitingSpecQuestionsVal}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>{t.waitingSpecDuration}</span>
                <strong className="text-gray-900">{t.waitingSpecDurationVal}</strong>
              </div>
            </div>

            <div className="text-[11px] font-mono text-gray-500 flex items-center justify-center gap-1.5 pt-1">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{t.waitingProctorActive}</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
