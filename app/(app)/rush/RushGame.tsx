"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { submitAnswer } from "@/app/actions";
import { type RushResult, rushBatch, saveRushRun } from "@/app/rush-actions";
import { Md, MdInline } from "@/components/Md";
import type { PlayerQuestion } from "@/components/PracticePlayer";
import { fmtTime } from "@/lib/format";

type Phase = "setup" | "playing" | "done";
interface Missed {
  q: PlayerQuestion;
  chosen: string;
  answer: string;
  explanation: string;
}

export function RushGame() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("setup");
  const [section, setSection] = useState<"RW" | "MATH" | null>(null);
  const [minutes, setMinutes] = useState(3);
  const [queue, setQueue] = useState<PlayerQuestion[]>([]);
  const [seen, setSeen] = useState<string[]>([]);
  const [endsAt, setEndsAt] = useState(0);
  const [now, setNow] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [flash, setFlash] = useState<null | { ok: boolean; letter: string; answer: string }>(null);
  const [missed, setMissed] = useState<Missed[]>([]);
  const [result, setResult] = useState<RushResult | null>(null);
  const [pending, start] = useTransition();
  const questionStart = useRef(0);
  const ended = useRef(false);

  const remaining = Math.max(0, endsAt - now);
  const q = queue[0];

  const begin = () =>
    start(async () => {
      const batch = await rushBatch(section, []);
      const t = Date.now();
      ended.current = false;
      setQueue(batch);
      setSeen(batch.map((b) => b.id));
      setAnswered(0);
      setCorrect(0);
      setStreak(0);
      setBestStreak(0);
      setMissed([]);
      setResult(null);
      setEndsAt(t + minutes * 60_000);
      setNow(t);
      questionStart.current = t;
      setPhase("playing");
    });

  useEffect(() => {
    if (phase !== "playing") return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [phase]);

  // End of the run
  useEffect(() => {
    if (phase === "playing" && remaining === 0 && !ended.current) {
      ended.current = true;
      setPhase("done");
      saveRushRun({ section, durationS: minutes * 60, answered, correct, bestStreak }).then((r) => {
        setResult(r);
        router.refresh();
      });
    }
  }, [phase, remaining, section, minutes, answered, correct, bestStreak, router]);

  // Keep the queue topped up.
  useEffect(() => {
    if (phase === "playing" && queue.length < 4) {
      rushBatch(section, seen).then((more) => {
        setQueue((qs) => [...qs, ...more.filter((m) => !qs.some((x) => x.id === m.id))]);
        setSeen((s) => [...s, ...more.map((m) => m.id)]);
      });
    }
  }, [phase, queue.length, section, seen]);

  const answer = (L: string) => {
    if (!q || flash || pending || remaining === 0) return;
    const current = q;
    start(async () => {
      const r = await submitAnswer({ questionId: current.id, response: L, timeMs: Date.now() - questionStart.current, eliminated: [], context: "rush" });
      if (!r.ok) return;
      setAnswered((n) => n + 1);
      if (r.correct) {
        setCorrect((n) => n + 1);
        const next = streak + 1;
        setStreak(next);
        setBestStreak((b) => Math.max(b, next));
      } else {
        setStreak(0);
        setMissed((m) => [...m, { q: current, chosen: L, answer: r.answer, explanation: r.explanation_md }]);
      }
      setFlash({ ok: r.correct, letter: L, answer: r.answer });
      setTimeout(() => {
        setFlash(null);
        setQueue((qs) => qs.slice(1));
        questionStart.current = Date.now();
      }, r.correct ? 450 : 1100);
    });
  };

  useEffect(() => {
    if (phase !== "playing") return;
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toUpperCase();
      if (["A", "B", "C", "D"].includes(k) && !e.metaKey && !e.ctrlKey) answer(k);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (phase === "setup") {
    return (
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Questions from</legend>
          <div className="flex flex-wrap gap-2">
            {(
              [
                [null, "Mixed"],
                ["RW", "Reading & Writing"],
                ["MATH", "Math"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={label}
                onClick={() => setSection(v)}
                aria-pressed={section === v}
                className={`rounded-full border px-3 py-1.5 text-sm ${section === v ? "border-accent bg-accent-soft font-semibold text-accent" : "border-line"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Time</legend>
          <div className="flex gap-2">
            {[3, 5].map((m) => (
              <button
                key={m}
                onClick={() => setMinutes(m)}
                aria-pressed={minutes === m}
                className={`rounded-full border px-3 py-1.5 text-sm ${minutes === m ? "border-accent bg-accent-soft font-semibold text-accent" : "border-line"}`}
              >
                {m} minutes
              </button>
            ))}
          </div>
        </fieldset>
        <button onClick={begin} disabled={pending} className="self-start rounded-xl bg-accent px-6 py-3 font-semibold text-accent-ink disabled:opacity-60">
          {pending ? "Loading…" : "Start the rush"}
        </button>
        <p className="text-xs text-muted">Multiple-choice only. Keys A–D answer. Your answers count toward your stats and mistakes list.</p>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <Stat label="Correct" value={String(correct)} />
          <Stat label="Accuracy" value={answered ? `${Math.round((correct / answered) * 100)}%` : "—"} />
          <Stat label="Best streak" value={String(bestStreak)} />
        </div>
        {result && (
          <p className={`rounded-xl px-4 py-3 text-center font-semibold ${result.isBest ? "bg-gold-soft text-gold" : "bg-surface-2"}`} role="status">
            {result.isBest ? "New personal best!" : `Personal best for this mode: ${result.best}`}
          </p>
        )}
        {missed.length > 0 && (
          <div className="rounded-2xl border border-line bg-surface">
            <h2 className="border-b border-line px-4 py-2 font-semibold">Review your misses</h2>
            <ul className="divide-y divide-line">
              {missed.map((m) => (
                <li key={m.q.id}>
                  <details>
                    <summary className="cursor-pointer px-4 py-2.5 text-sm hover:bg-surface-2">
                      {m.q.skillName} · you chose {m.chosen}, answer {m.answer}
                    </summary>
                    <div className="flex flex-col gap-2 bg-bg px-4 py-3">
                      {m.q.passage_md && <Md className="reading">{m.q.passage_md}</Md>}
                      <Md>{m.q.stem_md}</Md>
                      <Md>{m.explanation}</Md>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          </div>
        )}
        <button onClick={() => setPhase("setup")} className="self-start rounded-xl bg-accent px-5 py-2.5 font-semibold text-accent-ink">
          Play again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
        <span className={`text-2xl font-bold tabular-nums ${remaining < 20_000 ? "text-rose" : ""}`} role="timer" aria-label="Time left">
          {fmtTime(remaining + 999)}
        </span>
        <span className="text-lg font-semibold">✅ {correct}</span>
        <span className="text-lg font-semibold" aria-label={`Streak ${streak}`}>
          🔥 {streak}
        </span>
      </div>
      {!q ? (
        <p className="text-muted">Loading questions…</p>
      ) : (
        <div className={`grid gap-4 ${q.passage_md ? "lg:grid-cols-2" : ""}`}>
          {q.passage_md && (
            <div className="reading rounded-2xl border border-line bg-surface p-5">
              <Md>{q.passage_md}</Md>
            </div>
          )}
          <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
            <p className="text-xs text-muted">{q.skillName}</p>
            <Md className={q.section === "RW" ? "reading" : ""}>{q.stem_md}</Md>
            <ul className="flex flex-col gap-2">
              {q.choices?.map((c, i) => {
                const L = "ABCD"[i];
                const state = flash ? (L === flash.answer ? "right" : L === flash.letter ? "wrong" : "") : "";
                return (
                  <li key={L}>
                    <button
                      onClick={() => answer(L)}
                      disabled={!!flash}
                      className={`flex w-full items-start gap-3 rounded-xl border-2 px-3 py-2.5 text-left ${
                        state === "right" ? "border-jade bg-jade-soft" : state === "wrong" ? "border-rose bg-rose-soft" : "border-line hover:border-muted"
                      }`}
                    >
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-muted text-sm font-bold">{L}</span>
                      <span className="pt-0.5">
                        <MdInline>{c}</MdInline>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm text-muted">{label}</div>
    </div>
  );
}
