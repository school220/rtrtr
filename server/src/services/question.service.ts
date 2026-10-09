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
   * Retrieves all questions for a student's form in a single batch query.
   */
  public static async getAllQuestionsForStudent(
    formId: number
  ): Promise<StudentSafeQuestion[]> {
    const db = await getDb();

    const res = await db.query(
      `SELECT 
         fq.question_number,
         q.id as question_id,
         q.text,
         q.type,
         ao.id as option_id,
         ao.option_label,
         ao.option_text
       FROM form_questions fq
       JOIN questions q ON fq.question_id = q.id
       LEFT JOIN answer_options ao ON q.id = ao.question_id
       WHERE fq.form_id = $1
       ORDER BY fq.question_number ASC, ao.sort_order ASC`,
      [formId]
    );

    const questionsMap = new Map<number, StudentSafeQuestion>();

    for (const r of res.rows) {
      if (!questionsMap.has(r.question_number)) {
        questionsMap.set(r.question_number, {
          id: r.question_id,
          formId,
          questionNumber: r.question_number,
          text: r.text,
          type: r.type,
          options: r.type === 'multiple_choice' ? [] : undefined,
        });
      }

      if (r.type === 'multiple_choice' && r.option_id) {
        questionsMap.get(r.question_number)!.options!.push({
          id: r.option_id,
          label: r.option_label,
          text: r.option_text,
        });
      }
    }

    return Array.from(questionsMap.values());
  }

  /**
   * Verifies that a form has exactly 20 questions:
   * 1-15 multiple choice with 4 options, 16-20 short answer.
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

    if (fqRes.rows.length !== 20) {
      errors.push(`Бланк №${formId} содержит ${fqRes.rows.length} вопросов вместо ровно 20.`);
      return { valid: false, errors };
    }

    for (const row of fqRes.rows) {
      const qNum = row.question_number;
      if (qNum <= 15) {
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
