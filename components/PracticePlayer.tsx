"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { type AttemptResult, submitAnswer, toggleSave } from "@/app/actions";
import { fmtTime, sprTex } from "@/lib/format";
import { parseSpr } from "@/lib/grading";
import type { PublicQuestion } from "@/lib/repo/questions";
import type { AttemptContext } from "@/lib/repo/progress";
import { MathTools } from "./MathTools";
import { TutorChat } from "./TutorChat";
import { Md, MdInline } from "./Md";

export interface PlayerQuestion extends PublicQuestion {
  skillName: string;
  domainName: string;
  saved: boolean;
}

type Result = Omit<AttemptResult, "ok">;

interface QState {
  selected: string | null;
  spr: string;
  eliminated: string[];
  result: Result | null;
  elapsedMs: number;
}

const LETTERS = ["A", "B", "C", "D"] as const;
const DIFF = { 1: "Easy", 2: "Medium", 3: "Hard" } as const;

export function PracticePlayer({
  title,
  questions,
  context,
  backHref = "/questions",
  tutor = false,
}: {
  title: string;
  questions: PlayerQuestion[];
  context: AttemptContext;
  backHref?: string;
  /** Show the "Ask tutor" panel (only when an AI provider is configured). */
  tutor?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [states, setStates] = useState<QState[]>(() =>
    questions.map(() => ({ selected: null, spr: "", eliminated: [], result: null, elapsedMs: 0 })),
  );
  const [saved, setSaved] = useState<Record<string, boolean>>(() => Object.fromEntries(questions.map((q) => [q.id, q.saved])));
  const [eliminateMode, setEliminateMode] = useState(false);
  const [showTimer, setShowTimer] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [tool, setTool] = useState<"calculator" | "reference" | null>(null);
  const [tutorOpen, setTutorOpen] = useState(false);
  const [pending, start] = useTransition();
  // Per-question timer: time accumulates only while a question is unanswered and on screen.
  const [segmentStart, setSegmentStart] = useState(() => Date.now());
  const [clock, setClock] = useState(segmentStart);

  const q = questions[index];
  const st = states[index];

  useEffect(() => {
    if (st.result || finished) return;
    const t = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(t);
  }, [st.result, finished]);

  const liveElapsed = st.result ? st.elapsedMs : st.elapsedMs + Math.max(0, clock - segmentStart);

  /** Bank the time spent on the current question (if unanswered) and restart the segment. */
  const bankTime = () => {
    const now = Date.now();
    const spent = now - segmentStart;
    setStates((s) => s.map((x, i) => (i === index && !x.result ? { ...x, elapsedMs: x.elapsedMs + spent } : x)));
    setSegmentStart(now);
    setClock(now);
  };

  const update = useCallback((patch: Partial<QState>) => {
    setStates((s) => s.map((x, i) => (i === index ? { ...x, ...patch } : x)));
  }, [index]);

  const toggleEliminate = (L: string) => {
    if (st.result) return;
    const has = st.eliminated.includes(L);
    update({
      eliminated: has ? st.eliminated.filter((x) => x !== L) : [...st.eliminated, L],
      selected: !has && st.selected === L ? null : st.selected,
    });
  };

  const choose = (L: string) => {
    if (st.result) return;
    if (eliminateMode) return toggleEliminate(L);
    update({ selected: L, eliminated: st.eliminated.filter((x) => x !== L) });
    setError(null);
  };

  const sprPreview = useMemo(() => (q.type === "spr" && st.spr ? parseSpr(st.spr) : null), [q.type, st.spr]);

  const submit = () => {
    if (st.result || pending) return;
    const response = q.type === "mcq" ? st.selected : st.spr.trim();
    if (!response) {
      setError(q.type === "mcq" ? "Choose an answer first." : "Type an answer first.");
      return;
    }
    const now = Date.now();
    const spent = st.elapsedMs + (now - segmentStart);
    start(async () => {
      const r = await submitAnswer({ questionId: q.id, response, timeMs: spent, eliminated: st.eliminated, context });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setError(null);
      setSegmentStart(Date.now());
      update({ result: r, elapsedMs: spent });
    });
  };

  const go = (i: number) => {
    setError(null);
    bankTime();
    if (i >= questions.length) setFinished(true);
    else setIndex(Math.max(0, i));
  };

  const onSave = () => {
    const id = q.id;
    start(async () => {
      const next = await toggleSave(id);
      setSaved((s) => ({ ...s, [id]: next }));
    });
  };

  // Keyboard shortcuts: A–D choose, E toggles eliminate mode, Enter submits / goes next.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      // Typing in the calculator or reference panel shouldn't trigger shortcuts.
      if (el?.closest?.("[data-no-shortcuts]") || el?.isContentEditable) return;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) {
        if (e.key === "Enter") {
          e.preventDefault();
          if (st.result) go(index + 1);
          else submit();
        }
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || finished) return;
      // Let focused buttons, links and selects handle Enter/Space themselves.
      if (el && ["BUTTON", "A", "SELECT"].includes(el.tagName) && (e.key === "Enter" || e.key === " ")) return;
      const k = e.key.toUpperCase();
      if (q.type === "mcq" && LETTERS.includes(k as (typeof LETTERS)[number])) choose(k);
      else if (k === "E" && q.type === "mcq") setEliminateMode((m) => !m);
      else if (e.key === "Enter") {
        if (st.result) go(index + 1);
        else submit();
      } else if (e.key === "ArrowRight" && st.result) go(index + 1);
      else if (e.key === "ArrowLeft") go(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (finished) {
    return <Summary title={title} questions={questions} states={states} backHref={backHref} onReview={(i) => {
          const now = Date.now();
          setFinished(false);
          setIndex(i);
          setSegmentStart(now);
          setClock(now);
        }} />;
  }

  const answered = states.filter((s) => s.result).length;

  return (
    <div className={`flex flex-col gap-4 ${(tool && q.section === "MATH") || tutorOpen ? "lg:pr-[440px]" : ""}`}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link href={backHref} className="text-sm text-muted hover:underline">
            ← Back
          </Link>
          <h1 className="truncate text-xl font-bold">{title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {tutor && (
            <button
              onClick={() => {
                setTutorOpen((o) => !o);
                setTool(null);
              }}
              aria-pressed={tutorOpen}
              className={`rounded-lg border px-3 py-1 text-sm ${tutorOpen ? "border-indigo bg-indigo-soft text-indigo" : "border-line bg-surface hover:bg-surface-2"}`}
            >
              Ask tutor
            </button>
          )}
          {q.section === "MATH" && (
            <>
              <button
                onClick={() => setTool((t) => (t === "calculator" ? null : "calculator"))}
                aria-pressed={tool === "calculator"}
                className={`rounded-lg border px-3 py-1 text-sm ${tool === "calculator" ? "border-indigo bg-indigo-soft text-indigo" : "border-line bg-surface hover:bg-surface-2"}`}
              >
                Calculator
              </button>
              <button
                onClick={() => setTool((t) => (t === "reference" ? null : "reference"))}
                aria-pressed={tool === "reference"}
                className={`rounded-lg border px-3 py-1 text-sm ${tool === "reference" ? "border-indigo bg-indigo-soft text-indigo" : "border-line bg-surface hover:bg-surface-2"}`}
              >
                Reference
              </button>
            </>
          )}
          <div className="flex items-center gap-1 rounded-lg border border-line bg-surface px-2 py-1 text-sm tabular-nums">
            <span aria-hidden="true">⏱</span>
            {showTimer ? <span aria-label="Time on this question">{fmtTime(liveElapsed)}</span> : <span className="text-muted">hidden</span>}
            <button onClick={() => setShowTimer((v) => !v)} className="ml-1 text-xs text-muted underline">
              {showTimer ? "Hide" : "Show"}
            </button>
          </div>
          <button
            onClick={onSave}
            aria-pressed={saved[q.id]}
            className={`flex items-center gap-1 rounded-lg border px-3 py-1 text-sm ${saved[q.id] ? "border-gold bg-gold-soft text-gold" : "border-line bg-surface hover:bg-surface-2"}`}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill={saved[q.id] ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M6 3h12v18l-6-4-6 4z" />
            </svg>
            {saved[q.id] ? "Saved" : "Save"}
          </button>
        </div>
      </header>

      <nav aria-label="Questions in this set" className="flex flex-wrap gap-1.5">
        {questions.map((qq, i) => {
          const r = states[i].result;
          return (
            <button
              key={qq.id}
              onClick={() => go(i)}
              aria-current={i === index ? "step" : undefined}
              aria-label={`Question ${i + 1}${r ? (r.correct ? ", correct" : ", incorrect") : ""}`}
              className={`h-8 min-w-8 rounded-md border px-2 text-sm tabular-nums ${
                i === index ? "border-ink font-bold" : "border-line"
              } ${r ? (r.correct ? "bg-jade-soft text-jade" : "bg-rose-soft text-rose") : "bg-surface"}`}
            >
              {i + 1}
            </button>
          );
        })}
      </nav>

      <div className={`grid gap-4 ${q.passage_md ? "lg:grid-cols-2" : ""}`}>
        {q.passage_md && (
          <section aria-label="Passage" className="reading rounded-2xl border border-line bg-surface p-5 lg:max-h-[70vh] lg:overflow-y-auto">
            <Md>{q.passage_md}</Md>
          </section>
        )}

        <section aria-label="Question" className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-surface-2 px-2 py-0.5 font-medium">
              {index + 1} of {questions.length}
            </span>
            <span className="rounded-full bg-indigo-soft px-2 py-0.5 text-indigo">{q.skillName}</span>
            <DifficultyBadge d={q.difficulty} />
            {q.type === "spr" && <span className="rounded-full bg-surface-2 px-2 py-0.5">Student-produced response</span>}
          </div>

          <div className={q.section === "RW" ? "reading" : "text-[1.05rem] leading-relaxed"}>
            <Md>{q.stem_md}</Md>
          </div>

          {q.type === "mcq" && q.choices && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted">Choose one answer.</span>
                <button
                  onClick={() => setEliminateMode((m) => !m)}
                  aria-pressed={eliminateMode}
                  title="Answer eliminator (E)"
                  className={`rounded-md border px-2 py-1 text-xs font-semibold ${eliminateMode ? "border-indigo bg-indigo-soft text-indigo" : "border-line"}`}
                >
                  <span className="line-through">ABC</span> Eliminate
                </button>
              </div>
              <ul className="flex flex-col gap-2" role="radiogroup" aria-label="Answer choices">
                {q.choices.map((c, i) => {
                  const L = LETTERS[i];
                  const elim = st.eliminated.includes(L);
                  const sel = st.selected === L;
                  const r = st.result;
                  const isKey = r && r.answer === L;
                  const isWrongPick = r && sel && !r.correct;
                  return (
                    <li key={L} className="flex items-stretch gap-2">
                      <button
                        role="radio"
                        aria-checked={sel}
                        disabled={!!r}
                        onClick={() => choose(L)}
                        className={`flex flex-1 items-start gap-3 rounded-xl border-2 px-3 py-2.5 text-left transition-colors ${
                          isKey
                            ? "border-jade bg-jade-soft"
                            : isWrongPick
                              ? "border-rose bg-rose-soft"
                              : sel
                                ? "border-indigo bg-indigo-soft"
                                : "border-line hover:border-muted"
                        } ${elim && !r ? "opacity-45" : ""}`}
                      >
                        <span
                          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-bold ${
                            sel || isKey ? "border-transparent bg-ink text-bg" : "border-muted"
                          }`}
                        >
                          {L}
                        </span>
                        <span className={`pt-0.5 ${elim && !r ? "line-through" : ""} ${q.section === "RW" ? "reading !text-base" : ""}`}>
                          <MdInline>{c}</MdInline>
                        </span>
                      </button>
                      {!r && (
                        <button
                          onClick={() => toggleEliminate(L)}
                          aria-label={elim ? `Restore choice ${L}` : `Eliminate choice ${L}`}
                          title={elim ? "Undo" : "Cross out"}
                          className="w-9 shrink-0 rounded-lg border border-line text-sm text-muted hover:bg-surface-2"
                        >
                          {elim ? "↺" : <span className="line-through">{L}</span>}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {q.type === "spr" && (
            <div className="flex flex-col gap-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm text-muted">Your answer (fraction or decimal; up to 5 characters, 6 if negative)</span>
                <input
                  value={st.spr}
                  disabled={!!st.result}
                  onChange={(e) => update({ spr: e.target.value })}
                  inputMode="text"
                  autoComplete="off"
                  maxLength={8}
                  className="w-44 rounded-lg border-2 border-line bg-bg px-3 py-2 font-mono text-lg"
                  aria-describedby="spr-preview"
                />
              </label>
              <p id="spr-preview" className="text-sm text-muted" aria-live="polite">
                {sprPreview ? (sprPreview.ok ? <>Answer preview: <MdInline>{`$${sprTex(sprPreview.text)}$`}</MdInline></> : <span className="text-rose">{sprPreview.error}</span>) : null}
              </p>
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-lg bg-rose-soft px-3 py-2 text-sm text-rose">
              {error}
            </p>
          )}

          {st.result && <Feedback q={q} r={st.result} spr={st.spr} selected={st.selected} />}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
            <button onClick={() => go(index - 1)} disabled={index === 0} className="rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2 disabled:opacity-40">
              ← Previous
            </button>
            <span className="text-sm text-muted tabular-nums">
              {answered}/{questions.length} answered
            </span>
            {st.result ? (
              <button onClick={() => go(index + 1)} className="rounded-xl bg-ink px-5 py-2 font-semibold text-bg hover:opacity-90">
                {index + 1 < questions.length ? "Next →" : "See results"}
              </button>
            ) : (
              <button onClick={submit} disabled={pending} className="rounded-xl bg-accent px-5 py-2 font-semibold text-accent-ink hover:opacity-90 disabled:opacity-60">
                {pending ? "Checking…" : "Check answer"}
              </button>
            )}
          </div>
        </section>
      </div>

      <MathTools open={q.section === "MATH" && !tutorOpen ? tool : null} onClose={() => setTool(null)} />
      {tutor && tutorOpen && (
        <aside
          aria-label="Tutor"
          data-no-shortcuts
          className="fixed inset-x-0 bottom-0 z-40 flex h-[65dvh] flex-col border-t border-line bg-surface shadow-2xl lg:inset-y-0 lg:right-0 lg:left-auto lg:h-auto lg:w-[440px] lg:border-t-0 lg:border-l"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-2">
            <h2 className="font-semibold">Tutor · question {index + 1}</h2>
            <button onClick={() => setTutorOpen(false)} className="rounded-md px-2 py-1 text-sm text-muted hover:bg-surface-2">
              ✕ Close
            </button>
          </div>
          <div className="min-h-0 flex-1">
            <TutorChat
              key={`${q.id}-${st.result ? "done" : "open"}`}
              compact
              questionId={q.id}
              answered={!!st.result}
              response={q.type === "mcq" ? (st.selected ?? "") : st.spr}
              suggestions={st.result ? ["Why is my answer wrong?", "Explain this another way.", "Give me a similar question."] : ["Give me a hint.", "What is this question testing?"]}
            />
          </div>
        </aside>
      )}

      <p className="text-xs text-muted">
        Keyboard: <kbd>A</kbd>–<kbd>D</kbd> choose · <kbd>E</kbd> eliminate mode · <kbd>Enter</kbd> check / next · <kbd>←</kbd> previous
      </p>
    </div>
  );
}


function Feedback({ q, r, spr, selected }: { q: PlayerQuestion; r: Result; spr: string; selected: string | null }) {
  const keyText = q.type === "spr" ? r.answer.split("|").join(" or ") : r.answer;
  return (
    <div className="flex flex-col gap-3" aria-live="polite">
      <div className={`rounded-xl px-4 py-3 font-semibold ${r.correct ? "bg-jade-soft text-jade" : "bg-rose-soft text-rose"}`}>
        {r.correct ? "Correct!" : q.type === "mcq" ? `Not quite. You chose ${selected}; the answer is ${keyText}.` : `Not quite. You entered ${spr.trim()}; the answer is ${keyText}.`}
        <span className="ml-2 text-sm font-medium opacity-80">+{r.xp} XP</span>
      </div>
      {r.awards.map((a) => (
        <div key={a.reason} className="rounded-xl bg-gold-soft px-4 py-2.5 text-sm font-semibold text-gold" role="status">
          <span aria-hidden="true">💎</span> +{a.amount} gems — {a.reason}
        </div>
      ))}
      <div className="rounded-xl border border-line bg-bg p-4">
        <h3 className="mb-2 font-semibold">Explanation</h3>
        <Md>{r.explanation_md}</Md>
      </div>
      {q.type === "mcq" && r.distractor_notes && Object.keys(r.distractor_notes).length > 0 && (
        <div className="rounded-xl border border-line bg-bg p-4">
          <h3 className="mb-2 font-semibold">Why the other choices are wrong</h3>
          <ul className="flex flex-col gap-2">
            {Object.entries(r.distractor_notes)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([L, note]) => (
                <li key={L} className="flex gap-2">
                  <span className={`font-bold ${L === selected ? "text-rose" : "text-muted"}`}>{L}.</span>
                  <Md className="flex-1">{note}</Md>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Summary({
  title,
  questions,
  states,
  backHref,
  onReview,
}: {
  title: string;
  questions: PlayerQuestion[];
  states: QState[];
  backHref: string;
  onReview: (i: number) => void;
}) {
  const answered = states.filter((s) => s.result);
  const correct = answered.filter((s) => s.result!.correct).length;
  const time = states.reduce((t, s) => t + s.elapsedMs, 0);
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <h1 className="text-2xl font-bold">{title}: results</h1>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Correct" value={`${correct}/${answered.length}`} />
        <Stat label="Accuracy" value={answered.length ? `${Math.round((correct / answered.length) * 100)}%` : "—"} />
        <Stat label="Avg. time" value={answered.length ? fmtTime(time / answered.length) : "—"} />
      </div>
      {answered.length < questions.length && (
        <p className="text-sm text-muted">{questions.length - answered.length} question(s) skipped.</p>
      )}
      <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
        {questions.map((q, i) => {
          const r = states[i].result;
          return (
            <li key={q.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="flex items-center gap-2">
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${r ? (r.correct ? "bg-jade" : "bg-rose") : "bg-line"}`} aria-hidden="true" />
                <span className="text-sm">
                  {i + 1}. {q.skillName} <span className="text-muted">· {DIFF[q.difficulty as 1 | 2 | 3]}</span>
                </span>
              </span>
              <span className="flex items-center gap-3">
                <span className="text-sm text-muted">{r ? (r.correct ? "Correct" : "Incorrect") : "Skipped"}</span>
                <button onClick={() => onReview(i)} className="text-sm text-accent underline">
                  Review
                </button>
              </span>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap gap-3">
        <Link href={backHref} className="rounded-xl bg-ink px-5 py-2.5 font-semibold text-bg">
          Done
        </Link>
        <Link href="/saved?tab=mistakes" className="rounded-xl border border-line px-5 py-2.5 font-medium hover:bg-surface-2">
          Review all mistakes
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 text-center">
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-sm text-muted">{label}</div>
    </div>
  );
}

export function DifficultyBadge({ d }: { d: number }) {
  const cls = d === 1 ? "bg-jade-soft text-jade" : d === 2 ? "bg-gold-soft text-gold" : "bg-rose-soft text-rose";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{DIFF[d as 1 | 2 | 3]}</span>;
}

