"use client";

import { useActionState, useState } from "react";
import { createCustomLessonAction, type CustomLessonState } from "@/app/content-actions";

export function CustomLessonForm({
  groups,
  suggested,
  aiAvailable,
}: {
  groups: { id: string; label: string; skills: { id: string; name: string; detail: string }[] }[];
  suggested: string[];
  aiAvailable: boolean;
}) {
  const [state, action, pending] = useActionState<CustomLessonState, FormData>(createCustomLessonAction, { ok: true });
  const [picked, setPicked] = useState<string[]>(suggested);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 3 ? p : [...p, id]));

  return (
    <form action={action} className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-sm">
      {suggested.length > 0 && <p className="text-sm text-muted">Your weakest skills are pre-selected.</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {groups.map((g) => (
          <fieldset key={g.id}>
            <legend className="mb-1 text-xs font-semibold tracking-widest text-muted uppercase">{g.label}</legend>
            <ul className="flex flex-col gap-1">
              {g.skills.map((s) => (
                <li key={s.id}>
                  <label className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm ${picked.includes(s.id) ? "bg-accent-soft" : "hover:bg-surface-2"}`}>
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="skills"
                        value={s.id}
                        checked={picked.includes(s.id)}
                        onChange={() => toggle(s.id)}
                        disabled={!picked.includes(s.id) && picked.length >= 3}
                      />
                      {s.name}
                    </span>
                    <span className="text-xs text-muted">{s.detail}</span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        ))}
      </div>
      {aiAvailable ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="ai" defaultChecked />
          Write the lesson with AI, tailored to your recent mistakes
        </label>
      ) : (
        <p className="text-xs text-muted">The lesson is built from Satori’s lesson library and your stats. (Configure an AI provider to get lessons written for your mistakes.)</p>
      )}
      {state.error && (
        <p role="alert" className="text-sm text-rose">
          {state.error}
        </p>
      )}
      <button disabled={pending || picked.length === 0} className="self-start rounded-xl bg-accent px-5 py-2.5 font-semibold text-accent-ink disabled:opacity-50">
        {pending ? "Building your lesson…" : `Create lesson (${picked.length}/3 skills)`}
      </button>
    </form>
  );
}
