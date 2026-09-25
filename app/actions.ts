"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { currentProfile } from "@/lib/current";
import { getDb } from "@/lib/db";
import { grade, parseSpr } from "@/lib/grading";
import { bankIds, type BankFilter, getQuestion } from "@/lib/repo/questions";
import { createPracticeSet, renameProfile, updateSettings } from "@/lib/repo/profile";
import { type AttemptContext, isSaved, mistakeIds, recordAttempt, savedList, setSaved } from "@/lib/repo/progress";
import { today } from "@/lib/dates";
import { getPlanDay, planDayFor, rebuildPlan, refreshCompletion, startPlanDay } from "@/lib/planner";
import { type Award, checkAwards, XP_CORRECT, XP_MISSED } from "@/lib/rewards";
import { buildSession } from "@/lib/session";

const OnboardingSchema = z.object({
  name: z.string().trim().min(1).max(40),
  test_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")),
  goal_score: z.coerce.number().int().min(400).max(1600),
  current_score: z.union([z.literal(""), z.coerce.number().int().min(400).max(1600)]),
  daily_goal: z.coerce.number().int().min(1).max(100).optional(),
});

export type FormState = { ok: boolean; error?: string };

export async function saveOnboarding(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = OnboardingSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  }
  const d = parsed.data;
  const { profile } = await currentProfile();
  const db = getDb();
  renameProfile(db, profile.id, d.name);
  updateSettings(db, profile.id, {
    test_date: d.test_date || null,
    goal_score: Math.round(d.goal_score / 10) * 10,
    current_score: d.current_score === "" ? null : Math.round(d.current_score / 10) * 10,
    daily_goal: d.daily_goal ?? 10,
    onboarded: 1,
  });
  // A changed test date or daily goal reshapes an existing plan.
  const hasPlan = (db.prepare("SELECT COUNT(*) AS n FROM plan_days WHERE profile_id = ?").get(profile.id) as { n: number }).n > 0;
  if (hasPlan) rebuildPlan(db, profile.id);
  revalidatePath("/", "layout");
  redirect("/");
}

export interface AttemptResult {
  ok: true;
  correct: boolean;
  answer: string;
  explanation_md: string;
  distractor_notes: Record<string, string> | null;
  xp: number;
  awards: Award[];
}

export async function submitAnswer(input: {
  questionId: string;
  response: string;
  timeMs: number;
  eliminated: string[];
  context: AttemptContext;
}): Promise<AttemptResult | { ok: false; error: string }> {
  const db = getDb();
  const q = getQuestion(db, input.questionId);
  if (!q) return { ok: false, error: "Question not found." };
  if (q.type === "spr") {
    const p = parseSpr(input.response);
    if (!p.ok) return { ok: false, error: p.error };
  } else if (!["A", "B", "C", "D"].includes(input.response)) {
    return { ok: false, error: "Choose an answer." };
  }
  const { profile } = await currentProfile();
  const correct = grade(q, input.response);
  recordAttempt(db, {
    profileId: profile.id,
    questionId: q.id,
    response: input.response,
    correct,
    timeMs: input.timeMs,
    eliminated: input.eliminated,
    context: input.context,
  });
  const completedDays = refreshCompletion(db, profile.id);
  const awards = checkAwards(db, profile.id, completedDays);
  return {
    ok: true,
    correct,
    answer: q.answer,
    explanation_md: q.explanation_md,
    distractor_notes: q.distractor_notes,
    xp: correct ? XP_CORRECT : XP_MISSED,
    awards,
  };
}

export async function toggleSave(questionId: string): Promise<boolean> {
  const db = getDb();
  const { profile } = await currentProfile();
  const next = !isSaved(db, profile.id, questionId);
  setSaved(db, profile.id, questionId, next);
  return next;
}

