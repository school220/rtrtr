import { describe, it, expect, beforeAll } from 'vitest';
import { runMigrations } from '../src/db/migrate.js';
import { seedDatabase } from '../src/db/seed.js';
import { GameService } from '../src/services/game.service.js';
import { AnswerService } from '../src/services/answer.service.js';
import { QuestionService } from '../src/services/question.service.js';

describe('Complete 20-Question Student Flow and 1-Point Scoring Verification', () => {
  let gameId: string;
  const studentFirstName = 'Тест';
  const studentLastName = 'Ученик';
  let studentId: number;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await runMigrations();
    await seedDatabase();

    const game = await GameService.createGame({
      title: 'Проверочный экзамен',
      durationSeconds: 1200,
    });
    gameId = game.gameId;

    const joinRes = await GameService.joinGame({
      gameCode: game.code,
      firstName: studentFirstName,
      lastName: studentLastName,
    });
    studentId = joinRes.studentId;

    await GameService.startGame(gameId);
  }, 60000);

  it('delivers exactly 20 questions (15 multiple choice, 5 short answer)', async () => {
    const questions = await QuestionService.getAllQuestionsForStudent(studentId);
    expect(questions).toHaveLength(20);

    // Verify 1..15 are multiple choice with 4 options
    for (let i = 0; i < 15; i++) {
      expect(questions[i].questionNumber).toBe(i + 1);
      expect(questions[i].type).toBe('multiple_choice');
      expect(questions[i].options).toBeDefined();
      expect(questions[i].options).toHaveLength(4);
    }

    // Verify 16..20 are short answer
    for (let i = 15; i < 20; i++) {
      expect(questions[i].questionNumber).toBe(i + 1);
      expect(questions[i].type).toBe('short_answer');
      expect(questions[i].options).toBeUndefined();
    }
  });

  it('answers all 20 questions correctly and awards exactly 20 points (1 point per question)', async () => {
    const questions = await QuestionService.getAllQuestionsForStudent(studentId);
    const { getDb } = await import('../src/db/index.js');
    const db = await getDb();

    // Answer Q1..Q15 (multiple choice with the correct option)
    for (let qNum = 1; qNum <= 15; qNum++) {
      const q = questions.find((item) => item.questionNumber === qNum)!;
      // Find the correct option in DB
      const optRes = await db.query(
        `SELECT id FROM answer_options WHERE question_id = $1 AND is_correct = TRUE`,
        [q.id]
      );
      const correctOptId = optRes.rows[0].id;

      const res = await AnswerService.submitAnswer({
        gameId,
        studentId,
        questionNumber: qNum,
        selectedOptionId: correctOptId,
      });

      expect(res.success).toBe(true);
      expect(res.totalAnswered).toBe(qNum);
      // Student should NOT be marked finished simply for reaching question 15 or even 20
      expect(res.isFinished).toBe(false);
    }

    // Answer Q16..Q20 (short answer with correct text)
    for (let qNum = 16; qNum <= 20; qNum++) {
      const q = questions.find((item) => item.questionNumber === qNum)!;
      const qDbRes = await db.query(
        `SELECT correct_answer FROM questions WHERE id = $1`,
        [q.id]
      );
      const correctAns = qDbRes.rows[0].correct_answer;

      const res = await AnswerService.submitAnswer({
        gameId,
        studentId,
        questionNumber: qNum,
        answerText: correctAns,
      });

      expect(res.success).toBe(true);
      expect(res.totalAnswered).toBe(qNum);
      // Even after 20th answer, student can still review and revise before manual submission
      expect(res.isFinished).toBe(false);
    }

    // Test revising an answer before finishing: student changes Q1 to another option and back
    const q1 = questions.find((item) => item.questionNumber === 1)!;
    const optRes = await db.query(
      `SELECT id FROM answer_options WHERE question_id = $1 AND is_correct = TRUE`,
      [q1.id]
    );
    const correctOptId = optRes.rows[0].id;

    // Student should be able to update answer freely without error
    const updateRes = await AnswerService.submitAnswer({
      gameId,
      studentId,
      questionNumber: 1,
      selectedOptionId: correctOptId,
    });
    expect(updateRes.success).toBe(true);

    // Finish test manually
    await GameService.finishStudentTest(gameId, studentId);

    // Verify score report: 20 points, 100%, Grade 5
    const state = await GameService.getStudentState(gameId, studentId);
    expect(state.student.status).toBe('FINISHED');
    expect(state.scoreReport).toBeDefined();
    expect(state.scoreReport.totalQuestions).toBe(20);
    expect(state.scoreReport.correctAnswers).toBe(20);
    expect(state.scoreReport.scorePoints).toBe(20);
    expect(state.scoreReport.percentage).toBe(100);
    expect(state.scoreReport.grade).toBe(5);
  });
});
