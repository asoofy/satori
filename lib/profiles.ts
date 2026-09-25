import type { DB } from "@/lib/db";
import { tx } from "@/lib/db/tx";
import { weekStart } from "@/lib/dates";
import { activeDays } from "@/lib/repo/progress";
import { currentStreak } from "@/lib/streak";
import { XP_CORRECT, XP_MISSED } from "@/lib/rewards";

export const AVATARS = ["🌱", "🦊", "🐢", "🦉", "🐙", "🦋", "🐝", "🌵", "🍀", "⭐", "🚀", "🎧"];

export function createProfile(db: DB, name: string, avatar: string): number {
  const r = db.prepare("INSERT INTO profiles (name, avatar) VALUES (?, ?)").run(name.trim().slice(0, 40), AVATARS.includes(avatar) ? avatar : AVATARS[0]);
  const id = Number(r.lastInsertRowid);
  db.prepare("INSERT OR IGNORE INTO settings (profile_id) VALUES (?)").run(id);
  return id;
}

export function deleteProfile(db: DB, id: number): void {
  const n = (db.prepare("SELECT COUNT(*) AS n FROM profiles").get() as { n: number }).n;
  if (n <= 1) throw new Error("You can’t delete the only profile.");
  db.prepare("DELETE FROM profiles WHERE id = ?").run(id);
}

/** Erase all progress for a profile but keep the profile and its goals. */
export function resetProgress(db: DB, id: number): void {
  tx(db, () => {
    for (const table of ["attempts", "saved", "practice_sets", "plan_days", "gem_events", "tests", "rush_runs", "custom_lessons", "vocab_progress"]) {
      db.prepare(`DELETE FROM ${table} WHERE profile_id = ?`).run(id);
    }
  });
}

/* ---------------- Leaderboard & leagues ---------------- */

export interface League {
  id: string;
  name: string;
  min: number;
  emoji: string;
}

/** Leagues by XP earned this week (Monday–Sunday). */
export const LEAGUES: League[] = [
  { id: "bronze", name: "Bronze", min: 0, emoji: "🥉" },
  { id: "silver", name: "Silver", min: 200, emoji: "🥈" },
  { id: "gold", name: "Gold", min: 500, emoji: "🥇" },
  { id: "diamond", name: "Diamond", min: 1000, emoji: "💎" },
];

export function leagueFor(weeklyXp: number): League {
  return [...LEAGUES].reverse().find((l) => weeklyXp >= l.min)!;
}

export interface LeaderRow {
  id: number;
  name: string;
  avatar: string;
  weeklyXp: number;
  totalXp: number;
  weeklyAnswers: number;
  streak: number;
  bestRush: number;
  league: League;
}

export function leaderboard(db: DB, today: string): LeaderRow[] {
  const monday = weekStart(today);
  const profiles = db.prepare("SELECT id, name, avatar FROM profiles ORDER BY id").all() as { id: number; name: string; avatar: string }[];
  const rows = profiles.map((p) => {
    const xp = (since: string | null) =>
      (
        db
          .prepare(
            `SELECT IFNULL(SUM(CASE WHEN correct = 1 THEN ? ELSE ? END), 0) AS xp, COUNT(*) AS n FROM attempts
             WHERE profile_id = ? ${since ? "AND date(created_at, 'localtime') >= ?" : ""}`,
          )
          .get(...(since ? [XP_CORRECT, XP_MISSED, p.id, since] : [XP_CORRECT, XP_MISSED, p.id])) as { xp: number; n: number }
      );
    const week = xp(monday);
    const total = xp(null);
    const rush = db.prepare("SELECT IFNULL(MAX(correct), 0) AS best FROM rush_runs WHERE profile_id = ?").get(p.id) as { best: number };
    return {
      ...p,
      weeklyXp: week.xp,
      weeklyAnswers: week.n,
      totalXp: total.xp,
      streak: currentStreak(activeDays(db, p.id), today),
      bestRush: rush.best,
      league: leagueFor(week.xp),
    };
  });
  return rows.sort((a, b) => b.weeklyXp - a.weeklyXp || b.totalXp - a.totalXp || a.id - b.id);
}
