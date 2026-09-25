-- Satori initial schema

CREATE TABLE profiles (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  avatar      TEXT NOT NULL DEFAULT '🌱',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE settings (
  profile_id     INTEGER PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  test_date      TEXT,              -- ISO date (YYYY-MM-DD)
  goal_score     INTEGER NOT NULL DEFAULT 1400,
  current_score  INTEGER,           -- optional self-reported score
  daily_goal     INTEGER NOT NULL DEFAULT 10,   -- questions per day
  theme          TEXT NOT NULL DEFAULT 'system', -- system | light | dark
  onboarded      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE skills (
  id       TEXT PRIMARY KEY,        -- e.g. 'words-in-context'
  section  TEXT NOT NULL CHECK (section IN ('RW','MATH')),
  domain   TEXT NOT NULL,           -- domain id, e.g. 'craft-structure'
  domain_name TEXT NOT NULL,
  name     TEXT NOT NULL,
  sort     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE questions (
  id                     TEXT PRIMARY KEY,
  section                TEXT NOT NULL CHECK (section IN ('RW','MATH')),
  domain                 TEXT NOT NULL,
  skill_id               TEXT NOT NULL REFERENCES skills(id),
  difficulty             INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 3),
  type                   TEXT NOT NULL CHECK (type IN ('mcq','spr')),
  stem_md                TEXT NOT NULL,
  passage_md             TEXT,
  choices_json           TEXT,      -- JSON array of 4 strings (mcq only)
  answer                 TEXT NOT NULL, -- 'A'..'D' for mcq; accepted values separated by '|' for spr
  explanation_md         TEXT NOT NULL,
  distractor_notes_json  TEXT,      -- JSON object { "A": "why wrong", ... }
  tags_json              TEXT NOT NULL DEFAULT '[]',
  source                 TEXT NOT NULL,
  license                TEXT NOT NULL,
  generator_id           TEXT,
  seed                   INTEGER,
  status                 TEXT NOT NULL DEFAULT 'active', -- active | review | retired
  created_at             TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_questions_filter ON questions(section, skill_id, difficulty);
CREATE INDEX idx_questions_domain ON questions(domain);

CREATE TABLE attempts (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id       INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  question_id      TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  response         TEXT NOT NULL,
  correct          INTEGER NOT NULL,
  time_ms          INTEGER NOT NULL DEFAULT 0,
  eliminated_json  TEXT NOT NULL DEFAULT '[]',
  context          TEXT NOT NULL DEFAULT 'practice', -- practice | redo | session | test | rush | challenge
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_attempts_profile_q ON attempts(profile_id, question_id, id);
CREATE INDEX idx_attempts_profile_time ON attempts(profile_id, created_at);

CREATE TABLE saved (
  profile_id   INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  question_id  TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (profile_id, question_id)
);

-- Practice sets: an ordered list of question ids the player walks through.
CREATE TABLE practice_sets (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id   INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  kind         TEXT NOT NULL DEFAULT 'practice', -- practice | redo | session
  question_ids_json TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
