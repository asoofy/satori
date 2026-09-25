/**
 * Optional adapter for the OpenSAT public question API
 * (https://github.com/Anas099X/OpenSAT).
 *
 * - Runs only on your machine, only when you click Import.
 * - Imported questions are marked source "opensat" with an "unknown" license, since the
 *   project doesn't publish one. They live only in your local database (data/ is
 *   gitignored) and are excluded from exports by default. Never commit them.
 * - OpenSAT doesn't label skills or difficulty, so the skill is guessed from the
 *   question text and difficulty is set to medium (tagged "difficulty-unrated").
 */
import { z } from "zod";
import type { QuestionInput } from "@/lib/question-schema";
import { QuestionInput as QuestionSchema } from "@/lib/question-schema";

export const OPENSAT_URL = process.env.OPENSAT_URL || "https://pinesat.duckdns.org/api/questions";
export const OPENSAT_LICENSE = "unknown (OpenSAT; not redistributable by Satori)";

const OpenSatQuestion = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  domain: z.string(),
  question: z.object({
    paragraph: z.string().nullish(),
    question: z.string(),
    choices: z.record(z.string(), z.string()).nullish(),
    correct_answer: z.string(),
    explanation: z.string().nullish(),
  }),
});
type OpenSatQuestion = z.infer<typeof OpenSatQuestion>;

const DOMAIN_MAP: Record<string, string> = {
  "information and ideas": "information-ideas",
  "craft and structure": "craft-structure",
  "expression of ideas": "expression-ideas",
  "standard english conventions": "conventions",
  algebra: "algebra",
  "advanced math": "advanced-math",
  "problem-solving and data analysis": "psda",
  "problem solving and data analysis": "psda",
  "geometry and trigonometry": "geometry-trig",
};

const has = (text: string, ...words: string[]) => words.some((w) => text.includes(w));

/** Best-guess skill from the domain and question wording. */
export function classifySkill(domainId: string, stem: string, passage: string, choices: string[]): string {
  const t = `${stem} ${passage}`.toLowerCase();
  switch (domainId) {
    case "information-ideas":
      if (has(t, "table", "graph", "chart", "data from", "figure")) return "command-evidence-quantitative";
      if (has(t, "quotation", "finding", "would most directly support", "would most strongly support", "would most directly weaken", "illustrates the claim")) return "command-evidence-textual";
      if (has(t, "most logically completes", "most logically complete")) return "inferences";
      return "central-ideas";
    case "craft-structure":
      if (has(t, "text 1", "text 2")) return "cross-text-connections";
      if (has(t, "logical and precise word", "most nearly mean", "as used in the text")) return "words-in-context";
      return "text-structure-purpose";
    case "expression-ideas":
      return has(t, "transition") ? "transitions" : "rhetorical-synthesis";
    case "conventions": {
      // Boundary questions: choices differ mostly in punctuation.
      const letters = choices.map((c) => c.replace(/[^a-z]/gi, "").toLowerCase());
      return letters.length && new Set(letters).size <= 2 ? "boundaries" : "form-structure-sense";
    }
    case "algebra":
      if (has(t, "system", "solution (x, y)", "solution to the system")) return "systems-linear";
      if (has(t, "inequalit", "at most", "at least", "≤", "≥", "\\le", "\\ge")) return "linear-inequalities";
      if (has(t, "f(x)", "function", "slope", "y-intercept")) return "linear-functions";
      if (/[xy].*=.*[xy]/.test(t) && has(t, " y ")) return "linear-equations-two-var";
      return "linear-equations-one-var";
    case "advanced-math":
      if (has(t, "equivalent", "expression", "simplif", "factor")) return "equivalent-expressions";
      if (has(t, "f(x)", "function", "graph", "vertex", "exponential")) return "nonlinear-functions";
      return "nonlinear-equations";
    case "psda":
      if (has(t, "probability", "at random")) return "probability";
      if (has(t, "margin of error", "sample", "survey")) return "sample-statistics";
      if (has(t, "percent", "%")) return "percentages";
      if (has(t, "mean", "median", "standard deviation", "range", "mode")) return "one-var-data";
      if (has(t, "scatterplot", "line of best fit", "model")) return "two-var-data";
      if (has(t, "experiment", "study", "conclusion")) return "evaluating-claims";
      return "ratios-rates-units";
    case "geometry-trig":
      if (has(t, "circle", "radius", "diameter", "arc", "radian")) return "circles";
      if (has(t, "sin", "cos", "tan", "right triangle", "hypotenuse")) return "right-triangles-trig";
      if (has(t, "volume", "area", "surface", "cube", "cylinder", "sphere", "prism")) return "area-volume";
      return "lines-angles-triangles";
  }
  return "central-ideas";
}

