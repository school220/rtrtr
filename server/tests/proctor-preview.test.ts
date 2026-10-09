import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { createServer, Server } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { runMigrations } from '../src/db/migrate.js';
import { seedDatabase } from '../src/db/seed.js';
import { createApiRouter } from '../src/routes/api.routes.js';
import { config } from '../src/config.js';
import { getDb, closeDb } from '../src/db/index.js';

describe('Proctor Preview Mode Verification', () => {
  let httpServer: Server;
  let baseUrl: string;
  let teacherToken: string;

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

    // Authenticate as teacher
    const loginRes = await fetch(`${baseUrl}/api/teacher/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: config.teacherAuth.username,
        password: config.teacherAuth.password,
      }),
    });

    const loginData = await loginRes.json();
    expect(loginRes.status).toBe(200);
    expect(loginData.token).toBeDefined();
    teacherToken = loginData.token;
  }, 60000);

  afterAll(async () => {
    if (httpServer) {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
    await closeDb();
  });

  it('creates an active proctor preview session for any selected variant (e.g. Variant 7)', async () => {
    const res = await fetch(`${baseUrl}/api/teacher/preview-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${teacherToken}`,
      },
      body: JSON.stringify({ formId: 7 }),
    });

    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.gameId).toBeDefined();
    expect(data.gameCode).toMatch(/^PRK\d+$/);
    expect(data.gameStatus).toBe('IN_PROGRESS');
    expect(data.studentId).toBe(99);
    expect(data.formId).toBe(7);
    expect(data.firstName).toBe('Проктор');
    expect(data.lastName).toBe('Комиссия');
    expect(data.sessionToken).toBeDefined();
    expect(data.endsAt).toBeDefined();

    const gameId = data.gameId;

    // Verify it is excluded from /api/games/active
    const activeRes = await fetch(`${baseUrl}/api/games/active`);
    const activeData = await activeRes.json();
    expect(activeRes.status).toBe(200);
    if (activeData) {
      expect(activeData.code).not.toBe(data.gameCode);
    }

    // Verify it is excluded from /api/games/recent
    const recentRes = await fetch(`${baseUrl}/api/games/recent`);
    const recentData = await recentRes.json();
    expect(recentRes.status).toBe(200);
    const foundInRecent = recentData.some((g: any) => g.id === gameId);
    expect(foundInRecent).toBe(false);
  });

  it('allows proctor to load questions, submit answers, and receive full official score certificate', async () => {
    // Start preview for Variant 1
    const previewRes = await fetch(`${baseUrl}/api/teacher/preview-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${teacherToken}`,
      },
      body: JSON.stringify({ formId: 1 }),
    });

    const previewData = await previewRes.json();
    const { gameId, studentId, formId } = previewData;

    // 1. Get questions
    const qRes = await fetch(`${baseUrl}/api/games/${gameId}/student/${studentId}/questions`);
    const qData = await qRes.json();
    expect(qRes.status).toBe(200);
    expect(qData).toHaveLength(20);
    expect(qData[0].questionNumber).toBe(1);
    expect(qData[0].options).toHaveLength(4);

    // 2. Submit answer to question 1
    const db = await getDb();
    const correctOptRes = await db.query(
      `SELECT ao.id FROM form_questions fq
       JOIN questions q ON fq.question_id = q.id
       JOIN answer_options ao ON ao.question_id = q.id
       WHERE fq.form_id = $1 AND fq.question_number = 1 AND ao.is_correct = TRUE`,
      [formId]
    );
    const correctOptId = correctOptRes.rows[0].id;

    const ansRes = await fetch(`${baseUrl}/api/games/${gameId}/student/${studentId}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionNumber: 1,
        selectedOptionId: correctOptId,
      }),
    });

    const ansData = await ansRes.json();
    expect(ansRes.status).toBe(200);
    expect(ansData.success).toBe(true);
    expect(ansData.totalAnswered).toBe(1);

    // 3. Finish test manually
    const finishRes = await fetch(`${baseUrl}/api/games/${gameId}/student/${studentId}/finish`, {
      method: 'POST',
    });
    expect(finishRes.status).toBe(200);

    // 4. Retrieve final state with score report
    const stateRes = await fetch(`${baseUrl}/api/games/${gameId}/student/${studentId}/state`);
    const stateData = await stateRes.json();
    expect(stateRes.status).toBe(200);
    expect(stateData.student.status).toBe('FINISHED');
    expect(stateData.scoreReport).toBeDefined();
    expect(stateData.scoreReport.correctAnswers).toBe(1);
    expect(stateData.scoreReport.studentId).toBe(99);
    expect(stateData.scoreReport.formId).toBe(1);
  });
});
