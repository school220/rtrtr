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
  BookOpen,
  UserX,
  Menu,
  X,
  Sparkles,
  Copy,
  Check,
  Search,
} from 'lucide-react';
import { TimerDisplay } from '../components/TimerDisplay.js';
import { Modal } from '../components/Modal.js';
import { api, TeacherDashboardResponse, CustomTestDetail } from '../services/api.js';
import { useLanguage } from '../context/LanguageContext.js';
import { LanguageSelector } from '../components/LanguageSelector.js';
import { CustomTestEditorModal } from '../components/CustomTestEditorModal.js';

interface TeacherDashboardProps {
  socket: Socket | null;
  onBack: () => void;
  onOpenImport?: () => void;
  onOpenCustomTests?: () => void;
  activeGameId?: string;
  onStartProctorPreview?: (formId: number) => void;
}

type SortField = 'id' | 'name' | 'progress' | 'grade' | 'score' | 'suspicious';
type FilterStatus = 'all' | 'online' | 'finished' | 'suspicious';

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  socket,
  onBack,
  onOpenImport,
  onOpenCustomTests,
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
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showCreateTestModal, setShowCreateTestModal] = useState(false);
  const [previewVariantNumber, setPreviewVariantNumber] = useState(1);
  const [copiedCode, setCopiedCode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

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

  const [customMinutes, setCustomMinutes] = useState<string>('30');
  const [savingDuration, setSavingDuration] = useState<boolean>(false);

  // Disqualification state
  const [disqualifyTarget, setDisqualifyTarget] = useState<any | null>(null);
  const [disqualifyBy, setDisqualifyBy] = useState<'PROCTOR' | 'TEACHER'>('PROCTOR');
  const [disqualifyProctorReason, setDisqualifyProctorReason] = useState<string>('');
  const [disqualifyCustomReason, setDisqualifyCustomReason] = useState<string>('');
  const [disqualifying, setDisqualifying] = useState<boolean>(false);

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

    socket.emit('teacher:join', {
      gameId,
      teacherToken: sessionStorage.getItem('proctor_session_token') || undefined,
    });

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
      if (data?.game?.total_time_seconds) {
        setCustomMinutes(String(Math.round(data.game.total_time_seconds / 60)));
      }
    } catch (err: any) {
      setError(err.message || 'Xatolik yuz berdi');
    }
  };

  const handleSaveDuration = async () => {
    if (!gameId) return;
    const mins = parseInt(customMinutes, 10);
    if (isNaN(mins) || mins < 1 || mins > 120) {
      alert('Пожалуйста, введите время от 1 до 120 минут');
      return;
    }
    setSavingDuration(true);
    try {
      await api.updateGameDuration(gameId, mins);
      await loadDashboard(gameId);
    } catch (err: any) {
      alert(err.message || 'Не удалось обновить время теста');
    } finally {
      setSavingDuration(false);
    }
  };

  const handleQuickSetDuration = async (mins: number) => {
    if (!gameId || starting || dashboard?.game?.status !== 'WAITING') return;
    setCustomMinutes(String(mins));
    setSavingDuration(true);
    try {
      await api.updateGameDuration(gameId, mins);
      await loadDashboard(gameId);
    } catch (err: any) {
      alert(err.message || 'Не удалось обновить время теста');
    } finally {
      setSavingDuration(false);
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

  const handleLaunchCustomTestImmediately = async (savedTest: CustomTestDetail) => {
    setShowCreateTestModal(false);
    setLoading(true);
    try {
      const res = await api.launchCustomTest(savedTest.id);
      setGameId(res.gameId);
      localStorage.setItem('teacher_active_game_id', res.gameId);
      await loadDashboard(res.gameId);
    } catch (err: any) {
      alert(err.message || 'Ошибка запуска теста');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (!dashboard?.game?.code) return;
    navigator.clipboard.writeText(dashboard.game.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
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

  const openDisqualifyModal = (st: any) => {
    setDisqualifyTarget(st);
    setDisqualifyBy('PROCTOR');
    setDisqualifyProctorReason(t.disqualifyProctorReason1);
    setDisqualifyCustomReason('');
  };

  const handleConfirmDisqualify = async () => {
    if (!gameId || !disqualifyTarget) return;
    const reason = disqualifyBy === 'PROCTOR' ? disqualifyProctorReason : disqualifyCustomReason.trim();
    if (!reason) {
      alert(t.disqualifyReasonLabel);
      return;
    }
    setDisqualifying(true);
    try {
      await api.disqualifyStudent(gameId, disqualifyTarget.studentId, {
        disqualifiedBy: disqualifyBy,
        reason,
      });
      setDisqualifyTarget(null);
      await loadDashboard(gameId);
    } catch (err: any) {
      alert(err.message || 'Xatolik yuz berdi');
    } finally {
      setDisqualifying(false);
    }
  };

  if (loading || !dashboard) {
    return (
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center p-4 text-slate-300">
        <div className="flex flex-col items-center gap-4 bg-slate-900/80 border border-slate-800 p-8 rounded-3xl backdrop-blur-xl shadow-2xl">
          <div className="w-10 h-10 border-3 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <div className="text-center space-y-1">
            <span className="text-xs font-black tracking-widest uppercase text-cyan-400 font-mono block">
              HEMIS EXAM CENTER
            </span>
            <span className="text-xs text-slate-400">Синхронизация данных экзаменатора...</span>
          </div>
        </div>
      </div>
    );
  }

  const { game, students, totalConnected, maxStudents } = dashboard;
  const isWaiting = game.status === 'WAITING';
  const isInProgress = game.status === 'IN_PROGRESS';
  const isFinished = game.status === 'FINISHED' || game.status === 'TIME_EXPIRED';
  const sortedStudents = getSortedStudents();

  // Search and Filtered students
  const filteredStudents = sortedStudents.filter((st) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      query === '' ||
      `${st.lastName} ${st.firstName}`.toLowerCase().includes(query) ||
      String(st.studentId).includes(query);

    if (!matchesSearch) return false;

    if (filterStatus === 'online') return st.isOnline;
    if (filterStatus === 'finished') return st.status === 'FINISHED';
    if (filterStatus === 'suspicious') return (st.securityEvents?.totalSuspicious || 0) > 0;
    return true;
  });

  // Aggregate security incidents
  const totalIncidents = students.reduce((acc, st) => acc + (st.securityEvents?.totalSuspicious || 0), 0);
  const finishedCount = students.filter((s) => s.status === 'FINISHED').length;
  const attendanceRate = Math.min(100, Math.round((totalConnected / Math.max(1, maxStudents)) * 100));

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 p-3 sm:p-6 pt-safe pb-safe select-none max-w-7xl mx-auto space-y-5 font-sans relative overflow-x-hidden">
      {/* Background Decorative Ambient Gradients */}
      <div className="fixed top-[-15%] left-[20%] w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed top-[30%] right-[10%] w-[450px] h-[450px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* ========================================================= */}
      {/* 1. TOP EXECUTIVE HEADER CARD */}
      {/* ========================================================= */}
      <header className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/90 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          {/* Left: Brand, Teacher & Status */}
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={onBack}
              className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all border border-slate-700/60 shadow-sm active:scale-95"
              title="Выйти в меню"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-black tracking-widest uppercase text-cyan-300 bg-cyan-950/80 border border-cyan-800/80 px-2.5 py-0.5 rounded-md font-mono flex items-center gap-1.5 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  HEMIS PROCTOR
                </span>

                <span className="text-[10px] font-black tracking-wider uppercase text-purple-300 bg-purple-950/80 border border-purple-800/80 px-2.5 py-0.5 rounded-md font-mono flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-400" />
                  <span>{api.getTeacherInfo()?.fullName || 'Экзаменатор'}</span>
                </span>

                <span
                  className={`text-[10px] px-2.5 py-0.5 rounded-md font-black uppercase tracking-wider font-mono border ${
                    isWaiting
                      ? 'bg-amber-950/60 border-amber-600/60 text-amber-300'
                      : isInProgress
                      ? 'bg-cyan-950/80 border-cyan-500/80 text-cyan-300 animate-pulse'
                      : 'bg-emerald-950/60 border-emerald-600/60 text-emerald-300'
                  }`}
                >
                  {isWaiting ? t.dashStatusWaiting : isInProgress ? t.dashStatusInProgress : t.dashStatusFinished}
                </span>
              </div>

              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1.5 flex items-center gap-2">
                <span>{t.dashHeading}</span>
              </h1>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                {t.dashSession} #{game.id.slice(0, 8).toUpperCase()} • {game.title || 'Математика'}
              </p>
            </div>
          </div>

          {/* Right: Studio Launcher & Global Controls */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* HERO BUTTON: FULLSCREEN TEST STUDIO */}
            <button
              onClick={() => setShowCreateTestModal(true)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-cyan-500/20 active:scale-95 transition-all group"
              title="Открыть полноэкранную студию создания тестов"
            >
              <Sparkles className="w-4 h-4 text-slate-950 group-hover:rotate-12 transition-transform" />
              <span>Создать тест</span>
            </button>

            {/* Quick Refresh */}
            <button
              onClick={() => gameId && loadDashboard(gameId)}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all border border-slate-700/60 shadow-sm active:scale-95"
              title={t.dashRefresh}
            >
              <RefreshCw className="w-4 h-4 text-cyan-400" />
            </button>

            {/* Slide Drawer Toggle */}
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all active:scale-95 border border-slate-700/80 group"
            >
              <Menu className="w-4 h-4 text-cyan-400 group-hover:rotate-90 transition-transform duration-200" />
              <span className="hidden sm:inline">Меню</span>
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            </button>

            {/* Excel Download on Finished */}
            {isFinished && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => gameId && api.downloadExcel(gameId, game.code)}
                  className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                  title="Excel (.xlsx)"
                >
                  <FileSpreadsheet className="w-4 h-4 text-slate-950" />
                  <span>{t.dashExcel}</span>
                </button>

                <button
                  onClick={exportCsv}
                  className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1 border border-slate-700 transition-colors"
                  title="CSV"
                >
                  <Download className="w-4 h-4" />
                  <span>{t.dashCsv}</span>
                </button>
              </div>
            )}

            {/* Start Button */}
            {isWaiting && (
              <button
                disabled={starting || totalConnected === 0}
                onClick={handleStartGame}
                className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
              >
                <Play className="w-4 h-4 fill-slate-950 text-slate-950" />
                <span>{starting ? t.dashStarting : t.dashStartExam}</span>
              </button>
            )}

            {/* Finish Button */}
            {isInProgress && (
              <button
                onClick={() => setShowFinishConfirm(true)}
                className="py-2.5 px-4 rounded-xl bg-rose-600/90 hover:bg-rose-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-rose-900/30 transition-all active:scale-95 border border-rose-500/50"
              >
                <Square className="w-4 h-4 fill-white" />
                <span>{t.dashFinishAll}</span>
              </button>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* 2. HIGH-TECH KPI CARDS GRID */}
        {/* ========================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* Card 1: Game PIN Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-800/80 to-slate-900/90 border border-slate-700/80 space-y-1.5 shadow-lg relative group overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                {t.dashPinLabel}
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="p-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-cyan-300 hover:text-white transition-all text-xs flex items-center gap-1"
                title="Скопировать код"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="text-[10px] font-mono">{copiedCode ? 'Скопировано!' : 'Копировать'}</span>
              </button>
            </div>
            <div className="text-3xl sm:text-4xl font-black font-mono tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 py-0.5">
              {game.code}
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-1">
              <span>Для входа кандидатов</span>
            </div>
          </div>

          {/* Card 2: Connected Candidates */}
          <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-2 shadow-lg">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-between font-mono">
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                <span>{t.dashAttendees}</span>
              </span>
              <span className="text-cyan-400 font-bold">{attendanceRate}%</span>
            </span>
            <div className="text-2xl sm:text-3xl font-black font-mono text-white">
              {totalConnected} <span className="text-xs text-slate-400 font-semibold font-mono">/ {maxStudents}</span>
            </div>
            <div className="w-full bg-slate-700/60 h-2 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-cyan-500 to-teal-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${attendanceRate}%` }}
              />
            </div>
          </div>

          {/* Card 3: Submitted Work */}
          <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-2 shadow-lg">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-between font-mono">
              <span className="flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t.dashSubmitted}</span>
              </span>
              <span className="text-emerald-400 font-bold">
                {students.length > 0 ? Math.round((finishedCount / students.length) * 100) : 0}%
              </span>
            </span>
            <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-400">
              {finishedCount} <span className="text-xs text-slate-400 font-semibold font-mono">/ {students.length}</span>
            </div>
            <div className="w-full bg-slate-700/60 h-2 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500"
                style={{
                  width: `${students.length > 0 ? Math.round((finishedCount / students.length) * 100) : 0}%`,
                }}
              />
            </div>
          </div>

          {/* Card 4: Exam Duration / Live Timer */}
          <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-1.5 shadow-lg">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-between font-mono">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span>{isInProgress ? t.dashTimeRemaining : t.dashTimeDuration}</span>
              </span>
              {isWaiting && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-600/40 font-bold uppercase font-mono">
                  {t.dashSetDuration}
                </span>
              )}
            </span>

            <div>
              {isInProgress && game.ends_at ? (
                <div className="text-2xl font-black font-mono text-cyan-300">
                  <TimerDisplay
                    endsAt={game.ends_at}
                    onExpire={() => gameId && loadDashboard(gameId)}
                  />
                </div>
              ) : isWaiting ? (
                <div className="space-y-1.5 pt-0.5">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={customMinutes}
                      onChange={(e) => setCustomMinutes(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveDuration();
                      }}
                      className="w-14 px-2 py-0.5 text-xs font-mono font-black border border-slate-600 rounded bg-slate-900 text-white focus:ring-1 focus:ring-cyan-400 focus:outline-none"
                      title="Введите минуты"
                    />
                    <span className="text-xs font-mono text-slate-300">{t.dashDurationMinLabel}</span>
                    <button
                      type="button"
                      disabled={savingDuration || !customMinutes}
                      onClick={handleSaveDuration}
                      className="ml-auto px-2 py-0.5 text-[10px] font-mono font-bold bg-cyan-600 hover:bg-cyan-500 text-slate-950 rounded transition-colors disabled:opacity-50 shadow-xs"
                      title="Сохранить время"
                    >
                      {savingDuration ? '...' : t.dashSaveDuration}
                    </button>
                  </div>

                  {/* Fast selection pills */}
                  <div className="flex flex-wrap items-center gap-1">
                    {[15, 20, 25, 30, 45, 60].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        disabled={savingDuration}
                        onClick={() => handleQuickSetDuration(mins)}
                        className={`px-1.5 py-0.5 text-[10px] font-mono font-bold rounded transition-all ${
                          Math.round(game.total_time_seconds / 60) === mins
                            ? 'bg-cyan-500 text-slate-950 shadow-xs scale-105'
                            : 'bg-slate-700/80 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {mins}м
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-2xl font-bold font-mono text-white">
                  {Math.round(game.total_time_seconds / 60)} {t.dashDurationMinLabel}
                </div>
              )}
            </div>
          </div>

          {/* Card 5: Security & Anti-Cheat Incidents */}
          <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-1.5 shadow-lg">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-between font-mono">
              <span className="flex items-center gap-1">
                {totalIncidents > 0 ? (
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span>{t.dashIncidents}</span>
              </span>
              <span className={`text-[10px] font-bold uppercase font-mono ${totalIncidents > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {totalIncidents > 0 ? 'Внимание' : 'Чисто'}
              </span>
            </span>

            <div className={`text-2xl sm:text-3xl font-black font-mono ${totalIncidents > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {totalIncidents}
            </div>

            <div className="text-[11px] text-slate-400 font-mono">
              {totalIncidents === 0 ? 'Нарушений не зафиксировано' : 'Зафиксированы попытки списания'}
            </div>
          </div>
        </div>
      </header>

      {/* Global Error Banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2.5 backdrop-blur-md">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. MAIN STUDENT ROSTER DATAGRID CARD */}
      {/* ========================================================= */}
      <section className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/90 rounded-3xl overflow-hidden shadow-2xl">
        {/* Datagrid Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-950/80 border border-cyan-800/60 flex items-center justify-center text-cyan-400">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white flex items-center gap-2 uppercase tracking-wide">
                <span>{t.dashTableTitle}</span>
                <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
                  {students.length}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {t.dashTableSub}
              </p>
            </div>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex items-center gap-2.5 flex-wrap flex-1 justify-end max-w-xl">
            {/* Search Input */}
            <div className="relative min-w-[200px] flex-1 sm:flex-initial">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по имени или ID..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-800/90 border border-slate-700/80 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick Status Filter Pills */}
            <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 text-xs">
              {(
                [
                  { id: 'all', label: `Все (${students.length})` },
                  { id: 'online', label: `Онлайн (${students.filter((s) => s.isOnline).length})` },
                  { id: 'finished', label: `Сдали (${finishedCount})` },
                  {
                    id: 'suspicious',
                    label: `Нарушения (${students.filter((s) => (s.securityEvents?.totalSuspicious || 0) > 0).length})`,
                  },
                ] as const
              ).map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setFilterStatus(chip.id)}
                  className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all ${
                    filterStatus === chip.id
                      ? 'bg-cyan-500 text-slate-950 shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Empty State or Table */}
        {filteredStudents.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-sm space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
              <Users className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-white text-base">
                {students.length === 0 ? t.dashEmptyTitle : 'Нет кандидатов по заданному фильтру'}
              </p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {students.length === 0 ? (
                  <>
                    {t.dashEmptyHint}{' '}
                    <strong className="text-cyan-400 font-mono text-base block mt-1 tracking-widest">{game.code}</strong>
                  </>
                ) : (
                  'Попробуйте изменить поисковый запрос или фильтр статуса'
                )}
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-800/90 text-slate-300 text-xs font-bold uppercase tracking-wider border-b border-slate-700/80">
                <tr>
                  <th
                    onClick={() => toggleSort('id')}
                    className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{t.dashThId}</span>
                      <ArrowUpDown className="w-3 h-3 text-cyan-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => toggleSort('name')}
                    className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{t.dashThStudent}</span>
                      <ArrowUpDown className="w-3 h-3 text-cyan-400" />
                    </div>
                  </th>
                  <th className="py-3.5 px-4">{t.dashThVariant}</th>
                  <th className="py-3.5 px-4">{t.dashThStatus}</th>
                  <th
                    onClick={() => toggleSort(isFinished ? 'score' : 'progress')}
                    className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{isFinished ? t.dashThScore : t.dashThProgress}</span>
                      <ArrowUpDown className="w-3 h-3 text-cyan-400" />
                    </div>
                  </th>
                  {isFinished && (
                    <th
                      onClick={() => toggleSort('grade')}
                      className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>{t.dashThGrade}</span>
                        <ArrowUpDown className="w-3 h-3 text-cyan-400" />
                      </div>
                    </th>
                  )}
                  <th
                    onClick={() => toggleSort('suspicious')}
                    className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{t.dashThSecurity}</span>
                      <ArrowUpDown className="w-3 h-3 text-cyan-400" />
                    </div>
                  </th>
                  <th className="py-3.5 px-4 text-center">{t.dashThActions}</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800 font-medium">
                {filteredStudents.map((st) => {
                  const susp = st.securityEvents?.totalSuspicious || 0;
                  const isOnline = st.isOnline;
                  const rep = st.scoreReport;
                  const initials = `${st.lastName?.charAt(0) || ''}${st.firstName?.charAt(0) || ''}`.toUpperCase();

                  return (
                    <tr
                      key={st.studentId}
                      className="hover:bg-slate-800/50 transition-colors group"
                    >
                      {/* ID */}
                      <td className="py-3.5 px-4 font-mono font-bold text-cyan-400">
                        #{String(st.studentId).padStart(2, '0')}
                      </td>

                      {/* Name with initials Avatar and Online status */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center font-bold text-xs text-white shadow-sm">
                              {initials || 'К'}
                            </div>
                            <span
                              className={`w-2.5 h-2.5 rounded-full absolute -bottom-0.5 -right-0.5 border-2 border-slate-900 ${
                                isOnline ? 'bg-emerald-400' : 'bg-slate-500'
                              }`}
                              title={isOnline ? 'В сети' : 'Офлайн'}
                            />
                          </div>

                          <div>
                            <span className="font-bold text-white text-sm block">
                              {st.lastName} {st.firstName}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              {isOnline ? 'Подключен к тесту' : 'Связь потеряна'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Variant */}
                      <td className="py-3.5 px-4 font-mono">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-300 font-semibold">
                          Вариант №{String(st.formId).padStart(2, '0')}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg font-bold uppercase tracking-wider font-mono border ${
                            st.status === 'DISQUALIFIED'
                              ? 'bg-rose-950/80 border-rose-600/80 text-rose-300'
                              : st.status === 'FINISHED'
                              ? 'bg-emerald-950/80 border-emerald-600/80 text-emerald-300'
                              : isOnline
                              ? 'bg-cyan-950/80 border-cyan-500/80 text-cyan-300'
                              : 'bg-slate-800 border-slate-700 text-slate-400'
                          }`}
                        >
                          {st.status === 'DISQUALIFIED' && <UserX className="w-3 h-3 text-rose-400" />}
                          {st.status === 'FINISHED' && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                          {st.status === 'DISQUALIFIED'
                            ? t.dashDisqualifiedBadge
                            : st.status === 'FINISHED'
                            ? t.dashStatusDone
                            : isOnline
                            ? t.dashStatusWorking
                            : t.dashStatusOffline}
                        </span>
                      </td>

                      {/* Progress / Score */}
                      <td className="py-3.5 px-4 font-mono font-bold">
                        {isFinished && rep ? (
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-white text-base">{rep.scorePoints}</span>
                            <span className="text-xs text-slate-400">/ 20</span>
                            <span className="text-xs text-cyan-400 font-semibold font-mono">({rep.percentage}%)</span>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs text-slate-300">
                              <span>{st.answeredCount} / 20</span>
                              <span className="text-slate-400 font-mono">
                                {Math.round((st.answeredCount / 20) * 100)}%
                              </span>
                            </div>
                            <div className="w-24 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-cyan-400 to-teal-400 rounded-full transition-all duration-300"
                                style={{ width: `${Math.round((st.answeredCount / 20) * 100)}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Grade */}
                      {isFinished && (
                        <td className="py-3.5 px-4 font-mono font-black text-base">
                          {rep ? (
                            <span
                              className={`px-3 py-1 rounded-xl inline-block border font-mono shadow-sm ${
                                rep.grade === 5
                                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/60'
                                  : rep.grade === 4
                                  ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/60'
                                  : rep.grade === 3
                                  ? 'bg-amber-950/80 text-amber-300 border-amber-500/60'
                                  : 'bg-rose-950/80 text-rose-300 border-rose-500/60'
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
                      <td className="py-3.5 px-4">
                        {susp > 0 ? (
                          <span
                            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-rose-950/80 text-rose-300 border border-rose-700 font-mono font-bold"
                            title={`Нарушения: ${susp}`}
                          >
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                            <span>{susp} инцидент(ов)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 font-mono">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Чисто</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center">
                        {st.status === 'DISQUALIFIED' ? (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-rose-950/40 text-rose-300 border border-rose-800/60 font-mono"
                            title={`${st.disqualifiedBy === 'PROCTOR' ? t.studentDisqualifiedProctorName : t.studentDisqualifiedTeacherName}: ${st.disqualificationReason || ''}`}
                          >
                            <UserX className="w-3.5 h-3.5 text-rose-400" />
                            <span>Исключен</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openDisqualifyModal(st)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-300 bg-rose-950/60 hover:bg-rose-900/80 border border-rose-700/60 rounded-xl transition-all active:scale-95 shadow-sm"
                            title={t.dashDisqualifyBtn}
                          >
                            <UserX className="w-3.5 h-3.5 text-rose-400" />
                            <span>{t.dashDisqualifyBtn}</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ========================================================= */}
      {/* 4. MODALS */}
      {/* ========================================================= */}

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
        <p className="text-sm leading-relaxed text-slate-300">
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
        <div className="space-y-4">
          <p className="text-xs text-slate-400 font-mono">
            {t.dashSessionsModalSub}
          </p>

          {loadingGames ? (
            <div className="py-8 flex justify-center items-center">
              <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : recentGames.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400 font-mono">
              {t.dashSessionsNoGames}
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-800">
              {recentGames.map((rg) => {
                const isCurrent = rg.id === gameId;
                const dateStr = new Date(rg.created_at).toLocaleString();
                return (
                  <div
                    key={rg.id}
                    className={`pt-3 pb-3 px-3.5 rounded-xl flex items-center justify-between gap-3 transition-colors ${
                      isCurrent
                        ? 'bg-cyan-950/60 border border-cyan-600/60'
                        : 'hover:bg-slate-800/80 border border-slate-800'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-base text-cyan-400">
                          PIN: {rg.code}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider font-mono ${
                            rg.status === 'WAITING'
                              ? 'bg-amber-950/80 text-amber-300'
                              : rg.status === 'IN_PROGRESS'
                              ? 'bg-cyan-950/80 text-cyan-300'
                              : 'bg-emerald-950/80 text-emerald-300'
                          }`}
                        >
                          {rg.status === 'WAITING'
                            ? t.dashStatusWaiting
                            : rg.status === 'IN_PROGRESS'
                            ? t.dashStatusInProgress
                            : t.dashStatusFinished}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] bg-cyan-600 text-slate-950 font-black px-1.5 py-0.5 rounded uppercase font-mono">
                            {t.dashSessionsActiveBadge}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {dateStr} • {rg.student_count} {t.dashSessionsStudentsCount}
                      </div>
                    </div>

                    <div>
                      {isCurrent ? (
                        <span className="text-xs font-bold text-cyan-400 font-mono px-3 py-1.5 bg-slate-900 rounded-lg border border-cyan-600/60 inline-block">
                          ✓ Активна
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSelectGame(rg.id)}
                          className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs transition-colors"
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
        <p className="text-sm leading-relaxed text-slate-300">
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
          <p className="text-sm text-slate-300 leading-relaxed">
            {t.dashProctorPreviewModalText}
          </p>
          <div className="p-3 bg-amber-950/60 border border-amber-600/40 rounded-xl text-xs text-amber-200 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-amber-300">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>{t.proctorBannerTitle}</span>
            </div>
            <div>• {t.proctorBannerSub}</div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-200 block">
              {t.editorSelectVariant} (1–50)
            </label>
            <select
              value={previewVariantNumber}
              onChange={(e) => setPreviewVariantNumber(Number(e.target.value))}
              className="w-full px-3 py-2 border border-slate-700 bg-slate-800 rounded-xl font-mono text-sm text-white focus:ring-2 focus:ring-cyan-400 focus:outline-none"
            >
              {Array.from({ length: 50 }, (_, i) => i + 1).map((num) => (
                <option key={num} value={num} className="bg-slate-900 text-white">
                  {num}-variant (20 ta savol / 20 вопросов)
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setShowProctorPreviewModal(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
            >
              {t.dashFinishModalCancel}
            </button>
            <button
              onClick={() => {
                setShowProctorPreviewModal(false);
                onStartProctorPreview?.(previewVariantNumber);
              }}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all shadow-md flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{t.dashProctorPreviewStartBtn}</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Disqualification Modal */}
      {disqualifyTarget && (
        <Modal
          isOpen={!!disqualifyTarget}
          onClose={() => !disqualifying && setDisqualifyTarget(null)}
          title={t.disqualifyModalTitle}
        >
          <div className="space-y-4 text-sm text-slate-200">
            <div className="p-3.5 bg-slate-800/90 rounded-xl border border-slate-700">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono">
                {t.disqualifyStudentLabel}
              </span>
              <div className="text-base font-bold text-white mt-0.5">
                {disqualifyTarget.lastName} {disqualifyTarget.firstName} (№{disqualifyTarget.studentId})
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                {t.disqualifyAuthorityLabel}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <label
                  className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                    disqualifyBy === 'PROCTOR'
                      ? 'bg-cyan-950/60 border-cyan-500 text-white'
                      : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <input
                    type="radio"
                    name="disqualifyBy"
                    checked={disqualifyBy === 'PROCTOR'}
                    onChange={() => setDisqualifyBy('PROCTOR')}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="font-bold text-xs">{t.disqualifyByProctor}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      AI / автопрокторинг
                    </div>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                    disqualifyBy === 'TEACHER'
                      ? 'bg-cyan-950/60 border-cyan-500 text-white'
                      : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <input
                    type="radio"
                    name="disqualifyBy"
                    checked={disqualifyBy === 'TEACHER'}
                    onChange={() => setDisqualifyBy('TEACHER')}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="font-bold text-xs">{t.disqualifyByTeacher}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Ручное решение экзаменатора
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {disqualifyBy === 'PROCTOR' ? (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  {t.disqualifyReasonLabel}
                </label>
                <div className="space-y-1.5">
                  {[
                    t.disqualifyProctorReason1,
                    t.disqualifyProctorReason2,
                    t.disqualifyProctorReason3,
                    t.disqualifyProctorReason4,
                    t.disqualifyProctorReason5,
                  ].map((reasonText) => (
                    <label
                      key={reasonText}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                        disqualifyProctorReason === reasonText
                          ? 'border-cyan-500 bg-cyan-950/40 font-bold text-white'
                          : 'border-slate-700 hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="proctorReason"
                        checked={disqualifyProctorReason === reasonText}
                        onChange={() => setDisqualifyProctorReason(reasonText)}
                      />
                      <span>{reasonText}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  {t.disqualifyReasonLabel}
                </label>
                <textarea
                  rows={3}
                  value={disqualifyCustomReason}
                  onChange={(e) => setDisqualifyCustomReason(e.target.value)}
                  placeholder={t.disqualifyCustomReasonPlaceholder}
                  className="w-full p-3 text-xs border border-slate-700 rounded-xl bg-slate-800 text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-400 focus:outline-none"
                />
              </div>
            )}

            <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-xl text-rose-300 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{t.disqualifyWarning}</span>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={disqualifying}
                onClick={() => setDisqualifyTarget(null)}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white rounded-xl transition-colors"
              >
                {t.dashFinishModalCancel}
              </button>
              <button
                type="button"
                disabled={disqualifying || (disqualifyBy === 'TEACHER' && !disqualifyCustomReason.trim())}
                onClick={handleConfirmDisqualify}
                className="px-4 py-2 text-xs font-black text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-lg shadow-rose-900/30 transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                <UserX className="w-3.5 h-3.5" />
                <span>{disqualifying ? '...' : t.disqualifyConfirmBtn}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================= */}
      {/* 5. SLIDE-OUT SIDE DRAWER NAVIGATION */}
      {/* ========================================================= */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden animate-fade-in">
          {/* Dark Glassmorphic Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity"
            onClick={() => setIsDrawerOpen(false)}
          />

          {/* Drawer Panel */}
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-sm sm:max-w-md bg-[#0c121e] text-white shadow-2xl flex flex-col border-l border-slate-800">
              {/* Drawer Top Header */}
              <div className="p-5 border-b border-slate-800/90 flex items-center justify-between bg-slate-900/60">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-400 via-teal-400 to-[#25718f] flex items-center justify-center font-black text-slate-950 text-base shadow-md">
                    {(api.getTeacherInfo()?.fullName || 'П').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-white tracking-tight line-clamp-1">
                      {api.getTeacherInfo()?.fullName || 'Проверяющий'}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-cyan-950 border border-cyan-600/40 text-cyan-300 font-bold">
                        {api.getTeacherInfo()?.role || 'ЭКЗАМЕНАТОР'}
                      </span>
                      {api.getTeacherInfo()?.username && (
                        <span className="text-[11px] text-slate-400 font-mono">
                          @{api.getTeacherInfo()?.username}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* HERO ACTION: CREATE NEW TEST BUTTON */}
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-cyan-400 font-mono">
                    Быстрое создание:
                  </span>
                  <button
                    onClick={() => {
                      setIsDrawerOpen(false);
                      setShowCreateTestModal(true);
                    }}
                    className="w-full p-4 rounded-2xl bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 font-black shadow-xl flex items-center gap-3.5 transition-all transform hover:scale-[1.02] active:scale-[0.98] group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-950/20 flex items-center justify-center flex-shrink-0 group-hover:rotate-12 transition-transform">
                      <Sparkles className="w-6 h-6 text-slate-950" />
                    </div>
                    <div className="text-left flex-1">
                      <div className="font-black text-sm tracking-wide">
                        ✨ Создать новый тест
                      </div>
                      <div className="text-[11px] font-bold text-slate-900/80 mt-0.5">
                        Полноэкранная студия с вариантами и формулами Desmos
                      </div>
                    </div>
                  </button>
                </div>

                {/* Navigation Items */}
                <div className="space-y-1.5 pt-2">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 font-mono">
                    Разделы и функции:
                  </span>

                  {/* My Tests ("Мои тесты") */}
                  {onOpenCustomTests && (
                    <button
                      onClick={() => {
                        setIsDrawerOpen(false);
                        onOpenCustomTests();
                      }}
                      className="w-full p-3.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-white flex items-center gap-3 transition-colors text-xs font-semibold text-left shadow-sm group"
                    >
                      <div className="w-9 h-9 rounded-xl bg-purple-950/80 border border-purple-600/40 flex items-center justify-center text-purple-300 group-hover:scale-105 transition-transform">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className="text-white font-bold">{t.dashMyTestsBtn}</div>
                        <div className="text-[11px] text-slate-400">Список ваших авторских тестов</div>
                      </div>
                    </button>
                  )}

                  {/* New Exam Session */}
                  <button
                    onClick={() => {
                      setIsDrawerOpen(false);
                      setShowNewExamModal(true);
                    }}
                    className="w-full p-3.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-white flex items-center gap-3 transition-colors text-xs font-semibold text-left shadow-sm group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-emerald-950/80 border border-emerald-600/40 flex items-center justify-center text-emerald-300 group-hover:scale-105 transition-transform">
                      <PlusCircle className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="text-white font-bold">{t.dashNewExamBtn}</div>
                      <div className="text-[11px] text-slate-400">Создать новую комнату для экзамена</div>
                    </div>
                  </button>

                  {/* Edit KIM Questions */}
                  {onOpenImport && (
                    <button
                      onClick={() => {
                        setIsDrawerOpen(false);
                        onOpenImport();
                      }}
                      className="w-full p-3.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-white flex items-center gap-3 transition-colors text-xs font-semibold text-left shadow-sm group"
                    >
                      <div className="w-9 h-9 rounded-xl bg-cyan-950/80 border border-cyan-600/40 flex items-center justify-center text-cyan-300 group-hover:scale-105 transition-transform">
                        <FileEdit className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className="text-white font-bold">{t.dashEditQuestionsBtn}</div>
                        <div className="text-[11px] text-slate-400">Банк заданий и эталоны ответов</div>
                      </div>
                    </button>
                  )}

                  {/* Proctor Preview */}
                  {onStartProctorPreview && (
                    <button
                      onClick={() => {
                        setIsDrawerOpen(false);
                        setShowProctorPreviewModal(true);
                      }}
                      className="w-full p-3.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-white flex items-center gap-3 transition-colors text-xs font-semibold text-left shadow-sm group"
                    >
                      <div className="w-9 h-9 rounded-xl bg-amber-950/80 border border-amber-600/40 flex items-center justify-center text-amber-300 group-hover:scale-105 transition-transform">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className="text-white font-bold">{t.dashProctorPreviewBtn}</div>
                        <div className="text-[11px] text-slate-400">{t.dashProctorPreviewDesc}</div>
                      </div>
                    </button>
                  )}

                  {/* Sessions History */}
                  <button
                    onClick={() => {
                      setIsDrawerOpen(false);
                      handleOpenSessionsModal();
                    }}
                    className="w-full p-3.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-white flex items-center gap-3 transition-colors text-xs font-semibold text-left shadow-sm group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-blue-950/80 border border-blue-600/40 flex items-center justify-center text-blue-300 group-hover:scale-105 transition-transform">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="text-white font-bold">{t.dashSessionsBtn}</div>
                      <div className="text-[11px] text-slate-400">Журнал прошедших сессий</div>
                    </div>
                  </button>
                </div>

                {/* Language Selector */}
                <div className="space-y-1.5 pt-2 border-t border-slate-800">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 font-mono">
                    Язык интерфейса:
                  </span>
                  <div className="bg-slate-800/80 p-2 rounded-2xl border border-slate-700/60">
                    <LanguageSelector />
                  </div>
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="p-4 border-t border-slate-800/90 bg-slate-900/80">
                <button
                  onClick={() => {
                    setIsDrawerOpen(false);
                    handleLogout();
                  }}
                  className="w-full p-3.5 rounded-2xl bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/50 text-rose-300 flex items-center justify-center gap-2 transition-all active:scale-95 text-xs font-bold"
                >
                  <LogOut className="w-4 h-4 text-rose-400" />
                  <span>{t.dashLogout}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Test Editor Modal with Variants & Desmos Math Support */}
      <CustomTestEditorModal
        isOpen={showCreateTestModal}
        onClose={() => setShowCreateTestModal(false)}
        onSuccess={() => {
          setShowCreateTestModal(false);
          if (onOpenCustomTests) {
            onOpenCustomTests();
          }
        }}
        onLaunchImmediately={handleLaunchCustomTestImmediately}
      />
    </div>
  );
};
