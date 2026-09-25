/** Local-date helpers. Dates are handled as YYYY-MM-DD strings in the user's local time zone. */

export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function today(): string {
  return isoDate(new Date());
}

export function parseIso(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number): string {
  const d = parseIso(s);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

/** Whole days from a to b (b − a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseIso(b).getTime() - parseIso(a).getTime()) / 86_400_000);
}

export function formatLong(s: string): string {
  return parseIso(s).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function greeting(hour: number): string {
  if (hour < 5) return "Good late night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 22) return "Good evening";
  return "Good late night";
}

/** The Monday on or before a date. */
export function weekStart(date: string): string {
  const d = parseIso(date).getDay(); // 0 = Sunday
  return addDays(date, d === 0 ? -6 : 1 - d);
}
