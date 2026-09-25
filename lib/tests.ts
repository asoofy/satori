/**
 * Practice test engine in the digital SAT format.
 *
 * - Reading & Writing: 2 modules × 27 questions, 32 minutes each.
 * - Math: 2 modules × 22 questions, 35 minutes each.
 * - A 10-minute break between the sections of a full test.
 * - Adaptive routing: module 2 of a section is easier or harder depending on the number
 *   of correct answers in module 1.
 * - Modules are assembled from the bank by a domain and difficulty blueprint.
 */
import type { DB } from "@/lib/db";
import { tx } from "@/lib/db/tx";
import { grade } from "@/lib/grading";
import { getQuestionsByIds } from "@/lib/repo/questions";
import { recordAttempt } from "@/lib/repo/progress";
import { estimateSection } from "@/lib/scoring";
import { SKILL_BY_ID, type Section } from "@/lib/taxonomy";

export type TestKind = "full" | "section" | "module";
export type ModuleLevel = "std" | "easy" | "hard";

export const MODULE_SIZE: Record<Section, number> = { RW: 27, MATH: 22 };
export const MODULE_SECONDS: Record<Section, number> = { RW: 32 * 60, MATH: 35 * 60 };
export const BREAK_SECONDS = 10 * 60;
/** Correct answers in module 1 needed to be routed to the harder module 2. */
export const ROUTE_THRESHOLD: Record<Section, number> = { RW: 16, MATH: 13 };
/** A section routed to the easier module 2 can't score above this. */
export const EASY_ROUTE_CAP = 600;

/** Questions per domain in one module, in the order they appear on the test. */
export const BLUEPRINT: Record<Section, { domain: string; n: number }[]> = {
  RW: [
    { domain: "craft-structure", n: 7 },
    { domain: "information-ideas", n: 7 },
    { domain: "conventions", n: 7 },
    { domain: "expression-ideas", n: 6 },
  ],
  MATH: [
    { domain: "algebra", n: 8 },
    { domain: "advanced-math", n: 7 },
    { domain: "psda", n: 4 },
    { domain: "geometry-trig", n: 3 },
  ],
};

/** Share of easy / medium / hard questions per module level. */
export const DIFFICULTY_MIX: Record<ModuleLevel, [number, number, number]> = {
  std: [0.33, 0.34, 0.33],
  easy: [0.45, 0.4, 0.15],
  hard: [0.15, 0.4, 0.45],
};

/** Split n into counts per difficulty using the largest-remainder method. */
export function splitCounts(n: number, mix: [number, number, number]): [number, number, number] {
  const raw = mix.map((p) => p * n);
  const out = raw.map(Math.floor) as [number, number, number];
  let left = n - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, rem: r - Math.floor(r) })).sort((a, b) => b.rem - a.rem);
  for (const { i } of order) {
    if (left-- <= 0) break;
    out[i]++;
  }
  return out;
}

interface Candidate {
  id: string;
  difficulty: number;
  type: "mcq" | "spr";
  skill_id: string;
}

/**
 * Pick `n` questions of a domain and difficulty. Prefers questions this profile has
 * never seen and hasn't met in another test; relaxes the difficulty if the bank runs short.
 */
function pickQuestions(db: DB, profileId: number, domain: string, difficulty: number, n: number, exclude: Set<string>, sprShare: number): Candidate[] {
  if (n <= 0) return [];
  const query = (diffs: number[]) =>
    db
      .prepare(
        `SELECT q.id, q.difficulty, q.type, q.skill_id,
           EXISTS(SELECT 1 FROM attempts a WHERE a.profile_id = $pid AND a.question_id = q.id) AS seen,
           EXISTS(SELECT 1 FROM test_answers ta JOIN test_modules tm ON tm.id = ta.module_id JOIN tests t ON t.id = tm.test_id
                  WHERE t.profile_id = $pid AND ta.question_id = q.id) AS tested
         FROM questions q
         WHERE q.domain = $domain AND q.status = 'active' AND q.difficulty IN (${diffs.join(",")})
         ORDER BY tested, seen, RANDOM()
         LIMIT 400`,
      )
      .all({ $pid: profileId, $domain: domain }) as unknown as (Candidate & { seen: number; tested: number })[];

  const chosen: Candidate[] = [];
  const wantSpr = Math.round(n * sprShare);
  const take = (pool: Candidate[], filter: (c: Candidate) => boolean, limit: number) => {
    for (const c of pool) {
      if (chosen.length >= n || limit <= 0) break;
      if (exclude.has(c.id) || !filter(c)) continue;
      chosen.push(c);
      exclude.add(c.id);
      limit--;
    }
  };
  const exact = query([difficulty]);
  if (wantSpr > 0) take(exact, (c) => c.type === "spr", wantSpr);
  take(exact, () => true, n);
  if (chosen.length < n) {
    const near = query([difficulty - 1, difficulty + 1].filter((d) => d >= 1 && d <= 3));
    take(near, () => true, n);
  }
  if (chosen.length < n) take(query([1, 2, 3]), () => true, n);
  return chosen;
}

