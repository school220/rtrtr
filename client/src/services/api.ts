const API_BASE = '/api';

export interface GameInfo {
  id: string;
  code: string;
  title: string;
  status: 'WAITING' | 'STARTING' | 'IN_PROGRESS' | 'TIME_EXPIRED' | 'FINISHED';
  totalTimeSeconds: number;
  maxStudents: number;
}

export interface JoinGameResponse {
  isReconnection: boolean;
  gameId: string;
  gameCode: string;
  gameStatus: string;
  studentId: number;
  formId: number;
  firstName: string;
  lastName: string;
  sessionToken: string;
  status: string;
  endsAt?: string;
}

export interface QuestionData {
  id: number;
  formId: number;
  questionNumber: number;
  text: string;
  type: 'multiple_choice' | 'short_answer';
  options?: { id: number; label: string; text: string }[];
}

export interface StudentStateResponse {
  gameId: string;
  gameCode: string;
  gameStatus: string;
  startedAt?: string;
  endsAt?: string;
  totalTimeSeconds: number;
  serverTime: string;
  student: {
    id: number;
    studentId: number;
    formId: number;
    firstName: string;
    lastName: string;
    status: string;
  };
  currentQuestionNumber: number;
  currentQuestion?: QuestionData;
  questions?: QuestionData[];
  answeredMap: Record<number, { selectedOptionId?: number; answerText?: string }>;
  answeredCount: number;
  totalQuestions: number;
  scoreReport?: {
    studentId: number;
    formId: number;
    totalQuestions: number;
    answeredCount: number;
    correctAnswers: number;
    wrongAnswers: number;
    unanswered: number;
    scorePoints: number;
    percentage: number;
    grade: number;
  };
}

export interface TeacherDashboardResponse {
  game: {
    id: string;
    code: string;
    title: string;
    status: string;
    total_time_seconds: number;
    started_at?: string;
    ends_at?: string;
    finished_at?: string;
    max_students: number;
  };
  students: {
    id: number;
    studentId: number;
    formId: number;
    firstName: string;
    lastName: string;
    status: string;
    isOnline: boolean;
    answeredCount: number;
    scoreReport?: {
      correctAnswers: number;
      wrongAnswers: number;
      unanswered: number;
      scorePoints: number;
      percentage: number;
      grade: number;
    };
    securityEvents: {
      pageHidden: number;
      fullscreenExit: number;
      disconnected: number;
      totalSuspicious: number;
    };
  }[];
  totalConnected: number;
  maxStudents: number;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || data.message || `Request failed with status ${res.status}`);
  }

  return data as T;
}

export const TEACHER_TOKEN_KEY = 'proctor_session_token';

