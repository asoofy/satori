/**
 * Grading for multiple-choice and student-produced-response (SPR) answers.
 *
 * SPR rules follow the digital SAT's published entry rules:
 * - up to 5 characters for a positive answer, 6 for a negative one (the minus sign)
 * - fractions and decimals are both fine; mixed numbers are not
 * - a non-terminating answer entered as a decimal must fill the available space,
 *   either truncated or rounded (2/3 → .6666, .6667, 0.666, 0.667)
 * - several answers can be correct; the key lists them separated by "|"
 */

export type SprParse = { ok: true; value: number; text: string } | { ok: false; error: string };

const SPR_RE = /^-?(\d+\/\d+|\d+\.?\d*|\.\d+)$/;

export function parseSpr(raw: string): SprParse {
  if (/\d\s+\d+\/\d+/.test(raw.trim())) return { ok: false, error: "Mixed numbers aren't allowed. Enter 3 1/2 as 7/2 or 3.5." };
  const text = raw.trim().replace(/\s+/g, "");
  if (!text) return { ok: false, error: "Enter an answer." };
  if (!SPR_RE.test(text)) {
    return { ok: false, error: "Use digits, one decimal point or one fraction bar, and an optional leading minus sign." };
  }
  const max = text.startsWith("-") ? 6 : 5;
  if (text.length > max) return { ok: false, error: `Answers are limited to ${max} characters${max === 6 ? " for negative numbers" : ""}.` };
  let value: number;
  if (text.includes("/")) {
    const [p, q] = text.replace("-", "").split("/").map(Number);
    if (q === 0) return { ok: false, error: "A fraction can't have a denominator of 0." };
    value = (text.startsWith("-") ? -1 : 1) * (p / q);
  } else {
    value = Number(text);
  }
  if (!Number.isFinite(value)) return { ok: false, error: "That isn't a number." };
  return { ok: true, value, text };
}

function sameNumber(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
}

function decimalsIn(text: string): number {
  const i = text.indexOf(".");
  return i === -1 ? 0 : text.length - i - 1;
}

/** Does an SPR response match one accepted key value? */
export function sprMatches(responseText: string, key: string): boolean {
  const r = parseSpr(responseText);
  if (!r.ok) return false;
  // Keys are always written in a parseable form; allow long keys (e.g. 0.33333) by skipping the length rule.
  const k = parseKey(key);
  if (k === null) return false;
  if (sameNumber(r.value, k)) return true;
  // Non-terminating value entered as a decimal: must fill the answer space.
  if (r.text.includes("/") || !r.text.includes(".")) return false;
  const max = r.text.startsWith("-") ? 6 : 5;
  if (r.text.length !== max) return false;
  const places = decimalsIn(r.text);
  if (places < 1) return false;
  const f = 10 ** places;
  const truncated = Math.trunc(k * f) / f;
  const rounded = Math.round(k * f) / f;
  return sameNumber(r.value, truncated) || sameNumber(r.value, rounded);
}

function parseKey(key: string): number | null {
  const t = key.trim();
  if (/^-?\d+\/\d+$/.test(t)) {
    const neg = t.startsWith("-");
    const [p, q] = t.replace("-", "").split("/").map(Number);
    return q === 0 ? null : (neg ? -1 : 1) * (p / q);
  }
  const n = Number(t);
  return Number.isFinite(n) && t !== "" ? n : null;
}

export interface Gradable {
  type: "mcq" | "spr";
  answer: string;
}

export function grade(q: Gradable, response: string): boolean {
  if (q.type === "mcq") return response.trim().toUpperCase() === q.answer.trim().toUpperCase();
  return q.answer.split("|").some((key) => sprMatches(response, key));
}
