import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Copy,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  Layers,
  Save,
} from 'lucide-react';
import {
  api,
  CustomTestDetail,
  CustomQuestionItem,
  CustomQuestionType,
} from '../services/api.js';
import { MathRenderer } from './MathRenderer.js';
import { MathToolbar } from './MathToolbar.js';

interface CustomTestEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  testId?: string | null;
  onSuccess: (savedTest: CustomTestDetail) => void;
  onLaunchImmediately?: (savedTest: CustomTestDetail) => void;
}

export const CustomTestEditorModal: React.FC<CustomTestEditorModalProps> = ({
  isOpen,
  onClose,
  testId,
  onSuccess,
  onLaunchImmediately,
}) => {
  const [title, setTitle] = useState<string>('');
  const [durationMinutes, setDurationMinutes] = useState<string>('30');
  const [variants, setVariants] = useState<number[]>([1]);
  const [activeVariant, setActiveVariant] = useState<number>(1);
  // Map of variantNumber -> array of questions
  const [variantQuestions, setVariantQuestions] = useState<Record<number, CustomQuestionItem[]>>({
    1: [
      {
        variantNumber: 1,
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
    ],
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showFormulaPreview, setShowFormulaPreview] = useState<boolean>(true);

  // Active target for math toolbar insertion
  const [activeTarget, setActiveTarget] = useState<{
    qIdx: number;
    field: 'question' | 'option' | 'free_input';
    optIdx?: number;
  } | null>(null);

  // Load existing test or reset on open
  useEffect(() => {
    if (!isOpen) return;

    if (testId) {
      loadExistingTest(testId);
    } else {
      // Reset to defaults
      setTitle('');
      setDurationMinutes('30');
      setVariants([1]);
      setActiveVariant(1);
      setVariantQuestions({
        1: [
          {
            variantNumber: 1,
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
        ],
      });
      setError(null);
      setActiveTarget(null);
    }
  }, [isOpen, testId]);

  const loadExistingTest = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const data: CustomTestDetail = await api.getCustomTest(id);
      setTitle(data.title);
      setDurationMinutes(String(data.durationMinutes || 30));

      const vMap: Record<number, CustomQuestionItem[]> = {};
      const foundVariants = new Set<number>();

      data.questions.forEach((q) => {
        const vNum = q.variantNumber || 1;
        foundVariants.add(vNum);
        if (!vMap[vNum]) vMap[vNum] = [];

        let mappedOptions = q.options;
        if (q.questionType === 'four_options') {
          const rawOpts = q.options || [];
          mappedOptions = [
            { label: 'A', text: rawOpts[0]?.text || '', isCorrect: rawOpts[0]?.isCorrect || q.correctAnswer === 'A' },
            { label: 'B', text: rawOpts[1]?.text || '', isCorrect: rawOpts[1]?.isCorrect || q.correctAnswer === 'B' },
            { label: 'C', text: rawOpts[2]?.text || '', isCorrect: rawOpts[2]?.isCorrect || q.correctAnswer === 'C' },
            { label: 'D', text: rawOpts[3]?.text || '', isCorrect: rawOpts[3]?.isCorrect || q.correctAnswer === 'D' },
          ];
        } else if (q.questionType === 'yes_no') {
          const isYes = q.correctAnswer === 'Да' || q.correctAnswer === '1';
          mappedOptions = [
            { label: '1', text: 'Да', isCorrect: isYes },
            { label: '2', text: 'Нет', isCorrect: !isYes },
          ];
        }

        vMap[vNum].push({
          ...q,
          variantNumber: vNum,
          options: mappedOptions,
        });
      });

      const sortedVariants = Array.from(foundVariants).sort((a, b) => a - b);
      if (sortedVariants.length === 0) sortedVariants.push(1);
      if (!vMap[1]) {
        vMap[1] = [
          {
            variantNumber: 1,
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
        ];
      }

      setVariants(sortedVariants);
      setActiveVariant(sortedVariants[0]);
      setVariantQuestions(vMap);
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки теста');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const currentQuestions = variantQuestions[activeVariant] || [];

  // Variant operations
  const handleAddVariant = () => {
    const nextVariantNum = variants.length > 0 ? Math.max(...variants) + 1 : 1;
    const newVariants = [...variants, nextVariantNum].sort((a, b) => a - b);
    setVariants(newVariants);
    setVariantQuestions((prev) => ({
      ...prev,
      [nextVariantNum]: [
        {
          variantNumber: nextVariantNum,
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
      ],
    }));
    setActiveVariant(nextVariantNum);
  };

  const handleDeleteVariant = (vNum: number) => {
    if (variants.length <= 1) {
      alert('В тесте должен оставаться хотя бы один вариант.');
      return;
    }
    if (!confirm(`Удалить Вариант ${vNum} со всеми его вопросами?`)) return;

    const remaining = variants.filter((v) => v !== vNum);
    setVariants(remaining);
    const updatedMap = { ...variantQuestions };
    delete updatedMap[vNum];
    setVariantQuestions(updatedMap);
    if (activeVariant === vNum) {
      setActiveVariant(remaining[0]);
    }
  };

  const handleCopyFromVariant1 = () => {
    const v1Questions = variantQuestions[1];
    if (!v1Questions || v1Questions.length === 0) {
      alert('В Варианте 1 нет вопросов для копирования.');
      return;
    }
    if (
      currentQuestions.length > 0 &&
      !confirm(`Заменить текущие вопросы Варианта ${activeVariant} копией из Варианта 1?`)
    ) {
      return;
    }

    const copied: CustomQuestionItem[] = JSON.parse(JSON.stringify(v1Questions)).map(
      (q: CustomQuestionItem) => ({
        ...q,
        variantNumber: activeVariant,
      })
    );

    setVariantQuestions((prev) => ({
      ...prev,
      [activeVariant]: copied,
    }));
  };

  // Question operations in active variant
  const handleAddQuestion = () => {
    const newQ: CustomQuestionItem = {
      variantNumber: activeVariant,
      questionNumber: currentQuestions.length + 1,
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
    };

    setVariantQuestions((prev) => ({
      ...prev,
      [activeVariant]: [...(prev[activeVariant] || []), newQ],
    }));
  };

  const handleRemoveQuestion = (idx: number) => {
    if (currentQuestions.length <= 1) {
      alert('В варианте должен оставаться хотя бы один вопрос.');
      return;
    }
    const filtered = currentQuestions.filter((_, i) => i !== idx);
    const renumbered = filtered.map((q, i) => ({
      ...q,
      questionNumber: i + 1,
    }));

    setVariantQuestions((prev) => ({
      ...prev,
      [activeVariant]: renumbered,
    }));
  };

  const handleQuestionTypeChange = (idx: number, newType: CustomQuestionType) => {
    const updated = [...currentQuestions];
    const cur = updated[idx];
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
      cur.questionType = 'free_input';
      cur.correctAnswer = '';
      cur.options = undefined;
    }

    setVariantQuestions((prev) => ({
      ...prev,
      [activeVariant]: updated,
    }));
  };

  const handleQuestionTextChange = (idx: number, text: string) => {
    const updated = [...currentQuestions];
    updated[idx].questionText = text;
    setVariantQuestions((prev) => ({
      ...prev,
      [activeVariant]: updated,
    }));
  };

  const handleOptionTextChange = (qIdx: number, optIdx: number, text: string) => {
    const updated = [...currentQuestions];
    const opts = updated[qIdx].options || [];
    if (opts[optIdx]) {
      opts[optIdx].text = text;
    }
    setVariantQuestions((prev) => ({
      ...prev,
      [activeVariant]: updated,
    }));
  };

  const handleSelectCorrectOption = (qIdx: number, optIdx: number) => {
    const updated = [...currentQuestions];
    const opts = updated[qIdx].options || [];
    opts.forEach((o, i) => {
      o.isCorrect = i === optIdx;
    });
    if (opts[optIdx]) {
      updated[qIdx].correctAnswer = opts[optIdx].label;
    }
    setVariantQuestions((prev) => ({
      ...prev,
      [activeVariant]: updated,
    }));
  };

  const handleSelectYesNoCorrect = (qIdx: number, isYes: boolean) => {
    const updated = [...currentQuestions];
    updated[qIdx].correctAnswer = isYes ? 'Да' : 'Нет';
    if (updated[qIdx].options) {
      updated[qIdx].options![0].isCorrect = isYes;
      updated[qIdx].options![1].isCorrect = !isYes;
    }
    setVariantQuestions((prev) => ({
      ...prev,
      [activeVariant]: updated,
    }));
  };

  const handleFreeInputAnswerChange = (qIdx: number, val: string) => {
    const updated = [...currentQuestions];
    updated[qIdx].correctAnswer = val;
    setVariantQuestions((prev) => ({
      ...prev,
      [activeVariant]: updated,
    }));
  };

  const handleInsertMath = (qIdx: number, snippet: string) => {
    if (
      activeTarget &&
      activeTarget.qIdx === qIdx &&
      activeTarget.field === 'option' &&
      activeTarget.optIdx !== undefined
    ) {
      const optIdx = activeTarget.optIdx;
      const current = currentQuestions[qIdx].options?.[optIdx]?.text || '';
      handleOptionTextChange(qIdx, optIdx, current + snippet);
    } else if (activeTarget && activeTarget.qIdx === qIdx && activeTarget.field === 'free_input') {
      const current = currentQuestions[qIdx].correctAnswer || '';
      handleFreeInputAnswerChange(qIdx, current + snippet);
    } else {
      const current = currentQuestions[qIdx].questionText || '';
      handleQuestionTextChange(qIdx, current + snippet);
    }
  };

  // Validate and submit test
  const handleSave = async (andLaunch: boolean = false) => {
    setError(null);
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError('Введите название теста.');
      return;
    }

    const mins = parseInt(durationMinutes, 10);
    if (isNaN(mins) || mins < 1 || mins > 180) {
      setError('Укажите время теста от 1 до 180 минут.');
      return;
    }

    // Assemble all questions from all variants
    const allQuestionsToSave: CustomQuestionItem[] = [];

    for (const vNum of variants) {
      const vQuestions = variantQuestions[vNum] || [];
      if (vQuestions.length === 0) {
        setError(`Вариант №${vNum}: добавьте хотя бы один вопрос.`);
        return;
      }

      for (let i = 0; i < vQuestions.length; i++) {
        const q = vQuestions[i];
        const qNum = i + 1;
        if (!q.questionText.trim()) {
          setError(`Вариант ${vNum}, Вопрос №${qNum}: введите текст вопроса.`);
          setActiveVariant(vNum);
          return;
        }

        if (q.questionType === 'four_options') {
          const opts = q.options || [];
          if (opts.length !== 4) {
            setError(`Вариант ${vNum}, Вопрос №${qNum}: заполните 4 варианта ответа.`);
            setActiveVariant(vNum);
            return;
          }
          for (let j = 0; j < opts.length; j++) {
            if (!opts[j].text.trim()) {
              setError(`Вариант ${vNum}, Вопрос №${qNum}, вариант ${opts[j].label}: введите текст ответа.`);
              setActiveVariant(vNum);
              return;
            }
          }
          if (!opts.some((o) => o.isCorrect)) {
            setError(`Вариант ${vNum}, Вопрос №${qNum}: отметьте правильный вариант.`);
            setActiveVariant(vNum);
            return;
          }
        } else if (q.questionType === 'yes_no') {
          if (!q.correctAnswer) {
            setError(`Вариант ${vNum}, Вопрос №${qNum}: выберите правильный ответ (Да или Нет).`);
            setActiveVariant(vNum);
            return;
          }
        } else if (q.questionType === 'free_input') {
          if (!q.correctAnswer?.trim()) {
            setError(`Вариант ${vNum}, Вопрос №${qNum}: укажите эталонный ответ для проверки.`);
            setActiveVariant(vNum);
            return;
          }
        }

        allQuestionsToSave.push({
          ...q,
          variantNumber: vNum,
          questionNumber: qNum,
          points: Math.max(1, q.points || 1),
        });
      }
    }

    setSaving(true);
    try {
      let saved: CustomTestDetail;
      if (testId) {
        saved = await api.updateCustomTest(testId, {
          title: cleanTitle,
          durationMinutes: mins,
          questions: allQuestionsToSave,
        });
      } else {
        saved = await api.createCustomTest({
          title: cleanTitle,
          durationMinutes: mins,
          questions: allQuestionsToSave,
        });
      }

      onSuccess(saved);
      if (andLaunch && onLaunchImmediately) {
        onLaunchImmediately(saved);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Ошибка сохранения теста');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-fade-in">
      <div className="bg-[#1e282c] border border-cyan-800/40 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-gray-100">
        {/* Header */}
        <div className="bg-[#182124] border-b border-gray-700/60 p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#25718f] to-cyan-500 flex items-center justify-center text-white shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
                {testId ? 'Редактировать тест' : 'Создать новый тест'}
                <span className="text-xs bg-cyan-900/60 border border-cyan-500/40 text-cyan-300 px-2 py-0.5 rounded-full font-mono">
                  {variants.length} вар.
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                Задайте время, создайте варианты и добавьте вопросы с формулами
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-900/30 border border-red-500/50 rounded-xl text-red-200 text-xs sm:text-sm flex items-start gap-2 animate-shake">
              <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="py-16 text-center text-gray-400 flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-3 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-mono tracking-wider uppercase">Загрузка данных теста...</span>
            </div>
          ) : (
            <>
              {/* Top Settings: Title & Duration */}
              <div className="bg-[#243035] border border-gray-700/60 rounded-xl p-4 sm:p-5 space-y-4 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Title */}
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                      <span>Название теста</span>
                      <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Например: Итоговый контроль по стереометрии"
                      className="w-full bg-[#182124] border border-gray-600 focus:border-cyan-400 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-400 transition-all font-medium"
                    />
                  </div>

                  {/* Duration */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Время теста (минут)</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={180}
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(e.target.value)}
                      className="w-full bg-[#182124] border border-gray-600 focus:border-cyan-400 rounded-lg px-3.5 py-2.5 text-sm text-white font-mono focus:outline-none focus:ring-1 focus:ring-cyan-400 transition-all"
                    />
                  </div>
                </div>

                {/* Quick duration presets */}
                <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-gray-700/40">
                  <span className="text-[11px] text-gray-400 font-mono">Быстрый выбор:</span>
                  {[15, 20, 30, 45, 60, 90, 120].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setDurationMinutes(String(mins))}
                      className={`text-xs px-2.5 py-1 rounded-md transition-all font-mono font-semibold ${
                        durationMinutes === String(mins)
                          ? 'bg-cyan-500 text-black shadow-sm font-bold'
                          : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                      }`}
                    >
                      {mins} мин
                    </button>
                  ))}
                </div>
              </div>

              {/* Variants Section */}
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-700/60 pb-2">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-200">
                      Варианты теста:
                    </span>
                  </div>

                  {/* Copy questions button if active variant != 1 */}
                  {activeVariant !== 1 && (
                    <button
                      type="button"
                      onClick={handleCopyFromVariant1}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-cyan-300 border border-cyan-800/60 flex items-center gap-1.5 transition-colors"
                      title="Скопировать вопросы из Варианта 1"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Скопировать из Вар. 1</span>
                    </button>
                  )}
                </div>

                {/* Variant Tabs Strip */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
                  {variants.map((vNum) => {
                    const qCount = variantQuestions[vNum]?.length || 0;
                    const isActive = activeVariant === vNum;
                    return (
                      <div
                        key={vNum}
                        onClick={() => setActiveVariant(vNum)}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl cursor-pointer border transition-all select-none ${
                          isActive
                            ? 'bg-gradient-to-r from-cyan-600 to-[#25718f] text-white border-cyan-400 shadow-md font-bold'
                            : 'bg-[#243035] text-gray-300 border-gray-700 hover:border-gray-600'
                        }`}
                      >
                        <span className="text-xs tracking-wide">Вариант {vNum}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                            isActive ? 'bg-black/30 text-cyan-100' : 'bg-gray-800 text-gray-400'
                          }`}
                        >
                          {qCount} в.
                        </span>
                        {variants.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteVariant(vNum);
                            }}
                            className="p-1 rounded hover:bg-red-500/30 text-gray-400 hover:text-red-300 transition-colors ml-1"
                            title={`Удалить Вариант ${vNum}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    onClick={handleAddVariant}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-800/80 hover:bg-gray-700 border border-dashed border-cyan-500/40 text-cyan-400 hover:text-cyan-300 transition-all text-xs font-semibold whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Добавить вариант</span>
                  </button>
                </div>

                {/* Questions for Current Active Variant */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span className="font-semibold text-cyan-200">
                      Вопросы Варианта {activeVariant} ({currentQuestions.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowFormulaPreview(!showFormulaPreview)}
                      className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-cyan-300 transition-colors font-mono"
                    >
                      {showFormulaPreview ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      <span>{showFormulaPreview ? 'Формулы: Предпросмотр вкл' : 'Формулы: Скрыты'}</span>
                    </button>
                  </div>

                  {currentQuestions.map((q, qIdx) => (
                    <div
                      key={qIdx}
                      className="bg-[#243035] border border-gray-700/70 rounded-xl p-4 sm:p-5 space-y-4 shadow-sm"
                    >
                      {/* Question Header */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-700/40 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-cyan-500 text-black font-extrabold text-xs flex items-center justify-center font-mono">
                            {qIdx + 1}
                          </span>
                          <span className="text-xs font-bold text-white tracking-wide">
                            Вопрос №{qIdx + 1} (Вариант {activeVariant})
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          {/* Points */}
                          <div className="flex items-center gap-1 text-xs text-gray-400 font-mono">
                            <span>Балл:</span>
                            <input
                              type="number"
                              min={1}
                              max={100}
                              value={q.points || 1}
                              onChange={(e) => {
                                const pts = parseInt(e.target.value, 10) || 1;
                                const updated = [...currentQuestions];
                                updated[qIdx].points = pts;
                                setVariantQuestions((prev) => ({
                                  ...prev,
                                  [activeVariant]: updated,
                                }));
                              }}
                              className="w-12 bg-[#182124] border border-gray-600 rounded px-1.5 py-0.5 text-center text-xs text-white"
                            />
                          </div>

                          {/* Delete Question */}
                          <button
                            type="button"
                            onClick={() => handleRemoveQuestion(qIdx)}
                            className="p-1.5 rounded-lg bg-gray-800 hover:bg-red-900/40 text-gray-400 hover:text-red-300 transition-colors"
                            title="Удалить вопрос"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Question Text with Desmos Math Toolbar */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center justify-between">
                          <span>Текст вопроса:</span>
                          <span className="text-[10px] text-gray-400 font-mono font-normal">
                            (Используйте $формула$ для KaTeX)
                          </span>
                        </label>
                        <textarea
                          rows={2}
                          value={q.questionText}
                          onFocus={() => setActiveTarget({ qIdx, field: 'question' })}
                          onChange={(e) => handleQuestionTextChange(qIdx, e.target.value)}
                          placeholder="Введите текст вопроса. Например: Вычислите значение выражения $\sqrt{16} + \frac{1}{2}$"
                          className="w-full bg-[#182124] border border-gray-600 focus:border-cyan-400 rounded-lg p-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-400 transition-all font-sans"
                        />

                        {/* Desmos Math Toolbar */}
                        <div className="bg-[#182124] border border-cyan-900/40 rounded-lg p-2">
                          <div className="text-[10px] uppercase font-bold text-cyan-400 mb-1 flex items-center gap-1 font-mono">
                            <Sparkles className="w-3 h-3 text-cyan-400" />
                            <span>Панель математических формул (Desmos)</span>
                          </div>
                          <MathToolbar
                            compact
                            onInsert={(snippet) => handleInsertMath(qIdx, snippet)}
                          />
                        </div>

                        {/* Formula Live Preview */}
                        {showFormulaPreview && q.questionText && (
                          <div className="p-2.5 rounded-lg bg-[#141b1e] border border-cyan-800/30 text-xs text-cyan-100">
                            <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1 font-mono">
                              Предпросмотр:
                            </span>
                            <MathRenderer content={q.questionText} />
                          </div>
                        )}
                      </div>

                      {/* Question Type Selector */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                          Тип ответа:
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => handleQuestionTypeChange(qIdx, 'four_options')}
                            className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                              q.questionType === 'four_options'
                                ? 'bg-cyan-900/40 border-cyan-400 text-cyan-200 shadow-sm'
                                : 'bg-[#182124] border-gray-700 text-gray-400 hover:text-white'
                            }`}
                          >
                            <span>🔘 4 варианта ответа</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleQuestionTypeChange(qIdx, 'yes_no')}
                            className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                              q.questionType === 'yes_no'
                                ? 'bg-cyan-900/40 border-cyan-400 text-cyan-200 shadow-sm'
                                : 'bg-[#182124] border-gray-700 text-gray-400 hover:text-white'
                            }`}
                          >
                            <span>⚖️ Да / Нет</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleQuestionTypeChange(qIdx, 'free_input')}
                            className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                              q.questionType === 'free_input'
                                ? 'bg-cyan-900/40 border-cyan-400 text-cyan-200 shadow-sm'
                                : 'bg-[#182124] border-gray-700 text-gray-400 hover:text-white'
                            }`}
                          >
                            <span>✍️ Свободный ввод</span>
                          </button>
                        </div>
                      </div>

                      {/* Answer Input Section Based on Type */}
                      {q.questionType === 'four_options' && (
                        <div className="space-y-2 pt-1">
                          <div className="text-xs font-semibold text-gray-300 flex items-center justify-between">
                            <span>Варианты ответа (выберите правильный переключателем):</span>
                            <span className="text-[10px] text-cyan-400 font-mono">Правильный: {q.correctAnswer}</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {q.options?.map((opt, optIdx) => (
                              <div
                                key={optIdx}
                                className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${
                                  opt.isCorrect
                                    ? 'bg-emerald-950/40 border-emerald-500/60 shadow-sm'
                                    : 'bg-[#182124] border-gray-700'
                                }`}
                              >
                                <label className="flex items-center gap-1.5 cursor-pointer flex-shrink-0">
                                  <input
                                    type="radio"
                                    name={`q_${activeVariant}_${qIdx}_correct`}
                                    checked={opt.isCorrect === true}
                                    onChange={() => handleSelectCorrectOption(qIdx, optIdx)}
                                    className="accent-emerald-400 w-4 h-4 cursor-pointer"
                                  />
                                  <span className="font-bold text-xs text-white font-mono w-4">
                                    {opt.label}:
                                  </span>
                                </label>
                                <input
                                  type="text"
                                  value={opt.text}
                                  onFocus={() => setActiveTarget({ qIdx, field: 'option', optIdx })}
                                  onChange={(e) => handleOptionTextChange(qIdx, optIdx, e.target.value)}
                                  placeholder={`Текст варианта ${opt.label}...`}
                                  className="w-full bg-transparent border-0 text-xs text-white focus:outline-none placeholder-gray-500 font-sans"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {q.questionType === 'yes_no' && (
                        <div className="space-y-2 pt-1">
                          <label className="text-xs font-semibold text-gray-300">
                            Выберите правильный ответ:
                          </label>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => handleSelectYesNoCorrect(qIdx, true)}
                              className={`flex-1 py-2.5 rounded-lg border font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                                q.correctAnswer === 'Да'
                                  ? 'bg-emerald-600 text-white border-emerald-400 shadow-md'
                                  : 'bg-[#182124] border-gray-700 text-gray-400 hover:text-white'
                              }`}
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Да (Правильно)</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleSelectYesNoCorrect(qIdx, false)}
                              className={`flex-1 py-2.5 rounded-lg border font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                                q.correctAnswer === 'Нет'
                                  ? 'bg-emerald-600 text-white border-emerald-400 shadow-md'
                                  : 'bg-[#182124] border-gray-700 text-gray-400 hover:text-white'
                              }`}
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Нет (Правильно)</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {q.questionType === 'free_input' && (
                        <div className="space-y-2 pt-1">
                          <label className="text-xs font-semibold text-gray-300 flex items-center justify-between">
                            <span>Правильный ответ (число или формула):</span>
                            <span className="text-[10px] text-gray-400 font-mono font-normal">
                              Система сравнивает математически
                            </span>
                          </label>
                          <input
                            type="text"
                            value={q.correctAnswer || ''}
                            onFocus={() => setActiveTarget({ qIdx, field: 'free_input' })}
                            onChange={(e) => handleFreeInputAnswerChange(qIdx, e.target.value)}
                            placeholder="Например: 4.5 или 9/2"
                            className="w-full bg-[#182124] border border-gray-600 focus:border-cyan-400 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-400 font-mono"
                          />
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Add Question Button */}
                  <button
                    type="button"
                    onClick={handleAddQuestion}
                    className="w-full py-3 rounded-xl bg-[#243035] hover:bg-[#2b393f] border border-dashed border-cyan-500/50 text-cyan-300 font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Добавить вопрос к Варианту {activeVariant}</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-[#182124] border-t border-gray-700/60 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold transition-colors"
          >
            Отмена
          </button>

          <div className="flex items-center gap-2 flex-wrap">
            {onLaunchImmediately && (
              <button
                type="button"
                disabled={saving || loading}
                onClick={() => handleSave(true)}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
              >
                <span>Сохранить и запустить комнату</span>
              </button>
            )}

            <button
              type="button"
              disabled={saving || loading}
              onClick={() => handleSave(false)}
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-[#25718f] hover:from-cyan-400 hover:to-cyan-600 text-black font-extrabold text-xs transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Сохранение...' : 'Сохранить тест'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
