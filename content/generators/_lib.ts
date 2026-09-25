/**
 * Shared helpers for math template generators.
 *
 * A generator is a parametrized template: it picks numbers from a seeded RNG,
 * computes the correct answer, builds distractors from common student errors,
 * and writes a step-by-step explanation. Every generator also exposes `check`,
 * an independent test of whether a value answers the problem (usually by
 * substituting it back), which the unit tests use to confirm the key.
 */

export type Rng = () => number;

/** mulberry32: small, fast, deterministic PRNG. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Random non-zero integer in [min, max]. */
export function randNonZero(rng: Rng, min: number, max: number): number {
  for (;;) {
    const n = randInt(rng, min, max);
    if (n !== 0) return n;
  }
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

/** Round to avoid floating point noise (e.g. 0.1 + 0.2). */
export function clean(n: number, places = 9): number {
  const r = Number(n.toFixed(places));
  return Object.is(r, -0) ? 0 : r;
}

export function approxEqual(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));
}

/** Format a rational p/q in lowest terms as LaTeX (no $ delimiters). */
export function fracTex(p: number, q: number): string {
  if (q === 0) throw new Error("zero denominator");
  if (q < 0) {
    p = -p;
    q = -q;
  }
  const g = gcd(p, q) || 1;
  p /= g;
  q /= g;
  if (q === 1) return String(p);
  return p < 0 ? `-\\frac{${-p}}{${q}}` : `\\frac{${p}}{${q}}`;
}

/** Plain-text rational in lowest terms, e.g. "7/3" or "-2". Used for SPR keys. */
export function fracText(p: number, q: number): string {
  if (q < 0) {
    p = -p;
    q = -q;
  }
  const g = gcd(p, q) || 1;
  p /= g;
  q /= g;
  return q === 1 ? String(p) : `${p}/${q}`;
}

/** Best rational approximation with denominator ≤ maxDen (exact for our generators). */
export function toFrac(n: number, maxDen = 1000): [number, number] {
  for (let q = 1; q <= maxDen; q++) {
    const p = Math.round(n * q);
    if (Math.abs(p / q - n) < 1e-9) return [p, q];
  }
  throw new Error(`no simple fraction for ${n}`);
}

/** Number as LaTeX, using a fraction when it isn't an integer. */
export function ratTex(n: number): string {
  const [p, q] = toFrac(n);
  return fracTex(p, q);
}

/** Number as plain text for an SPR answer key ("7/3", "-2", "0.25" stays "1/4"). */
export function ratText(n: number): string {
  const [p, q] = toFrac(n);
  return fracText(p, q);
}

/** Format a number for display: integers as-is, decimals trimmed. */
export function num(n: number): string {
  const c = clean(n, 6);
  return Number.isInteger(c) ? String(c) : String(c);
}

/** Thousands separators for word problems (LaTeX-safe via {,}). */
export function money(n: number): string {
  const [i, d] = clean(n, 2).toFixed(2).split(".");
  const withCommas = i.replace(/\B(?=(\d{3})+(?!\d))/g, "{,}");
  return d === "00" ? withCommas : `${withCommas}.${d}`;
}

/** "+ 3" / "- 3" for building expressions like "2x + 3". */
export function signed(n: number): string {
  return n < 0 ? `- ${Math.abs(n)}` : `+ ${n}`;
}

/** Coefficient in front of a variable: 1 → "", -1 → "-", 3 → "3". */
export function coef(n: number): string {
  if (n === 1) return "";
  if (n === -1) return "-";
  return String(n);
}

/** Linear expression ax + b in LaTeX, skipping zero terms. */
export function linTex(a: number, b: number, v = "x"): string {
  if (a === 0) return String(b);
  const head = `${coef(a)}${v}`;
  if (b === 0) return head;
  return `${head} ${signed(b)}`;
}

export interface Candidate<V> {
  value: V;
  /** Why a student might pick this wrong answer. */
  note: string;
}

export interface GeneratedMcq<V> {
  choices: string[];
  answer: "A" | "B" | "C" | "D";
  values: V[];
  distractor_notes: Record<string, string>;
}

const LET = ["A", "B", "C", "D"] as const;

/**
 * Build four distinct choices from the correct value plus error-based
 * candidates. Candidates that duplicate the answer (or each other, after
 * formatting) are dropped and replaced with the `fallback` sequence.
 */
export function buildMcq<V>(
  rng: Rng,
  correct: V,
  candidates: Candidate<V>[],
  format: (v: V) => string,
  fallback: (i: number) => Candidate<V>,
  opts: { sortNumeric?: boolean } = {},
): GeneratedMcq<V> {
  const seen = new Set<string>([format(correct)]);
  const picked: Candidate<V>[] = [];
  for (const c of candidates) {
    const f = format(c.value);
    if (seen.has(f)) continue;
    seen.add(f);
    picked.push(c);
    if (picked.length === 3) break;
  }
  for (let i = 1; picked.length < 3; i++) {
    if (i > 200) throw new Error("could not build distinct distractors");
    const c = fallback(i);
    const f = format(c.value);
    if (seen.has(f)) continue;
    seen.add(f);
    picked.push(c);
  }
  let entries: { value: V; note: string | null }[] = shuffle(rng, [
    { value: correct, note: null },
    ...picked,
  ]);
  if (opts.sortNumeric) {
    entries = [...entries].sort((a, b) => Number(a.value) - Number(b.value));
  }
  const answerIdx = entries.findIndex((e) => e.note === null);
  const distractor_notes: Record<string, string> = {};
  entries.forEach((e, i) => {
    if (e.note !== null) distractor_notes[LET[i]] = e.note;
  });
  return {
    choices: entries.map((e) => format(e.value)),
    answer: LET[answerIdx],
    values: entries.map((e) => e.value),
    distractor_notes,
  };
}

export type Difficulty = 1 | 2 | 3;

export interface GeneratorOutput {
  type: "mcq" | "spr";
  stem_md: string;
  choices?: string[];
  answer: string;
  explanation_md: string;
  distractor_notes?: Record<string, string>;
  /** Values the check function understands: one per choice (mcq) or [answer] (spr). */
  values: unknown[];
  /** Parameters passed to `check`. */
  params: unknown;
}

export interface Generator {
  id: string;
  title: string;
  skill: string;
  difficulties: Difficulty[];
  tags?: string[];
  generate(rng: Rng, difficulty: Difficulty): GeneratorOutput;
  /** Independent verification: does `value` answer the problem described by `params`? */
  check(params: any, value: any): boolean; // eslint-disable-line @typescript-eslint/no-explicit-any
}

/** SPR helper: output with a single accepted value. */
export function spr(
  stem_md: string,
  answer: string,
  explanation_md: string,
  value: unknown,
  params: unknown,
): GeneratorOutput {
  return { type: "spr", stem_md, answer, explanation_md, values: [value], params };
}

export function mcq<V>(
  stem_md: string,
  built: GeneratedMcq<V>,
  explanation_md: string,
  params: unknown,
): GeneratorOutput {
  return {
    type: "mcq",
    stem_md,
    choices: built.choices,
    answer: built.answer,
    explanation_md,
    distractor_notes: built.distractor_notes,
    values: built.values,
    params,
  };
}

/** Wrap a TeX expression as inline math. */
export const m = (tex: string | number) => `$${tex}$`;
