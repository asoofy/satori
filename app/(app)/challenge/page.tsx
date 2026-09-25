import { startChallenge } from "@/app/rush-actions";
import { currentProfile } from "@/lib/current";
import { getDb } from "@/lib/db";

export const metadata = { title: "Challenge Questions" };

export default async function ChallengePage() {
  const { profile } = await currentProfile();
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT q.section, COUNT(*) AS total,
              SUM(EXISTS(SELECT 1 FROM attempts a WHERE a.profile_id = ? AND a.question_id = q.id AND a.correct = 1)) AS solved
       FROM questions q WHERE q.status = 'active' AND q.difficulty = 3 GROUP BY q.section`,
    )
    .all(profile.id) as { section: string; total: number; solved: number }[];
  const stat = (s: string) => rows.find((r) => r.section === s) ?? { total: 0, solved: 0 };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Challenge Questions</h1>
        <p className="text-muted">Only the hardest questions in the bank, in sets of 10. Ones you haven’t solved come first.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {(
          [
            ["RW", "Reading & Writing"],
            ["MATH", "Math"],
            [null, "Mixed"],
          ] as const
        ).map(([s, label]) => {
          const st = s ? stat(s) : { total: stat("RW").total + stat("MATH").total, solved: stat("RW").solved + stat("MATH").solved };
          const pct = st.total ? Math.round((st.solved / st.total) * 100) : 0;
          return (
            <div key={label} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5 shadow-sm">
              <h2 className="text-lg font-semibold">{label}</h2>
              <p className="text-sm text-muted">
                Solved {st.solved} of {st.total} hard questions
              </p>
              <div className="h-2 rounded-full bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${label} challenge progress`}>
                <div className="h-full rounded-full bg-jade" style={{ width: `${pct}%` }} />
              </div>
              <form action={startChallenge.bind(null, s)}>
                <button disabled={!st.total} className="w-full rounded-xl bg-accent px-4 py-2.5 font-semibold text-accent-ink hover:opacity-90 disabled:opacity-50">
                  Start 10 hard questions
                </button>
              </form>
            </div>
          );
        })}
      </div>
    </div>
  );
}
