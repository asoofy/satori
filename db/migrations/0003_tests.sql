-- Phase 3: full-length and mini practice tests, Question Rush

CREATE TABLE tests (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id       INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind             TEXT NOT NULL,                  -- full | section | module
  sections_json    TEXT NOT NULL,                  -- e.g. ["RW","MATH"]
  phase            TEXT NOT NULL DEFAULT 'module', -- module | break | done | abandoned
  current_module_id INTEGER,
  break_ends_at    TEXT,
  rw_score         INTEGER,
  math_score       INTEGER,
  rw_margin        INTEGER,
  math_margin      INTEGER,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at     TEXT
);
CREATE INDEX idx_tests_profile ON tests(profile_id, created_at);

CREATE TABLE test_modules (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  test_id           INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  section           TEXT NOT NULL CHECK (section IN ('RW','MATH')),
  stage             INTEGER NOT NULL,              -- 1 or 2
  level             TEXT NOT NULL,                 -- std | easy | hard
  question_ids_json TEXT NOT NULL,
  time_limit_s      INTEGER NOT NULL,
  started_at        TEXT,
  ends_at           TEXT,
  submitted_at      TEXT,
  correct_count     INTEGER
);
CREATE INDEX idx_test_modules_test ON test_modules(test_id);

CREATE TABLE test_answers (
  module_id        INTEGER NOT NULL REFERENCES test_modules(id) ON DELETE CASCADE,
  question_id      TEXT NOT NULL REFERENCES questions(id),
  response         TEXT,
  flagged          INTEGER NOT NULL DEFAULT 0,
  eliminated_json  TEXT NOT NULL DEFAULT '[]',
  highlights_json  TEXT NOT NULL DEFAULT '[]',   -- [{start,end}] character offsets in the passage
  note             TEXT NOT NULL DEFAULT '',
  time_ms          INTEGER NOT NULL DEFAULT 0,
  correct          INTEGER,                       -- filled when the module is submitted
  PRIMARY KEY (module_id, question_id)
);

CREATE TABLE rush_runs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id  INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  section     TEXT,                              -- RW | MATH | NULL for mixed
  duration_s  INTEGER NOT NULL,
  answered    INTEGER NOT NULL,
  correct     INTEGER NOT NULL,
  best_streak INTEGER NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
