import type { DB } from "@/lib/db";
import type { Question } from "@/lib/question-schema";

export interface QuestionRow {
  id: string;
  section: "RW" | "MATH";
  domain: string;
  skill_id: string;
  difficulty: number;
  type: "mcq" | "spr";
  stem_md: string;
  passage_md: string | null;
  choices_json: string | null;
  answer: string;
  explanation_md: string;
  distractor_notes_json: string | null;
  tags_json: string;
  source: string;
  license: string;
  generator_id: string | null;
}

export function rowToQuestion(r: QuestionRow): Question {
  return {
    id: r.id,
    section: r.section,
    domain: r.domain,
    skill_id: r.skill_id,
    difficulty: r.difficulty as 1 | 2 | 3,
    type: r.type,
    stem_md: r.stem_md,
    passage_md: r.passage_md,
    choices: r.choices_json ? (JSON.parse(r.choices_json) as string[]) : null,
    answer: r.answer,
    explanation_md: r.explanation_md,
    distractor_notes: r.distractor_notes_json ? (JSON.parse(r.distractor_notes_json) as Record<string, string>) : null,
    tags: JSON.parse(r.tags_json) as string[],
    source: r.source,
    license: r.license,
    generator_id: r.generator_id,
  };
}

/** A question as shown to the student before answering (no key or explanation). */
export type PublicQuestion = Omit<Question, "answer" | "explanation_md" | "distractor_notes">;

export function toPublic(q: Question): PublicQuestion {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { answer, explanation_md, distractor_notes, ...rest } = q;
  return rest;
}

export function getQuestion(db: DB, id: string): Question | null {
  const r = db.prepare("SELECT * FROM questions WHERE id = ?").get(id) as QuestionRow | undefined;
  return r ? rowToQuestion(r) : null;
}

export function getQuestionsByIds(db: DB, ids: string[]): Question[] {
  if (ids.length === 0) return [];
  const rows = db
    .prepare(`SELECT * FROM questions WHERE id IN (${ids.map(() => "?").join(",")})`)
    .all(...ids) as unknown as QuestionRow[];
  const byId = new Map(rows.map((r) => [r.id, rowToQuestion(r)]));
  return ids.map((id) => byId.get(id)).filter((q): q is Question => !!q);
}

export type QuestionStatus = "unanswered" | "correct" | "incorrect";

export interface BankFilter {
  section?: "RW" | "MATH";
  domain?: string;
  skill?: string;
  difficulty?: 1 | 2 | 3;
  status?: "unanswered" | "incorrect" | "correct" | "saved";
  origin?: "original" | "generated";
  q?: string;
}

export interface BankItem {
  id: string;
  section: "RW" | "MATH";
  domain: string;
  skill_id: string;
  difficulty: number;
  type: "mcq" | "spr";
  preview: string;
  status: QuestionStatus;
  saved: boolean;
  attempts: number;
  generated: boolean;
}

/** Latest attempt per question for a profile. */
const LAST_ATTEMPT_CTE = `
  last AS (
    SELECT a.question_id, a.correct, cnt.n AS attempts
    FROM attempts a
    JOIN (SELECT question_id, MAX(id) AS last_id, COUNT(*) AS n FROM attempts WHERE profile_id = $pid GROUP BY question_id) cnt
      ON cnt.last_id = a.id
  )`;

function whereFor(f: BankFilter): { sql: string; params: Record<string, string | number> } {
  const clauses = ["q.status = 'active'"];
  const params: Record<string, string | number> = {};
  if (f.section) {
    clauses.push("q.section = $section");
    params.$section = f.section;
  }
  if (f.domain) {
    clauses.push("q.domain = $domain");
    params.$domain = f.domain;
  }
  if (f.skill) {
    clauses.push("q.skill_id = $skill");
    params.$skill = f.skill;
  }
  if (f.difficulty) {
    clauses.push("q.difficulty = $difficulty");
    params.$difficulty = f.difficulty;
  }
  if (f.origin === "original") clauses.push("q.generator_id IS NULL");
  if (f.origin === "generated") clauses.push("q.generator_id IS NOT NULL");
  if (f.status === "unanswered") clauses.push("last.question_id IS NULL");
  if (f.status === "incorrect") clauses.push("last.correct = 0");
  if (f.status === "correct") clauses.push("last.correct = 1");
  if (f.status === "saved") clauses.push("s.question_id IS NOT NULL");
  if (f.q) {
    clauses.push("(q.stem_md LIKE $q OR IFNULL(q.passage_md, '') LIKE $q)");
    params.$q = `%${f.q}%`;
  }
  return { sql: clauses.join(" AND "), params };
}

