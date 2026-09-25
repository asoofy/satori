import { describe, expect, it } from "vitest";
import type { z } from "zod";
import type { AiProvider } from "@/lib/ai";
import { approveQuestion, generateBatch, jaccard, rejectQuestion, reviewQueue, shingles } from "@/lib/ai-generator";
import { builtInLesson, buildCustomLesson } from "@/lib/custom-lessons";
import { openDb } from "@/lib/db";
import { exportBank, importQuestions, parseCsv, parseImport } from "@/lib/import";
import { allLessons, parseLessonFile } from "@/lib/lessons";
import { classifySkill, mapOpenSat } from "@/lib/opensat";
import { seedDatabase } from "@/lib/seed";
import { SKILLS } from "@/lib/taxonomy";
import { blankOut, drillQuestions, dueCards, loadVocab, reviewCard, sm2 } from "@/lib/vocab";

function freshDb() {
  const db = openDb(":memory:");
  seedDatabase(db);
  return db;
}

/* ---------------- Import / export ---------------- */

describe("CSV parsing", () => {
  it("handles quotes, escaped quotes, commas and newlines inside fields", () => {
    const rows = parseCsv('a,b,c\n"x, y","he said ""hi""","line1\nline2"\r\n1,2,3\n');
    expect(rows).toEqual([
      ["a", "b", "c"],
      ["x, y", 'he said "hi"', "line1\nline2"],
      ["1", "2", "3"],
    ]);
  });
});

const CSV_HEADER = "id,section,skill,difficulty,type,passage_md,stem_md,choice_a,choice_b,choice_c,choice_d,answer,explanation_md,note_a,note_b,note_c,note_d,tags,source,license";

describe("import", () => {
  it("validates CSV rows and reports errors by row number", () => {
    const csv = [
      CSV_HEADER,
      'imp-1,RW,transitions,2,mcq,"Rain fell. ______ the game went on.",Which choice completes the text?,However,Therefore,For example,Similarly,A,Contrast.,,wrong b,wrong c,wrong d,a;b,,',
      "imp-2,MATH,linear-equations-one-var,1,spr,,If x+1=3 what is x?,,,,,2,Subtract 1.,,,,,,,",
      "imp-3,RW,not-a-skill,2,mcq,,Q?,a,b,c,d,A,E.,,,,,,,",
      "imp-4,MATH,percentages,5,spr,,Q?,,,,,1,E.,,,,,,,",
    ].join("\n");
    const r = parseImport("set.csv", csv, { source: "teacher-set", license: "CC-BY-4.0" });
    expect(r.format).toBe("csv");
    expect(r.total).toBe(4);
    expect(r.valid.map((q) => q.id)).toEqual(["imp-1", "imp-2"]);
    expect(r.errors.map((e) => e.row)).toEqual([4, 5]);
    expect(r.valid[0].tags).toEqual(["a", "b"]);
    expect(r.valid[0].source).toBe("teacher-set");
  });

  it("requires a source and license", () => {
    const r = parseImport("x.json", JSON.stringify([{ id: "j-1", section: "MATH", skill: "percentages", difficulty: 1, type: "spr", stem_md: "Q", answer: "3", explanation_md: "E" }]), {
      source: "",
      license: "",
    });
    expect(r.valid).toHaveLength(0);
    expect(r.errors[0].message).toMatch(/source and a license/);
  });

  it("round-trips: export → import validates cleanly", () => {
    const db = freshDb();
    const exported = exportBank(db, { origin: "original" });
    expect(exported.questions.length).toBe(196);
    const r = parseImport("bank.json", JSON.stringify(exported), { source: "", license: "" });
    expect(r.errors).toEqual([]);
    expect(r.valid).toHaveLength(196);
    const db2 = openDb(":memory:");
    seedDatabase(db2);
    const res = importQuestions(db2, r.valid);
    expect(res.updated).toBe(196);
    expect(res.inserted).toBe(0);
  });

  it("reports bad JSON", () => {
    const r = parseImport("x.json", "{nope", { source: "s", license: "l" });
    expect(r.errors[0].message).toMatch(/Invalid JSON/);
  });
});

/* ---------------- OpenSAT ---------------- */

