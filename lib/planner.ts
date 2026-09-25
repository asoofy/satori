import type { DB } from "@/lib/db";
import { tx } from "@/lib/db/tx";
import { addDays, daysBetween, parseIso, today as todayIso } from "@/lib/dates";
import { createPracticeSet, getSettings } from "@/lib/repo/profile";
import { mistakeIds, savedList } from "@/lib/repo/progress";
import { buildSession, pickQuestion, type SkillStat, skillPriority, skillStats, targetDifficulty } from "@/lib/session";
import { SKILL_BY_ID, SKILLS, type Section } from "@/lib/taxonomy";

export type PlanKind = "learn" | "review" | "final";

export interface PlanDayInput {
  date: string;
  kind: PlanKind;
  title: string;
  skills: string[];
  question_count: number;
}

export interface PlanDay extends PlanDayInput {
  id: number;
  status: "planned" | "done" | "missed";
  set_id: number | null;
  completed_at: string | null;
}

/** When there's no test date, plan this many days ahead. */
export const DEFAULT_HORIZON_DAYS = 56;
const MAX_PLAN_DAYS = 400;
/** Every Nth study day is a review day. */
const REVIEW_EVERY = 6;

/**
 * Build a day-by-day plan from `start` up to the day before the test.
 *
 * - Only the student's chosen weekdays are used.
 * - Most days are "learn" days with one Reading & Writing skill and one Math skill.
 *   Skills are scheduled by a weighted round-robin: each skill starts with a "debt" of
 *   1 + 4 × priority (priority is high for weak or unpracticed skills), the skill with
 *   the most debt in each section is picked, and its debt drops. Weak skills come back
 *   more often, and every skill appears.
 * - Every 6th study day reviews mistakes and saved questions.
 * - The last study day before the test is a lighter mixed review.
 */
export function generatePlan(opts: {
  start: string;
  testDate: string | null;
  studyDays: number[];
  dailyGoal: number;
  stats: Map<string, SkillStat>;
}): PlanDayInput[] {
  const { start, testDate, studyDays, dailyGoal, stats } = opts;
  const end = testDate && daysBetween(start, testDate) > 0 ? addDays(testDate, -1) : addDays(start, DEFAULT_HORIZON_DAYS - 1);
  const days: string[] = [];
  const weekdays = new Set(studyDays);
  for (let d = start, i = 0; daysBetween(d, end) >= 0 && i < MAX_PLAN_DAYS; d = addDays(d, 1), i++) {
    if (weekdays.has(parseIso(d).getDay())) days.push(d);
  }
  if (!days.length) return [];

  const debt = new Map<string, number>();
  for (const s of SKILLS) debt.set(s.id, 1 + 4 * skillPriority(stats.get(s.id)!));
  const next = (section: Section): string => {
    const candidates = SKILLS.filter((s) => s.section === section);
    let best = candidates[0];
    for (const s of candidates) if (debt.get(s.id)! > debt.get(best.id)!) best = s;
    debt.set(best.id, debt.get(best.id)! - 1.5);
    // Keep debts from running away negative so every skill cycles back.
    if ([...debt.values()].every((v) => v <= 0)) for (const s of SKILLS) debt.set(s.id, debt.get(s.id)! + 2);
    return best.id;
  };

  const out: PlanDayInput[] = [];
  days.forEach((date, i) => {
    const isFinal = testDate !== null && i === days.length - 1 && daysBetween(date, testDate) <= 3;
    if (isFinal) {
      out.push({ date, kind: "final", title: "Light review before test day", skills: [], question_count: Math.max(5, Math.round(dailyGoal / 2)) });
    } else if (i % REVIEW_EVERY === REVIEW_EVERY - 1) {
      out.push({ date, kind: "review", title: "Review mistakes and saved questions", skills: [], question_count: dailyGoal });
    } else {
      const rw = next("RW");
      const math = next("MATH");
      out.push({
        date,
        kind: "learn",
        title: `${SKILL_BY_ID.get(rw)!.name} · ${shortName(math)}`,
        skills: [rw, math],
        question_count: dailyGoal,
      });
    }
  });
  return out;
}

function shortName(skillId: string): string {
  const n = SKILL_BY_ID.get(skillId)!.name;
  return n.length > 38 ? n.split(":")[0].split(" and ")[0].split(",")[0] : n;
}

interface PlanRow {
  id: number;
  date: string;
  kind: PlanKind;
  title: string;
  skills_json: string;
  question_count: number;
  status: "planned" | "done" | "missed";
  set_id: number | null;
  completed_at: string | null;
}

const toDay = (r: PlanRow): PlanDay => ({ ...r, skills: JSON.parse(r.skills_json) as string[] });

export function listPlan(db: DB, profileId: number): PlanDay[] {
  return (db.prepare("SELECT * FROM plan_days WHERE profile_id = ? ORDER BY date").all(profileId) as unknown as PlanRow[]).map(toDay);
}

export function getPlanDay(db: DB, profileId: number, id: number): PlanDay | null {
  const r = db.prepare("SELECT * FROM plan_days WHERE profile_id = ? AND id = ?").get(profileId, id) as unknown as PlanRow | undefined;
  return r ? toDay(r) : null;
}

