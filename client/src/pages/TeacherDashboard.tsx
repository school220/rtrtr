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
  FileSpreadsheet,
  ShieldCheck,
  ShieldAlert,
  Clock,
  CheckCircle2,
  Activity,
  Layers,
} from 'lucide-react';
import { TimerDisplay } from '../components/TimerDisplay.js';
import { Modal } from '../components/Modal.js';
import { api, TeacherDashboardResponse } from '../services/api.js';

interface TeacherDashboardProps {
  socket: Socket | null;
  onBack: () => void;
  activeGameId?: string;
}

type SortField = 'id' | 'name' | 'progress' | 'grade' | 'score' | 'suspicious';

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

    const handleDashboardUpdate = (data: TeacherDashboardResponse) => {
      setDashboard(data);
    };

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

    const handleSecurityAlert = (_data: { studentId: number; eventType: string }) => {
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
      const g = await api.createGame({ title: 'Государственная аттестация: Математика 5 класс' });
      setGameId(g.gameId);
      await loadDashboard(g.gameId);
    } catch (err: any) {
      setError(err.message || 'Ошибка инициализации сессии экзамена');
    } finally {
      setLoading(false);
    }
  };

  const loadDashboard = async (id: string) => {
    try {
      const data = await api.getTeacherDashboard(id);
      setDashboard(data);
    } catch (err: any) {
      setError(err.message || 'Ошибка синхронизации данных протокола');
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
      setError(err.message || 'Не удалось запустить экзаменационный сеанс');
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
      setError(err.message || 'Ошибка принудительного завершения экзамена');
    }
  };

  const exportCsv = () => {
    if (!dashboard) return;
    const rows = [
      ['№ п/п', 'ID Экзаменуемого', 'Фамилия', 'Имя', 'Вариант (Бланк)', 'Баллы (из 30)', 'Процент', 'Оценка', 'Статус', 'Инциденты безопасности'],
    ];

    const sorted = getSortedStudents();
    sorted.forEach((s, idx) => {
      rows.push([
        String(idx + 1),
        String(s.studentId),
        s.lastName,
        s.firstName,
        `Вариант №${s.formId}`,
        String(s.scoreReport?.scorePoints ?? s.answeredCount),
        `${s.scoreReport?.percentage ?? 0}%`,
        String(s.scoreReport?.grade ?? '-'),
        s.status === 'FINISHED' ? 'Сдал работу' : s.isOnline ? 'Выполняет' : 'Отключён',
        String(s.securityEvents?.totalSuspicious ?? 0),
      ]);
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map((e) => e.join(';')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Protokol_Examen_${dashboard.game.code}.csv`);
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
      } else if (sortField === 'suspicious') {
        const suspA = a.securityEvents?.totalSuspicious ?? 0;
        const suspB = b.securityEvents?.totalSuspicious ?? 0;
        comp = suspB - suspA;
      }
      return sortAsc ? comp : -comp;
    });
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field !== 'score' && field !== 'grade' && field !== 'suspicious');
    }
  };

  if (loading || !dashboard) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-slate-300">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-semibold tracking-wide uppercase text-slate-400">
            Инициализация прокторинг-центра...
          </span>
        </div>
      </div>
    );
  }

  const { game, students, totalConnected, maxStudents } = dashboard;
  const isWaiting = game.status === 'WAITING';
  const isInProgress = game.status === 'IN_PROGRESS';
  const isFinished = game.status === 'FINISHED' || game.status === 'TIME_EXPIRED';
  const sortedStudents = getSortedStudents();

  // Aggregate security incidents
  const totalIncidents = students.reduce((acc, st) => acc + (st.securityEvents?.totalSuspicious || 0), 0);
  const finishedCount = students.filter((s) => s.status === 'FINISHED').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 select-none max-w-7xl mx-auto space-y-6">
      {/* Official Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors"
              title="На главную"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold tracking-wider uppercase text-cyan-400 bg-cyan-950/70 border border-cyan-800/60 px-2 py-0.5 rounded">
                  ЕСЭТ • СИТУАЦИОННЫЙ ЦЕНТР
                </span>
                <span
                  className={`text-[11px] px-2.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                    isWaiting
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      : isInProgress
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 animate-pulse'
                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  }`}
                >
                  {isWaiting ? '● ОЖИДАНИЕ ДОПУСКА' : isInProgress ? '● ИДЁТ ЭКЗАМЕН' : '✓ ЭКЗАМЕН ЗАВЕРШЁН'}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1">
                Пульт председателя экзаменационной комиссии
              </h1>
              <p className="text-xs text-slate-400 font-mono">
                Сессия #{game.id.slice(0, 8).toUpperCase()} • Дисциплина: Математика (5 класс, 30 заданий)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => gameId && loadDashboard(gameId)}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors flex items-center gap-2 text-xs font-semibold"
              title="Синхронизировать протокол"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">Обновить</span>
            </button>

            {isFinished && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => gameId && api.downloadExcel(gameId, game.code)}
                  className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-950/50 border border-emerald-500 transition-all active:scale-95"
                  title="Скачать официальную экзаменационную ведомость в Excel с оценками, датой и временем"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
                  <span>Ведомость Excel (.xlsx)</span>
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
                className="py-2.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-black text-sm shadow-xl shadow-emerald-950/60 flex items-center gap-2 transition-all disabled:opacity-50 disabled:pointer-events-none border border-emerald-400"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>{starting ? 'ЗАПУСК СЕАНСА...' : 'ОТКРЫТЬ ДОСТУП К ТЕСТУ'}</span>
              </button>
            )}

            {isInProgress && (
              <button
                onClick={() => setShowFinishConfirm(true)}
                className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-rose-950/40 border border-rose-500 transition-colors"
              >
                <Square className="w-4 h-4 fill-white" />
                <span>Завершить для всех</span>
              </button>
            )}
          </div>
        </div>

        {/* Status metric badges */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-4">
          {/* Game Code Card */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Код аудитории (Пин-код)
            </span>
            <div className="text-2xl sm:text-3xl font-black font-mono tracking-widest text-cyan-400">
              {game.code}
            </div>
          </div>

          {/* Connected Candidates */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Users className="w-3 h-3 text-slate-400" />
              <span>Явка кандидатов</span>
            </span>
            <div className="text-2xl sm:text-3xl font-black font-mono text-white">
              {totalConnected} <span className="text-xs text-slate-500 font-semibold">/ {maxStudents} макс</span>
            </div>
          </div>

          {/* Exam Status & Progress */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Activity className="w-3 h-3 text-slate-400" />
              <span>Сдано работ</span>
            </span>
            <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-400">
              {finishedCount} <span className="text-xs text-slate-500 font-semibold">/ {students.length}</span>
            </div>
          </div>

          {/* Timer status */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>{isInProgress ? 'Остаток регламента' : 'Регламент'}</span>
            </span>
            <div>
              {isInProgress && game.ends_at ? (
                <TimerDisplay
                  endsAt={game.ends_at}
                  onExpire={() => gameId && loadDashboard(gameId)}
                />
              ) : (
                <div className="text-xl sm:text-2xl font-bold font-mono text-slate-200">
                  {Math.round(game.total_time_seconds / 60)} мин
                </div>
              )}
            </div>
          </div>

          {/* Security alerts badge */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              {totalIncidents > 0 ? (
                <ShieldAlert className="w-3 h-3 text-rose-400" />
              ) : (
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
              )}
              <span>Прокторинг-инциденты</span>
            </span>
            <div className={`text-2xl sm:text-3xl font-black font-mono ${totalIncidents > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {totalIncidents}
            </div>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Student Roster Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>Официальный протокол экзаменационной группы</span>
              <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
                {students.length} в списке
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Каждому кандидату сервером назначен персональный вариант из 50 уникальных бланков.
            </p>
          </div>

          {isFinished && (
            <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1 bg-emerald-950/60 border border-emerald-800/80 px-3 py-1 rounded-lg">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Итоговые протокольные оценки рассчитаны
            </span>
          )}
        </div>

        {students.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-sm space-y-3">
            <Users className="w-12 h-12 mx-auto text-slate-600" />
            <p className="font-semibold text-slate-300">Кандидаты ещё не зарегистрировались в аудитории.</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Ученики должны открыть сайт и ввести пин-код: <strong className="text-cyan-400 font-mono text-base">{game.code}</strong>, указав свои реальные фамилию и имя.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950/80 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-800">
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
                      <span>Экзаменуемый</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="py-3 px-4">Бланк / Вариант</th>
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
                  <th
                    onClick={() => toggleSort('suspicious')}
                    className="py-3 px-4 cursor-pointer hover:text-white"
                  >
                    <div className="flex items-center gap-1">
                      <span>Безопасность</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-medium">
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
                      <td className="py-3 px-4 font-mono font-bold text-cyan-400">
                        #{String(st.studentId).padStart(2, '0')}
                      </td>

                      {/* Name */}
                      <td className="py-3 px-4 font-bold text-white">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${
                              isOnline ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-slate-600'
                            }`}
                            title={isOnline ? 'Связь активна (онлайн)' : 'Связь потеряна (офлайн)'}
                          />
                          <span>
                            {st.lastName} {st.firstName}
                          </span>
                        </div>
                      </td>

                      {/* Blank / Variant */}
                      <td className="py-3 px-4 font-mono text-slate-300">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700 text-xs">
                          Вариант №{String(st.formId).padStart(2, '0')}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block text-xs px-2.5 py-1 rounded font-semibold ${
                            st.status === 'FINISHED'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : isOnline
                              ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {st.status === 'FINISHED' ? 'Сдал работу' : isOnline ? 'Выполняет' : 'Отключён'}
                        </span>
                      </td>

                      {/* Progress / Score */}
                      <td className="py-3 px-4 font-mono font-bold">
                        {isFinished && rep ? (
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-white text-base">{rep.scorePoints}</span>
                            <span className="text-xs text-slate-500">/ 30</span>
                            <span className="text-xs text-cyan-400 font-normal">({rep.percentage}%)</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-white">{st.answeredCount} / 30</span>
                            <div className="w-20 h-2 bg-slate-800 rounded-full overflow-hidden hidden sm:block">
                              <div
                                className="h-full bg-cyan-500 rounded-full transition-all duration-300"
                                style={{ width: `${Math.round((st.answeredCount / 30) * 100)}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Grade (Shown on finish) */}
                      {isFinished && (
                        <td className="py-3 px-4 font-mono font-extrabold text-lg">
                          {rep ? (
                            <span
                              className={`px-3 py-1 rounded-lg inline-block border ${
                                rep.grade === 5
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                  : rep.grade === 4
                                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                                  : rep.grade === 3
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                  : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
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
                      <td className="py-3 px-4">
                        {susp > 0 ? (
                          <span
                            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/30 font-mono font-bold"
                            title={`Инцидентов: ${susp} (Потеря фокуса/Alt+Tab: ${st.securityEvents?.pageHidden || 0}, Выход из полного экрана: ${st.securityEvents?.fullscreenExit || 0})`}
                          >
                            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                            <span>{susp} инц.</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                            <ShieldCheck className="w-3 h-3" />
                            <span>Чисто</span>
                          </span>
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
        title="Завершить тестирование для всех кандидатов?"
        variant="danger"
        confirmText="Принудительно завершить"
        cancelText="Отмена"
        onConfirm={handleFinishGame}
      >
        <p className="text-sm leading-relaxed text-slate-300">
          Экзаменационный сеанс будет немедленно прекращён для всей группы. Все неотвеченные вопросы будут автоматически зафиксированы как неотвеченные с начислением 0 баллов, и система сформирует итоговые протоколы.
        </p>
      </Modal>
    </div>
  );
};
