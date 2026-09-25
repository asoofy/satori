import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { DB } from "@/lib/db";
import { addDays } from "@/lib/dates";

export const VOCAB_FILE = path.join(process.cwd(), "content", "vocab.json");

const VocabEntry = z.object({
  word: z.string().min(1),
  pos: z.string().min(1),
  definition: z.string().min(1),
  example: z.string().min(1),
  level: z.number().int().min(1).max(3).default(2),
});
export type VocabEntry = z.infer<typeof VocabEntry>;

/** Replace the word (and simple inflections like -s, -ed, -ing) with a blank. */
export function blankOut(example: string, word: string): string | null {
  const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\w*\\b`, "i");
  return re.test(example) ? example.replace(re, "______") : null;
}

export function loadVocab(file = VOCAB_FILE): { words: VocabEntry[]; errors: string[] } {
  const json = JSON.parse(fs.readFileSync(file, "utf8")) as { words: unknown[] };
  const words: VocabEntry[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  json.words.forEach((raw, i) => {
    const r = VocabEntry.safeParse(raw);
    if (!r.success) return errors.push(`vocab #${i}: ${r.error.issues[0].message}`);
    const id = r.data.word.toLowerCase();
    if (seen.has(id)) return errors.push(`vocab #${i}: duplicate word "${r.data.word}"`);
    if (!blankOut(r.data.example, r.data.word)) return errors.push(`vocab #${i}: example doesn't contain "${r.data.word}"`);
    seen.add(id);
    words.push(r.data);
  });
  return { words, errors };
}

export function seedVocab(db: DB): { count: number; errors: string[] } {
  if (!fs.existsSync(VOCAB_FILE)) return { count: 0, errors: [] };
  const { words, errors } = loadVocab();
  const stmt = db.prepare(
    `INSERT INTO vocab_words (id, word, pos, definition, example, blank, level) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET word = excluded.word, pos = excluded.pos, definition = excluded.definition,
       example = excluded.example, blank = excluded.blank, level = excluded.level`,
  );
  for (const w of words) stmt.run(w.word.toLowerCase(), w.word, w.pos, w.definition, w.example, blankOut(w.example, w.word)!, w.level);
  return { count: words.length, errors };
}

/* ---------------- SM-2 spaced repetition ---------------- */

export interface CardState {
  ease: number;
  interval: number;
  reps: number;
  lapses: number;
}

/**
 * SM-2: quality 0–5 (we use 1 = again, 3 = hard, 4 = good, 5 = easy).
 * Below 3 resets the repetition count; otherwise the interval grows 1 → 6 → interval × ease.
 */
