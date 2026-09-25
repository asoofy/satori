"use client";

import { useActionState, useState } from "react";
import {
  createProfileAction,
  deleteProfileAction,
  resetProgressAction,
  restoreAction,
  saveSettingsAction,
  type SettingsState,
} from "@/app/settings-actions";

const field = "rounded-lg border border-line bg-bg px-3 py-2";
const init: SettingsState = { ok: true };

function Status({ s }: { s: SettingsState }) {
  if (s.error)
    return (
      <p role="alert" className="text-sm text-rose">
        {s.error}
      </p>
    );
  if (s.message)
    return (
      <p role="status" className="text-sm text-jade">
        {s.message}
      </p>
    );
  return null;
}

function AvatarPicker({ avatars, value, onChange }: { avatars: string[]; value: string; onChange: (a: string) => void }) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium">Avatar</legend>
      <div className="flex flex-wrap gap-1.5">
        {avatars.map((a) => (
          <label key={a} className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border text-xl has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-indigo ${value === a ? "border-accent bg-accent-soft" : "border-line"}`}>
            <input type="radio" name="avatar" value={a} checked={value === a} onChange={() => onChange(a)} className="sr-only" />
            <span aria-hidden="true">{a}</span>
            <span className="sr-only">Avatar {a}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function PreferencesForm({ name, avatar, theme, dailyGoal, avatars }: { name: string; avatar: string; theme: string; dailyGoal: number; avatars: string[] }) {
  const [state, action, pending] = useActionState(saveSettingsAction, init);
  const [av, setAv] = useState(avatars.includes(avatar) ? avatar : avatars[0]);
  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Name
        <input name="name" defaultValue={name} required maxLength={40} className={`${field} font-normal`} />
      </label>
      <AvatarPicker avatars={avatars} value={av} onChange={setAv} />
      <div className="flex flex-wrap gap-4">
        <div className="flex flex-col gap-1 text-sm font-medium">
          <label htmlFor="pref-theme">Theme</label>
          <select id="pref-theme" name="theme" defaultValue={theme} className={`${field} font-normal`}>
            <option value="system">Match my device</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
        <div className="flex flex-col gap-1 text-sm font-medium">
          <label htmlFor="pref-goal">Daily goal (questions)</label>
          <select id="pref-goal" name="daily_goal" defaultValue={dailyGoal} className={`${field} font-normal`}>
            {[5, 10, 15, 20, 30, 40].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button disabled={pending} className="rounded-xl bg-accent px-5 py-2 font-semibold text-accent-ink disabled:opacity-60">
          Save
        </button>
        <Status s={state} />
      </div>
    </form>
  );
}

export function CreateProfileForm({ avatars }: { avatars: string[] }) {
  const [state, action, pending] = useActionState(createProfileAction, init);
  const [av, setAv] = useState(avatars[1] ?? avatars[0]);
  return (
    <details>
      <summary className="cursor-pointer text-sm font-medium text-accent">Add a profile</summary>
      <form action={action} className="mt-3 flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Name
          <input name="name" required maxLength={40} className={`${field} font-normal`} />
        </label>
        <AvatarPicker avatars={avatars} value={av} onChange={setAv} />
        <button disabled={pending} className="self-start rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-surface-2">
          Create and switch
        </button>
        <Status s={state} />
      </form>
    </details>
  );
}

export function DeleteProfileForm({ id, name }: { id: number; name: string }) {
  const [state, action, pending] = useActionState(deleteProfileAction.bind(null, id), init);
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="rounded-lg px-2 py-1 text-sm text-rose hover:bg-rose-soft">
        Delete
      </button>
    );
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor={`del-${id}`}>
        Type {name} to confirm
      </label>
      <input id={`del-${id}`} name="confirm" placeholder={`Type “${name}”`} className={`${field} w-40 py-1 text-sm`} />
      <button disabled={pending} className="rounded-lg bg-rose px-3 py-1 text-sm font-semibold text-white dark:text-bg">
        Delete forever
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted underline">
        Cancel
      </button>
      <Status s={state} />
    </form>
  );
}

export function ResetForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState(resetProgressAction, init);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor="reset-confirm">
        Type {name} to confirm
      </label>
      <input id="reset-confirm" name="confirm" placeholder={`Type “${name}” to confirm`} className={`${field} text-sm`} />
      <button disabled={pending} className="rounded-lg border border-rose px-4 py-2 text-sm font-semibold text-rose hover:bg-rose-soft">
        Reset my progress
      </button>
      <Status s={state} />
    </form>
  );
}

export function RestoreForm() {
  const [state, action, pending] = useActionState(restoreAction, init);
  return (
    <form action={action} className="flex flex-col gap-2">
      <p className="text-sm font-medium">Restore from a backup</p>
      <input type="file" name="file" accept=".db,application/vnd.sqlite3,application/octet-stream" className="text-sm" />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="confirm" /> Replace all current data with this backup (the current file is kept as a copy)
      </label>
      <button disabled={pending} className="self-start rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-surface-2 disabled:opacity-60">
        {pending ? "Restoring…" : "Restore"}
      </button>
      <Status s={state} />
    </form>
  );
}
