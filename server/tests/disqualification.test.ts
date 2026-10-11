import { describe, it, expect, beforeAll } from 'vitest';
import { runMigrations } from '../src/db/migrate.js';
import { seedDatabase } from '../src/db/seed.js';
import { GameService } from '../src/services/game.service.js';
import { AnswerService } from '../src/services/answer.service.js';
import { QuestionService } from '../src/services/question.service.js';
import { ExcelService } from '../src/services/excel.service.js';
import ExcelJS from 'exceljs';

describe('Student Disqualification / Expulsion by Proctor and Teacher', () => {
  beforeAll(async () => {
    await runMigrations();
    await seedDatabase();
  });

  it('handles student expulsion by proctor and by teacher with score annulment and Excel reporting', async () => {
    // 1. Teacher creates game
    const game = await GameService.createGame({ title: 'Тест на дисквалификацию' });
    const gameId = game.gameId;

    // 2. Three students join
    const s1 = await GameService.joinGame({
      gameCode: game.code,
      firstName: 'Алексей',
      lastName: 'Иванов',
    });

    const s2 = await GameService.joinGame({
      gameCode: game.code,
      firstName: 'Дмитрий',
      lastName: 'Смирнов',
    });

    const s3 = await GameService.joinGame({
      gameCode: game.code,
      firstName: 'Елена',
      lastName: 'Козлова',
    });

    // 3. Start game
    await GameService.startGame(gameId);

    // 4. Students answer question 1
    const q1ForS1 = await QuestionService.getQuestionForStudent(s1.formId, 1);
    const validOptId1 = q1ForS1!.options![0].id;

    await AnswerService.submitAnswer({
      gameId,
      studentId: s1.studentId,
      questionNumber: 1,
      selectedOptionId: validOptId1,
    });

    const q1ForS2 = await QuestionService.getQuestionForStudent(s2.formId, 1);
    const validOptId2 = q1ForS2!.options![0].id;

    await AnswerService.submitAnswer({
      gameId,
      studentId: s2.studentId,
      questionNumber: 1,
      selectedOptionId: validOptId2,
    });

    const q1ForS3 = await QuestionService.getQuestionForStudent(s3.formId, 1);
    const validOptId3 = q1ForS3!.options![0].id;

    await AnswerService.submitAnswer({
      gameId,
      studentId: s3.studentId,
      questionNumber: 1,
      selectedOptionId: validOptId3,
    });

    // 5. Expel Student 1 on behalf of PROCTOR
    const dq1Result = await GameService.disqualifyStudent(gameId, s1.studentId, {
      disqualifiedBy: 'PROCTOR',
      reason: 'Выход из полноэкранного режима или браузера',
    });
    expect(dq1Result.status).toBe('DISQUALIFIED');
    expect(dq1Result.disqualifiedBy).toBe('PROCTOR');

    // 6. Expel Student 2 on behalf of TEACHER
    const dq2Result = await GameService.disqualifyStudent(gameId, s2.studentId, {
      disqualifiedBy: 'TEACHER',
      reason: 'Использование шпаргалки и смартфона',
    });
    expect(dq2Result.status).toBe('DISQUALIFIED');
    expect(dq2Result.disqualifiedBy).toBe('TEACHER');

    // 7. Verify student 1 cannot submit answers after expulsion
    await expect(
      AnswerService.submitAnswer({
        gameId,
        studentId: s1.studentId,
        questionNumber: 2,
        selectedOptionId: validOptId1,
      })
    ).rejects.toThrow(/исключены|аннулированы|дисквалифицирован|bekor qilingan/i);

    // 8. Verify student state shows DISQUALIFIED and 0 score
    const s1State = await GameService.getStudentState(gameId, s1.studentId);
    expect(s1State.student.status).toBe('DISQUALIFIED');
    expect(s1State.student.disqualifiedBy).toBe('PROCTOR');
    expect(s1State.scoreReport?.scorePoints).toBe(0);
    expect(s1State.scoreReport?.percentage).toBe(0);

    // 9. Finish game
    await GameService.finishGame(gameId);

    // Verify finished game preserves DISQUALIFIED status
    const dashboard = await GameService.getTeacherDashboardData(gameId);
    const s1Dash = dashboard.students.find((s) => s.studentId === s1.studentId);
    const s2Dash = dashboard.students.find((s) => s.studentId === s2.studentId);
    const s3Dash = dashboard.students.find((s) => s.studentId === s3.studentId);

    expect(s1Dash?.status).toBe('DISQUALIFIED');
    expect(s2Dash?.status).toBe('DISQUALIFIED');
    expect(s3Dash?.status).toBe('FINISHED');

    // 10. Generate and verify Excel report
    const excelBuffer = await ExcelService.generateResultsWorkbook(dashboard);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(excelBuffer as any);
    const sheet = workbook.getWorksheet(1);
    expect(sheet).toBeDefined();

    // Find row for Иванов Алексей (expelled by PROCTOR)
    let ivanovRow: ExcelJS.Row | undefined;
    let smirnovRow: ExcelJS.Row | undefined;

    sheet!.eachRow((row) => {
      const lastName = row.getCell(2).value;
      if (lastName === 'Иванов') ivanovRow = row;
      if (lastName === 'Смирнов') smirnovRow = row;
    });

    expect(ivanovRow).toBeDefined();
    expect(smirnovRow).toBeDefined();

    // Verify Иванов (PROCTOR expulsion)
    expect(ivanovRow!.getCell(4).value).toBe('АННУЛ.');
    expect(ivanovRow!.getCell(5).value).toBe(0);
    expect(ivanovRow!.getCell(9).value).toBe('ИСКЛЮЧЁН (ПРОКТОР)');
    expect(String(ivanovRow!.getCell(11).value)).toContain('Система прокторинга исключила экзаменуемого из-за подозрительных действий');
    expect(String(ivanovRow!.getCell(11).value)).toContain('Выход из полноэкранного режима');

    // Verify Смирнов (TEACHER expulsion)
    expect(smirnovRow!.getCell(4).value).toBe('АННУЛ.');
    expect(smirnovRow!.getCell(5).value).toBe(0);
    expect(smirnovRow!.getCell(9).value).toBe('ИСКЛЮЧЁН (УЧИТЕЛЬ)');
    expect(String(smirnovRow!.getCell(11).value)).toContain('Исключён экзаменатором: Использование шпаргалки и смартфона');
  });
});