export function sm2(prev: CardState, quality: number): CardState {
  const q = Math.max(0, Math.min(5, Math.round(quality)));
  let { ease, interval, reps, lapses } = prev;
  if (q < 3) {
    reps = 0;
    interval = 1;
    lapses += 1;
  } else {
    reps += 1;
    interval = reps === 1 ? 1 : reps === 2 ? 6 : Math.round(interval * ease);
  }
  ease = Math.max(1.3, ease + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  return { ease: Math.round(ease * 100) / 100, interval, reps, lapses };
}

export interface VocabCard {
  id: string;
  word: string;
  pos: string;
  definition: string;
  example: string;
  blank: string;
  level: number;
  isNew: boolean;
  due: string | null;
  reps: number;
}

export const NEW_PER_DAY = 10;

/** Cards to review today: everything due, plus up to NEW_PER_DAY new words (easier first). */
export function dueCards(db: DB, profileId: number, today: string, newLimit = NEW_PER_DAY): VocabCard[] {
  const due = db
    .prepare(
      `SELECT w.*, p.due, p.reps FROM vocab_words w JOIN vocab_progress p ON p.word_id = w.id AND p.profile_id = ?
       WHERE p.due <= ? ORDER BY p.due, w.id`,
    )
    .all(profileId, today) as unknown as (VocabCard & { due: string })[];
  const introducedToday = (
    db.prepare("SELECT COUNT(*) AS n FROM vocab_progress WHERE profile_id = ? AND introduced = ?").get(profileId, today) as { n: number }
  ).n;
  const fresh = db
    .prepare(
      `SELECT w.*, NULL AS due, 0 AS reps FROM vocab_words w
       WHERE NOT EXISTS (SELECT 1 FROM vocab_progress p WHERE p.word_id = w.id AND p.profile_id = ?)
       ORDER BY w.level, w.id LIMIT ?`,
    )
    .all(profileId, Math.max(0, newLimit - introducedToday)) as unknown as VocabCard[];
  return [...due.map((c) => ({ ...c, isNew: false })), ...fresh.map((c) => ({ ...c, isNew: true }))];
}

export function reviewCard(db: DB, profileId: number, wordId: string, quality: number, today: string): CardState & { due: string } {
  const row = db.prepare("SELECT ease, interval, reps, lapses FROM vocab_progress WHERE profile_id = ? AND word_id = ?").get(profileId, wordId) as CardState | undefined;
  const next = sm2(row ?? { ease: 2.5, interval: 0, reps: 0, lapses: 0 }, quality);
  const due = addDays(today, next.interval);
  db.prepare(
    `INSERT INTO vocab_progress (profile_id, word_id, ease, interval, reps, due, lapses, last_review, introduced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(profile_id, word_id) DO UPDATE SET ease = excluded.ease, interval = excluded.interval,
       reps = excluded.reps, due = excluded.due, lapses = excluded.lapses, last_review = excluded.last_review`,
  ).run(profileId, wordId, next.ease, next.interval, next.reps, due, next.lapses, today, today);
  return { ...next, due };
}

export function vocabStats(db: DB, profileId: number, today: string): { total: number; learning: number; mature: number; due: number } {
  const total = (db.prepare("SELECT COUNT(*) AS n FROM vocab_words").get() as { n: number }).n;
  const r = db
    .prepare(
      `SELECT COUNT(*) AS learning, SUM(CASE WHEN interval >= 21 THEN 1 ELSE 0 END) AS mature,
              SUM(CASE WHEN due <= ? THEN 1 ELSE 0 END) AS due
       FROM vocab_progress WHERE profile_id = ?`,
    )
    .get(today, profileId) as { learning: number; mature: number | null; due: number | null };
  return { total, learning: r.learning, mature: r.mature ?? 0, due: r.due ?? 0 };
}

export interface DrillQuestion {
  wordId: string;
  sentence: string;
  choices: string[];
  answer: number;
  definition: string;
}

/** Words-in-context drill: a sentence with a blank and four words of the same part of speech. */
export function drillQuestions(db: DB, profileId: number, n: number, rng: () => number = Math.random): DrillQuestion[] {
  const words = db
    .prepare(
      `SELECT w.id, w.word, w.pos, w.blank, w.definition,
              IFNULL(p.interval, -1) AS interval
       FROM vocab_words w LEFT JOIN vocab_progress p ON p.word_id = w.id AND p.profile_id = ?`,
    )
    .all(profileId) as { id: string; word: string; pos: string; blank: string; definition: string; interval: number }[];
  // Prefer words being learned (short intervals), then unseen ones.
  const pool = [...words].sort((a, b) => (a.interval < 0 ? 50 : a.interval) - (b.interval < 0 ? 50 : b.interval) || rng() - 0.5).slice(0, Math.max(n * 3, 20));
  const shuffle = <T,>(xs: T[]) => xs.map((x) => [rng(), x] as const).sort((a, b) => a[0] - b[0]).map(([, x]) => x);
  const out: DrillQuestion[] = [];
  for (const target of shuffle(pool).slice(0, n)) {
    const others = shuffle(words.filter((w) => w.pos === target.pos && w.id !== target.id)).slice(0, 3);
    if (others.length < 3) continue;
    const choices = shuffle([target, ...others]);
    out.push({
      wordId: target.id,
      sentence: target.blank,
      choices: choices.map((c) => c.word),
      answer: choices.findIndex((c) => c.id === target.id),
      definition: target.definition,
    });
  }
  return out;
}
