import React, { useState } from 'react';
import { Lock, User, Eye, EyeOff, AlertTriangle, ArrowLeft, GraduationCap, ShieldCheck } from 'lucide-react';
import { api } from '../services/api.js';
import { useLanguage } from '../context/LanguageContext.js';

interface TeacherAuthModalProps {
  isOpen: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

export const TeacherAuthModal: React.FC<TeacherAuthModalProps> = ({
  isOpen,
  onSuccess,
  onCancel,
}) => {
  const { t } = useLanguage();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="liquid-glass-card border border-white/80 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 p-0">
        {/* HEMIS Top Bar Header */}
        <div className="bg-gradient-to-br from-[#25718f] to-cyan-600 text-white p-5 text-center relative border-b border-white/30">
          <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/30 flex items-center justify-center mx-auto text-white shadow mb-2 backdrop-blur-sm">
            <GraduationCap className="w-7 h-7" />
          </div>
          <div className="text-[11px] font-mono tracking-widest uppercase text-cyan-200 font-bold">
            {t.authBadge}
          </div>
          <h2 className="text-lg font-black tracking-tight text-white mt-0.5">
            {t.authHeading}
          </h2>
          <p className="text-xs text-cyan-100 mt-1 font-mono">
            {t.authSubheading}
          </p>
        </div>

        <div className="p-6 space-y-4 bg-white/50 backdrop-blur-md">
          {/* Error message */}
          {error && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 shadow-2xs">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <span className="font-semibold">{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
                {t.authUsernameLabel}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t.authUsernamePlaceholder}
                  autoComplete="username"
                  disabled={loading}
                  className="w-full pl-9 pr-3 py-2.5 rounded-2xl liquid-glass-input font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all shadow-inner"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
                {t.authPasswordLabel}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.authPasswordPlaceholder}
                  autoComplete="current-password"
                  disabled={loading}
                  className="w-full pl-9 pr-10 py-2.5 rounded-2xl liquid-glass-input font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2 space-y-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-2xl liquid-glass-btn-primary font-bold text-xs uppercase tracking-wider shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{t.authChecking}</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>{t.authSubmitBtn}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onCancel}
                disabled={loading}
                className="w-full py-2 px-4 rounded-2xl liquid-glass-btn-secondary text-slate-600 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{t.authBackBtn}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
