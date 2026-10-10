import { v4 as uuidv4 } from 'uuid';
import { getDb, withTransaction } from '../db/index.js';
import { generateGameCode } from '../utils/code-generator.js';
import { config } from '../config.js';
import { QuestionService } from './question.service.js';
import { ScoringService } from './scoring.service.js';
import { EventService } from './event.service.js';
import { sanitizeName } from '../middleware/security.middleware.js';

export interface CreateGameParams {
  title?: string;
  durationSeconds?: number;
}

export interface JoinGameParams {
  gameCode: string;
  firstName: string;
  lastName: string;
  existingSessionToken?: string;
}

export interface TeacherStudentItem {
  id: number;
  studentId: number;
  formId: number;
  firstName: string;
  lastName: string;
  status: string;
  isOnline: boolean;
  answeredCount: number;
  scoreReport?: any;
  securityEvents?: { pageHidden: number; fullscreenExit: number; disconnected: number; totalSuspicious: number };
}

export class GameService {
  /**
   * Teacher creates a new testing room with a unique code
   */
  public static async createGame(params: CreateGameParams = {}) {
    const db = await getDb();
    const gameId = uuidv4();
    const duration = params.durationSeconds || config.testDurationSeconds;
    const title = params.title || 'Классный тест';

    // Generate unique game code
    let code = '';
    let isUnique = false;
    while (!isUnique) {
      code = generateGameCode(5);
      const res = await db.query('SELECT id FROM games WHERE code = $1', [code]);
      if (res.rows.length === 0) {
        isUnique = true;
      }
    }

    await db.query(
      `INSERT INTO games (id, code, title, status, total_time_seconds, max_students, created_at)
       VALUES ($1, $2, $3, 'WAITING', $4, $5, CURRENT_TIMESTAMP)`,
      [gameId, code, title, duration, config.maxStudentsPerGame]
    );

    return {
      gameId,
      code,
      title,
      status: 'WAITING',
      durationSeconds: duration,
      maxStudents: config.maxStudentsPerGame,
    };
  }

  /**
   * Retrieves game metadata by code or id
   */
  public static async getGameByCode(code: string) {
    const db = await getDb();
    const cleanCode = code.trim().toUpperCase();
    const res = await db.query(
      `SELECT id, code, title, status, total_time_seconds, started_at, ends_at, finished_at, max_students, created_at
       FROM games WHERE code = $1`,
      [cleanCode]
    );
    if (res.rows.length === 0) return null;
    return res.rows[0];
  }

  public static async getGameById(gameId: string) {
    const db = await getDb();
    const res = await db.query(
      `SELECT id, code, title, status, total_time_seconds, started_at, ends_at, finished_at, max_students, created_at
       FROM games WHERE id = $1`,
      [gameId]
    );
    if (res.rows.length === 0) return null;
    return res.rows[0];
  }

