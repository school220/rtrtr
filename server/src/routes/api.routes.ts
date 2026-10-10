import { Router, Request, Response } from 'express';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config.js';
import { GameService } from '../services/game.service.js';
import { AnswerService } from '../services/answer.service.js';
import { QuestionService } from '../services/question.service.js';
import { EventService } from '../services/event.service.js';
import { getDb } from '../db/index.js';

// In-memory set of authenticated proctor session tokens
const activeTeacherTokens = new Set<string>();

export function createApiRouter(io: Server): Router {
  const router = Router();

  // 0. Teacher authentication endpoints
  router.post('/teacher/login', (req: Request, res: Response): void => {
    const { username, password } = req.body || {};
    if (!username || !password) {
      res.status(400).json({ error: 'Необходимо указать логин и пароль' });
      return;
    }

    const expectedUser = config.teacherAuth.username;
    const expectedPass = config.teacherAuth.password;

    if (username === expectedUser && password === expectedPass) {
      const token = `proctor_tok_${uuidv4()}`;
      activeTeacherTokens.add(token);
      res.json({
        success: true,
        token,
        username: expectedUser,
        role: 'COMMISSION_CHAIR',
        message: 'Авторизация председателя комиссии успешна',
      });
    } else {
      res.status(401).json({ error: 'Неверный логин или пароль председателя комиссии' });
    }
  });

  router.get('/teacher/verify', (req: Request, res: Response): void => {
    const authHeader = (req.headers.authorization as string) || (req.headers['x-teacher-token'] as string);
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

    if (token && activeTeacherTokens.has(token)) {
      res.json({ valid: true, username: config.teacherAuth.username });
    } else {
      res.status(401).json({ valid: false, error: 'Сессия истекла или недействительна' });
    }
  });

  router.post('/teacher/logout', (req: Request, res: Response): void => {
    const authHeader = (req.headers.authorization as string) || (req.headers['x-teacher-token'] as string);
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    if (token) {
      activeTeacherTokens.delete(token);
    }
    res.json({ success: true });
  });

  // Proctor Preview Mode: creates an active authentic test session for proctor/teacher
  router.post('/teacher/preview-session', async (req: Request, res: Response): Promise<void> => {
    try {
      const authHeader = (req.headers.authorization as string) || (req.headers['x-teacher-token'] as string);
      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

      if (token && !activeTeacherTokens.has(token)) {
        res.status(401).json({ error: 'Недействительный токен председателя комиссии' });
        return;
      }

      const formId = Math.min(Math.max(parseInt(req.body?.formId || 1, 10), 1), 50);
      const db = await getDb();
      const gameId = uuidv4();
      const code = 'PRK' + Math.floor(100 + Math.random() * 900);
      const duration = 1800; // 30 minutes
      const now = new Date();
      const endsAt = new Date(now.getTime() + duration * 1000);

      // Create preview game in IN_PROGRESS state
      await db.query(
        `INSERT INTO games (id, code, title, status, total_time_seconds, started_at, ends_at, max_students, created_at)
         VALUES ($1, $2, $3, 'IN_PROGRESS', $4, $5, $6, 50, CURRENT_TIMESTAMP)`,
        [gameId, code, `Проверка варианта №${formId} (Проктор)`, duration, now.toISOString(), endsAt.toISOString()]
      );

      // Create proctor student participant
      const studentId = 99;
      const sessionToken = `prk_sess_${uuidv4()}`;
      await db.query(
        `INSERT INTO students (game_id, student_id, form_id, first_name, last_name, session_token, status, is_online, joined_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'IN_PROGRESS', TRUE, CURRENT_TIMESTAMP)`,
        [gameId, studentId, formId, 'Проктор', 'Комиссия', sessionToken]
      );

      res.json({
        isReconnection: false,
        gameId,
        gameCode: code,
        gameStatus: 'IN_PROGRESS',
        studentId,
        formId,
        firstName: 'Проктор',
        lastName: 'Комиссия',
        sessionToken,
        status: 'IN_PROGRESS',
        endsAt: endsAt.toISOString(),
      });
    } catch (err: any) {
      console.error('Error creating proctor preview session:', err);
      res.status(500).json({ error: err.message || 'Ошибка запуска предпросмотра теста' });
    }
  });

  // List recent games for teacher dashboard (excluding private proctor preview rooms)
  router.get('/games/recent', async (req: Request, res: Response): Promise<void> => {
    try {
      const db = await getDb();
      const resGames = await db.query(
        `SELECT g.id, g.code, g.title, g.status, g.created_at, g.started_at, g.finished_at,
                g.total_time_seconds,
                COUNT(s.id)::int as student_count
         FROM games g
         LEFT JOIN students s ON s.game_id = g.id
         WHERE g.code NOT LIKE 'PRK%'
         GROUP BY g.id
         ORDER BY g.created_at DESC
         LIMIT 25`
      );
      res.json(resGames.rows);
    } catch (err: any) {
      console.error('Error fetching recent games:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Get current active game (WAITING or IN_PROGRESS, excluding private proctor preview rooms)
  router.get('/games/active', async (req: Request, res: Response): Promise<void> => {
    try {
      const db = await getDb();
      const resGame = await db.query(
        `SELECT g.id, g.code, g.title, g.status, g.created_at, g.started_at, g.finished_at,
                g.total_time_seconds,
                COUNT(s.id)::int as student_count
         FROM games g
         LEFT JOIN students s ON s.game_id = g.id
         WHERE g.status IN ('WAITING', 'IN_PROGRESS') AND g.code NOT LIKE 'PRK%'
         GROUP BY g.id
         ORDER BY g.created_at DESC
         LIMIT 1`
      );
      res.json(resGame.rows[0] || null);
    } catch (err: any) {
      console.error('Error fetching active game:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 1. Teacher creates game
  router.post('/games', async (req: Request, res: Response): Promise<void> => {
    try {
      const { title, durationSeconds, durationMinutes } = req.body;
      const duration = durationSeconds
        ? parseInt(durationSeconds, 10)
        : durationMinutes
        ? parseInt(durationMinutes, 10) * 60
        : undefined;

      const game = await GameService.createGame({ title, durationSeconds: duration });
      res.status(201).json(game);
    } catch (err: any) {
      console.error('Error creating game:', err);
      res.status(500).json({ error: err.message || 'Ошибка создания игры' });
    }
  });

  // 1.1 Teacher updates game duration (when status === 'WAITING' before test starts)
  router.patch('/games/:gameId/duration', async (req: Request, res: Response): Promise<void> => {
    try {
      const { gameId } = req.params;
      const { durationMinutes, durationSeconds } = req.body;
      const rawSecs = durationSeconds
        ? parseInt(durationSeconds, 10)
        : parseInt(durationMinutes, 10) * 60;

      if (isNaN(rawSecs) || rawSecs < 60 || rawSecs > 7200) {
        res.status(400).json({ error: 'Время теста должно быть от 1 до 120 минут (60..7200 сек)' });
        return;
      }

      const db = await getDb();
      const gameRes = await db.query('SELECT id, status, code FROM games WHERE id = $1', [gameId]);
      if (gameRes.rows.length === 0) {
        res.status(404).json({ error: 'Игра не найдена' });
        return;
      }

      const game = gameRes.rows[0];
      if (game.status !== 'WAITING') {
        res.status(400).json({ error: 'Изменить время теста можно только до его запуска (в статусе ожидания)' });
        return;
      }

      await db.query('UPDATE games SET total_time_seconds = $1 WHERE id = $2', [rawSecs, gameId]);

      // Broadcast update to teacher and students waiting
      const dashboard = await GameService.getTeacherDashboardData(gameId);
      io.to(`game:${gameId}:teacher`).emit('teacher:dashboard_update', dashboard);
      io.to(`game:${gameId}:students`).emit('game:duration_updated', {
        gameId,
        totalTimeSeconds: rawSecs,
        durationMinutes: Math.round(rawSecs / 60),
      });

      res.json({
        success: true,
        gameId,
        totalTimeSeconds: rawSecs,
        durationMinutes: Math.round(rawSecs / 60),
      });
    } catch (err: any) {
      console.error('Error updating game duration:', err);
      res.status(500).json({ error: err.message || 'Ошибка обновления времени теста' });
    }
  });

  // 2. Lookup game by code
  router.get('/games/code/:code', async (req: Request, res: Response): Promise<void> => {
    try {
      const { code } = req.params;
      const game = await GameService.getGameByCode(code);
      if (!game) {
        res.status(404).json({ error: 'Игра с указанным кодом не найдена' });
        return;
      }
      res.json({
        id: game.id,
        code: game.code,
        title: game.title,
        status: game.status,
        totalTimeSeconds: game.total_time_seconds,
        maxStudents: game.max_students,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. Student joins game (atomic ID allocation)
  router.post('/games/join', async (req: Request, res: Response): Promise<void> => {
    try {
      const { gameCode, firstName, lastName, sessionToken } = req.body;
      if (!gameCode || !firstName || !lastName) {
        res.status(400).json({ error: 'Код игры, имя и фамилия обязательны.' });
        return;
      }

      const joinResult = await GameService.joinGame({
        gameCode,
        firstName,
        lastName,
        existingSessionToken: sessionToken,
      });

      // Broadcast update to teacher dashboard
      try {
        const dashboard = await GameService.getTeacherDashboardData(joinResult.gameId);
        io.to(`game:${joinResult.gameId}:teacher`).emit('teacher:dashboard_update', dashboard);
      } catch (broadcastErr) {
        console.error('Failed to broadcast teacher update:', broadcastErr);
      }

      res.json(joinResult);
    } catch (err: any) {
      console.error('Join error:', err.message);
      if (err.message.includes('Все доступные места заняты')) {
        res.status(409).json({ error: err.message });
        return;
      }
      res.status(400).json({ error: err.message || 'Не удалось присоединиться к игре' });
    }
  });

  // Clock synchronization HTTP endpoint (fallback for clients)
  router.get('/time', (_req: Request, res: Response): void => {
    res.json({ serverTime: Date.now() });
  });

  // 4. Teacher starts test
  router.post('/games/:gameId/start', async (req: Request, res: Response): Promise<void> => {
    try {
      const { gameId } = req.params;
      const startResult = await GameService.startGame(gameId);

      const totalTimeSeconds = Math.max(
        0,
        Math.floor((new Date(startResult.endsAt).getTime() - new Date(startResult.startedAt).getTime()) / 1000)
      );

      const startPayload = {
        gameId,
        startedAt: startResult.startedAt,
        endsAt: startResult.endsAt,
        totalTimeSeconds,
        remainingSeconds: totalTimeSeconds,
        serverTime: Date.now(),
      };

      // Synchronous broadcast to all students and teacher
      io.to(`game:${gameId}:students`).emit('game:started', startPayload);

      // Emit initial authoritative timer tick immediately
      io.to(`game:${gameId}:students`).to(`game:${gameId}:teacher`).emit('game:timer_tick', {
        gameId,
        remainingSeconds: totalTimeSeconds,
        totalTimeSeconds,
        serverTime: Date.now(),
        endsAt: startResult.endsAt,
      });

      const dashboard = await GameService.getTeacherDashboardData(gameId);
      io.to(`game:${gameId}:teacher`).emit('teacher:dashboard_update', dashboard);
      io.to(`game:${gameId}:teacher`).emit('game:started', startPayload);

      res.json({ success: true, ...startResult, ...startPayload });
    } catch (err: any) {
      console.error('Start error:', err);
      res.status(400).json({ error: err.message || 'Не удалось запустить тест' });
    }
  });

  // 5. Teacher manually finishes test
  router.post('/games/:gameId/finish', async (req: Request, res: Response): Promise<void> => {
    try {
      const { gameId } = req.params;
      const finishResult = await GameService.finishGame(gameId, 'MANUAL');

      // Broadcast to all students and teacher
      io.to(`game:${gameId}:students`).emit('game:finished', { gameId, reason: 'TEACHER_FINISHED' });
      
      const dashboard = await GameService.getTeacherDashboardData(gameId);
      io.to(`game:${gameId}:teacher`).emit('teacher:dashboard_update', dashboard);
      io.to(`game:${gameId}:teacher`).emit('game:finished', finishResult);

      res.json({ success: true, ...finishResult });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 6. Teacher gets dashboard snapshot
  router.get('/games/:gameId/teacher', async (req: Request, res: Response): Promise<void> => {
    try {
      const { gameId } = req.params;
      const dashboard = await GameService.getTeacherDashboardData(gameId);
      if (!dashboard) {
        res.status(404).json({ error: 'Игра не найдена' });
        return;
      }
      res.json(dashboard);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 6.1 Teacher downloads results in Excel (.xlsx) format
  router.get('/games/:gameId/export/excel', async (req: Request, res: Response): Promise<void> => {
    try {
      const { gameId } = req.params;
      const dashboard = await GameService.getTeacherDashboardData(gameId);
      if (!dashboard) {
        res.status(404).json({ error: 'Игра не найдена' });
        return;
      }

      const { ExcelService } = await import('../services/excel.service.js');
      const buffer = await ExcelService.generateResultsWorkbook(dashboard);

      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `Rezultaty_${dashboard.game.code}_${dateStr}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', buffer.length);
      res.send(buffer);
    } catch (err: any) {
      console.error('Error generating Excel file:', err);
      res.status(500).json({ error: err.message || 'Ошибка генерации Excel файла' });
    }
  });

  // 7. Student retrieves current state
  router.get('/games/:gameId/student/:studentId/state', async (req: Request, res: Response): Promise<void> => {
    try {
      const { gameId, studentId } = req.params;
      const sId = parseInt(studentId, 10);
      const state = await GameService.getStudentState(gameId, sId);
      res.json(state);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 7.1 Student retrieves all questions
  router.get('/games/:gameId/student/:studentId/questions', async (req: Request, res: Response): Promise<void> => {
    try {
      const { gameId, studentId } = req.params;
      const sId = parseInt(studentId, 10);
      const state = await GameService.getStudentState(gameId, sId);
      const questions = await QuestionService.getAllQuestionsForStudent(state.student.formId);
      res.json(questions);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 8. Student retrieves specific question without sensitive answers
  router.get('/games/:gameId/student/:studentId/question/:questionNumber', async (req: Request, res: Response): Promise<void> => {
    try {
      const { gameId, studentId, questionNumber } = req.params;
      const sId = parseInt(studentId, 10);
      const qNum = parseInt(questionNumber, 10);

      const state = await GameService.getStudentState(gameId, sId);
      const question = await QuestionService.getQuestionForStudent(state.student.formId, qNum);

      if (!question) {
        res.status(404).json({ error: 'Вопрос не найден' });
        return;
      }

      res.json(question);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 9. Student submits answer
  router.post('/games/:gameId/student/:studentId/answer', async (req: Request, res: Response): Promise<void> => {
    try {
      const { gameId, studentId } = req.params;
      const { questionNumber, selectedOptionId, answerText } = req.body;
      const sId = parseInt(studentId, 10);
      const qNum = parseInt(questionNumber, 10);

      const submitResult = await AnswerService.submitAnswer({
        gameId,
        studentId: sId,
        questionNumber: qNum,
        selectedOptionId,
        answerText,
      });

      // Update teacher dashboard in real-time with lightweight progress event
      io.to(`game:${gameId}:teacher`).emit('student:progress', {
        studentId: sId,
        questionNumber: qNum,
        totalAnswered: submitResult.totalAnswered,
        isFinished: submitResult.isFinished,
      });

      res.json(submitResult);
    } catch (err: any) {
      console.error('Answer submission error:', err.message);
      res.status(400).json({ error: err.message || 'Ошибка отправки ответа' });
    }
  });

  // 10. Student finishes test manually
  router.post('/games/:gameId/student/:studentId/finish', async (req: Request, res: Response): Promise<void> => {
    try {
      const { gameId, studentId } = req.params;
      const sId = parseInt(studentId, 10);

      await GameService.finishStudentTest(gameId, sId);

      // Notify teacher dashboard
      try {
        const dashboard = await GameService.getTeacherDashboardData(gameId);
        io.to(`game:${gameId}:teacher`).emit('teacher:dashboard_update', dashboard);
      } catch (e) {
        // ignore
      }

      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 11. Student telemetry / security event (fallback when socket is reconnecting)
  router.post('/games/:gameId/student/:studentId/event', async (req: Request, res: Response): Promise<void> => {
    try {
      const { gameId, studentId } = req.params;
      const { eventType, metadata } = req.body;
      const sId = parseInt(studentId, 10);

      await EventService.logEvent(gameId, sId, eventType, metadata || {});

      io.to(`game:${gameId}:teacher`).emit('teacher:security_alert', {
        studentId: sId,
        eventType,
        timestamp: new Date().toISOString(),
      });

      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
}
