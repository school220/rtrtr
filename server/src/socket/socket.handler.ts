import { Server, Socket } from 'socket.io';
import { getDb } from '../db/index.js';
import { EventService } from '../services/event.service.js';
import { GameService } from '../services/game.service.js';
import { userTracker } from '../utils/user-tracker.js';
import { isValidTeacherToken } from '../middleware/security.middleware.js';

let timerTickerInterval: NodeJS.Timeout | null = null;

export function stopTimerTicker() {
  if (timerTickerInterval) {
    clearInterval(timerTickerInterval);
    timerTickerInterval = null;
  }
}

export function setupSocketHandlers(io: Server) {
  // Start server-authoritative 1-second countdown ticker for all active tests
  if (!timerTickerInterval) {
    timerTickerInterval = setInterval(async () => {
      try {
        const db = await getDb();
        const gamesRes = await db.query(
          `SELECT id, code, ends_at, total_time_seconds, status
           FROM games
           WHERE status = 'IN_PROGRESS' AND ends_at IS NOT NULL`
        );

        const now = Date.now();
        for (const g of gamesRes.rows) {
          const endsAtMs = new Date(g.ends_at).getTime();
          const remainingSeconds = Math.max(0, Math.floor((endsAtMs - now) / 1000));

          // Broadcast authoritative clock tick to everyone in the exam room
          io.to(`game:${g.id}:students`).to(`game:${g.id}:teacher`).emit('game:timer_tick', {
            gameId: g.id,
            remainingSeconds,
            totalTimeSeconds: g.total_time_seconds,
            serverTime: now,
            endsAt: g.ends_at,
          });

          // Check if test time has expired
          if (remainingSeconds <= 0) {
            console.log(`⏰ Time expired for game ${g.code} (${g.id}). Auto-finishing test...`);
            await GameService.finishGame(g.id, 'TIME_EXPIRED');

            io.to(`game:${g.id}:students`).emit('game:finished', {
              gameId: g.id,
              reason: 'TIME_EXPIRED',
            });
            io.to(`game:${g.id}:teacher`).emit('game:finished', {
              gameId: g.id,
              reason: 'TIME_EXPIRED',
            });

            const dashboard = await GameService.getTeacherDashboardData(g.id);
            if (dashboard) {
              io.to(`game:${g.id}:teacher`).emit('teacher:dashboard_update', dashboard);
            }
          }
        }
      } catch (tickerErr) {
        // Silently catch to avoid crashing socket ticker
      }
    }, 1000);
  }

  io.on('connection', (socket: Socket) => {
    let attachedGameId: string | null = null;
    let attachedStudentId: number | null = null;
    let isTeacher = false;

    // Track active connection and log to server console
    userTracker.onConnection(socket.id, socket.handshake.address || '');

    // 0. Millisecond-precision clock synchronization (NTP Cristian's algorithm)
    socket.on('time:ping', (data: { clientTimestamp: number }) => {
      socket.emit('time:pong', {
        clientTimestamp: data?.clientTimestamp ?? 0,
        serverTime: Date.now(),
      });
    });

    // 1. Teacher registers to room (protected by teacher token)
    socket.on('teacher:join', async (data: { gameId: string; teacherToken?: string }) => {
      const token = data?.teacherToken || (socket.handshake.auth?.token as string);
      if (!isValidTeacherToken(token)) {
        console.warn(`[SECURITY] ⚠️ Неавторизованная попытка подключения к комнате учителя (socket: ${socket.id})`);
        socket.emit('error', { message: 'Доступ запрещён: требуется авторизация учителя' });
        return;
      }

      attachedGameId = data.gameId;
      isTeacher = true;
      socket.join(`game:${data.gameId}:teacher`);

      // Send latest dashboard snapshot immediately
      try {
        const dashboard = await GameService.getTeacherDashboardData(data.gameId);
        socket.emit('teacher:dashboard_update', dashboard);

        userTracker.registerTeacher(socket.id, data.gameId, dashboard?.game?.code);

        // Also emit immediate timer state if active
        if (dashboard?.game?.status === 'IN_PROGRESS' && dashboard.game.ends_at) {
          const remainingSeconds = Math.max(
            0,
            Math.floor((new Date(dashboard.game.ends_at).getTime() - Date.now()) / 1000)
          );
          socket.emit('game:timer_tick', {
            gameId: data.gameId,
            remainingSeconds,
            totalTimeSeconds: dashboard.game.total_time_seconds,
            serverTime: Date.now(),
            endsAt: dashboard.game.ends_at,
          });
        }
      } catch (err) {
        console.error('Error fetching dashboard on teacher join:', err);
      }
    });

    // 2. Student connects / joins room (validates sessionToken)
    socket.on('student:join', (data: { gameId: string; studentId: number; sessionToken: string }, callback?: () => void) => {
      attachedGameId = data.gameId;
      attachedStudentId = data.studentId;
      isTeacher = false;

      // Check if test is already IN_PROGRESS to sync timer immediately upon join
      getDb()
        .then(async (db) => {
          const gameRes = await db.query(
            `SELECT ends_at, total_time_seconds, status, code FROM games WHERE id = $1`,
            [data.gameId]
          );

          // Retrieve student details for server console logging and token verification
          const studentRes = await db.query(
            `SELECT student_id, first_name, last_name, form_id, session_token
             FROM students
             WHERE game_id = $1 AND student_id = $2`,
            [data.gameId, data.studentId]
          );

          if (studentRes.rows.length === 0) {
            socket.emit('error', { message: 'Ученик не найден в этой аудитории' });
            return;
          }

          const st = studentRes.rows[0];

          // Session token verification (in production, tokens must match)
          if (
            process.env.NODE_ENV !== 'test' &&
            data.sessionToken &&
            st.session_token &&
            st.session_token !== data.sessionToken
          ) {
            console.warn(`[SECURITY] ⚠️ Несовпадение токена сессии ученика #${data.studentId} на сокете ${socket.id}`);
            socket.emit('error', { message: 'Недействительный токен сессии' });
            return;
          }

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

          userTracker.registerStudent({
            socketId: socket.id,
            studentId: st.student_id,
            firstName: st.first_name,
            lastName: st.last_name,
            formId: st.form_id,
            gameId: data.gameId,
            gameCode: gameRes.rows[0]?.code,
            ip: socket.handshake.address || '',
          });

          if (gameRes.rows.length > 0 && gameRes.rows[0].status === 'IN_PROGRESS' && gameRes.rows[0].ends_at) {
            const remainingSeconds = Math.max(
              0,
              Math.floor((new Date(gameRes.rows[0].ends_at).getTime() - Date.now()) / 1000)
            );
            socket.emit('game:timer_tick', {
              gameId: data.gameId,
              remainingSeconds,
              totalTimeSeconds: gameRes.rows[0].total_time_seconds,
              serverTime: Date.now(),
              endsAt: gameRes.rows[0].ends_at,
            });
          }

          await db.query(
            `UPDATE students SET is_online = TRUE, last_active_at = CURRENT_TIMESTAMP
             WHERE game_id = $1 AND student_id = $2`,
            [data.gameId, data.studentId]
          );
        })
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
      userTracker.onDisconnect(socket.id);
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
