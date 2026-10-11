import React, { useState, useEffect } from 'react';
import { Home } from './pages/Home.js';
import { StudentJoin } from './pages/StudentJoin.js';
import { StudentWaiting } from './pages/StudentWaiting.js';
import { StudentQuiz } from './pages/StudentQuiz.js';
import { StudentResult } from './pages/StudentResult.js';
import { TeacherLogin } from './pages/TeacherLogin.js';
import { TeacherDashboard } from './pages/TeacherDashboard.js';
import { TeacherImport } from './pages/TeacherImport.js';
import { useSocket } from './hooks/useSocket.js';
import { JoinGameResponse, StudentStateResponse, api } from './services/api.js';

type ViewMode =
  | 'home'
  | 'student_join'
  | 'student_waiting'
  | 'student_quiz'
  | 'student_result'
  | 'teacher_login'
  | 'teacher'
  | 'import';

/**
 * Checks if current browser URL corresponds to the private teacher/proctor portal
 */
const isTeacherRoute = (): boolean => {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.toLowerCase();
  const search = window.location.search.toLowerCase();
  return (
    path.startsWith('/teacher') ||
    path.startsWith('/proctor') ||
    path.startsWith('/admin') ||
    search.includes('role=teacher') ||
    search.includes('mode=teacher')
  );
};

