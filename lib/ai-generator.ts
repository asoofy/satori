/**
 * AI question generator.
 *
 * 1. Ask the model for a batch of original questions for one skill and difficulty.
 * 2. Validate each against the question schema.
 * 3. Independent solve-check: a second request sees the question WITHOUT the key and
 *    answers it. Only questions where the solver agrees with the key (and doesn't flag
 *    the question as ambiguous) survive.
 * 4. Dedupe against the bank and the rest of the batch.
 * 5. Survivors go into the review queue (status 'review') until a person approves them.
 */
import { z } from "zod";
import type { AiProvider } from "@/lib/ai";
import type { DB } from "@/lib/db";
import { grade } from "@/lib/grading";
import { formatIssues, QuestionInput } from "@/lib/question-schema";
import { upsertQuestion } from "@/lib/seed";
import { SKILL_TIPS } from "@/lib/skill-tips";
import { SKILL_BY_ID } from "@/lib/taxonomy";

const Letters = z.object({ A: z.string(), B: z.string(), C: z.string(), D: z.string() });

export const GeneratedQuestion = z.object({
  type: z.enum(["mcq", "spr"]),
  passage_md: z.string().describe("Passage, notes, table or text pair. Empty string if the question has none."),
  stem_md: z.string(),
  choices: Letters.describe("Four answer choices for mcq. Empty strings for spr."),
  answer: z.string().describe("mcq: the letter A-D. spr: the numeric answer, e.g. 12 or 7/2; separate several accepted answers with |"),
  explanation_md: z.string(),
  distractor_notes: Letters.describe("Why each wrong choice is wrong (mcq). Use an empty string for the correct letter and for spr."),
});
export const GeneratedBatch = z.object({ questions: z.array(GeneratedQuestion) });

export const SolveResult = z.object({
  answer: z.string().describe("mcq: a letter A-D. spr: a number or fraction."),
  ambiguous: z.boolean().describe("true if more than one choice could be defended, none is right, or the question is flawed"),
  issues: z.string().describe("Any problems you noticed, or an empty string"),
});

const DIFFICULTY_TEXT = {
  1: "easy (most students answer correctly; one clear step)",
  2: "medium (requires careful reading or two to three steps)",
  3: "hard (subtle distractors, multi-step reasoning, or less familiar contexts)",
};

export function generationPrompts(skillId: string, difficulty: 1 | 2 | 3, count: number): { system: string; prompt: string } {
  const skill = SKILL_BY_ID.get(skillId)!;
  const math = skill.section === "MATH";
  const system = [
    "You write original practice questions for Satori, a free, open-source study app for the digital SAT.",
    "Every question must be your own original work. Never reproduce or closely paraphrase questions or passages from the College Board, Khan Academy, or any test-prep company, and never quote copyrighted literature at length.",
    "Match the digital SAT's style and difficulty. Use Markdown. Write math as LaTeX inside $...$ (display math in $$...$$). A literal dollar sign for money must be written \\$.",
    math
      ? "Math questions may be multiple-choice (type mcq) or student-produced response (type spr, about a quarter of questions). SPR answers must be exact numbers that fit in 5 characters (6 if negative)."
      : "Reading and Writing questions are always multiple-choice (type mcq) with one short passage (25-150 words) or a pair of short texts, and one question. Invented literary passages must say they were written for this collection; researchers and studies may be fictional but must not be attributed to real people.",
    "Each explanation walks through the solution step by step. Each wrong choice gets a one-sentence note saying why it's wrong, based on a realistic student mistake. Exactly one choice is correct.",
  ].join("\n\n");
  const prompt = [
    `Write ${count} different questions.`,
    `Section: ${math ? "Math" : "Reading and Writing"}`,
    `Domain: ${skill.domainName}`,
    `Skill: ${skill.name}`,
    `Difficulty: ${DIFFICULTY_TEXT[difficulty]}`,
    SKILL_TIPS[skillId] ? `What this skill tests (a tip we give students): ${SKILL_TIPS[skillId]}` : "",
    "Vary the topics, contexts and which letter is correct.",
  ]
    .filter(Boolean)
    .join("\n");
  return { system, prompt };
}

export function solvePrompt(q: { passage_md: string; stem_md: string; type: "mcq" | "spr"; choices: Record<string, string> }): string {
  const parts = [q.passage_md ? `Passage:\n${q.passage_md}` : "", `Question:\n${q.stem_md}`];
  if (q.type === "mcq") parts.push(["A", "B", "C", "D"].map((L) => `${L}. ${q.choices[L]}`).join("\n"));
  else parts.push("This is a student-produced response question: give a single number.");
  return parts.filter(Boolean).join("\n\n");
}

