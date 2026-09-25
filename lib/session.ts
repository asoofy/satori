import type { DB } from "@/lib/db";
import { SKILLS, type Section } from "@/lib/taxonomy";

export interface SkillStat {
  skill_id: string;
  section: Section;
  attempts: number;
  correct: number;
  accuracy: number | null;
  avg_time_ms: number | null;
}

/** Accuracy per skill over the profile's attempts (optionally only the last N days). */
export function skillStats(db: DB, profileId: number, days?: number): Map<string, SkillStat> {
  const rows = db
    .prepare(
      `SELECT q.skill_id, q.section, COUNT(*) AS attempts, SUM(a.correct) AS correct, AVG(a.time_ms) AS avg_time_ms
       FROM attempts a JOIN questions q ON q.id = a.question_id
       WHERE a.profile_id = ? ${days ? "AND a.created_at >= datetime('now', ?)" : ""}
       GROUP BY q.skill_id`,
    )
    .all(...(days ? [profileId, `-${days} days`] : [profileId])) as unknown as Array<{
    skill_id: string;
    section: Section;
    attempts: number;
    correct: number;
    avg_time_ms: number;
  }>;
  const out = new Map<string, SkillStat>();
  for (const s of SKILLS) {
    out.set(s.id, { skill_id: s.id, section: s.section, attempts: 0, correct: 0, accuracy: null, avg_time_ms: null });
  }
  for (const r of rows) {
    out.set(r.skill_id, {
      skill_id: r.skill_id,
      section: r.section,
      attempts: r.attempts,
      correct: r.correct,
      accuracy: r.attempts ? r.correct / r.attempts : null,
      avg_time_ms: r.avg_time_ms,
    });
  }
  return out;
}

/**
 * Priority for practicing a skill: higher = more urgent.
 * Weak skills (low accuracy, with a few attempts to be sure) come first, then skills
 * never practiced, then everything else.
 */
export function skillPriority(s: SkillStat): number {
  if (s.attempts === 0 || s.accuracy === null) return 0.6;
  const confidence = Math.min(1, s.attempts / 5);
  return (1 - s.accuracy) * confidence + 0.6 * (1 - confidence);
}

/** Pick a difficulty that stretches the student without overwhelming them. */
export function targetDifficulty(s: SkillStat): 1 | 2 | 3 {
  if (s.accuracy === null || s.attempts < 3) return 2;
  if (s.accuracy >= 0.8) return 3;
  if (s.accuracy < 0.5) return 1;
  return 2;
}

/** Pick one question for a skill, preferring unseen questions near the target difficulty. */
export function pickQuestion(db: DB, profileId: number, skillId: string, difficulty: number, exclude: Set<string>): string | null {
  const rows = db
    .prepare(
      `SELECT q.id,
              (SELECT MAX(a.id) FROM attempts a WHERE a.profile_id = $pid AND a.question_id = q.id) AS last_attempt,
              (SELECT a.correct FROM attempts a WHERE a.profile_id = $pid AND a.question_id = q.id ORDER BY a.id DESC LIMIT 1) AS last_correct
       FROM questions q
       WHERE q.skill_id = $skill AND q.status = 'active'
       ORDER BY (last_attempt IS NOT NULL), ABS(q.difficulty - $diff), (last_correct = 1), RANDOM()
       LIMIT 40`,
    )
    .all({ $pid: profileId, $skill: skillId, $diff: difficulty }) as { id: string }[];
  const pick = rows.find((r) => !exclude.has(r.id));
  return pick?.id ?? null;
}

/**
 * Build today's session: `n` questions, split evenly between the two sections,
 * drawn from the student's highest-priority skills in round-robin order.
 */
export function buildSession(db: DB, profileId: number, n: number, sections: Section[] = ["RW", "MATH"]): string[] {
  const stats = skillStats(db, profileId, 60);
  const chosen: string[] = [];
  const used = new Set<string>();
  const perSection = sections.map((sec, i) => Math.floor(n / sections.length) + (i < n % sections.length ? 1 : 0));
  sections.forEach((sec, i) => {
    const ranked = [...stats.values()]
      .filter((s) => s.section === sec)
      .sort((a, b) => skillPriority(b) - skillPriority(a) || a.skill_id.localeCompare(b.skill_id));
    // Focus on the weakest few skills, but keep some variety.
    const focus = ranked.slice(0, Math.max(3, Math.ceil(perSection[i] / 2)));
    let k = 0;
    let guard = 0;
    while (chosen.filter((id) => sectionOf(db, id) === sec).length < perSection[i] && guard++ < perSection[i] * 6) {
      const s = focus[k++ % focus.length];
      const id = pickQuestion(db, profileId, s.skill_id, targetDifficulty(s), used);
      if (id) {
        chosen.push(id);
        used.add(id);
      }
    }
  });
  // Interleave sections so the session alternates between them.
  const rw = chosen.filter((id) => sectionOf(db, id) === "RW");
  const math = chosen.filter((id) => sectionOf(db, id) === "MATH");
  const out: string[] = [];
  for (let i = 0; i < Math.max(rw.length, math.length); i++) {
    if (rw[i]) out.push(rw[i]);
    if (math[i]) out.push(math[i]);
  }
  return out;
}

function sectionOf(db: DB, id: string): Section {
  return (db.prepare("SELECT section FROM questions WHERE id = ?").get(id) as { section: Section }).section;
}
