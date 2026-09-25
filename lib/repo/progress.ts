import type { DB } from "@/lib/db";

export type AttemptContext = "practice" | "redo" | "session" | "test" | "rush" | "challenge" | "lesson";

export interface Attempt {
  id: number;
  question_id: string;
  response: string;
  correct: number;
  time_ms: number;
  context: AttemptContext;
  created_at: string;
}

export function recordAttempt(
  db: DB,
  a: { profileId: number; questionId: string; response: string; correct: boolean; timeMs: number; eliminated: string[]; context: AttemptContext },
): number {
  const r = db
    .prepare(
      `INSERT INTO attempts (profile_id, question_id, response, correct, time_ms, eliminated_json, context)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(a.profileId, a.questionId, a.response, a.correct ? 1 : 0, Math.max(0, Math.round(a.timeMs)), JSON.stringify(a.eliminated), a.context);
  return Number(r.lastInsertRowid);
}

export function isSaved(db: DB, profileId: number, questionId: string): boolean {
  return !!db.prepare("SELECT 1 FROM saved WHERE profile_id = ? AND question_id = ?").get(profileId, questionId);
}

export function setSaved(db: DB, profileId: number, questionId: string, saved: boolean): void {
  if (saved) db.prepare("INSERT OR IGNORE INTO saved (profile_id, question_id) VALUES (?, ?)").run(profileId, questionId);
  else db.prepare("DELETE FROM saved WHERE profile_id = ? AND question_id = ?").run(profileId, questionId);
}

export function savedIds(db: DB, profileId: number, ids: string[]): Set<string> {
  if (!ids.length) return new Set();
  const rows = db
    .prepare(`SELECT question_id FROM saved WHERE profile_id = ? AND question_id IN (${ids.map(() => "?").join(",")})`)
    .all(profileId, ...ids) as { question_id: string }[];
  return new Set(rows.map((r) => r.question_id));
}

/** Question ids whose most recent attempt was wrong, newest first. */
export function mistakeIds(db: DB, profileId: number): string[] {
  const rows = db
    .prepare(
      `SELECT a.question_id FROM attempts a
       JOIN (SELECT question_id, MAX(id) AS last_id FROM attempts WHERE profile_id = ? GROUP BY question_id) l ON l.last_id = a.id
       JOIN questions q ON q.id = a.question_id AND q.status = 'active'
       WHERE a.correct = 0 ORDER BY a.id DESC`,
    )
    .all(profileId) as { question_id: string }[];
  return rows.map((r) => r.question_id);
}

export function savedList(db: DB, profileId: number): string[] {
  const rows = db
    .prepare(
      `SELECT s.question_id FROM saved s JOIN questions q ON q.id = s.question_id
       WHERE s.profile_id = ? ORDER BY s.created_at DESC`,
    )
    .all(profileId) as { question_id: string }[];
  return rows.map((r) => r.question_id);
}

/** Local calendar dates (YYYY-MM-DD) on which the profile answered at least one question. */
export function activeDays(db: DB, profileId: number): string[] {
  const rows = db
    .prepare(
      `SELECT DISTINCT date(created_at, 'localtime') AS d FROM attempts WHERE profile_id = ? ORDER BY d DESC`,
    )
    .all(profileId) as { d: string }[];
  return rows.map((r) => r.d);
}

export function answeredToday(db: DB, profileId: number): number {
  const r = db
    .prepare(
      `SELECT COUNT(*) AS n FROM attempts WHERE profile_id = ? AND date(created_at, 'localtime') = date('now', 'localtime')`,
    )
    .get(profileId) as { n: number };
  return r.n;
}

export interface ScoredAttempt {
  section: "RW" | "MATH";
  skill_id: string;
  difficulty: number;
  correct: number;
  days_ago: number;
  time_ms: number;
}

/** Every attempt with the question's section/skill/difficulty and its age in days. */
export function scoredAttempts(db: DB, profileId: number): ScoredAttempt[] {
  return db
    .prepare(
      `SELECT q.section, q.skill_id, q.difficulty, a.correct, a.time_ms,
              julianday('now') - julianday(a.created_at) AS days_ago
       FROM attempts a JOIN questions q ON q.id = a.question_id
       WHERE a.profile_id = ? ORDER BY a.id DESC`,
    )
    .all(profileId) as unknown as ScoredAttempt[];
}

export function totalAttempts(db: DB, profileId: number): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM attempts WHERE profile_id = ?").get(profileId) as { n: number }).n;
}