export function previewText(stem: string, passage: string | null): string {
  const src = passage && passage.length > 0 ? passage : stem;
  return src
    .replace(/\$\$[\s\S]*?\$\$/g, " [math] ")
    .replace(/\|[^\n]*\|/g, " ")
    .replace(/[*#>`]/g, "")
    .replace(/\\\$/g, "$")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

export function listBank(
  db: DB,
  profileId: number,
  f: BankFilter,
  page = 1,
  pageSize = 25,
): { items: BankItem[]; total: number } {
  const { sql, params } = whereFor(f);
  const base = `WITH ${LAST_ATTEMPT_CTE}
    SELECT %COLS% FROM questions q
    JOIN skills sk ON sk.id = q.skill_id
    LEFT JOIN last ON last.question_id = q.id
    LEFT JOIN saved s ON s.question_id = q.id AND s.profile_id = $pid
    WHERE ${sql}`;
  const all = { ...params, $pid: profileId };
  const total = (db.prepare(base.replace("%COLS%", "COUNT(*) AS n")).get(all) as { n: number }).n;
  const rows = db
    .prepare(
      base.replace(
        "%COLS%",
        "q.id, q.section, q.domain, q.skill_id, q.difficulty, q.type, q.stem_md, q.passage_md, q.generator_id, last.correct AS last_correct, IFNULL(last.attempts, 0) AS attempts, s.question_id IS NOT NULL AS is_saved",
      ) + ` ORDER BY q.section DESC, sk.sort, q.difficulty, (q.generator_id IS NOT NULL), q.id LIMIT $limit OFFSET $offset`,
    )
    .all({ ...all, $limit: pageSize, $offset: (page - 1) * pageSize }) as unknown as Array<{
    id: string;
    section: "RW" | "MATH";
    domain: string;
    skill_id: string;
    difficulty: number;
    type: "mcq" | "spr";
    stem_md: string;
    passage_md: string | null;
    generator_id: string | null;
    last_correct: number | null;
    attempts: number;
    is_saved: number;
  }>;
  return {
    total,
    items: rows.map((r) => ({
      id: r.id,
      section: r.section,
      domain: r.domain,
      skill_id: r.skill_id,
      difficulty: r.difficulty,
      type: r.type,
      preview: previewText(r.stem_md, r.passage_md),
      status: r.last_correct === null ? "unanswered" : r.last_correct ? "correct" : "incorrect",
      saved: !!r.is_saved,
      attempts: r.attempts,
      generated: !!r.generator_id,
    })),
  };
}

/** All ids matching a filter (for "practice these"), in a stable shuffled-by-id order. */
export function bankIds(db: DB, profileId: number, f: BankFilter, limit: number): string[] {
  const { sql, params } = whereFor(f);
  const rows = db
    .prepare(
      `WITH ${LAST_ATTEMPT_CTE}
       SELECT q.id FROM questions q
       LEFT JOIN last ON last.question_id = q.id
       LEFT JOIN saved s ON s.question_id = q.id AND s.profile_id = $pid
       WHERE ${sql}
       ORDER BY (last.question_id IS NOT NULL), RANDOM() LIMIT $limit`,
    )
    .all({ ...params, $pid: profileId, $limit: limit }) as { id: string }[];
  return rows.map((r) => r.id);
}

export function bankCounts(db: DB): { section: string; n: number }[] {
  return db
    .prepare("SELECT section, COUNT(*) AS n FROM questions WHERE status = 'active' GROUP BY section")
    .all() as { section: string; n: number }[];
}
