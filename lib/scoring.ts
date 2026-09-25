/**
 * Predicted score model — an ESTIMATE, not an official score.
 *
 * For each section we estimate a scaled score θ (200–800) from the student's answers
 * with a simple, documented item-response model (see docs/SCORING.md):
 *
 *   P(correct | θ, difficulty d) = 1 / (1 + exp(−(θ − b_d) / s))
 *
 * where b_d is the score at which a student gets a question of difficulty d right half
 * the time (easy 420, medium 560, hard 690) and s = 70 controls how sharply the
 * probability changes. Each answer is weighted by recency (half-life of 21 days), so
 * recent work counts more. A weak prior centred on 500 keeps estimates sensible when
 * there are only a few answers. We pick the θ with the highest weighted posterior on a
 * 10-point grid, and report ± one standard error from the curvature of the posterior.
 */

export const DIFFICULTY_LEVEL: Record<number, number> = { 1: 420, 2: 560, 3: 690 };
export const SLOPE = 70;
export const HALF_LIFE_DAYS = 21;
export const PRIOR_MEAN = 500;
export const PRIOR_SD = 150;
export const MIN_ANSWERS = 8;

export interface ScoreInput {
  difficulty: number;
  correct: number | boolean;
  days_ago: number;
}

export interface SectionEstimate {
  score: number; // 200–800, multiple of 10
  margin: number; // ± points, multiple of 10
  answers: number;
  effectiveAnswers: number;
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

export function recencyWeight(daysAgo: number): number {
  return Math.pow(0.5, Math.max(0, daysAgo) / HALF_LIFE_DAYS);
}

function logPosterior(theta: number, data: ScoreInput[]): number {
  let lp = -((theta - PRIOR_MEAN) ** 2) / (2 * PRIOR_SD ** 2);
  for (const a of data) {
    const p = sigmoid((theta - DIFFICULTY_LEVEL[a.difficulty]) / SLOPE);
    const w = recencyWeight(a.days_ago);
    lp += w * (a.correct ? Math.log(p) : Math.log(1 - p));
  }
  return lp;
}

/** Estimate one section's scaled score, or null when there isn't enough data yet. */
export function estimateSection(data: ScoreInput[]): SectionEstimate | null {
  if (data.length < MIN_ANSWERS) return null;
  let best = 200;
  let bestLp = -Infinity;
  for (let theta = 200; theta <= 800; theta += 10) {
    const lp = logPosterior(theta, data);
    if (lp > bestLp) {
      bestLp = lp;
      best = theta;
    }
  }
  // Fisher information at the estimate → standard error.
  let info = 1 / PRIOR_SD ** 2;
  let eff = 0;
  for (const a of data) {
    const p = sigmoid((best - DIFFICULTY_LEVEL[a.difficulty]) / SLOPE);
    const w = recencyWeight(a.days_ago);
    info += (w * p * (1 - p)) / SLOPE ** 2;
    eff += w;
  }
  const se = 1 / Math.sqrt(info);
  return {
    score: best,
    margin: Math.max(10, Math.round(se / 10) * 10),
    answers: data.length,
    effectiveAnswers: Math.round(eff * 10) / 10,
  };
}

export interface Prediction {
  rw: SectionEstimate | null;
  math: SectionEstimate | null;
  total: { score: number; margin: number } | null;
}

export function predict(attempts: (ScoreInput & { section: "RW" | "MATH" })[]): Prediction {
  const rw = estimateSection(attempts.filter((a) => a.section === "RW"));
  const math = estimateSection(attempts.filter((a) => a.section === "MATH"));
  const total =
    rw && math
      ? { score: rw.score + math.score, margin: Math.round(Math.sqrt(rw.margin ** 2 + math.margin ** 2) / 10) * 10 }
      : null;
  return { rw, math, total };
}
