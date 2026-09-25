"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { type FormState, saveOnboarding } from "@/app/actions";
import { upcomingTestDates } from "@/lib/test-dates";

export function OnboardingForm({
  initial,
  editing,
}: {
  initial: { name: string; test_date: string; goal_score: number; current_score: number | null; daily_goal: number };
  editing: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveOnboarding, { ok: true });
  const [goal, setGoal] = useState(initial.goal_score);
  const dates = upcomingTestDates(new Date(), 8);
  const [date, setDate] = useState(initial.test_date);
  const custom = date !== "" && !dates.includes(date);

  return (
    <form action={action} className="flex flex-col gap-6 rounded-2xl border border-line bg-surface p-6 shadow-sm">
      <label className="flex flex-col gap-1.5">
        <span className="font-medium">What should we call you?</span>
        <input
          name="name"
          required
          maxLength={40}
          defaultValue={initial.name}
          autoComplete="given-name"
          className="rounded-lg border border-line bg-bg px-3 py-2"
          placeholder="Your first name"
        />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 font-medium">When is your test?</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {dates.map((d) => (
            <button
              type="button"
              key={d}
              onClick={() => setDate(d)}
              aria-pressed={date === d}
              className={`rounded-lg border px-2 py-2 text-sm ${date === d ? "border-accent bg-accent-soft font-semibold text-accent" : "border-line hover:bg-surface-2"}`}
            >
              {new Date(d + "T00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </button>
          ))}
        </div>
        <label className="mt-1 flex items-center gap-2 text-sm text-muted">
          Or pick a date:
          <input
            type="date"
            value={custom ? date : ""}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-line bg-bg px-2 py-1 text-ink"
          />
          <button type="button" onClick={() => setDate("")} className="underline">
            Not decided yet
          </button>
        </label>
        <p className="text-xs text-muted">
          Dates shown follow the usual pattern of SAT weekend dates; confirm the official date when you register.
        </p>
        <input type="hidden" name="test_date" value={date} />
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className="font-medium">
          Goal score: <span className="text-accent">{goal}</span>
        </span>
        <input
          type="range"
          name="goal_score"
          min={400}
          max={1600}
          step={10}
          value={goal}
          onChange={(e) => setGoal(Number(e.target.value))}
          className="accent-[var(--accent)]"
        />
        <span className="flex justify-between text-xs text-muted">
          <span>400</span>
          <span>1600</span>
        </span>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="font-medium">
          Current score <span className="font-normal text-muted">(optional — from a past test or practice test)</span>
        </span>
        <input
          type="number"
          name="current_score"
          min={400}
          max={1600}
          step={10}
          defaultValue={initial.current_score ?? ""}
          className="w-40 rounded-lg border border-line bg-bg px-3 py-2"
          placeholder="e.g. 1150"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="font-medium">Daily goal (questions per day)</span>
        <select name="daily_goal" defaultValue={initial.daily_goal} className="w-40 rounded-lg border border-line bg-bg px-3 py-2">
          {[5, 10, 15, 20, 30, 40].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>

      {state.error && (
        <p role="alert" className="rounded-lg bg-rose-soft px-3 py-2 text-sm text-rose">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-accent px-5 py-2.5 font-semibold text-accent-ink shadow-sm hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Saving…" : editing ? "Save" : "Start studying"}
        </button>
        {editing && (
          <Link href="/" className="text-sm text-muted underline">
            Cancel
          </Link>
        )}
      </div>
    </form>
  );
}
