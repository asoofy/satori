import Link from "next/link";
import { startSession } from "@/app/actions";
import { Icon } from "@/components/Shell";
import { gettingStarted } from "@/lib/checklist";
import { currentProfile } from "@/lib/current";
import { daysBetween, formatLong, greeting, today } from "@/lib/dates";
import { getDb } from "@/lib/db";
import { activeDays, answeredToday, scoredAttempts, totalAttempts } from "@/lib/repo/progress";
import { ensurePlanFresh, planDayFor } from "@/lib/planner";
import { gemTotal, levelFor, xpTotal } from "@/lib/rewards";
import { MIN_ANSWERS, predict } from "@/lib/scoring";
import { skillPriority, skillStats } from "@/lib/session";
import { currentStreak } from "@/lib/streak";
import { SKILL_BY_ID } from "@/lib/taxonomy";

export const metadata = { title: "Home" };

export default async function HomePage() {
  const { profile, settings } = await currentProfile();
  const db = getDb();
  const now = new Date();
  const t = today();
  const streak = currentStreak(activeDays(db, profile.id), t);
  const doneToday = answeredToday(db, profile.id);
  const attempts = scoredAttempts(db, profile.id);
  const prediction = predict(attempts);
  const total = totalAttempts(db, profile.id);
  const daysLeft = settings.test_date ? daysBetween(t, settings.test_date) : null;
  const rwCount = attempts.filter((a) => a.section === "RW").length;
  const mathCount = attempts.filter((a) => a.section === "MATH").length;

  const stats = [...skillStats(db, profile.id, 60).values()].filter((s) => s.attempts >= 3);
  const focus = stats.sort((a, b) => skillPriority(b) - skillPriority(a)).slice(0, 3);
  const goalPct = Math.min(100, Math.round((doneToday / settings.daily_goal) * 100));
  ensurePlanFresh(db, profile.id);
  const planToday = planDayFor(db, profile.id, t);
  const xp = xpTotal(db, profile.id);
  const lvl = levelFor(xp);
  const gems = gemTotal(db, profile.id);
  const checklist = gettingStarted(db, profile.id);
  const checklistDone = checklist.filter((c) => c.done).length;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {greeting(now.getHours())}, <span className="text-accent">{profile.name}</span>
          </h1>
          <p className="mt-1 text-muted">
            {total === 0
              ? "Let’s start with a short mixed session to see where you are."
              : doneToday >= settings.daily_goal
                ? "Daily goal done. Anything more is a bonus."
                : `${settings.daily_goal - doneToday} more question${settings.daily_goal - doneToday === 1 ? "" : "s"} to reach today’s goal.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2" aria-label="Streak and today’s progress">
          <Pill title="Days in a row with at least one answered question">
            <span aria-hidden="true">🔥</span> {streak} day{streak === 1 ? "" : "s"}
          </Pill>
          <Pill title="Questions answered today">
            <span aria-hidden="true">✅</span> {doneToday}/{settings.daily_goal} today
          </Pill>
          <Pill title={`Level ${lvl.level}: ${lvl.into}/${lvl.span} XP to the next level`}>
            <span aria-hidden="true">⭐</span> Lv {lvl.level}
          </Pill>
          <Pill title="Gems earned from milestones">
            <span aria-hidden="true">💎</span> {gems}
          </Pill>
        </div>
      </section>

      <section className="flex flex-col gap-3 sm:flex-row">
        <form action={startSession}>
          <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 font-semibold text-accent-ink shadow-sm hover:opacity-90 sm:w-auto">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
              <path d="M7 4v16l13-8z" />
            </svg>
            Start today’s session
          </button>
        </form>
        <Link href="/questions" className="flex items-center justify-center gap-2 rounded-xl border border-line bg-surface px-5 py-3 font-medium hover:bg-surface-2">
          <Icon name="bank" className="h-4 w-4" /> Browse the question bank
        </Link>
      </section>

      {planToday && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4">
          <div>
            <p className="text-xs font-semibold tracking-widest text-muted uppercase">Today’s plan</p>
            <p className="font-semibold">{planToday.title}</p>
            <p className="text-sm text-muted">{planToday.question_count} questions{planToday.status === "done" ? " · done ✓" : ""}</p>
          </div>
          <Link href="/path" className="text-sm text-accent underline">
            View learn path
          </Link>
        </div>
      )}

      {checklistDone < checklist.length && (
        <section id="getting-started" className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Getting started</h2>
            <span className="text-sm text-muted tabular-nums">
              {checklistDone}/{checklist.length}
            </span>
          </div>
          <ul className="mt-3 flex flex-col gap-2">
            {checklist.map((c) => (
              <li key={c.id} className="flex items-start gap-3">
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs ${c.done ? "border-jade bg-jade text-white dark:text-bg" : "border-muted"}`}
                  aria-hidden="true"
                >
                  {c.done ? "✓" : ""}
                </span>
                <div>
                  {c.done ? (
                    <span className="text-muted line-through">{c.label}</span>
                  ) : (
                    <Link href={c.href} className="font-medium hover:underline">
                      {c.label}
                    </Link>
                  )}
                  <span className="sr-only">{c.done ? " (done)" : " (not done)"}</span>
                  {!c.done && <p className="text-sm text-muted">{c.hint}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label="Daily goal progress" aria-valuenow={goalPct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-jade transition-all" style={{ width: `${goalPct}%` }} />
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">SAT countdown</h2>
          {daysLeft !== null && settings.test_date ? (
            daysLeft >= 0 ? (
              <>
                <p className="mt-2 text-5xl font-bold tabular-nums">{daysLeft}</p>
                <p className="text-muted">day{daysLeft === 1 ? "" : "s"} until {formatLong(settings.test_date)}</p>
              </>
            ) : (
              <p className="mt-2 text-muted">Your test date ({formatLong(settings.test_date)}) has passed. Set your next one.</p>
            )
          ) : (
            <p className="mt-2 text-muted">No test date set yet.</p>
          )}
          <Link href="/onboarding" className="mt-3 inline-block text-sm text-accent underline">
            {settings.test_date ? "Change date" : "Set test date"}
          </Link>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Scores</h2>
          <dl className="mt-2 grid grid-cols-2 gap-3">
            <div>
              <dt className="text-sm text-muted">Goal</dt>
              <dd className="text-3xl font-bold tabular-nums text-accent">{settings.goal_score}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Current</dt>
              <dd className="text-3xl font-bold tabular-nums">{settings.current_score ?? "—"}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-muted">Current is the score you entered from a past test.</p>
          <Link href="/onboarding" className="mt-2 inline-block text-sm text-accent underline">
            Edit goals
          </Link>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Predicted score</h2>
          {prediction.total ? (
            <>
              <p className="mt-2 text-4xl font-bold tabular-nums">
                {prediction.total.score}
                <span className="ml-1 text-lg font-medium text-muted">± {prediction.total.margin}</span>
              </p>
              <p className="text-sm text-muted">
                R&amp;W {prediction.rw!.score} · Math {prediction.math!.score}
              </p>
            </>
          ) : (
            <div className="mt-2 text-sm text-muted">
              <p>Answer at least {MIN_ANSWERS} questions in each section to see an estimate.</p>
              <ul className="mt-2 space-y-1">
                <li>
                  R&amp;W: {Math.min(rwCount, MIN_ANSWERS)}/{MIN_ANSWERS}
                  {prediction.rw && <span className="ml-1 text-ink">→ {prediction.rw.score}</span>}
                </li>
                <li>
                  Math: {Math.min(mathCount, MIN_ANSWERS)}/{MIN_ANSWERS}
                  {prediction.math && <span className="ml-1 text-ink">→ {prediction.math.score}</span>}
                </li>
              </ul>
            </div>
          )}
          <p className="mt-2 text-xs text-muted">
            An estimate from your practice answers, not an official score.
          </p>
        </Card>
      </section>

      {focus.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Focus areas</h2>
          <ul className="mt-3 divide-y divide-line">
            {focus.map((s) => {
              const info = SKILL_BY_ID.get(s.skill_id)!;
              return (
                <li key={s.skill_id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div>
                    <p className="font-medium">{info.name}</p>
                    <p className="text-sm text-muted">
                      {info.section === "RW" ? "Reading & Writing" : "Math"} · {Math.round((s.accuracy ?? 0) * 100)}% correct over {s.attempts} answers
                    </p>
                  </div>
                  <Link
                    href={`/questions?skill=${s.skill_id}&status=unanswered`}
                    className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-surface-2"
                  >
                    Practice
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">{children}</div>;
}

function Pill({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <span title={title} className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-medium tabular-nums">
      {children}
    </span>
  );
}
