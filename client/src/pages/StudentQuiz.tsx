import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import {
  ShieldCheck,
  Send,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  LogOut,
  Maximize2,
  Lock,
  FileText,
  Clock,
} from 'lucide-react';
import { MathRenderer } from '../components/MathRenderer.js';
import { TimerDisplay } from '../components/TimerDisplay.js';
import { Modal } from '../components/Modal.js';
import { ExamWatermark } from '../components/ExamWatermark.js';
import { SecurityLockdownModal } from '../components/SecurityLockdownModal.js';
import { useAntiCheat } from '../hooks/useAntiCheat.js';
import { api, StudentStateResponse, QuestionData } from '../services/api.js';

interface StudentQuizProps {
  gameId: string;
  studentId: number;
  socket: Socket | null;
  onFinished: (state: StudentStateResponse) => void;
}

export const StudentQuiz: React.FC<StudentQuizProps> = ({
  gameId,
  studentId,
  socket,
  onFinished,
}) => {
  // State
  const [state, setState] = useState<StudentStateResponse | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionData | null>(null);
  const [currentNumber, setCurrentNumber] = useState<number>(1);
  const [selectedOptionId, setSelectedOptionId] = useState<number | null>(null);
  const [answerText, setAnswerText] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Modals & Proctoring
  const [showFinishModal, setShowFinishModal] = useState<boolean>(false);
  const [hasStartedFullscreen, setHasStartedFullscreen] = useState<boolean>(false);

  // Anti-cheat & Security Hook
  const {
    isFullscreen,
    isWindowBlurred,
    isScreenshotBlocked,
    requestFullscreen,
    clearBlur,
  } = useAntiCheat({
    gameId,
    studentId,
    socket,
    isActive: !!state && state.gameStatus === 'IN_PROGRESS' && hasStartedFullscreen,
  });

  // Load state on mount
  useEffect(() => {
    loadState();
  }, [gameId, studentId]);

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

      const qNum = data.currentQuestionNumber;
      setCurrentNumber(qNum);

      if (data.currentQuestion) {
        setCurrentQuestion(data.currentQuestion);
      } else {
        loadQuestion(qNum, data);
      }

      // Restore answer state if answered
      if (data.answeredMap && data.answeredMap[qNum]) {
        setSelectedOptionId(data.answeredMap[qNum].selectedOptionId || null);
        setAnswerText(data.answeredMap[qNum].answerText || '');
      } else {
        setSelectedOptionId(null);
        setAnswerText('');
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки состояния экзамена');
    }
  };

  const loadQuestion = async (num: number, currentState = state) => {
    try {
      setError(null);
      const q = await api.getQuestion(gameId, studentId, num);
      setCurrentQuestion(q);
      setCurrentNumber(num);

      if (currentState?.answeredMap && currentState.answeredMap[num]) {
        setSelectedOptionId(currentState.answeredMap[num].selectedOptionId || null);
        setAnswerText(currentState.answeredMap[num].answerText || '');
      } else {
        setSelectedOptionId(null);
        setAnswerText('');
      }
    } catch (err: any) {
      setError(err.message || 'Не удалось загрузить задание');
    }
  };

  // Submit answer
  const handleSubmitAnswer = async () => {
    if (!currentQuestion) return;

    if (currentQuestion.type === 'multiple_choice' && !selectedOptionId) {
      setError('Выберите один из вариантов ответа для фиксации в бланке');
      return;
    }

    if (currentQuestion.type === 'short_answer' && !answerText.trim()) {
      setError('Введите полученный ответ в поле ввода');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await api.submitAnswer({
        gameId,
        studentId,
        questionNumber: currentNumber,
        selectedOptionId: selectedOptionId || undefined,
        answerText: answerText.trim() || undefined,
      });

      // Update local state answered map
      if (state) {
        const updatedMap = {
          ...state.answeredMap,
          [currentNumber]: {
            selectedOptionId: selectedOptionId || undefined,
            answerText: answerText.trim() || undefined,
          },
        };
        const newCount = Object.keys(updatedMap).length;
        setState({
          ...state,
          answeredMap: updatedMap,
          answeredCount: newCount,
        });
      }

      if (res.isFinished) {
        await api.finishStudentTest(gameId, studentId);
        await loadState();
        return;
      }

      // Advance to next question if available
      if (res.nextQuestionNumber) {
        await loadQuestion(res.nextQuestionNumber);
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка сохранения ответа');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmFinish = async () => {
    setShowFinishModal(false);
    try {
      await api.finishStudentTest(gameId, studentId);
      await loadState();
    } catch (err: any) {
      setError(err.message || 'Ошибка завершения экзамена');
    }
  };

  const handleStartExamFullscreen = async () => {
    await requestFullscreen();
    setHasStartedFullscreen(true);
  };

  if (!state || !currentQuestion) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-slate-300">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono tracking-wider uppercase text-slate-400">
            Загрузка экзаменационных материалов КИМ...
          </span>
        </div>
      </div>
    );
  }

  // Pre-exam Fullscreen Lockdown Modal
  if (!hasStartedFullscreen) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 select-none">
        <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl p-6 sm:p-8 text-center shadow-2xl space-y-6">
          {/* Emblem */}
          <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Lock className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="text-[11px] font-mono font-bold text-blue-400 uppercase tracking-widest px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 rounded-md">
              РЕЖИМ СТРОГОГО КОНТРОЛЯ
            </span>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Инструктаж перед началом экзамена
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Экзамен проводится в защищённой среде с автоматической фиксацией действий прокторингом.
            </p>
          </div>

          <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl text-left text-xs text-slate-300 space-y-2 font-mono">
            <div className="text-slate-400 font-bold border-b border-slate-800 pb-1.5 flex items-center justify-between">
              <span>ПРАВИЛА БЕЗОПАСНОСТИ:</span>
              <span className="text-emerald-400">АКТИВНО</span>
            </div>
            <div>• Экзамен работает <strong>только в полноэкранном режиме</strong>.</div>
            <div>• Запрещено сворачивать окно и нажимать Alt+Tab (фиксируется).</div>
            <div>• Запрещены скриншоты, копирование и контекстное меню.</div>
            <div>• Таймер контролируется сервером (30 вопросов • 20 минут).</div>
          </div>

          <button
            onClick={handleStartExamFullscreen}
            className="w-full py-4 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-98 text-white font-black text-sm uppercase tracking-wider shadow-xl shadow-blue-950/60 flex items-center justify-center gap-2 transition-all min-h-[52px]"
          >
            <Maximize2 className="w-4 h-4" />
            <span>Включить полноэкранный режим и приступить</span>
          </button>
        </div>
      </div>
    );
  }

  const isQuestionAnswered = state.answeredMap && !!state.answeredMap[currentNumber];
  const studentFullName = `${state.student.lastName} ${state.student.firstName}`;

  return (
    <div className="min-h-screen bg-[#0a0f1d] text-slate-100 flex flex-col justify-between select-none relative font-sans">
      {/* Dynamic Anti-Photo Security Watermark */}
      <ExamWatermark
        studentName={studentFullName}
        studentId={state.student.studentId}
        formId={state.student.formId}
        gameCode={state.gameCode}
      />

      {/* Security Lockdown Modals (Fullscreen exit, blur, screenshot attempt) */}
      <SecurityLockdownModal
        isFullscreen={isFullscreen}
        isWindowBlurred={isWindowBlurred}
        isScreenshotBlocked={isScreenshotBlocked}
        onRequestFullscreen={requestFullscreen}
        onFocusWindow={clearBlur}
      />

      {/* 1. Official State Exam Top Header */}
      <header className="bg-[#0f172a] border-b border-slate-800/80 px-4 py-2.5 sticky top-0 z-20 shadow-md">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Institutional Title & Proctoring status */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
                <span>ЕДИНАЯ СИСТЕМА ЭКЗАМЕНАЦИОННОГО ТЕСТИРОВАНИЯ</span>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <span>Математика • 5 Класс</span>
                <span className="text-slate-500">•</span>
                <span className="text-blue-400 font-mono">Сессия #{state.gameCode}</span>
              </div>
            </div>
          </div>

          {/* Student Identification Credentials */}
          <div className="flex items-center gap-2 text-xs font-mono">
            <div className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-700/80 text-slate-200">
              <span className="text-slate-400 font-normal">Участник: </span>
              <strong className="text-white">{studentFullName}</strong>
            </div>
            <div className="px-2.5 py-1 rounded-md bg-slate-900 border border-blue-500/40 text-blue-300 font-bold">
              ID #{String(studentId).padStart(2, '0')}
            </div>
            <div className="px-2.5 py-1 rounded-md bg-slate-900 border border-purple-500/40 text-purple-300 font-bold">
              Вариант №{String(state.student.formId).padStart(2, '0')}
            </div>
          </div>

          {/* Timer & Finish button */}
          <div className="flex items-center gap-2">
            {state.endsAt && (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 border border-slate-700 rounded-md">
                <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <TimerDisplay
                  endsAt={state.endsAt}
                  serverTime={state.serverTime}
                  onExpire={() => loadState()}
                />
              </div>
            )}
            <button
              onClick={() => setShowFinishModal(true)}
              className="px-3 py-1.5 rounded-md bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 hover:text-white border border-rose-800/60 text-xs font-bold font-mono transition-colors flex items-center gap-1"
              title="Досрочно завершить сдачу"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Сдать работу</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. Official Answer Sheet Navigation Matrix (Бланк ответов №1: Сетка 1..30) */}
      <nav aria-label="Бланк ответов" className="bg-[#0b132b]/95 border-b border-slate-800/80 px-4 py-2.5 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-300 uppercase tracking-wider">
                Бланк ответов №1:
              </span>
              <span>
                Отвечено: <strong className="text-emerald-400">{state.answeredCount}</strong> / 30
              </span>
            </div>
            <div className="flex items-center gap-3 text-[10px] hidden sm:flex">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-emerald-600 inline-block" /> Заполнено
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded border border-blue-400 bg-blue-900/40 inline-block" /> Текущее
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded border border-slate-700 bg-slate-900 inline-block" /> Не заполнено
              </span>
            </div>
          </div>

          {/* Matrix Grid: Questions 1 to 30 */}
          <div className="flex flex-wrap gap-1.5 sm:gap-2 items-center">
            {/* Part 1 (1..20) */}
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[10px] font-mono text-slate-500 uppercase mr-1">Ч.1:</span>
              {Array.from({ length: 20 }, (_, idx) => {
                const qNum = idx + 1;
                const isCurrent = qNum === currentNumber;
                const isAnswered = state.answeredMap && !!state.answeredMap[qNum];

                return (
                  <button
                    key={qNum}
                    type="button"
                    onClick={() => loadQuestion(qNum)}
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded text-xs font-mono font-bold flex items-center justify-center transition-all ${
                      isCurrent
                        ? 'bg-blue-600 text-white ring-2 ring-blue-400 shadow-md font-black scale-105'
                        : isAnswered
                        ? 'bg-emerald-800/60 border border-emerald-500/60 text-emerald-200 hover:bg-emerald-700/60'
                        : 'bg-slate-900 border border-slate-700/70 text-slate-400 hover:border-slate-500 hover:text-white'
                    }`}
                    title={`Задание №${qNum}${isAnswered ? ' (Ответ зафиксирован)' : ''}`}
                  >
                    {qNum}
                  </button>
                );
              })}
            </div>

            <div className="w-px h-6 bg-slate-700 mx-1 hidden lg:block" />

            {/* Part 2 (21..30) */}
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[10px] font-mono text-purple-400 uppercase mr-1">Ч.2:</span>
              {Array.from({ length: 10 }, (_, idx) => {
                const qNum = idx + 21;
                const isCurrent = qNum === currentNumber;
                const isAnswered = state.answeredMap && !!state.answeredMap[qNum];

                return (
                  <button
                    key={qNum}
                    type="button"
                    onClick={() => loadQuestion(qNum)}
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded text-xs font-mono font-bold flex items-center justify-center transition-all ${
                      isCurrent
                        ? 'bg-purple-600 text-white ring-2 ring-purple-400 shadow-md font-black scale-105'
                        : isAnswered
                        ? 'bg-emerald-800/60 border border-emerald-500/60 text-emerald-200 hover:bg-emerald-700/60'
                        : 'bg-slate-900 border border-purple-900/50 text-slate-400 hover:border-purple-500 hover:text-white'
                    }`}
                    title={`Задание №${qNum}${isAnswered ? ' (Ответ зафиксирован)' : ''}`}
                  >
                    {qNum}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </nav>

      {/* 3. Main Examination Paper Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 flex flex-col justify-center">
        <div className="bg-[#0f172a] border border-slate-700/80 rounded-xl shadow-2xl p-5 sm:p-8 space-y-6 relative overflow-hidden">
          {/* Official Task Metadata Header */}
          <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-3 gap-2 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-blue-300 font-bold uppercase tracking-wider">
                ЗАДАНИЕ № {currentNumber} ИЗ 30
              </span>
              <span className="text-slate-400 font-semibold uppercase">
                {currentQuestion.type === 'multiple_choice'
                  ? 'Часть 1: Краткий выбор'
                  : 'Часть 2: Открытый ввод'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Стоимость задания: <strong>1 балл</strong></span>
              {isQuestionAnswered && (
                <span className="flex items-center gap-1 text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-800/40">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Ответ в бланке</span>
                </span>
              )}
            </div>
          </div>

          {/* Question Text Formulation with KaTeX */}
          <div className="py-2">
            <div className="text-base sm:text-xl font-medium text-white leading-relaxed tracking-normal font-sans">
              <MathRenderer content={currentQuestion.text} />
            </div>
          </div>

          {/* Error notice */}
          {error && (
            <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-lg text-rose-300 text-xs font-mono flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Answer Area: Multiple Choice or Open Answer */}
          {currentQuestion.type === 'multiple_choice' ? (
            <div className="space-y-3 pt-2">
              <div className="text-xs font-mono uppercase tracking-wider text-slate-400">
                Варианты ответов бланка:
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {currentQuestion.options?.map((opt) => {
                  const isSelected = selectedOptionId === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={submitting}
                      onClick={() => setSelectedOptionId(opt.id)}
                      className={`p-4 rounded-xl border text-left flex items-center gap-3 transition-all min-h-[56px] ${
                        isSelected
                          ? 'bg-blue-900/30 border-blue-400 ring-2 ring-blue-500/40 text-white font-semibold'
                          : 'bg-slate-900/80 border-slate-800 hover:border-slate-600 text-slate-200'
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-md font-mono text-xs font-bold flex items-center justify-center shrink-0 border transition-colors ${
                          isSelected
                            ? 'bg-blue-600 border-blue-400 text-white'
                            : 'bg-slate-800 border-slate-700 text-slate-300'
                        }`}
                      >
                        {opt.label}
                      </div>
                      <div className="text-sm sm:text-base font-medium flex-1">
                        <MathRenderer content={opt.text} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <div className="text-xs font-mono uppercase tracking-wider text-purple-300 font-bold flex items-center justify-between">
                <span>ПОЛЕ ВНЕСЕНИЯ ОТВЕТА В БЛАНК:</span>
                <span className="text-[11px] text-slate-400 font-normal">
                  (без единиц измерения: число, 1/2 или 0.5)
                </span>
              </div>
              <input
                type="text"
                disabled={submitting}
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                placeholder="Внесите число или дробь (например: 14 или 7/20 или 0.35)"
                className="w-full px-5 py-4 rounded-xl bg-slate-900 border-2 border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-lg font-mono font-bold text-white placeholder:text-slate-600 transition-all"
                autoComplete="off"
              />
            </div>
          )}

          {/* Navigation & Submit Action Controls */}
          <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
            {/* Previous question button */}
            <button
              type="button"
              disabled={currentNumber <= 1}
              onClick={() => loadQuestion(currentNumber - 1)}
              className="py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none text-slate-300 border border-slate-700 text-xs font-mono font-bold flex items-center gap-1 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Предыдущее</span>
            </button>

            {/* Save / Record Answer Button */}
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmitAnswer}
              className={`py-3 px-6 rounded-lg text-xs font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all min-h-[44px] ${
                isQuestionAnswered
                  ? 'bg-slate-800 hover:bg-slate-700 border border-emerald-500/50 text-emerald-300'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-950/60'
              }`}
            >
              {submitting ? (
                <span>Сохранение в протокол...</span>
              ) : isQuestionAnswered ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Обновить ответ в бланке</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Зафиксировать ответ в бланке</span>
                </>
              )}
            </button>

            {/* Next question button */}
            <button
              type="button"
              disabled={currentNumber >= 30}
              onClick={() => loadQuestion(currentNumber + 1)}
              className="py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none text-slate-300 border border-slate-700 text-xs font-mono font-bold flex items-center gap-1 transition-colors"
            >
              <span>Следующее</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </main>

      {/* 4. Official Examination Security Footer */}
      <footer className="bg-[#0f172a] border-t border-slate-800 px-4 py-2 text-[11px] font-mono text-slate-400">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>ПРОКТОРИНГ: АКТИВЕН (ЗАЩИТА ОТ КОПИРОВАНИЯ И ПЕРЕКЛЮЧЕНИЙ ВКЛЮЧЕНА)</span>
          </div>
          <div>
            <span>БЛАНК ВАРИАНТА №{state.student.formId} • 1500 ЗАДАНИЙ В РЕЕСТРЕ</span>
          </div>
        </div>
      </footer>

      {/* Confirmation Modal: Finish Exam */}
      <Modal
        isOpen={showFinishModal}
        onClose={() => setShowFinishModal(false)}
        title="Завершить сдачу экзаменационной работы?"
        variant="danger"
        confirmText="Завершить и сдать работу"
        cancelText="Вернуться к тесту"
        onConfirm={handleConfirmFinish}
      >
        <div className="space-y-3 font-sans text-sm text-slate-300">
          <p>
            Вы подтверждаете завершение экзаменационной работы? После подтверждения внесение изменений в бланк будет заблокировано.
          </p>
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-400 space-y-1">
            <div>• Заполнено ответов: <strong className="text-white">{state.answeredCount}</strong> из 30</div>
            <div>• Незаполненных заданий: <strong className="text-amber-400">{30 - state.answeredCount}</strong></div>
            <div>• Оценка рассчитывается сервером по 5-балльной шкале.</div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
