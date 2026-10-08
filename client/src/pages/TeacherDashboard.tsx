import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import {
  Users,
  Play,
  Square,
  RefreshCw,
  ArrowUpDown,
  Download,
  AlertTriangle,
  ArrowLeft,
  Sparkles,
  FileSpreadsheet,
} from 'lucide-react';
import { TimerDisplay } from '../components/TimerDisplay.js';
import { Modal } from '../components/Modal.js';
import { api, TeacherDashboardResponse } from '../services/api.js';

interface TeacherDashboardProps {
  socket: Socket | null;
  onBack: () => void;
  activeGameId?: string;
}

type SortField = 'id' | 'name' | 'progress' | 'grade' | 'score';

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  socket,
  onBack,
  activeGameId,
}) => {
  const [gameId, setGameId] = useState<string | null>(activeGameId || null);
  const [dashboard, setDashboard] = useState<TeacherDashboardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);

  // Sorting
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortAsc, setSortAsc] = useState(true);

  // Create new game if activeGameId not provided
  useEffect(() => {
    if (!gameId) {
      handleCreateGame();
    } else {
      loadDashboard(gameId);
    }
  }, [gameId]);

  // Socket real-time integration
  useEffect(() => {
    if (!socket || !gameId) return;

    socket.emit('teacher:join', { gameId });

    // Handle full dashboard update broadcast
    const handleDashboardUpdate = (data: TeacherDashboardResponse) => {
      setDashboard(data);
    };

    // Handle lightweight real-time progress update
    const handleStudentProgress = (data: { studentId: number; totalAnswered: number; isFinished: boolean }) => {
      setDashboard((prev) => {
        if (!prev) return prev;
        const updatedStudents = prev.students.map((st) => {
          if (st.studentId === data.studentId) {
            return {
              ...st,
              answeredCount: data.totalAnswered,
              status: data.isFinished ? 'FINISHED' : st.status,
            };
          }
          return st;
        });
        return { ...prev, students: updatedStudents };
      });
    };

    // Handle online status change
    const handleStatusChange = (data: { studentId: number; isOnline: boolean }) => {
      setDashboard((prev) => {
        if (!prev) return prev;
        const updatedStudents = prev.students.map((st) => {
          if (st.studentId === data.studentId) {
            return { ...st, isOnline: data.isOnline };
          }
          return st;
        });
        return { ...prev, students: updatedStudents };
      });
    };

    // Handle security incident alerts
    const handleSecurityAlert = (_data: { studentId: number; eventType: string }) => {
      // Refresh dashboard to pull exact counts
      loadDashboard(gameId);
    };

    socket.on('teacher:dashboard_update', handleDashboardUpdate);
    socket.on('student:progress', handleStudentProgress);
    socket.on('student:status_change', handleStatusChange);
    socket.on('teacher:security_alert', handleSecurityAlert);

    return () => {
      socket.off('teacher:dashboard_update', handleDashboardUpdate);
      socket.off('student:progress', handleStudentProgress);
      socket.off('student:status_change', handleStatusChange);
      socket.off('teacher:security_alert', handleSecurityAlert);
    };
  }, [socket, gameId]);

  const handleCreateGame = async () => {
    setLoading(true);
    setError(null);
    try {
      const g = await api.createGame({ title: 'Классная работа' });
      setGameId(g.gameId);
      await loadDashboard(g.gameId);
    } catch (err: any) {
      setError(err.message || 'Ошибка создания комнаты');
    } finally {
      setLoading(false);
    }
  };

  const loadDashboard = async (id: string) => {
    try {
      const data = await api.getTeacherDashboard(id);
      setDashboard(data);
    } catch (err: any) {
      setError(err.message || 'Ошибка обновления данных');
    }
  };

  const handleStartGame = async () => {
    if (!gameId) return;
    setStarting(true);
    setError(null);
    try {
      await api.startGame(gameId);
      await loadDashboard(gameId);
    } catch (err: any) {
      setError(err.message || 'Не удалось запустить тест');
    } finally {
      setStarting(false);
    }
  };

  const handleFinishGame = async () => {
    if (!gameId) return;
    setShowFinishConfirm(false);
    try {
      await api.finishGame(gameId);
      await loadDashboard(gameId);
    } catch (err: any) {
      setError(err.message || 'Ошибка завершения');
    }
  };

  const exportCsv = () => {
    if (!dashboard) return;
    const rows = [
      ['Место', 'ID', 'Фамилия', 'Имя', 'Бланк', 'Баллы', 'Процент', 'Оценка', 'Статус', 'Подозрительные события'],
    ];

    const sorted = getSortedStudents();
    sorted.forEach((s, idx) => {
      rows.push([
        String(idx + 1),
        String(s.studentId),
        s.lastName,
        s.firstName,
        String(s.formId),
        String(s.scoreReport?.scorePoints ?? s.answeredCount),
        `${s.scoreReport?.percentage ?? 0}%`,
        String(s.scoreReport?.grade ?? '-'),
        s.status,
        String(s.securityEvents?.totalSuspicious ?? 0),
      ]);
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map((e) => e.join(';')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `results_${dashboard.game.code}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getSortedStudents = () => {
    if (!dashboard?.students) return [];
    return [...dashboard.students].sort((a, b) => {
      let comp = 0;
      if (sortField === 'id') {
        comp = a.studentId - b.studentId;
      } else if (sortField === 'name') {
        comp = `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`);
      } else if (sortField === 'progress') {
        comp = a.answeredCount - b.answeredCount;
      } else if (sortField === 'score') {
        const scA = a.scoreReport?.scorePoints ?? a.answeredCount;
        const scB = b.scoreReport?.scorePoints ?? b.answeredCount;
        comp = scB - scA;
      } else if (sortField === 'grade') {
        const grA = a.scoreReport?.grade ?? 0;
        const grB = b.scoreReport?.grade ?? 0;
        comp = grB - grA;
      }
      return sortAsc ? comp : -comp;
    });
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field !== 'score' && field !== 'grade'); // default descending for score/grade
    }
  };

  if (loading || !dashboard) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-slate-300">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Создание комнаты тестирования...</span>
        </div>
      </div>
    );
  }

  const { game, students, totalConnected, maxStudents } = dashboard;
  const isWaiting = game.status === 'WAITING';
  const isInProgress = game.status === 'IN_PROGRESS';
  const isFinished = game.status === 'FINISHED' || game.status === 'TIME_EXPIRED';
  const sortedStudents = getSortedStudents();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 select-none max-w-6xl mx-auto space-y-6">
      {/* Top Navbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors"
            title="Назад"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              <span>Панель учителя</span>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                  isWaiting
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                    : isInProgress
                    ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 animate-pulse'
                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                }`}
              >
                {isWaiting ? 'Ожидание' : isInProgress ? 'Тест идёт' : 'Завершён'}
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              {isInProgress ? 'Следите за прогрессом учеников в реальном времени' : 'Управление игровой комнатой'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => gameId && loadDashboard(gameId)}
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors"
            title="Обновить"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {isFinished && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => gameId && api.downloadExcel(gameId, game.code)}
                className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-950/40 border border-emerald-500/50 transition-all active:scale-95"
                title="Скачать ведомость в Excel с фамилиями, оценками, датой и временем"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
                <span>Скачать Excel (.xlsx)</span>
              </button>

              <button
                onClick={exportCsv}
                className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center gap-1.5 border border-slate-700 transition-colors"
                title="Экспорт в CSV"
              >
                <Download className="w-4 h-4" />
                <span>CSV</span>
              </button>
            </div>
          )}

          {isWaiting && (
            <button
              disabled={starting || totalConnected === 0}
              onClick={handleStartGame}
              className="py-3 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 active:scale-98 text-white font-extrabold text-sm shadow-xl shadow-emerald-950/60 flex items-center gap-2 transition-all disabled:opacity-50 disabled:pointer-events-none min-h-[48px]"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>{starting ? 'Запуск...' : 'НАЧАТЬ ТЕСТ'}</span>
            </button>
          )}

          {isInProgress && (
            <button
              onClick={() => setShowFinishConfirm(true)}
              className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-rose-950/40 transition-colors"
            >
              <Square className="w-4 h-4 fill-white" />
              <span>Завершить тест</span>
            </button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Stats Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Game Code Card */}
        <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Код игры
          </span>
          <div className="text-3xl font-black font-mono tracking-widest text-indigo-400">
            {game.code}
          </div>
        </div>

        {/* Participants count */}
        <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            <span>Участники</span>
          </span>
          <div className="text-3xl font-black font-mono text-white">
            {totalConnected} <span className="text-base text-slate-500 font-semibold">/ {maxStudents}</span>
          </div>
        </div>

        {/* Timer status */}
        <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            {isInProgress ? 'Осталось времени' : 'Длительность'}
          </span>
          <div>
            {isInProgress && game.ends_at ? (
              <TimerDisplay
                endsAt={game.ends_at}
                onExpire={() => gameId && loadDashboard(gameId)}
              />
            ) : (
              <div className="text-2xl font-bold font-mono text-slate-300">
                {Math.round(game.total_time_seconds / 60)} мин
              </div>
            )}
          </div>
        </div>

        {/* Status card */}
        <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Состояние
          </span>
          <div className="text-xl font-bold text-slate-200">
            {isWaiting && totalConnected >= 37
              ? 'Все готовы'
              : isWaiting
              ? 'Сбор класса'
              : isInProgress
              ? 'Тест активен'
              : 'Результаты готовы'}
          </div>
        </div>
      </div>

      {/* Main Student Roster Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <span>Список участников</span>
            <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-lg border border-indigo-500/20">
              {students.length}
            </span>
          </h2>
          {isFinished && (
            <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              Итоговые оценки рассчитаны сервером
            </span>
          )}
        </div>

        {students.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-sm space-y-2">
            <Users className="w-10 h-10 mx-auto text-slate-600" />
            <p>Ученики пока не подключились.</p>
            <p className="text-xs text-slate-400">
              Попросите учеников открыть сайт и ввести код: <strong className="text-indigo-400 font-mono text-base">{game.code}</strong>
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950/60 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th
                    onClick={() => toggleSort('id')}
                    className="py-3 px-4 cursor-pointer hover:text-white"
                  >
                    <div className="flex items-center gap-1">
                      <span>ID</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    onClick={() => toggleSort('name')}
                    className="py-3 px-4 cursor-pointer hover:text-white"
                  >
                    <div className="flex items-center gap-1">
                      <span>Ученик</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="py-3 px-4">Бланк</th>
                  <th className="py-3 px-4">Статус</th>
                  <th
                    onClick={() => toggleSort(isFinished ? 'score' : 'progress')}
                    className="py-3 px-4 cursor-pointer hover:text-white"
                  >
                    <div className="flex items-center gap-1">
                      <span>{isFinished ? 'Баллы' : 'Прогресс'}</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  {isFinished && (
                    <th
                      onClick={() => toggleSort('grade')}
                      className="py-3 px-4 cursor-pointer hover:text-white"
                    >
                      <div className="flex items-center gap-1">
                        <span>Оценка</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                  )}
                  <th className="py-3 px-4">События</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {sortedStudents.map((st) => {
                  const susp = st.securityEvents?.totalSuspicious || 0;
                  const isOnline = st.isOnline;
                  const rep = st.scoreReport;

                  return (
                    <tr
                      key={st.studentId}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      {/* ID */}
                      <td className="py-3.5 px-4 font-mono font-bold text-indigo-400">
                        #{String(st.studentId).padStart(2, '0')}
                      </td>

                      {/* Name */}
                      <td className="py-3.5 px-4 font-bold text-white">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isOnline ? 'bg-emerald-500' : 'bg-slate-600'
                            }`}
                            title={isOnline ? 'В сети' : 'Не в сети'}
                          />
                          <span>
                            {st.lastName} {st.firstName}
                          </span>
                        </div>
                      </td>

                      {/* Blank */}
                      <td className="py-3.5 px-4 font-mono text-slate-300">
                        №{String(st.formId).padStart(2, '0')}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block text-xs px-2.5 py-1 rounded-lg font-semibold ${
                            st.status === 'FINISHED'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : isOnline
                              ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {st.status === 'FINISHED' ? 'Завершил' : isOnline ? 'Готов' : 'Отключён'}
                        </span>
                      </td>

                      {/* Progress / Score */}
                      <td className="py-3.5 px-4 font-mono font-bold">
                        {isFinished && rep ? (
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-white text-base">{rep.scorePoints}</span>
                            <span className="text-xs text-slate-500">/ 30</span>
                            <span className="text-xs text-indigo-400 font-normal">({rep.percentage}%)</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-white">{st.answeredCount} / 30</span>
                            <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden hidden sm:block">
                              <div
                                className="h-full bg-indigo-500 rounded-full"
                                style={{ width: `${Math.round((st.answeredCount / 30) * 100)}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Grade (Shown on finish) */}
                      {isFinished && (
                        <td className="py-3.5 px-4 font-mono font-extrabold text-lg">
                          {rep ? (
                            <span
                              className={`px-2.5 py-1 rounded-xl inline-block ${
                                rep.grade === 5
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : rep.grade === 4
                                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                                  : rep.grade === 3
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              }`}
                            >
                              {rep.grade}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                      )}

                      {/* Suspicious Events / Security Alerts */}
                      <td className="py-3.5 px-4">
                        {susp > 0 ? (
                          <span
                            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30"
                            title={`Страница скрыта: ${st.securityEvents.pageHidden}, Выход из полноэкранного: ${st.securityEvents.fullscreenExit}`}
                          >
                            <AlertTriangle className="w-3 h-3" />
                            <span>⚠ {susp}</span>
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500 font-mono">0</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Finish Modal */}
      <Modal
        isOpen={showFinishConfirm}
        onClose={() => setShowFinishConfirm(false)}
        title="Завершить тестирование для всех?"
        variant="danger"
        confirmText="Завершить тест"
        cancelText="Отмена"
        onConfirm={handleFinishGame}
      >
        <p>
          Тест будет немедленно завершён для всех подключённых учеников. Неотвеченные вопросы будут зафиксированы как неотвеченные.
        </p>
      </Modal>
    </div>
  );
};
