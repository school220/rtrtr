import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { ExcelService } from '../src/services/excel.service.js';

describe('ExcelService - Exporting Test Results to Excel (.xlsx)', () => {
  it('generates a valid, populated .xlsx workbook with student names, grades, and timestamps', async () => {
    const mockDashboardData = {
      game: {
        id: 'game-uuid-12345',
        code: 'K7P42',
        title: 'Контрольная работа по математике',
        status: 'FINISHED',
        total_time_seconds: 1200,
        started_at: '2026-10-08T10:00:00.000Z',
        ends_at: '2026-10-08T10:20:00.000Z',
        finished_at: '2026-10-08T10:18:30.000Z',
        max_students: 50,
      },
      students: [
        {
          id: 1,
          studentId: 17,
          formId: 17,
          firstName: 'Иван',
          lastName: 'Иванов',
          status: 'FINISHED',
          isOnline: true,
          answeredCount: 30,
          finishedAt: '2026-10-08T10:15:20.000Z',
          scoreReport: {
            studentId: 17,
            formId: 17,
            totalQuestions: 30,
            answeredCount: 30,
            correctAnswers: 27,
            wrongAnswers: 3,
            unanswered: 0,
            scorePoints: 27,
            percentage: 90,
            grade: 5,
          },
          securityEvents: {
            pageHidden: 2,
            fullscreenExit: 1,
            disconnected: 0,
            totalSuspicious: 3,
          },
        },
        {
          id: 2,
          studentId: 18,
          formId: 18,
          firstName: 'Анна',
          lastName: 'Петрова',
          status: 'FINISHED',
          isOnline: true,
          answeredCount: 30,
          finishedAt: '2026-10-08T10:17:45.000Z',
          scoreReport: {
            studentId: 18,
            formId: 18,
            totalQuestions: 30,
            answeredCount: 30,
            correctAnswers: 24,
            wrongAnswers: 6,
            unanswered: 0,
            scorePoints: 24,
            percentage: 80,
            grade: 4,
          },
          securityEvents: {
            pageHidden: 0,
            fullscreenExit: 0,
            disconnected: 0,
            totalSuspicious: 0,
          },
        },
        {
          id: 3,
          studentId: 19,
          formId: 19,
          firstName: 'Тимур',
          lastName: 'Каримов',
          status: 'FINISHED',
          isOnline: true,
          answeredCount: 30,
          finishedAt: '2026-10-08T10:18:10.000Z',
          scoreReport: {
            studentId: 19,
            formId: 19,
            totalQuestions: 30,
            answeredCount: 30,
            correctAnswers: 18,
            wrongAnswers: 12,
            unanswered: 0,
            scorePoints: 18,
            percentage: 60,
            grade: 3,
          },
          securityEvents: {
            pageHidden: 0,
            fullscreenExit: 0,
            disconnected: 0,
            totalSuspicious: 0,
          },
        },
      ],
      totalConnected: 3,
      maxStudents: 50,
    };

    // 1. Generate Buffer
    const buffer = await ExcelService.generateResultsWorkbook(mockDashboardData);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);

    // 2. Read back generated Excel buffer to verify internal integrity
    const readWorkbook = new ExcelJS.Workbook();
    await readWorkbook.xlsx.load(buffer);

    const sheet = readWorkbook.getWorksheet('Результаты тестирования');
    expect(sheet).toBeDefined();

    // Verify Title Header
    expect(sheet!.getCell('A1').value).toContain('ВЕДОМОСТЬ РЕЗУЛЬТАТОВ');
    expect(sheet!.getCell('A2').value).toContain('K7P42');
    expect(sheet!.getCell('A2').value).toContain('08.10.2026');

    // Verify Columns in Row 5
    const headerRow = sheet!.getRow(5);
    expect(headerRow.getCell(1).value).toBe('№ п/п');
    expect(headerRow.getCell(2).value).toBe('Фамилия');
    expect(headerRow.getCell(3).value).toBe('Имя');
    expect(headerRow.getCell(4).value).toBe('Оценка');
    expect(headerRow.getCell(5).value).toBe('Баллы (из 30)');
    expect(headerRow.getCell(6).value).toBe('Результат (%)');
    expect(headerRow.getCell(10).value).toBe('Дата и время сдачи');

    // Verify Student Rows (Row 6 is top student: Иванов Иван, Grade 5)
    const student1Row = sheet!.getRow(6);
    expect(student1Row.getCell(2).value).toBe('Иванов');
    expect(student1Row.getCell(3).value).toBe('Иван');
    expect(student1Row.getCell(4).value).toBe(5); // Grade 5
    expect(student1Row.getCell(5).value).toBe(27); // 27 points
    expect(student1Row.getCell(6).value).toBe('90%'); // 90%
    expect(String(student1Row.getCell(10).value)).toContain('08.10.2026'); // Date & time

    // Verify Student Row 7 (Петрова Анна, Grade 4)
    const student2Row = sheet!.getRow(7);
    expect(student2Row.getCell(2).value).toBe('Петрова');
    expect(student2Row.getCell(3).value).toBe('Анна');
    expect(student2Row.getCell(4).value).toBe(4); // Grade 4
    expect(student2Row.getCell(5).value).toBe(24); // 24 points
    expect(student2Row.getCell(6).value).toBe('80%');

    // Verify Student Row 8 (Каримов Тимур, Grade 3)
    const student3Row = sheet!.getRow(8);
    expect(student3Row.getCell(2).value).toBe('Каримов');
    expect(student3Row.getCell(3).value).toBe('Тимур');
    expect(student3Row.getCell(4).value).toBe(3); // Grade 3
    expect(student3Row.getCell(5).value).toBe(18); // 18 points

    // Verify Summary Footer Row
    const footerRow = sheet!.getRow(9);
    expect(footerRow.getCell(1).value).toContain('ИТОГО ПО КЛАССУ');
  });
});
