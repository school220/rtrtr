import crypto from 'crypto';
import { getDb, withTransaction, DbClient } from '../db/index.js';
import { config } from '../config.js';
import { generateFormQuestions } from '../db/seed.js';

export interface TeacherRecord {
  id: number;
  username: string;
  fullName: string;
  role: string;
  createdAt: string;
}

export class TeacherService {
  /**
   * Hashes a password using crypto.scryptSync with a cryptographically secure random salt
   */
  public static hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
  }

  /**
   * Constant-time password verification against stored salt:hash
   */
  public static verifyPassword(password: string, combinedHash: string): boolean {
    if (!password || !combinedHash || !combinedHash.includes(':')) {
      return false;
    }
    const [salt, hash] = combinedHash.split(':');
    if (!salt || !hash) return false;
    try {
      const testHash = crypto.scryptSync(password, salt, 64).toString('hex');
      const hashBuf = Buffer.from(hash, 'hex');
      const testBuf = Buffer.from(testHash, 'hex');
      if (hashBuf.length !== testBuf.length) return false;
      return crypto.timingSafeEqual(hashBuf, testBuf);
    } catch {
      return false;
    }
  }

  /**
   * Ensures the root admin teacher account exists in the database
   */
  public static async ensureRootTeacher(client?: DbClient): Promise<number> {
    const db = client || (await getDb());
    const username = config.teacherAuth.username || 'proctor_admin';
    const password = config.teacherAuth.password || 'ProctorMath2026!';

    const existing = await db.query('SELECT id FROM teachers WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      return existing.rows[0].id;
    }

    const passwordHash = this.hashPassword(password);
    const insertRes = await db.query(
      `INSERT INTO teachers (username, password_hash, full_name, role)
       VALUES ($1, $2, $3, 'COMMISSION_CHAIR')
       RETURNING id`,
      [username, passwordHash, 'Председатель комиссии']
    );

    const rootId = insertRes.rows[0]?.id || 1;
    return rootId;
  }

  /**
   * Initializes 50 personalized curriculum variants for a newly registered teacher
   */
  public static async initializeTeacherForms(teacherId: number, customClient?: DbClient): Promise<void> {
    const executeInit = async (db: DbClient) => {
      // Check if forms already exist for this teacher
      const check = await db.query('SELECT COUNT(*) as count FROM forms WHERE teacher_id = $1', [teacherId]);
      if (parseInt(check.rows[0]?.count || '0', 10) >= 50) {
        return;
      }

      for (let formId = 1; formId <= 50; formId++) {
        // 1. Insert form
        await db.query(
          `INSERT INTO forms (teacher_id, form_id, title)
           VALUES ($1, $2, $3)
           ON CONFLICT (teacher_id, form_id) DO NOTHING`,
          [teacherId, formId, `Бланк №${formId} (4 класс • Дроби)`]
        );

        // 2. Generate the 20 curriculum questions for this variant
        const questions = generateFormQuestions(formId);

        for (const q of questions) {
          const qCode = `T${teacherId}_FORM_${formId}_Q${q.questionNumber}`;

          const qRes = await db.query(
            `INSERT INTO questions (code, text, type, points, correct_answer, explanation, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (code) DO UPDATE SET
               text = EXCLUDED.text,
               type = EXCLUDED.type,
               points = EXCLUDED.points,
               correct_answer = EXCLUDED.correct_answer,
               explanation = EXCLUDED.explanation,
               metadata = EXCLUDED.metadata
             RETURNING id`,
            [
              qCode,
              q.text,
              q.type,
              1,
              q.correctAnswer,
              q.explanation,
              JSON.stringify(q.metadata || {}),
            ]
          );

          const qDbId = qRes.rows[0]?.id;

          // Link to teacher's form_questions
          await db.query(
            `INSERT INTO form_questions (teacher_id, form_id, question_id, question_number)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (teacher_id, form_id, question_number) DO UPDATE SET question_id = EXCLUDED.question_id`,
            [teacherId, formId, qDbId, q.questionNumber]
          );

          // If multiple choice, insert 4 options
          if (q.type === 'multiple_choice' && q.options) {
            await db.query('DELETE FROM answer_options WHERE question_id = $1', [qDbId]);
            for (let optIdx = 0; optIdx < q.options.length; optIdx++) {
              const opt = q.options[optIdx];
              await db.query(
                `INSERT INTO answer_options (question_id, option_label, option_text, is_correct, sort_order)
                 VALUES ($1, $2, $3, $4, $5)`,
                [qDbId, opt.label, opt.text, opt.isCorrect, optIdx]
              );
            }
          }
        }
      }
    };

    if (customClient) {
      await executeInit(customClient);
    } else {
      await withTransaction(async (db) => {
        await executeInit(db);
      });
    }
  }

  /**
   * Registers a new teacher/examiner with isolated credentials and personal 50 variants
   */
  public static async registerTeacher(params: {
    fullName: string;
    username: string;
    password: string;
  }): Promise<TeacherRecord> {
    const cleanFull = (params.fullName || '').trim();
    const cleanUser = (params.username || '').trim().toLowerCase();
    const cleanPass = (params.password || '').trim();

    if (cleanFull.length < 3) {
      throw new Error('ФИО проверяющего должно содержать не менее 3 символов');
    }

    if (!cleanUser || cleanUser.length < 3 || !/^[a-zA-Z0-9_.-]+$/.test(cleanUser)) {
      throw new Error('Логин должен содержать от 3 символов (латинские буквы, цифры, дефис, подчеркивание)');
    }

    if (cleanPass.length < 6) {
      throw new Error('Пароль должен содержать не менее 6 символов');
    }

    const db = await getDb();

    // Check username uniqueness
    const exists = await db.query('SELECT id FROM teachers WHERE username = $1', [cleanUser]);
    if (exists.rows.length > 0) {
      throw new Error('Проверяющий с таким логином уже зарегистрирован в системе');
    }

    const passwordHash = this.hashPassword(cleanPass);

    const result = await withTransaction(async (tx) => {
      const insRes = await tx.query(
        `INSERT INTO teachers (username, password_hash, full_name, role)
         VALUES ($1, $2, $3, 'EXAMINER')
         RETURNING id, username, full_name, role, created_at`,
        [cleanUser, passwordHash, cleanFull]
      );

      const row = insRes.rows[0];
      const teacherRecord: TeacherRecord = {
        id: row.id,
        username: row.username,
        fullName: row.full_name,
        role: row.role,
        createdAt: row.created_at,
      };

      // Initialize the teacher's personal 50 variants
      await this.initializeTeacherForms(row.id, tx);

      return teacherRecord;
    });

    console.log(`[TEACHER REGISTRATION] 🎓 Зарегистрирован новый проверяющий: ${result.fullName} (@${result.username}, ID #${result.id})`);
    return result;
  }

  /**
   * Verifies login credentials and returns teacher details
   */
  public static async loginTeacher(params: {
    username: string;
    password: string;
  }): Promise<TeacherRecord | null> {
    const cleanUser = (params.username || '').trim().toLowerCase();
    const cleanPass = (params.password || '').trim();

    if (!cleanUser || !cleanPass) return null;

    const db = await getDb();

    // 1. Check in database
    const res = await db.query(
      `SELECT id, username, password_hash, full_name, role, created_at
       FROM teachers
       WHERE LOWER(username) = $1`,
      [cleanUser]
    );

    if (res.rows.length > 0) {
      const teacher = res.rows[0];
      if (this.verifyPassword(cleanPass, teacher.password_hash)) {
        return {
          id: teacher.id,
          username: teacher.username,
          fullName: teacher.full_name,
          role: teacher.role,
          createdAt: teacher.created_at,
        };
      }
      return null;
    }

    // 2. Fallback check for config root teacher (e.g. proctor_admin)
    if (
      cleanUser === (config.teacherAuth.username || '').toLowerCase() &&
      cleanPass === config.teacherAuth.password
    ) {
      const rootId = await this.ensureRootTeacher(db);
      // Ensure root teacher has forms initialized
      await this.initializeTeacherForms(rootId, db);
      return {
        id: rootId,
        username: config.teacherAuth.username,
        fullName: 'Председатель комиссии',
        role: 'COMMISSION_CHAIR',
        createdAt: new Date().toISOString(),
      };
    }

    return null;
  }

  /**
   * Retrieves teacher details by ID
   */
  public static async getTeacherById(id: number): Promise<TeacherRecord | null> {
    const db = await getDb();
    const res = await db.query(
      `SELECT id, username, full_name, role, created_at
       FROM teachers WHERE id = $1`,
      [id]
    );
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      username: r.username,
      fullName: r.full_name,
      role: r.role,
      createdAt: r.created_at,
    };
  }
}
