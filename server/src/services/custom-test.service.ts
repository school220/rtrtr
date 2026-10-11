import { v4 as uuidv4 } from 'uuid';
import { getDb, withTransaction, DbClient } from '../db/index.js';
import { StudentSafeQuestion } from './question.service.js';
import { GameService } from './game.service.js';

export type QuestionType = 'four_options' | 'yes_no' | 'free_input';

export interface CustomOption {
  id: number;
  label: string;
  text: string;
  isCorrect?: boolean;
}

export interface CustomQuestionInput {
  questionNumber?: number;
  questionText: string;
  questionType: QuestionType;
  points?: number;
  correctAnswer?: string;
  options?: { id?: number; label: string; text: string; isCorrect?: boolean }[];
}

export interface CustomQuestionData {
  id: number;
  testId: string;
  questionNumber: number;
  questionText: string;
  questionType: QuestionType;
  correctAnswer: string;
  options: CustomOption[] | null;
  points: number;
}

export interface CustomTestSummary {
  id: string;
  teacherId: number;
  title: string;
  durationMinutes: number;
  questionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CustomTestDetail {
  id: string;
  teacherId: number;
  title: string;
  durationMinutes: number;
  createdAt: string;
  updatedAt: string;
  questions: CustomQuestionData[];
}

export class CustomTestService {
  /**
   * Lists all custom tests for a specific teacher
   */
  public static async listTests(teacherId: number, client?: DbClient): Promise<CustomTestSummary[]> {
    const db = client || (await getDb());
    const res = await db.query(
      `SELECT t.id, t.teacher_id, t.title, t.duration_minutes, t.created_at, t.updated_at,
              COUNT(q.id)::int as question_count
       FROM custom_tests t
       LEFT JOIN custom_test_questions q ON q.test_id = t.id
       WHERE t.teacher_id = $1
       GROUP BY t.id
       ORDER BY t.created_at DESC`,
      [teacherId]
    );

    return res.rows.map((r) => ({
      id: r.id,
      teacherId: r.teacher_id,
      title: r.title,
      durationMinutes: r.duration_minutes,
      questionCount: r.question_count,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  /**
   * Retrieves single test with all its questions
   */
  public static async getTestById(testId: string, teacherId?: number, client?: DbClient): Promise<CustomTestDetail | null> {
    const db = client || (await getDb());
    const testRes = await db.query(
      `SELECT id, teacher_id, title, duration_minutes, created_at, updated_at
       FROM custom_tests
       WHERE id = $1`,
      [testId]
    );

    if (testRes.rows.length === 0) return null;
    const test = testRes.rows[0];

    if (teacherId && test.teacher_id !== teacherId) {
      throw new Error('Доступ запрещён: этот тест принадлежит другому преподавателю.');
    }

    const qRes = await db.query(
      `SELECT id, test_id, question_number, question_text, question_type, correct_answer, options, points
       FROM custom_test_questions
       WHERE test_id = $1
       ORDER BY question_number ASC`,
      [testId]
    );

    const questions: CustomQuestionData[] = qRes.rows.map((r) => {
      let parsedOptions: CustomOption[] | null = null;
      if (r.options) {
        try {
          parsedOptions = JSON.parse(r.options);
        } catch {
          parsedOptions = null;
        }
      }

      return {
        id: r.id,
        testId: r.test_id,
        questionNumber: r.question_number,
        questionText: r.question_text,
        questionType: r.question_type as QuestionType,
        correctAnswer: r.correct_answer,
        options: parsedOptions,
        points: r.points || 1,
      };
    });

    return {
      id: test.id,
      teacherId: test.teacher_id,
      title: test.title,
      durationMinutes: test.duration_minutes,
      createdAt: test.created_at,
      updatedAt: test.updated_at,
      questions,
    };
  }

  /**
   * Creates a new custom test with questions for a teacher
   */
  public static async createTest(
    teacherId: number,
    data: {
      title: string;
      durationMinutes?: number;
      questions: CustomQuestionInput[];
    }
  ): Promise<CustomTestDetail> {
    const title = (data.title || '').trim();
    if (!title) {
      throw new Error('Название теста не может быть пустым.');
    }

    const durationMinutes = Math.max(1, Math.min(180, parseInt(String(data.durationMinutes || 30), 10)));
    const questions = data.questions || [];
    if (questions.length === 0) {
      throw new Error('Необходимо добавить хотя бы один вопрос в тест.');
    }

    const testId = uuidv4();

    await withTransaction(async (db) => {
      await db.query(
        `INSERT INTO custom_tests (id, teacher_id, title, duration_minutes, created_at, updated_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [testId, teacherId, title, durationMinutes]
      );

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const qNum = q.questionNumber || i + 1;
        const qText = (q.questionText || '').trim();
        if (!qText) {
          throw new Error(`Вопрос №${qNum}: введите текст вопроса.`);
        }

        const qType: QuestionType = q.questionType;
        if (!['four_options', 'yes_no', 'free_input'].includes(qType)) {
          throw new Error(`Вопрос №${qNum}: неподдерживаемый тип вопроса (${qType}).`);
        }

        let correctAnswer = (q.correctAnswer || '').trim();
        let optionsToSave: CustomOption[] | null = null;

        if (qType === 'four_options') {
          const rawOpts = q.options || [];
          if (rawOpts.length !== 4) {
            throw new Error(`Вопрос №${qNum}: должно быть ровно 4 варианта ответа.`);
          }

          let hasCorrect = false;
          optionsToSave = rawOpts.map((opt, idx) => {
            const label = opt.label || String.fromCharCode(65 + idx); // A, B, C, D
            const text = (opt.text || '').trim();
            if (!text) {
              throw new Error(`Вопрос №${qNum}, вариант ${label}: введите текст варианта.`);
            }
            const isCorrect = opt.isCorrect === true || correctAnswer === label || correctAnswer === String(idx + 1);
            if (isCorrect) hasCorrect = true;
            return {
              id: idx + 1,
              label,
              text,
              isCorrect,
            };
          });

          if (!hasCorrect) {
            throw new Error(`Вопрос №${qNum}: выберите правильный вариант ответа.`);
          }

          const correctOpt = optionsToSave.find((o) => o.isCorrect);
          correctAnswer = correctOpt ? correctOpt.label : 'A';
        } else if (qType === 'yes_no') {
          const isYesCorrect =
            correctAnswer.toLowerCase() === 'да' ||
            correctAnswer.toLowerCase() === 'yes' ||
            correctAnswer === '1' ||
            q.options?.find((o) => o.label === '1' || o.text === 'Да')?.isCorrect === true;

          optionsToSave = [
            { id: 1, label: '1', text: 'Да', isCorrect: isYesCorrect },
            { id: 2, label: '2', text: 'Нет', isCorrect: !isYesCorrect },
          ];
          correctAnswer = isYesCorrect ? 'Да' : 'Нет';
        } else if (qType === 'free_input') {
          if (!correctAnswer) {
            throw new Error(`Вопрос №${qNum}: укажите правильный ответ для проверки.`);
          }
          optionsToSave = null;
        }

        const points = Math.max(1, q.points || 1);

        await db.query(
          `INSERT INTO custom_test_questions
           (test_id, question_number, question_text, question_type, correct_answer, options, points, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
          [
            testId,
            qNum,
            qText,
            qType,
            correctAnswer,
            optionsToSave ? JSON.stringify(optionsToSave) : null,
            points,
          ]
        );
      }
    });

    return (await this.getTestById(testId, teacherId))!;
  }

  /**
   * Updates an existing custom test
   */
  public static async updateTest(
    testId: string,
    teacherId: number,
    data: {
      title: string;
      durationMinutes?: number;
      questions: CustomQuestionInput[];
    }
  ): Promise<CustomTestDetail> {
    const existing = await this.getTestById(testId, teacherId);
    if (!existing) {
      throw new Error('Тест не найден.');
    }

    const title = (data.title || '').trim();
    if (!title) {
      throw new Error('Название теста не может быть пустым.');
    }

    const durationMinutes = Math.max(1, Math.min(180, parseInt(String(data.durationMinutes || 30), 10)));
    const questions = data.questions || [];
    if (questions.length === 0) {
      throw new Error('В тесте должен быть хотя бы один вопрос.');
    }

    await withTransaction(async (db) => {
      await db.query(
        `UPDATE custom_tests
         SET title = $1, duration_minutes = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND teacher_id = $4`,
        [title, durationMinutes, testId, teacherId]
      );

      // Re-insert questions
      await db.query(`DELETE FROM custom_test_questions WHERE test_id = $1`, [testId]);

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const qNum = q.questionNumber || i + 1;
        const qText = (q.questionText || '').trim();
        if (!qText) {
          throw new Error(`Вопрос №${qNum}: введите текст вопроса.`);
        }

        const qType: QuestionType = q.questionType;
        if (!['four_options', 'yes_no', 'free_input'].includes(qType)) {
          throw new Error(`Вопрос №${qNum}: неподдерживаемый тип вопроса (${qType}).`);
        }

        let correctAnswer = (q.correctAnswer || '').trim();
        let optionsToSave: CustomOption[] | null = null;

        if (qType === 'four_options') {
          const rawOpts = q.options || [];
          if (rawOpts.length !== 4) {
            throw new Error(`Вопрос №${qNum}: должно быть ровно 4 варианта ответа.`);
          }

          let hasCorrect = false;
          optionsToSave = rawOpts.map((opt, idx) => {
            const label = opt.label || String.fromCharCode(65 + idx);
            const text = (opt.text || '').trim();
            if (!text) {
              throw new Error(`Вопрос №${qNum}, вариант ${label}: введите текст варианта.`);
            }
            const isCorrect = opt.isCorrect === true || correctAnswer === label || correctAnswer === String(idx + 1);
            if (isCorrect) hasCorrect = true;
            return {
              id: idx + 1,
              label,
              text,
              isCorrect,
            };
          });

          if (!hasCorrect) {
            throw new Error(`Вопрос №${qNum}: выберите правильный вариант ответа.`);
          }

          const correctOpt = optionsToSave.find((o) => o.isCorrect);
          correctAnswer = correctOpt ? correctOpt.label : 'A';
        } else if (qType === 'yes_no') {
          const isYesCorrect =
            correctAnswer.toLowerCase() === 'да' ||
            correctAnswer.toLowerCase() === 'yes' ||
            correctAnswer === '1' ||
            q.options?.find((o) => o.label === '1' || o.text === 'Да')?.isCorrect === true;

          optionsToSave = [
            { id: 1, label: '1', text: 'Да', isCorrect: isYesCorrect },
            { id: 2, label: '2', text: 'Нет', isCorrect: !isYesCorrect },
          ];
          correctAnswer = isYesCorrect ? 'Да' : 'Нет';
        } else if (qType === 'free_input') {
          if (!correctAnswer) {
            throw new Error(`Вопрос №${qNum}: укажите правильный ответ для проверки.`);
          }
          optionsToSave = null;
        }

        const points = Math.max(1, q.points || 1);

        await db.query(
          `INSERT INTO custom_test_questions
           (test_id, question_number, question_text, question_type, correct_answer, options, points, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
          [
            testId,
            qNum,
            qText,
            qType,
            correctAnswer,
            optionsToSave ? JSON.stringify(optionsToSave) : null,
            points,
          ]
        );
      }
    });

    return (await this.getTestById(testId, teacherId))!;
  }

  /**
   * Deletes a custom test and its questions
   */
  public static async deleteTest(testId: string, teacherId: number): Promise<boolean> {
    const db = await getDb();
    const res = await db.query(
      `DELETE FROM custom_tests WHERE id = $1 AND teacher_id = $2`,
      [testId, teacherId]
    );
    return (res.rowCount ?? 0) > 0;
  }

  /**
   * Launches an exam room session from this custom test
   */
  public static async launchTest(testId: string, teacherId: number) {
    const test = await this.getTestById(testId, teacherId);
    if (!test) {
      throw new Error('Тест не найден.');
    }
    if (test.questions.length === 0) {
      throw new Error('Невозможно запустить тест без вопросов.');
    }

    const durationSeconds = test.durationMinutes * 60;
    const game = await GameService.createGame({
      title: test.title,
      durationSeconds,
      teacherId,
    });

    const db = await getDb();
    await db.query(
      `UPDATE games SET custom_test_id = $1 WHERE id = $2`,
      [testId, game.gameId]
    );

    return {
      ...game,
      customTestId: testId,
      totalQuestions: test.questions.length,
    };
  }

  /**
   * Retrieves student-safe question list for a custom test
   */
  public static async getQuestionsForStudent(customTestId: string, client?: DbClient): Promise<StudentSafeQuestion[]> {
    const db = client || (await getDb());
    const res = await db.query(
      `SELECT id, question_number, question_text, question_type, options
       FROM custom_test_questions
       WHERE test_id = $1
       ORDER BY question_number ASC`,
      [customTestId]
    );

    return res.rows.map((r) => {
      const qType = r.question_type as QuestionType;
      let safeOptions: { id: number; label: string; text: string }[] | undefined = undefined;

      if (qType === 'four_options' || qType === 'yes_no') {
        if (r.options) {
          try {
            const rawOpts: CustomOption[] = JSON.parse(r.options);
            safeOptions = rawOpts.map((o) => ({
              id: o.id,
              label: o.label,
              text: o.text,
            }));
          } catch {
            safeOptions = [];
          }
        }
      }

      return {
        id: r.id,
        formId: 1,
        questionNumber: r.question_number,
        text: r.question_text,
        type: qType === 'free_input' ? 'short_answer' : 'multiple_choice',
        options: safeOptions,
      };
    });
  }

  /**
   * Retrieves question count for a custom test
   */
  public static async getQuestionCount(customTestId: string, client?: DbClient): Promise<number> {
    const db = client || (await getDb());
    const res = await db.query(
      `SELECT COUNT(*)::int as count FROM custom_test_questions WHERE test_id = $1`,
      [customTestId]
    );
    return res.rows[0]?.count || 0;
  }
}
