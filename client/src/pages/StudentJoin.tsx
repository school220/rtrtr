import React, { useState, useEffect } from 'react';
import { ArrowLeft, KeyRound, User, AlertCircle, ShieldCheck, GraduationCap, Building2 } from 'lucide-react';
import { api, JoinGameResponse } from '../services/api.js';
import { useLanguage } from '../context/LanguageContext.js';
import { LanguageSelector } from '../components/LanguageSelector.js';

interface StudentJoinProps {
  onJoined: (data: JoinGameResponse) => void;
  onBack: () => void;
  prefillCode?: string;
}

export const StudentJoin: React.FC<StudentJoinProps> = ({ onJoined, onBack, prefillCode = '' }) => {
  const { t } = useLanguage();
  const [gameCode, setGameCode] = useState(prefillCode.toUpperCase());
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedFirst = localStorage.getItem('student_first_name');
    const savedLast = localStorage.getItem('student_last_name');
    if (savedFirst && !firstName) setFirstName(savedFirst);
    if (savedLast && !lastName) setLastName(savedLast);
  }, []);

  const handleClearForm = () => {
    localStorage.removeItem('student_session_token');
    localStorage.removeItem('student_game_code');
    localStorage.removeItem('student_game_id');
    localStorage.removeItem('student_id');
    localStorage.removeItem('student_form_id');
    localStorage.removeItem('student_first_name');
    localStorage.removeItem('student_last_name');
    setGameCode('');
    setFirstName('');
    setLastName('');
    setError(null);
  };

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
      setError(t.joinErrorPin);
      return;
    }
    if (!cleanFirst || !cleanLast) {
      setError(t.joinErrorName);
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
      setError(err.message || 'Xatolik yuz berdi');
      if (err.message?.includes('сессия') || err.message?.includes('topilmadi')) {
        localStorage.removeItem('student_session_token');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f6f9] text-[#222d32] flex flex-col font-sans select-none">
      {/* HEMIS Top Header */}
      <header className="bg-[#25718f] text-white h-14 flex items-center justify-between px-4 sm:px-6 shadow-sm sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded hover:bg-[#1f5f79] text-white transition-colors flex items-center gap-1.5 text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">{t.breadcrumbsHome}</span>
          </button>
          <div className="h-5 w-px bg-white/30 hidden sm:block"></div>
          <div className="flex items-center gap-2 font-bold text-base">
            <GraduationCap className="w-5 h-5 text-cyan-200" />
            <span>{t.joinHeader}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono text-cyan-100">
          <div className="hidden md:flex items-center gap-1.5">
            <Building2 className="w-4 h-4" />
            <span>{t.joinSubheader}</span>
          </div>
          <LanguageSelector />
        </div>
      </header>

      {/* Main Registration Area */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md space-y-4 animate-in fade-in duration-300">
          {/* Card Form */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 p-4 text-center">
              <span className="text-[11px] font-mono uppercase tracking-widest text-[#25718f] font-bold block">
                {t.joinBadge}
              </span>
              <h2 className="text-lg sm:text-xl font-black text-gray-800 uppercase tracking-tight mt-1">
                {t.joinHeading}
              </h2>
              <p className="text-xs text-gray-500 font-mono mt-0.5">
                {t.joinSubheading}
              </p>
            </div>

            <div className="p-5 sm:p-6 space-y-5">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
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
                <div className="space-y-1">
                  <label className="block text-xs font-mono uppercase font-bold text-gray-700 tracking-wider">
                    {t.joinPinLabel}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      maxLength={10}
                      value={gameCode}
                      onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                      placeholder={t.joinPinPlaceholder}
                      className="w-full px-3 py-2.5 rounded border border-gray-300 focus:border-[#25718f] focus:ring-1 focus:ring-[#25718f] text-base font-mono font-bold tracking-widest text-gray-900 uppercase placeholder:text-gray-400 transition-all pl-10"
                      autoComplete="off"
                    />
                    <KeyRound className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {/* Last Name */}
                <div className="space-y-1">
                  <label className="block text-xs font-mono uppercase font-bold text-gray-700 tracking-wider">
                    {t.joinLastNameLabel}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder={t.joinLastNamePlaceholder}
                      className="w-full px-3 py-2.5 rounded border border-gray-300 focus:border-[#25718f] focus:ring-1 focus:ring-[#25718f] text-sm font-semibold text-gray-900 placeholder:text-gray-400 transition-all pl-10"
                      autoComplete="off"
                    />
                    <User className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {/* First Name */}
                <div className="space-y-1">
                  <label className="block text-xs font-mono uppercase font-bold text-gray-700 tracking-wider">
                    {t.joinFirstNameLabel}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder={t.joinFirstNamePlaceholder}
                      className="w-full px-3 py-2.5 rounded border border-gray-300 focus:border-[#25718f] focus:ring-1 focus:ring-[#25718f] text-sm font-semibold text-gray-900 placeholder:text-gray-400 transition-all pl-10"
                      autoComplete="off"
                    />
                    <User className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div className="p-3 bg-gray-50 border border-gray-200 rounded text-xs font-mono text-gray-600 space-y-1">
                  <div className="flex items-center gap-1.5 text-[#25718f] font-bold">
                    <ShieldCheck className="w-4 h-4 text-[#25718f]" />
                    <span>{t.joinRegTitle}</span>
                  </div>
                  <div>{t.joinReg1}</div>
                  <div>{t.joinReg2}</div>
                  <div>{t.joinReg3}</div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-3 px-6 rounded bg-[#25718f] hover:bg-[#1f5f79] active:scale-98 text-white font-bold text-xs uppercase tracking-wider shadow transition-all disabled:opacity-50"
                  >
                    {loading ? t.joinChecking : t.joinSubmitBtn}
                  </button>
                  {(Boolean(firstName) || Boolean(lastName) || Boolean(gameCode)) && (
                    <button
                      type="button"
                      onClick={handleClearForm}
                      className="py-3 px-4 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold text-xs uppercase tracking-wider transition-colors"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