/** Assemble one module's question list by the blueprint and difficulty mix. */
export function assembleModule(db: DB, profileId: number, section: Section, level: ModuleLevel, exclude: Set<string>): string[] {
  const out: Candidate[] = [];
  for (const { domain, n } of BLUEPRINT[section]) {
    const [e, m, h] = splitCounts(n, DIFFICULTY_MIX[level]);
    const sprShare = section === "MATH" ? 0.25 : 0;
    const part = [
      ...pickQuestions(db, profileId, domain, 1, e, exclude, sprShare),
      ...pickQuestions(db, profileId, domain, 2, m, exclude, sprShare),
      ...pickQuestions(db, profileId, domain, 3, h, exclude, sprShare),
    ];
    if (section === "RW") {
      // R&W questions appear grouped by skill, in taxonomy order, easier first within a skill.
      part.sort((a, b) => SKILL_BY_ID.get(a.skill_id)!.sort - SKILL_BY_ID.get(b.skill_id)!.sort || a.difficulty - b.difficulty);
    }
    out.push(...part);
  }
  // Math questions get harder through the module, with domains mixed.
  if (section === "MATH") out.sort((a, b) => a.difficulty - b.difficulty || a.id.localeCompare(b.id));
  return out.map((c) => c.id);
}

export interface TestRow {
  id: number;
  profile_id: number;
  kind: TestKind;
  sections: Section[];
  phase: "module" | "break" | "done" | "abandoned";
  current_module_id: number | null;
  break_ends_at: string | null;
  rw_score: number | null;
  math_score: number | null;
  rw_margin: number | null;
  math_margin: number | null;
  created_at: string;
  completed_at: string | null;
}

export interface ModuleRow {
  id: number;
  test_id: number;
  section: Section;
  stage: number;
  level: ModuleLevel;
  question_ids: string[];
  time_limit_s: number;
  started_at: string | null;
  ends_at: string | null;
  submitted_at: string | null;
  correct_count: number | null;
}

export interface AnswerRow {
  module_id: number;
  question_id: string;
  response: string | null;
  flagged: number;
  eliminated: string[];
  highlights: { start: number; end: number }[];
  note: string;
  time_ms: number;
  correct: number | null;
}

type RawTest = Omit<TestRow, "sections"> & { sections_json: string };
type RawModule = Omit<ModuleRow, "question_ids"> & { question_ids_json: string };
type RawAnswer = Omit<AnswerRow, "eliminated" | "highlights"> & { eliminated_json: string; highlights_json: string };

const toTest = (r: RawTest): TestRow => ({ ...r, sections: JSON.parse(r.sections_json) as Section[] });
const toModule = (r: RawModule): ModuleRow => ({ ...r, question_ids: JSON.parse(r.question_ids_json) as string[] });
const toAnswer = (r: RawAnswer): AnswerRow => ({ ...r, eliminated: JSON.parse(r.eliminated_json), highlights: JSON.parse(r.highlights_json) });

export function getTest(db: DB, profileId: number, id: number): TestRow | null {
  const r = db.prepare("SELECT * FROM tests WHERE id = ? AND profile_id = ?").get(id, profileId) as unknown as RawTest | undefined;
  return r ? toTest(r) : null;
}

export function listTests(db: DB, profileId: number): TestRow[] {
  return (db.prepare("SELECT * FROM tests WHERE profile_id = ? ORDER BY id DESC").all(profileId) as unknown as RawTest[]).map(toTest);
}

export function getModules(db: DB, testId: number): ModuleRow[] {
  return (db.prepare("SELECT * FROM test_modules WHERE test_id = ? ORDER BY id").all(testId) as unknown as RawModule[]).map(toModule);
}

export function getModule(db: DB, moduleId: number): ModuleRow | null {
  const r = db.prepare("SELECT * FROM test_modules WHERE id = ?").get(moduleId) as unknown as RawModule | undefined;
  return r ? toModule(r) : null;
}

export function getAnswers(db: DB, moduleId: number): Map<string, AnswerRow> {
  const rows = (db.prepare("SELECT * FROM test_answers WHERE module_id = ?").all(moduleId) as unknown as RawAnswer[]).map(toAnswer);
  return new Map(rows.map((r) => [r.question_id, r]));
}