/** Map one OpenSAT question to Satori's schema, or explain why it can't be. */
export function mapOpenSat(raw: unknown, section: "RW" | "MATH"): { ok: true; q: QuestionInput } | { ok: false; reason: string } {
  const p = OpenSatQuestion.safeParse(raw);
  if (!p.success) return { ok: false, reason: "Unexpected format." };
  const o: OpenSatQuestion = p.data;
  const domainId = DOMAIN_MAP[o.domain.trim().toLowerCase()];
  if (!domainId) return { ok: false, reason: `Unknown domain "${o.domain}".` };
  const choicesObj = o.question.choices ?? {};
  const letters = ["A", "B", "C", "D"];
  const hasChoices = letters.every((L) => (choicesObj[L] ?? "").trim());
  const choices = hasChoices ? letters.map((L) => choicesObj[L].trim()) : null;
  const passage = (o.question.paragraph ?? "").trim();
  const stem = o.question.question.trim();
  const skill = classifySkill(domainId, stem, passage, choices ?? []);
  const candidate = {
    id: `opensat-${o.id.replace(/[^a-z0-9_-]/gi, "")}`,
    section,
    skill,
    difficulty: 2 as const,
    type: hasChoices ? ("mcq" as const) : ("spr" as const),
    passage_md: passage && passage.toLowerCase() !== "null" ? passage : null,
    stem_md: stem,
    choices,
    answer: hasChoices ? o.question.correct_answer.trim().toUpperCase() : o.question.correct_answer.trim(),
    explanation_md: (o.question.explanation ?? "").trim() || "No explanation was provided by the source.",
    tags: ["opensat", "difficulty-unrated", "skill-guessed"],
    source: "opensat",
    license: OPENSAT_LICENSE,
  };
  const r = QuestionSchema.safeParse(candidate);
  if (!r.success) return { ok: false, reason: r.error.issues[0]?.message ?? "Invalid question." };
  return { ok: true, q: r.data };
}

export async function fetchOpenSat(section: "RW" | "MATH", limit: number): Promise<{ questions: QuestionInput[]; skipped: { id: string; reason: string }[] }> {
  const url = new URL(OPENSAT_URL);
  url.searchParams.set("section", section === "RW" ? "english" : "math");
  url.searchParams.set("limit", String(Math.max(1, Math.min(500, limit))));
  let res: Response;
  try {
    res = await fetch(url, { headers: { accept: "application/json" } });
  } catch {
    throw new Error(`Couldn’t reach ${url.host}. Check your internet connection.`);
  }
  if (!res.ok) throw new Error(`OpenSAT returned HTTP ${res.status}.`);
  const data = (await res.json()) as unknown;
  const all = Array.isArray(data) ? data : ((data as { questions?: unknown[] })?.questions ?? []);
  // The API may ignore `limit`, so enforce it here too.
  const list = all.slice(0, Math.max(1, Math.min(500, limit)));
  const questions: QuestionInput[] = [];
  const skipped: { id: string; reason: string }[] = [];
  for (const raw of list) {
    const m = mapOpenSat(raw, section);
    if (m.ok) questions.push(m.q);
    else skipped.push({ id: String((raw as { id?: unknown })?.id ?? "?"), reason: m.reason });
  }
  return { questions, skipped };
}
