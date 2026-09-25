import { isoDate } from "./dates";

/**
 * Typical digital SAT weekend dates: the first Saturday of March, May, June, October,
 * November and December, and the fourth Saturday of August. These follow the usual
 * pattern only — they are suggestions, and students should confirm official dates.
 */
const PATTERN: { month: number; nth: number }[] = [
  { month: 2, nth: 1 }, // March
  { month: 4, nth: 1 }, // May
  { month: 5, nth: 1 }, // June
  { month: 7, nth: 4 }, // August
  { month: 9, nth: 1 }, // October
  { month: 10, nth: 1 }, // November
  { month: 11, nth: 1 }, // December
];

function nthSaturday(year: number, month: number, nth: number): Date {
  const d = new Date(year, month, 1);
  const offset = (6 - d.getDay() + 7) % 7;
  return new Date(year, month, 1 + offset + (nth - 1) * 7);
}

export function upcomingTestDates(from: Date, count: number): string[] {
  const out: string[] = [];
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (let y = start.getFullYear(); out.length < count && y < start.getFullYear() + 3; y++) {
    for (const p of PATTERN) {
      const d = nthSaturday(y, p.month, p.nth);
      if (d > start && out.length < count) out.push(isoDate(d));
    }
  }
  return out;
}
