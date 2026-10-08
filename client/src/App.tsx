import React, { useState, useEffect } from 'react';
import { Home } from './pages/Home.js';
import { StudentJoin } from './pages/StudentJoin.js';
import { StudentWaiting } from './pages/StudentWaiting.js';
import { StudentQuiz } from './pages/StudentQuiz.js';
import { StudentResult } from './pages/StudentResult.js';
import { TeacherDashboard } from './pages/TeacherDashboard.js';
import { TeacherImport } from './pages/TeacherImport.js';
import { useSocket } from './hooks/useSocket.js';
import { JoinGameResponse, StudentStateResponse, api } from './services/api.js';

type ViewMode = 'home' | 'student_join' | 'student_waiting' | 'student_quiz' | 'student_result' | 'teacher' | 'import';

export const App: React.FC = () => {
  const [view, setView] = useState<ViewMode>('home');
  const [studentData, setStudentData] = useState<JoinGameResponse | null>(null);
  const [studentState, setStudentState] = useState<StudentStateResponse | null>(null);
  const { socket } = useSocket();

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

          if (state.gameStatus === 'FINISHED' || state.student.status === 'FINISHED') {
            setView('student_result');
          } else if (state.gameStatus === 'IN_PROGRESS') {
            setView('student_quiz');
          } else {
            setView('student_waiting');
          }
        })
        .catch(() => {
          // Token expired or invalid
          localStorage.removeItem('student_session_token');
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

  // Reset to Home
  const handleResetHome = () => {
    setView('home');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {view === 'home' && (
        <Home
          onSelectRole={(role) => {
            if (role === 'student') setView('student_join');
            else if (role === 'teacher') setView('teacher');
            else if (role === 'import') setView('import');
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
        />
      )}

      {view === 'student_result' && studentState && (
        <StudentResult
          state={studentState}
          onHome={handleResetHome}
        />
      )}

      {view === 'teacher' && (
        <TeacherDashboard
          socket={socket}
          onBack={handleResetHome}
        />
      )}

      {view === 'import' && (
        <TeacherImport
          onBack={handleResetHome}
        />
      )}
    </div>
  );
};
