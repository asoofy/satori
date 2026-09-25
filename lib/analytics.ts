import type { DB } from "@/lib/db";

export type Dimension = "section" | "domain" | "skill" | "difficulty";

export interface BreakdownRow {
  key: string;
  attempts: number;
  correct: number;
  accuracy: number;
  avgTimeMs: number;
}

const COLUMN: Record<Dimension, string> = {
  section: "q.section",
  domain: "q.domain",
  skill: "q.skill_id",
  difficulty: "CAST(q.difficulty AS TEXT)",
};

/** Accuracy and average time per question, grouped by one dimension. */
export function breakdown(db: DB, profileId: number, by: Dimension, sinceDays?: number): BreakdownRow[] {
  const rows = db
    .prepare(
      `SELECT ${COLUMN[by]} AS key, COUNT(*) AS attempts, SUM(a.correct) AS correct, AVG(a.time_ms) AS avg_time
       FROM attempts a JOIN questions q ON q.id = a.question_id
       WHERE a.profile_id = ? ${sinceDays ? "AND a.created_at >= datetime('now', ?)" : ""}
       GROUP BY key ORDER BY key`,
    )
    .all(...(sinceDays ? [profileId, `-${sinceDays} days`] : [profileId])) as { key: string; attempts: number; correct: number; avg_time: number }[];
  return rows.map((r) => ({
    key: r.key,
    attempts: r.attempts,
    correct: r.correct,
    accuracy: r.attempts ? r.correct / r.attempts : 0,
    avgTimeMs: r.avg_time ?? 0,
  }));
}

export interface WeekPoint {
  week: string; // Monday, YYYY-MM-DD
  section: "RW" | "MATH";
  attempts: number;
  accuracy: number;
}

/** Weekly accuracy per section for the last `weeks` weeks (weeks start on Monday). */
export function weeklyTrend(db: DB, profileId: number, weeks = 12): WeekPoint[] {
  const rows = db
    .prepare(
      `SELECT date(a.created_at, 'localtime', 'weekday 0', '-6 days') AS week, q.section,
              COUNT(*) AS attempts, AVG(a.correct) AS accuracy
       FROM attempts a JOIN questions q ON q.id = a.question_id
       WHERE a.profile_id = ? AND a.created_at >= datetime('now', ?)
       GROUP BY week, q.section ORDER BY week`,
    )
    .all(profileId, `-${weeks * 7} days`) as unknown as WeekPoint[];
  return rows;
}

/** Questions answered per local day for the last `days` days. */
export function dailyCounts(db: DB, profileId: number, days = 30): Map<string, { attempts: number; correct: number }> {
  const rows = db
    .prepare(
      `SELECT date(created_at, 'localtime') AS d, COUNT(*) AS attempts, SUM(correct) AS correct
       FROM attempts WHERE profile_id = ? AND created_at >= datetime('now', ?)
       GROUP BY d`,
    )
    .all(profileId, `-${days} days`) as { d: string; attempts: number; correct: number }[];
  return new Map(rows.map((r) => [r.d, { attempts: r.attempts, correct: r.correct }]));
}

export function totals(db: DB, profileId: number): { attempts: number; correct: number; avgTimeMs: number } {
  const r = db
    .prepare("SELECT COUNT(*) AS attempts, IFNULL(SUM(correct), 0) AS correct, IFNULL(AVG(time_ms), 0) AS avg FROM attempts WHERE profile_id = ?")
    .get(profileId) as { attempts: number; correct: number; avg: number };
  return { attempts: r.attempts, correct: r.correct, avgTimeMs: r.avg };
}
