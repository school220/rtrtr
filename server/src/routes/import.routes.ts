import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDb, withTransaction } from '../db/index.js';

export const importRouter = Router();

// Validation Schemas
const OptionSchema = z.object({
  label: z.string().min(1),
  text: z.string().min(1),
  is_correct: z.boolean().optional(),
});

const QuestionImportSchema = z.object({
  number: z.number().int().min(1).max(30),
  type: z.enum(['multiple_choice', 'short_answer']),
  text: z.string().min(1),
  options: z.array(OptionSchema).optional(),
  correct_answer: z.string().min(1),
  explanation: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

const FormImportSchema = z.object({
  form_id: z.number().int().min(1).max(100),
  title: z.string().optional(),
  questions: z.array(QuestionImportSchema),
});

/**
 * Validates a single form imported structure
 */
function validateFormData(data: z.infer<typeof FormImportSchema>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check exactly 30 questions
  if (data.questions.length !== 30) {
    errors.push(`В бланке №${data.form_id} должно быть ровно 30 вопросов (получено: ${data.questions.length}).`);
  }

  // Check question numbering and types
  const seenNumbers = new Set<number>();

  for (const q of data.questions) {
    if (seenNumbers.has(q.number)) {
      errors.push(`Вопрос с номером ${q.number} дублируется в бланке №${data.form_id}.`);
    }
    seenNumbers.add(q.number);

    if (q.number >= 1 && q.number <= 20) {
      if (q.type !== 'multiple_choice') {
        errors.push(`Вопрос №${q.number} должен быть типом 'multiple_choice'.`);
      }
      if (!q.options || q.options.length !== 4) {
        errors.push(`Вопрос №${q.number} (1–20) должен содержать ровно 4 варианта ответа (получено: ${q.options?.length || 0}).`);
      }
    } else if (q.number >= 21 && q.number <= 30) {
      if (q.type !== 'short_answer') {
        errors.push(`Вопрос №${q.number} должен быть типом 'short_answer'.`);
      }
      if (q.options && q.options.length > 0) {
        errors.push(`Вопрос №${q.number} (21–30) не должен содержать варианты ответов.`);
      }
    }
  }

  // Check that all 1..30 numbers exist
  for (let i = 1; i <= 30; i++) {
    if (!seenNumbers.has(i)) {
      errors.push(`В бланке №${data.form_id} отсутствует вопрос №${i}.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * POST /api/import/form
 * Imports a single form with 30 questions
 */
importRouter.post('/form', async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = FormImportSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Неверный формат данных', details: parsed.error.format() });
      return;
    }

    const formData = parsed.data;
    const validation = validateFormData(formData);
    if (!validation.valid) {
      res.status(422).json({ error: 'Ошибка валидации структуры бланка', errors: validation.errors });
      return;
    }

    await withTransaction(async (db) => {
      // 1. Insert or update form
      const title = formData.title || `Бланк №${formData.form_id}`;
      await db.query(
        `INSERT INTO forms (form_id, title) VALUES ($1, $2)
         ON CONFLICT (form_id) DO UPDATE SET title = EXCLUDED.title`,
        [formData.form_id, title]
      );

      // 2. Insert questions
      for (const q of formData.questions) {
        const qCode = `IMPORT_FORM_${formData.form_id}_Q${q.number}`;
        const qRes = await db.query(
          `INSERT INTO questions (code, text, type, points, correct_answer, explanation, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (code) DO UPDATE SET
             text = EXCLUDED.text,
             type = EXCLUDED.type,
             correct_answer = EXCLUDED.correct_answer,
             explanation = EXCLUDED.explanation,
             metadata = EXCLUDED.metadata
           RETURNING id`,
          [
            qCode,
            q.text,
            q.type,
            1,
            q.correct_answer,
            q.explanation || '',
            JSON.stringify(q.metadata || {}),
          ]
        );

        const qId = qRes.rows[0].id;

        // Form question assignment
        await db.query(
          `INSERT INTO form_questions (form_id, question_id, question_number)
           VALUES ($1, $2, $3)
           ON CONFLICT (form_id, question_number) DO UPDATE SET question_id = EXCLUDED.question_id`,
          [formData.form_id, qId, q.number]
        );

        // Options for multiple choice
        if (q.type === 'multiple_choice' && q.options) {
          await db.query('DELETE FROM answer_options WHERE question_id = $1', [qId]);
          for (let i = 0; i < q.options.length; i++) {
            const opt = q.options[i];
            const isCorrect = opt.is_correct ?? (opt.label === q.correct_answer || opt.text === q.correct_answer);
            await db.query(
              `INSERT INTO answer_options (question_id, option_label, option_text, is_correct, sort_order)
               VALUES ($1, $2, $3, $4, $5)`,
              [qId, opt.label, opt.text, isCorrect, i]
            );
          }
        }
      }
    });

    res.json({ success: true, message: `Бланк №${formData.form_id} успешно импортирован.` });
  } catch (err: any) {
    console.error('Import error:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера при импорте', message: err.message });
  }
});

/**
 * GET /api/import/forms-status
 * Returns overview of all 50 forms and their integrity status
 */
importRouter.get('/forms-status', async (_req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb();
    const formsRes = await db.query(
      `SELECT f.form_id, f.title, COUNT(fq.id) as question_count
       FROM forms f
       LEFT JOIN form_questions fq ON f.form_id = fq.form_id
       GROUP BY f.form_id, f.title
       ORDER BY f.form_id ASC`
    );

    res.json({
      totalForms: formsRes.rows.length,
      forms: formsRes.rows.map((r) => ({
        formId: r.form_id,
        title: r.title,
        questionCount: parseInt(r.question_count, 10),
        isComplete: parseInt(r.question_count, 10) === 30,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