function usedInTest(db: DB, testId: number): Set<string> {
  return new Set(getModules(db, testId).flatMap((m) => m.question_ids));
}

function createModule(db: DB, profileId: number, testId: number, section: Section, stage: number, level: ModuleLevel): number {
  const ids = assembleModule(db, profileId, section, level, usedInTest(db, testId));
  const r = db
    .prepare("INSERT INTO test_modules (test_id, section, stage, level, question_ids_json, time_limit_s) VALUES (?, ?, ?, ?, ?, ?)")
    .run(testId, section, stage, level, JSON.stringify(ids), MODULE_SECONDS[section]);
  return Number(r.lastInsertRowid);
}

export function createTest(db: DB, profileId: number, kind: TestKind, sections: Section[]): number {
  if (!sections.length) throw new Error("A test needs at least one section.");
  if (kind === "full") sections = ["RW", "MATH"];
  if (kind !== "full") sections = [sections[0]];
  return tx(db, () => {
    const r = db.prepare("INSERT INTO tests (profile_id, kind, sections_json) VALUES (?, ?, ?)").run(profileId, kind, JSON.stringify(sections));
    const testId = Number(r.lastInsertRowid);
    const m = createModule(db, profileId, testId, sections[0], 1, "std");
    db.prepare("UPDATE tests SET current_module_id = ? WHERE id = ?").run(m, testId);
    return testId;
  });
}

export function startModule(db: DB, moduleId: number, now = new Date()): ModuleRow {
  const m = getModule(db, moduleId)!;
  if (!m.started_at) {
    db.prepare("UPDATE test_modules SET started_at = ?, ends_at = ? WHERE id = ?").run(
      now.toISOString(),
      new Date(now.getTime() + m.time_limit_s * 1000).toISOString(),
      moduleId,
    );
  }
  return getModule(db, moduleId)!;
}

export interface AnswerPatch {
  response?: string | null;
  flagged?: boolean;
  eliminated?: string[];
  highlights?: { start: number; end: number }[];
  note?: string;
  addTimeMs?: number;
}

export function saveAnswer(db: DB, moduleId: number, questionId: string, p: AnswerPatch): void {
  const m = getModule(db, moduleId);
  if (!m || m.submitted_at || !m.question_ids.includes(questionId)) return;
  db.prepare("INSERT OR IGNORE INTO test_answers (module_id, question_id) VALUES (?, ?)").run(moduleId, questionId);
  const sets: string[] = [];
  const params: (string | number | null)[] = [];
  if (p.response !== undefined) {
    sets.push("response = ?");
    params.push(p.response === "" ? null : p.response);
  }
  if (p.flagged !== undefined) {
    sets.push("flagged = ?");
    params.push(p.flagged ? 1 : 0);
  }
  if (p.eliminated !== undefined) {
    sets.push("eliminated_json = ?");
    params.push(JSON.stringify(p.eliminated));
  }
  if (p.highlights !== undefined) {
    sets.push("highlights_json = ?");
    params.push(JSON.stringify(p.highlights));
  }
  if (p.note !== undefined) {
    sets.push("note = ?");
    params.push(p.note.slice(0, 2000));
  }
  if (p.addTimeMs) {
    sets.push("time_ms = time_ms + ?");
    params.push(Math.max(0, Math.min(Math.round(p.addTimeMs), 60 * 60 * 1000)));
  }
  if (!sets.length) return;
  db.prepare(`UPDATE test_answers SET ${sets.join(", ")} WHERE module_id = ? AND question_id = ?`).run(...params, moduleId, questionId);
}

/** Section score from the test's own answers (unanswered counts as wrong), capped on the easier route. */
export function scoreSection(answers: { difficulty: number; correct: boolean }[], route: ModuleLevel | null): { score: number; margin: number } | null {
  const est = estimateSection(answers.map((a) => ({ difficulty: a.difficulty, correct: a.correct, days_ago: 0 })));
  if (!est) return null;
  return { score: route === "easy" ? Math.min(est.score, EASY_ROUTE_CAP) : est.score, margin: est.margin };
}

