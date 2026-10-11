import React, { useState, useEffect, useRef } from 'react';
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
  ArrowLeft,
  Rocket,
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
  const [activeQuestionIndex, setActiveQuestionIndex] = useState<number>(0);

  // Active target for math toolbar insertion
  const [activeTarget, setActiveTarget] = useState<{
    qIdx: number;
    field: 'question' | 'option' | 'free_input';
    optIdx?: number;
  } | null>(null);

  const questionRefs = useRef<(HTMLDivElement | null)[]>([]);

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
      setActiveQuestionIndex(0);
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
      setActiveQuestionIndex(0);
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки теста');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const currentQuestions = variantQuestions[activeVariant] || [];

  const scrollToQuestion = (idx: number) => {
    setActiveQuestionIndex(idx);
    const target = questionRefs.current[idx];
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

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
    setActiveQuestionIndex(0);
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
      setActiveQuestionIndex(0);
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
      !confirm(`Заменить вопросы Варианта ${activeVariant} полной копией из Варианта 1?`)
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
    const newIdx = currentQuestions.length;
    const newQ: CustomQuestionItem = {
      variantNumber: activeVariant,
      questionNumber: newIdx + 1,
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

    setTimeout(() => {
      scrollToQuestion(newIdx);
    }, 50);
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

    if (activeQuestionIndex >= renumbered.length) {
      setActiveQuestionIndex(Math.max(0, renumbered.length - 1));
    }
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
      setError('Укажите время проведения теста от 1 до 180 минут.');
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
          scrollToQuestion(i);
          return;
        }

        if (q.questionType === 'four_options') {
          const opts = q.options || [];
          if (opts.length !== 4) {
            setError(`Вариант ${vNum}, Вопрос №${qNum}: заполните все 4 варианта ответа.`);
            setActiveVariant(vNum);
            scrollToQuestion(i);
            return;
          }
          for (let j = 0; j < opts.length; j++) {
            if (!opts[j].text.trim()) {
              setError(`Вариант ${vNum}, Вопрос №${qNum}, вариант ${opts[j].label}: введите текст ответа.`);
              setActiveVariant(vNum);
              scrollToQuestion(i);
              return;
            }
          }
          if (!opts.some((o) => o.isCorrect)) {
            setError(`Вариант ${vNum}, Вопрос №${qNum}: отметьте правильный вариант ответа.`);
            setActiveVariant(vNum);
            scrollToQuestion(i);
            return;
          }
        } else if (q.questionType === 'yes_no') {
          if (!q.correctAnswer) {
            setError(`Вариант ${vNum}, Вопрос №${qNum}: выберите верный ответ (Да или Нет).`);
            setActiveVariant(vNum);
            scrollToQuestion(i);
            return;
          }
        } else if (q.questionType === 'free_input') {
          if (!q.correctAnswer?.trim()) {
            setError(`Вариант ${vNum}, Вопрос №${qNum}: укажите эталонный ответ для проверки.`);
            setActiveVariant(vNum);
            scrollToQuestion(i);
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

  const totalQuestionsAllVariants = Object.values(variantQuestions).reduce(
    (acc, list) => acc + list.length,
    0
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#0c121e] text-slate-100 flex flex-col h-screen w-screen overflow-hidden select-none font-sans animate-fade-in">
      {/* ==================================================== */}
      {/* 1. TOP FULLSCREEN STUDIO HEADER */}
      {/* ==================================================== */}
      <header className="h-16 sm:h-20 bg-[#111928] border-b border-slate-800/80 px-4 sm:px-6 flex items-center justify-between gap-4 flex-shrink-0 z-20 shadow-md">
        {/* Left: Close & Title input */}
        <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all flex items-center gap-1.5 flex-shrink-0 border border-slate-700/60"
            title="Закрыть редактор"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden md:inline text-xs font-semibold">К панели</span>
          </button>

          <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400 font-mono bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/60 w-fit flex-shrink-0 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span>СТУДИЯ ТЕСТОВ</span>
            </span>

            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Введите название теста (например: Контрольная работа по геометрии)..."
              className="w-full max-w-xl bg-slate-900/90 border border-slate-700 focus:border-cyan-400 rounded-xl px-3.5 py-1.5 sm:py-2 text-sm sm:text-base font-bold text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-400 transition-all truncate"
            />
          </div>
        </div>

        {/* Center: Duration & Totals */}
        <div className="hidden lg:flex items-center gap-3 bg-slate-900/70 border border-slate-800 rounded-xl px-3.5 py-1.5 flex-shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-300 font-semibold">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span>Время:</span>
            <input
              type="number"
              min={1}
              max={180}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              className="w-14 bg-slate-800 border border-slate-700 focus:border-cyan-400 rounded-lg px-2 py-1 text-center text-xs font-bold text-white font-mono focus:outline-none"
            />
            <span className="text-slate-400">мин</span>
          </div>

          <div className="h-4 w-px bg-slate-800" />

          {/* Quick presets */}
          <div className="flex items-center gap-1">
            {[15, 30, 45, 60].map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => setDurationMinutes(String(mins))}
                className={`text-[11px] px-2 py-0.5 rounded transition-colors font-mono font-semibold ${
                  durationMinutes === String(mins)
                    ? 'bg-cyan-500 text-slate-950 font-black'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                {mins}м
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-slate-800" />
          <span className="text-[11px] font-mono text-slate-400">
            Вопросов: <strong className="text-cyan-400">{totalQuestionsAllVariants}</strong>
          </span>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {/* Formula preview toggle */}
          <button
            type="button"
            onClick={() => setShowFormulaPreview(!showFormulaPreview)}
            className={`p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
              showFormulaPreview
                ? 'bg-cyan-950/60 border-cyan-500/50 text-cyan-300'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
            }`}
            title="Переключить предпросмотр математических формул"
          >
            {showFormulaPreview ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            <span className="hidden sm:inline">Формулы</span>
          </button>

          {/* Save & Launch Button */}
          {onLaunchImmediately && (
            <button
              type="button"
              disabled={saving || loading}
              onClick={() => handleSave(true)}
              className="px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs sm:text-sm transition-all shadow-lg flex items-center gap-1.5 disabled:opacity-50"
            >
              <Rocket className="w-4 h-4" />
              <span className="hidden md:inline">Запустить сейчас</span>
            </button>
          )}

          {/* Primary Save Button */}
          <button
            type="button"
            disabled={saving || loading}
            onClick={() => handleSave(false)}
            className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 via-teal-400 to-[#25718f] hover:from-cyan-400 hover:to-teal-300 active:scale-95 text-slate-950 font-black text-xs sm:text-sm transition-all shadow-xl flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Сохранение...' : 'Сохранить тест'}</span>
          </button>
        </div>
      </header>

      {/* ==================================================== */}
      {/* 2. STUDIO WORKSPACE BODY (LEFT RAIL + MAIN CANVAS) */}
      {/* ==================================================== */}
      <div className="flex-1 flex overflow-hidden">
        {/* Error Notification Bar if any */}
        {error && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 max-w-xl w-[90%] p-3.5 bg-red-950/90 border border-red-500 text-red-200 text-xs sm:text-sm rounded-xl shadow-2xl flex items-center justify-between gap-3 animate-shake backdrop-blur-md">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="p-1 rounded hover:bg-red-900/60 text-red-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* LEFT STUDIO RAIL: VARIANTS & QUESTION JUMP LIST */}
        <aside className="w-72 sm:w-80 bg-[#111928] border-r border-slate-800/80 flex flex-col flex-shrink-0 overflow-hidden">
          {/* Variants Block */}
          <div className="p-4 border-b border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-300">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span>Варианты ({variants.length})</span>
              </div>

              {activeVariant !== 1 && (
                <button
                  type="button"
                  onClick={handleCopyFromVariant1}
                  className="text-[11px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 flex items-center gap-1 transition-colors"
                  title="Скопировать вопросы из Варианта 1"
                >
                  <Copy className="w-3 h-3" />
                  <span>Копия из В1</span>
                </button>
              )}
            </div>

            {/* Variant Pills Grid */}
            <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1 scrollbar-thin">
              {variants.map((vNum) => {
                const count = variantQuestions[vNum]?.length || 0;
                const isActive = activeVariant === vNum;
                return (
                  <div
                    key={vNum}
                    onClick={() => {
                      setActiveVariant(vNum);
                      setActiveQuestionIndex(0);
                    }}
                    className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-cyan-600/90 to-[#25718f]/90 text-white border-cyan-400 shadow-md font-bold'
                        : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="text-xs">Вариант {vNum}</span>
                      <span className="text-[10px] font-mono text-cyan-300/80">{count} вопр.</span>
                    </div>

                    {variants.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteVariant(vNum);
                        }}
                        className="p-1 rounded hover:bg-red-500/30 text-slate-400 hover:text-red-300 transition-colors"
                        title={`Удалить Вариант ${vNum}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}

              <button
                type="button"
                onClick={handleAddVariant}
                className="p-2.5 rounded-xl bg-slate-900/50 hover:bg-slate-800 border border-dashed border-cyan-500/40 text-cyan-400 text-xs font-semibold flex items-center justify-center gap-1 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Вариант</span>
              </button>
            </div>
          </div>

          {/* Questions Outline Jump List */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 pb-2 flex items-center justify-between text-xs text-slate-400 font-semibold border-b border-slate-800/40">
              <span className="uppercase tracking-wider text-[11px] font-mono text-cyan-300">
                Вопросы Варианта {activeVariant}
              </span>
              <span className="font-mono text-[11px] bg-slate-800 px-2 py-0.5 rounded-full text-slate-300">
                {currentQuestions.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1.5 scrollbar-thin">
              {currentQuestions.map((q, idx) => {
                const isSelected = activeQuestionIndex === idx;
                const isFilled = Boolean(q.questionText.trim());
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => scrollToQuestion(idx)}
                    className={`w-full text-left p-2.5 rounded-xl border flex items-center gap-2.5 transition-all text-xs ${
                      isSelected
                        ? 'bg-slate-800 text-white border-cyan-500 shadow-sm font-semibold'
                        : 'bg-slate-900/60 text-slate-400 border-slate-800/80 hover:bg-slate-850 hover:text-slate-200'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-mono font-bold flex-shrink-0 ${
                        isSelected
                          ? 'bg-cyan-500 text-slate-950 font-black'
                          : isFilled
                          ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-500/40'
                          : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span className="truncate flex-1">
                      {q.questionText ? q.questionText : <span className="italic text-slate-500">(Пустой вопрос)</span>}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      {q.questionType === 'four_options' ? '4 вар.' : q.questionType === 'yes_no' ? 'Да/Нет' : 'Ввод'}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Add question bottom button in sidebar */}
            <div className="p-3 border-t border-slate-800/80 bg-slate-900/50">
              <button
                type="button"
                onClick={handleAddQuestion}
                className="w-full py-2.5 rounded-xl bg-cyan-950/70 hover:bg-cyan-900/80 border border-cyan-500/40 text-cyan-300 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Добавить вопрос</span>
              </button>
            </div>
          </div>
        </aside>

        {/* MAIN STUDIO CANVAS (WIDE & COMFORTABLE FULLSCREEN VIEW) */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8 bg-[#0c121e]">
          <div className="max-w-4xl mx-auto space-y-6 pb-20">
            {/* Top Canvas Information Card */}
            <div className="bg-[#111928] border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#25718f] to-cyan-400 flex items-center justify-center text-slate-950 font-black text-xl shadow-lg">
                  {activeVariant}
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
                    Вариант №{activeVariant}
                    <span className="text-xs bg-cyan-950 border border-cyan-500/40 text-cyan-300 px-2 py-0.5 rounded-full font-mono">
                      {currentQuestions.length} вопросов
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Ученики будут получать варианты автоматически по кругу (1, 2, 1, 2...)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddQuestion}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs flex items-center gap-1.5 border border-slate-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Добавить вопрос</span>
                </button>
              </div>
            </div>

            {/* Questions List in Canvas */}
            {currentQuestions.map((q, qIdx) => (
              <div
                key={qIdx}
                ref={(el) => (questionRefs.current[qIdx] = el)}
                onFocus={() => setActiveQuestionIndex(qIdx)}
                className={`bg-[#111928] border rounded-2xl p-5 sm:p-6 space-y-5 transition-all shadow-md ${
                  activeQuestionIndex === qIdx
                    ? 'border-cyan-500/70 ring-1 ring-cyan-500/30'
                    : 'border-slate-800 hover:border-slate-750'
                }`}
              >
                {/* Question Card Top Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3.5">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-[#25718f] text-slate-950 font-black text-sm flex items-center justify-center font-mono shadow-md">
                      #{qIdx + 1}
                    </span>
                    <span className="text-sm font-black text-white tracking-wide">
                      Вопрос №{qIdx + 1}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      (Вариант {activeVariant})
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Points field */}
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono bg-slate-900/80 px-2.5 py-1 rounded-xl border border-slate-800">
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
                        className="w-12 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-center text-xs text-white font-bold"
                      />
                    </div>

                    {/* Delete question button */}
                    <button
                      type="button"
                      onClick={() => handleRemoveQuestion(qIdx)}
                      className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-red-950/60 text-slate-400 hover:text-red-300 transition-colors border border-slate-700/60"
                      title="Удалить вопрос"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Question Textarea with Desmos Math Toolbar */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                      <span>Текст задания:</span>
                      <span className="text-red-400">*</span>
                    </label>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {'Формулы оборачивайте в $...$ (например: $\\sqrt{x} + \\frac{1}{2}$)'}
                    </span>
                  </div>

                  <textarea
                    rows={3}
                    value={q.questionText}
                    onFocus={() => {
                      setActiveQuestionIndex(qIdx);
                      setActiveTarget({ qIdx, field: 'question' });
                    }}
                    onChange={(e) => handleQuestionTextChange(qIdx, e.target.value)}
                    placeholder="Введите текст вопроса. Например: Вычислите площадь треугольника со сторонами $a=3$ и $b=4$..."
                    className="w-full bg-[#0c121e] border border-slate-700 focus:border-cyan-400 rounded-xl p-3.5 text-sm sm:text-base text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-400 transition-all font-sans leading-relaxed"
                  />

                  {/* High-Contrast Desmos Math Toolbar */}
                  <div className="bg-[#0e1626] border border-cyan-900/50 rounded-xl p-3 shadow-inner">
                    <div className="text-[10px] uppercase font-bold text-cyan-400 mb-2 flex items-center gap-1.5 font-mono">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Панель математических символов и формул (Desmos / KaTeX):</span>
                    </div>
                    <MathToolbar
                      compact={false}
                      onInsert={(snippet) => handleInsertMath(qIdx, snippet)}
                    />
                  </div>

                  {/* Formula Live Preview */}
                  {showFormulaPreview && q.questionText && (
                    <div className="p-3.5 rounded-xl bg-[#090d15] border border-cyan-800/40 text-sm text-cyan-100 shadow-inner">
                      <span className="text-[10px] uppercase font-mono font-bold text-slate-400 block mb-1">
                        Живой предпросмотр задания:
                      </span>
                      <MathRenderer content={q.questionText} />
                    </div>
                  )}
                </div>

                {/* Question Type Selection */}
                <div className="space-y-2 pt-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Формат ответа:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleQuestionTypeChange(qIdx, 'four_options')}
                      className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                        q.questionType === 'four_options'
                          ? 'bg-gradient-to-r from-cyan-950/80 to-[#25718f]/40 border-cyan-400 text-cyan-200 shadow-md ring-1 ring-cyan-500/30'
                          : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      <span>🔘 4 варианта (Тест A, B, C, D)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleQuestionTypeChange(qIdx, 'yes_no')}
                      className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                        q.questionType === 'yes_no'
                          ? 'bg-gradient-to-r from-cyan-950/80 to-[#25718f]/40 border-cyan-400 text-cyan-200 shadow-md ring-1 ring-cyan-500/30'
                          : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      <span>⚖️ Да / Нет (Верно / Неверно)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleQuestionTypeChange(qIdx, 'free_input')}
                      className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                        q.questionType === 'free_input'
                          ? 'bg-gradient-to-r from-cyan-950/80 to-[#25718f]/40 border-cyan-400 text-cyan-200 shadow-md ring-1 ring-cyan-500/30'
                          : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      <span>✍️ Свободный ввод (Число / Формула)</span>
                    </button>
                  </div>
                </div>

                {/* Detailed Answer Configuration */}
                {q.questionType === 'four_options' && (
                  <div className="space-y-3 pt-2 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-300">
                        Варианты ответа (отметьте кружком правильный):
                      </span>
                      <span className="font-mono text-cyan-400 font-bold">
                        Правильный: {q.correctAnswer}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {q.options?.map((opt, optIdx) => (
                        <div
                          key={optIdx}
                          className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all ${
                            opt.isCorrect
                              ? 'bg-emerald-950/50 border-emerald-500 text-white shadow-md ring-1 ring-emerald-500/30'
                              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <label className="flex items-center gap-2 cursor-pointer flex-shrink-0">
                            <input
                              type="radio"
                              name={`studio_q_${activeVariant}_${qIdx}_correct`}
                              checked={opt.isCorrect === true}
                              onChange={() => handleSelectCorrectOption(qIdx, optIdx)}
                              className="accent-emerald-400 w-4 h-4 cursor-pointer"
                            />
                            <span className="font-black text-sm font-mono w-4 text-cyan-300">
                              {opt.label}:
                            </span>
                          </label>

                          <input
                            type="text"
                            value={opt.text}
                            onFocus={() => {
                              setActiveQuestionIndex(qIdx);
                              setActiveTarget({ qIdx, field: 'option', optIdx });
                            }}
                            onChange={(e) => handleOptionTextChange(qIdx, optIdx, e.target.value)}
                            placeholder={`Введите текст варианта ${opt.label}...`}
                            className="w-full bg-transparent border-0 text-sm text-white focus:outline-none placeholder-slate-500 font-sans"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {q.questionType === 'yes_no' && (
                  <div className="space-y-2.5 pt-2 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                    <span className="text-xs font-bold text-slate-300 block">
                      Выберите эталонный ответ:
                    </span>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => handleSelectYesNoCorrect(qIdx, true)}
                        className={`py-3.5 rounded-xl border font-black text-sm flex items-center justify-center gap-2 transition-all ${
                          q.correctAnswer === 'Да'
                            ? 'bg-emerald-600 text-white border-emerald-400 shadow-lg ring-2 ring-emerald-400/30'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <CheckCircle2 className="w-5 h-5" />
                        <span>Да (Верно)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSelectYesNoCorrect(qIdx, false)}
                        className={`py-3.5 rounded-xl border font-black text-sm flex items-center justify-center gap-2 transition-all ${
                          q.correctAnswer === 'Нет'
                            ? 'bg-emerald-600 text-white border-emerald-400 shadow-lg ring-2 ring-emerald-400/30'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <CheckCircle2 className="w-5 h-5" />
                        <span>Нет (Неверно)</span>
                      </button>
                    </div>
                  </div>
                )}

                {q.questionType === 'free_input' && (
                  <div className="space-y-2.5 pt-2 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-300">
                        Правильный эталонный ответ (число или формула):
                      </span>
                      <span className="text-slate-400 font-mono text-[11px]">
                        Сервер автоматически сравнивает эквивалентные дроби и степени
                      </span>
                    </div>

                    <input
                      type="text"
                      value={q.correctAnswer || ''}
                      onFocus={() => {
                        setActiveQuestionIndex(qIdx);
                        setActiveTarget({ qIdx, field: 'free_input' });
                      }}
                      onChange={(e) => handleFreeInputAnswerChange(qIdx, e.target.value)}
                      placeholder="Например: 4.5 или 9/2 или \sqrt{2}"
                      className="w-full bg-[#0c121e] border border-slate-700 focus:border-cyan-400 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 font-mono focus:outline-none focus:ring-1 focus:ring-cyan-400"
                    />

                    {q.correctAnswer && (
                      <div className="p-2.5 rounded-lg bg-cyan-950/50 border border-cyan-800/40 text-xs text-cyan-200 flex items-center gap-2">
                        <span className="font-mono text-slate-400 font-bold uppercase text-[10px]">
                          Вид ответа:
                        </span>
                        <MathRenderer content={q.correctAnswer} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Big Add Question Button at Bottom of Canvas */}
            <button
              type="button"
              onClick={handleAddQuestion}
              className="w-full py-5 rounded-2xl bg-[#111928] hover:bg-slate-800/80 border-2 border-dashed border-cyan-500/50 text-cyan-300 font-black text-sm flex items-center justify-center gap-2.5 transition-all shadow-md group"
            >
              <div className="w-8 h-8 rounded-full bg-cyan-500/20 group-hover:bg-cyan-500 text-cyan-300 group-hover:text-slate-950 flex items-center justify-center transition-colors">
                <Plus className="w-5 h-5" />
              </div>
              <span>Добавить следующий вопрос к Варианту {activeVariant}</span>
            </button>
          </div>
        </main>
      </div>
    </div>
  );
};