function filterFromForm(form: FormData): BankFilter {
  const get = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" && v !== "" ? v : undefined;
  };
  const diff = Number(get("difficulty"));
  return {
    section: get("section") as BankFilter["section"],
    domain: get("domain"),
    skill: get("skill"),
    difficulty: diff === 1 || diff === 2 || diff === 3 ? diff : undefined,
    status: get("status") as BankFilter["status"],
    origin: get("origin") as BankFilter["origin"],
    q: get("q"),
  };
}

export async function practiceFiltered(form: FormData): Promise<void> {
  const db = getDb();
  const { profile } = await currentProfile();
  const count = Math.min(50, Math.max(1, Number(form.get("count")) || 10));
  const ids = bankIds(db, profile.id, filterFromForm(form), count);
  if (!ids.length) redirect("/questions?empty=1");
  const title = String(form.get("title") || "Practice set");
  const id = createPracticeSet(db, profile.id, title, "practice", ids);
  redirect(`/practice/${id}`);
}

export async function practiceOne(questionId: string): Promise<void> {
  const db = getDb();
  const { profile } = await currentProfile();
  const q = getQuestion(db, questionId);
  if (!q) redirect("/questions");
  const id = createPracticeSet(db, profile.id, "Single question", "practice", [questionId]);
  redirect(`/practice/${id}`);
}

export async function redoMistakes(): Promise<void> {
  const db = getDb();
  const { profile } = await currentProfile();
  const ids = mistakeIds(db, profile.id).slice(0, 30);
  if (!ids.length) redirect("/saved?tab=mistakes");
  const id = createPracticeSet(db, profile.id, "Redo my mistakes", "redo", ids);
  redirect(`/practice/${id}`);
}

export async function practiceSaved(): Promise<void> {
  const db = getDb();
  const { profile } = await currentProfile();
  const ids = savedList(db, profile.id).slice(0, 50);
  if (!ids.length) redirect("/saved");
  const id = createPracticeSet(db, profile.id, "Saved questions", "practice", ids);
  redirect(`/practice/${id}`);
}

export async function startSession(): Promise<void> {
  const db = getDb();
  const { profile, settings } = await currentProfile();
  // If today is a study-plan day that isn't finished, today's session is that day's set.
  const planDay = planDayFor(db, profile.id, today());
  if (planDay && planDay.status !== "done") {
    redirect(`/practice/${startPlanDay(db, profile.id, planDay)}`);
  }
  const ids = buildSession(db, profile.id, Math.max(4, settings.daily_goal));
  const id = createPracticeSet(db, profile.id, "Today’s session", "session", ids);
  redirect(`/practice/${id}`);
}

export async function setTheme(theme: "system" | "light" | "dark"): Promise<void> {
  const { profile } = await currentProfile();
  updateSettings(getDb(), profile.id, { theme });
  revalidatePath("/", "layout");
}

const PlanSettingsSchema = z.object({
  days: z.array(z.coerce.number().int().min(0).max(6)).min(1, "Pick at least one study day."),
  daily_goal: z.coerce.number().int().min(1).max(100),
});

export async function savePlanSettings(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = PlanSettingsSchema.safeParse({ days: form.getAll("days"), daily_goal: form.get("daily_goal") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const db = getDb();
  const { profile } = await currentProfile();
  updateSettings(db, profile.id, {
    study_days_json: JSON.stringify([...new Set(parsed.data.days)].sort()),
    daily_goal: parsed.data.daily_goal,
  });
  rebuildPlan(db, profile.id);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function rebuildPlanAction(): Promise<void> {
  const db = getDb();
  const { profile } = await currentProfile();
  rebuildPlan(db, profile.id);
  revalidatePath("/", "layout");
}

export async function startPlanDayAction(dayId: number): Promise<void> {
  const db = getDb();
  const { profile } = await currentProfile();
  const day = getPlanDay(db, profile.id, dayId);
  if (!day || day.date > today()) redirect("/path");
  redirect(`/practice/${startPlanDay(db, profile.id, day)}`);
}