function finalize(db: DB, test: TestRow): void {
  const mods = getModules(db, test.id);
  const bySection: Record<string, { difficulty: number; correct: boolean }[]> = { RW: [], MATH: [] };
  const route: Record<string, ModuleLevel | null> = { RW: null, MATH: null };
  for (const m of mods) {
    const answers = getAnswers(db, m.id);
    const qs = getQuestionsByIds(db, m.question_ids);
    for (const q of qs) bySection[m.section].push({ difficulty: q.difficulty, correct: answers.get(q.id)?.correct === 1 });
    if (m.stage === 2) route[m.section] = m.level;
  }
  const rw = test.sections.includes("RW") ? scoreSection(bySection.RW, route.RW) : null;
  const math = test.sections.includes("MATH") ? scoreSection(bySection.MATH, route.MATH) : null;
  db.prepare(
    `UPDATE tests SET phase = 'done', current_module_id = NULL, completed_at = datetime('now'),
       rw_score = ?, rw_margin = ?, math_score = ?, math_margin = ? WHERE id = ?`,
  ).run(rw?.score ?? null, rw?.margin ?? null, math?.score ?? null, math?.margin ?? null, test.id);
}

/**
 * Grade and close a module, record the answers as attempts, then move the test on:
 * adaptive module 2, a break before the next section, or the score report.
 */
export function submitModule(db: DB, profileId: number, testId: number, moduleId: number, now = new Date()): TestRow {
  return tx(db, () => {
    const test = getTest(db, profileId, testId);
    const m = getModule(db, moduleId);
    if (!test || !m || m.test_id !== testId) throw new Error("Test or module not found.");
    if (m.submitted_at) return test;
    const answers = getAnswers(db, moduleId);
    const qs = getQuestionsByIds(db, m.question_ids);
    let correct = 0;
    for (const q of qs) {
      const a = answers.get(q.id);
      const ok = !!a?.response && grade(q, a.response);
      if (ok) correct++;
      db.prepare("INSERT OR IGNORE INTO test_answers (module_id, question_id) VALUES (?, ?)").run(moduleId, q.id);
      db.prepare("UPDATE test_answers SET correct = ? WHERE module_id = ? AND question_id = ?").run(ok ? 1 : 0, moduleId, q.id);
      if (a?.response) {
        recordAttempt(db, { profileId, questionId: q.id, response: a.response, correct: ok, timeMs: a.time_ms, eliminated: a.eliminated, context: "test" });
      }
    }
    db.prepare("UPDATE test_modules SET submitted_at = ?, correct_count = ? WHERE id = ?").run(now.toISOString(), correct, moduleId);

    if (test.kind !== "module" && m.stage === 1) {
      const level: ModuleLevel = correct >= ROUTE_THRESHOLD[m.section] ? "hard" : "easy";
      const next = createModule(db, profileId, testId, m.section, 2, level);
      db.prepare("UPDATE tests SET current_module_id = ? WHERE id = ?").run(next, testId);
    } else {
      const idx = test.sections.indexOf(m.section);
      if (test.kind === "full" && idx < test.sections.length - 1) {
        db.prepare("UPDATE tests SET phase = 'break', current_module_id = NULL, break_ends_at = ? WHERE id = ?").run(
          new Date(now.getTime() + BREAK_SECONDS * 1000).toISOString(),
          testId,
        );
      } else {
        finalize(db, test);
      }
    }
    return getTest(db, profileId, testId)!;
  });
}

/** Leave the break and set up module 1 of the next section. */
export function endBreak(db: DB, profileId: number, testId: number): void {
  tx(db, () => {
    const test = getTest(db, profileId, testId);
    if (!test || test.phase !== "break") return;
    const done = new Set(getModules(db, testId).map((m) => m.section));
    const next = test.sections.find((s) => !done.has(s));
    if (!next) return finalize(db, test);
    const m = createModule(db, profileId, testId, next, 1, "std");
    db.prepare("UPDATE tests SET phase = 'module', current_module_id = ?, break_ends_at = NULL WHERE id = ?").run(m, testId);
  });
}

/** If the current module's time ran out (e.g. the tab was closed), submit it now. */
export function autoSubmitExpired(db: DB, profileId: number, testId: number, now = new Date()): boolean {
  let changed = false;
  for (let guard = 0; guard < 6; guard++) {
    const test = getTest(db, profileId, testId);
    if (!test || test.phase !== "module" || !test.current_module_id) break;
    const m = getModule(db, test.current_module_id)!;
    if (!m.ends_at || new Date(m.ends_at).getTime() + 5000 > now.getTime()) break;
    submitModule(db, profileId, testId, m.id, now);
    changed = true;
    // A freshly created module 2 hasn't started, so the loop stops there.
  }
  return changed;
}

export function abandonTest(db: DB, profileId: number, testId: number): void {
  db.prepare("UPDATE tests SET phase = 'abandoned', current_module_id = NULL WHERE id = ? AND profile_id = ? AND phase != 'done'").run(testId, profileId);
}

export const TEST_LABEL: Record<TestKind, string> = {
  full: "Full-length practice test",
  section: "Section test",
  module: "Single-module test",
};