describe("OpenSAT adapter", () => {
  it("maps a question and guesses its skill", () => {
    const m = mapOpenSat(
      {
        id: "abc123",
        domain: "Expression of Ideas",
        question: {
          paragraph: "Rain fell all day. ______ the parade continued.",
          question: "Which choice completes the text with the most logical transition?",
          choices: { A: "However,", B: "Therefore,", C: "For example,", D: "Similarly," },
          correct_answer: "A",
          explanation: "Contrast.",
        },
      },
      "RW",
    );
    expect(m.ok).toBe(true);
    if (m.ok) {
      expect(m.q.skill).toBe("transitions");
      expect(m.q.source).toBe("opensat");
      expect(m.q.license).toMatch(/unknown/);
      expect(m.q.id).toBe("opensat-abc123");
    }
  });

  it("rejects unknown domains", () => {
    const m = mapOpenSat({ id: 1, domain: "Poetry", question: { question: "Q", correct_answer: "A" } }, "RW");
    expect(m.ok).toBe(false);
  });

  it("classifies boundaries vs. form questions by their choices", () => {
    expect(classifySkill("conventions", "Which choice…", "", ["spring,", "spring;", "spring", "spring:"])).toBe("boundaries");
    expect(classifySkill("conventions", "Which choice…", "", ["include", "includes", "have included", "are including"])).toBe("form-structure-sense");
    expect(classifySkill("psda", "What is the probability that…", "", [])).toBe("probability");
    expect(classifySkill("geometry-trig", "A circle has radius 4…", "", [])).toBe("circles");
  });
});

/* ---------------- Lessons ---------------- */

describe("lessons", () => {
  it("parses multi-lesson files", () => {
    const ls = parseLessonFile("---\nslug: a\ntitle: A\nsummary: s\n---\nBody A\n\n## x\n---\nslug: b\nskill: transitions\ntitle: \"B: two\"\n---\nBody B\n");
    expect(ls.map((l) => l.slug)).toEqual(["a", "b"]);
    expect(ls[1].title).toBe("B: two");
    expect(ls[1].skill).toBe("transitions");
    expect(ls[0].body).toContain("## x");
  });

  it("has a lesson for every skill, plus the Desmos lesson", () => {
    const lessons = allLessons();
    for (const s of SKILLS) expect(lessons.some((l) => l.skill === s.id), s.id).toBe(true);
    expect(lessons.some((l) => l.slug === "how-to-use-desmos")).toBe(true);
    expect(new Set(lessons.map((l) => l.slug)).size).toBe(lessons.length);
    for (const l of lessons) expect(l.body.length, l.slug).toBeGreaterThan(200);
  });

  it("builds a custom lesson with a practice set from the library", async () => {
    const db = freshDb();
    const lesson = builtInLesson(db, 1, ["transitions", "circles"]);
    expect(lesson.title).toContain("Transitions");
    expect(lesson.body_md).toContain("## Circles");
    const id = await buildCustomLesson(db, 1, ["transitions", "circles"], null);
    const row = db.prepare("SELECT set_id, source FROM custom_lessons WHERE id = ?").get(id) as { set_id: number; source: string };
    expect(row.source).toBe("built-in");
    const set = db.prepare("SELECT question_ids_json FROM practice_sets WHERE id = ?").get(row.set_id) as { question_ids_json: string };
    expect(JSON.parse(set.question_ids_json)).toHaveLength(10);
  });
});

/* ---------------- Vocab ---------------- */

describe("vocab", () => {
  it("loads the word list with no errors and blanks every example", () => {
    const { words, errors } = loadVocab();
    expect(errors).toEqual([]);
    expect(words.length).toBeGreaterThanOrEqual(100);
    for (const w of words) expect(blankOut(w.example, w.word), w.word).toContain("______");
  });

  it("blanks simple inflections", () => {
    expect(blankOut("The author asserts that…", "assert")).toBe("The author ______ that…");
  });

  it("follows SM-2 intervals", () => {
    let s = { ease: 2.5, interval: 0, reps: 0, lapses: 0 };
    s = sm2(s, 4);
    expect(s.interval).toBe(1);
    s = sm2(s, 4);
    expect(s.interval).toBe(6);
    s = sm2(s, 4);
    expect(s.interval).toBe(15);
    s = sm2(s, 1);
    expect(s).toMatchObject({ interval: 1, reps: 0, lapses: 1 });
    expect(sm2({ ease: 1.3, interval: 1, reps: 0, lapses: 0 }, 0).ease).toBe(1.3);
  });

  it("limits new cards per day and schedules reviews", () => {
    const db = freshDb();
    const day = "2026-09-22";
    const first = dueCards(db, 1, day);
    expect(first).toHaveLength(10);
    expect(first.every((c) => c.isNew)).toBe(true);
    for (const c of first) reviewCard(db, 1, c.id, 4, day);
    expect(dueCards(db, 1, day)).toHaveLength(0);
    const tomorrow = dueCards(db, 1, "2026-09-23");
    expect(tomorrow.filter((c) => !c.isNew)).toHaveLength(10);
  });

  it("builds drills with four distinct same-part-of-speech choices", () => {
    const db = freshDb();
    const qs = drillQuestions(db, 1, 10);
    expect(qs).toHaveLength(10);
    for (const q of qs) {
      expect(new Set(q.choices).size).toBe(4);
      expect(q.sentence).toContain("______");
      expect(q.answer).toBeGreaterThanOrEqual(0);
    }
  });
});

