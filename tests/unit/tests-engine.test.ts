import { describe, expect, it } from "vitest";
import { openDb } from "@/lib/db";
import { getQuestionsByIds } from "@/lib/repo/questions";
import { seedDatabase } from "@/lib/seed";
import {
  assembleModule,
  autoSubmitExpired,
  BLUEPRINT,
  createTest,
  EASY_ROUTE_CAP,
  endBreak,
  getModule,
  getModules,
  getTest,
  MODULE_SIZE,
  saveAnswer,
  scoreSection,
  splitCounts,
  startModule,
  submitModule,
} from "@/lib/tests";

function freshDb() {
  const db = openDb(":memory:");
  seedDatabase(db);
  return db;
}

/** Answer every question in a module, getting the first `nCorrect` right. */
function answerModule(db: ReturnType<typeof freshDb>, moduleId: number, nCorrect: number) {
  const m = getModule(db, moduleId)!;
  getQuestionsByIds(db, m.question_ids).forEach((q, i) => {
    const right = q.answer.split("|")[0];
    const wrong = q.type === "mcq" ? ["A", "B", "C", "D"].find((l) => l !== q.answer)! : "99999";
    saveAnswer(db, moduleId, q.id, { response: i < nCorrect ? right : wrong, addTimeMs: 30_000 });
  });
}

describe("blueprint", () => {
  it("splits counts exactly", () => {
    for (const n of [3, 4, 6, 7, 8]) {
      for (const mix of [[0.33, 0.34, 0.33], [0.45, 0.4, 0.15], [0.15, 0.4, 0.45]] as [number, number, number][]) {
        expect(splitCounts(n, mix).reduce((a, b) => a + b, 0)).toBe(n);
      }
    }
  });

  it("assembles full-size modules by domain without repeats", () => {
    const db = freshDb();
    for (const section of ["RW", "MATH"] as const) {
      const ids = assembleModule(db, 1, section, "std", new Set());
      expect(ids).toHaveLength(MODULE_SIZE[section]);
      expect(new Set(ids).size).toBe(ids.length);
      const qs = getQuestionsByIds(db, ids);
      for (const { domain, n } of BLUEPRINT[section]) expect(qs.filter((q) => q.domain === domain)).toHaveLength(n);
      expect(qs.every((q) => q.section === section)).toBe(true);
    }
  });

  it("makes hard modules harder than easy ones", () => {
    const db = freshDb();
    const avg = (level: "easy" | "hard") =>
      getQuestionsByIds(db, assembleModule(db, 1, "MATH", level, new Set())).reduce((s, q) => s + q.difficulty, 0) / MODULE_SIZE.MATH;
    expect(avg("hard")).toBeGreaterThan(avg("easy") + 0.4);
  });

  it("includes grid-in questions in math modules", () => {
    const db = freshDb();
    const qs = getQuestionsByIds(db, assembleModule(db, 1, "MATH", "std", new Set()));
    expect(qs.filter((q) => q.type === "spr").length).toBeGreaterThanOrEqual(3);
  });
});

describe("full test flow", () => {
  it("routes adaptively, breaks between sections, and scores", () => {
    const db = freshDb();
    const id = createTest(db, 1, "full", ["RW", "MATH"]);
    let t = getTest(db, 1, id)!;
    expect(t.sections).toEqual(["RW", "MATH"]);

    // RW module 1: strong → hard module 2
    startModule(db, t.current_module_id!);
    answerModule(db, t.current_module_id!, 22);
    t = submitModule(db, 1, id, t.current_module_id!);
    const rw2 = getModule(db, t.current_module_id!)!;
    expect(rw2.stage).toBe(2);
    expect(rw2.level).toBe("hard");
    expect(rw2.section).toBe("RW");

    startModule(db, rw2.id);
    answerModule(db, rw2.id, 20);
    t = submitModule(db, 1, id, rw2.id);
    expect(t.phase).toBe("break");

    endBreak(db, 1, id);
    t = getTest(db, 1, id)!;
    const m1 = getModule(db, t.current_module_id!)!;
    expect(m1.section).toBe("MATH");

    // Math module 1: weak → easy module 2
    startModule(db, m1.id);
    answerModule(db, m1.id, 5);
    t = submitModule(db, 1, id, m1.id);
    const m2 = getModule(db, t.current_module_id!)!;
    expect(m2.level).toBe("easy");
    answerModule(db, m2.id, 10);
    t = submitModule(db, 1, id, m2.id);

    expect(t.phase).toBe("done");
    expect(t.rw_score).toBeGreaterThan(t.math_score!);
    expect(t.math_score!).toBeLessThanOrEqual(EASY_ROUTE_CAP);
    for (const s of [t.rw_score!, t.math_score!]) {
      expect(s).toBeGreaterThanOrEqual(200);
      expect(s).toBeLessThanOrEqual(800);
    }
    // No question repeats within the test.
    const all = getModules(db, id).flatMap((m) => m.question_ids);
    expect(new Set(all).size).toBe(all.length);
    // Answers were recorded as attempts.
    const n = (db.prepare("SELECT COUNT(*) AS n FROM attempts WHERE context = 'test'").get() as { n: number }).n;
    expect(n).toBe(all.length);
  });

  it("auto-submits a module whose time ran out", () => {
    const db = freshDb();
    const id = createTest(db, 1, "module", ["MATH"]);
    const t = getTest(db, 1, id)!;
    const start = new Date("2026-09-22T10:00:00Z");
    startModule(db, t.current_module_id!, start);
    expect(autoSubmitExpired(db, 1, id, new Date("2026-09-22T10:20:00Z"))).toBe(false);
    expect(autoSubmitExpired(db, 1, id, new Date("2026-09-22T10:40:00Z"))).toBe(true);
    expect(getTest(db, 1, id)!.phase).toBe("done");
  });

  it("section tests have two modules and no break", () => {
    const db = freshDb();
    const id = createTest(db, 1, "section", ["MATH"]);
    let t = getTest(db, 1, id)!;
    answerModule(db, t.current_module_id!, 15);
    t = submitModule(db, 1, id, t.current_module_id!);
    expect(t.phase).toBe("module");
    t = submitModule(db, 1, id, t.current_module_id!);
    expect(t.phase).toBe("done");
    expect(t.math_score).not.toBeNull();
    expect(t.rw_score).toBeNull();
  });

  it("caps scores on the easier route", () => {
    const perfect = Array.from({ length: 44 }, () => ({ difficulty: 3, correct: true }));
    expect(scoreSection(perfect, "hard")!.score).toBeGreaterThan(EASY_ROUTE_CAP);
    expect(scoreSection(perfect, "easy")!.score).toBe(EASY_ROUTE_CAP);
  });
});
