"use client";

import { useActionState } from "react";
import { type FormState, savePlanSettings } from "@/app/actions";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function PlanSettingsForm({ studyDays, dailyGoal, hasPlan }: { studyDays: number[]; dailyGoal: number; hasPlan: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(savePlanSettings, { ok: true });
  return (
    <form action={action} className="flex flex-col gap-4">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Days I can study</legend>
        <div className="grid grid-cols-7 gap-1">
          {DAYS.map((d, i) => (
            <label key={d} className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-line p-1.5 text-xs has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-indigo">
              <input type="checkbox" name="days" value={i} defaultChecked={studyDays.includes(i)} className="sr-only" />
              <span aria-hidden="true">{d[0]}</span>
              <span className="sr-only">{d}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Questions per study day
        <select name="daily_goal" defaultValue={dailyGoal} className="rounded-lg border border-line bg-bg px-2 py-2 font-normal">
          {[5, 10, 15, 20, 30, 40].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      {state.error && (
        <p role="alert" className="text-sm text-rose">
          {state.error}
        </p>
      )}
      <button disabled={pending} className="rounded-xl bg-accent px-4 py-2 font-semibold text-accent-ink disabled:opacity-60">
        {pending ? "Building…" : hasPlan ? "Save and rebuild" : "Build my plan"}
      </button>
    </form>
  );
}
