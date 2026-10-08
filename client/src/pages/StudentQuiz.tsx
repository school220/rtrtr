import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { LogOut, Send, ArrowRight, CheckCircle, AlertTriangle } from 'lucide-react';
import { MathRenderer } from '../components/MathRenderer.js';
import { TimerDisplay } from '../components/TimerDisplay.js';
import { ProgressBar } from '../components/ProgressBar.js';
import { Modal } from '../components/Modal.js';
import { FullscreenPrompt } from '../components/FullscreenPrompt.js';
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

  // Modals & Interstitials
  const [showPartTwoPrompt, setShowPartTwoPrompt] = useState<boolean>(false);
  const [hasSeenPartTwo, setHasSeenPartTwo] = useState<boolean>(false);
  const [showFinishModal, setShowFinishModal] = useState<boolean>(false);
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState<boolean>(true);

  // Initialize and load state
  useEffect(() => {
    loadState();
  }, [gameId, studentId]);

  // Hook for security telemetry
  useAntiCheat({
    gameId,
    studentId,
    socket,
    isActive: !!state && state.gameStatus === 'IN_PROGRESS',
  });

  // Socket listeners for game completion or expiry
  useEffect(() => {
    if (!socket) return;

    const handleGameFinished = () => {
      loadState();
    };

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

      // Check if transitioning to part 2 (Q21-30) for the first time
      if (qNum === 21 && !hasSeenPartTwo) {
        setShowPartTwoPrompt(true);
      }

      if (data.currentQuestion) {
        setCurrentQuestion(data.currentQuestion);
      } else {
        loadQuestion(qNum);
      }

      // Restore answer state if already recorded
      if (data.answeredMap && data.answeredMap[qNum]) {
        setSelectedOptionId(data.answeredMap[qNum].selectedOptionId || null);
        setAnswerText(data.answeredMap[qNum].answerText || '');
      } else {
        setSelectedOptionId(null);
        setAnswerText('');
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки состояния');
    }
  };

  const loadQuestion = async (num: number) => {
    try {
      setError(null);
      const q = await api.getQuestion(gameId, studentId, num);
      setCurrentQuestion(q);
      setCurrentNumber(num);
      setSelectedOptionId(null);
      setAnswerText('');
    } catch (err: any) {
      setError(err.message || 'Не удалось загрузить вопрос');
    }
  };

  // Submit answer
  const handleSubmitAnswer = async () => {
    if (!currentQuestion) return;

    if (currentQuestion.type === 'multiple_choice' && !selectedOptionId) {
      setError('Выберите один из вариантов ответа');
      return;
    }

    if (currentQuestion.type === 'short_answer' && !answerText.trim()) {
      setError('Введите ответ в поле ввода');
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

      if (res.isFinished) {
        // Complete test
        await api.finishStudentTest(gameId, studentId);
        await loadState();
        return;
      }

      if (res.nextQuestionNumber) {
        const nextNum = res.nextQuestionNumber;
        // Check Part 2 transition
        if (nextNum === 21 && !hasSeenPartTwo) {
          setShowPartTwoPrompt(true);
        }
        await loadQuestion(nextNum);
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка сохранения ответа');
    } finally {
      setSubmitting(false);
    }
  };

  // Manual completion
  const handleConfirmFinish = async () => {
    setShowFinishModal(false);
    try {
      await api.finishStudentTest(gameId, studentId);
      await loadState();
    } catch (err: any) {
      setError(err.message || 'Ошибка завершения теста');
    }
  };

  if (!state || !currentQuestion) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-slate-300">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Загрузка вопросов...</span>
        </div>
      </div>
    );
  }

  // Interstitial screen for Part 2 (Questions 21–30)
  if (showPartTwoPrompt) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 select-none">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center space-y-6 shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <ArrowRight className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold text-purple-400 tracking-wider uppercase">
              Часть II
            </span>
            <h2 className="text-2xl font-black text-white">Вторая часть теста</h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Вопросы 21–30 требуют самостоятельного ввода ответа.
            </p>
          </div>

          <div className="p-3.5 bg-slate-800/60 rounded-2xl text-xs text-slate-400 border border-slate-700/50 text-left space-y-1">
            <div className="font-semibold text-slate-300">Подсказка:</div>
            <div>• Числа можно вводить с точкой или запятой (например: 0.5 или 0,5)</div>
            <div>• Простые дроби вводятся через косую черту (например: 1/2)</div>
          </div>

          <button
            onClick={() => {
              setHasSeenPartTwo(true);
              setShowPartTwoPrompt(false);
            }}
            className="w-full py-4 px-6 rounded-2xl bg-purple-600 hover:bg-purple-500 active:scale-98 text-white font-bold text-base shadow-lg shadow-purple-900/40 transition-all min-h-[52px]"
          >
            Продолжить
          </button>
        </div>
      </div>
    );
  }

  const isQuestionAnswered = state.answeredMap && !!state.answeredMap[currentNumber];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-between select-none max-w-lg mx-auto p-4 pb-6">
      {/* Fullscreen Prompt dialog */}
      {showFullscreenPrompt && (
        <FullscreenPrompt onProceed={() => setShowFullscreenPrompt(false)} />
      )}

      {/* Top Header: Progress & Timer */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between gap-2">
          {/* Form and ID Tag */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
            <span className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-indigo-400 font-bold">
              ID #{String(studentId).padStart(2, '0')}
            </span>
            <span className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-purple-400 font-bold">
              Бланк #{String(state.student.formId).padStart(2, '0')}
            </span>
          </div>

          {/* Server-Controlled Monotonic Timer */}
          <div className="flex items-center gap-2">
            {state.endsAt && (
              <TimerDisplay
                endsAt={state.endsAt}
                serverTime={state.serverTime}
                onExpire={() => {
                  loadState();
                }}
              />
            )}
            {/* Early finish button */}
            <button
              onClick={() => setShowFinishModal(true)}
              className="p-1.5 rounded-xl bg-slate-900 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-500/30 transition-colors"
              title="Завершить тест"
              aria-label="Завершить тест"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <ProgressBar
          current={currentNumber}
          total={30}
          answeredCount={state.answeredCount}
        />
      </div>

      {/* Question Card Container */}
      <div className="my-auto py-4 space-y-4">
        {/* Question Type Instruction Banner */}
        <div className="text-xs font-semibold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
          {currentQuestion.type === 'multiple_choice' ? (
            <span>Выберите один правильный ответ:</span>
          ) : (
            <span>Введите ответ самостоятельно:</span>
          )}
        </div>

        {/* Question Text Box with KaTeX typography */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl">
          <div className="text-base sm:text-lg font-medium text-white leading-relaxed">
            <MathRenderer content={currentQuestion.text} />
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium animate-in fade-in">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Answer Selection or Input */}
        {currentQuestion.type === 'multiple_choice' ? (
          <div className="space-y-2.5 pt-1">
            {currentQuestion.options?.map((opt) => {
              const isSelected = selectedOptionId === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={isQuestionAnswered || submitting}
                  onClick={() => setSelectedOptionId(opt.id)}
                  className={`w-full p-4 rounded-2xl border text-left flex items-center gap-3.5 transition-all min-h-[58px] active:scale-98 ${
                    isSelected
                      ? 'bg-indigo-600/20 border-indigo-500 ring-2 ring-indigo-500/30 text-white shadow-lg shadow-indigo-950/40'
                      : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 text-slate-200'
                  } disabled:opacity-60`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl font-bold font-mono text-sm flex items-center justify-center shrink-0 border transition-colors ${
                      isSelected
                        ? 'bg-indigo-600 border-indigo-400 text-white'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    {opt.label}
                  </div>
                  <div className="flex-1 text-sm sm:text-base font-medium">
                    <MathRenderer content={opt.text} />
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
              Ваш ответ:
            </label>
            <input
              type="text"
              disabled={isQuestionAnswered || submitting}
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              placeholder="Например: 4 или 1/2 или 0.5"
              className="w-full px-5 py-4 rounded-2xl bg-slate-900 border border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-lg font-mono font-bold text-white placeholder:text-slate-600 transition-all min-h-[58px]"
              autoComplete="off"
            />
          </div>
        )}
      </div>

      {/* Bottom Action Footer */}
      <div className="pt-2">
        <button
          type="button"
          disabled={submitting || isQuestionAnswered}
          onClick={handleSubmitAnswer}
          className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 active:scale-98 text-white font-bold text-base shadow-xl shadow-indigo-950/60 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:pointer-events-none min-h-[56px]"
        >
          {isQuestionAnswered ? (
            <>
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <span>Ответ отправлен</span>
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              <span>{submitting ? 'Отправка...' : 'Ответить'}</span>
            </>
          )}
        </button>
      </div>

      {/* Confirm Finish Modal */}
      <Modal
        isOpen={showFinishModal}
        onClose={() => setShowFinishModal(false)}
        title="Завершить тест?"
        variant="danger"
        confirmText="Завершить"
        cancelText="Отмена"
        onConfirm={handleConfirmFinish}
      >
        <p>
          Вы уверены, что хотите завершить тест? После завершения изменить ответы будет невозможно.
        </p>
        <div className="mt-3 p-3 bg-slate-800/60 rounded-xl text-xs text-slate-400">
          Отвечено: <strong className="text-white">{state.answeredCount}</strong> из 30 вопросов.
        </div>
      </Modal>
    </div>
  );
};
