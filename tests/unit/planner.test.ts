import { describe, expect, it } from "vitest";
import { gettingStarted } from "@/lib/checklist";
import { openDb } from "@/lib/db";
import { addDays, parseIso } from "@/lib/dates";
import { generatePlan, listPlan, planDayFor, rebuildPlan, refreshCompletion, startPlanDay } from "@/lib/planner";
import { getPracticeSet, updateSettings } from "@/lib/repo/profile";
import { recordAttempt } from "@/lib/repo/progress";
import { checkAwards, gemTotal, levelFor, xpTotal } from "@/lib/rewards";
import { seedDatabase } from "@/lib/seed";
import { skillStats } from "@/lib/session";
import { SKILLS } from "@/lib/taxonomy";

function freshDb() {
  const db = openDb(":memory:");
  seedDatabase(db);
  return db;
}

const START = "2026-09-21"; // a Monday

describe("plan generation", () => {
  const db = freshDb();
  const stats = skillStats(db, 1);

  it("uses only the chosen weekdays and stops before the test", () => {
    const plan = generatePlan({ start: START, testDate: "2026-11-07", studyDays: [1, 3, 5], dailyGoal: 10, stats });
    expect(plan.length).toBeGreaterThan(10);
    for (const d of plan) {
      expect([1, 3, 5]).toContain(parseIso(d.date).getDay());
      expect(d.date < "2026-11-07").toBe(true);
      expect(d.date >= START).toBe(true);
    }
  });

  it("covers every skill, includes review days, and ends with a light review", () => {
    const plan = generatePlan({ start: START, testDate: "2027-03-06", studyDays: [0, 1, 2, 3, 4, 5, 6], dailyGoal: 12, stats });
    const covered = new Set(plan.flatMap((d) => d.skills));
    for (const s of SKILLS) expect(covered.has(s.id), s.id).toBe(true);
    expect(plan.some((d) => d.kind === "review")).toBe(true);
    expect(plan[plan.length - 1].kind).toBe("final");
    const learn = plan.filter((d) => d.kind === "learn");
    for (const d of learn) expect(d.skills).toHaveLength(2);
  });

  it("schedules weak skills more often", () => {
    const db2 = freshDb();
    const ids = (db2.prepare("SELECT id FROM questions WHERE skill_id = 'boundaries' LIMIT 6").all() as { id: string }[]).map((r) => r.id);
    for (const id of ids) recordAttempt(db2, { profileId: 1, questionId: id, response: "A", correct: false, timeMs: 1, eliminated: [], context: "practice" });
    const strong = (db2.prepare("SELECT id FROM questions WHERE skill_id = 'transitions' LIMIT 6").all() as { id: string }[]).map((r) => r.id);
    for (const id of strong) recordAttempt(db2, { profileId: 1, questionId: id, response: "A", correct: true, timeMs: 1, eliminated: [], context: "practice" });
    const plan = generatePlan({ start: START, testDate: "2026-12-05", studyDays: [1, 2, 3, 4, 5], dailyGoal: 10, stats: skillStats(db2, 1) });
    const count = (id: string) => plan.filter((d) => d.skills.includes(id)).length;
    expect(count("boundaries")).toBeGreaterThan(count("transitions"));
  });

  it("plans 8 weeks ahead when there is no test date", () => {
    const plan = generatePlan({ start: START, testDate: null, studyDays: [1], dailyGoal: 10, stats });
    expect(plan).toHaveLength(8);
    expect(plan.every((d) => d.kind !== "final")).toBe(true);
  });
});

describe("plan persistence", () => {
  it("rebuilds after missed days, keeping finished ones", () => {
    const db = freshDb();
    updateSettings(db, 1, { test_date: "2026-11-30", study_days_json: "[0,1,2,3,4,5,6]", daily_goal: 4 });
    rebuildPlan(db, 1, START);
    const first = planDayFor(db, 1, START)!;
    // Finish the first day.
    const setId = startPlanDay(db, 1, first);
    for (const id of getPracticeSet(db, setId)!.question_ids)
      recordAttempt(db, { profileId: 1, questionId: id, response: "A", correct: true, timeMs: 1, eliminated: [], context: "session" });
    expect(refreshCompletion(db, 1)).toEqual([first.id]);
    // Skip two days, then rebuild on the fourth.
    rebuildPlan(db, 1, addDays(START, 3));
    const plan = listPlan(db, 1);
    expect(plan.find((d) => d.date === START)!.status).toBe("done");
    expect(plan.find((d) => d.date === addDays(START, 1))!.status).toBe("missed");
    expect(plan.find((d) => d.date === addDays(START, 2))!.status).toBe("missed");
    expect(plan.filter((d) => d.date >= addDays(START, 3)).every((d) => d.status === "planned")).toBe(true);
    expect(new Set(plan.map((d) => d.date)).size).toBe(plan.length);
  });

  it("builds a practice set of the right size for a learn day", () => {
    const db = freshDb();
    rebuildPlan(db, 1, START);
    const day = listPlan(db, 1).find((d) => d.kind === "learn")!;
    const set = getPracticeSet(db, startPlanDay(db, 1, day))!;
    expect(set.question_ids).toHaveLength(day.question_count);
    const skills = set.question_ids.map((id) => (db.prepare("SELECT skill_id FROM questions WHERE id = ?").get(id) as { skill_id: string }).skill_id);
    for (const s of skills) expect(day.skills).toContain(s);
    // Starting again reuses the same set.
    expect(startPlanDay(db, 1, listPlan(db, 1).find((d) => d.id === day.id)!)).toBe(set.id);
  });
});

describe("rewards and checklist", () => {
  it("computes XP, levels and idempotent gem awards", () => {
    const db = freshDb();
    expect(levelFor(0)).toEqual({ level: 1, into: 0, span: 100 });
    expect(levelFor(100).level).toBe(2);
    expect(levelFor(299).level).toBe(2);
    expect(levelFor(300).level).toBe(3);
    const ids = (db.prepare("SELECT id FROM questions LIMIT 10").all() as { id: string }[]).map((r) => r.id);
    ids.forEach((id, i) => recordAttempt(db, { profileId: 1, questionId: id, response: "A", correct: i % 2 === 0, timeMs: 1, eliminated: [], context: "practice" }));
    expect(xpTotal(db, 1)).toBe(5 * 10 + 5 * 2);
    const first = checkAwards(db, 1);
    expect(first.map((a) => a.reason)).toContain("Daily goal complete");
    expect(checkAwards(db, 1)).toEqual([]); // no double awards
    expect(gemTotal(db, 1)).toBe(5);
  });

  it("tracks the getting-started checklist from real data", () => {
    const db = freshDb();
    expect(gettingStarted(db, 1).filter((c) => c.done)).toHaveLength(0);
    db.prepare("INSERT INTO attempts (profile_id, question_id, response, correct) VALUES (1, 'rw-ci-01', 'A', 0)").run();
    db.prepare("INSERT INTO attempts (profile_id, question_id, response, correct) VALUES (1, 'rw-ci-01', 'B', 1)").run();
    db.prepare("INSERT INTO saved (profile_id, question_id) VALUES (1, 'rw-ci-01')").run();
    const done = gettingStarted(db, 1).filter((c) => c.done).map((c) => c.id);
    expect(done.sort()).toEqual(["fix", "save"]);
  });
});
