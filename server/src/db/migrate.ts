import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb, closeDb } from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  await db.exec(sql);

  // Incremental column migration for existing databases
  try {
    await db.query(`ALTER TABLE games ADD COLUMN IF NOT EXISTS teacher_id INT REFERENCES teachers(id) ON DELETE CASCADE DEFAULT 1`);
  } catch {
    // ignore if column exists
  }
  try {
    await db.query(`ALTER TABLE forms ADD COLUMN IF NOT EXISTS teacher_id INT REFERENCES teachers(id) ON DELETE CASCADE DEFAULT 1`);
  } catch {
    // ignore if column exists
  }
  try {
    await db.query(`ALTER TABLE form_questions ADD COLUMN IF NOT EXISTS teacher_id INT REFERENCES teachers(id) ON DELETE CASCADE DEFAULT 1`);
  } catch {
    // ignore if column exists
  }

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
