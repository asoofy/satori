import Link from "next/link";
import { Calendar } from "@/components/Calendar";
import { currentProfile } from "@/lib/current";
import { addDays, daysBetween, formatLong, parseIso, today, weekStart } from "@/lib/dates";
import { getDb } from "@/lib/db";
import { ensurePlanFresh, listPlan, type PlanDay } from "@/lib/planner";
import { activeDays } from "@/lib/repo/progress";
import { gemTotal, levelFor, xpTotal } from "@/lib/rewards";
import { SKILL_TIPS } from "@/lib/skill-tips";
import { currentStreak } from "@/lib/streak";
import { SKILL_BY_ID } from "@/lib/taxonomy";
import { PathNode, type PathNodeData } from "./PathNode";

export const metadata = { title: "Learn Path" };

export default async function PathPage({ searchParams }: PageProps<"/path">) {
  const sp = await searchParams;
  const showAll = sp.range === "all";
  const { profile, settings } = await currentProfile();
  const db = getDb();
  ensurePlanFresh(db, profile.id);
  const plan = listPlan(db, profile.id);
  const t = today();
  const days = activeDays(db, profile.id);
  const xp = xpTotal(db, profile.id);
  const lvl = levelFor(xp);

  if (!plan.length) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-3 py-16 text-center">
        <h1 className="text-2xl font-bold">Your learn path</h1>
        <p className="text-muted">The learn path turns your study plan into one step per day. Build a plan first.</p>
        <Link href="/plan" className="rounded-xl bg-accent px-5 py-2.5 font-semibold text-accent-ink">
          Build my study plan
        </Link>
      </div>
    );
  }

  // Default view: last week through four weeks ahead.
  const from = showAll ? plan[0].date : addDays(weekStart(t), -7);
  const to = showAll ? plan[plan.length - 1].date : addDays(weekStart(t), 34);
  const visible = plan.filter((d) => d.date >= from && d.date <= to);
  const weeks = new Map<string, PlanDay[]>();
  for (const d of visible) weeks.set(weekStart(d.date), [...(weeks.get(weekStart(d.date)) ?? []), d]);
  const nextDay = plan.find((d) => d.date >= t && d.status !== "done");
  const total = plan.reduce((n, d) => n + d.question_count, 0);

  let i = 0;
  const toNode = (d: PlanDay): PathNodeData => ({
    id: d.id,
    date: d.date,
    title: d.title,
    kind: d.kind,
    questionCount: d.question_count,
    started: !!d.set_id,
    state: d.status === "done" ? "done" : d.status === "missed" ? "missed" : d.date === t ? "today" : d.date < t ? "missed" : "locked",
    offset: Math.round(Math.sin(i++ * 0.95) * 80),
    skills: d.skills.map((s) => ({ name: SKILL_BY_ID.get(s)?.name ?? s, tip: SKILL_TIPS[s] ?? "" })),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className="flex flex-col gap-6">
        <div className="rounded-2xl bg-indigo px-5 py-4 text-white shadow-sm dark:text-bg">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xl font-bold">SAT study path</p>
              <p className="text-sm opacity-90">
                {plan.length} study days · {total.toLocaleString()} questions
              </p>
            </div>
            <p className="text-right text-lg font-semibold">
              {settings.test_date ? `Test: ${formatLong(settings.test_date)}` : "No test date set"}
            </p>
          </div>
        </div>

        {!visible.length && <p className="text-muted">No study days in this range.</p>}

        {[...weeks.entries()].map(([w, list]) => (
          <div key={w}>
            <div className="mb-4 flex items-center gap-3 text-xs font-semibold tracking-widest text-muted uppercase">
              <span className="h-px flex-1 bg-line" />
              Week of {parseIso(w).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              <span className="h-px flex-1 bg-line" />
            </div>
            <ol className="flex flex-col items-center gap-6">
              {list.map((d) => (
                <PathNode key={d.id} node={toNode(d)} />
              ))}
            </ol>
          </div>
        ))}

        <div className="text-center">
          <Link href={showAll ? "/path" : "/path?range=all"} className="text-sm text-accent underline">
            {showAll ? "Show the next few weeks only" : "Show the whole path"}
          </Link>
        </div>
      </section>

      <aside className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-line bg-surface p-4 text-center">
          <div>
            <div className="text-xl font-bold">🔥 {currentStreak(days, t)}</div>
            <div className="text-xs text-muted">Streak</div>
          </div>
          <div>
            <div className="text-xl font-bold">💎 {gemTotal(db, profile.id)}</div>
            <div className="text-xs text-muted">Gems</div>
          </div>
          <div>
            <div className="text-xl font-bold">Lv {lvl.level}</div>
            <div className="text-xs text-muted">{xp.toLocaleString()} XP</div>
          </div>
        </div>
        {nextDay && nextDay.date !== t && (
          <p className="rounded-2xl border border-line bg-surface p-4 text-sm text-muted">
            Next study day: <span className="font-medium text-ink">{formatLong(nextDay.date)}</span> ({daysBetween(t, nextDay.date)} day
            {daysBetween(t, nextDay.date) === 1 ? "" : "s"} away).
          </p>
        )}
        <Calendar
          today={t}
          activeDays={days}
          plan={plan.map((d) => ({ date: d.date, status: d.status, title: d.title }))}
          testDate={settings.test_date}
        />
        <Link href="/plan" className="text-center text-sm text-accent underline">
          Change plan settings
        </Link>
      </aside>
    </div>
  );
}