export function planDayFor(db: DB, profileId: number, date: string): PlanDay | null {
  const r = db.prepare("SELECT * FROM plan_days WHERE profile_id = ? AND date = ?").get(profileId, date) as unknown as PlanRow | undefined;
  return r ? toDay(r) : null;
}

/**
 * Mark finished days done: a day is complete when every question in its practice set
 * has been answered since the set was created. Returns ids of newly completed days.
 */
export function refreshCompletion(db: DB, profileId: number): number[] {
  const rows = db
    .prepare(
      `SELECT p.id, p.question_count, ps.question_ids_json, ps.created_at
       FROM plan_days p JOIN practice_sets ps ON ps.id = p.set_id
       WHERE p.profile_id = ? AND p.status != 'done'`,
    )
    .all(profileId) as { id: number; question_count: number; question_ids_json: string; created_at: string }[];
  const done: number[] = [];
  for (const r of rows) {
    const ids = JSON.parse(r.question_ids_json) as string[];
    if (!ids.length) continue;
    const answered = db
      .prepare(
        `SELECT COUNT(DISTINCT question_id) AS n FROM attempts
         WHERE profile_id = ? AND created_at >= ? AND question_id IN (${ids.map(() => "?").join(",")})`,
      )
      .get(profileId, r.created_at, ...ids) as { n: number };
    if (answered.n >= ids.length) {
      db.prepare("UPDATE plan_days SET status = 'done', completed_at = datetime('now') WHERE id = ?").run(r.id);
      done.push(r.id);
    }
  }
  return done;
}

/**
 * Rebuild the plan from today on, keeping finished days and today's day if it was
 * already started. Past days that weren't finished are marked missed.
 */
export function rebuildPlan(db: DB, profileId: number, today = todayIso()): void {
  const s = getSettings(db, profileId);
  const studyDays = JSON.parse(s.study_days_json) as number[];
  refreshCompletion(db, profileId);
  tx(db, () => {
    db.prepare("UPDATE plan_days SET status = 'missed' WHERE profile_id = ? AND date < ? AND status = 'planned'").run(profileId, today);
    // Keep today's day if the student already started it.
    db.prepare("DELETE FROM plan_days WHERE profile_id = ? AND status = 'planned' AND (date > ? OR (date = ? AND set_id IS NULL))").run(
      profileId,
      today,
      today,
    );
    const plan = generatePlan({
      start: today,
      testDate: s.test_date,
      studyDays,
      dailyGoal: s.daily_goal,
      stats: skillStats(db, profileId, 60),
    });
    const insert = db.prepare(
      `INSERT INTO plan_days (profile_id, date, kind, title, skills_json, question_count)
       VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (profile_id, date) DO NOTHING`,
    );
    for (const d of plan) insert.run(profileId, d.date, d.kind, d.title, JSON.stringify(d.skills), d.question_count);
  });
}

/** Rebuild automatically when a planned day has slipped into the past. Returns true if rebuilt. */
export function ensurePlanFresh(db: DB, profileId: number, today = todayIso()): boolean {
  refreshCompletion(db, profileId);
  const hasPlan = (db.prepare("SELECT COUNT(*) AS n FROM plan_days WHERE profile_id = ?").get(profileId) as { n: number }).n > 0;
  if (!hasPlan) return false;
  const stale = db
    .prepare("SELECT COUNT(*) AS n FROM plan_days WHERE profile_id = ? AND date < ? AND status = 'planned'")
    .get(profileId, today) as { n: number };
  if (stale.n > 0) {
    rebuildPlan(db, profileId, today);
    return true;
  }
  return false;
}

/** Create (or reuse) the practice set for a plan day. Returns the set id. */
export function startPlanDay(db: DB, profileId: number, day: PlanDay): number {
  if (day.set_id) return day.set_id;
  let ids: string[] = [];
  if (day.kind === "learn") {
    const stats = skillStats(db, profileId, 60);
    const used = new Set<string>();
    for (let i = 0; ids.length < day.question_count && i < day.question_count * 4; i++) {
      const skill = day.skills[i % day.skills.length];
      const id = pickQuestion(db, profileId, skill, targetDifficulty(stats.get(skill)!), used);
      if (id) {
        ids.push(id);
        used.add(id);
      }
    }
  } else if (day.kind === "review") {
    const pool = [...new Set([...mistakeIds(db, profileId), ...savedList(db, profileId)])];
    ids = pool.slice(0, day.question_count);
    if (ids.length < day.question_count) {
      const extra = buildSession(db, profileId, day.question_count * 2).filter((id) => !ids.includes(id));
      ids = [...ids, ...extra].slice(0, day.question_count);
    }
  } else {
    ids = buildSession(db, profileId, day.question_count);
  }
  const setId = createPracticeSet(db, profileId, day.title, "plan", ids);
  db.prepare("UPDATE plan_days SET set_id = ? WHERE id = ?").run(setId, day.id);
  return setId;
}
