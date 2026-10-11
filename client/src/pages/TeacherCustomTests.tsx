import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Clock,
  BookOpen,
  Trash2,
  Edit3,
  Play,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  ListOrdered,
  Layers,
  X,
  Sparkles,
} from 'lucide-react';
import {
  api,
  CustomTestSummary,
} from '../services/api.js';
import { useLanguage } from '../context/LanguageContext.js';
import { LanguageSelector } from '../components/LanguageSelector.js';
import { CustomTestEditorModal } from '../components/CustomTestEditorModal.js';

interface TeacherCustomTestsProps {
  onBack: () => void;
  onLaunchGame: (gameId: string) => void;
  onStartPreview: (customTestId: string) => void;
}

export const TeacherCustomTests: React.FC<TeacherCustomTestsProps> = ({
  onBack,
  onLaunchGame,
  onStartPreview,
}) => {
  const { t } = useLanguage();
  const [tests, setTests] = useState<CustomTestSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Editor Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingTestId, setEditingTestId] = useState<string | null>(null);

  // Delete Confirm Modal State
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  // Load tests on mount
  useEffect(() => {
    loadTests();
  }, []);

  const loadTests = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getCustomTests();
      setTests(data);
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки тестов');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingTestId(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (testId: string) => {
    setEditingTestId(testId);
    setIsModalOpen(true);
  };

  const handleDeleteTest = async () => {
    if (!deleteConfirmId) return;
    setDeleting(true);
    try {
      await api.deleteCustomTest(deleteConfirmId);
      setDeleteConfirmId(null);
      await loadTests();
    } catch (err: any) {
      alert(err.message || 'Ошибка удаления теста');
    } finally {
      setDeleting(false);
    }
  };

  const handleLaunchInRoom = async (testId: string) => {
    try {
      const res = await api.launchCustomTest(testId);
      if (res && res.gameId) {
        onLaunchGame(res.gameId);
      }
    } catch (err: any) {
      alert(err.message || 'Ошибка запуска теста');
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#090d16] text-slate-100 font-sans select-none relative overflow-x-hidden">
      {/* Background Decorative Ambient Gradients */}
      <div className="fixed top-[-15%] left-[20%] w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed top-[30%] right-[10%] w-[450px] h-[450px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto p-3 sm:p-6 pt-safe pb-safe space-y-5">

      {/* Top Header Card */}
      <header className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/90 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={onBack}
              className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all border border-slate-700/60 shadow-sm active:scale-95"
              title="Назад в панель"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-black tracking-widest uppercase text-cyan-300 bg-cyan-950/80 border border-cyan-800/80 px-2.5 py-0.5 rounded-md font-mono flex items-center gap-1.5 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  HEMIS МОДУЛЬ ТЕСТОВ
                </span>
                <span className="text-[10px] font-black tracking-wider uppercase text-purple-300 bg-purple-950/80 border border-purple-800/80 px-2.5 py-0.5 rounded-md font-mono flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-400" />
                  <span>{api.getTeacherInfo()?.fullName || 'Преподаватель'}</span>
                </span>
              </div>

              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1.5">
                {t.customTestsTitle}
              </h1>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                {t.customTestsSubtitle}
              </p>
            </div>
          </div>

          {/* Right Header Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-1">
              <LanguageSelector />
            </div>

            <button
              onClick={loadTests}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all border border-slate-700/60 shadow-sm active:scale-95"
              title="Обновить список"
            >
              <RefreshCw className={`w-4 h-4 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-cyan-500/20 active:scale-95 transition-all group"
            >
              <Sparkles className="w-4 h-4 text-slate-950 group-hover:rotate-12 transition-transform" />
              <span>{t.customTestsCreateBtn}</span>
            </button>
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2.5 backdrop-blur-md">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}
      </header>

      {/* Tests Grid */}
      {loading ? (
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-16 text-center text-slate-400 flex flex-col items-center gap-4 backdrop-blur-xl shadow-2xl">
          <div className="w-10 h-10 border-3 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono text-slate-300">Загрузка авторских тестов...</span>
        </div>
      ) : tests.length === 0 ? (
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-16 text-center space-y-4 backdrop-blur-xl shadow-2xl">
          <div className="w-20 h-20 rounded-3xl bg-cyan-950/60 border border-cyan-800/80 text-cyan-400 mx-auto flex items-center justify-center shadow-lg shadow-cyan-950/50">
            <BookOpen className="w-10 h-10" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-lg font-black text-white">{t.customTestsNoTests}</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">{t.customTestsNoTestsHint}</p>
          </div>
          <button
            onClick={handleOpenCreateModal}
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 font-black transition-all inline-flex items-center gap-2 text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/20 active:scale-95"
          >
            <Sparkles className="w-4 h-4" />
            <span>{t.customTestsCreateBtn}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {tests.map((test) => (
            <div
              key={test.id}
              className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/90 hover:border-cyan-500/50 rounded-3xl p-5 sm:p-6 shadow-xl hover:shadow-cyan-950/20 transition-all flex flex-col justify-between space-y-5 group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400 flex-wrap gap-1.5">
                  <span className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700/80 px-2.5 py-1 rounded-xl font-bold text-cyan-300">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    {test.durationMinutes} {t.customTestsMinutes}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="flex items-center gap-1 bg-purple-950/80 border border-purple-800/60 text-purple-300 px-2 py-0.5 rounded-lg font-bold">
                      <ListOrdered className="w-3 h-3 text-purple-400" />
                      {test.questionCount} вопр.
                    </span>
                    <span className="flex items-center gap-1 bg-emerald-950/80 border border-emerald-800/60 text-emerald-300 px-2 py-0.5 rounded-lg font-bold">
                      <Layers className="w-3 h-3 text-emerald-400" />
                      {test.variantCount || 1} вар.
                    </span>
                  </div>
                </div>

                <h3 className="text-base font-black text-white leading-snug line-clamp-2 group-hover:text-cyan-200 transition-colors">
                  {test.title}
                </h3>
              </div>

              {/* Actions Footer */}
              <div className="space-y-2.5 pt-3 border-t border-slate-800">
                <div className="grid grid-cols-2 gap-2">
                  {/* Launch in room button */}
                  <button
                    onClick={() => handleLaunchInRoom(test.id)}
                    className="p-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/40 active:scale-95"
                    title={t.customTestsLaunchBtn}
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Запустить</span>
                  </button>

                  {/* Proctor Preview */}
                  <button
                    onClick={() => onStartPreview(test.id)}
                    className="p-2.5 rounded-xl bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 border border-amber-600/40 text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95"
                    title={t.customTestsPreviewBtn}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                    <span className="truncate">Тест (Проктор)</span>
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 text-xs">
                  <button
                    onClick={() => handleOpenEditModal(test.id)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white font-bold transition-all flex items-center gap-1.5 border border-slate-700/60 active:scale-95"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{t.customTestsEditBtn}</span>
                  </button>

                  <button
                    onClick={() => setDeleteConfirmId(test.id)}
                    className="px-3 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 hover:text-rose-200 font-bold transition-all flex items-center gap-1.5 border border-rose-800/50 active:scale-95"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>Удалить</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>

      {/* FULLSCREEN STUDIO MODAL */}
      <CustomTestEditorModal
        isOpen={isModalOpen}
        testId={editingTestId}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          setIsModalOpen(false);
          loadTests();
        }}
        onLaunchImmediately={(test) => {
          setIsModalOpen(false);
          handleLaunchInRoom(test.id);
        }}
      />

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white">{t.customTestsDeleteBtn}</h3>
              <button
                type="button"
                onClick={() => !deleting && setDeleteConfirmId(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed">
              {t.customTestDeleteConfirm}
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs"
              >
                {t.customTestCancelBtn}
              </button>
              <button
                type="button"
                onClick={handleDeleteTest}
                disabled={deleting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-rose-900/30"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t.customTestsDeleteBtn}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
