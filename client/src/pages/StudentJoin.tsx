import React, { useState, useEffect } from 'react';
import { ArrowLeft, LogIn, AlertCircle } from 'lucide-react';
import { api, JoinGameResponse } from '../services/api.js';

interface StudentJoinProps {
  onJoined: (data: JoinGameResponse) => void;
  onBack: () => void;
  prefillCode?: string;
}

export const StudentJoin: React.FC<StudentJoinProps> = ({ onJoined, onBack, prefillCode = '' }) => {
  const [gameCode, setGameCode] = useState(prefillCode.toUpperCase());
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if student already has active session in localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem('student_session_token');
    const savedCode = localStorage.getItem('student_game_code');
    const savedFirst = localStorage.getItem('student_first_name');
    const savedLast = localStorage.getItem('student_last_name');

    if (savedCode && !gameCode) {
      setGameCode(savedCode);
    }
    if (savedFirst) setFirstName(savedFirst);
    if (savedLast) setLastName(savedLast);

    // Auto-reconnect if token exists and matching code
    if (savedToken && savedCode && savedFirst && savedLast) {
      handleJoin(savedCode, savedFirst, savedLast, savedToken);
    }
  }, []);

  const handleJoin = async (
    codeToUse = gameCode,
    firstToUse = firstName,
    lastToUse = lastName,
    existingToken?: string
  ) => {
    const cleanCode = codeToUse.trim().toUpperCase();
    const cleanFirst = firstToUse.trim();
    const cleanLast = lastToUse.trim();

    if (!cleanCode) {
      setError('Введите код игры');
      return;
    }
    if (!cleanFirst || !cleanLast) {
      setError('Введите имя и фамилию');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.joinGame({
        gameCode: cleanCode,
        firstName: cleanFirst,
        lastName: cleanLast,
        sessionToken: existingToken || localStorage.getItem('student_session_token') || undefined,
      });

      // Save credentials for seamless reconnection on reload
      localStorage.setItem('student_session_token', response.sessionToken);
      localStorage.setItem('student_game_code', cleanCode);
      localStorage.setItem('student_game_id', response.gameId);
      localStorage.setItem('student_id', String(response.studentId));
      localStorage.setItem('student_form_id', String(response.formId));
      localStorage.setItem('student_first_name', cleanFirst);
      localStorage.setItem('student_last_name', cleanLast);

      onJoined(response);
    } catch (err: any) {
      setError(err.message || 'Ошибка подключения к игре');
      // If error is invalid session token, clear stored token
      if (err.message?.includes('сессия') || err.message?.includes('не найдена')) {
        localStorage.removeItem('student_session_token');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 select-none">
      <div className="w-full max-w-sm space-y-6 animate-in fade-in duration-300">
        {/* Back navigation */}
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors py-2 active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>На главную</span>
        </button>

        {/* Header */}
        <div className="space-y-1.5 text-left">
          <h1 className="text-2xl font-extrabold text-white">Вход в тестирование</h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Введите код игры, выданный учителем, и свои данные
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs sm:text-sm animate-in slide-in-from-top-2">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{error}</div>
          </div>
        )}

        {/* Form Inputs */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleJoin();
          }}
          className="space-y-4"
        >
          {/* Game Code Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              Код игры
            </label>
            <input
              type="text"
              required
              maxLength={6}
              value={gameCode}
              onChange={(e) => setGameCode(e.target.value.toUpperCase())}
              placeholder="K7P42"
              className="w-full px-4 py-3.5 rounded-2xl bg-slate-900 border border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-center text-2xl font-mono font-bold tracking-widest text-white placeholder:text-slate-600 transition-all uppercase min-h-[56px]"
              autoComplete="off"
              autoFocus
            />
          </div>

          {/* First Name Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              Имя
            </label>
            <input
              type="text"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Иван"
              className="w-full px-4 py-3.5 rounded-2xl bg-slate-900 border border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-base font-semibold text-white placeholder:text-slate-600 transition-all min-h-[52px]"
            />
          </div>

          {/* Last Name Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              Фамилия
            </label>
            <input
              type="text"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Иванов"
              className="w-full px-4 py-3.5 rounded-2xl bg-slate-900 border border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-base font-semibold text-white placeholder:text-slate-600 transition-all min-h-[52px]"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 active:scale-98 text-white font-bold text-base shadow-lg shadow-indigo-950/60 flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:pointer-events-none min-h-[56px]"
            >
              <LogIn className="w-5 h-5" />
              <span>{loading ? 'Подключение...' : 'Присоединиться'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
