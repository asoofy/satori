import { currentProfile } from "@/lib/current";
import { getDb } from "@/lib/db";
import { RushGame } from "./RushGame";

export const metadata = { title: "Question Rush" };

export default async function RushPage() {
  const { profile } = await currentProfile();
  const runs = getDb()
    .prepare("SELECT section, duration_s, answered, correct, best_streak, created_at FROM rush_runs WHERE profile_id = ? ORDER BY correct DESC, best_streak DESC, id LIMIT 5")
    .all(profile.id) as { section: string | null; duration_s: number; answered: number; correct: number; best_streak: number; created_at: string }[];
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Question Rush</h1>
        <p className="text-muted">Answer as many questions as you can before the clock runs out. A wrong answer resets your streak.</p>
      </div>
      <RushGame />
      {runs.length > 0 && (
        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="mb-2 font-semibold">Your best runs</h2>
          <ol className="divide-y divide-line">
            {runs.map((r, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
                <span>
                  <span className="mr-2 text-muted tabular-nums">{i + 1}.</span>
                  <span className="font-semibold">{r.correct} correct</span> of {r.answered} · best streak {r.best_streak}
                </span>
                <span className="text-muted">
                  {r.section === "RW" ? "R&W" : r.section === "MATH" ? "Math" : "Mixed"} · {r.duration_s / 60} min ·{" "}
                  {new Date(r.created_at + "Z").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
