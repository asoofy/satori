-- Phase 4: AI review queue, custom lessons, vocabulary

-- Notes from the AI solve-check (JSON), shown in the review queue.
ALTER TABLE questions ADD COLUMN review_notes_json TEXT;

CREATE TABLE custom_lessons (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id  INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  skills_json TEXT NOT NULL,
  body_md     TEXT NOT NULL,
  source      TEXT NOT NULL,          -- 'built-in' (assembled from lessons) or 'ai:<provider>'
  set_id      INTEGER REFERENCES practice_sets(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE vocab_words (
  id          TEXT PRIMARY KEY,       -- the word, lowercase
  word        TEXT NOT NULL,
  pos         TEXT NOT NULL,          -- part of speech
  definition  TEXT NOT NULL,
  example     TEXT NOT NULL,          -- a sentence using the word
  blank       TEXT NOT NULL,          -- the example with the word replaced by ______
  level       INTEGER NOT NULL DEFAULT 2
);

-- SM-2 spaced-repetition state per profile and word.
CREATE TABLE vocab_progress (
  profile_id  INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  word_id     TEXT NOT NULL REFERENCES vocab_words(id) ON DELETE CASCADE,
  ease        REAL NOT NULL DEFAULT 2.5,
  interval    INTEGER NOT NULL DEFAULT 0,   -- days
  reps        INTEGER NOT NULL DEFAULT 0,
  due         TEXT NOT NULL,                -- YYYY-MM-DD
  lapses      INTEGER NOT NULL DEFAULT 0,
  last_review TEXT,                       -- YYYY-MM-DD (local)
  introduced  TEXT NOT NULL,              -- YYYY-MM-DD the word was first studied
  PRIMARY KEY (profile_id, word_id)
);
