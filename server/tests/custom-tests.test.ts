import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { createServer, Server } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createApiRouter } from '../src/routes/api.routes.js';
import { runMigrations } from '../src/db/migrate.js';
import { seedDatabase } from '../src/db/seed.js';
import { closeDb } from '../src/db/index.js';

describe('Custom Tests ("Мои тесты") & Question Types End-to-End', () => {
  let httpServer: Server;
  let baseUrl: string;
  let teacherToken1: string;
  let teacherToken2: string;
  let teacherId1: number;
  let teacherId2: number;
  let customTestId: string;
  let gameId: string;
  let gameCode: string;
  let studentId: number;
  let sessionToken: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await runMigrations();
    await seedDatabase();

    const app = express();
    app.use(express.json());
    httpServer = createServer(app);
    const io = new SocketIOServer(httpServer);
    app.use('/api', createApiRouter(io));

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => resolve());
    });
    const addr = httpServer.address() as any;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  }, 60000);

  afterAll(async () => {
    if (httpServer) {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
    await closeDb();
  });

  it('1. Registers two separate teachers', async () => {
    const res1 = await fetch(`${baseUrl}/api/teacher/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Иванов Иван Иванович',
        username: `teacher_ivan_${Date.now()}`,
        password: 'Password123!',
      }),
    });
    const data1 = await res1.json();
    expect(res1.status).toBe(201);
    teacherToken1 = data1.token;
    teacherId1 = data1.teacherId;

    const res2 = await fetch(`${baseUrl}/api/teacher/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Петров Петр Петрович',
        username: `teacher_petr_${Date.now()}`,
        password: 'Password123!',
      }),
    });
    const data2 = await res2.json();
    expect(res2.status).toBe(201);
    teacherToken2 = data2.token;
    teacherId2 = data2.teacherId;
  });

  it('2. Teacher 1 creates custom test with 3 question types (4 options, Yes/No, Free input)', async () => {
    const res = await fetch(`${baseUrl}/api/custom-tests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${teacherToken1}`,
      },
      body: JSON.stringify({
        title: 'Контрольная работа по математике',
        durationMinutes: 22,
        questions: [
          {
            questionNumber: 1,
            questionText: 'Чему равно 2 + 2?',
            questionType: 'four_options',
            correctAnswer: 'B',
            options: [
              { label: 'A', text: '3', isCorrect: false },
              { label: 'B', text: '4', isCorrect: true },
              { label: 'C', text: '5', isCorrect: false },
              { label: 'D', text: '6', isCorrect: false },
            ],
            points: 1,
          },
          {
            questionNumber: 2,
            questionText: 'Число 7 является простым числом?',
            questionType: 'yes_no',
            correctAnswer: 'Да',
            options: [
              { label: '1', text: 'Да', isCorrect: true },
              { label: '2', text: 'Нет', isCorrect: false },
            ],
            points: 1,
          },
          {
            questionNumber: 3,
            questionText: 'Решите уравнение: 5x = 35. Найдите x.',
            questionType: 'free_input',
            correctAnswer: '7',
            points: 1,
          },
        ],
      }),
    });

    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.id).toBeDefined();
    expect(data.title).toBe('Контрольная работа по математике');
    expect(data.durationMinutes).toBe(22);
    expect(data.questions).toHaveLength(3);
    expect(data.questions[0].questionType).toBe('four_options');
    expect(data.questions[1].questionType).toBe('yes_no');
    expect(data.questions[2].questionType).toBe('free_input');
    customTestId = data.id;
  });

  it('3. Isolates custom tests: Teacher 1 sees test, Teacher 2 has 0 tests', async () => {
    const res1 = await fetch(`${baseUrl}/api/custom-tests`, {
      headers: { Authorization: `Bearer ${teacherToken1}` },
    });
    const tests1 = await res1.json();
    expect(res1.status).toBe(200);
    expect(tests1).toHaveLength(1);
    expect(tests1[0].id).toBe(customTestId);
    expect(tests1[0].questionCount).toBe(3);

    const res2 = await fetch(`${baseUrl}/api/custom-tests`, {
      headers: { Authorization: `Bearer ${teacherToken2}` },
    });
    const tests2 = await res2.json();
    expect(res2.status).toBe(200);
    expect(tests2).toHaveLength(0);
  });

  it('4. Teacher 1 updates the test title and duration', async () => {
    const res = await fetch(`${baseUrl}/api/custom-tests/${customTestId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${teacherToken1}`,
      },
      body: JSON.stringify({
        title: 'Итоговая контрольная работа (Обновлено)',
        durationMinutes: 25,
        questions: [
          {
            questionNumber: 1,
            questionText: 'Чему равно 2 + 2?',
            questionType: 'four_options',
            correctAnswer: 'B',
            options: [
              { label: 'A', text: '3', isCorrect: false },
              { label: 'B', text: '4', isCorrect: true },
              { label: 'C', text: '5', isCorrect: false },
              { label: 'D', text: '6', isCorrect: false },
            ],
            points: 1,
          },
          {
            questionNumber: 2,
            questionText: 'Число 7 является простым числом?',
            questionType: 'yes_no',
            correctAnswer: 'Да',
            options: [
              { label: '1', text: 'Да', isCorrect: true },
              { label: '2', text: 'Нет', isCorrect: false },
            ],
            points: 1,
          },
          {
            questionNumber: 3,
            questionText: 'Решите уравнение: 5x = 35. Найдите x.',
            questionType: 'free_input',
            correctAnswer: '7',
            points: 1,
          },
        ],
      }),
    });

    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.title).toBe('Итоговая контрольная работа (Обновлено)');
    expect(data.durationMinutes).toBe(25);
  });

  it('5. Teacher 1 launches testing room session from custom test', async () => {
    const res = await fetch(`${baseUrl}/api/custom-tests/${customTestId}/launch`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${teacherToken1}` },
    });

    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.gameId).toBeDefined();
    expect(data.code).toBeDefined();
    expect(data.customTestId).toBe(customTestId);
    expect(data.durationSeconds).toBe(25 * 60);

    gameId = data.gameId;
    gameCode = data.code;
  });

  it('6. Student joins custom test room and teacher starts the test', async () => {
    const joinRes = await fetch(`${baseUrl}/api/games/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gameCode,
        firstName: 'Алексей',
        lastName: 'Смирнов',
      }),
    });

    const joinData = await joinRes.json();
    expect(joinRes.status).toBe(200);
    expect(joinData.studentId).toBe(1);
    studentId = joinData.studentId;
    sessionToken = joinData.sessionToken;

    const startRes = await fetch(`${baseUrl}/api/games/${gameId}/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${teacherToken1}` },
    });
    const startData = await startRes.json();
    expect(startRes.status).toBe(200);
    expect(startData.success).toBe(true);
  });

  it('7. Student retrieves questions for custom test and answers all 3 questions', async () => {
    const stateRes = await fetch(`${baseUrl}/api/games/${gameId}/student/${studentId}/state`, {
      headers: { 'x-session-token': sessionToken },
    });
    const stateData = await stateRes.json();
    expect(stateRes.status).toBe(200);
    expect(stateData.totalQuestions).toBe(3);
    expect(stateData.questions).toHaveLength(3);

    // Question 1: 4 options without exposing is_correct
    const q1 = stateData.questions[0];
    expect(q1.questionNumber).toBe(1);
    expect(q1.type).toBe('multiple_choice');
    expect(q1.options).toHaveLength(4);
    expect(q1.options[0]).not.toHaveProperty('isCorrect');

    // Answer Q1: select option B (id: 2)
    const ans1Res = await fetch(`${baseUrl}/api/games/${gameId}/student/${studentId}/answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-token': sessionToken,
      },
      body: JSON.stringify({
        questionNumber: 1,
        selectedOptionId: 2,
      }),
    });
    const ans1 = await ans1Res.json();
    expect(ans1.success).toBe(true);

    // Answer Q2: select option 1 ("Да", id: 1)
    const ans2Res = await fetch(`${baseUrl}/api/games/${gameId}/student/${studentId}/answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-token': sessionToken,
      },
      body: JSON.stringify({
        questionNumber: 2,
        selectedOptionId: 1,
      }),
    });
    const ans2 = await ans2Res.json();
    expect(ans2.success).toBe(true);

    // Answer Q3: free input "7"
    const ans3Res = await fetch(`${baseUrl}/api/games/${gameId}/student/${studentId}/answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-token': sessionToken,
      },
      body: JSON.stringify({
        questionNumber: 3,
        answerText: '7',
      }),
    });
    const ans3 = await ans3Res.json();
    expect(ans3.success).toBe(true);
    expect(ans3.nextQuestionNumber).toBeNull(); // Last question reached
  });

  it('8. Student finishes test and receives full score report (3/3, 100%, Grade 5)', async () => {
    const finRes = await fetch(`${baseUrl}/api/games/${gameId}/student/${studentId}/finish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-token': sessionToken,
      },
    });
    expect(finRes.status).toBe(200);

    const finalStateRes = await fetch(`${baseUrl}/api/games/${gameId}/student/${studentId}/state`, {
      headers: { 'x-session-token': sessionToken },
    });
    const finalState = await finalStateRes.json();
    expect(finalState.student.status).toBe('FINISHED');
    expect(finalState.scoreReport).toBeDefined();
    expect(finalState.scoreReport.totalQuestions).toBe(3);
    expect(finalState.scoreReport.answeredCount).toBe(3);
    expect(finalState.scoreReport.correctAnswers).toBe(3);
    expect(finalState.scoreReport.wrongAnswers).toBe(0);
    expect(finalState.scoreReport.scorePoints).toBe(3);
    expect(finalState.scoreReport.percentage).toBe(100);
    expect(finalState.scoreReport.grade).toBe(5);
  });

  it('9. Teacher dashboard displays results correctly for custom test room', async () => {
    const dashRes = await fetch(`${baseUrl}/api/games/${gameId}/teacher`, {
      headers: { Authorization: `Bearer ${teacherToken1}` },
    });
    const dash = await dashRes.json();
    expect(dashRes.status).toBe(200);
    expect(dash.totalQuestions).toBe(3);
    expect(dash.students).toHaveLength(1);
    expect(dash.students[0].scoreReport.percentage).toBe(100);
    expect(dash.students[0].scoreReport.grade).toBe(5);
  });
});
