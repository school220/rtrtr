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
  LogOut,
  PlusCircle,
  FileEdit,
} from 'lucide-react';
import { TimerDisplay } from '../components/TimerDisplay.js';
import { Modal } from '../components/Modal.js';
import { api, TeacherDashboardResponse } from '../services/api.js';
import { useLanguage } from '../context/LanguageContext.js';
import { LanguageSelector } from '../components/LanguageSelector.js';

interface TeacherDashboardProps {
  socket: Socket | null;
  onBack: () => void;
  onOpenImport?: () => void;
  activeGameId?: string;
  onStartProctorPreview?: (formId: number) => void;
}

type SortField = 'id' | 'name' | 'progress' | 'grade' | 'score' | 'suspicious';

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  socket,
  onBack,
  onOpenImport,
  activeGameId,
  onStartProctorPreview,
}) => {
  const { t } = useLanguage();
  const [gameId, setGameId] = useState<string | null>(activeGameId || null);
  const [dashboard, setDashboard] = useState<TeacherDashboardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [showSessionsModal, setShowSessionsModal] = useState(false);
  const [showNewExamModal, setShowNewExamModal] = useState(false);
  const [showProctorPreviewModal, setShowProctorPreviewModal] = useState(false);
  const [previewVariantNumber, setPreviewVariantNumber] = useState(1);
  const [recentGames, setRecentGames] = useState<{
    id: string;
    code: string;
    title: string;
    status: string;
    created_at: string;
    started_at?: string;
    finished_at?: string;
    total_time_seconds: number;
    student_count: number;
  }[]>([]);
  const [loadingGames, setLoadingGames] = useState(false);

  // Sorting
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortAsc, setSortAsc] = useState(true);

  // Smart session initialization: restore existing active session or recent session without creating ghosts
  useEffect(() => {
    let isMounted = true;

    const initDashboard = async () => {
      setLoading(true);
      setError(null);
      try {
        const savedId = activeGameId || localStorage.getItem('teacher_active_game_id');
        if (savedId) {
          try {
            const data = await api.getTeacherDashboard(savedId);
            if (isMounted) {
              setDashboard(data);
              setGameId(data.game.id);
              localStorage.setItem('teacher_active_game_id', data.game.id);
              setLoading(false);
              return;
            }
          } catch {
            localStorage.removeItem('teacher_active_game_id');
          }
        }

        // Check if there is an active game (WAITING or IN_PROGRESS)
        const active = await api.getActiveGame().catch(() => null);
        if (active && isMounted) {
          setGameId(active.id);
          localStorage.setItem('teacher_active_game_id', active.id);
          await loadDashboard(active.id);
          setLoading(false);
          return;
        }

        // Check recent games
        const recent = await api.getRecentGames().catch(() => []);
        if (recent && recent.length > 0 && isMounted) {
          const latest = recent[0];
          setGameId(latest.id);
          localStorage.setItem('teacher_active_game_id', latest.id);
          await loadDashboard(latest.id);
          setLoading(false);
          return;
        }

        // Fallback: create game if none exists
        if (isMounted) {
          await handleCreateGame();
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Xatolik yuz berdi');
          setLoading(false);
        }
      }
    };

    initDashboard();

    return () => {
      isMounted = false;
    };
  }, []);

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
      const g = await api.createGame({ title: 'HEMIS: Matematika yakuniy nazorat' });
      setGameId(g.gameId);
      localStorage.setItem('teacher_active_game_id', g.gameId);
      await loadDashboard(g.gameId);
    } catch (err: any) {
      setError(err.message || 'Xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectGame = async (selectedId: string) => {
    setLoading(true);
    setGameId(selectedId);
    localStorage.setItem('teacher_active_game_id', selectedId);
    setShowSessionsModal(false);
    try {
      await loadDashboard(selectedId);
    } catch (err: any) {
      setError(err.message || 'Xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSessionsModal = async () => {
    setShowSessionsModal(true);
    setLoadingGames(true);
    try {
      const list = await api.getRecentGames();
      setRecentGames(list);
    } catch (err: any) {
      console.error('Error fetching recent games:', err);
    } finally {
      setLoadingGames(false);
    }
  };

  const loadDashboard = async (id: string) => {
    try {
      const data = await api.getTeacherDashboard(id);
      setDashboard(data);
    } catch (err: any) {
      setError(err.message || 'Xatolik yuz berdi');
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
      setError(err.message || 'Xatolik yuz berdi');
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
      setError(err.message || 'Xatolik yuz berdi');
    }
  };

  const handleLogout = async () => {
    await api.teacherLogout();
    onBack();
  };

  const exportCsv = () => {
    if (!dashboard) return;
    const rows = [
      ['№', 'ID', 'Familiya', 'Ism', 'Variant', 'Ball', 'Foiz', 'Baho', 'Holat', 'Hodisalar'],
    ];

    const sorted = getSortedStudents();
    sorted.forEach((s, idx) => {
      rows.push([
        String(idx + 1),
        String(s.studentId),
        s.lastName,
        s.firstName,
        `Variant №${s.formId}`,
        String(s.scoreReport?.scorePoints ?? s.answeredCount),
        `${s.scoreReport?.percentage ?? 0}%`,
        String(s.scoreReport?.grade ?? '-'),
        s.status === 'FINISHED' ? t.dashStatusDone : s.isOnline ? t.dashStatusWorking : t.dashStatusOffline,
        String(s.securityEvents?.totalSuspicious ?? 0),
      ]);
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map((e) => e.join(';')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `HEMIS_Imtihon_Bayonnoma_${dashboard.game.code}.csv`);
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
      <div className="min-h-screen bg-[#f4f6f9] flex items-center justify-center p-4 text-gray-600">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-[#25718f] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold tracking-wide uppercase text-gray-500 font-mono">
            {t.brand}...
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
    <div className="min-h-screen bg-[#f4f6f9] text-[#222d32] p-3 sm:p-5 select-none max-w-7xl mx-auto space-y-4 font-sans">
      {/* Top Header Card */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
              title="Bosh sahifaga"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold tracking-wider uppercase text-[#25718f] bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded font-mono">
                  {t.dashBadge}
                </span>
                <span
                  className={`text-[11px] px-2.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                    isWaiting
                      ? 'bg-amber-100 text-amber-800'
                      : isInProgress
                      ? 'bg-cyan-100 text-[#25718f] animate-pulse'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {isWaiting ? t.dashStatusWaiting : isInProgress ? t.dashStatusInProgress : t.dashStatusFinished}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight mt-1">
                {t.dashHeading}
              </h1>
              <p className="text-xs text-gray-500 font-mono">
                {t.dashSession} #{game.id.slice(0, 8).toUpperCase()} • Matematika (5-sinf / 1-kurs, 20 ta savol)
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Language Selector */}
            <div className="bg-[#25718f] rounded">
              <LanguageSelector />
            </div>

            {/* Sessions History Button */}
            <button
              onClick={handleOpenSessionsModal}
              className="p-2.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 transition-colors flex items-center gap-1.5 text-xs font-semibold"
              title={t.dashSessionsBtn}
            >
              <Layers className="w-4 h-4 text-[#25718f]" />
              <span className="hidden sm:inline">{t.dashSessionsBtn}</span>
            </button>

            {/* New Exam Session Button */}
            <button
              onClick={() => setShowNewExamModal(true)}
              className="p-2.5 rounded bg-emerald-50 hover:bg-emerald-100 text-[#00a65a] border border-emerald-300 transition-colors flex items-center gap-1.5 text-xs font-semibold"
              title={t.dashNewExamBtn}
            >
              <PlusCircle className="w-4 h-4" />
              <span className="hidden sm:inline">{t.dashNewExamBtn}</span>
            </button>

            {/* Edit KIM Questions & Answers Button */}
            {onOpenImport && (
              <button
                onClick={onOpenImport}
                className="p-2.5 rounded bg-cyan-50 hover:bg-cyan-100 text-[#25718f] border border-cyan-300 transition-colors flex items-center gap-1.5 text-xs font-semibold"
                title={t.dashEditQuestionsBtn}
              >
                <FileEdit className="w-4 h-4" />
                <span className="hidden md:inline">{t.dashEditQuestionsBtn}</span>
              </button>
            )}

            {/* Proctor Test Preview Button */}
            {onStartProctorPreview && (
              <button
                onClick={() => setShowProctorPreviewModal(true)}
                className="p-2.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 transition-colors flex items-center gap-1.5 text-xs font-bold shadow-sm"
                title={t.dashProctorPreviewDesc}
              >
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                <span className="hidden sm:inline">{t.dashProctorPreviewBtn}</span>
              </button>
            )}

            <button
              onClick={() => gameId && loadDashboard(gameId)}
              className="p-2.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors flex items-center gap-1.5 text-xs font-semibold"
              title={t.dashRefresh}
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">{t.dashRefresh}</span>
            </button>

            <button
              onClick={handleLogout}
              className="p-2.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors flex items-center gap-1.5 text-xs font-mono font-semibold"
              title={t.dashLogout}
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">{t.dashLogout}</span>
            </button>

            {isFinished && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => gameId && api.downloadExcel(gameId, game.code)}
                  className="py-2.5 px-4 rounded bg-[#00a65a] hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow transition-all active:scale-95"
                  title="Excel (.xlsx)"
                >
                  <FileSpreadsheet className="w-4 h-4 text-white" />
                  <span>{t.dashExcel}</span>
                </button>

                <button
                  onClick={exportCsv}
                  className="py-2.5 px-3 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs flex items-center gap-1 border border-gray-300 transition-colors"
                  title="CSV"
                >
                  <Download className="w-4 h-4" />
                  <span>{t.dashCsv}</span>
                </button>
              </div>
            )}

            {isWaiting && (
              <button
                disabled={starting || totalConnected === 0}
                onClick={handleStartGame}
                className="py-2.5 px-6 rounded bg-[#25718f] hover:bg-[#1f5f79] active:scale-98 text-white font-black text-xs uppercase tracking-wider shadow flex items-center gap-2 transition-all disabled:opacity-50 disabled:pointer-events-none"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>{starting ? t.dashStarting : t.dashStartExam}</span>
              </button>
            )}

            {isInProgress && (
              <button
                onClick={() => setShowFinishConfirm(true)}
                className="py-2.5 px-4 rounded bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow transition-colors"
              >
                <Square className="w-4 h-4 fill-white" />
                <span>{t.dashFinishAll}</span>
              </button>
            )}
          </div>
        </div>

        {/* Status metric badges */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {/* Game Code Card */}
          <div className="p-3 rounded bg-gray-50 border border-gray-200 space-y-0.5">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-mono">
              {t.dashPinLabel}
            </span>
            <div className="text-2xl sm:text-3xl font-black font-mono tracking-widest text-[#25718f]">
              {game.code}
            </div>
          </div>

          {/* Connected Candidates */}
          <div className="p-3 rounded bg-gray-50 border border-gray-200 space-y-0.5">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1 font-mono">
              <Users className="w-3 h-3 text-gray-400" />
              <span>{t.dashAttendees}</span>
            </span>
            <div className="text-2xl sm:text-3xl font-black font-mono text-gray-900">
              {totalConnected} <span className="text-xs text-gray-400 font-semibold">/ {maxStudents}</span>
            </div>
          </div>

          {/* Exam Status & Progress */}
          <div className="p-3 rounded bg-gray-50 border border-gray-200 space-y-0.5">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1 font-mono">
              <Activity className="w-3 h-3 text-gray-400" />
              <span>{t.dashSubmitted}</span>
            </span>
            <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-600">
              {finishedCount} <span className="text-xs text-gray-400 font-semibold">/ {students.length}</span>
            </div>
          </div>

          {/* Timer status */}
          <div className="p-3 rounded bg-gray-50 border border-gray-200 space-y-0.5">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1 font-mono">
              <Clock className="w-3 h-3 text-gray-400" />
              <span>{isInProgress ? t.dashTimeRemaining : t.dashTimeDuration}</span>
            </span>
            <div>
              {isInProgress && game.ends_at ? (
                <TimerDisplay
                  endsAt={game.ends_at}
                  onExpire={() => gameId && loadDashboard(gameId)}
                />
              ) : (
                <div className="text-xl sm:text-2xl font-bold font-mono text-gray-900">
                  {Math.round(game.total_time_seconds / 60)} daq
                </div>
              )}
            </div>
          </div>

          {/* Security alerts badge */}
          <div className="p-3 rounded bg-gray-50 border border-gray-200 space-y-0.5">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1 font-mono">
              {totalIncidents > 0 ? (
                <ShieldAlert className="w-3 h-3 text-rose-500" />
              ) : (
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
              )}
              <span>{t.dashIncidents}</span>
            </span>
            <div className={`text-2xl sm:text-3xl font-black font-mono ${totalIncidents > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {totalIncidents}
            </div>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="p-3 rounded bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Student Roster Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2 uppercase tracking-wide">
              <Layers className="w-4 h-4 text-[#25718f]" />
              <span>{t.dashTableTitle}</span>
              <span className="text-xs font-mono font-bold text-[#25718f] bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200">
                {students.length} nafar
              </span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {t.dashTableSub}
            </p>
          </div>

          {isFinished && (
            <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              {t.dashGradesCalculated}
            </span>
          )}
        </div>

        {students.length === 0 ? (
          <div className="py-16 text-center text-gray-500 text-sm space-y-2">
            <Users className="w-10 h-10 mx-auto text-gray-300" />
            <p className="font-semibold text-gray-700">{t.dashEmptyTitle}</p>
            <p className="text-xs text-gray-400">
              {t.dashEmptyHint} <strong className="text-[#25718f] font-mono text-base">{game.code}</strong>
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs font-semibold uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th
                    onClick={() => toggleSort('id')}
                    className="py-3 px-4 cursor-pointer hover:text-gray-900"
                  >
                    <div className="flex items-center gap-1">
                      <span>{t.dashThId}</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    onClick={() => toggleSort('name')}
                    className="py-3 px-4 cursor-pointer hover:text-gray-900"
                  >
                    <div className="flex items-center gap-1">
                      <span>{t.dashThStudent}</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="py-3 px-4">{t.dashThVariant}</th>
                  <th className="py-3 px-4">{t.dashThStatus}</th>
                  <th
                    onClick={() => toggleSort(isFinished ? 'score' : 'progress')}
                    className="py-3 px-4 cursor-pointer hover:text-gray-900"
                  >
                    <div className="flex items-center gap-1">
                      <span>{isFinished ? t.dashThScore : t.dashThProgress}</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  {isFinished && (
                    <th
                      onClick={() => toggleSort('grade')}
                      className="py-3 px-4 cursor-pointer hover:text-gray-900"
                    >
                      <div className="flex items-center gap-1">
                        <span>{t.dashThGrade}</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                  )}
                  <th
                    onClick={() => toggleSort('suspicious')}
                    className="py-3 px-4 cursor-pointer hover:text-gray-900"
                  >
                    <div className="flex items-center gap-1">
                      <span>{t.dashThSecurity}</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {sortedStudents.map((st) => {
                  const susp = st.securityEvents?.totalSuspicious || 0;
                  const isOnline = st.isOnline;
                  const rep = st.scoreReport;

                  return (
                    <tr
                      key={st.studentId}
                      className="hover:bg-gray-50/70 transition-colors"
                    >
                      {/* ID */}
                      <td className="py-3 px-4 font-mono font-bold text-[#25718f]">
                        #{String(st.studentId).padStart(2, '0')}
                      </td>

                      {/* Name */}
                      <td className="py-3 px-4 font-bold text-gray-900">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${
                              isOnline ? 'bg-emerald-500' : 'bg-gray-300'
                            }`}
                            title={isOnline ? 'Onlayn' : 'Oflayn'}
                          />
                          <span>
                            {st.lastName} {st.firstName}
                          </span>
                        </div>
                      </td>

                      {/* Variant */}
                      <td className="py-3 px-4 font-mono text-gray-700">
                        <span className="px-2 py-0.5 rounded bg-gray-100 border border-gray-200 text-xs">
                          Variant №{String(st.formId).padStart(2, '0')}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block text-xs px-2.5 py-0.5 rounded font-semibold ${
                            st.status === 'FINISHED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : isOnline
                              ? 'bg-cyan-100 text-[#25718f]'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {st.status === 'FINISHED' ? t.dashStatusDone : isOnline ? t.dashStatusWorking : t.dashStatusOffline}
                        </span>
                      </td>

                      {/* Progress / Score */}
                      <td className="py-3 px-4 font-mono font-bold">
                        {isFinished && rep ? (
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-gray-900 text-base">{rep.scorePoints}</span>
                            <span className="text-xs text-gray-400">/ 20</span>
                            <span className="text-xs text-[#25718f] font-normal">({rep.percentage}%)</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-800">{st.answeredCount} / 20</span>
                            <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden hidden sm:block">
                              <div
                                className="h-full bg-[#25718f] rounded-full transition-all duration-300"
                                style={{ width: `${Math.round((st.answeredCount / 20) * 100)}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Grade */}
                      {isFinished && (
                        <td className="py-3 px-4 font-mono font-extrabold text-base">
                          {rep ? (
                            <span
                              className={`px-2.5 py-0.5 rounded inline-block border ${
                                rep.grade === 5
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                  : rep.grade === 4
                                  ? 'bg-blue-100 text-blue-800 border-blue-300'
                                  : rep.grade === 3
                                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                                  : 'bg-rose-100 text-rose-800 border-rose-300'
                              }`}
                            >
                              {rep.grade}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                      )}

                      {/* Suspicious Events */}
                      <td className="py-3 px-4">
                        {susp > 0 ? (
                          <span
                            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200 font-mono font-bold"
                            title={`Hodisalar: ${susp}`}
                          >
                            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                            <span>{susp} {t.dashSecurityIncident}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded text-emerald-700 bg-emerald-50 border border-emerald-200">
                            <ShieldCheck className="w-3 h-3" />
                            <span>{t.dashSecurityClean}</span>
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
        title={t.dashFinishModalTitle}
        variant="danger"
        confirmText={t.dashFinishModalConfirm}
        cancelText={t.dashFinishModalCancel}
        onConfirm={handleFinishGame}
      >
        <p className="text-sm leading-relaxed text-gray-700">
          {t.dashFinishModalText}
        </p>
      </Modal>

      {/* Sessions History Modal */}
      <Modal
        isOpen={showSessionsModal}
        onClose={() => setShowSessionsModal(false)}
        title={t.dashSessionsModalTitle}
        cancelText={t.dashFinishModalCancel}
      >
        <div className="space-y-3">
          <p className="text-xs text-gray-500 font-mono">
            {t.dashSessionsModalSub}
          </p>

          {loadingGames ? (
            <div className="py-8 flex justify-center items-center">
              <div className="w-6 h-6 border-2 border-[#25718f] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : recentGames.length === 0 ? (
            <div className="py-6 text-center text-xs text-gray-500 font-mono">
              {t.dashSessionsNoGames}
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto space-y-2 pr-1 divide-y divide-gray-100">
              {recentGames.map((rg) => {
                const isCurrent = rg.id === gameId;
                const dateStr = new Date(rg.created_at).toLocaleString();
                return (
                  <div
                    key={rg.id}
                    className={`pt-2.5 pb-2.5 px-3 rounded flex items-center justify-between gap-3 transition-colors ${
                      isCurrent ? 'bg-cyan-50 border border-cyan-200' : 'hover:bg-gray-50 border border-gray-100'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-base text-[#25718f]">
                          PIN: {rg.code}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                            rg.status === 'WAITING'
                              ? 'bg-amber-100 text-amber-800'
                              : rg.status === 'IN_PROGRESS'
                              ? 'bg-cyan-100 text-[#25718f]'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {rg.status === 'WAITING'
                            ? t.dashStatusWaiting
                            : rg.status === 'IN_PROGRESS'
                            ? t.dashStatusInProgress
                            : t.dashStatusFinished}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] bg-[#25718f] text-white font-bold px-1.5 py-0.5 rounded uppercase">
                            {t.dashSessionsActiveBadge}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-500 font-mono">
                        {dateStr} • {rg.student_count} {t.dashSessionsStudentsCount}
                      </div>
                    </div>

                    <div>
                      {isCurrent ? (
                        <span className="text-xs font-bold text-[#25718f] font-mono px-3 py-1.5 bg-white rounded border border-cyan-200 inline-block">
                          ✓ {t.dashSessionsActiveBadge}
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSelectGame(rg.id)}
                          className="px-3 py-1.5 rounded bg-[#25718f] hover:bg-[#1f5f79] text-white font-bold text-xs transition-colors"
                        >
                          {t.dashSessionsOpenBtn}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      {/* New Exam Session Confirm Modal */}
      <Modal
        isOpen={showNewExamModal}
        onClose={() => setShowNewExamModal(false)}
        title={t.dashNewExamConfirmTitle}
        confirmText={t.dashNewExamConfirmBtn}
        cancelText={t.dashFinishModalCancel}
        onConfirm={async () => {
          setShowNewExamModal(false);
          await handleCreateGame();
        }}
      >
        <p className="text-sm leading-relaxed text-gray-700">
          {t.dashNewExamConfirmText}
        </p>
      </Modal>

      {/* Proctor Preview Modal */}
      <Modal
        isOpen={showProctorPreviewModal}
        title={t.dashProctorPreviewModalTitle}
        onClose={() => setShowProctorPreviewModal(false)}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 leading-relaxed">
            {t.dashProctorPreviewModalText}
          </p>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-700" />
              <span>{t.proctorBannerTitle}</span>
            </div>
            <div>• {t.proctorBannerSub}</div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 block">
              {t.editorSelectVariant} (1–50)
            </label>
            <select
              value={previewVariantNumber}
              onChange={(e) => setPreviewVariantNumber(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded font-mono text-sm focus:ring-2 focus:ring-[#25718f] focus:outline-none"
            >
              {Array.from({ length: 50 }, (_, i) => i + 1).map((num) => (
                <option key={num} value={num}>
                  {num}-variant (20 ta savol / 20 вопросов)
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setShowProctorPreviewModal(false)}
              className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs transition-colors"
            >
              {t.dashFinishModalCancel}
            </button>
            <button
              onClick={() => {
                setShowProctorPreviewModal(false);
                onStartProctorPreview?.(previewVariantNumber);
              }}
              className="px-4 py-2 rounded bg-[#00a65a] hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider transition-colors shadow flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{t.dashProctorPreviewStartBtn}</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
