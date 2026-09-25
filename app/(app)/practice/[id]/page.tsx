import { notFound } from "next/navigation";
import { PracticePlayer } from "@/components/PracticePlayer";
import { aiConfigured } from "@/lib/ai";
import { currentProfile } from "@/lib/current";
import { getDb } from "@/lib/db";
import { toPlayerQuestions } from "@/lib/player";
import { getPracticeSet } from "@/lib/repo/profile";
import { getQuestionsByIds } from "@/lib/repo/questions";
import type { AttemptContext } from "@/lib/repo/progress";

export const metadata = { title: "Practice" };

export default async function PracticePage({ params }: PageProps<"/practice/[id]">) {
  const { id } = await params;
  const { profile } = await currentProfile();
  const db = getDb();
  const set = getPracticeSet(db, Number(id));
  if (!set || set.profile_id !== profile.id) notFound();
  const questions = toPlayerQuestions(db, profile.id, getQuestionsByIds(db, set.question_ids));
  if (!questions.length) notFound();
  const context: AttemptContext =
    set.kind === "redo" ? "redo" : set.kind === "challenge" ? "challenge" : set.kind === "session" || set.kind === "plan" ? "session" : "practice";
  const backHrefs: Record<string, string> = { redo: "/saved?tab=mistakes", session: "/", plan: "/path", challenge: "/challenge" };
  const backHref = backHrefs[set.kind] ?? "/questions";
  return <PracticePlayer key={set.id} title={set.title} questions={questions} context={context} backHref={backHref} tutor={aiConfigured()} />;
}
