"use client";

import Link from "next/link";
import { useActionState } from "react";
import { generateAction, type GenerateState, importAction, type ImportState, openSatAction, type OpenSatState } from "@/app/content-actions";

const input = "rounded-lg border border-line bg-bg px-2 py-2 text-sm";

export function GenerateForm({ skills }: { skills: { label: string; skills: { id: string; name: string }[] }[] }) {
  const [state, action, pending] = useActionState<GenerateState, FormData>(generateAction, { ok: true });
  return (
    <div className="flex flex-col gap-3">
      <form action={action} className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Skill
          <select name="skill" required className={input}>
            {skills.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.skills.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Difficulty
          <select name="difficulty" defaultValue="2" className={input}>
            <option value="1">Easy</option>
            <option value="2">Medium</option>
            <option value="3">Hard</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          How many
          <select name="count" defaultValue="5" className={input}>
            {[1, 3, 5, 10].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <button disabled={pending} className="rounded-xl bg-accent px-4 py-2 font-semibold text-accent-ink disabled:opacity-60">
          {pending ? "Generating and checking… (this can take a minute)" : "Generate"}
        </button>
      </form>
      {state.error && (
        <p role="alert" className="text-sm text-rose">
          {state.error}
        </p>
      )}
      {state.report && (
        <div className="rounded-xl bg-surface-2 p-3 text-sm" role="status">
          <p className="font-medium">
            {state.report.saved.length} of {state.report.requested} passed the checks and are waiting in the{" "}
            <Link href="/content/review" className="underline">
              review queue
            </Link>
            .
          </p>
          {state.report.rejected.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-muted">
              {state.report.rejected.map((r, i) => (
                <li key={i}>
                  <span className="text-ink">{r.stem}…</span> {r.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function ImportForm() {
  const [state, action, pending] = useActionState<ImportState, FormData>(importAction, { ok: true });
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="file" name="file" accept=".json,.csv,application/json,text/csv" required className="text-sm" />
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Source (used when a row has none)
          <input name="source" placeholder="e.g. my-teacher-worksheets" className={input} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          License (used when a row has none)
          <input name="license" placeholder="e.g. CC-BY-4.0, or personal use" className={input} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="rights" /> I have the rights to use these questions.
      </label>
      <div className="flex gap-2">
        <button name="mode" value="validate" disabled={pending} className="rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-surface-2">
          Validate only
        </button>
        <button name="mode" value="import" disabled={pending} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-60">
          Import
        </button>
      </div>
      {(state.error || state.total !== undefined) && (
        <div className="rounded-xl bg-surface-2 p-3 text-sm" role="status">
          {state.error && <p className="text-rose">{state.error}</p>}
          {state.total !== undefined && (
            <p>
              {state.valid} of {state.total} rows are valid.
              {state.inserted !== undefined && ` Imported: ${state.inserted} new, ${state.updated} updated.`}
            </p>
          )}
          {state.errors && state.errors.length > 0 && (
            <div className="mt-2 max-h-64 overflow-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-muted">
                    <th className="pr-3">Row</th>
                    <th className="pr-3">Id</th>
                    <th>Problem</th>
                  </tr>
                </thead>
                <tbody>
                  {state.errors.map((e, i) => (
                    <tr key={i} className="border-t border-line align-top">
                      <td className="pr-3 tabular-nums">{e.row}</td>
                      <td className="pr-3">{e.id ?? "—"}</td>
                      <td>{e.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </form>
  );
}

export function OpenSatForm() {
  const [state, action, pending] = useActionState<OpenSatState, FormData>(openSatAction, { ok: true });
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Section
          <select name="section" className={input}>
            <option value="RW">Reading & Writing</option>
            <option value="MATH">Math</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          How many
          <input type="number" name="limit" min={1} max={500} defaultValue={50} className={`${input} w-24`} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="rights" /> I understand these questions have no stated license and must stay on my computer.
      </label>
      <button disabled={pending} className="self-start rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-surface-2 disabled:opacity-60">
        {pending ? "Importing…" : "Import from OpenSAT"}
      </button>
      {(state.error || state.imported !== undefined) && (
        <div className="rounded-xl bg-surface-2 p-3 text-sm" role="status">
          {state.error ? <p className="text-rose">{state.error}</p> : <p>Imported {state.imported} questions.</p>}
          {state.skipped && state.skipped.length > 0 && (
            <p className="mt-1 text-muted">
              Skipped {state.skipped.length}: {state.skipped.slice(0, 5).map((s) => `${s.id} (${s.reason})`).join("; ")}
              {state.skipped.length > 5 ? "…" : ""}
            </p>
          )}
        </div>
      )}
    </form>
  );
}
