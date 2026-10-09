import React, { useState, useEffect } from 'react';
import { ArrowLeft, KeyRound, User, AlertCircle, ShieldCheck } from 'lucide-react';
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

  useEffect(() => {
    const savedToken = localStorage.getItem('student_session_token');
    const savedCode = localStorage.getItem('student_game_code');
    const savedFirst = localStorage.getItem('student_first_name');
    const savedLast = localStorage.getItem('student_last_name');

    if (savedCode && !gameCode) setGameCode(savedCode);
    if (savedFirst) setFirstName(savedFirst);
    if (savedLast) setLastName(savedLast);

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
      setError('Укажите код экзаменационной сессии');
      return;
    }
    if (!cleanFirst || !cleanLast) {
      setError('Укажите фамилию и имя экзаменуемого');
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

      localStorage.setItem('student_session_token', response.sessionToken);
      localStorage.setItem('student_game_code', cleanCode);
      localStorage.setItem('student_game_id', response.gameId);
      localStorage.setItem('student_id', String(response.studentId));
      localStorage.setItem('student_form_id', String(response.formId));
      localStorage.setItem('student_first_name', cleanFirst);
      localStorage.setItem('student_last_name', cleanLast);

      onJoined(response);
    } catch (err: any) {
      setError(err.message || 'Ошибка подключения к экзаменационной сессии');
      if (err.message?.includes('сессия') || err.message?.includes('не найдена')) {
        localStorage.removeItem('student_session_token');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f1d] text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 select-none font-sans">
      <div className="w-full max-w-md space-y-6 animate-in fade-in duration-300">
        {/* Back navigation */}
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-slate-200 transition-colors py-2 active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Вернуться на главную страницу</span>
        </button>

        {/* Official Card Form */}
        <div className="bg-[#0f172a] border border-slate-700/80 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="space-y-1.5 text-center border-b border-slate-800 pb-4">
            <span className="text-[11px] font-mono uppercase tracking-widest text-blue-400 font-bold">
              РЕГИСТРАЦИОННЫЙ БЛАНК
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
              Допуск к тестированию
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              Внесите данные участника для автоматического назначения индивидуального варианта КИМ
            </p>
          </div>

          {error && (
            <div className="p-3.5 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-xs font-mono flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleJoin();
            }}
            className="space-y-4"
          >
            {/* Session Code */}
            <div className="space-y-1.5">
              <label className="block text-xs font-mono uppercase font-bold text-slate-300 tracking-wider">
                Код экзаменационной сессии
              </label>
              <div className="relative">
                <input
                  type="text"
                  maxLength={10}
                  value={gameCode}
                  onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                  placeholder="НАПРИМЕР: K7P42"
                  className="w-full px-4 py-3.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-base font-mono font-bold tracking-widest text-white uppercase placeholder:text-slate-600 transition-all pl-11"
                  autoComplete="off"
                />
                <KeyRound className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* Last Name */}
            <div className="space-y-1.5">
              <label className="block text-xs font-mono uppercase font-bold text-slate-300 tracking-wider">
                Фамилия экзаменуемого
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Иванов"
                  className="w-full px-4 py-3.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-base font-medium text-white placeholder:text-slate-600 transition-all pl-11"
                  autoComplete="off"
                />
                <User className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* First Name */}
            <div className="space-y-1.5">
              <label className="block text-xs font-mono uppercase font-bold text-slate-300 tracking-wider">
                Имя экзаменуемого
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Иван"
                  className="w-full px-4 py-3.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-base font-medium text-white placeholder:text-slate-600 transition-all pl-11"
                  autoComplete="off"
                />
                <User className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl text-[11px] font-mono text-slate-400 space-y-1">
              <div className="flex items-center gap-1.5 text-blue-300 font-bold">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                <span>ПРАВИЛА ИДЕНТИФИКАЦИИ:</span>
              </div>
              <div>• Сервер выделит персональный ID (1..50) и уникальный бланк.</div>
              <div>• Повторное подключение восстанавливает прогресс без потери данных.</div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-98 text-white font-black text-sm uppercase tracking-wider shadow-xl shadow-blue-950/60 transition-all disabled:opacity-50 min-h-[52px]"
            >
              {loading ? 'Проверка допуска...' : 'Авторизоваться и получить КИМ'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
