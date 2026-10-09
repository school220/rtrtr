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
  number: z.number().int().min(1).max(20),
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

const PayloadImportSchema = z.union([
  FormImportSchema,
  z.array(FormImportSchema),
]);

/**
 * Validates a single form imported structure
 */
function validateFormData(data: z.infer<typeof FormImportSchema>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check exactly 20 questions
  if (data.questions.length !== 20) {
    errors.push(`В бланке №${data.form_id} должно быть ровно 20 вопросов (получено: ${data.questions.length}).`);
  }

  // Check question numbering and types
  const seenNumbers = new Set<number>();

  for (const q of data.questions) {
    if (seenNumbers.has(q.number)) {
      errors.push(`Вопрос с номером ${q.number} дублируется в бланке №${data.form_id}.`);
    }
    seenNumbers.add(q.number);

    if (q.number >= 1 && q.number <= 15) {
      if (q.type !== 'multiple_choice') {
        errors.push(`Вопрос №${q.number} должен быть типом 'multiple_choice'.`);
      }
      if (!q.options || q.options.length !== 4) {
        errors.push(`Вопрос №${q.number} (1–15) должен содержать ровно 4 варианта ответа (получено: ${q.options?.length || 0}).`);
      }
    } else if (q.number >= 16 && q.number <= 20) {
      if (q.type !== 'short_answer') {
        errors.push(`Вопрос №${q.number} должен быть типом 'short_answer'.`);
      }
      if (q.options && q.options.length > 0) {
        errors.push(`Вопрос №${q.number} (16–20) не должен содержать варианты ответов.`);
      }
    } else {
      errors.push(`Вопрос №${q.number} выходит за пределы диапазона 1–20.`);
    }
  }

  // Check that all 1..20 numbers exist
  for (let i = 1; i <= 20; i++) {
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
 * Imports a single form or an array of forms (20 questions each)
 */
importRouter.post('/form', async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = PayloadImportSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Неверный формат данных', details: parsed.error.format() });
      return;
    }

    const formsList: z.infer<typeof FormImportSchema>[] = Array.isArray(parsed.data)
      ? parsed.data
      : [parsed.data];

    // Validate all forms first
    const allErrors: string[] = [];
    for (const formData of formsList) {
      const validation = validateFormData(formData);
      if (!validation.valid) {
        allErrors.push(...validation.errors);
      }
    }

    if (allErrors.length > 0) {
      res.status(422).json({ error: 'Ошибка валидации структуры бланков', errors: allErrors });
      return;
    }

    await withTransaction(async (db) => {
      for (const formData of formsList) {
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
               points = 1,
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
      }
    });

    const formIds = formsList.map((f) => `№${f.form_id}`).join(', ');
    res.json({
      success: true,
      message: `Успешно импортировано бланков: ${formsList.length} (${formIds}). В каждом бланке по 20 вопросов.`,
    });
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
        isComplete: parseInt(r.question_count, 10) === 20,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/import/form/:formId
 * Returns full question data, options, correct answers, and explanations for formId
 */
importRouter.get('/form/:formId', async (req: Request, res: Response): Promise<void> => {
  try {
    const formId = parseInt(req.params.formId, 10);
    if (isNaN(formId) || formId < 1 || formId > 100) {
      res.status(400).json({ error: 'Неверный номер варианта' });
      return;
    }

    const db = await getDb();
    const formRes = await db.query(
      `SELECT form_id, title FROM forms WHERE form_id = $1`,
      [formId]
    );

    if (formRes.rows.length === 0) {
      res.status(404).json({ error: `Вариант №${formId} не найден` });
      return;
    }

    const form = formRes.rows[0];

    const qRes = await db.query(
      `SELECT 
         fq.question_number,
         q.id as question_id,
         q.text as question_text,
         q.type as question_type,
         q.points,
         q.correct_answer,
         q.explanation,
         ao.id as option_id,
         ao.option_label,
         ao.option_text,
         ao.is_correct
       FROM form_questions fq
       JOIN questions q ON fq.question_id = q.id
       LEFT JOIN answer_options ao ON q.id = ao.question_id
       WHERE fq.form_id = $1
       ORDER BY fq.question_number ASC, ao.sort_order ASC`,
      [formId]
    );

    const questionsMap = new Map<number, any>();

    for (const r of qRes.rows) {
      if (!questionsMap.has(r.question_number)) {
        questionsMap.set(r.question_number, {
          id: r.question_id,
          number: r.question_number,
          type: r.question_type,
          text: r.question_text,
          points: r.points,
          correct_answer: r.correct_answer,
          explanation: r.explanation || '',
          options: r.question_type === 'multiple_choice' ? [] : undefined,
        });
      }

      if (r.question_type === 'multiple_choice' && r.option_id) {
        questionsMap.get(r.question_number)!.options!.push({
          id: r.option_id,
          label: r.option_label,
          text: r.option_text,
          is_correct: Boolean(r.is_correct),
        });
      }
    }

    res.json({
      form_id: form.form_id,
      title: form.title,
      questions: Array.from(questionsMap.values()),
    });
  } catch (err: any) {
    console.error('Error getting form questions:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/import/question/:questionId
 * Updates text, correct_answer, explanation, and options for an individual question
 */
importRouter.put('/question/:questionId', async (req: Request, res: Response): Promise<void> => {
  try {
    const questionId = parseInt(req.params.questionId, 10);
    if (isNaN(questionId)) {
      res.status(400).json({ error: 'Неверный ID вопроса' });
      return;
    }

    const { text, correct_answer, explanation, options } = req.body || {};

    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'Текст вопроса обязателен' });
      return;
    }

    if (!correct_answer || typeof correct_answer !== 'string') {
      res.status(400).json({ error: 'Правильный ответ обязателен' });
      return;
    }

    await withTransaction(async (client) => {
      // 1. Update question
      await client.query(
        `UPDATE questions
         SET text = $1, correct_answer = $2, explanation = $3
         WHERE id = $4`,
        [text, correct_answer, explanation || '', questionId]
      );

      // 2. If options provided (multiple choice), update options
      if (Array.isArray(options) && options.length > 0) {
        await client.query('DELETE FROM answer_options WHERE question_id = $1', [questionId]);
        for (let i = 0; i < options.length; i++) {
          const opt = options[i];
          const isCorrect = Boolean(opt.is_correct || opt.label === correct_answer);
          await client.query(
            `INSERT INTO answer_options (question_id, option_label, option_text, is_correct, sort_order)
             VALUES ($1, $2, $3, $4, $5)`,
            [questionId, opt.label, opt.text, isCorrect, i]
          );
        }
      }
    });

    res.json({ success: true, message: 'Вопрос успешно обновлён' });
  } catch (err: any) {
    console.error('Error updating question:', err);
    res.status(500).json({ error: err.message });
  }
});
