import { Server, Socket } from 'socket.io';
import { getDb } from '../db/index.js';
import { EventService } from '../services/event.service.js';
import { GameService } from '../services/game.service.js';

export function setupSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    let attachedGameId: string | null = null;
    let attachedStudentId: number | null = null;
    let isTeacher = false;

    // 1. Teacher registers to room
    socket.on('teacher:join', async (data: { gameId: string }) => {
      attachedGameId = data.gameId;
      isTeacher = true;
      socket.join(`game:${data.gameId}:teacher`);

      // Send latest dashboard snapshot immediately
      try {
        const dashboard = await GameService.getTeacherDashboardData(data.gameId);
        socket.emit('teacher:dashboard_update', dashboard);
      } catch (err) {
        console.error('Error fetching dashboard on teacher join:', err);
      }
    });

    // 2. Student connects / joins room
    socket.on('student:join', (data: { gameId: string; studentId: number; sessionToken: string }, callback?: () => void) => {
      attachedGameId = data.gameId;
      attachedStudentId = data.studentId;
      isTeacher = false;

      socket.join(`game:${data.gameId}:students`);
      socket.join(`game:${data.gameId}:student:${data.studentId}`);

      // Notify teacher room of online status immediately
      io.to(`game:${data.gameId}:teacher`).emit('student:status_change', {
        studentId: data.studentId,
        isOnline: true,
      });

      if (typeof callback === 'function') {
        callback();
      }

      // Update DB asynchronously in background
      getDb()
        .then((db) =>
          db.query(
            `UPDATE students SET is_online = TRUE, last_active_at = CURRENT_TIMESTAMP
             WHERE game_id = $1 AND student_id = $2`,
            [data.gameId, data.studentId]
          )
        )
        .catch(() => {});
    });

    // 3. Security event from student (tab switch, fullscreen exit, etc.)
    socket.on('student:security_event', async (data: {
      gameId: string;
      studentId: number;
      eventType: string;
      metadata?: Record<string, any>;
    }) => {
      if (!data.gameId || !data.studentId) return;

      await EventService.logEvent(data.gameId, data.studentId, data.eventType, data.metadata || {});

      // Notify teacher dashboard immediately
      io.to(`game:${data.gameId}:teacher`).emit('teacher:security_alert', {
        studentId: data.studentId,
        eventType: data.eventType,
        timestamp: new Date().toISOString(),
      });

      // Also push full update
      try {
        const dashboard = await GameService.getTeacherDashboardData(data.gameId);
        io.to(`game:${data.gameId}:teacher`).emit('teacher:dashboard_update', dashboard);
      } catch (err) {
        // ignore
      }
    });

    // 4. Handle Disconnection
    socket.on('disconnect', async () => {
      if (attachedGameId && attachedStudentId && !isTeacher) {
        try {
          const db = await getDb();
          await db.query(
            `UPDATE students SET is_online = FALSE, last_active_at = CURRENT_TIMESTAMP
             WHERE game_id = $1 AND student_id = $2`,
            [attachedGameId, attachedStudentId]
          );

          await EventService.logEvent(attachedGameId, attachedStudentId, 'STUDENT_DISCONNECTED', {});

          // Inform teacher
          const dashboard = await GameService.getTeacherDashboardData(attachedGameId);
          io.to(`game:${attachedGameId}:teacher`).emit('teacher:dashboard_update', dashboard);
        } catch (err) {
          console.error('Error handling student disconnect:', err);
        }
      }
    });
  });
}
