import Link from "next/link";
import { approveAction, rejectAction } from "@/app/content-actions";
import { Md, MdInline } from "@/components/Md";
import { DifficultyBadge } from "@/components/PracticePlayer";
import { reviewQueue } from "@/lib/ai-generator";
import { getDb } from "@/lib/db";
import { getQuestionsByIds } from "@/lib/repo/questions";
import { SKILL_BY_ID } from "@/lib/taxonomy";

export const metadata = { title: "Review queue" };

export default function ReviewQueuePage() {
  const db = getDb();
  const queue = reviewQueue(db);
  const questions = getQuestionsByIds(db, queue.map((q) => q.id));
  const notes = new Map(queue.map((q) => [q.id, q.notes]));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/content" className="text-sm text-muted hover:underline">
          ← Content tools
        </Link>
        <h1 className="text-2xl font-bold">Review queue</h1>
        <p className="text-muted">
          AI-generated questions that passed the automatic checks. Read each one carefully. Approve only questions that are correct, clear and original.
        </p>
      </div>
      {questions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-10 text-center text-muted">Nothing waiting for review.</div>
      ) : (
        questions.map((q) => {
          const n = notes.get(q.id);
          return (
            <article key={q.id} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5 shadow-sm">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-surface-2 px-2 py-0.5 font-medium">{q.section === "RW" ? "R&W" : "Math"}</span>
                <span className="text-muted">{SKILL_BY_ID.get(q.skill_id)?.name}</span>
                <DifficultyBadge d={q.difficulty} />
                <span className="text-muted">
                  {q.source} · <code>{q.id}</code>
                </span>
              </div>
              {q.passage_md && (
                <div className="reading rounded-xl bg-bg p-4">
                  <Md>{q.passage_md}</Md>
                </div>
              )}
              <Md className={q.section === "RW" ? "reading" : ""}>{q.stem_md}</Md>
              {q.choices ? (
                <ul className="flex flex-col gap-1">
                  {q.choices.map((c, i) => {
                    const L = "ABCD"[i];
                    return (
                      <li key={L} className={`rounded-lg px-2 py-1 ${L === q.answer ? "bg-jade-soft" : ""}`}>
                        <span className="font-bold">{L}.</span> <MdInline>{c}</MdInline>
                        {q.distractor_notes?.[L] && <span className="block pl-5 text-sm text-muted">{q.distractor_notes[L]}</span>}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p>
                  Answer: <strong>{q.answer.split("|").join(" or ")}</strong>
                </p>
              )}
              <div className="rounded-xl border border-line p-3">
                <p className="mb-1 text-sm font-semibold">Explanation</p>
                <Md>{q.explanation_md}</Md>
              </div>
              {n && (
                <p className="text-xs text-muted">
                  Solve-check by {n.solver}: answered {n.solverAnswer}
                  {n.issues ? `; noted: ${n.issues}` : "; no issues noted"}.
                </p>
              )}
              <div className="flex gap-2">
                <form action={approveAction.bind(null, q.id)}>
                  <button className="rounded-lg bg-jade px-4 py-2 text-sm font-semibold text-white dark:text-bg">Approve into bank</button>
                </form>
                <form action={rejectAction.bind(null, q.id)}>
                  <button className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-surface-2">Reject</button>
                </form>
              </div>
            </article>
          );
        })
      )}
    </div>
  );
}
