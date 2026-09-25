"use client";

import { useEffect, useState, useTransition } from "react";
import { endBreakAction } from "@/app/test-actions";
import { fmtTime } from "@/lib/format";
import { Logo } from "./Logo";

export function BreakScreen({ testId, endsAt }: { testId: number; endsAt: string }) {
  const end = new Date(endsAt).getTime();
  const [now, setNow] = useState(() => Date.now());
  const [pending, start] = useTransition();
  const left = Math.max(0, end - now);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // When the break is over, continue automatically (as on test day).
  useEffect(() => {
    if (left === 0 && !pending) start(() => endBreakAction(testId));
  }, [left, pending, testId]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-5 text-center">
      <div className="text-accent">
        <Logo size={48} />
      </div>
      <h1 className="text-3xl font-bold">Take a 10-minute break</h1>
      <p className="max-w-md text-muted">
        You’ve finished Reading and Writing. Stand up, stretch, drink some water. Math starts when the break ends, or whenever you’re ready.
      </p>
      <p className="text-6xl font-bold tabular-nums" role="timer" aria-live="off" aria-label="Break time remaining">
        {fmtTime(left)}
      </p>
      <button
        onClick={() => start(() => endBreakAction(testId))}
        disabled={pending}
        className="rounded-xl bg-accent px-6 py-3 font-semibold text-accent-ink hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Starting…" : "Resume testing"}
      </button>
    </main>
  );
}
