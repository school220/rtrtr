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
    disqualifiedBy?: string;
    disqualificationReason?: string;
    disqualifiedAt?: string;
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
    isDisqualified?: boolean;
    disqualifiedBy?: string;
    disqualificationReason?: string;
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
      isDisqualified?: boolean;
      disqualifiedBy?: string;
      disqualificationReason?: string;
    };
    securityEvents: {
      pageHidden: number;
      fullscreenExit: number;
      disconnected: number;
      screenshotAttempts?: number;
      windowBlurs?: number;
      tabSwitches?: number;
      clipboardViolations?: number;
      totalSuspicious: number;
    };
    disqualifiedBy?: string;
    disqualificationReason?: string;
    disqualifiedAt?: string;
  }[];
  totalConnected: number;
  maxStudents: number;
}

export const TEACHER_TOKEN_KEY = 'proctor_session_token';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const teacherToken = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(TEACHER_TOKEN_KEY) : null;
  const studentToken = typeof localStorage !== 'undefined' ? localStorage.getItem('student_session_token') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(teacherToken ? { 'Authorization': `Bearer ${teacherToken}`, 'x-teacher-token': teacherToken } : {}),
    ...(studentToken ? { 'x-student-token': studentToken } : {}),
    ...(options.headers as Record<string, string>),
  };

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || data.message || `Request failed with status ${res.status}`);
  }

  return data as T;
}

export const api = {
  // Teacher Authentication
  teacherRegister: async (data: { fullName: string; username: string; password: string }) => {
    const res = await request<{
      success: boolean;
      token: string;
      teacherId: number;
      username: string;
      fullName: string;
      role: string;
      message: string;
    }>('/teacher/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (res.token) {
      sessionStorage.setItem(TEACHER_TOKEN_KEY, res.token);
      sessionStorage.setItem('teacher_full_name', res.fullName);
      sessionStorage.setItem('teacher_username', res.username);
      sessionStorage.setItem('teacher_role', res.role);
    }
    return res;
  },

  teacherLogin: async (credentials: { username: string; password: string }) => {
    const res = await request<{
      success: boolean;
      token: string;
      teacherId?: number;
      username: string;
      fullName?: string;
      role: string;
      message: string;
    }>('/teacher/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    if (res.token) {
      sessionStorage.setItem(TEACHER_TOKEN_KEY, res.token);
      if (res.fullName) sessionStorage.setItem('teacher_full_name', res.fullName);
      if (res.username) sessionStorage.setItem('teacher_username', res.username);
      if (res.role) sessionStorage.setItem('teacher_role', res.role);
    }
    return res;
  },

  getTeacherInfo: () => {
    if (typeof sessionStorage === 'undefined') return null;
    return {
      fullName: sessionStorage.getItem('teacher_full_name') || 'Проверяющий',
      username: sessionStorage.getItem('teacher_username') || '',
      role: sessionStorage.getItem('teacher_role') || 'EXAMINER',
    };
  },

  verifyTeacherSession: async (): Promise<boolean> => {
    const token = sessionStorage.getItem(TEACHER_TOKEN_KEY);
    if (!token) return false;
    try {
      const res = await request<{
        valid: boolean;
        teacherId?: number;
        username?: string;
        fullName?: string;
        role?: string;
      }>('/teacher/verify', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.valid) {
        if (res.fullName) sessionStorage.setItem('teacher_full_name', res.fullName);
        if (res.username) sessionStorage.setItem('teacher_username', res.username);
        if (res.role) sessionStorage.setItem('teacher_role', res.role);
      }
      return res.valid;
    } catch {
      sessionStorage.removeItem(TEACHER_TOKEN_KEY);
      sessionStorage.removeItem('teacher_full_name');
      sessionStorage.removeItem('teacher_username');
      sessionStorage.removeItem('teacher_role');
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
      sessionStorage.removeItem('teacher_full_name');
      sessionStorage.removeItem('teacher_username');
      sessionStorage.removeItem('teacher_role');
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

  disqualifyStudent: (
    gameId: string,
    studentId: number,
    params: { disqualifiedBy: 'PROCTOR' | 'TEACHER'; reason: string }
  ) =>
    request<{
      success: boolean;
      gameId: string;
      studentId: number;
      status: string;
      disqualifiedBy: string;
      disqualificationReason: string;
    }>(`/games/${gameId}/student/${studentId}/disqualify`, {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  downloadExcel: async (gameId: string, gameCode: string) => {
    const teacherToken = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(TEACHER_TOKEN_KEY) : null;
    const url = `${API_BASE}/games/${gameId}/export/excel${teacherToken ? `?token=${encodeURIComponent(teacherToken)}` : ''}`;
    try {
      const res = await fetch(url, {
        headers: teacherToken ? { Authorization: `Bearer ${teacherToken}`, 'x-teacher-token': teacherToken } : {},
      });
      if (!res.ok) throw new Error('Не удалось скачать файл отчёта');
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `Результаты_${gameCode}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch {
      // Fallback direct link
      window.open(url, '_blank');
    }
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

  // ==========================================
  // Custom Tests ("Мои тесты") API methods
  // ==========================================
  getCustomTests: () =>
    request<CustomTestSummary[]>('/custom-tests'),

  getCustomTest: (id: string) =>
    request<CustomTestDetail>(`/custom-tests/${id}`),

  createCustomTest: (data: {
    title: string;
    durationMinutes: number;
    questions: CustomQuestionItem[];
  }) =>
    request<CustomTestDetail>('/custom-tests', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateCustomTest: (
    id: string,
    data: {
      title: string;
      durationMinutes: number;
      questions: CustomQuestionItem[];
    }
  ) =>
    request<CustomTestDetail>(`/custom-tests/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteCustomTest: (id: string) =>
    request<{ success: boolean; message?: string }>(`/custom-tests/${id}`, {
      method: 'DELETE',
    }),

  launchCustomTest: (id: string) =>
    request<any>(`/custom-tests/${id}/launch`, {
      method: 'POST',
    }),

  previewCustomTest: (id: string) =>
    request<JoinGameResponse>(`/custom-tests/${id}/preview`, {
      method: 'POST',
    }),
};

export type CustomQuestionType = 'four_options' | 'yes_no' | 'free_input';

export interface CustomOptionItem {
  id?: number;
  label: string;
  text: string;
  isCorrect?: boolean;
}

export interface CustomQuestionItem {
  id?: number;
  variantNumber?: number;
  questionNumber?: number;
  questionText: string;
  questionType: CustomQuestionType;
  correctAnswer?: string;
  options?: CustomOptionItem[];
  points?: number;
}

export interface CustomTestSummary {
  id: string;
  teacherId: number;
  title: string;
  durationMinutes: number;
  questionCount: number;
  variantCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CustomTestDetail {
  id: string;
  teacherId: number;
  title: string;
  durationMinutes: number;
  variantCount?: number;
  createdAt: string;
  updatedAt: string;
  questions: CustomQuestionItem[];
}

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
