import Link from "next/link";
import { rebuildPlanAction, startPlanDayAction } from "@/app/actions";
import { currentProfile } from "@/lib/current";
import { daysBetween, formatLong, parseIso, today, weekStart } from "@/lib/dates";
import { getDb } from "@/lib/db";
import { ensurePlanFresh, listPlan, type PlanDay } from "@/lib/planner";
import { PlanSettingsForm } from "./PlanSettingsForm";

export const metadata = { title: "Study Planner" };

export default async function PlanPage() {
  const { profile, settings } = await currentProfile();
  const db = getDb();
  const rebuilt = ensurePlanFresh(db, profile.id);
  const plan = listPlan(db, profile.id);
  const t = today();
  const upcoming = plan.filter((d) => d.date >= t);
  const done = plan.filter((d) => d.status === "done").length;
  const missed = plan.filter((d) => d.status === "missed").length;
  const questionsLeft = upcoming.filter((d) => d.status === "planned").reduce((n, d) => n + d.question_count, 0);
  const weeks = new Map<string, PlanDay[]>();
  for (const d of upcoming) {
    const w = weekStart(d.date);
    weeks.set(w, [...(weeks.get(w) ?? []), d]);
  }
  const studyDays = JSON.parse(settings.study_days_json) as number[];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Study Planner</h1>
          <p className="text-muted">
            {settings.test_date
              ? `A day-by-day plan up to your test on ${formatLong(settings.test_date)} (${daysBetween(t, settings.test_date)} days away).`
              : "No test date set, so the plan covers the next 8 weeks."}{" "}
            It focuses on your weakest skills and rebuilds itself if you miss a day.
          </p>
        </div>
        <Link href="/path" className="rounded-xl border border-line bg-surface px-4 py-2 font-medium hover:bg-surface-2">
          Open learn path →
        </Link>
      </div>

      {rebuilt && (
        <p role="status" className="rounded-lg bg-gold-soft px-3 py-2 text-sm text-gold">
          You missed a planned day, so the rest of your plan was rebuilt around it.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <section className="flex flex-col gap-4">
          {plan.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line p-8 text-center">
              <p className="font-medium">You don’t have a plan yet.</p>
              <p className="mt-1 text-sm text-muted">Pick your study days on the right, then build your plan.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Days done" value={String(done)} />
                <Stat label="Days missed" value={String(missed)} />
                <Stat label="Questions left" value={questionsLeft.toLocaleString()} />
              </div>
              {[...weeks.entries()].map(([w, days]) => (
                <div key={w} className="rounded-2xl border border-line bg-surface">
                  <h2 className="border-b border-line px-4 py-2 text-xs font-semibold tracking-widest text-muted uppercase">
                    Week of {parseIso(w).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </h2>
                  <ul className="divide-y divide-line">
                    {days.map((d) => (
                      <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                        <div className="min-w-0">
                          <p className="text-sm text-muted">
                            {parseIso(d.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                            {d.date === t && <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">Today</span>}
                          </p>
                          <p className="font-medium">{d.title}</p>
                          <p className="text-xs text-muted">
                            {d.kind === "learn" ? "Skill practice" : d.kind === "review" ? "Review" : "Final review"} · {d.question_count} questions
                          </p>
                        </div>
                        {d.status === "done" ? (
                          <span className="rounded-full bg-jade-soft px-3 py-1 text-sm font-medium text-jade">✓ Done</span>
                        ) : d.date === t ? (
                          <form action={startPlanDayAction.bind(null, d.id)}>
                            <button className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink">{d.set_id ? "Continue" : "Start"}</button>
                          </form>
                        ) : (
                          <span className="text-sm text-muted">Planned</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </>
          )}
        </section>

        <aside className="flex flex-col gap-4">
          <div className="rounded-2xl border border-line bg-surface p-4">
            <h2 className="mb-3 font-semibold">Plan settings</h2>
            <PlanSettingsForm studyDays={studyDays} dailyGoal={settings.daily_goal} hasPlan={plan.length > 0} />
            <p className="mt-3 text-xs text-muted">
              Test date and goal score are set in{" "}
              <Link href="/onboarding" className="underline">
                your goals
              </Link>
              .
            </p>
          </div>
          {plan.length > 0 && (
            <form action={rebuildPlanAction} className="rounded-2xl border border-line bg-surface p-4">
              <p className="text-sm text-muted">Rebuild the plan from today using your latest results. Finished days are kept.</p>
              <button className="mt-2 rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-surface-2">Rebuild plan</button>
            </form>
          )}
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 text-center">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm text-muted">{label}</div>
    </div>
  );
}
