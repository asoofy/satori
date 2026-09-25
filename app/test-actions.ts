"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentProfile } from "@/lib/current";
import { getDb } from "@/lib/db";
import { refreshCompletion } from "@/lib/planner";
import { checkAwards } from "@/lib/rewards";
import type { Section } from "@/lib/taxonomy";
import {
  abandonTest,
  type AnswerPatch,
  createTest,
  endBreak,
  getModule,
  getTest,
  saveAnswer,
  startModule,
  submitModule,
  type TestKind,
} from "@/lib/tests";

async function owned(testId: number, moduleId?: number) {
  const { profile } = await currentProfile();
  const db = getDb();
  const test = getTest(db, profile.id, testId);
  if (!test) throw new Error("Test not found.");
  if (moduleId !== undefined) {
    const m = getModule(db, moduleId);
    if (!m || m.test_id !== testId) throw new Error("Module not found.");
  }
  return { db, profile, test };
}

export async function startTestAction(kind: TestKind, section: Section | null): Promise<void> {
  const { profile } = await currentProfile();
  const id = createTest(getDb(), profile.id, kind, kind === "full" ? ["RW", "MATH"] : [section ?? "RW"]);
  redirect(`/take/${id}`);
}

export async function beginModuleAction(testId: number, moduleId: number): Promise<void> {
  const { db, test } = await owned(testId, moduleId);
  if (test.current_module_id !== moduleId) return;
  startModule(db, moduleId);
  revalidatePath(`/take/${testId}`);
}

export async function saveTestAnswerAction(testId: number, moduleId: number, questionId: string, patch: AnswerPatch): Promise<void> {
  const { db, test } = await owned(testId, moduleId);
  if (test.current_module_id !== moduleId) return;
  saveAnswer(db, moduleId, questionId, patch);
}

export async function submitModuleAction(testId: number, moduleId: number): Promise<{ phase: string }> {
  const { db, profile } = await owned(testId, moduleId);
  const t = submitModule(db, profile.id, testId, moduleId);
  checkAwards(db, profile.id, refreshCompletion(db, profile.id));
  revalidatePath(`/take/${testId}`);
  return { phase: t.phase };
}

export async function endBreakAction(testId: number): Promise<void> {
  const { db, profile } = await owned(testId);
  endBreak(db, profile.id, testId);
  revalidatePath(`/take/${testId}`);
}

export async function abandonTestAction(testId: number): Promise<void> {
  const { db, profile } = await owned(testId);
  abandonTest(db, profile.id, testId);
  redirect("/tests");
}
