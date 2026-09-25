-- Phase 2: study plan, rewards

-- Weekdays the student can study (0 = Sunday … 6 = Saturday), JSON array.
ALTER TABLE settings ADD COLUMN study_days_json TEXT NOT NULL DEFAULT '[1,2,3,4,5,6]';

-- One row per planned study day.
CREATE TABLE plan_days (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id      INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date            TEXT NOT NULL,                 -- YYYY-MM-DD (local)
  kind            TEXT NOT NULL,                 -- learn | review | mixed | final
  title           TEXT NOT NULL,
  skills_json     TEXT NOT NULL DEFAULT '[]',    -- focus skill ids
  question_count  INTEGER NOT NULL,
  status          TEXT NOT NULL DEFAULT 'planned', -- planned | done | missed
  set_id          INTEGER REFERENCES practice_sets(id) ON DELETE SET NULL,
  completed_at    TEXT,
  UNIQUE (profile_id, date)
);
CREATE INDEX idx_plan_days_profile ON plan_days(profile_id, date);

-- Gems ledger. `key` makes each award idempotent (e.g. 'daily-goal:2026-09-22').
CREATE TABLE gem_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id  INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  key         TEXT NOT NULL,
  amount      INTEGER NOT NULL,
  reason      TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (profile_id, key)
);