/** Word 3-gram shingles of normalized text. */
export function shingles(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/\$[^$]*\$/g, " math ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + 2 < words.length; i++) out.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  if (words.length < 3 && words.length) out.add(words.join(" "));
  return out;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

export const DUPLICATE_THRESHOLD = 0.6;

export interface BatchReport {
  provider: string;
  requested: number;
  saved: string[];
  rejected: { stem: string; reason: string }[];
}

export async function generateBatch(
  db: DB,
  provider: AiProvider,
  opts: { skill: string; difficulty: 1 | 2 | 3; count: number },
): Promise<BatchReport> {
  const skill = SKILL_BY_ID.get(opts.skill);
  if (!skill) throw new Error(`Unknown skill ${opts.skill}`);
  const count = Math.max(1, Math.min(10, Math.round(opts.count)));
  const { system, prompt } = generationPrompts(opts.skill, opts.difficulty, count);
  const batch = await provider.json({ system, prompt, schema: GeneratedBatch, maxTokens: 32000 });

  const report: BatchReport = { provider: provider.id, requested: count, saved: [], rejected: [] };
  const existing = (db.prepare("SELECT stem_md, passage_md FROM questions WHERE skill_id = ?").all(opts.skill) as { stem_md: string; passage_md: string | null }[]).map(
    (r) => shingles(`${r.passage_md ?? ""} ${r.stem_md}`),
  );
  const stamp = Date.now().toString(36);

  for (const [i, g] of batch.questions.slice(0, count).entries()) {
    const label = (g.stem_md || g.passage_md).slice(0, 90);
    const type = skill.section === "RW" ? "mcq" : g.type;
    const candidate = {
      id: `ai-${opts.skill}-${stamp}-${i}`,
      section: skill.section,
      skill: opts.skill,
      difficulty: opts.difficulty,
      type,
      stem_md: g.stem_md.trim(),
      passage_md: g.passage_md.trim() || null,
      choices: type === "mcq" ? (["A", "B", "C", "D"] as const).map((L) => g.choices[L].trim()) : null,
      answer: type === "mcq" ? g.answer.trim().toUpperCase().slice(0, 1) : g.answer.trim(),
      explanation_md: g.explanation_md.trim(),
      distractor_notes:
        type === "mcq"
          ? Object.fromEntries((["A", "B", "C", "D"] as const).filter((L) => L !== g.answer.trim().toUpperCase().slice(0, 1)).map((L) => [L, g.distractor_notes[L].trim()]))
          : null,
      tags: ["ai-generated"],
      source: `ai:${provider.id}`,
      license: "CC-BY-4.0",
    };
    const parsed = QuestionInput.safeParse(candidate);
    if (!parsed.success) {
      report.rejected.push({ stem: label, reason: `Failed validation: ${formatIssues(parsed.error)}` });
      continue;
    }
    if (type === "mcq" && Object.values(candidate.distractor_notes ?? {}).some((n) => !n)) {
      report.rejected.push({ stem: label, reason: "Missing a note for a wrong choice." });
      continue;
    }
    const sh = shingles(`${candidate.passage_md ?? ""} ${candidate.stem_md}`);
    if (existing.some((e) => jaccard(sh, e) >= DUPLICATE_THRESHOLD)) {
      report.rejected.push({ stem: label, reason: "Too similar to a question already in the bank or batch." });
      continue;
    }

    // Independent solve-check: the solver never sees the key.
    let solved: z.infer<typeof SolveResult>;
    try {
      solved = await provider.json({
        system: "You are an expert SAT tutor. Solve the question carefully and answer with the single best choice. Flag the question as ambiguous if it is flawed.",
        prompt: solvePrompt({ passage_md: g.passage_md, stem_md: g.stem_md, type, choices: g.choices }),
        schema: SolveResult,
        maxTokens: 16000,
      });
    } catch (e) {
      report.rejected.push({ stem: label, reason: `Solve-check failed: ${(e as Error).message}` });
      continue;
    }
    const agrees = grade({ type, answer: candidate.answer }, solved.answer.trim());
    if (!agrees || solved.ambiguous) {
      report.rejected.push({
        stem: label,
        reason: solved.ambiguous
          ? `Solver flagged it as ambiguous${solved.issues ? `: ${solved.issues}` : "."}`
          : `Solver answered ${solved.answer}, but the key says ${candidate.answer}.`,
      });
      continue;
    }

    upsertQuestion(db, { ...parsed.data, source: candidate.source, license: candidate.license });
    db.prepare("UPDATE questions SET status = 'review', review_notes_json = ? WHERE id = ?").run(
      JSON.stringify({ solver: provider.id, solverAnswer: solved.answer, issues: solved.issues }),
      candidate.id,
    );
    existing.push(sh);
    report.saved.push(candidate.id);
  }
  return report;
}

export function reviewQueue(db: DB): { id: string; notes: { solver: string; solverAnswer: string; issues: string } | null }[] {
  return (db.prepare("SELECT id, review_notes_json FROM questions WHERE status = 'review' ORDER BY created_at, id").all() as { id: string; review_notes_json: string | null }[]).map(
    (r) => ({ id: r.id, notes: r.review_notes_json ? JSON.parse(r.review_notes_json) : null }),
  );
}

export function approveQuestion(db: DB, id: string): void {
  db.prepare("UPDATE questions SET status = 'active' WHERE id = ? AND status = 'review'").run(id);
}

export function rejectQuestion(db: DB, id: string): void {
  // Rejected drafts are deleted; they were never part of the bank.
  db.prepare("DELETE FROM questions WHERE id = ? AND status = 'review'").run(id);
}
