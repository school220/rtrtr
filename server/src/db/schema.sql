-- ========================================================
-- Classroom Testing System - Normalized PostgreSQL Schema
-- ========================================================

-- Teachers / Examiners (Separate accounts for proctors)
CREATE TABLE IF NOT EXISTS teachers (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'EXAMINER', -- 'COMMISSION_CHAIR', 'EXAMINER'
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_teachers_username ON teachers(username);

-- Custom Tests (Teacher-authored tests and quizzes)
CREATE TABLE IF NOT EXISTS custom_tests (
  id VARCHAR(36) PRIMARY KEY,
  teacher_id INT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_custom_tests_teacher ON custom_tests(teacher_id);

-- Custom Test Questions (Questions belonging to teacher-authored tests, with variant support)
CREATE TABLE IF NOT EXISTS custom_test_questions (
  id SERIAL PRIMARY KEY,
  test_id VARCHAR(36) NOT NULL REFERENCES custom_tests(id) ON DELETE CASCADE,
  variant_number INT NOT NULL DEFAULT 1,
  question_number INT NOT NULL,
  question_text TEXT NOT NULL,
  question_type VARCHAR(30) NOT NULL, -- 'four_options', 'yes_no', 'free_input'
  correct_answer TEXT NOT NULL,
  options TEXT, -- JSON array of options: [{"id": 1, "label": "A", "text": "...", "isCorrect": boolean}]
  points INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_custom_test_variant_q UNIQUE (test_id, variant_number, question_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_test_questions_test ON custom_test_questions(test_id, variant_number, question_number);

-- Games (Active and historical testing sessions per examiner)
CREATE TABLE IF NOT EXISTS games (
  id VARCHAR(36) PRIMARY KEY,
  code VARCHAR(10) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL DEFAULT 'Тестирование',
  status VARCHAR(30) NOT NULL DEFAULT 'WAITING', -- 'WAITING', 'STARTING', 'IN_PROGRESS', 'TIME_EXPIRED', 'FINISHED'
  total_time_seconds INT NOT NULL DEFAULT 1800,
  started_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  max_students INT NOT NULL DEFAULT 50,
  teacher_id INT REFERENCES teachers(id) ON DELETE CASCADE DEFAULT 1,
  custom_test_id VARCHAR(36) REFERENCES custom_tests(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_games_code ON games(code);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_games_teacher_id ON games(teacher_id);
CREATE INDEX IF NOT EXISTS idx_games_custom_test_id ON games(custom_test_id);

-- Forms (Each test variant has a form_id 1..50 isolated per examiner)
CREATE TABLE IF NOT EXISTS forms (
  id SERIAL PRIMARY KEY,
  teacher_id INT NOT NULL DEFAULT 1 REFERENCES teachers(id) ON DELETE CASCADE,
  form_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_teacher_form UNIQUE (teacher_id, form_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_forms_teacher_form ON forms(teacher_id, form_id);

-- Questions (Repository of test questions, supports thousands of items)
CREATE TABLE IF NOT EXISTS questions (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE,
  text TEXT NOT NULL,
  type VARCHAR(30) NOT NULL, -- 'multiple_choice' or 'short_answer'
  points INT NOT NULL DEFAULT 1,
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  metadata TEXT DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_questions_type ON questions(type);

-- Answer Options (For multiple choice questions 1-20, exactly 4 options per question)
CREATE TABLE IF NOT EXISTS answer_options (
  id SERIAL PRIMARY KEY,
  question_id INT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  option_label VARCHAR(10) NOT NULL, -- 'A', 'B', 'C', 'D'
  option_text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_answer_options_qid ON answer_options(question_id);

-- Form Questions (Mapping of questions to each examiner's variant)
CREATE TABLE IF NOT EXISTS form_questions (
  id SERIAL PRIMARY KEY,
  teacher_id INT NOT NULL DEFAULT 1 REFERENCES teachers(id) ON DELETE CASCADE,
  form_id INT NOT NULL,
  question_id INT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  question_number INT NOT NULL, -- 1..30
  CONSTRAINT uq_teacher_form_question UNIQUE (teacher_id, form_id, question_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_form_questions_lookup ON form_questions(teacher_id, form_id, question_number);

-- Students (Student participants in a game room)
CREATE TABLE IF NOT EXISTS students (
  id SERIAL PRIMARY KEY,
  game_id VARCHAR(36) NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  student_id INT NOT NULL, -- 1..50, allocated safely by server
  form_id INT NOT NULL, -- variant assigned to student
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  session_token VARCHAR(128) UNIQUE NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'READY', -- 'READY', 'IN_PROGRESS', 'FINISHED', 'DISQUALIFIED'
  is_online BOOLEAN NOT NULL DEFAULT TRUE,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TIMESTAMPTZ,
  disqualified_by VARCHAR(50),
  disqualification_reason TEXT,
  disqualified_at TIMESTAMPTZ,
  CONSTRAINT uq_game_student_id UNIQUE (game_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_students_game_id ON students(game_id);
CREATE INDEX IF NOT EXISTS idx_students_session_token ON students(session_token);

-- Student Answers (Recorded student responses per question)
CREATE TABLE IF NOT EXISTS student_answers (
  id SERIAL PRIMARY KEY,
  game_id VARCHAR(36) NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  student_id INT NOT NULL,
  form_id INT NOT NULL,
  question_number INT NOT NULL, -- 1..30
  question_id INT REFERENCES questions(id),
  custom_question_id INT REFERENCES custom_test_questions(id) ON DELETE SET NULL,
  selected_option_id INT REFERENCES answer_options(id),
  answer_text TEXT,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  points INT NOT NULL DEFAULT 0,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_game_student_qnum UNIQUE (game_id, student_id, question_number)
);

CREATE INDEX IF NOT EXISTS idx_student_answers_lookup ON student_answers(game_id, student_id);

-- Game Events (Security telemetry: fullscreen exit, visibility change, disconnection, etc.)
CREATE TABLE IF NOT EXISTS game_events (
  id SERIAL PRIMARY KEY,
  game_id VARCHAR(36) NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  student_id INT,
  event_type VARCHAR(50) NOT NULL, -- 'STUDENT_JOINED', 'PAGE_HIDDEN', 'FULLSCREEN_EXIT', etc.
  metadata TEXT DEFAULT '{}',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_game_events_game ON game_events(game_id);
CREATE INDEX IF NOT EXISTS idx_game_events_student ON game_events(game_id, student_id);
