import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import {
  CheckCircle2,
  AlertTriangle,
  LogOut,
  Maximize2,
  GraduationCap,
  Clock,
  Send,
  Edit3,
} from 'lucide-react';
import { MathRenderer } from '../components/MathRenderer.js';
import { TimerDisplay } from '../components/TimerDisplay.js';
import { Modal } from '../components/Modal.js';
import { ExamWatermark } from '../components/ExamWatermark.js';
import { SecurityLockdownModal } from '../components/SecurityLockdownModal.js';
import { useAntiCheat } from '../hooks/useAntiCheat.js';
import { api, StudentStateResponse, QuestionData } from '../services/api.js';
import { useLanguage } from '../context/LanguageContext.js';
import { LanguageSelector } from '../components/LanguageSelector.js';

interface StudentQuizProps {
  gameId: string;
  studentId: number;
  socket: Socket | null;
  onFinished: (state: StudentStateResponse) => void;
  isProctorPreview?: boolean;
  onExitPreview?: () => void;
}

export const StudentQuiz: React.FC<StudentQuizProps> = ({
  gameId,
  studentId,
  socket,
  onFinished,
  isProctorPreview = false,
  onExitPreview,
}) => {
  const { t } = useLanguage();

  // State
  const [state, setState] = useState<StudentStateResponse | null>(null);
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [answers, setAnswers] = useState<Record<number, { selectedOptionId?: number; answerText?: string }>>({});
  const [savingMap, setSavingMap] = useState<Record<number, boolean>>({});
  const [savedMap, setSavedMap] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  // Modals & UI
  const [showFinishModal, setShowFinishModal] = useState<boolean>(false);
  const hasAutoFullscreenRef = useRef(false);

  // Anti-cheat & Security Hook (Completely deactivated in proctor preview mode)
  const {
    isFullscreen,
    isWindowBlurred,
    isScreenshotBlocked,
    requestFullscreen,
    clearBlur,
  } = useAntiCheat({
    gameId,
    studentId,
    socket: isProctorPreview ? null : socket,
    isActive: !isProctorPreview && !!state && state.gameStatus === 'IN_PROGRESS',
  });

  // Load state and all questions on mount
  useEffect(() => {
    loadState();
  }, [gameId, studentId]);

  // Attempt fullscreen on first user interaction if not fullscreen (skipped in proctor mode)
  useEffect(() => {
    if (isProctorPreview) return;
    const handleFirstClick = () => {
      if (!hasAutoFullscreenRef.current && !document.fullscreenElement) {
        hasAutoFullscreenRef.current = true;
        requestFullscreen().catch(() => {});
      }
    };
    window.addEventListener('click', handleFirstClick, { once: true });
    return () => {
      window.removeEventListener('click', handleFirstClick);
    };
  }, [requestFullscreen, isProctorPreview]);

  // Socket listener for exam finished
  useEffect(() => {
    if (!socket) return;
    const handleGameFinished = () => loadState();
    socket.on('game:finished', handleGameFinished);
    return () => {
      socket.off('game:finished', handleGameFinished);
    };
  }, [socket]);

  const loadState = async () => {
    try {
      const data = await api.getStudentState(gameId, studentId);
      setState(data);

      if (data.gameStatus === 'FINISHED' || data.student.status === 'FINISHED') {
        onFinished(data);
        return;
      }

      // Populate questions list
      if (data.questions && data.questions.length > 0) {
        setQuestions(data.questions);
      } else {
        const qList = await api.getAllQuestions(gameId, studentId);
        setQuestions(qList);
      }

      // Populate existing answers
      if (data.answeredMap) {
        setAnswers(data.answeredMap);
        const initialSaved: Record<number, boolean> = {};
        Object.keys(data.answeredMap).forEach((num) => {
          initialSaved[Number(num)] = true;
        });
        setSavedMap(initialSaved);
      }
    } catch (err: any) {
      setError(err.message || 'Xatolik yuz berdi');
    }
  };

  // Submit answer for multiple choice question immediately
  const handleSelectOption = async (questionNumber: number, optionId: number) => {
    const updated = {
      ...answers,
      [questionNumber]: { selectedOptionId: optionId },
    };
    setAnswers(updated);
    setSavingMap((prev) => ({ ...prev, [questionNumber]: true }));
    setError(null);

    try {
      await api.submitAnswer({
        gameId,
        studentId,
        questionNumber,
        selectedOptionId: optionId,
      });

      setSavedMap((prev) => ({ ...prev, [questionNumber]: true }));
      // Update answeredCount in state
      if (state) {
        setState({
          ...state,
          answeredMap: updated,
          answeredCount: Object.keys(updated).length,
        });
      }
    } catch (err: any) {
      setError(`№${questionNumber}: ${err.message || 'Javobni saqlab bo‘lmadi'}`);
    } finally {
      setSavingMap((prev) => ({ ...prev, [questionNumber]: false }));
    }
  };

  // Handle typing answer for short answer question
  const handleTextChange = (questionNumber: number, text: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionNumber]: {
        ...prev[questionNumber],
        answerText: text,
      },
    }));
    setSavedMap((prev) => ({ ...prev, [questionNumber]: false }));
  };

  // Submit short answer question
  const handleSaveTextAnswer = async (questionNumber: number) => {
    const text = (answers[questionNumber]?.answerText || '').trim();
    if (!text) return;

    setSavingMap((prev) => ({ ...prev, [questionNumber]: true }));
    setError(null);

    try {
      await api.submitAnswer({
        gameId,
        studentId,
        questionNumber,
        answerText: text,
      });

      setSavedMap((prev) => ({ ...prev, [questionNumber]: true }));
      if (state) {
        const updated = {
          ...answers,
          [questionNumber]: { answerText: text },
        };
        setState({
          ...state,
          answeredMap: updated,
          answeredCount: Object.keys(updated).length,
        });
      }
    } catch (err: any) {
      setError(`№${questionNumber}: ${err.message || 'Javobni saqlab bo‘lmadi'}`);
    } finally {
      setSavingMap((prev) => ({ ...prev, [questionNumber]: false }));
    }
  };

  // Scroll to question
  const scrollToQuestion = (questionNumber: number) => {
    const el = document.getElementById(`question-${questionNumber}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Confirm Finish Exam
  const handleConfirmFinish = async () => {
    setShowFinishModal(false);
    try {
      await api.finishStudentTest(gameId, studentId);
      await loadState();
    } catch (err: any) {
      setError(err.message || 'Xatolik yuz berdi');
    }
  };

  if (!state || questions.length === 0) {
    return (
      <div className="min-h-screen bg-[#f4f6f9] flex items-center justify-center p-4 text-gray-600">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-[#25718f] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono tracking-wider uppercase text-gray-500">
            {t.brand}...
          </span>
        </div>
      </div>
    );
  }

  const studentFullName = `${state.student.lastName} ${state.student.firstName}`;
  const totalQuestions = 20;
  const answeredCount = Object.keys(answers).filter(
    (k) => answers[Number(k)]?.selectedOptionId || answers[Number(k)]?.answerText?.trim()
  ).length;

  const multipleChoiceQuestions = questions.filter((q) => q.type === 'multiple_choice');
  const shortAnswerQuestions = questions.filter((q) => q.type === 'short_answer');

  return (
    <div className="min-h-screen bg-[#f4f6f9] text-[#222d32] flex flex-col font-sans select-none relative pb-24">
      {/* Dynamic Anti-Photo Security Watermark (Only active for real students) */}
      {!isProctorPreview && (
        <ExamWatermark
          studentName={studentFullName}
          studentId={state.student.studentId}
          formId={state.student.formId}
          gameCode={state.gameCode}
        />
      )}

      {/* Security Lockdown Modals (Fullscreen exit, blur, screenshot attempt) */}
      {!isProctorPreview && (
        <SecurityLockdownModal
          isFullscreen={isFullscreen}
          isWindowBlurred={isWindowBlurred}
          isScreenshotBlocked={isScreenshotBlocked}
          onRequestFullscreen={requestFullscreen}
          onFocusWindow={clearBlur}
        />
      )}

      {/* Fullscreen Prompt Top Banner (if not currently in fullscreen) */}
      {!isFullscreen && !isProctorPreview && (
        <div className="bg-amber-500 text-white px-4 py-2 text-xs font-mono flex items-center justify-between sticky top-0 z-30 shadow">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="font-semibold">{t.quizRule1}</span>
          </div>
          <button
            onClick={() => requestFullscreen()}
            className="px-3 py-1 rounded bg-white text-amber-800 font-bold hover:bg-amber-50 transition-colors flex items-center gap-1 shrink-0"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>{t.quizStartFullscreenBtn}</span>
          </button>
        </div>
      )}

      {/* Proctor Preview Mode Top Banner */}
      {isProctorPreview && (
        <div className="bg-[#1f5f79] text-white px-3 sm:px-4 py-2 text-xs font-mono flex flex-wrap items-center justify-between gap-2 sticky top-0 z-40 shadow border-b border-[#25718f]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-bold uppercase tracking-wider text-cyan-200">
              {t.proctorBannerTitle}
            </span>
            <span className="hidden md:inline text-cyan-100">
              • {t.proctorBannerSub}
            </span>
          </div>
          {onExitPreview && (
            <button
              onClick={onExitPreview}
              className="px-2.5 py-1 rounded bg-white text-[#25718f] hover:bg-cyan-50 font-bold transition-all flex items-center gap-1.5 shadow-sm ml-auto"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{t.proctorExitBtn}</span>
            </button>
          )}
        </div>
      )}

      {/* 1 & 2. Sticky Header and Quick Navigation Matrix */}
      <div className="sticky top-0 z-30 shadow-md">
        {/* HEMIS Top Header Bar */}
        <header className="bg-[#25718f] text-white px-3 sm:px-4 py-2 sm:py-2.5 border-b border-[#1f5f79]">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
            {/* Top row on mobile / Left group on desktop */}
            <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded bg-white/20 border border-white/30 flex items-center justify-center text-white shrink-0">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-cyan-200 font-semibold flex items-center gap-1.5">
                    <span>{t.quizTopBrand}</span>
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>{t.quizSubject}</span>
                    <span className="text-cyan-300">•</span>
                    <span className="text-cyan-100 font-mono">#{state.gameCode}</span>
                  </div>
                </div>
              </div>

              {/* Mobile Right Controls: Timer, Language & Finish */}
              <div className="flex sm:hidden items-center gap-1.5">
                {state.endsAt && (
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-white text-[#25718f] rounded shadow-sm font-bold text-xs font-mono">
                    <Clock className="w-3 h-3 text-[#25718f] shrink-0" />
                    <TimerDisplay
                      endsAt={state.endsAt}
                      serverTime={state.serverTime}
                      onExpire={() => loadState()}
                    />
                  </div>
                )}
                <LanguageSelector />
                <button
                  onClick={() => setShowFinishModal(true)}
                  className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold font-mono transition-colors flex items-center gap-1 shadow-sm shrink-0"
                  title={t.quizSubmitExamBtn}
                >
                  <LogOut className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Bottom row on mobile / Middle & Right groups on desktop */}
            <div className="flex items-center justify-between sm:justify-end gap-2 text-xs font-mono">
              {/* Student Identification Credentials */}
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded bg-[#1f5f79] border border-white/10 text-white truncate max-w-[140px] sm:max-w-none">
                  <span className="text-cyan-200 font-normal hidden sm:inline mr-1">{t.quizCandidateLabel}</span>
                  <strong className="text-white text-[11px] sm:text-xs">{studentFullName}</strong>
                </div>
                <div className="px-1.5 py-0.5 sm:px-2 sm:py-1 rounded bg-[#1f5f79] border border-white/10 text-cyan-200 font-bold text-[11px] sm:text-xs shrink-0">
                  ID #{String(studentId).padStart(2, '0')}
                </div>
                <div className="px-1.5 py-0.5 sm:px-2 sm:py-1 rounded bg-[#1f5f79] border border-white/10 text-cyan-200 font-bold text-[11px] sm:text-xs shrink-0">
                  №{String(state.student.formId).padStart(2, '0')}
                </div>
              </div>

              {/* Desktop Timer, Language selector & Finish button */}
              <div className="hidden sm:flex items-center gap-2">
                {state.endsAt && (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-white text-[#25718f] rounded shadow-sm font-bold text-xs">
                    <Clock className="w-3.5 h-3.5 text-[#25718f] shrink-0" />
                    <TimerDisplay
                      endsAt={state.endsAt}
                      serverTime={state.serverTime}
                      onExpire={() => loadState()}
                    />
                  </div>
                )}
                <LanguageSelector />
                <button
                  onClick={() => setShowFinishModal(true)}
                  className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold font-mono transition-colors flex items-center gap-1 shadow-sm shrink-0"
                  title={t.quizSubmitExamBtn}
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{t.quizSubmitExamBtn}</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* 2. Sticky Quick Navigation Bar (Questions 1 to 20 Matrix) */}
        <nav aria-label={t.quizSheetTitle} className="bg-white border-b border-gray-200 px-3 sm:px-4 py-2">
          <div className="max-w-6xl mx-auto space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono text-gray-600">
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="font-bold text-gray-800 uppercase tracking-wider text-[11px] sm:text-xs">
                  {t.quizSheetTitle}
                </span>
                <span className="font-semibold text-[11px] sm:text-xs">
                  {t.quizAnsweredCount} <strong className="text-emerald-600">{answeredCount}</strong> / {totalQuestions}
                </span>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-[11px]">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded bg-[#00a65a] inline-block" /> {t.quizLegendAnswered}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded border border-gray-300 bg-gray-100 inline-block" /> {t.quizLegendUnanswered}
                </span>
              </div>
            </div>

            {/* Matrix Buttons Row: 1 to 20 with horizontal scroll on mobile */}
            <div className="overflow-x-auto no-scrollbar py-0.5">
              <div className="flex items-center gap-1 sm:gap-1.5 min-w-max">
                {/* Part 1: Multiple choice (1..15) */}
                <span className="text-[10px] font-mono text-[#25718f] font-bold uppercase shrink-0 mr-0.5">
                  {t.quizPart1Label}
                </span>
                {multipleChoiceQuestions.map((q) => {
                  const isAnswered = !!answers[q.questionNumber]?.selectedOptionId;
                  const isSaving = savingMap[q.questionNumber];

                  return (
                    <button
                      key={q.questionNumber}
                      type="button"
                      onClick={() => scrollToQuestion(q.questionNumber)}
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded text-xs font-mono font-bold flex items-center justify-center shrink-0 transition-all ${
                        isSaving
                          ? 'bg-amber-400 text-white animate-pulse'
                          : isAnswered
                          ? 'bg-[#00a65a] text-white shadow-sm hover:bg-emerald-700'
                          : 'bg-gray-100 border border-gray-300 text-gray-700 hover:bg-gray-200'
                      }`}
                      title={`Savol №${q.questionNumber}${isAnswered ? ' (Saqlangan)' : ''}`}
                    >
                      {q.questionNumber}
                    </button>
                  );
                })}

                <div className="w-px h-5 sm:h-6 bg-gray-300 mx-1 shrink-0" />

                {/* Part 2: Short answer (16..20) */}
                <span className="text-[10px] font-mono text-purple-700 font-bold uppercase shrink-0 mr-0.5">
                  {t.quizPart2Label}
                </span>
                {shortAnswerQuestions.map((q) => {
                  const isAnswered = !!answers[q.questionNumber]?.answerText?.trim();
                  const isSaving = savingMap[q.questionNumber];

                  return (
                    <button
                      key={q.questionNumber}
                      type="button"
                      onClick={() => scrollToQuestion(q.questionNumber)}
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded text-xs font-mono font-bold flex items-center justify-center shrink-0 transition-all ${
                        isSaving
                          ? 'bg-amber-400 text-white animate-pulse'
                          : isAnswered
                          ? 'bg-[#00a65a] text-white shadow-sm hover:bg-emerald-700'
                          : 'bg-purple-50 border border-purple-200 text-purple-800 hover:bg-purple-100'
                      }`}
                      title={`Savol №${q.questionNumber}${isAnswered ? ' (Saqlangan)' : ''}`}
                    >
                      {q.questionNumber}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </nav>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="max-w-4xl w-full mx-auto px-4 mt-3">
          <div className="p-3 rounded bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
            <span className="font-semibold">{error}</span>
          </div>
        </div>
      )}

      {/* 3. Main Examination Sheet: All 20 Questions Visible */}
      <main className="max-w-4xl w-full mx-auto px-4 py-6 space-y-8">
        {/* SECTION 1: 15 Multiple Choice Questions (№ 1 - № 15) */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b-2 border-[#25718f] pb-2">
            <span className="w-3 h-3 rounded-full bg-[#25718f]" />
            <h2 className="text-sm sm:text-base font-black text-gray-900 tracking-tight uppercase font-mono">
              {t.quizSection1Header}
            </h2>
          </div>

          <div className="space-y-4">
            {multipleChoiceQuestions.map((q) => {
              const selectedOptId = answers[q.questionNumber]?.selectedOptionId;
              const isSaved = savedMap[q.questionNumber] && !!selectedOptId;
              const isSaving = savingMap[q.questionNumber];

              return (
                <div
                  key={q.questionNumber}
                  id={`question-${q.questionNumber}`}
                  className={`bg-white border rounded-lg p-5 sm:p-6 shadow-sm space-y-4 transition-all scroll-mt-32 ${
                    isSaved ? 'border-emerald-300 ring-1 ring-emerald-200' : 'border-gray-200'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2 text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded bg-[#25718f] text-white font-bold text-xs">
                        № {String(q.questionNumber).padStart(2, '0')}
                      </span>
                      <span className="text-gray-500 font-semibold">{t.quizPart1Type}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 font-mono">{t.quizPointVal}</span>
                      {isSaving ? (
                        <span className="text-amber-600 font-bold flex items-center gap-1 text-[11px]">
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                          {t.quizSaving}
                        </span>
                      ) : isSaved ? (
                        <span className="text-emerald-700 font-bold flex items-center gap-1 text-[11px] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          {t.quizAutoSaved}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-[11px]">{t.quizNotAnswered}</span>
                      )}
                    </div>
                  </div>

                  {/* Question Text with KaTeX formulas */}
                  <div className="text-base sm:text-lg font-semibold text-gray-900 leading-relaxed">
                    <MathRenderer content={q.text} />
                  </div>

                  {/* 4 Clickable Option Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    {q.options?.map((opt) => {
                      const isSelected = selectedOptId === opt.id;

                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleSelectOption(q.questionNumber, opt.id)}
                          className={`p-3.5 rounded-lg border text-left flex items-center gap-3 transition-all ${
                            isSelected
                              ? 'border-[#25718f] bg-cyan-50/50 ring-2 ring-[#25718f]/30 shadow-sm text-gray-900'
                              : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 text-gray-800'
                          }`}
                        >
                          <div
                            className={`w-7 h-7 rounded font-mono text-xs font-bold flex items-center justify-center shrink-0 border transition-colors ${
                              isSelected
                                ? 'bg-[#25718f] border-[#25718f] text-white'
                                : 'bg-gray-100 border-gray-300 text-gray-700'
                            }`}
                          >
                            {opt.label}
                          </div>
                          <div className="text-sm font-medium flex-1">
                            <MathRenderer content={opt.text} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* SECTION 2: 5 Short Answer Questions (№ 16 - № 20) */}
        <section className="space-y-4 pt-2">
          <div className="flex items-center gap-2 border-b-2 border-purple-700 pb-2">
            <span className="w-3 h-3 rounded-full bg-purple-700" />
            <h2 className="text-sm sm:text-base font-black text-gray-900 tracking-tight uppercase font-mono">
              {t.quizSection2Header}
            </h2>
          </div>

          <div className="space-y-4">
            {shortAnswerQuestions.map((q) => {
              const currentVal = answers[q.questionNumber]?.answerText || '';
              const isSaved = savedMap[q.questionNumber] && !!currentVal.trim();
              const isSaving = savingMap[q.questionNumber];

              return (
                <div
                  key={q.questionNumber}
                  id={`question-${q.questionNumber}`}
                  className={`bg-white border rounded-lg p-5 sm:p-6 shadow-sm space-y-4 transition-all scroll-mt-32 ${
                    isSaved ? 'border-purple-300 ring-1 ring-purple-200' : 'border-gray-200'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2 text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded bg-purple-700 text-white font-bold text-xs">
                        № {String(q.questionNumber).padStart(2, '0')}
                      </span>
                      <span className="text-purple-900 font-semibold">{t.quizPart2Type}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 font-mono">{t.quizPointVal}</span>
                      {isSaving ? (
                        <span className="text-amber-600 font-bold flex items-center gap-1 text-[11px]">
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                          {t.quizSaving}
                        </span>
                      ) : isSaved ? (
                        <span className="text-purple-700 font-bold flex items-center gap-1 text-[11px] bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
                          {t.quizAutoSaved}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-[11px]">{t.quizNotAnswered}</span>
                      )}
                    </div>
                  </div>

                  {/* Question Text with KaTeX formulas */}
                  <div className="text-base sm:text-lg font-semibold text-gray-900 leading-relaxed">
                    <MathRenderer content={q.text} />
                  </div>

                  {/* Short Answer Input Field */}
                  <div className="pt-1 space-y-2">
                    <div className="text-xs font-mono text-gray-500 flex items-center gap-1">
                      <Edit3 className="w-3.5 h-3.5 text-purple-700" />
                      <span>{t.quizShortAnswerHint}</span>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <input
                        type="text"
                        inputMode="text"
                        autoCapitalize="off"
                        autoCorrect="off"
                        spellCheck={false}
                        value={currentVal}
                        onChange={(e) => handleTextChange(q.questionNumber, e.target.value)}
                        onBlur={() => handleSaveTextAnswer(q.questionNumber)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveTextAnswer(q.questionNumber);
                          }
                        }}
                        placeholder={t.quizShortAnswerPlaceholder}
                        className="flex-1 px-3 sm:px-4 py-2.5 rounded border border-gray-300 font-mono text-base font-bold text-gray-900 placeholder:text-gray-400 focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-200 bg-white"
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveTextAnswer(q.questionNumber)}
                        disabled={isSaving || !currentVal.trim()}
                        className="w-full sm:w-auto py-2.5 px-5 rounded bg-purple-700 hover:bg-purple-800 active:scale-98 text-white font-bold text-xs uppercase tracking-wider font-mono shadow flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{t.quizSaveAnswer}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* 4. Sticky Bottom Submission Bar */}
      <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-sm border-t border-gray-300 p-2.5 sm:p-4 z-20 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="w-2.5 h-2.5 rounded-full bg-[#00a65a]" />
              <span className="text-xs font-mono font-bold text-gray-800">
                {answeredCount}/{totalQuestions}
              </span>
            </div>
            <div className="w-16 sm:w-36 h-2 bg-gray-200 rounded-full overflow-hidden shrink-0">
              <div
                className="h-full bg-[#00a65a] transition-all duration-300"
                style={{ width: `${Math.round((answeredCount / totalQuestions) * 100)}%` }}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowFinishModal(true)}
            className="py-2 sm:py-2.5 px-3 sm:px-6 rounded bg-[#25718f] hover:bg-[#1f5f79] active:scale-98 text-white font-bold text-xs font-mono uppercase tracking-wider shadow flex items-center gap-1.5 shrink-0 transition-all"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{t.quizSubmitExamBtn} ({answeredCount}/{totalQuestions})</span>
          </button>
        </div>
      </div>

      {/* Confirmation Modal: Finish Exam */}
      <Modal
        isOpen={showFinishModal}
        onClose={() => setShowFinishModal(false)}
        title={t.quizFinishModalTitle}
        variant="danger"
        confirmText={t.quizFinishModalConfirm}
        cancelText={t.quizFinishModalCancel}
        onConfirm={handleConfirmFinish}
      >
        <div className="space-y-3 font-sans text-sm text-gray-700">
          <p>{t.quizFinishModalText}</p>
          <div className="p-3 bg-gray-50 border border-gray-200 rounded text-xs font-mono text-gray-600 space-y-1">
            <div>
              • {t.quizFinishModalAnswered} <strong className="text-gray-900">{answeredCount}</strong> / {totalQuestions}
            </div>
            <div>
              • {t.quizFinishModalUnanswered} <strong className="text-amber-700">{totalQuestions - answeredCount}</strong>
            </div>
            <div>• {t.quizFinishModalScale}</div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
