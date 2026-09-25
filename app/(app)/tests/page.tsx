import Link from "next/link";
import { startTestAction } from "@/app/test-actions";
import { currentProfile } from "@/lib/current";
import { getDb } from "@/lib/db";
import { listTests, TEST_LABEL } from "@/lib/tests";

export const metadata = { title: "Practice Tests" };

export default async function TestsPage() {
  const { profile } = await currentProfile();
  const tests = listTests(getDb(), profile.id);
  const bank = getDb().prepare("SELECT section, COUNT(*) AS n FROM questions WHERE status = 'active' AND generator_id IS NULL GROUP BY section").all() as { section: string; n: number }[];
  const rwOriginal = bank.find((b) => b.section === "RW")?.n ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Practice Tests</h1>
        <p className="text-muted">
          Timed tests in the digital SAT format: two adaptive modules per section. Scores are estimates, not official scores.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <Option
          title="Full-length test"
          lines={["Reading & Writing: 2 × 27 questions, 32 min each", "10-minute break", "Math: 2 × 22 questions, 35 min each", "About 2 h 25 min"]}
        >
          <form action={startTestAction.bind(null, "full", null)}>
            <button className="w-full rounded-xl bg-accent px-4 py-2.5 font-semibold text-accent-ink hover:opacity-90">Start full test</button>
          </form>
        </Option>
        <Option title="Section test" lines={["One section, both adaptive modules", "R&W about 64 min · Math about 70 min"]}>
          <div className="flex gap-2">
            <form action={startTestAction.bind(null, "section", "RW")} className="flex-1">
              <button className="w-full rounded-xl border border-line px-3 py-2.5 font-medium hover:bg-surface-2">R&amp;W</button>
            </form>
            <form action={startTestAction.bind(null, "section", "MATH")} className="flex-1">
              <button className="w-full rounded-xl border border-line px-3 py-2.5 font-medium hover:bg-surface-2">Math</button>
            </form>
          </div>
        </Option>
        <Option title="Single module" lines={["One 27- or 22-question module at mixed difficulty", "32 or 35 minutes"]}>
          <div className="flex gap-2">
            <form action={startTestAction.bind(null, "module", "RW")} className="flex-1">
              <button className="w-full rounded-xl border border-line px-3 py-2.5 font-medium hover:bg-surface-2">R&amp;W</button>
            </form>
            <form action={startTestAction.bind(null, "module", "MATH")} className="flex-1">
              <button className="w-full rounded-xl border border-line px-3 py-2.5 font-medium hover:bg-surface-2">Math</button>
            </form>
          </div>
        </Option>
      </section>

      <p className="text-sm text-muted">
        Tests use questions you haven’t seen first. The bank has {rwOriginal} hand-written Reading &amp; Writing questions, so after a couple of full
        tests some R&amp;W questions will repeat. Math modules also draw on generated questions.
      </p>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Your tests</h2>
        {tests.length === 0 ? (
          <p className="text-muted">No tests yet.</p>
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {tests.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-medium">
                    {TEST_LABEL[t.kind]}
                    {t.kind !== "full" && <span className="text-muted"> · {t.sections[0] === "RW" ? "Reading & Writing" : "Math"}</span>}
                  </p>
                  <p className="text-sm text-muted">
                    {new Date(t.created_at + "Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} ·{" "}
                    {t.phase === "done" ? "Completed" : t.phase === "abandoned" ? "Abandoned" : "In progress"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {t.phase === "done" && (
                    <span className="text-lg font-bold tabular-nums">
                      {t.kind === "full" ? (t.rw_score ?? 0) + (t.math_score ?? 0) : (t.rw_score ?? t.math_score)}
                      <span className="ml-1 text-xs font-normal text-muted">est.</span>
                    </span>
                  )}
                  {t.phase === "done" ? (
                    <Link href={`/tests/${t.id}`} className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-surface-2">
                      Score report
                    </Link>
                  ) : t.phase !== "abandoned" ? (
                    <Link href={`/take/${t.id}`} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink">
                      Resume
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Option({ title, lines, children }: { title: string; lines: string[]; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <h2 className="text-lg font-semibold">{title}</h2>
      <ul className="flex-1 space-y-1 text-sm text-muted">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      {children}
    </div>
  );
}
