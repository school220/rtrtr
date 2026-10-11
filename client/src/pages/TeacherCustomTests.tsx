import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  PlusCircle,
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
    <div className="min-h-screen bg-[#f4f6f9] text-[#222d32] p-3 sm:p-5 select-none max-w-7xl mx-auto space-y-4 font-sans animate-fade-in">
      {/* Top Header Card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4 card-interactive">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
              title="Назад"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold tracking-wider uppercase text-[#25718f] bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded font-mono">
                  HEMIS • МОДУЛЬ ТЕСТОВ
                </span>
                <span className="text-[11px] font-bold tracking-wider uppercase text-purple-800 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded font-mono">
                  {api.getTeacherInfo()?.fullName || 'Преподаватель'}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight mt-1">
                {t.customTestsTitle}
              </h1>
              <p className="text-xs text-gray-500 font-mono">
                {t.customTestsSubtitle}
              </p>
            </div>
          </div>

          {/* Right Header Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="bg-[#25718f] rounded">
              <LanguageSelector />
            </div>

            <button
              onClick={loadTests}
              className="p-2.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors flex items-center gap-1.5 text-xs font-semibold"
              title="Обновить"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-[#25718f] hover:from-cyan-500 hover:to-cyan-700 text-white font-bold transition-all flex items-center gap-2 text-xs shadow-md active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{t.customTestsCreateBtn}</span>
            </button>
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="p-3 rounded bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Tests Grid */}
      {loading ? (
        <div className="bg-white border rounded-2xl p-12 text-center text-gray-500 flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-[#25718f] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono">Загрузка ваших тестов...</span>
        </div>
      ) : tests.length === 0 ? (
        <div className="bg-white border rounded-2xl p-12 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-cyan-50 border border-cyan-200 text-[#25718f] mx-auto flex items-center justify-center">
            <BookOpen className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-gray-800">{t.customTestsNoTests}</h3>
            <p className="text-xs text-gray-500 max-w-md mx-auto">{t.customTestsNoTestsHint}</p>
          </div>
          <button
            onClick={handleOpenCreateModal}
            className="px-5 py-2.5 rounded-xl bg-[#00a65a] hover:bg-emerald-700 text-white font-bold transition-colors inline-flex items-center gap-2 text-xs shadow"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{t.customTestsCreateBtn}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tests.map((test) => (
            <div
              key={test.id}
              className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-4 card-interactive"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs font-mono text-gray-500 flex-wrap gap-1">
                  <span className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded font-semibold text-gray-700">
                    <Clock className="w-3.5 h-3.5 text-[#25718f]" />
                    {test.durationMinutes} {t.customTestsMinutes}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="flex items-center gap-1 bg-purple-50 text-purple-800 px-2 py-0.5 rounded font-semibold">
                      <ListOrdered className="w-3.5 h-3.5" />
                      {test.questionCount} {t.customTestsQuestionsCount}
                    </span>
                    <span className="flex items-center gap-1 bg-cyan-50 text-cyan-800 px-2 py-0.5 rounded font-semibold">
                      <Layers className="w-3.5 h-3.5 text-[#25718f]" />
                      {test.variantCount || 1} вар.
                    </span>
                  </div>
                </div>

                <h3 className="text-base font-extrabold text-gray-900 leading-snug line-clamp-2">
                  {test.title}
                </h3>
              </div>

              {/* Actions Footer */}
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <div className="grid grid-cols-2 gap-2">
                  {/* Launch in room button */}
                  <button
                    onClick={() => handleLaunchInRoom(test.id)}
                    className="p-2.5 rounded-xl bg-[#00a65a] hover:bg-emerald-700 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1 shadow-sm"
                    title={t.customTestsLaunchBtn}
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>{t.customTestsLaunchBtn}</span>
                  </button>

                  {/* Proctor Preview */}
                  <button
                    onClick={() => onStartPreview(test.id)}
                    className="p-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold transition-colors flex items-center justify-center gap-1"
                    title={t.customTestsPreviewBtn}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                    <span className="truncate">{t.customTestsPreviewBtn}</span>
                  </button>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1 text-xs">
                  <button
                    onClick={() => handleOpenEditModal(test.id)}
                    className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold transition-colors flex items-center gap-1"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-[#25718f]" />
                    <span>{t.customTestsEditBtn}</span>
                  </button>

                  <button
                    onClick={() => setDeleteConfirmId(test.id)}
                    className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold transition-colors flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t.customTestsDeleteBtn}</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE / EDIT MODAL WITH VARIANTS SUPPORT */}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-gray-900">{t.customTestsDeleteBtn}</h3>
              <button
                type="button"
                onClick={() => !deleting && setDeleteConfirmId(null)}
                className="p-1 rounded text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-gray-700">
              {t.customTestDeleteConfirm}
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs"
              >
                {t.customTestCancelBtn}
              </button>
              <button
                type="button"
                onClick={handleDeleteTest}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow"
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