export const App: React.FC = () => {
  // Path-aware initialization: /teacher routes load dedicated proctor portal
  const [view, setView] = useState<ViewMode>(() => {
    if (isTeacherRoute()) {
      return api.isTeacherAuthenticated() ? 'teacher' : 'teacher_login';
    }
    return 'home';
  });

  const [studentData, setStudentData] = useState<JoinGameResponse | null>(null);
  const [studentState, setStudentState] = useState<StudentStateResponse | null>(null);
  const [isProctorPreview, setIsProctorPreview] = useState(false);
  const [proctorReturnView, setProctorReturnView] = useState<'teacher' | 'import'>('teacher');
  const { socket } = useSocket();

  const clearStudentSession = () => {
    localStorage.removeItem('student_session_token');
    localStorage.removeItem('student_game_code');
    localStorage.removeItem('student_game_id');
    localStorage.removeItem('student_id');
    localStorage.removeItem('student_form_id');
    localStorage.removeItem('student_first_name');
    localStorage.removeItem('student_last_name');
    setStudentData(null);
    setStudentState(null);
  };

  // Browser navigation (Back / Forward button) handler
  useEffect(() => {
    const handlePopState = () => {
      if (isTeacherRoute()) {
        setView(api.isTeacherAuthenticated() ? 'teacher' : 'teacher_login');
      } else {
        const savedToken = localStorage.getItem('student_session_token');
        if (!savedToken) {
          setView('home');
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Launch proctor preview mode for variant 1..50
  const handleStartProctorPreview = async (formId: number = 1, returnTo: 'teacher' | 'import' = 'teacher') => {
    try {
      const previewData = await api.startProctorPreview(formId);
      setStudentData(previewData);
      setIsProctorPreview(true);
      setProctorReturnView(returnTo);
      setView('student_quiz');
    } catch (err: any) {
      alert(err.message || 'Ошибка запуска предпросмотра теста');
    }
  };

  // Exit proctor preview mode
  const handleExitProctorPreview = () => {
    setIsProctorPreview(false);
    setStudentData(null);
    setStudentState(null);
    setView(proctorReturnView);
  };

  // Check saved student session on initial load (only when not on teacher route)
  useEffect(() => {
    if (isTeacherRoute()) return;

    const savedToken = localStorage.getItem('student_session_token');
    const savedGameId = localStorage.getItem('student_game_id');
    const savedStudentId = localStorage.getItem('student_id');

    if (savedToken && savedGameId && savedStudentId) {
      const sId = parseInt(savedStudentId, 10);
      api
        .getStudentState(savedGameId, sId)
        .then((state) => {
          if (state.gameStatus === 'FINISHED' || state.student.status === 'FINISHED') {
            clearStudentSession();
            return;
          }

          setStudentState(state);
          setStudentData({
            isReconnection: true,
            gameId: state.gameId,
            gameCode: state.gameCode,
            gameStatus: state.gameStatus,
            studentId: state.student.studentId,
            formId: state.student.formId,
            firstName: state.student.firstName,
            lastName: state.student.lastName,
            sessionToken: savedToken,
            status: state.student.status,
            endsAt: state.endsAt,
          });

          if (state.gameStatus === 'IN_PROGRESS') {
            setView('student_quiz');
          } else {
            setView('student_waiting');
          }
        })
        .catch(() => {
          clearStudentSession();
        });
    }
  }, []);

  // Student Joined Event
  const handleStudentJoined = (data: JoinGameResponse) => {
    setStudentData(data);
    if (data.gameStatus === 'IN_PROGRESS') {
      setView('student_quiz');
    } else {
      setView('student_waiting');
    }
  };

  // Game Started Broadcast Event
  const handleGameStarted = (data: { startedAt: string; endsAt: string }) => {
    setStudentData((prev) =>
      prev
        ? {
            ...prev,
            gameStatus: 'IN_PROGRESS',
            endsAt: data.endsAt,
          }
        : null
    );
    setView('student_quiz');
  };

  // Test Finished Event
  const handleTestFinished = (finalState: StudentStateResponse) => {
    setStudentState(finalState);
    setView('student_result');
  };

  const handleStartNewTest = () => {
    clearStudentSession();
    setView('student_join');
  };

  // Reset to Student Home
  const handleResetHome = () => {
    if (view === 'student_result' || studentState?.student?.status === 'FINISHED') {
      clearStudentSession();
    }
    if (typeof window !== 'undefined' && window.location.pathname !== '/') {
      window.history.pushState(null, '', '/');
    }
    setView('home');
  };

  // Teacher Logout Handler
  const handleTeacherLogout = async () => {
    await api.teacherLogout();
    if (typeof window !== 'undefined' && window.location.pathname !== '/teacher') {
      window.history.replaceState(null, '', '/teacher');
    }
    setView('teacher_login');
  };

  return (
    <div className="min-h-screen bg-[#f4f6f9] text-[#222d32] font-sans">
      {/* 1. STUDENT PAGES (Pure Student Testing Portal, ZERO teacher links/buttons) */}
      {view === 'home' && (
        <Home
          onSelectRole={() => {
            setView('student_join');
          }}
        />
      )}

      {view === 'student_join' && (
        <StudentJoin
          onJoined={handleStudentJoined}
          onBack={handleResetHome}
        />
      )}

      {view === 'student_waiting' && studentData && (
        <StudentWaiting
          studentData={studentData}
          socket={socket}
          onGameStarted={handleGameStarted}
        />
      )}

      {view === 'student_quiz' && studentData && (
        <StudentQuiz
          gameId={studentData.gameId}
          studentId={studentData.studentId}
          socket={socket}
          onFinished={handleTestFinished}
          isProctorPreview={isProctorPreview}
          onExitPreview={handleExitProctorPreview}
        />
      )}

      {view === 'student_result' && studentState && (
        <StudentResult
          state={studentState}
          onHome={handleResetHome}
          onNewTest={handleStartNewTest}
          isProctorPreview={isProctorPreview}
          onExitPreview={handleExitProctorPreview}
        />
      )}

      {/* 2. DEDICATED TEACHER / PROCTOR PAGES (/teacher URL only) */}
      {view === 'teacher_login' && (
        <TeacherLogin
          onSuccess={() => {
            if (typeof window !== 'undefined' && window.location.pathname !== '/teacher') {
              window.history.replaceState(null, '', '/teacher');
            }
            setView('teacher');
          }}
        />
      )}

      {view === 'teacher' && (
        <TeacherDashboard
          socket={socket}
          onBack={handleTeacherLogout}
          onOpenImport={() => setView('import')}
          onStartProctorPreview={(formId) => handleStartProctorPreview(formId, 'teacher')}
        />
      )}

      {view === 'import' && (
        <TeacherImport
          onBack={() => setView('teacher')}
          onStartProctorPreview={(formId) => handleStartProctorPreview(formId, 'import')}
        />
      )}
    </div>
  );
};
