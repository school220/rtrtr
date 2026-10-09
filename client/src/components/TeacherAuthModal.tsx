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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 select-none">
      <div className="bg-white border border-gray-200 rounded-lg max-w-md w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* HEMIS Top Bar Header */}
        <div className="bg-[#25718f] text-white p-5 text-center relative">
          <div className="w-12 h-12 rounded-full bg-white/20 border border-white/30 flex items-center justify-center mx-auto text-cyan-100 shadow mb-2">
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

        <div className="p-6 space-y-4">
          {/* Error message */}
          {error && (
            <div className="p-3 rounded bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <span className="font-semibold">{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 font-mono">
                {t.authUsernameLabel}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t.authUsernamePlaceholder}
                  autoComplete="username"
                  disabled={loading}
                  className="w-full pl-9 pr-3 py-2.5 rounded border border-gray-300 font-mono text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#25718f] focus:outline-none focus:ring-1 focus:ring-[#25718f]"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 font-mono">
                {t.authPasswordLabel}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.authPasswordPlaceholder}
                  autoComplete="current-password"
                  disabled={loading}
                  className="w-full pl-9 pr-10 py-2.5 rounded border border-gray-300 font-mono text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#25718f] focus:outline-none focus:ring-1 focus:ring-[#25718f]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2 space-y-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded bg-[#25718f] hover:bg-[#1f5f79] text-white font-bold text-xs uppercase tracking-wider shadow flex items-center justify-center gap-2 transition-all disabled:opacity-50"
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
                className="w-full py-2 px-4 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
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
