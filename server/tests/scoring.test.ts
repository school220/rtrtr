import { describe, it, expect } from 'vitest';
import { ScoringService } from '../src/services/scoring.service.js';

describe('ScoringService', () => {
  it('correctly maps percentages to 5-point grades according to rules', () => {
    // 90-100% -> 5
    expect(ScoringService.calculateGrade(100)).toBe(5);
    expect(ScoringService.calculateGrade(95)).toBe(5);
    expect(ScoringService.calculateGrade(90)).toBe(5);

    // 75-89% -> 4
    expect(ScoringService.calculateGrade(89)).toBe(4);
    expect(ScoringService.calculateGrade(80)).toBe(4);
    expect(ScoringService.calculateGrade(75)).toBe(4);

    // 50-74% -> 3
    expect(ScoringService.calculateGrade(74)).toBe(3);
    expect(ScoringService.calculateGrade(60)).toBe(3);
    expect(ScoringService.calculateGrade(50)).toBe(3);

    // 0-49% -> 2
    expect(ScoringService.calculateGrade(49)).toBe(2);
    expect(ScoringService.calculateGrade(20)).toBe(2);
    expect(ScoringService.calculateGrade(0)).toBe(2);
  });

  it('calculates comprehensive report for 30 questions', () => {
    // Student answered 27 questions correctly, 2 wrong, 1 unanswered
    const answers = [
      ...Array(27).fill({ isCorrect: true, points: 1 }),
      ...Array(2).fill({ isCorrect: false, points: 0 }),
    ];

    const report = ScoringService.calculateReport(1, 1, 30, answers);

    expect(report.studentId).toBe(1);
    expect(report.formId).toBe(1);
    expect(report.totalQuestions).toBe(30);
    expect(report.answeredCount).toBe(29);
    expect(report.correctAnswers).toBe(27);
    expect(report.wrongAnswers).toBe(2);
    expect(report.unanswered).toBe(1);
    expect(report.scorePoints).toBe(27);
    expect(report.percentage).toBe(90); // 27/30 = 90%
    expect(report.grade).toBe(5); // 90% -> Grade 5
  });

  it('handles zero answers correctly', () => {
    const report = ScoringService.calculateReport(2, 2, 30, []);
    expect(report.answeredCount).toBe(0);
    expect(report.correctAnswers).toBe(0);
    expect(report.wrongAnswers).toBe(0);
    expect(report.unanswered).toBe(30);
    expect(report.percentage).toBe(0);
    expect(report.grade).toBe(2);
  });
});