/* ---------------- AI generator (fake provider) ---------------- */

function fakeProvider(batch: unknown, solverAnswers: string[]): AiProvider {
  let solveCall = 0;
  return {
    id: "fake:test",
    async json<T extends z.ZodType>({ schema, prompt }: { schema: T; prompt: string }): Promise<z.infer<T>> {
      const isSolve = !prompt.startsWith("Write ");
      const out = isSolve ? { answer: solverAnswers[solveCall++] ?? "A", ambiguous: false, issues: "" } : batch;
      return schema.parse(out);
    },
    async *chat() {
      return;
    },
  };
}

const genQ = (stem: string, answer = "B") => ({
  type: "mcq" as const,
  passage_md: `A brand-new passage about ${stem} with unique words ${stem.split("").reverse().join("")}.`,
  stem_md: `Which choice completes the text with the most logical transition about ${stem}?`,
  choices: { A: "However,", B: "Therefore,", C: "For example,", D: "Similarly," },
  answer,
  explanation_md: "Cause and effect, so Therefore.",
  distractor_notes: { A: "No contrast.", B: "", C: "Not an example.", D: "Not similar." },
});

describe("AI generator pipeline", () => {
  it("keeps only questions the independent solver agrees with, as drafts", async () => {
    const db = freshDb();
    const provider = fakeProvider({ questions: [genQ("volcanoes"), genQ("glaciers"), genQ("tides")] }, ["B", "C", "B"]);
    const report = await generateBatch(db, provider, { skill: "transitions", difficulty: 2, count: 3 });
    expect(report.saved).toHaveLength(2);
    expect(report.rejected).toHaveLength(1);
    expect(report.rejected[0].reason).toMatch(/Solver answered C/);
    const queue = reviewQueue(db);
    expect(queue).toHaveLength(2);
    // Drafts aren't in the active bank until approved.
    const active = () => (db.prepare("SELECT COUNT(*) AS n FROM questions WHERE source = 'ai:fake:test' AND status = 'active'").get() as { n: number }).n;
    expect(active()).toBe(0);
    approveQuestion(db, queue[0].id);
    rejectQuestion(db, queue[1].id);
    expect(active()).toBe(1);
    expect(reviewQueue(db)).toHaveLength(0);
  });

  it("rejects near-duplicates of existing questions", async () => {
    const db = freshDb();
    const existing = db.prepare("SELECT passage_md, stem_md FROM questions WHERE id = 'rw-tr-01'").get() as { passage_md: string; stem_md: string };
    const dup = { ...genQ("x"), passage_md: existing.passage_md, stem_md: existing.stem_md };
    const report = await generateBatch(db, fakeProvider({ questions: [dup] }, ["B"]), { skill: "transitions", difficulty: 1, count: 1 });
    expect(report.saved).toHaveLength(0);
    expect(report.rejected[0].reason).toMatch(/similar/);
  });

  it("rejects questions that fail schema validation", async () => {
    const db = freshDb();
    const bad = { ...genQ("y"), choices: { A: "Same", B: "Same", C: "Other", D: "Another" } };
    const report = await generateBatch(db, fakeProvider({ questions: [bad] }, ["B"]), { skill: "transitions", difficulty: 1, count: 1 });
    expect(report.rejected[0].reason).toMatch(/validation/);
  });

  it("measures text similarity", () => {
    expect(jaccard(shingles("the quick brown fox jumps"), shingles("the quick brown fox jumps"))).toBe(1);
    expect(jaccard(shingles("the quick brown fox jumps"), shingles("a slow green turtle walks"))).toBe(0);
  });
});
