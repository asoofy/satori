"use client";

import { useState } from "react";
import { startPlanDayAction } from "@/app/actions";

export interface PathNodeData {
  id: number;
  date: string;
  title: string;
  kind: "learn" | "review" | "final";
  questionCount: number;
  started: boolean;
  state: "done" | "missed" | "today" | "locked";
  offset: number;
  skills: { name: string; tip: string }[];
}

export function PathNode({ node }: { node: PathNodeData }) {
  const [open, setOpen] = useState(node.state === "today" && !node.started);
  const label = new Date(node.date + "T00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const size = node.state === "today" ? "h-20 w-20" : "h-16 w-16";
  const style =
    node.state === "done"
      ? "bg-jade text-white dark:text-bg shadow-[0_5px_0_0_color-mix(in_oklab,var(--jade),black_25%)]"
      : node.state === "today"
        ? "bg-accent text-accent-ink shadow-[0_6px_0_0_color-mix(in_oklab,var(--accent),black_25%)] ring-8 ring-accent-soft"
        : node.state === "missed"
          ? "bg-surface-2 text-muted"
          : "bg-surface-2 text-muted shadow-[0_5px_0_0_var(--line)]";
  const stateText = { done: "completed", missed: "missed", today: "today", locked: "locked until " + label }[node.state];

  return (
    <li className="flex flex-col items-center" style={{ transform: `translateX(${node.offset}px)` }}>
      {node.state === "today" && (
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="mb-2 rounded-lg border border-line bg-surface px-3 py-1 text-xs font-bold tracking-wide text-accent uppercase shadow-sm"
        >
          What do I study?
        </button>
      )}
      {node.state === "today" ? (
        <form action={startPlanDayAction.bind(null, node.id)}>
          <button className={`flex items-center justify-center rounded-full ${size} ${style}`} aria-label={`Start today: ${node.title}`}>
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        </form>
      ) : node.state === "done" ? (
        <div className={`flex items-center justify-center rounded-full ${size} ${style}`} role="img" aria-label={`${label}: ${node.title}, ${stateText}`} title={node.title}>
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12l5 5L20 7" />
          </svg>
        </div>
      ) : (
        <div className={`flex items-center justify-center rounded-full ${size} ${style}`} role="img" aria-label={`${label}: ${node.title}, ${stateText}`} title={node.title}>
          {node.state === "missed" ? (
            <span className="text-xl" aria-hidden="true">
              ✕
            </span>
          ) : (
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
          )}
        </div>
      )}
      <span className={`mt-2 text-sm ${node.state === "today" ? "font-bold text-accent" : "font-medium text-muted"}`}>{label}</span>

      {node.state === "today" && open && (
        <div className="mt-3 w-[min(22rem,85vw)] rounded-2xl border border-line bg-surface p-4 text-left shadow-md" style={{ transform: `translateX(${-node.offset}px)` }}>
          <p className="text-xs font-semibold tracking-widest text-muted uppercase">Today · {node.questionCount} questions</p>
          <p className="mt-1 font-semibold">{node.title}</p>
          {node.skills.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-2">
              {node.skills.map((s) => (
                <li key={s.name} className="text-sm">
                  <span className="font-medium">{s.name}.</span> <span className="text-muted">{s.tip}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">
              {node.kind === "review"
                ? "Work back through questions you missed or saved. Read every explanation, even when you get one right."
                : "A short mixed set to stay sharp. Get a good night’s sleep before test day."}
            </p>
          )}
          <form action={startPlanDayAction.bind(null, node.id)} className="mt-3">
            <button className="w-full rounded-xl bg-accent px-4 py-2 font-semibold text-accent-ink">{node.started ? "Continue" : "Start"}</button>
          </form>
        </div>
      )}
    </li>
  );
}
