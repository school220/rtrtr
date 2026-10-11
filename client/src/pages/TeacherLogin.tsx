import React, { useState } from 'react';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  AlertTriangle,
  GraduationCap,
  ShieldCheck,
  Building2,
  CheckCircle2,
  UserPlus,
  LogIn,
} from 'lucide-react';
import { api } from '../services/api.js';
import { useLanguage } from '../context/LanguageContext.js';
import { LanguageSelector } from '../components/LanguageSelector.js';

interface TeacherLoginProps {
  onSuccess: () => void;
}

export const TeacherLogin: React.FC<TeacherLoginProps> = ({ onSuccess }) => {
  const { t } = useLanguage();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  
  // Login fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // Registration fields
  const [fullName, setFullName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const u = username.trim();
    const p = password.trim();

    if (!u || !p) {
      setError(t.authErrorRequired);
      return;
    }

    setLoading(true);
    try {
      await api.teacherLogin({ username: u, password: p });
      setUsername('');
      setPassword('');
      onSuccess();
    } catch (err: any) {
      setError(err.message || t.authErrorInvalid);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const fn = fullName.trim();
    const u = username.trim();
    const p = password.trim();
    const cp = confirmPassword.trim();

    if (!fn) {
      setError(t.authErrorFullNameRequired);
      return;
    }

    if (!u || !p) {
      setError(t.authErrorRequired);
      return;
    }

    if (p.length < 6) {
      setError(t.authErrorPasswordLength);
      return;
    }

    if (p !== cp) {
      setError(t.authErrorPasswordMismatch);
      return;
    }

    setLoading(true);
    try {
      await api.teacherRegister({ fullName: fn, username: u, password: p });
      setFullName('');
      setUsername('');
      setPassword('');
      setConfirmPassword('');
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Ошибка регистрации проверяющего');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="liquid-glass-bg min-h-screen text-slate-800 flex flex-col font-sans select-none pb-safe">
      {/* Official Top Bar */}
      <header className="liquid-glass sticky top-0 z-40 h-14 pt-safe flex items-center justify-between px-4 sm:px-8 shadow-xs border-b border-white/80">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#25718f] to-cyan-500 text-white flex items-center justify-center shadow-md shadow-cyan-500/20">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-slate-900 font-extrabold text-sm tracking-wide flex items-center gap-2">
              <span>HEMIS PROCTOR</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200 uppercase font-mono font-bold">
                Служебный раздел
              </span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono hidden sm:block">
              Davlat attestatsiya komissiyasi • Nazorat va boshqaruv markazi
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="hidden md:flex items-center gap-1.5 text-slate-500">
            <Building2 className="w-4 h-4 text-cyan-600" />
            <span>Toshkent Davlat Universiteti</span>
          </div>
          <LanguageSelector />
        </div>
      </header>

      {/* Main Login / Register Area */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 pb-8">
        <div className="w-full max-w-md space-y-4 animate-pop">
          {/* Card */}
          <div className="liquid-glass-card rounded-3xl shadow-xl overflow-hidden border border-white/80 p-0">
            {/* Header banner */}
            <div className="bg-gradient-to-br from-[#25718f] via-[#1f5f79] to-cyan-600 text-white p-6 text-center relative border-b border-white/30 shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-white/15 border border-white/30 flex items-center justify-center mx-auto text-white shadow-inner mb-3 backdrop-blur-sm">
                <ShieldCheck className="w-8 h-8 text-white" />
              </div>
              <div className="text-[11px] font-mono tracking-widest uppercase text-cyan-200 font-bold">
                {t.authBadge}
              </div>
              <h1 className="text-xl font-black tracking-tight text-white mt-1">
                {t.authHeading}
              </h1>
              <p className="text-xs text-cyan-100/90 mt-1.5 font-mono max-w-xs mx-auto">
                {t.authSubheading}
              </p>
            </div>

            {/* Tab switch between Login and Register */}
            <div className="grid grid-cols-2 border-b border-slate-200/80 bg-white/40">
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  setError(null);
                }}
                className={`py-3.5 px-4 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                  tab === 'login'
                    ? 'bg-white/80 text-cyan-900 border-b-2 border-cyan-600 font-black shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
                }`}
              >
                <LogIn className="w-4 h-4" />
                <span>{t.authTabLogin}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('register');
                  setError(null);
                }}
                className={`py-3.5 px-4 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                  tab === 'register'
                    ? 'bg-white/80 text-cyan-900 border-b-2 border-cyan-600 font-black shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                <span>{t.authTabRegister}</span>
              </button>
            </div>

            <div className="p-6 sm:p-8 space-y-5 bg-white/50 backdrop-blur-md">
              {/* Error Alert */}
              {error && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5 animate-in slide-in-from-top-2 duration-200 shadow-2xs">
                  <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
                  <span className="font-semibold leading-tight">{error}</span>
                </div>
              )}

              {/* Login Form */}
              {tab === 'login' && (
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
                      {t.authUsernameLabel}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder={t.authUsernamePlaceholder}
                        autoComplete="username"
                        disabled={loading}
                        className="w-full pl-10 pr-3 py-3 rounded-2xl liquid-glass-input font-mono text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all shadow-inner"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
                      {t.authPasswordLabel}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={t.authPasswordPlaceholder}
                        autoComplete="current-password"
                        disabled={loading}
                        className="w-full pl-10 pr-10 py-3 rounded-2xl liquid-glass-input font-mono text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all shadow-inner"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex={-1}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full min-h-[48px] py-3 px-4 rounded-2xl liquid-glass-btn-primary font-bold text-xs uppercase tracking-wider shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>{t.authChecking}</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4 text-white" />
                          <span>{t.authSubmitBtn}</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* Registration Form */}
              {tab === 'register' && (
                <form onSubmit={handleRegisterSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
                      {t.authFullNameLabel}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder={t.authFullNamePlaceholder}
                        autoComplete="name"
                        disabled={loading}
                        className="w-full pl-10 pr-3 py-3 rounded-2xl liquid-glass-input font-mono text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all shadow-inner"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
                      {t.authUsernameLabel}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder={t.authUsernamePlaceholder}
                        autoComplete="username"
                        disabled={loading}
                        className="w-full pl-10 pr-3 py-3 rounded-2xl liquid-glass-input font-mono text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all shadow-inner"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
                      {t.authPasswordLabel}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={t.authPasswordPlaceholder}
                        autoComplete="new-password"
                        disabled={loading}
                        className="w-full pl-10 pr-10 py-3 rounded-2xl liquid-glass-input font-mono text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all shadow-inner"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex={-1}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
                      {t.authConfirmPasswordLabel}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder={t.authConfirmPasswordPlaceholder}
                        autoComplete="new-password"
                        disabled={loading}
                        className="w-full pl-10 pr-10 py-3 rounded-2xl liquid-glass-input font-mono text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all shadow-inner"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full min-h-[48px] py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs uppercase tracking-wider shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>{t.authCreatingAccount}</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4 text-emerald-100" />
                          <span>{t.authRegisterBtn}</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* Security notice footer */}
              <div className="pt-3 border-t border-slate-200/80 text-[11px] text-slate-500 space-y-1 font-mono">
                <div className="flex items-center gap-1.5 text-emerald-600 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Xavfsiz va shifrlangan proktoring protokoli</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-normal">
                  Har bir tekshiruvchi o'zining mustaqil variantlari va test auditoriyalariga ega bo'ladi.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-slate-400 py-3 border-t border-slate-200/60 bg-white/40 backdrop-blur-sm">
        HEMIS Proctored Assessment • Universitet Imtihon Nazorati
      </footer>
    </div>
  );
};
