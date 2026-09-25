import type { DB } from "@/lib/db";
import { today as todayIso } from "@/lib/dates";
import { getSettings } from "@/lib/repo/profile";
import { activeDays, answeredToday } from "@/lib/repo/progress";
import { currentStreak } from "@/lib/streak";

/**
 * XP and gems.
 *
 * - XP comes from answering: 10 XP per correct answer, 2 XP per attempt that missed
 *   (effort counts). It is computed from the attempts table, so it can't drift.
 * - Levels: level n starts at 50·n·(n−1) XP (0, 100, 300, 600, 1000, …).
 * - Gems are milestone rewards, stored in an idempotent ledger (one award per key).
 */
export const XP_CORRECT = 10;
export const XP_MISSED = 2;
export const GEMS = { dailyGoal: 5, planDay: 10 } as const;
export const STREAK_MILESTONES: Record<number, number> = { 3: 10, 7: 25, 14: 50, 30: 100, 60: 200, 100: 400 };

export function xpTotal(db: DB, profileId: number): number {
  const r = db
    .prepare("SELECT IFNULL(SUM(CASE WHEN correct = 1 THEN ? ELSE ? END), 0) AS xp FROM attempts WHERE profile_id = ?")
    .get(XP_CORRECT, XP_MISSED, profileId) as { xp: number };
  return r.xp;
}

export function levelFor(xp: number): { level: number; into: number; span: number } {
  let level = 1;
  while (50 * (level + 1) * level <= xp) level++;
  const start = 50 * level * (level - 1);
  const next = 50 * (level + 1) * level;
  return { level, into: xp - start, span: next - start };
}

export function gemTotal(db: DB, profileId: number): number {
  return (db.prepare("SELECT IFNULL(SUM(amount), 0) AS n FROM gem_events WHERE profile_id = ?").get(profileId) as { n: number }).n;
}

export interface Award {
  amount: number;
  reason: string;
}

/** Record an award once per key. Returns the award if it is new. */
export function award(db: DB, profileId: number, key: string, amount: number, reason: string): Award | null {
  const r = db.prepare("INSERT OR IGNORE INTO gem_events (profile_id, key, amount, reason) VALUES (?, ?, ?, ?)").run(profileId, key, amount, reason);
  return r.changes > 0 ? { amount, reason } : null;
}

/** Check milestone awards after activity. Returns newly earned awards. */
export function checkAwards(db: DB, profileId: number, completedPlanDays: number[] = [], today = todayIso()): Award[] {
  const out: Award[] = [];
  const s = getSettings(db, profileId);
  if (answeredToday(db, profileId) >= s.daily_goal) {
    const a = award(db, profileId, `daily-goal:${today}`, GEMS.dailyGoal, "Daily goal complete");
    if (a) out.push(a);
  }
  const streak = currentStreak(activeDays(db, profileId), today);
  const bonus = STREAK_MILESTONES[streak];
  if (bonus) {
    const a = award(db, profileId, `streak:${streak}:${today}`, bonus, `${streak}-day streak`);
    if (a) out.push(a);
  }
  for (const id of completedPlanDays) {
    const a = award(db, profileId, `plan-day:${id}`, GEMS.planDay, "Study-plan day complete");
    if (a) out.push(a);
  }
  return out;
}
