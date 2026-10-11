import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { createServer, Server } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createApiRouter } from '../src/routes/api.routes.js';
import { importRouter } from '../src/routes/import.routes.js';
import { runMigrations } from '../src/db/migrate.js';
import { seedDatabase } from '../src/db/seed.js';
import { requireTeacherAuth } from '../src/middleware/security.middleware.js';
import { closeDb } from '../src/db/index.js';

describe('Multi-Examiner Isolation & Independent Variants', () => {
  let httpServer: Server;
  let baseUrl: string;
  let teacherToken1: string;
  let teacherToken2: string;
  let teacherId1: number;
  let teacherId2: number;
  let gameId1: string;
  let gameCode1: string;
  let gameId2: string;
  let gameCode2: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await runMigrations();
    await seedDatabase();

    const app = express();
    app.use(express.json());
    httpServer = createServer(app);
    const io = new SocketIOServer(httpServer);
    app.use('/api', createApiRouter(io));
    app.use('/api/import', requireTeacherAuth, importRouter);

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

  it('1. Registers Teacher 1 and Teacher 2 successfully with isolated accounts', async () => {
    const res1 = await fetch(`${baseUrl}/api/teacher/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Маликов Алишер Улугбекович',
        username: 'examiner_alisher',
        password: 'Password123!',
      }),
    });

    const data1 = await res1.json();
    expect(res1.status).toBe(201);
    expect(data1.success).toBe(true);
    expect(data1.token).toBeDefined();
    expect(data1.teacherId).toBeGreaterThan(0);
    teacherToken1 = data1.token;
    teacherId1 = data1.teacherId;

    const res2 = await fetch(`${baseUrl}/api/teacher/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Каримова Наргиза Ботировна',
        username: 'examiner_nargiza',
        password: 'Password456!',
      }),
    });

    const data2 = await res2.json();
    expect(res2.status).toBe(201);
    expect(data2.success).toBe(true);
    expect(data2.token).toBeDefined();
    expect(data2.teacherId).toBeGreaterThan(0);
    expect(data2.teacherId).not.toBe(teacherId1);
    teacherToken2 = data2.token;
    teacherId2 = data2.teacherId;
  });

  it('2. Prevents duplicate registration with the same username', async () => {
    const res = await fetch(`${baseUrl}/api/teacher/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Другой Пользователь',
        username: 'examiner_alisher',
        password: 'SomePassword123!',
      }),
    });

    const data = await res.json();
    expect(res.status).toBe(409);
    expect(data.error).toContain('уже зарегистрирован');
  });

  it('3. Each teacher has their own full suite of 50 variants', async () => {
    const res1 = await fetch(`${baseUrl}/api/import/forms-status`, {
      headers: { Authorization: `Bearer ${teacherToken1}` },
    });
    const data1 = await res1.json();
    expect(res1.status).toBe(200);
    expect(data1.totalForms).toBe(50);
    expect(data1.forms[0].formId).toBe(1);

    const res2 = await fetch(`${baseUrl}/api/import/forms-status`, {
      headers: { Authorization: `Bearer ${teacherToken2}` },
    });
    const data2 = await res2.json();
    expect(res2.status).toBe(200);
    expect(data2.totalForms).toBe(50);
    expect(data2.forms[0].formId).toBe(1);
  });

  it('4. Teacher 1 creates Test Room 1; Teacher 2 creates Test Room 2', async () => {
    const res1 = await fetch(`${baseUrl}/api/games`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${teacherToken1}`,
      },
      body: JSON.stringify({ title: 'Тест Алишера 4-А', durationMinutes: 25 }),
    });

    const data1 = await res1.json();
    expect(res1.status).toBe(201);
    gameId1 = data1.gameId;
    gameCode1 = data1.code;
    expect(data1.teacherId).toBe(teacherId1);

    const res2 = await fetch(`${baseUrl}/api/games`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${teacherToken2}`,
      },
      body: JSON.stringify({ title: 'Тест Наргизы 4-Б', durationMinutes: 30 }),
    });

    const data2 = await res2.json();
    expect(res2.status).toBe(201);
    gameId2 = data2.gameId;
    gameCode2 = data2.code;
    expect(data2.teacherId).toBe(teacherId2);
    expect(gameId1).not.toBe(gameId2);
  });

  it('5. Game lists are strictly segregated: Teacher 1 only sees Room 1, Teacher 2 only sees Room 2', async () => {
    // Teacher 1 recent games
    const recent1Res = await fetch(`${baseUrl}/api/games/recent`, {
      headers: { Authorization: `Bearer ${teacherToken1}` },
    });
    const recent1 = await recent1Res.json();
    expect(recent1Res.status).toBe(200);
    const codes1 = recent1.map((g: any) => g.code);
    expect(codes1).toContain(gameCode1);
    expect(codes1).not.toContain(gameCode2);

    // Teacher 2 recent games
    const recent2Res = await fetch(`${baseUrl}/api/games/recent`, {
      headers: { Authorization: `Bearer ${teacherToken2}` },
    });
    const recent2 = await recent2Res.json();
    expect(recent2Res.status).toBe(200);
    const codes2 = recent2.map((g: any) => g.code);
    expect(codes2).toContain(gameCode2);
    expect(codes2).not.toContain(gameCode1);

    // Active games
    const active1Res = await fetch(`${baseUrl}/api/games/active`, {
      headers: { Authorization: `Bearer ${teacherToken1}` },
    });
    const active1 = await active1Res.json();
    expect(active1.code).toBe(gameCode1);

    const active2Res = await fetch(`${baseUrl}/api/games/active`, {
      headers: { Authorization: `Bearer ${teacherToken2}` },
    });
    const active2 = await active2Res.json();
    expect(active2.code).toBe(gameCode2);
  });

  it('6. Teacher 1 cannot modify, start, finish, or access Teacher 2 game', async () => {
    // Teacher 1 tries to access Teacher 2 dashboard
    const dashRes = await fetch(`${baseUrl}/api/games/${gameId2}/teacher`, {
      headers: { Authorization: `Bearer ${teacherToken1}` },
    });
    expect(dashRes.status).toBe(403);

    // Teacher 1 tries to start Teacher 2 game
    const startRes = await fetch(`${baseUrl}/api/games/${gameId2}/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${teacherToken1}` },
    });
    expect(startRes.status).toBe(403);

    // Teacher 1 tries to change duration of Teacher 2 game
    const durRes = await fetch(`${baseUrl}/api/games/${gameId2}/duration`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${teacherToken1}`,
      },
      body: JSON.stringify({ durationMinutes: 45 }),
    });
    expect(durRes.status).toBe(403);
  });

  it('7. Question editing isolation: Teacher 1 edits Variant 1 Question 1; Teacher 2 remains untouched', async () => {
    // 1. Fetch Teacher 1's Variant 1
    const form1Res = await fetch(`${baseUrl}/api/import/form/1`, {
      headers: { Authorization: `Bearer ${teacherToken1}` },
    });
    const form1 = await form1Res.json();
    const q1Teacher1 = form1.questions[0];

    // 2. Fetch Teacher 2's Variant 1
    const form2Res = await fetch(`${baseUrl}/api/import/form/1`, {
      headers: { Authorization: `Bearer ${teacherToken2}` },
    });
    const form2 = await form2Res.json();
    const q1Teacher2 = form2.questions[0];

    expect(q1Teacher1.id).not.toBe(q1Teacher2.id);
    const originalTextTeacher2 = q1Teacher2.text;

    // 3. Teacher 1 edits their question
    const updateRes = await fetch(`${baseUrl}/api/import/question/${q1Teacher1.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${teacherToken1}`,
      },
      body: JSON.stringify({
        text: 'ЭКСКЛЮЗИВНЫЙ ВОПРОС УЧИТЕЛЯ АЛИШЕРА: Сколько будет 1/2 + 1/2?',
        correct_answer: '1',
        explanation: '1/2 + 1/2 = 1',
        options: [
          { label: 'A', text: '1', is_correct: true },
          { label: 'B', text: '2', is_correct: false },
          { label: 'C', text: '0', is_correct: false },
          { label: 'D', text: '3', is_correct: false },
        ],
      }),
    });
    expect(updateRes.status).toBe(200);

    // 4. Verify Teacher 1 sees the edited question
    const refreshedForm1Res = await fetch(`${baseUrl}/api/import/form/1`, {
      headers: { Authorization: `Bearer ${teacherToken1}` },
    });
    const refreshedForm1 = await refreshedForm1Res.json();
    expect(refreshedForm1.questions[0].text).toContain('ЭКСКЛЮЗИВНЫЙ ВОПРОС УЧИТЕЛЯ АЛИШЕРА');

    // 5. Verify Teacher 2's question is COMPLETELY UNTOUCHED!
    const refreshedForm2Res = await fetch(`${baseUrl}/api/import/form/1`, {
      headers: { Authorization: `Bearer ${teacherToken2}` },
    });
    const refreshedForm2 = await refreshedForm2Res.json();
    expect(refreshedForm2.questions[0].text).toBe(originalTextTeacher2);
    expect(refreshedForm2.questions[0].text).not.toContain('ЭКСКЛЮЗИВНЫЙ ВОПРОС УЧИТЕЛЯ АЛИШЕРА');
  });

  it('8. Students joining different rooms get their respective teacher customized questions', async () => {
    // Student 1 joins Teacher 1 room (Variant 1)
    const join1Res = await fetch(`${baseUrl}/api/games/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gameCode: gameCode1,
        firstName: 'Рустам',
        lastName: 'Ахмедов',
      }),
    });
    const join1 = await join1Res.json();
    expect(join1Res.status).toBe(200);
    expect(join1.formId).toBe(1);

    // Student 1 retrieves questions
    const qList1Res = await fetch(`${baseUrl}/api/games/${gameId1}/student/${join1.studentId}/questions`, {
      headers: { 'x-student-token': join1.sessionToken },
    });
    const qList1 = await qList1Res.json();

    expect(qList1Res.status).toBe(200);
    expect(qList1[0].text).toContain('ЭКСКЛЮЗИВНЫЙ ВОПРОС УЧИТЕЛЯ АЛИШЕРА');

    // Student 2 joins Teacher 2 room (Variant 1)
    const join2Res = await fetch(`${baseUrl}/api/games/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gameCode: gameCode2,
        firstName: 'Шахло',
        lastName: 'Каримова',
      }),
    });
    const join2 = await join2Res.json();
    expect(join2Res.status).toBe(200);
    expect(join2.formId).toBe(1);

    // Student 2 retrieves questions
    const qList2Res = await fetch(`${baseUrl}/api/games/${gameId2}/student/${join2.studentId}/questions`, {
      headers: { 'x-student-token': join2.sessionToken },
    });
    const qList2 = await qList2Res.json();

    expect(qList2Res.status).toBe(200);
    expect(qList2[0].text).not.toContain('ЭКСКЛЮЗИВНЫЙ ВОПРОС УЧИТЕЛЯ АЛИШЕРА');
  });
});
