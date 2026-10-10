import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env if present
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  host: process.env.HOST || '0.0.0.0',
  databaseUrl: process.env.DATABASE_URL || '',
  testDurationSeconds: parseInt(process.env.TEST_DURATION_SECONDS || '1800', 10), // 30 minutes default
  maxStudentsPerGame: parseInt(process.env.MAX_STUDENTS_PER_GAME || '50', 10),
  gradeThresholds: {
    grade5: parseInt(process.env.GRADE_5_MIN || '90', 10),
    grade4: parseInt(process.env.GRADE_4_MIN || '75', 10),
    grade3: parseInt(process.env.GRADE_3_MIN || '50', 10),
    grade2: parseInt(process.env.GRADE_2_MIN || '0', 10),
  },
  sessionSecret: process.env.SESSION_SECRET || 'dev_secret_key_testing_platform_2026',
  teacherAuth: {
    username: process.env.TEACHER_USERNAME || 'proctor_admin',
    password: process.env.TEACHER_PASSWORD || 'Ex@m#2026$K9v!L8z',
  },
};

