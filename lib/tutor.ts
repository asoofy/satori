import type { DB } from "@/lib/db";
import { getQuestion } from "@/lib/repo/questions";
import { skillPriority, skillStats } from "@/lib/session";
import { SKILL_BY_ID } from "@/lib/taxonomy";

export interface TutorContext {
  questionId?: string;
  /** Has the student already submitted an answer to this question? */
  answered?: boolean;
  response?: string;
}

/** System prompt: who the student is (weak skills) and, optionally, the question on screen. */
export function tutorSystem(db: DB, profileId: number, name: string, ctx: TutorContext): string {
  const stats = [...skillStats(db, profileId, 60).values()].filter((s) => s.attempts >= 3);
  const weak = stats
    .sort((a, b) => skillPriority(b) - skillPriority(a))
    .slice(0, 4)
    .map((s) => `${SKILL_BY_ID.get(s.skill_id)!.name} (${Math.round((s.accuracy ?? 0) * 100)}% of ${s.attempts})`);
  const lines = [
    `You are a friendly, encouraging SAT tutor inside Satori, a free study app. The student's name is ${name}.`,
    "Teach, don't just tell: ask a guiding question or give a hint before a full solution, keep replies short (a few sentences or a short list), and use Markdown with $...$ for math.",
    "Stay on SAT preparation and study skills. Never claim to know official SAT scores or unreleased test content.",
    weak.length ? `The student's weakest skills recently: ${weak.join("; ")}.` : "The student hasn't answered enough questions for us to know their weak skills yet.",
  ];
  const q = ctx.questionId ? getQuestion(db, ctx.questionId) : null;
  if (q) {
    lines.push(
      "",
      "The student is looking at this question:",
      q.passage_md ? `Passage:\n${q.passage_md}` : "",
      `Question:\n${q.stem_md}`,
      q.choices ? q.choices.map((c, i) => `${"ABCD"[i]}. ${c}`).join("\n") : "(Student-produced response: the student types a number.)",
      `Skill: ${SKILL_BY_ID.get(q.skill_id)?.name}.`,
    );
    if (ctx.answered) {
      lines.push(
        `The student answered ${ctx.response || "(nothing)"}. The correct answer is ${q.answer}.`,
        `Official explanation:\n${q.explanation_md}`,
        "Help them understand why, and address their specific mistake if they got it wrong.",
      );
    } else {
      lines.push(
        `(For your reference only: the answer is ${q.answer}.) The student has NOT answered yet. Do not reveal the answer or eliminate choices for them; give hints and ask guiding questions so they can solve it themselves.`,
      );
    }
  }
  return lines.filter((l) => l !== "").join("\n");
}
