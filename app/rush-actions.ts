"use server";

import { redirect } from "next/navigation";
import type { PlayerQuestion } from "@/components/PracticePlayer";
import { currentProfile } from "@/lib/current";
import { getDb } from "@/lib/db";
import { toPlayerQuestions } from "@/lib/player";
import { createPracticeSet } from "@/lib/repo/profile";
import { getQuestionsByIds } from "@/lib/repo/questions";
import type { Section } from "@/lib/taxonomy";

/** A batch of multiple-choice questions for Question Rush, unseen ones first. */
export async function rushBatch(section: Section | null, exclude: string[]): Promise<PlayerQuestion[]> {
  const db = getDb();
  const { profile } = await currentProfile();
  const skip = new Set(exclude);
  const rows = db
    .prepare(
      `SELECT q.id FROM questions q
       WHERE q.status = 'active' AND q.type = 'mcq' ${section ? "AND q.section = $section" : ""}
       ORDER BY EXISTS(SELECT 1 FROM attempts a WHERE a.profile_id = $pid AND a.question_id = q.id), RANDOM()
       LIMIT 60`,
    )
    .all(section ? { $pid: profile.id, $section: section } : { $pid: profile.id }) as { id: string }[];
  const ids = rows.map((r) => r.id).filter((id) => !skip.has(id)).slice(0, 10);
  return toPlayerQuestions(db, profile.id, getQuestionsByIds(db, ids));
}

export interface RushResult {
  best: number;
  isBest: boolean;
}

export async function saveRushRun(run: { section: Section | null; durationS: number; answered: number; correct: number; bestStreak: number }): Promise<RushResult> {
  const db = getDb();
  const { profile } = await currentProfile();
  const prev = db
    .prepare("SELECT MAX(correct) AS best FROM rush_runs WHERE profile_id = ? AND duration_s = ? AND IFNULL(section, '') = ?")
    .get(profile.id, run.durationS, run.section ?? "") as { best: number | null };
  db.prepare("INSERT INTO rush_runs (profile_id, section, duration_s, answered, correct, best_streak) VALUES (?, ?, ?, ?, ?, ?)").run(
    profile.id,
    run.section,
    run.durationS,
    Math.max(0, run.answered),
    Math.max(0, run.correct),
    Math.max(0, run.bestStreak),
  );
  const best = Math.max(prev.best ?? 0, run.correct);
  return { best, isBest: run.correct > 0 && run.correct >= best && run.correct > (prev.best ?? 0) };
}

/** Hard (difficulty 3) questions, ones not yet answered correctly first. */
export async function startChallenge(section: Section | null): Promise<void> {
  const db = getDb();
  const { profile } = await currentProfile();
  const rows = db
    .prepare(
      `SELECT q.id FROM questions q
       WHERE q.status = 'active' AND q.difficulty = 3 ${section ? "AND q.section = $section" : ""}
       ORDER BY EXISTS(SELECT 1 FROM attempts a WHERE a.profile_id = $pid AND a.question_id = q.id AND a.correct = 1),
                EXISTS(SELECT 1 FROM attempts a WHERE a.profile_id = $pid AND a.question_id = q.id), RANDOM()
       LIMIT 10`,
    )
    .all(section ? { $pid: profile.id, $section: section } : { $pid: profile.id }) as { id: string }[];
  if (!rows.length) redirect("/challenge");
  const title = `Challenge: ${section === "RW" ? "Reading & Writing" : section === "MATH" ? "Math" : "Mixed"}`;
  const id = createPracticeSet(db, profile.id, title, "challenge", rows.map((r) => r.id));
  redirect(`/practice/${id}`);
}
