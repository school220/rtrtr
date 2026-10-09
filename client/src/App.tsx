import React, { useState, useEffect } from 'react';
import { Home } from './pages/Home.js';
import { StudentJoin } from './pages/StudentJoin.js';
import { StudentWaiting } from './pages/StudentWaiting.js';
import { StudentQuiz } from './pages/StudentQuiz.js';
import { StudentResult } from './pages/StudentResult.js';
import { TeacherDashboard } from './pages/TeacherDashboard.js';
import { TeacherImport } from './pages/TeacherImport.js';
import { TeacherAuthModal } from './components/TeacherAuthModal.js';
import { useSocket } from './hooks/useSocket.js';
import { JoinGameResponse, StudentStateResponse, api } from './services/api.js';

type ViewMode = 'home' | 'student_join' | 'student_waiting' | 'student_quiz' | 'student_result' | 'teacher' | 'import';

export const App: React.FC = () => {
  const [view, setView] = useState<ViewMode>('home');
  const [studentData, setStudentData] = useState<JoinGameResponse | null>(null);
  const [studentState, setStudentState] = useState<StudentStateResponse | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [targetAuthView, setTargetAuthView] = useState<'teacher' | 'import'>('teacher');
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

  // Check saved session on initial load
  useEffect(() => {
    const savedToken = localStorage.getItem('student_session_token');
    const savedGameId = localStorage.getItem('student_game_id');
    const savedStudentId = localStorage.getItem('student_id');

    if (savedToken && savedGameId && savedStudentId) {
      const sId = parseInt(savedStudentId, 10);
      api
        .getStudentState(savedGameId, sId)
        .then((state) => {
          // If the test was already finished, do not trap the student in the results screen on fresh app open!
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
          // Token expired or invalid
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
  const handleGameStarted = (_data: { startedAt: string; endsAt: string }) => {
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

  // Reset to Home
  const handleResetHome = () => {
    if (view === 'student_result' || studentState?.student?.status === 'FINISHED') {
      clearStudentSession();
    }
    setView('home');
  };

  return (
    <div className="min-h-screen bg-[#f4f6f9] text-[#222d32] font-sans">
      {view === 'home' && (
        <Home
          onSelectRole={(role) => {
            if (role === 'student') {
              setView('student_join');
            } else if (role === 'teacher' || role === 'import') {
              if (api.isTeacherAuthenticated()) {
                setView(role);
              } else {
                setTargetAuthView(role);
                setShowAuthModal(true);
              }
            }
          }}
        />
      )}

      {/* Proctor Authentication Gate Modal */}
      <TeacherAuthModal
        isOpen={showAuthModal}
        onSuccess={() => {
          setShowAuthModal(false);
          setView(targetAuthView);
        }}
        onCancel={() => setShowAuthModal(false)}
      />

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

      {view === 'teacher' && (
        <TeacherDashboard
          socket={socket}
          onBack={handleResetHome}
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
