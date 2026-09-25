"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { BankFilter } from "@/lib/repo/questions";
import { DOMAINS, SKILLS } from "@/lib/taxonomy";

export function FilterBar({ filter }: { filter: BankFilter }) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(filter.q ?? "");

  const push = (patch: Partial<Record<keyof BankFilter, string | undefined>>) => {
    const next: Record<string, string | undefined> = {
      section: filter.section,
      domain: filter.domain,
      skill: filter.skill,
      difficulty: filter.difficulty ? String(filter.difficulty) : undefined,
      status: filter.status,
      origin: filter.origin,
      q: filter.q,
      ...patch,
    };
    // Changing a broader filter clears the narrower ones that may no longer fit.
    if ("section" in patch) {
      next.domain = undefined;
      next.skill = undefined;
    }
    if ("domain" in patch) next.skill = undefined;
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v) p.set(k, v);
    router.push(p.toString() ? `${pathname}?${p}` : pathname);
  };

  const domains = DOMAINS.filter((d) => !filter.section || d.section === filter.section);
  const skills = SKILLS.filter((s) => (!filter.section || s.section === filter.section) && (!filter.domain || s.domain === filter.domain));
  const sel = "rounded-lg border border-line bg-surface px-2 py-2 text-sm text-ink";
  const active = filter.section || filter.domain || filter.skill || filter.difficulty || filter.status || filter.origin || filter.q;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Section">
        {(
          [
            ["", "All sections"],
            ["RW", "Reading & Writing"],
            ["MATH", "Math"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            onClick={() => push({ section: v || undefined })}
            aria-pressed={(filter.section ?? "") === v}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              (filter.section ?? "") === v ? "border-accent bg-accent-soft font-semibold text-accent" : "border-line hover:bg-surface-2"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Domain
          <select className={sel} value={filter.domain ?? ""} onChange={(e) => push({ domain: e.target.value || undefined })}>
            <option value="">All domains</option>
            {domains.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Skill
          <select className={sel} value={filter.skill ?? ""} onChange={(e) => push({ skill: e.target.value || undefined })}>
            <option value="">All skills</option>
            {skills.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Difficulty
          <select className={sel} value={filter.difficulty ?? ""} onChange={(e) => push({ difficulty: e.target.value || undefined })}>
            <option value="">Any</option>
            <option value="1">Easy</option>
            <option value="2">Medium</option>
            <option value="3">Hard</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Status
          <select className={sel} value={filter.status ?? ""} onChange={(e) => push({ status: e.target.value || undefined })}>
            <option value="">All</option>
            <option value="unanswered">Unanswered</option>
            <option value="incorrect">Incorrect</option>
            <option value="correct">Correct</option>
            <option value="saved">Saved</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Source
          <select className={sel} value={filter.origin ?? ""} onChange={(e) => push({ origin: e.target.value || undefined })}>
            <option value="">All</option>
            <option value="original">Hand-written</option>
            <option value="generated">Generated (math templates)</option>
          </select>
        </label>
      </div>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          push({ q: q.trim() || undefined });
        }}
        className="flex gap-2"
      >
        <label htmlFor="bank-search" className="sr-only">
          Search question text
        </label>
        <input
          id="bank-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search question text…"
          className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-2 text-sm"
        />
        <button className="rounded-lg border border-line px-3 py-2 text-sm hover:bg-surface-2">Search</button>
        {active && (
          <button type="button" onClick={() => router.push(pathname)} className="rounded-lg px-3 py-2 text-sm text-muted underline">
            Clear
          </button>
        )}
      </form>
    </div>
  );
}
