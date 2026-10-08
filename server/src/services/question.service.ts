import { getDb } from '../db/index.js';

export interface StudentSafeQuestion {
  id: number;
  formId: number;
  questionNumber: number;
  text: string;
  type: 'multiple_choice' | 'short_answer';
  options?: { id: number; label: string; text: string }[];
}

export class QuestionService {
  /**
   * Retrieves a question for a student without sensitive answers or keys.
   * Options are included for multiple_choice without `is_correct`.
   */
  public static async getQuestionForStudent(
    formId: number,
    questionNumber: number
  ): Promise<StudentSafeQuestion | null> {
    const db = await getDb();

    const qRes = await db.query(
      `SELECT q.id, q.text, q.type
       FROM form_questions fq
       JOIN questions q ON fq.question_id = q.id
       WHERE fq.form_id = $1 AND fq.question_number = $2`,
      [formId, questionNumber]
    );

    if (qRes.rows.length === 0) return null;
    const qRow = qRes.rows[0];

    let options: { id: number; label: string; text: string }[] | undefined = undefined;

    if (qRow.type === 'multiple_choice') {
      const optRes = await db.query(
        `SELECT id, option_label, option_text
         FROM answer_options
         WHERE question_id = $1
         ORDER BY sort_order ASC`,
        [qRow.id]
      );

      options = optRes.rows.map((r) => ({
        id: r.id,
        label: r.option_label,
        text: r.option_text,
      }));
    }

    return {
      id: qRow.id,
      formId,
      questionNumber,
      text: qRow.text,
      type: qRow.type,
      options,
    };
  }

  /**
   * Verifies that a form has exactly 30 questions:
   * 1-20 multiple choice with 4 options, 21-30 short answer.
   */
  public static async verifyFormIntegrity(
    formId: number,
    dbClient?: any
  ): Promise<{ valid: boolean; errors: string[] }> {
    const db = dbClient || (await getDb());
    const errors: string[] = [];

    const fqRes = await db.query(
      `SELECT fq.question_number, q.id as question_id, q.type
       FROM form_questions fq
       JOIN questions q ON fq.question_id = q.id
       WHERE fq.form_id = $1
       ORDER BY fq.question_number ASC`,
      [formId]
    );

    if (fqRes.rows.length !== 30) {
      errors.push(`Бланк №${formId} содержит ${fqRes.rows.length} вопросов вместо ровно 30.`);
      return { valid: false, errors };
    }

    for (const row of fqRes.rows) {
      const qNum = row.question_number;
      if (qNum <= 20) {
        if (row.type !== 'multiple_choice') {
          errors.push(`Вопрос ${qNum} в бланке №${formId} должен быть multiple_choice.`);
        } else {
          const optRes = await db.query(
            `SELECT COUNT(*) as count FROM answer_options WHERE question_id = $1`,
            [row.question_id]
          );
          const optCount = parseInt(optRes.rows[0]?.count || '0', 10);
          if (optCount !== 4) {
            errors.push(`Вопрос ${qNum} в бланке №${formId} имеет ${optCount} вариантов вместо 4.`);
          }
        }
      } else {
        if (row.type !== 'short_answer') {
          errors.push(`Вопрос ${qNum} в бланке №${formId} должен быть short_answer.`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
