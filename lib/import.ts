/**
 * Import questions from JSON or CSV (for sets you have the rights to use), and export
 * the bank as JSON in the same format as content/questions/*.json.
 */
import type { DB } from "@/lib/db";
import { tx } from "@/lib/db/tx";
import { formatIssues, QuestionInput } from "@/lib/question-schema";
import { rowToQuestion, type QuestionRow } from "@/lib/repo/questions";
import { upsertQuestion } from "@/lib/seed";

/** RFC 4180 CSV: quoted fields, escaped quotes (""), newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

export const CSV_COLUMNS = [
  "id",
  "section",
  "skill",
  "difficulty",
  "type",
  "passage_md",
  "stem_md",
  "choice_a",
  "choice_b",
  "choice_c",
  "choice_d",
  "answer",
  "explanation_md",
  "note_a",
  "note_b",
  "note_c",
  "note_d",
  "tags",
  "source",
  "license",
] as const;

/** Turn one CSV record (by header name) into a question object for validation. */
function csvRecordToQuestion(rec: Record<string, string>): Record<string, unknown> {
  const type = (rec.type || "mcq").trim().toLowerCase();
  const answer = (rec.answer ?? "").trim();
  const choices = [rec.choice_a, rec.choice_b, rec.choice_c, rec.choice_d].map((c) => (c ?? "").trim());
  const notes: Record<string, string> = {};
  (["A", "B", "C", "D"] as const).forEach((L) => {
    const n = (rec[`note_${L.toLowerCase()}`] ?? "").trim();
    if (n && L !== answer.toUpperCase()) notes[L] = n;
  });
  return {
    id: rec.id?.trim(),
    section: rec.section?.trim().toUpperCase(),
    skill: rec.skill?.trim(),
    difficulty: Number(rec.difficulty),
    type,
    passage_md: rec.passage_md?.trim() || null,
    stem_md: rec.stem_md?.trim(),
    choices: type === "mcq" ? choices : null,
    answer: type === "mcq" ? answer.toUpperCase() : answer,
    explanation_md: rec.explanation_md?.trim(),
    distractor_notes: Object.keys(notes).length ? notes : null,
    tags: (rec.tags ?? "")
      .split(/[;|]/)
      .map((t) => t.trim())
      .filter(Boolean),
    source: rec.source?.trim() || undefined,
    license: rec.license?.trim() || undefined,
  };
}

export interface ImportReport {
  format: "json" | "csv";
  total: number;
  valid: QuestionInput[];
  errors: { row: number; id?: string; message: string }[];
}

/**
 * Parse and validate an import file. `defaults` supplies source/license for rows
 * that don't have their own; every question must end up with both.
 */
export function parseImport(filename: string, text: string, defaults: { source: string; license: string }): ImportReport {
  const isCsv = /\.csv$/i.test(filename) || (!text.trim().startsWith("{") && !text.trim().startsWith("["));
  const errors: ImportReport["errors"] = [];
  let raws: unknown[] = [];
  if (isCsv) {
    const rows = parseCsv(text);
    if (!rows.length) return { format: "csv", total: 0, valid: [], errors: [{ row: 0, message: "The file is empty." }] };
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const missing = ["id", "section", "skill", "difficulty", "stem_md", "answer", "explanation_md"].filter((c) => !header.includes(c));
    if (missing.length) return { format: "csv", total: 0, valid: [], errors: [{ row: 1, message: `Missing required column(s): ${missing.join(", ")}` }] };
    raws = rows.slice(1).map((r) => csvRecordToQuestion(Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""]))));
  } else {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch (e) {
      return { format: "json", total: 0, valid: [], errors: [{ row: 0, message: `Invalid JSON: ${(e as Error).message}` }] };
    }
    const obj = json as { questions?: unknown[]; source?: string; license?: string };
    raws = Array.isArray(json) ? json : Array.isArray(obj.questions) ? obj.questions : [];
    if (!Array.isArray(json)) {
      if (obj.source && !defaults.source) defaults = { ...defaults, source: obj.source };
      if (obj.license && !defaults.license) defaults = { ...defaults, license: obj.license };
    }
    if (!raws.length) errors.push({ row: 0, message: "Expected an array of questions or an object with a \"questions\" array." });
  }

  const seen = new Set<string>();
  const valid: QuestionInput[] = [];
  raws.forEach((raw, i) => {
    const row = isCsv ? i + 2 : i + 1; // CSV rows count the header line
    const r = QuestionInput.safeParse(raw);
    const id = (raw as { id?: string })?.id;
    if (!r.success) {
      errors.push({ row, id, message: formatIssues(r.error) });
      return;
    }
    const q = { ...r.data, source: r.data.source ?? defaults.source, license: r.data.license ?? defaults.license };
    if (!q.source || !q.license) {
      errors.push({ row, id, message: "Every question needs a source and a license (set them on the row or in the import form)." });
      return;
    }
    if (seen.has(q.id)) {
      errors.push({ row, id, message: "Duplicate id in this file." });
      return;
    }
    seen.add(q.id);
    valid.push(q);
  });
  return { format: isCsv ? "csv" : "json", total: raws.length, valid, errors };
}

/** Save validated questions. Existing ids are updated in place (progress is kept). */
export function importQuestions(db: DB, questions: QuestionInput[]): { inserted: number; updated: number } {
  let inserted = 0;
  let updated = 0;
  tx(db, () => {
    for (const q of questions) {
      const exists = db.prepare("SELECT 1 FROM questions WHERE id = ?").get(q.id);
      upsertQuestion(db, q);
      if (exists) updated++;
      else inserted++;
    }
  });
  return { inserted, updated };
}

/** The bank as a content file (same shape as content/questions/*.json). */
export function exportBank(db: DB, opts: { origin?: "original" | "generated" | "all"; includeImported?: boolean } = {}): {
  exported_at: string;
  questions: Record<string, unknown>[];
} {
  const where = ["status = 'active'"];
  if (opts.origin === "original") where.push("generator_id IS NULL");
  if (opts.origin === "generated") where.push("generator_id IS NOT NULL");
  if (!opts.includeImported) where.push("(source LIKE 'satori-%' OR source LIKE 'ai:%')");
  const rows = db.prepare(`SELECT * FROM questions WHERE ${where.join(" AND ")} ORDER BY section DESC, skill_id, difficulty, id`).all() as unknown as QuestionRow[];
  return {
    exported_at: new Date().toISOString(),
    questions: rows.map(rowToQuestion).map((q) => ({
      id: q.id,
      section: q.section,
      domain: q.domain,
      skill: q.skill_id,
      difficulty: q.difficulty,
      type: q.type,
      ...(q.passage_md ? { passage_md: q.passage_md } : {}),
      stem_md: q.stem_md,
      ...(q.choices ? { choices: q.choices } : {}),
      answer: q.answer,
      explanation_md: q.explanation_md,
      ...(q.distractor_notes ? { distractor_notes: q.distractor_notes } : {}),
      tags: q.tags,
      source: q.source,
      license: q.license,
    })),
  };
}
