import Link from "next/link";
import { practiceOne, practiceSaved, redoMistakes } from "@/app/actions";
import { DifficultyBadge } from "@/components/PracticePlayer";
import { currentProfile } from "@/lib/current";
import { getDb } from "@/lib/db";
import { getQuestionsByIds, previewText } from "@/lib/repo/questions";
import { mistakeIds, savedList } from "@/lib/repo/progress";
import { SKILL_BY_ID } from "@/lib/taxonomy";

export const metadata = { title: "Saved & Mistakes" };

export default async function SavedPage({ searchParams }: PageProps<"/saved">) {
  const sp = await searchParams;
  const tab = sp.tab === "mistakes" ? "mistakes" : "saved";
  const { profile } = await currentProfile();
  const db = getDb();
  const saved = savedList(db, profile.id);
  const mistakes = mistakeIds(db, profile.id);
  const ids = tab === "saved" ? saved : mistakes;
  const questions = getQuestionsByIds(db, ids);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold">Saved &amp; Mistakes</h1>
        <p className="text-muted">Questions you bookmarked, and questions whose most recent answer was wrong.</p>
      </div>

      <div role="tablist" aria-label="Lists" className="flex gap-2">
        <TabLink href="/saved" active={tab === "saved"} label={`Saved (${saved.length})`} />
        <TabLink href="/saved?tab=mistakes" active={tab === "mistakes"} label={`Mistakes (${mistakes.length})`} />
      </div>

      {tab === "mistakes" && mistakes.length > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">Redo my mistakes</h2>
            <p className="text-sm text-muted">
              Work through {Math.min(30, mistakes.length)} of your missed questions again. Answer one correctly and it leaves this list.
            </p>
          </div>
          <form action={redoMistakes}>
            <button className="w-full rounded-xl bg-accent px-5 py-2.5 font-semibold text-accent-ink hover:opacity-90 sm:w-auto">Start redo set</button>
          </form>
        </div>
      )}
      {tab === "saved" && saved.length > 0 && (
        <form action={practiceSaved} className="flex justify-end">
          <button className="rounded-xl bg-accent px-5 py-2.5 font-semibold text-accent-ink hover:opacity-90">Practice saved questions</button>
        </form>
      )}

      {questions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-10 text-center text-muted">
          {tab === "saved" ? (
            <>Nothing saved yet. Use the Save button while practicing to bookmark a question.</>
          ) : (
            <>No mistakes to review. Nice work — or <Link className="text-accent underline" href="/questions">go practice</Link> to find some.</>
          )}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {questions.map((q) => (
            <li key={q.id} className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 font-medium">{q.section === "RW" ? "R&W" : "Math"}</span>
                  <span className="text-muted">{SKILL_BY_ID.get(q.skill_id)?.name}</span>
                  <DifficultyBadge d={q.difficulty} />
                </div>
                <p className="line-clamp-2 text-sm">{previewText(q.stem_md, q.passage_md)}</p>
              </div>
              <form action={practiceOne.bind(null, q.id)}>
                <button className="w-full rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-surface-2 sm:w-auto">Try again</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TabLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      className={`rounded-full border px-4 py-1.5 text-sm ${active ? "border-accent bg-accent-soft font-semibold text-accent" : "border-line hover:bg-surface-2"}`}
    >
      {label}
    </Link>
  );
}