export const api = {
  // Teacher Authentication
  teacherLogin: async (credentials: { username: string; password: string }) => {
    const res = await request<{
      success: boolean;
      token: string;
      username: string;
      role: string;
      message: string;
    }>('/teacher/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    if (res.token) {
      sessionStorage.setItem(TEACHER_TOKEN_KEY, res.token);
    }
    return res;
  },

  verifyTeacherSession: async (): Promise<boolean> => {
    const token = sessionStorage.getItem(TEACHER_TOKEN_KEY);
    if (!token) return false;
    try {
      const res = await request<{ valid: boolean }>('/teacher/verify', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.valid;
    } catch {
      sessionStorage.removeItem(TEACHER_TOKEN_KEY);
      return false;
    }
  },

  teacherLogout: async (): Promise<void> => {
    const token = sessionStorage.getItem(TEACHER_TOKEN_KEY);
    if (token) {
      try {
        await request('/teacher/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // ignore
      }
      sessionStorage.removeItem(TEACHER_TOKEN_KEY);
    }
  },

  isTeacherAuthenticated: (): boolean => {
    return Boolean(sessionStorage.getItem(TEACHER_TOKEN_KEY));
  },

  startProctorPreview: (formId: number = 1) => {
    const token = sessionStorage.getItem(TEACHER_TOKEN_KEY);
    return request<JoinGameResponse>('/teacher/preview-session', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: JSON.stringify({ formId }),
    });
  },

  createGame: (params: { title?: string; durationSeconds?: number } = {}) =>
    request<{ gameId: string; code: string; status: string; durationSeconds: number; maxStudents: number }>(
      '/games',
      { method: 'POST', body: JSON.stringify(params) }
    ),

  updateGameDuration: (gameId: string, durationMinutes: number) =>
    request<{ success: boolean; gameId: string; totalTimeSeconds: number; durationMinutes: number }>(
      `/games/${gameId}/duration`,
      { method: 'PATCH', body: JSON.stringify({ durationMinutes }) }
    ),

  getRecentGames: () =>
    request<{
      id: string;
      code: string;
      title: string;
      status: string;
      created_at: string;
      started_at?: string;
      finished_at?: string;
      total_time_seconds: number;
      student_count: number;
    }[]>('/games/recent'),

  getActiveGame: () =>
    request<{
      id: string;
      code: string;
      title: string;
      status: string;
      created_at: string;
      started_at?: string;
      finished_at?: string;
      total_time_seconds: number;
      student_count: number;
    } | null>('/games/active'),

  getGameByCode: (code: string) => request<GameInfo>(`/games/code/${encodeURIComponent(code)}`),

  joinGame: (params: { gameCode: string; firstName: string; lastName: string; sessionToken?: string }) =>
    request<JoinGameResponse>('/games/join', { method: 'POST', body: JSON.stringify(params) }),

  startGame: (gameId: string) =>
    request<{ success: boolean; startedAt: string; endsAt: string; studentCount: number }>(
      `/games/${gameId}/start`,
      { method: 'POST' }
    ),

  finishGame: (gameId: string) =>
    request<{ success: boolean; status: string }>(`/games/${gameId}/finish`, { method: 'POST' }),

  getTeacherDashboard: (gameId: string) => request<TeacherDashboardResponse>(`/games/${gameId}/teacher`),

  getStudentState: (gameId: string, studentId: number) =>
    request<StudentStateResponse>(`/games/${gameId}/student/${studentId}/state`),

  getAllQuestions: (gameId: string, studentId: number) =>
    request<QuestionData[]>(`/games/${gameId}/student/${studentId}/questions`),

  getQuestion: (gameId: string, studentId: number, questionNumber: number) =>
    request<QuestionData>(`/games/${gameId}/student/${studentId}/question/${questionNumber}`),

  submitAnswer: (params: {
    gameId: string;
    studentId: number;
    questionNumber: number;
    selectedOptionId?: number;
    answerText?: string;
  }) =>
    request<{
      success: boolean;
      questionNumber: number;
      nextQuestionNumber: number | null;
      totalAnswered: number;
      isFinished: boolean;
    }>(`/games/${params.gameId}/student/${params.studentId}/answer`, {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  finishStudentTest: (gameId: string, studentId: number) =>
    request<{ success: boolean }>(`/games/${gameId}/student/${studentId}/finish`, { method: 'POST' }),

  downloadExcel: (gameId: string, gameCode: string) => {
    const url = `${API_BASE}/games/${gameId}/export/excel`;
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Результаты_${gameCode}.xlsx`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  getFormsStatus: () =>
    request<{ totalForms: number; forms: { formId: number; title: string; questionCount: number; isComplete: boolean }[] }>(
      '/import/forms-status'
    ),

  getFormDetail: (formId: number) =>
    request<FormDetailResponse>(`/import/form/${formId}`),

  updateQuestion: (
    questionId: number,
    data: {
      text: string;
      correct_answer: string;
      explanation?: string;
      options?: { label: string; text: string; is_correct?: boolean }[];
    }
  ) =>
    request<{ success: boolean; message: string }>(`/import/question/${questionId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  importForm: (formData: any) =>
    request<{ success: boolean; message: string }>('/import/form', {
      method: 'POST',
      body: JSON.stringify(formData),
    }),
};

export interface FormDetailResponse {
  form_id: number;
  title: string;
  questions: {
    id: number;
    number: number;
    type: 'multiple_choice' | 'short_answer';
    text: string;
    points: number;
    correct_answer: string;
    explanation?: string;
    options?: {
      id?: number;
      label: string;
      text: string;
      is_correct: boolean;
    }[];
  }[];
}
