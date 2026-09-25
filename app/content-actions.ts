"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AiError, getProvider } from "@/lib/ai";
import { approveQuestion, type BatchReport, generateBatch, rejectQuestion } from "@/lib/ai-generator";
import { currentProfile } from "@/lib/current";
import { today } from "@/lib/dates";
import { getDb } from "@/lib/db";
import { importQuestions, parseImport } from "@/lib/import";
import { buildCustomLesson } from "@/lib/custom-lessons";
import { fetchOpenSat } from "@/lib/opensat";
import { createPracticeSet } from "@/lib/repo/profile";
import { pickQuestion, skillStats, targetDifficulty } from "@/lib/session";
import { SKILL_BY_ID } from "@/lib/taxonomy";
import { reviewCard } from "@/lib/vocab";

/* ---------- AI generator ---------- */

export type GenerateState = { ok: boolean; error?: string; report?: BatchReport };

export async function generateAction(_prev: GenerateState, form: FormData): Promise<GenerateState> {
  const provider = getProvider();
  if (!provider) return { ok: false, error: "No AI provider is configured. See the setup notes on this page." };
  const parsed = z
    .object({ skill: z.string(), difficulty: z.coerce.number().int().min(1).max(3), count: z.coerce.number().int().min(1).max(10) })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success || !SKILL_BY_ID.has(parsed.data.skill)) return { ok: false, error: "Pick a skill, difficulty and batch size." };
  try {
    const report = await generateBatch(getDb(), provider, { ...parsed.data, difficulty: parsed.data.difficulty as 1 | 2 | 3 });
    revalidatePath("/content");
    return { ok: true, report };
  } catch (e) {
    return { ok: false, error: e instanceof AiError ? e.message : `Generation failed: ${(e as Error).message}` };
  }
}

export async function approveAction(id: string): Promise<void> {
  approveQuestion(getDb(), id);
  revalidatePath("/content/review");
}

export async function rejectAction(id: string): Promise<void> {
  rejectQuestion(getDb(), id);
  revalidatePath("/content/review");
}

/* ---------- Import ---------- */

export type ImportState = {
  ok: boolean;
  error?: string;
  mode?: "validate" | "import";
  total?: number;
  valid?: number;
  errors?: { row: number; id?: string; message: string }[];
  inserted?: number;
  updated?: number;
};

export async function importAction(_prev: ImportState, form: FormData): Promise<ImportState> {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a .json or .csv file." };
  if (file.size > 20 * 1024 * 1024) return { ok: false, error: "That file is larger than 20 MB." };
  const mode = form.get("mode") === "import" ? "import" : "validate";
  const source = String(form.get("source") ?? "").trim();
  const license = String(form.get("license") ?? "").trim();
  const report = parseImport(file.name, await file.text(), { source, license });
  const base: ImportState = { ok: true, mode, total: report.total, valid: report.valid.length, errors: report.errors.slice(0, 200) };
  if (mode === "validate" || report.valid.length === 0) return base;
  if (!form.get("rights")) return { ...base, ok: false, error: "Confirm that you have the rights to use these questions." };
  const r = importQuestions(getDb(), report.valid);
  revalidatePath("/questions");
  return { ...base, inserted: r.inserted, updated: r.updated };
}

export type OpenSatState = { ok: boolean; error?: string; imported?: number; skipped?: { id: string; reason: string }[] };

export async function openSatAction(_prev: OpenSatState, form: FormData): Promise<OpenSatState> {
  if (!form.get("rights")) return { ok: false, error: "Tick the box to confirm you understand the license terms." };
  const section = form.get("section") === "MATH" ? "MATH" : "RW";
  const limit = Math.max(1, Math.min(500, Number(form.get("limit")) || 50));
  try {
    const { questions, skipped } = await fetchOpenSat(section, limit);
    const r = importQuestions(getDb(), questions);
    revalidatePath("/questions");
    return { ok: true, imported: r.inserted + r.updated, skipped: skipped.slice(0, 50) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/* ---------- Lessons ---------- */

/** A practice set of 10 questions from one skill, unseen and well-matched first. */
export async function practiceSkill(skill: string): Promise<void> {
  const db = getDb();
  const { profile } = await currentProfile();
  if (!SKILL_BY_ID.has(skill)) redirect("/lessons");
  const stat = skillStats(db, profile.id).get(skill)!;
  const used = new Set<string>();
  for (let i = 0; i < 10; i++) {
    const id = pickQuestion(db, profile.id, skill, targetDifficulty(stat), used);
    if (id) used.add(id);
  }
  const setId = createPracticeSet(db, profile.id, `Practice: ${SKILL_BY_ID.get(skill)!.name}`, "practice", [...used]);
  redirect(`/practice/${setId}`);
}

export type CustomLessonState = { ok: boolean; error?: string };

export async function createCustomLessonAction(_prev: CustomLessonState, form: FormData): Promise<CustomLessonState> {
  const skills = form
    .getAll("skills")
    .map(String)
    .filter((s) => SKILL_BY_ID.has(s));
  if (skills.length < 1 || skills.length > 3) return { ok: false, error: "Pick one to three skills." };
  const useAi = form.get("ai") === "on" && !!getProvider();
  const { profile } = await currentProfile();
  let id: number;
  try {
    id = await buildCustomLesson(getDb(), profile.id, skills, useAi ? getProvider() : null);
  } catch (e) {
    return { ok: false, error: e instanceof AiError ? e.message : (e as Error).message };
  }
  redirect(`/custom/${id}`);
}

/* ---------- Vocab ---------- */

export async function reviewVocabAction(wordId: string, quality: number): Promise<{ due: string; interval: number }> {
  const { profile } = await currentProfile();
  const r = reviewCard(getDb(), profile.id, wordId, quality, today());
  return { due: r.due, interval: r.interval };
}
