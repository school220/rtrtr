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
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  HelpCircle,
  ListOrdered,
  X,
  Eye,
} from 'lucide-react';
import {
  api,
  CustomTestSummary,
  CustomTestDetail,
  CustomQuestionItem,
  CustomQuestionType,
} from '../services/api.js';
import { useLanguage } from '../context/LanguageContext.js';
import { LanguageSelector } from '../components/LanguageSelector.js';
import { MathRenderer } from '../components/MathRenderer.js';

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
  const [testTitle, setTestTitle] = useState<string>('');
  const [durationMinutes, setDurationMinutes] = useState<string>('30');
  const [questions, setQuestions] = useState<CustomQuestionItem[]>([]);
  const [saving, setSaving] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [previewFormula, setPreviewFormula] = useState<boolean>(true);

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
    setTestTitle('');
    setDurationMinutes('30');
    // Start with 1 default question (4 options)
    setQuestions([
      {
        questionNumber: 1,
        questionText: '',
        questionType: 'four_options',
        correctAnswer: 'A',
        options: [
          { label: 'A', text: '', isCorrect: true },
          { label: 'B', text: '', isCorrect: false },
          { label: 'C', text: '', isCorrect: false },
          { label: 'D', text: '', isCorrect: false },
        ],
        points: 1,
      },
    ]);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = async (testId: string) => {
    setModalError(null);
    setSaving(true);
    try {
      const detail: CustomTestDetail = await api.getCustomTest(testId);
      setEditingTestId(detail.id);
      setTestTitle(detail.title);
      setDurationMinutes(String(detail.durationMinutes));

      const mappedQuestions: CustomQuestionItem[] = detail.questions.map((q) => {
        if (q.questionType === 'four_options') {
          const rawOpts = q.options || [];
          const defaultOpts = [
            { label: 'A', text: '', isCorrect: false },
            { label: 'B', text: '', isCorrect: false },
            { label: 'C', text: '', isCorrect: false },
            { label: 'D', text: '', isCorrect: false },
          ];
          const opts = defaultOpts.map((def, idx) => {
            const existing = rawOpts[idx];
            return {
              label: def.label,
              text: existing?.text || '',
              isCorrect: existing ? existing.isCorrect === true || q.correctAnswer === def.label : idx === 0,
            };
          });
          return {
            id: q.id,
            questionNumber: q.questionNumber,
            questionText: q.questionText,
            questionType: q.questionType,
            correctAnswer: q.correctAnswer,
            options: opts,
            points: q.points || 1,
          };
        } else if (q.questionType === 'yes_no') {
          return {
            id: q.id,
            questionNumber: q.questionNumber,
            questionText: q.questionText,
            questionType: q.questionType,
            correctAnswer: q.correctAnswer || 'Да',
            options: [
              { label: '1', text: 'Да', isCorrect: q.correctAnswer === 'Да' || q.correctAnswer === 'yes' },
              { label: '2', text: 'Нет', isCorrect: q.correctAnswer === 'Нет' || q.correctAnswer === 'no' },
            ],
            points: q.points || 1,
          };
        } else {
          return {
            id: q.id,
            questionNumber: q.questionNumber,
            questionText: q.questionText,
            questionType: 'free_input',
            correctAnswer: q.correctAnswer,
            options: undefined,
            points: q.points || 1,
          };
        }
      });

      setQuestions(mappedQuestions);
      setIsModalOpen(true);
    } catch (err: any) {
      alert(err.message || 'Ошибка загрузки теста');
    } finally {
      setSaving(false);
    }
  };

  const handleAddQuestion = () => {
    const nextNum = questions.length + 1;
    setQuestions([
      ...questions,
      {
        questionNumber: nextNum,
        questionText: '',
        questionType: 'four_options',
        correctAnswer: 'A',
        options: [
          { label: 'A', text: '', isCorrect: true },
          { label: 'B', text: '', isCorrect: false },
          { label: 'C', text: '', isCorrect: false },
          { label: 'D', text: '', isCorrect: false },
        ],
        points: 1,
      },
    ]);
  };

  const handleRemoveQuestion = (index: number) => {
    if (questions.length <= 1) {
      alert('В тесте должен оставаться хотя бы один вопрос.');
      return;
    }
    const filtered = questions.filter((_, idx) => idx !== index);
    // Renumber questions 1..N
    const renumbered = filtered.map((q, idx) => ({
      ...q,
      questionNumber: idx + 1,
    }));
    setQuestions(renumbered);
  };

  const handleQuestionTypeChange = (index: number, newType: CustomQuestionType) => {
    const updated = [...questions];
    const cur = updated[index];
    if (newType === 'four_options') {
      cur.questionType = 'four_options';
      cur.correctAnswer = 'A';
      cur.options = [
        { label: 'A', text: '', isCorrect: true },
        { label: 'B', text: '', isCorrect: false },
        { label: 'C', text: '', isCorrect: false },
        { label: 'D', text: '', isCorrect: false },
      ];
    } else if (newType === 'yes_no') {
      cur.questionType = 'yes_no';
      cur.correctAnswer = 'Да';
      cur.options = [
        { label: '1', text: 'Да', isCorrect: true },
        { label: '2', text: 'Нет', isCorrect: false },
      ];
    } else {
      // free_input
      cur.questionType = 'free_input';
      cur.correctAnswer = '';
      cur.options = undefined;
    }
    setQuestions(updated);
  };

  const handleQuestionTextChange = (index: number, text: string) => {
    const updated = [...questions];
    updated[index].questionText = text;
    setQuestions(updated);
  };

  const handleFourOptionTextChange = (qIndex: number, optIndex: number, text: string) => {
    const updated = [...questions];
    const opts = updated[qIndex].options || [];
    if (opts[optIndex]) {
      opts[optIndex].text = text;
    }
    setQuestions(updated);
  };

  const handleSelectCorrectOption = (qIndex: number, optIndex: number) => {
    const updated = [...questions];
    const opts = updated[qIndex].options || [];
    opts.forEach((o, i) => {
      o.isCorrect = i === optIndex;
    });
    const correct = opts[optIndex];
    if (correct) {
      updated[qIndex].correctAnswer = correct.label;
    }
    setQuestions(updated);
  };

  const handleSelectYesNoCorrect = (qIndex: number, isYes: boolean) => {
    const updated = [...questions];
    updated[qIndex].correctAnswer = isYes ? 'Да' : 'Нет';
    if (updated[qIndex].options) {
      updated[qIndex].options![0].isCorrect = isYes;
      updated[qIndex].options![1].isCorrect = !isYes;
    }
    setQuestions(updated);
  };

  const handleFreeInputAnswerChange = (qIndex: number, val: string) => {
    const updated = [...questions];
    updated[qIndex].correctAnswer = val;
    setQuestions(updated);
  };

  const handleSaveTest = async () => {
    setModalError(null);
    const cleanTitle = testTitle.trim();
    if (!cleanTitle) {
      setModalError(t.customTestTitleLabel + ' ' + (t.authErrorFullNameRequired || 'обязательно для заполнения'));
      return;
    }

    const mins = parseInt(durationMinutes, 10);
    if (isNaN(mins) || mins < 1 || mins > 180) {
      setModalError('Время теста должно быть от 1 до 180 минут.');
      return;
    }

    if (questions.length === 0) {
      setModalError('Добавьте хотя бы один вопрос в тест.');
      return;
    }

    // Validate each question
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const qNum = i + 1;
      if (!q.questionText.trim()) {
        setModalError(`Вопрос №${qNum}: введите текст вопроса.`);
        return;
      }

      if (q.questionType === 'four_options') {
        const opts = q.options || [];
        if (opts.length !== 4) {
          setModalError(`Вопрос №${qNum}: заполните все 4 варианта ответа.`);
          return;
        }
        for (let j = 0; j < opts.length; j++) {
          if (!opts[j].text.trim()) {
            setModalError(`Вопрос №${qNum}, вариант ${opts[j].label}: введите текст варианта.`);
            return;
          }
        }
        if (!opts.some((o) => o.isCorrect)) {
          setModalError(`Вопрос №${qNum}: отметьте правильный вариант ответа.`);
          return;
        }
      } else if (q.questionType === 'yes_no') {
        if (!q.correctAnswer) {
          setModalError(`Вопрос №${qNum}: укажите правильный ответ (Да или Нет).`);
          return;
        }
      } else if (q.questionType === 'free_input') {
        if (!q.correctAnswer?.trim()) {
          setModalError(`Вопрос №${qNum}: введите эталонный правильный ответ для проверки.`);
          return;
        }
      }
    }

    setSaving(true);
    try {
      if (editingTestId) {
        await api.updateCustomTest(editingTestId, {
          title: cleanTitle,
          durationMinutes: mins,
          questions,
        });
      } else {
        await api.createCustomTest({
          title: cleanTitle,
          durationMinutes: mins,
          questions,
        });
      }
      setIsModalOpen(false);
      await loadTests();
    } catch (err: any) {
      setModalError(err.message || 'Ошибка сохранения теста');
    } finally {
      setSaving(false);
    }
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
    <div className="min-h-screen bg-[#f4f6f9] text-[#222d32] p-3 sm:p-5 select-none max-w-7xl mx-auto space-y-4 font-sans">
      {/* Top Header Card */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-5 shadow-sm space-y-4">
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
              className="px-4 py-2.5 rounded bg-[#00a65a] hover:bg-emerald-700 text-white font-bold transition-all flex items-center gap-2 text-xs shadow-sm"
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
        <div className="bg-white border rounded-lg p-12 text-center text-gray-500 flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-[#25718f] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono">Загрузка ваших тестов...</span>
        </div>
      ) : tests.length === 0 ? (
        <div className="bg-white border rounded-lg p-12 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-cyan-50 border border-cyan-200 text-[#25718f] mx-auto flex items-center justify-center">
            <BookOpen className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-gray-800">{t.customTestsNoTests}</h3>
            <p className="text-xs text-gray-500 max-w-md mx-auto">{t.customTestsNoTestsHint}</p>
          </div>
          <button
            onClick={handleOpenCreateModal}
            className="px-5 py-2.5 rounded bg-[#00a65a] hover:bg-emerald-700 text-white font-bold transition-colors inline-flex items-center gap-2 text-xs shadow"
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
              className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono text-gray-500">
                  <span className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded font-semibold text-gray-700">
                    <Clock className="w-3.5 h-3.5 text-[#25718f]" />
                    {test.durationMinutes} {t.customTestsMinutes}
                  </span>
                  <span className="flex items-center gap-1 bg-purple-50 text-purple-800 px-2 py-0.5 rounded font-semibold">
                    <ListOrdered className="w-3.5 h-3.5" />
                    {test.questionCount} {t.customTestsQuestionsCount}
                  </span>
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
                    className="p-2 rounded bg-[#00a65a] hover:bg-emerald-700 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1 shadow-sm"
                    title={t.customTestsLaunchBtn}
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>{t.customTestsLaunchBtn}</span>
                  </button>

                  {/* Proctor Preview */}
                  <button
                    onClick={() => onStartPreview(test.id)}
                    className="p-2 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold transition-colors flex items-center justify-center gap-1"
                    title={t.customTestsPreviewBtn}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                    <span className="truncate">{t.customTestsPreviewBtn}</span>
                  </button>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1 text-xs">
                  <button
                    onClick={() => handleOpenEditModal(test.id)}
                    className="px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold transition-colors flex items-center gap-1"
                  >
                    <Edit3 className="w-3 h-3 text-[#25718f]" />
                    <span>{t.customTestsEditBtn}</span>
                  </button>

                  <button
                    onClick={() => setDeleteConfirmId(test.id)}
                    className="px-2.5 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold transition-colors flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>{t.customTestsDeleteBtn}</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-4xl bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3 shrink-0">
              <h2 className="text-lg font-black text-gray-900">
                {editingTestId ? t.customTestModalEditTitle : t.customTestModalCreateTitle}
              </h2>
              <button
                type="button"
                onClick={() => !saving && setIsModalOpen(false)}
                className="p-1 rounded text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6 overflow-y-auto pr-1 flex-1">
              {/* Modal Error */}
          {modalError && (
            <div className="p-3 rounded bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
              <span className="font-semibold">{modalError}</span>
            </div>
          )}

          {/* Test Meta Info: Title and Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-bold text-gray-700 font-mono uppercase">
                {t.customTestTitleLabel} *
              </label>
              <input
                type="text"
                value={testTitle}
                onChange={(e) => setTestTitle(e.target.value)}
                placeholder={t.customTestTitlePlaceholder}
                className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#25718f]"
                disabled={saving}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-700 font-mono uppercase flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#25718f]" />
                {t.customTestDurationLabel} *
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="180"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  className="w-full px-3 py-2 border rounded text-sm font-mono text-center focus:outline-none focus:ring-2 focus:ring-[#25718f]"
                  disabled={saving}
                />
                <span className="text-xs font-mono text-gray-500">{t.customTestsMinutes}</span>
              </div>
            </div>
          </div>

          {/* Formula Preview Toggle */}
          <div className="flex items-center justify-between text-xs font-mono text-gray-600 border-b pb-2">
            <span className="font-bold uppercase tracking-wider text-gray-700">
              {t.customTestQuestionsHeader} ({questions.length})
            </span>
            <button
              type="button"
              onClick={() => setPreviewFormula(!previewFormula)}
              className="text-[#25718f] hover:underline flex items-center gap-1"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{previewFormula ? 'Скрыть KaTeX формулы' : 'Показать KaTeX формулы'}</span>
            </button>
          </div>

          {/* Questions Builder List */}
          <div className="space-y-6">
            {questions.map((q, qIdx) => (
              <div
                key={qIdx}
                className="bg-white border-2 border-gray-200 rounded-lg p-4 sm:p-5 shadow-sm space-y-4 relative"
              >
                {/* Header row: Number, Type switcher, and Remove button */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded bg-[#25718f] text-white font-mono text-xs font-bold flex items-center justify-center">
                      №{qIdx + 1}
                    </span>
                    <span className="text-xs font-bold text-gray-800 uppercase font-mono">
                      {t.customTestQuestionNum} {qIdx + 1}
                    </span>
                  </div>

                  {/* 3 Question Types Selector */}
                  <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => handleQuestionTypeChange(qIdx, 'four_options')}
                      className={`px-2.5 py-1 rounded transition-colors ${
                        q.questionType === 'four_options'
                          ? 'bg-white text-[#25718f] shadow-sm font-bold'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {t.customTestTypeFourOptions}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuestionTypeChange(qIdx, 'yes_no')}
                      className={`px-2.5 py-1 rounded transition-colors ${
                        q.questionType === 'yes_no'
                          ? 'bg-white text-emerald-700 shadow-sm font-bold'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {t.customTestTypeYesNo}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuestionTypeChange(qIdx, 'free_input')}
                      className={`px-2.5 py-1 rounded transition-colors ${
                        q.questionType === 'free_input'
                          ? 'bg-white text-purple-700 shadow-sm font-bold'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {t.customTestTypeFreeInput}
                    </button>
                  </div>

                  {/* Delete question button */}
                  {questions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveQuestion(qIdx)}
                      className="p-1.5 rounded text-rose-600 hover:bg-rose-50 transition-colors"
                      title={t.customTestRemoveQuestionBtn}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Question Text Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 font-mono">
                    {t.customTestQuestionTextLabel} *
                  </label>
                  <textarea
                    rows={2}
                    value={q.questionText}
                    onChange={(e) => handleQuestionTextChange(qIdx, e.target.value)}
                    placeholder={t.customTestQuestionTextPlaceholder}
                    className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#25718f]"
                    disabled={saving}
                  />
                  {previewFormula && q.questionText.trim() && (
                    <div className="p-2.5 rounded bg-cyan-50/50 border border-cyan-100 text-sm font-medium text-gray-800">
                      <MathRenderer content={q.questionText} />
                    </div>
                  )}
                </div>

                {/* TYPE 1: 4 OPTIONS BUILDER */}
                {q.questionType === 'four_options' && (
                  <div className="space-y-2 pt-2 border-t border-gray-100">
                    <div className="flex items-center justify-between text-xs font-mono text-gray-600">
                      <span className="font-bold">{t.customTestOptionsLabel}</span>
                      <span className="text-[11px] text-gray-400">Нажмите на кружок, чтобы выбрать правильный</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {q.options?.map((opt, optIdx) => {
                        const isCorrect = opt.isCorrect === true;
                        return (
                          <div
                            key={optIdx}
                            className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${
                              isCorrect ? 'border-emerald-400 bg-emerald-50/50 ring-1 ring-emerald-300' : 'border-gray-200 bg-white'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => handleSelectCorrectOption(qIdx, optIdx)}
                              className={`w-7 h-7 rounded-full font-mono text-xs font-bold flex items-center justify-center shrink-0 border transition-all ${
                                isCorrect
                                  ? 'bg-[#00a65a] border-[#00a65a] text-white shadow-sm'
                                  : 'bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200'
                              }`}
                              title={isCorrect ? 'Правильный ответ' : 'Сделать правильным'}
                            >
                              {opt.label}
                            </button>
                            <input
                              type="text"
                              value={opt.text}
                              onChange={(e) => handleFourOptionTextChange(qIdx, optIdx, e.target.value)}
                              placeholder={`${t.customTestOptionPlaceholder} ${opt.label}...`}
                              className="w-full px-2.5 py-1.5 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#25718f]"
                              disabled={saving}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* TYPE 2: YES / NO BUILDER */}
                {q.questionType === 'yes_no' && (
                  <div className="space-y-2 pt-2 border-t border-gray-100">
                    <label className="text-xs font-bold text-gray-700 font-mono">
                      {t.customTestCorrectAnswerLabel}
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleSelectYesNoCorrect(qIdx, true)}
                        className={`flex-1 py-3 px-4 rounded-lg border text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                          q.correctAnswer === 'Да'
                            ? 'bg-emerald-600 border-emerald-600 text-white shadow ring-2 ring-emerald-300'
                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{t.customTestYesLabel} (Правильный)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSelectYesNoCorrect(qIdx, false)}
                        className={`flex-1 py-3 px-4 rounded-lg border text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                          q.correctAnswer === 'Нет'
                            ? 'bg-rose-600 border-rose-600 text-white shadow ring-2 ring-rose-300'
                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <X className="w-4 h-4" />
                        <span>{t.customTestNoLabel} (Правильный)</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* TYPE 3: FREE INPUT BUILDER */}
                {q.questionType === 'free_input' && (
                  <div className="space-y-1.5 pt-2 border-t border-gray-100">
                    <label className="text-xs font-bold text-purple-900 font-mono flex items-center gap-1.5">
                      <HelpCircle className="w-3.5 h-3.5 text-purple-700" />
                      {t.customTestCorrectAnswerLabel} *
                    </label>
                    <input
                      type="text"
                      value={q.correctAnswer || ''}
                      onChange={(e) => handleFreeInputAnswerChange(qIdx, e.target.value)}
                      placeholder={t.customTestCorrectAnswerPlaceholder}
                      className="w-full px-3 py-2 border border-purple-300 rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-600 bg-purple-50/30"
                      disabled={saving}
                    />
                    <p className="text-[11px] text-gray-500 font-mono">
                      Ученик будет вводить ответ вручную. Сервер автоматически сопоставит числовые и текстовые ответы.
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add Question Button */}
          <button
            type="button"
            onClick={handleAddQuestion}
            className="w-full py-3 rounded-lg border-2 border-dashed border-[#25718f]/40 hover:border-[#25718f] text-[#25718f] hover:bg-cyan-50/50 font-bold transition-all flex items-center justify-center gap-2 text-xs"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{t.customTestAddQuestionBtn}</span>
          </button>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 mt-4">
          <button
            type="button"
            onClick={() => setIsModalOpen(false)}
            disabled={saving}
            className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs transition-colors"
          >
            {t.customTestCancelBtn}
          </button>

          <button
            type="button"
            onClick={handleSaveTest}
            disabled={saving}
            className="px-6 py-2 rounded bg-[#00a65a] hover:bg-emerald-700 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
          >
            {saving ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>{t.customTestSavingBtn}</span>
              </>
            ) : (
              <span>{t.customTestSaveBtn}</span>
            )}
          </button>
            </div>
          </div>
        </div>
      )}

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
                className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs"
              >
                {t.customTestCancelBtn}
              </button>
              <button
                type="button"
                onClick={handleDeleteTest}
                disabled={deleting}
                className="px-4 py-2 rounded bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow"
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
