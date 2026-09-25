import Link from "next/link";
import { AccuracyBar, ActivityChart, TrendChart } from "@/components/Charts";
import { fmtTime } from "@/lib/format";
import { breakdown, dailyCounts, totals, weeklyTrend } from "@/lib/analytics";
import { currentProfile } from "@/lib/current";
import { addDays, parseIso, today, weekStart } from "@/lib/dates";
import { getDb } from "@/lib/db";
import { scoredAttempts } from "@/lib/repo/progress";
import { MIN_ANSWERS, predict } from "@/lib/scoring";
import { skillPriority, skillStats } from "@/lib/session";
import { DOMAINS, SKILL_BY_ID } from "@/lib/taxonomy";

export const metadata = { title: "Analytics" };

const short = (d: string) => parseIso(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default async function AnalyticsPage() {
  const { profile } = await currentProfile();
  const db = getDb();
  const tot = totals(db, profile.id);
  const prediction = predict(scoredAttempts(db, profile.id));

  if (tot.attempts === 0) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-3 py-16 text-center">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted">Answer some questions and your accuracy, timing and trends will show up here.</p>
        <Link href="/questions" className="rounded-xl bg-accent px-5 py-2.5 font-semibold text-accent-ink">
          Start practicing
        </Link>
      </div>
    );
  }

  const bySection = new Map(breakdown(db, profile.id, "section").map((r) => [r.key, r]));
  const byDomain = new Map(breakdown(db, profile.id, "domain").map((r) => [r.key, r]));
  const bySkill = new Map(breakdown(db, profile.id, "skill").map((r) => [r.key, r]));
  const byDiff = new Map(breakdown(db, profile.id, "difficulty").map((r) => [r.key, r]));

  // Weekly trend: the last 12 weeks, Monday-based.
  const t = today();
  const weeks = Array.from({ length: 12 }, (_, i) => addDays(weekStart(t), -7 * (11 - i)));
  const trend = weeklyTrend(db, profile.id, 12);
  const seriesFor = (section: "RW" | "MATH") => {
    const map = new Map(trend.filter((p) => p.section === section).map((p) => [p.week, p]));
    return {
      values: weeks.map((w) => (map.get(w) ? map.get(w)!.accuracy : null)),
      counts: weeks.map((w) => map.get(w)?.attempts ?? 0),
    };
  };
  const daily = dailyCounts(db, profile.id, 30);
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = addDays(t, i - 29);
    const v = daily.get(d);
    return { date: d, label: short(d), attempts: v?.attempts ?? 0, correct: v?.correct ?? 0 };
  });

  const weakest = [...skillStats(db, profile.id).values()]
    .filter((s) => s.attempts >= 3)
    .sort((a, b) => skillPriority(b) - skillPriority(a))
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted">How you’re doing across sections, skills and difficulty levels.</p>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Questions answered" value={tot.attempts.toLocaleString()} />
        <Tile label="Accuracy" value={`${Math.round((tot.correct / tot.attempts) * 100)}%`} />
        <Tile label="Avg. time per question" value={fmtTime(tot.avgTimeMs)} />
        <Tile
          label="Predicted score (estimate)"
          value={prediction.total ? `${prediction.total.score}` : "—"}
          sub={prediction.total ? `± ${prediction.total.margin}` : `needs ${MIN_ANSWERS}+ per section`}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {(["RW", "MATH"] as const).map((sec) => {
          const r = bySection.get(sec);
          const est = sec === "RW" ? prediction.rw : prediction.math;
          return (
            <Card key={sec} title={sec === "RW" ? "Reading and Writing" : "Math"}>
              {r ? (
                <dl className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <dt className="text-xs text-muted">Accuracy</dt>
                    <dd className="text-2xl font-bold">{Math.round(r.accuracy * 100)}%</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Avg. time</dt>
                    <dd className="text-2xl font-bold">{fmtTime(r.avgTimeMs)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Estimate</dt>
                    <dd className="text-2xl font-bold">{est ? est.score : "—"}</dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-muted">No answers in this section yet.</p>
              )}
            </Card>
          );
        })}
      </section>

      <Card title="Accuracy by week">
        <TrendChart
          title="Weekly accuracy for Reading and Writing and for Math over the last 12 weeks"
          xLabels={weeks.map(short)}
          series={[
            { key: "RW", label: "R&W", color: "var(--series-rw)", ...seriesFor("RW") },
            { key: "MATH", label: "Math", color: "var(--series-math)", ...seriesFor("MATH") },
          ]}
        />
      </Card>

      <Card title="Questions answered per day (last 30 days)">
        <ActivityChart title="Questions answered per day over the last 30 days" days={days} />
      </Card>

      {weakest.length > 0 && (
        <Card title="Weakest skills">
          <ol className="divide-y divide-line">
            {weakest.map((s, i) => (
              <li key={s.skill_id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span>
                  <span className="mr-2 text-muted tabular-nums">{i + 1}.</span>
                  <span className="font-medium">{SKILL_BY_ID.get(s.skill_id)?.name}</span>
                  <span className="ml-2 text-sm text-muted">
                    {Math.round((s.accuracy ?? 0) * 100)}% of {s.attempts}
                  </span>
                </span>
                <Link href={`/questions?skill=${s.skill_id}&status=unanswered`} className="rounded-lg border border-line px-3 py-1 text-sm hover:bg-surface-2">
                  Practice
                </Link>
              </li>
            ))}
          </ol>
        </Card>
      )}

      <Card title="By difficulty">
        <table className="w-full text-left text-sm [&_td]:pr-4 [&_th]:pr-4">
          <thead>
            <tr className="text-muted">
              <th className="py-1 font-medium">Difficulty</th>
              <th className="py-1 font-medium">Answered</th>
              <th className="py-1 font-medium">Accuracy</th>
              <th className="py-1 font-medium">Avg. time</th>
            </tr>
          </thead>
          <tbody>
            {(["1", "2", "3"] as const).map((d) => {
              const r = byDiff.get(d);
              return (
                <tr key={d} className="border-t border-line">
                  <td className="py-2">{{ 1: "Easy", 2: "Medium", 3: "Hard" }[d]}</td>
                  <td className="py-2 tabular-nums">{r?.attempts ?? 0}</td>
                  <td className="py-2">{r ? <AccuracyBar value={r.accuracy} label={`${r.correct} of ${r.attempts} correct`} /> : "—"}</td>
                  <td className="py-2 tabular-nums">{r ? fmtTime(r.avgTimeMs) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card title="By domain and skill">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm [&_td]:pr-4 [&_th]:pr-4">
            <thead>
              <tr className="text-muted">
                <th className="py-1 font-medium">Skill</th>
                <th className="py-1 font-medium">Answered</th>
                <th className="py-1 font-medium">Accuracy</th>
                <th className="py-1 font-medium">Avg. time</th>
              </tr>
            </thead>
            {DOMAINS.map((d) => {
              const dr = byDomain.get(d.id);
              return (
                <tbody key={d.id}>
                  <tr className="border-t-2 border-line bg-surface-2">
                    <th scope="rowgroup" className="py-2 pl-2 font-semibold">
                      {d.section === "RW" ? "R&W" : "Math"} · {d.name}
                    </th>
                    <td className="py-2 tabular-nums">{dr?.attempts ?? 0}</td>
                    <td className="py-2">{dr ? <AccuracyBar value={dr.accuracy} label={`${dr.correct} of ${dr.attempts} correct`} /> : "—"}</td>
                    <td className="py-2 tabular-nums">{dr ? fmtTime(dr.avgTimeMs) : "—"}</td>
                  </tr>
                  {d.skills.map((s) => {
                    const r = bySkill.get(s.id);
                    return (
                      <tr key={s.id} className="border-t border-line">
                        <td className="py-2 pl-5">
                          <Link href={`/questions?skill=${s.id}`} className="hover:underline">
                            {s.name}
                          </Link>
                        </td>
                        <td className="py-2 tabular-nums">{r?.attempts ?? 0}</td>
                        <td className="py-2">{r ? <AccuracyBar value={r.accuracy} label={`${r.correct} of ${r.attempts} correct`} /> : <span className="text-muted">—</span>}</td>
                        <td className="py-2 tabular-nums">{r ? fmtTime(r.avgTimeMs) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              );
            })}
          </table>
        </div>
      </Card>

      <p className="text-xs text-muted">
        Predicted scores are estimates from your practice answers, weighted by difficulty and recency. They are not official scores.{" "}
        <Link href="/scoring" className="underline">
          How the estimate works
        </Link>
        .
      </p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-1 text-3xl font-semibold">{value}</div>
      {sub && <div className="text-sm text-muted">{sub}</div>}
    </div>
  );
}
