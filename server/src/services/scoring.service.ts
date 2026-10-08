import { config } from '../config.js';

export interface ScoreReport {
  studentId: number;
  formId: number;
  totalQuestions: number;
  answeredCount: number;
  correctAnswers: number;
  wrongAnswers: number;
  unanswered: number;
  scorePoints: number;
  percentage: number;
  grade: number;
}

export class ScoringService {
  /**
   * Calculates grade based on percentage and configured thresholds
   */
  public static calculateGrade(percentage: number): number {
    const { grade5, grade4, grade3 } = config.gradeThresholds;
    if (percentage >= grade5) return 5;
    if (percentage >= grade4) return 4;
    if (percentage >= grade3) return 3;
    return 2;
  }

  /**
   * Calculates comprehensive score and grade report for a student
   */
  public static calculateReport(
    studentId: number,
    formId: number,
    totalQuestions: number,
    submittedAnswers: { isCorrect: boolean; points: number }[]
  ): ScoreReport {
    let correctAnswers = 0;
    let wrongAnswers = 0;
    let scorePoints = 0;

    for (const ans of submittedAnswers) {
      if (ans.isCorrect) {
        correctAnswers++;
        scorePoints += ans.points || 1;
      } else {
        wrongAnswers++;
      }
    }

    const answeredCount = submittedAnswers.length;
    const unanswered = Math.max(0, totalQuestions - answeredCount);
    const percentage = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
    const grade = this.calculateGrade(percentage);

    return {
      studentId,
      formId,
      totalQuestions,
      answeredCount,
      correctAnswers,
      wrongAnswers,
      unanswered,
      scorePoints,
      percentage,
      grade,
    };
  }
}
