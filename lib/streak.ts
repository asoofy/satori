import { addDays } from "./dates";

/**
 * Current streak: consecutive days with at least one answered question, ending today —
 * or ending yesterday, so a streak isn't shown as broken before the student has had a
 * chance to practice today.
 */
export function currentStreak(activeDays: string[], today: string): number {
  const set = new Set(activeDays);
  let day = set.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (set.has(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

export function longestStreak(activeDays: string[]): number {
  const days = [...new Set(activeDays)].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of days) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}