  /**
   * Student joins the game.
   * Atomically assigns the lowest available unique student ID (1..50)
   * and guarantees matching form_id = student_id.
   * Prevents race conditions and duplicate ID allocation.
   */
  public static async joinGame(params: JoinGameParams) {
    const { gameCode, firstName, lastName, existingSessionToken } = params;
    const cleanCode = (gameCode || '').trim().toUpperCase();
    const cleanFirst = sanitizeName(firstName);
    const cleanLast = sanitizeName(lastName);

    if (!cleanFirst || !cleanLast) {
      throw new Error('Имя и фамилия обязательны для заполнения (недопустимы спецсимволы и пустые значения).');
    }

    return await withTransaction(async (db) => {
      // 1. Lock game row for update to serialize concurrent joins
      const gameRes = await db.query(
        `SELECT id, code, status, total_time_seconds, max_students, started_at, ends_at
         FROM games WHERE code = $1 FOR UPDATE`,
        [cleanCode]
      );

      if (gameRes.rows.length === 0) {
        throw new Error('Игра с таким кодом не найдена.');
      }
      const game = gameRes.rows[0];

      // 2. Check if student is reconnecting with an existing valid session token
      if (existingSessionToken) {
        const existingStudent = await db.query(
          `SELECT id, student_id, form_id, first_name, last_name, session_token, status
           FROM students
           WHERE game_id = $1 AND session_token = $2`,
          [game.id, existingSessionToken]
        );

        if (existingStudent.rows.length > 0) {
          const s = existingStudent.rows[0];
          // Mark online and update activity
          await db.query(
            `UPDATE students SET is_online = TRUE, last_active_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [s.id]
          );

          await EventService.logEvent(game.id, s.student_id, 'STUDENT_RECONNECTED', {
            firstName: s.first_name,
            lastName: s.last_name,
          }, db);

          return {
            isReconnection: true,
            gameId: game.id,
            gameCode: game.code,
            gameStatus: game.status,
            studentId: s.student_id,
            formId: s.form_id,
            firstName: s.first_name,
            lastName: s.last_name,
            sessionToken: s.session_token,
            status: s.status,
            endsAt: game.ends_at,
          };
        }
      }

      // If test already started or finished, new students cannot join
      if (game.status !== 'WAITING') {
        throw new Error('Тестирование уже началось или завершено. Вход новых участников закрыт.');
      }

      // 3. Find all occupied student_ids for this game
      const occupiedRes = await db.query(
        `SELECT student_id FROM students WHERE game_id = $1 ORDER BY student_id ASC`,
        [game.id]
      );
      const occupiedIds = new Set<number>(occupiedRes.rows.map((r) => r.student_id));

      if (occupiedIds.size >= game.max_students) {
        throw new Error('Все доступные места заняты.');
      }

      // 4. Find the lowest unused ID from 1 to 50
      let assignedId = -1;
      for (let i = 1; i <= game.max_students; i++) {
        if (!occupiedIds.has(i)) {
          assignedId = i;
          break;
        }
      }

      if (assignedId === -1 || assignedId > 50) {
        throw new Error('Все доступные места заняты.');
      }

      // Fixed mapping: student_id == form_id
      const assignedFormId = assignedId;

      // Generate secure session token
      const sessionToken = uuidv4();

      await db.query(
        `INSERT INTO students
         (game_id, student_id, form_id, first_name, last_name, session_token, status, is_online, joined_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'READY', TRUE, CURRENT_TIMESTAMP)`,
        [game.id, assignedId, assignedFormId, cleanFirst, cleanLast, sessionToken]
      );

      // Log event
      await EventService.logEvent(game.id, assignedId, 'STUDENT_JOINED', {
        firstName: cleanFirst,
        lastName: cleanLast,
        formId: assignedFormId,
      }, db);

      return {
        isReconnection: false,
        gameId: game.id,
        gameCode: game.code,
        gameStatus: game.status,
        studentId: assignedId,
        formId: assignedFormId,
        firstName: cleanFirst,
        lastName: cleanLast,
        sessionToken,
        status: 'READY',
      };
    });
  }

  /**
   * Pre-flight checks and start test
   */
  public static async startGame(gameId: string) {
    return await withTransaction(async (db) => {
      const gameRes = await db.query(
        `SELECT id, status, total_time_seconds FROM games WHERE id = $1 FOR UPDATE`,
        [gameId]
      );
      if (gameRes.rows.length === 0) {
        throw new Error('Игра не найдена.');
      }
      const game = gameRes.rows[0];

      if (game.status !== 'WAITING') {
        throw new Error(`Невозможно запустить тест в статусе: ${game.status}`);
      }

      // Check students
      const studentsRes = await db.query(
        `SELECT id, student_id, form_id FROM students WHERE game_id = $1 ORDER BY student_id ASC`,
        [gameId]
      );

      if (studentsRes.rows.length === 0) {
        throw new Error('В игре нет подключённых учеников.');
      }

      // Verify no duplicates
      const seenStudentIds = new Set<number>();
      const seenFormIds = new Set<number>();

      for (const s of studentsRes.rows) {
        if (seenStudentIds.has(s.student_id)) {
          throw new Error(`Обнаружен дубликат ID ученика: ${s.student_id}`);
        }
        seenStudentIds.add(s.student_id);

        if (seenFormIds.has(s.form_id)) {
          throw new Error(`Обнаружен конфликт бланка: ${s.form_id}`);
        }
        seenFormIds.add(s.form_id);

        if (s.student_id !== s.form_id) {
          throw new Error(`Несоответствие ID ученика (${s.student_id}) и бланка (${s.form_id}).`);
        }
      }

      // Verify each assigned form has exactly 30 questions
      for (const s of studentsRes.rows) {
        const integrity = await QuestionService.verifyFormIntegrity(s.form_id, db);
        if (!integrity.valid) {
          throw new Error(`Ошибка в бланке №${s.form_id}: ${integrity.errors.join('; ')}`);
        }
      }

      const now = new Date();
      const endsAt = new Date(now.getTime() + game.total_time_seconds * 1000);

      // Transition: WAITING -> STARTING -> IN_PROGRESS
      await db.query(
        `UPDATE games
         SET status = 'IN_PROGRESS', started_at = $1, ends_at = $2
         WHERE id = $3`,
        [now.toISOString(), endsAt.toISOString(), gameId]
      );

      // Update student statuses to IN_PROGRESS
      await db.query(
        `UPDATE students SET status = 'IN_PROGRESS' WHERE game_id = $1`,
        [gameId]
      );

      await EventService.logEvent(gameId, null, 'TEST_STARTED', {
        startedAt: now.toISOString(),
        endsAt: endsAt.toISOString(),
        studentCount: studentsRes.rows.length,
      }, db);

      return {
        gameId,
        status: 'IN_PROGRESS',
        startedAt: now.toISOString(),
        endsAt: endsAt.toISOString(),
        studentCount: studentsRes.rows.length,
      };
    });
  }

  /**
   * Finishes test manually or upon expiration
   */
  public static async finishGame(gameId: string, reason: 'MANUAL' | 'TIME_EXPIRED' = 'MANUAL') {
    const db = await getDb();
    const finalStatus = reason === 'TIME_EXPIRED' ? 'TIME_EXPIRED' : 'FINISHED';

    await db.query(
      `UPDATE games
       SET status = 'FINISHED', finished_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [gameId]
    );

    // Mark all remaining in-progress students as FINISHED
    await db.query(
      `UPDATE students
       SET status = 'FINISHED', finished_at = CURRENT_TIMESTAMP
       WHERE game_id = $1 AND status != 'FINISHED'`,
      [gameId]
    );

    await EventService.logEvent(gameId, null, 'TEST_FINISHED', { reason });

    return { gameId, status: 'FINISHED' };
  }

  /**
   * Student finishes test manually
   */
  public static async finishStudentTest(gameId: string, studentId: number) {
    const db = await getDb();
    await db.query(
      `UPDATE students
       SET status = 'FINISHED', finished_at = CURRENT_TIMESTAMP
       WHERE game_id = $1 AND student_id = $2`,
      [gameId, studentId]
    );

    await EventService.logEvent(gameId, studentId, 'TEST_FINISHED', { manual: true });
    return { success: true };
  }

  /**
   * Retrieves full teacher dashboard data with live progress and results
   */
  public static async getTeacherDashboardData(gameId: string) {
    const db = await getDb();

    // 1. Game info
    const gameRes = await db.query(
      `SELECT id, code, title, status, total_time_seconds, started_at, ends_at, finished_at, max_students, created_at
       FROM games WHERE id = $1`,
      [gameId]
    );
    if (gameRes.rows.length === 0) return null;
    const game = gameRes.rows[0];

    // Check timer expiration
    if (game.status === 'IN_PROGRESS' && game.ends_at && new Date(game.ends_at) < new Date()) {
      await this.finishGame(gameId, 'TIME_EXPIRED');
      game.status = 'FINISHED';
    }

    // 2. Students list
    const studentsRes = await db.query(
      `SELECT id, student_id, form_id, first_name, last_name, status, is_online, joined_at, finished_at
       FROM students
       WHERE game_id = $1
       ORDER BY student_id ASC`,
      [gameId]
    );

    // 3. Answer counts and answers
    const answersRes = await db.query(
      `SELECT student_id, is_correct, points
       FROM student_answers
       WHERE game_id = $1`,
      [gameId]
    );

    const answersByStudent: Record<number, { isCorrect: boolean; points: number }[]> = {};
    for (const ans of answersRes.rows) {
      if (!answersByStudent[ans.student_id]) {
        answersByStudent[ans.student_id] = [];
      }
      answersByStudent[ans.student_id].push({
        isCorrect: ans.is_correct === true,
        points: ans.points || 0,
      });
    }

    // 4. Security events summary
    const securitySummary = await EventService.getStudentSecuritySummary(gameId);

    const students: TeacherStudentItem[] = studentsRes.rows.map((s) => {
      const studentAnswers = answersByStudent[s.student_id] || [];
      const scoreReport = ScoringService.calculateReport(
        s.student_id,
        s.form_id,
        20,
        studentAnswers
      );

      return {
        id: s.id,
        studentId: s.student_id,
        formId: s.form_id,
        firstName: s.first_name,
        lastName: s.last_name,
        status: s.status,
        isOnline: s.is_online,
        answeredCount: studentAnswers.length,
        scoreReport: game.status === 'FINISHED' || s.status === 'FINISHED' ? scoreReport : undefined,
        securityEvents: securitySummary[s.student_id] || { pageHidden: 0, fullscreenExit: 0, disconnected: 0, totalSuspicious: 0 },
      };
    });

    return {
      game,
      students,
      totalConnected: students.length,
      maxStudents: game.max_students,
    };
  }

  /**
   * Retrieves student's test state for mobile quiz view or reconnect
   */
  public static async getStudentState(gameId: string, studentId: number) {
    const db = await getDb();

    // 1. Game info
    const game = await this.getGameById(gameId);
    if (!game) throw new Error('Игра не найдена.');

    // Check timer expiration
    if (game.status === 'IN_PROGRESS' && game.ends_at && new Date(game.ends_at) < new Date()) {
      await this.finishGame(gameId, 'TIME_EXPIRED');
      game.status = 'FINISHED';
    }

    // 2. Student info
    const studentRes = await db.query(
      `SELECT id, student_id, form_id, first_name, last_name, status, session_token
       FROM students
       WHERE game_id = $1 AND student_id = $2`,
      [gameId, studentId]
    );
    if (studentRes.rows.length === 0) throw new Error('Ученик не найден.');
    const student = studentRes.rows[0];

    // 3. Already answered questions
    const answeredRes = await db.query(
      `SELECT question_number, selected_option_id, answer_text, answered_at
       FROM student_answers
       WHERE game_id = $1 AND student_id = $2
       ORDER BY question_number ASC`,
      [gameId, studentId]
    );

    const answeredMap: Record<number, { selectedOptionId?: number; answerText?: string }> = {};
    for (const r of answeredRes.rows) {
      answeredMap[r.question_number] = {
        selectedOptionId: r.selected_option_id,
        answerText: r.answer_text,
      };
    }

    // Determine current active question (first unanswered, or 20 if all answered)
    let currentQuestionNumber = 1;
    for (let i = 1; i <= 20; i++) {
      if (!answeredMap[i]) {
        currentQuestionNumber = i;
        break;
      }
    }
    if (answeredRes.rows.length >= 20) {
      currentQuestionNumber = 20;
    }

    // Load all question definitions for student
    const questions = await QuestionService.getAllQuestionsForStudent(student.form_id);
    const currentQuestion = questions.find((q) => q.questionNumber === currentQuestionNumber) || null;

    // If game or student finished, return final score report
    let scoreReport = undefined;
    if (game.status === 'FINISHED' || student.status === 'FINISHED') {
      const fullAnswersRes = await db.query(
        `SELECT is_correct, points FROM student_answers WHERE game_id = $1 AND student_id = $2`,
        [gameId, studentId]
      );
      scoreReport = ScoringService.calculateReport(
        student.student_id,
        student.form_id,
        20,
        fullAnswersRes.rows.map((r) => ({ isCorrect: r.is_correct === true, points: r.points || 0 }))
      );
    }

    return {
      gameId: game.id,
      gameCode: game.code,
      gameStatus: game.status,
      startedAt: game.started_at,
      endsAt: game.ends_at,
      totalTimeSeconds: game.total_time_seconds,
      serverTime: new Date().toISOString(),
      student: {
        id: student.id,
        studentId: student.student_id,
        formId: student.form_id,
        firstName: student.first_name,
        lastName: student.last_name,
        status: student.status,
      },
      currentQuestionNumber,
      currentQuestion,
      questions,
      answeredMap,
      answeredCount: answeredRes.rows.length,
      totalQuestions: 20,
      scoreReport, // Only populated when finished
    };
  }
}
