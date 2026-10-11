import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { getDb, closeDb } from './index.js';
import { config } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function hashDefaultPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export async function runMigrations(): Promise<void> {
  console.log('🔄 Running database migrations...');
  const candidatePaths = [
    path.resolve(__dirname, 'schema.sql'),
    path.resolve(__dirname, '../../src/db/schema.sql'),
    path.resolve(__dirname, '../src/db/schema.sql'),
    path.resolve(process.cwd(), 'server/src/db/schema.sql'),
    path.resolve(process.cwd(), 'src/db/schema.sql'),
    path.resolve(process.cwd(), 'server/dist/db/schema.sql'),
    path.resolve(process.cwd(), 'dist/db/schema.sql'),
  ];
  const schemaPath = candidatePaths.find((p) => fs.existsSync(p));
  if (!schemaPath) {
    throw new Error(`schema.sql not found in any candidate path: ${candidatePaths.join(', ')}`);
  }
  const sql = fs.readFileSync(schemaPath, 'utf-8');

  const db = await getDb();

  // 1. Ensure prerequisite tables exist before foreign key column additions
  await db.exec(`
    CREATE TABLE IF NOT EXISTS teachers (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      full_name VARCHAR(100) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'EXAMINER',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS custom_tests (
      id VARCHAR(36) PRIMARY KEY,
      teacher_id INT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      duration_minutes INT NOT NULL DEFAULT 30,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS custom_test_questions (
      id SERIAL PRIMARY KEY,
      test_id VARCHAR(36) NOT NULL REFERENCES custom_tests(id) ON DELETE CASCADE,
      question_number INT NOT NULL,
      question_text TEXT NOT NULL,
      question_type VARCHAR(30) NOT NULL,
      correct_answer TEXT NOT NULL,
      options TEXT,
      points INT NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_custom_test_question UNIQUE (test_id, question_number)
    );
  `);

  // Ensure default teacher exists
  try {
    const defaultUser = config.teacherAuth.username || 'proctor_admin';
    const defaultPw = config.teacherAuth.password || 'ProctorMath2026!';
    const defaultHash = hashDefaultPassword(defaultPw);

    await db.query(`
      INSERT INTO teachers (id, username, password_hash, full_name, role)
      VALUES (1, $1, $2, 'Председатель комиссии', 'COMMISSION_CHAIR')
      ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash WHERE teachers.password_hash NOT LIKE '%:%'
    `, [defaultUser, defaultHash]);
    await db.query(`SELECT setval('teachers_id_seq', GREATEST(1, (SELECT COALESCE(MAX(id), 1) FROM teachers)))`);
  } catch {
    // ignore
  }

  // 2. Pre-migrate columns in existing tables so schema.sql index creations won't fail
  const preAlterStatements = [
    `ALTER TABLE games ADD COLUMN IF NOT EXISTS teacher_id INT REFERENCES teachers(id) ON DELETE CASCADE DEFAULT 1`,
    `ALTER TABLE games ADD COLUMN IF NOT EXISTS custom_test_id VARCHAR(36) REFERENCES custom_tests(id) ON DELETE SET NULL`,
    `ALTER TABLE forms ADD COLUMN IF NOT EXISTS teacher_id INT REFERENCES teachers(id) ON DELETE CASCADE DEFAULT 1`,
    `ALTER TABLE form_questions ADD COLUMN IF NOT EXISTS teacher_id INT REFERENCES teachers(id) ON DELETE CASCADE DEFAULT 1`,
    `ALTER TABLE students ADD COLUMN IF NOT EXISTS disqualified_by VARCHAR(50)`,
    `ALTER TABLE students ADD COLUMN IF NOT EXISTS disqualification_reason TEXT`,
    `ALTER TABLE students ADD COLUMN IF NOT EXISTS disqualified_at TIMESTAMPTZ`,
    `ALTER TABLE student_answers ALTER COLUMN question_id DROP NOT NULL`,
    `ALTER TABLE student_answers ADD COLUMN IF NOT EXISTS custom_question_id INT REFERENCES custom_test_questions(id) ON DELETE SET NULL`,
  ];

  for (const stmt of preAlterStatements) {
    try {
      await db.query(stmt);
    } catch {
      // ignore if table doesn't exist yet or column already exists
    }
  }

  // 3. Drop obsolete legacy constraints on existing tables and ensure unique indices
  try {
    await db.exec(`
      ALTER TABLE forms DROP CONSTRAINT IF EXISTS forms_form_id_key CASCADE;
      DROP INDEX IF EXISTS idx_forms_teacher_form;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_forms_teacher_form ON forms(teacher_id, form_id);
      ALTER TABLE form_questions DROP CONSTRAINT IF EXISTS uq_form_question_number CASCADE;
      DROP INDEX IF EXISTS idx_form_questions_lookup;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_form_questions_lookup ON form_questions(teacher_id, form_id, question_number);
    `);
  } catch {}

  // 4. Now execute the full schema.sql (tables, constraints, indices)
  await db.exec(sql);

  console.log('✅ Database migrations applied successfully.');
}

// Allow direct CLI execution
if (process.argv[1] === __filename) {
  runMigrations()
    .then(() => closeDb())
    .catch((err) => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}
