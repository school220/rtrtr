import { getDb, withTransaction } from '../db/index.js';
import { MathEvaluator } from '../utils/math-evaluator.js';
import { EventService } from './event.service.js';

export interface SubmitAnswerParams {
  gameId: string;
  studentId: number;
  questionNumber: number;
  selectedOptionId?: number;
  answerText?: string;
}

export interface SubmitAnswerResult {
  success: boolean;
  questionNumber: number;
  nextQuestionNumber: number | null;
  totalAnswered: number;
  isFinished: boolean;
  alreadyAnswered?: boolean;
}

export class AnswerService {
  /**
   * Submits an answer for a question.
   * Enforces server-side correctness calculation, immutability of submitted answers,
   * and game time boundaries.
   */
  public static async submitAnswer(params: SubmitAnswerParams): Promise<SubmitAnswerResult> {
    const { gameId, studentId, questionNumber, selectedOptionId, answerText } = params;

    return await withTransaction(async (db) => {
      // 1. Verify game status and timing
      const gameRes = await db.query(
        `SELECT id, status, ends_at, teacher_id, custom_test_id FROM games WHERE id = $1`,
        [gameId]
      );
      if (gameRes.rows.length === 0) {
        throw new Error('Игра не найдена.');
      }
      const game = gameRes.rows[0];
      const teacherId = game.teacher_id || 1;

      if (game.status !== 'IN_PROGRESS') {
        throw new Error(`Тест не активен (текущий статус: ${game.status}).`);
      }

      const now = new Date();
      if (game.ends_at && new Date(game.ends_at) < now) {
        // Auto-expire game
        await db.query(
          `UPDATE games SET status = 'TIME_EXPIRED', finished_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [gameId]
        );
        throw new Error('Время тестирования истекло.');
      }

      // 2. Verify student exists
      const studentRes = await db.query(
        `SELECT id, form_id, status FROM students WHERE game_id = $1 AND student_id = $2`,
        [gameId, studentId]
      );
      if (studentRes.rows.length === 0) {
        throw new Error('Ученик не найден.');
      }
      const student = studentRes.rows[0];
      if (student.status === 'FINISHED') {
        throw new Error('Вы уже завершили этот тест.');
      }
      if (student.status === 'DISQUALIFIED') {
        throw new Error('Вы были исключены из тестирования. Результаты аннулированы.');
      }

      let questionId: number | null = null;
      let customQuestionId: number | null = null;
      let isCorrect = false;
      let points = 0;

      if (game.custom_test_id) {
        const qRes = await db.query(
          `SELECT id, question_type, points, correct_answer, options
           FROM custom_test_questions
           WHERE test_id = $1 AND question_number = $2`,
          [game.custom_test_id, questionNumber]
        );

        if (qRes.rows.length === 0) {
          throw new Error(`Вопрос №${questionNumber} не найден в тесте.`);
        }
        const cq = qRes.rows[0];
        customQuestionId = cq.id;
        const qPoints = cq.points || 1;

        if (cq.question_type === 'four_options' || cq.question_type === 'yes_no') {
          if (!selectedOptionId) {
            throw new Error('Не выбран вариант ответа.');
          }
          let options: any[] = [];
          try {
            options = JSON.parse(cq.options || '[]');
          } catch {}
          const chosenOpt = options.find((o: any) => o.id === selectedOptionId);
          if (!chosenOpt) {
            throw new Error('Выбранный вариант ответа недействителен.');
          }
          isCorrect =
            chosenOpt.isCorrect === true ||
            chosenOpt.label === cq.correct_answer ||
            chosenOpt.text.toLowerCase() === cq.correct_answer.toLowerCase();
          points = isCorrect ? qPoints : 0;
        } else {
          // free_input
          const studentText = (answerText || '').trim();
          if (!studentText) {
            throw new Error('Текст ответа не может быть пустым.');
          }
          isCorrect = MathEvaluator.isEquivalent(studentText, cq.correct_answer);
          points = isCorrect ? qPoints : 0;
        }
      } else {
        // Standard 50-variant curriculum test
        const qRes = await db.query(
          `SELECT q.id, q.type, q.points, q.correct_answer, q.metadata
           FROM form_questions fq
           JOIN questions q ON fq.question_id = q.id
           WHERE fq.teacher_id = $1 AND fq.form_id = $2 AND fq.question_number = $3`,
          [teacherId, student.form_id, questionNumber]
        );

        if (qRes.rows.length === 0) {
          throw new Error(`Вопрос №${questionNumber} не найден для бланка ${student.form_id}.`);
        }
        const question = qRes.rows[0];
        questionId = question.id;

        if (question.type === 'multiple_choice') {
          if (!selectedOptionId) {
            throw new Error('Не выбран вариант ответа.');
          }
          // Verify option belongs to this question and check if it's correct
          const optRes = await db.query(
            `SELECT is_correct FROM answer_options WHERE id = $1 AND question_id = $2`,
            [selectedOptionId, question.id]
          );
          if (optRes.rows.length === 0) {
            throw new Error('Выбранный вариант ответа недействителен.');
          }
          isCorrect = optRes.rows[0].is_correct === true;
          points = isCorrect ? (question.points || 1) : 0;
        } else {
          // short_answer
          const studentText = (answerText || '').trim();
          if (!studentText) {
            throw new Error('Текст ответа не может быть пустым.');
          }

          let alternates: string[] = [];
          try {
            const meta = typeof question.metadata === 'string' ? JSON.parse(question.metadata) : question.metadata;
            if (Array.isArray(meta?.acceptedAlternates)) {
              alternates = meta.acceptedAlternates;
            }
          } catch {
            // ignore json parse error
          }

          isCorrect = MathEvaluator.isEquivalent(studentText, question.correct_answer, alternates);
          points = isCorrect ? (question.points || 1) : 0;
        }
      }

      // 5. Store or update answer securely
      await db.query(
        `INSERT INTO student_answers
         (game_id, student_id, form_id, question_number, question_id, custom_question_id, selected_option_id, answer_text, is_correct, points, answered_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
         ON CONFLICT (game_id, student_id, question_number)
         DO UPDATE SET
           custom_question_id = EXCLUDED.custom_question_id,
           selected_option_id = EXCLUDED.selected_option_id,
           answer_text = EXCLUDED.answer_text,
           is_correct = EXCLUDED.is_correct,
           points = EXCLUDED.points,
           answered_at = CURRENT_TIMESTAMP`,
        [
          gameId,
          studentId,
          student.form_id,
          questionNumber,
          questionId,
          customQuestionId,
          selectedOptionId || null,
          answerText || null,
          isCorrect,
          points,
        ]
      );

      // 6. Check total answered count
      const countRes = await db.query(
        `SELECT COUNT(*) as count FROM student_answers WHERE game_id = $1 AND student_id = $2`,
        [gameId, studentId]
      );
      const totalAnswered = parseInt(countRes.rows[0]?.count || '0', 10);
      const isFinished = student.status === 'FINISHED';

      // Next question number
      let totalQuestions = 20;
      if (game.custom_test_id) {
        const tCountRes = await db.query(
          `SELECT COUNT(*)::int as count FROM custom_test_questions WHERE test_id = $1`,
          [game.custom_test_id]
        );
        totalQuestions = tCountRes.rows[0]?.count || 1;
      }
      const nextQuestionNumber = questionNumber < totalQuestions ? questionNumber + 1 : null;

      // Log event
      await EventService.logEvent(gameId, studentId, 'QUESTION_ANSWERED', {
        questionNumber,
        totalAnswered,
      }, db);

      return {
        success: true,
        questionNumber,
        nextQuestionNumber,
        totalAnswered,
        isFinished,
      };
    });
  }

  /**
   * Gets list of answered question numbers and responses for reconnecting student
   */
  public static async getStudentAnswers(gameId: string, studentId: number) {
    const db = await getDb();
    const res = await db.query(
      `SELECT question_number, selected_option_id, answer_text, answered_at
       FROM student_answers
       WHERE game_id = $1 AND student_id = $2
       ORDER BY question_number ASC`,
      [gameId, studentId]
    );

    return res.rows.map((r) => ({
      questionNumber: r.question_number,
      selectedOptionId: r.selected_option_id,
      answerText: r.answer_text,
      answeredAt: r.answered_at,
    }));
  }
}
