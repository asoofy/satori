import { z } from "zod";
import type { AiProvider } from "@/lib/ai";
import type { DB } from "@/lib/db";
import { lessonForSkill } from "@/lib/lessons";
import { createPracticeSet } from "@/lib/repo/profile";
import { pickQuestion, skillStats, targetDifficulty } from "@/lib/session";
import { SKILL_TIPS } from "@/lib/skill-tips";
import { SKILL_BY_ID } from "@/lib/taxonomy";

export interface CustomLesson {
  id: number;
  title: string;
  skills: string[];
  body_md: string;
  source: string;
  set_id: number | null;
  created_at: string;
}

const AiLesson = z.object({ title: z.string(), body_md: z.string() });

/** The student's recent misses in these skills (question stems, shortened). */
function recentMisses(db: DB, profileId: number, skills: string[], limit = 6): { skill: string; stem: string }[] {
  const rows = db
    .prepare(
      `SELECT q.skill_id AS skill, q.stem_md AS stem, q.passage_md AS passage FROM attempts a JOIN questions q ON q.id = a.question_id
       WHERE a.profile_id = ? AND a.correct = 0 AND q.skill_id IN (${skills.map(() => "?").join(",")})
       ORDER BY a.id DESC LIMIT ?`,
    )
    .all(profileId, ...skills, limit) as { skill: string; stem: string; passage: string | null }[];
  return rows.map((r) => ({ skill: r.skill, stem: `${r.passage ? r.passage.slice(0, 200) + " … " : ""}${r.stem}`.slice(0, 400) }));
}

function statsLine(db: DB, profileId: number, skill: string): string {
  const s = skillStats(db, profileId).get(skill)!;
  return s.attempts ? `${Math.round((s.accuracy ?? 0) * 100)}% correct over ${s.attempts} answers` : "not practiced yet";
}

/** Assemble a lesson from the built-in lesson library plus the student's own stats. */
export function builtInLesson(db: DB, profileId: number, skills: string[]): { title: string; body_md: string } {
  const names = skills.map((s) => SKILL_BY_ID.get(s)!.name);
  const parts: string[] = [
    "## Where you are",
    "",
    ...skills.map((s) => `- **${SKILL_BY_ID.get(s)!.name}:** ${statsLine(db, profileId, s)}`),
    "",
  ];
  for (const s of skills) {
    const lesson = lessonForSkill(s);
    parts.push(`## ${SKILL_BY_ID.get(s)!.name}`, "", lesson ? lesson.body.replace(/^## /gm, "### ") : SKILL_TIPS[s] ?? "", "");
  }
  parts.push("## Your practice set", "", "The practice set below mixes these skills at a difficulty matched to your recent results. Read every explanation, including for questions you get right.");
  return { title: `Custom lesson: ${names.join(" + ")}`, body_md: parts.join("\n") };
}

export async function aiLesson(db: DB, profileId: number, skills: string[], provider: AiProvider): Promise<{ title: string; body_md: string }> {
  const misses = recentMisses(db, profileId, skills);
  const prompt = [
    "Write a short, focused SAT lesson for one student covering these skills:",
    ...skills.map((s) => `- ${SKILL_BY_ID.get(s)!.name} (${SKILL_BY_ID.get(s)!.section === "RW" ? "Reading and Writing" : "Math"}; student: ${statsLine(db, profileId, s)})`),
    misses.length ? "\nQuestions the student recently got wrong (for diagnosing patterns; don't copy them):" : "",
    ...misses.map((m) => `- [${SKILL_BY_ID.get(m.skill)!.name}] ${m.stem}`),
    "\nStructure: a one-paragraph diagnosis of the likely mistakes, then for each skill: the key idea, a step-by-step strategy, one original worked example, and the most common trap. Keep it under 700 words. Use Markdown with ## headings; math in $...$.",
  ]
    .filter(Boolean)
    .join("\n");
  return provider.json({
    system: "You are a warm, precise SAT tutor writing original lesson material for Satori, a free study app. Never reproduce official College Board questions or other copyrighted prep material.",
    prompt,
    schema: AiLesson,
    maxTokens: 16000,
  });
}

export async function buildCustomLesson(db: DB, profileId: number, skills: string[], provider: AiProvider | null): Promise<number> {
  const lesson = provider ? await aiLesson(db, profileId, skills, provider) : builtInLesson(db, profileId, skills);
  const stats = skillStats(db, profileId);
  const used = new Set<string>();
  for (let i = 0; i < 10; i++) {
    const s = skills[i % skills.length];
    const id = pickQuestion(db, profileId, s, targetDifficulty(stats.get(s)!), used);
    if (id) used.add(id);
  }
  const setId = createPracticeSet(db, profileId, lesson.title, "practice", [...used]);
  const r = db
    .prepare("INSERT INTO custom_lessons (profile_id, title, skills_json, body_md, source, set_id) VALUES (?, ?, ?, ?, ?, ?)")
    .run(profileId, lesson.title, JSON.stringify(skills), lesson.body_md, provider ? `ai:${provider.id}` : "built-in", setId);
  return Number(r.lastInsertRowid);
}

export function listCustomLessons(db: DB, profileId: number): CustomLesson[] {
  return (db.prepare("SELECT * FROM custom_lessons WHERE profile_id = ? ORDER BY id DESC").all(profileId) as unknown as (Omit<CustomLesson, "skills"> & { skills_json: string })[]).map(
    (r) => ({ ...r, skills: JSON.parse(r.skills_json) as string[] }),
  );
}

export function getCustomLesson(db: DB, profileId: number, id: number): CustomLesson | null {
  return listCustomLessons(db, profileId).find((l) => l.id === id) ?? null;
}
