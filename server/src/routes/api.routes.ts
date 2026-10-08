import { Router, Request, Response } from 'express';
import { Server } from 'socket.io';
import { GameService } from '../services/game.service.js';
import { AnswerService } from '../services/answer.service.js';
import { QuestionService } from '../services/question.service.js';
import { EventService } from '../services/event.service.js';

export function createApiRouter(io: Server): Router {
  const router = Router();

  // 1. Teacher creates game
  router.post('/games', async (req: Request, res: Response): Promise<void> => {
    try {
      const { title, durationSeconds } = req.body;
      const game = await GameService.createGame({ title, durationSeconds });
      res.status(201).json(game);
    } catch (err: any) {
      console.error('Error creating game:', err);
      res.status(500).json({ error: err.message || 'Ошибка создания игры' });
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

  // 4. Teacher starts test
  router.post('/games/:gameId/start', async (req: Request, res: Response): Promise<void> => {
    try {
      const { gameId } = req.params;
      const startResult = await GameService.startGame(gameId);

      // Synchronous broadcast to all students and teacher
      io.to(`game:${gameId}:students`).emit('game:started', {
        gameId,
        startedAt: startResult.startedAt,
        endsAt: startResult.endsAt,
      });

      const dashboard = await GameService.getTeacherDashboardData(gameId);
      io.to(`game:${gameId}:teacher`).emit('teacher:dashboard_update', dashboard);
      io.to(`game:${gameId}:teacher`).emit('game:started', startResult);

      res.json({ success: true, ...startResult });
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
