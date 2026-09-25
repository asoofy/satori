import { describe, expect, it } from "vitest";
import { openDb } from "@/lib/db";
import { recordAttempt } from "@/lib/repo/progress";
import { estimateSection, MIN_ANSWERS, predict, recencyWeight } from "@/lib/scoring";
import { seedDatabase } from "@/lib/seed";
import { buildSession } from "@/lib/session";
import { currentStreak, longestStreak } from "@/lib/streak";
import { upcomingTestDates } from "@/lib/test-dates";

const answers = (n: number, difficulty: number, correct: boolean, days_ago = 0) =>
  Array.from({ length: n }, () => ({ difficulty, correct, days_ago }));

describe("predicted score model", () => {
  it("needs a minimum number of answers", () => {
    expect(estimateSection(answers(MIN_ANSWERS - 1, 2, true))).toBeNull();
    expect(estimateSection(answers(MIN_ANSWERS, 2, true))).not.toBeNull();
  });

  it("stays within 200–800 in multiples of 10", () => {
    for (const data of [answers(60, 3, true), answers(60, 1, false), [...answers(10, 1, true), ...answers(10, 3, false)]]) {
      const e = estimateSection(data)!;
      expect(e.score).toBeGreaterThanOrEqual(200);
      expect(e.score).toBeLessThanOrEqual(800);
      expect(e.score % 10).toBe(0);
      expect(e.margin % 10).toBe(0);
    }
  });

  it("rises with more correct answers", () => {
    const low = estimateSection([...answers(6, 2, true), ...answers(14, 2, false)])!;
    const high = estimateSection([...answers(14, 2, true), ...answers(6, 2, false)])!;
    expect(high.score).toBeGreaterThan(low.score);
  });

  it("credits hard questions more than easy ones", () => {
    const easy = estimateSection(answers(20, 1, true))!;
    const hard = estimateSection(answers(20, 3, true))!;
    expect(hard.score).toBeGreaterThan(easy.score);
  });

  it("weights recent answers more than old ones", () => {
    expect(recencyWeight(0)).toBe(1);
    expect(recencyWeight(21)).toBeCloseTo(0.5);
    const improving = estimateSection([...answers(15, 2, false, 90), ...answers(15, 2, true, 0)])!;
    const declining = estimateSection([...answers(15, 2, true, 90), ...answers(15, 2, false, 0)])!;
    expect(improving.score).toBeGreaterThan(declining.score);
  });

  it("gets more certain with more data", () => {
    const few = estimateSection([...answers(5, 2, true), ...answers(5, 2, false)])!;
    const many = estimateSection([...answers(50, 2, true), ...answers(50, 2, false)])!;
    expect(many.margin).toBeLessThan(few.margin);
  });

  it("totals both sections only when both have estimates", () => {
    const rw = answers(10, 2, true).map((a) => ({ ...a, section: "RW" as const }));
    const math = answers(10, 2, true).map((a) => ({ ...a, section: "MATH" as const }));
    expect(predict(rw).total).toBeNull();
    const p = predict([...rw, ...math]);
    expect(p.total!.score).toBe(p.rw!.score + p.math!.score);
  });
});

describe("streaks", () => {
  it("counts consecutive days ending today or yesterday", () => {
    expect(currentStreak(["2026-09-22", "2026-09-21", "2026-09-20"], "2026-09-22")).toBe(3);
    expect(currentStreak(["2026-09-21", "2026-09-20"], "2026-09-22")).toBe(2);
    expect(currentStreak(["2026-09-19"], "2026-09-22")).toBe(0);
    expect(currentStreak([], "2026-09-22")).toBe(0);
  });
  it("handles month boundaries and finds the longest run", () => {
    expect(currentStreak(["2026-10-01", "2026-09-30"], "2026-10-01")).toBe(2);
    expect(longestStreak(["2026-01-01", "2026-01-02", "2026-01-05", "2026-01-06", "2026-01-07"])).toBe(3);
  });
});

describe("test dates", () => {
  it("lists upcoming Saturdays after today, in order", () => {
    const dates = upcomingTestDates(new Date(2026, 8, 22), 6);
    expect(dates).toHaveLength(6);
    expect(dates[0]).toBe("2026-10-03");
    for (const d of dates) expect(new Date(d + "T00:00").getDay()).toBe(6);
    expect([...dates].sort()).toEqual(dates);
  });
});

describe("daily session builder", () => {
  it("builds a balanced, duplicate-free session that targets weak skills", () => {
    const db = openDb(":memory:");
    seedDatabase(db);
    // Make "transitions" a weak skill: 5 wrong answers.
    const ids = (db.prepare("SELECT id FROM questions WHERE skill_id = 'transitions' LIMIT 5").all() as { id: string }[]).map((r) => r.id);
    for (const id of ids) recordAttempt(db, { profileId: 1, questionId: id, response: "A", correct: false, timeMs: 1000, eliminated: [], context: "practice" });
    const session = buildSession(db, 1, 10);
    expect(session).toHaveLength(10);
    expect(new Set(session).size).toBe(10);
    const rows = session.map((id) => db.prepare("SELECT section, skill_id FROM questions WHERE id = ?").get(id) as { section: string; skill_id: string });
    expect(rows.filter((r) => r.section === "RW")).toHaveLength(5);
    expect(rows.filter((r) => r.section === "MATH")).toHaveLength(5);
    expect(rows.some((r) => r.skill_id === "transitions")).toBe(true);
  });
});
