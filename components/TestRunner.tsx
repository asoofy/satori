"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { beginModuleAction, saveTestAnswerAction, submitModuleAction } from "@/app/test-actions";
import { fmtTime, sprTex } from "@/lib/format";
import { parseSpr } from "@/lib/grading";
import { MathTools } from "./MathTools";
import { Md, MdInline } from "./Md";
import type { PlayerQuestion } from "./PracticePlayer";

type Range = { start: number; end: number };
interface Ans {
  response: string;
  flagged: boolean;
  eliminated: string[];
  highlights: Range[];
  note: string;
}
const EMPTY: Ans = { response: "", flagged: false, eliminated: [], highlights: [], note: "" };
const LETTERS = ["A", "B", "C", "D"] as const;

const DIRECTIONS = {
  RW: "Each question has a short passage (sometimes two passages, a table or a graph) and four answer choices. Choose the single best answer based on what the passage says. You can highlight passage text, keep notes, cross out choices you’ve ruled out, and mark questions to come back to. Unanswered questions count as wrong, so answer every question before time runs out.",
  MATH: "Some questions are multiple-choice. For the others, type your own answer: a whole number, fraction or decimal, up to 5 characters (6 with a minus sign). Mixed numbers aren’t accepted. The graphing calculator and reference sheet are available on every question. Treat numbers as real numbers and figures as drawn to scale unless a question says otherwise. Unanswered questions count as wrong.",
};

export function TestRunner(props: {
  testId: number;
  moduleId: number;
  title: string;
  testLabel: string;
  section: "RW" | "MATH";
  startedAt: string | null;
  endsAt: string | null;
  timeLimitS: number;
  isLastModule: boolean;
  moduleNumber: number;
  questions: PlayerQuestion[];
  initialAnswers: Record<string, Ans>;
}) {
  const { testId, moduleId, section, questions } = props;
  const [beginPending, startBegin] = useTransition();

  if (!props.startedAt || !props.endsAt) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-5 px-5 py-10">
        <p className="text-sm font-semibold tracking-widest text-muted uppercase">{props.testLabel}</p>
        <h1 className="text-3xl font-bold">{props.title}</h1>
        <p className="text-muted">
          {questions.length} questions · {Math.round(props.timeLimitS / 60)} minutes
        </p>
        <div className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="mb-2 font-semibold">Directions</h2>
          <p className="leading-relaxed">{DIRECTIONS[section]}</p>
          <p className="mt-3 text-sm text-muted">The clock starts when you begin and keeps running if you leave, just like on test day.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => startBegin(() => beginModuleAction(testId, moduleId))}
            disabled={beginPending}
            className="rounded-xl bg-accent px-6 py-3 font-semibold text-accent-ink hover:opacity-90 disabled:opacity-60"
          >
            {beginPending ? "Starting…" : "Begin"}
          </button>
          <Link href="/tests" className="text-sm text-muted underline">
            Not now
          </Link>
        </div>
      </main>
    );
  }
  return <RunningModule {...props} startedAt={props.startedAt} endsAt={props.endsAt} />;
}

function RunningModule({
  testId,
  moduleId,
  title,
  section,
  endsAt,
  isLastModule,
  questions,
  initialAnswers,
}: Parameters<typeof TestRunner>[0] & { startedAt: string; endsAt: string }) {
  const [answers, setAnswers] = useState<Record<string, Ans>>(initialAnswers);
  const [index, setIndex] = useState(0);
  const [view, setView] = useState<"question" | "review">("question");
  const [navOpen, setNavOpen] = useState(false);
  const [showTimer, setShowTimer] = useState(true);
  const [showDirections, setShowDirections] = useState(false);
  const [tool, setTool] = useState<"calculator" | "reference" | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [eliminateMode, setEliminateMode] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitting, startSubmit] = useTransition();
  const [saveError, setSaveError] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [segmentStart, setSegmentStart] = useState(() => Date.now());
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const q = questions[index];
  const a = answers[q.id] ?? EMPTY;
  const end = new Date(endsAt).getTime();
  const remaining = Math.max(0, end - now);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const persist = useCallback(
    (qid: string, patch: Parameters<typeof saveTestAnswerAction>[3]) => {
      saveTestAnswerAction(testId, moduleId, qid, patch).then(
        () => setSaveError(false),
        () => setSaveError(true),
      );
    },
    [testId, moduleId],
  );

  const update = (patch: Partial<Ans>, save = true) => {
    setAnswers((s) => ({ ...s, [q.id]: { ...(s[q.id] ?? EMPTY), ...patch } }));
    if (save) persist(q.id, patch);
  };

  /** Credit time spent on the current question before moving elsewhere. */
  const bankTime = () => {
    const t = Date.now();
    if (view === "question") {
      // Also save a grid-in answer that may not have been blurred yet.
      persist(q.id, { addTimeMs: t - segmentStart, ...(q.type === "spr" ? { response: (answers[q.id]?.response ?? "").trim() } : {}) });
    }
    setSegmentStart(t);
  };

  const goTo = (i: number) => {
    bankTime();
    setNavOpen(false);
    setNoteOpen(false);
    setView("question");
    setIndex(Math.max(0, Math.min(questions.length - 1, i)));
  };
  const toReview = () => {
    bankTime();
    setNavOpen(false);
    setView("review");
  };

  const submit = useCallback(() => {
    startSubmit(async () => {
      if (view === "question") {
        // Save the time on this question, and a grid-in answer that may still be in the box.
        await saveTestAnswerAction(testId, moduleId, q.id, {
          addTimeMs: Date.now() - segmentStart,
          ...(q.type === "spr" ? { response: (answers[q.id]?.response ?? "").trim() } : {}),
        });
      }
      await submitModuleAction(testId, moduleId);
    });
  }, [view, testId, moduleId, q.id, q.type, segmentStart, answers]);

  // Time's up: submit automatically.
  const autoSubmitted = useRef(false);
  useEffect(() => {
    if (remaining === 0 && !autoSubmitted.current) {
      autoSubmitted.current = true;
      submit();
    }
  }, [remaining, submit]);

  const answeredCount = questions.filter((x) => answers[x.id]?.response).length;
  const choose = (L: string) => {
    if (eliminateMode) return toggleEliminate(L);
    update({ response: a.response === L ? "" : L, eliminated: a.eliminated.filter((x) => x !== L) });
  };
  const toggleEliminate = (L: string) => {
    const has = a.eliminated.includes(L);
    update({ eliminated: has ? a.eliminated.filter((x) => x !== L) : [...a.eliminated, L], ...(!has && a.response === L ? { response: "" } : {}) });
  };
  const spr = q.type === "spr" && a.response ? parseSpr(a.response) : null;
  const lowTime = remaining <= 5 * 60 * 1000;

  return (
    <div className={`flex min-h-dvh flex-col ${tool && section === "MATH" ? "lg:pr-[440px]" : ""}`}>
      <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface px-4 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{title}</p>
          <button onClick={() => setShowDirections((v) => !v)} className="text-xs text-muted underline" aria-expanded={showDirections}>
            Directions
          </button>
        </div>
        <div className="flex items-center gap-2" aria-live="off">
          {showTimer ? (
            <span className={`text-xl font-bold tabular-nums ${lowTime ? "text-rose" : ""}`} role="timer" aria-label="Time remaining">
              {fmtTime(remaining)}
            </span>
          ) : (
            <span className="text-sm text-muted">Timer hidden</span>
          )}
          <button onClick={() => setShowTimer((v) => !v)} className="rounded-md border border-line px-2 py-0.5 text-xs">
            {showTimer ? "Hide" : "Show"}
          </button>
        </div>
        <div className="flex items-center gap-2">
          {section === "MATH" && (
            <>
              <button
                onClick={() => setTool((t) => (t === "calculator" ? null : "calculator"))}
                aria-pressed={tool === "calculator"}
                className={`rounded-lg border px-3 py-1 text-sm ${tool === "calculator" ? "border-indigo bg-indigo-soft text-indigo" : "border-line"}`}
              >
                Calculator
              </button>
              <button
                onClick={() => setTool((t) => (t === "reference" ? null : "reference"))}
                aria-pressed={tool === "reference"}
                className={`rounded-lg border px-3 py-1 text-sm ${tool === "reference" ? "border-indigo bg-indigo-soft text-indigo" : "border-line"}`}
              >
                Reference
              </button>
            </>
          )}
          <Link href="/tests" className="rounded-lg px-2 py-1 text-sm text-muted hover:bg-surface-2" title="Your answers are saved. The clock keeps running.">
            Save &amp; exit
          </Link>
        </div>
      </header>

      {showDirections && (
        <div className="border-b border-line bg-surface-2 px-4 py-3 text-sm leading-relaxed">
          {DIRECTIONS[section]}{" "}
          <button onClick={() => setShowDirections(false)} className="underline">
            Close
          </button>
        </div>
      )}
      {lowTime && remaining > 0 && remaining > 5 * 60 * 1000 - 15_000 && (
        <p role="alert" className="bg-rose-soft px-4 py-2 text-center text-sm font-medium text-rose">
          5 minutes left in this module.
        </p>
      )}
      {saveError && (
        <p role="alert" className="bg-gold-soft px-4 py-2 text-center text-sm text-gold">
          Couldn’t save your last change. Check that Satori is still running.
        </p>
      )}

      <main className="flex-1 px-4 py-5 pb-28">
        {view === "review" ? (
          <ReviewGrid
            title={title}
            questions={questions}
            answers={answers}
            onPick={goTo}
            confirm={confirmSubmit}
            setConfirm={setConfirmSubmit}
            onSubmit={submit}
            submitting={submitting}
            isLastModule={isLastModule}
          />
        ) : (
          <div className={`mx-auto grid max-w-6xl gap-4 ${q.passage_md ? "lg:grid-cols-2" : "max-w-3xl"}`}>
            {q.passage_md && (
              <section aria-label="Passage" className="rounded-2xl border border-line bg-surface p-5 lg:max-h-[calc(100dvh-12rem)] lg:overflow-y-auto">
                <Passage
                  key={q.id}
                  md={q.passage_md}
                  highlights={a.highlights}
                  onChange={(h) => update({ highlights: h })}
                  noteOpen={noteOpen}
                  setNoteOpen={setNoteOpen}
                />
                {noteOpen && (
                  <label className="mt-3 flex flex-col gap-1 text-sm">
                    <span className="font-medium">Notes for question {index + 1}</span>
                    <textarea
                      value={a.note}
                      onChange={(e) => {
                        const note = e.target.value;
                        update({ note }, false);
                        if (noteTimer.current) clearTimeout(noteTimer.current);
                        noteTimer.current = setTimeout(() => persist(q.id, { note }), 600);
                      }}
                      rows={4}
                      className="rounded-lg border border-line bg-bg p-2"
                    />
                  </label>
                )}
              </section>
            )}
            <section aria-label={`Question ${index + 1}`} className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5">
              <div className="flex items-center justify-between gap-2 border-b border-line pb-2">
                <span className="flex h-8 w-8 items-center justify-center rounded bg-ink text-sm font-bold text-bg">{index + 1}</span>
                <button
                  onClick={() => update({ flagged: !a.flagged })}
                  aria-pressed={a.flagged}
                  className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm ${a.flagged ? "text-rose" : "text-muted"} hover:bg-surface-2`}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill={a.flagged ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M6 3h12v18l-6-4-6 4z" />
                  </svg>
                  Mark for review
                </button>
                {q.type === "mcq" && (
                  <button
                    onClick={() => setEliminateMode((v) => !v)}
                    aria-pressed={eliminateMode}
                    title="Answer eliminator"
                    className={`rounded-md border px-2 py-1 text-xs font-semibold ${eliminateMode ? "border-indigo bg-indigo-soft text-indigo" : "border-line"}`}
                  >
                    <span className="line-through">ABC</span>
                  </button>
                )}
              </div>
              <div className={section === "RW" ? "reading" : "text-[1.05rem] leading-relaxed"}>
                <Md>{q.stem_md}</Md>
              </div>
              {q.type === "mcq" && q.choices ? (
                <ul className="flex flex-col gap-2" role="radiogroup" aria-label="Answer choices">
                  {q.choices.map((c, i) => {
                    const L = LETTERS[i];
                    const sel = a.response === L;
                    const elim = a.eliminated.includes(L);
                    return (
                      <li key={L} className="flex items-stretch gap-2">
                        <button
                          role="radio"
                          aria-checked={sel}
                          onClick={() => choose(L)}
                          className={`flex flex-1 items-start gap-3 rounded-xl border-2 px-3 py-2.5 text-left ${sel ? "border-indigo bg-indigo-soft" : "border-line hover:border-muted"} ${elim ? "opacity-45" : ""}`}
                        >
                          <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-bold ${sel ? "border-transparent bg-ink text-bg" : "border-muted"}`}>
                            {L}
                          </span>
                          <span className={`pt-0.5 ${elim ? "line-through" : ""}`}>
                            <MdInline>{c}</MdInline>
                          </span>
                        </button>
                        {eliminateMode && (
                          <button
                            onClick={() => toggleEliminate(L)}
                            aria-label={elim ? `Restore choice ${L}` : `Cross out choice ${L}`}
                            className="w-9 shrink-0 rounded-lg border border-line text-sm text-muted hover:bg-surface-2"
                          >
                            {elim ? "↺" : <span className="line-through">{L}</span>}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="flex flex-col gap-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm text-muted">Your answer</span>
                    <input
                      value={a.response}
                      onChange={(e) => update({ response: e.target.value }, false)}
                      onBlur={(e) => persist(q.id, { response: e.target.value.trim() })}
                      autoComplete="off"
                      maxLength={8}
                      className="w-44 rounded-lg border-2 border-line bg-bg px-3 py-2 font-mono text-lg"
                    />
                  </label>
                  <p className="text-sm" aria-live="polite">
                    {spr ? (
                      spr.ok ? (
                        <span className="text-muted">
                          Answer preview: <MdInline>{`$${sprTex(spr.text)}$`}</MdInline>
                        </span>
                      ) : (
                        <span className="text-rose">{spr.error}</span>
                      )
                    ) : null}
                  </p>
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-2 border-t border-line bg-surface px-4 py-2.5">
        <span className="hidden text-sm text-muted sm:block">
          {answeredCount}/{questions.length} answered
        </span>
        <div className="relative">
          <button
            onClick={() => setNavOpen((o) => !o)}
            aria-expanded={navOpen}
            className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-bg"
          >
            {view === "review" ? "Review" : `Question ${index + 1} of ${questions.length}`} {navOpen ? "▾" : "▴"}
          </button>
          {navOpen && (
            <div className="absolute bottom-12 left-1/2 w-[min(90vw,26rem)] -translate-x-1/2 rounded-2xl border border-line bg-surface p-4 shadow-xl">
              <NavGrid questions={questions} answers={answers} current={view === "question" ? index : -1} onPick={goTo} />
              <button onClick={toReview} className="mt-3 w-full rounded-lg border border-line py-2 text-sm font-medium hover:bg-surface-2">
                Go to review page
              </button>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => (view === "review" ? goTo(questions.length - 1) : goTo(index - 1))}
            disabled={view === "question" && index === 0}
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            Back
          </button>
          {view === "question" && (
            <button
              onClick={() => (index + 1 < questions.length ? goTo(index + 1) : toReview())}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink"
            >
              Next
            </button>
          )}
        </div>
      </footer>

      <MathTools open={section === "MATH" ? tool : null} onClose={() => setTool(null)} />
    </div>
  );
}

function NavGrid({
  questions,
  answers,
  current,
  onPick,
}: {
  questions: PlayerQuestion[];
  answers: Record<string, Ans>;
  current: number;
  onPick: (i: number) => void;
}) {
  return (
    <div>
      <ul className="mb-3 flex flex-wrap gap-3 text-xs text-muted">
        <li className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded border border-dashed border-muted" aria-hidden="true" /> Unanswered
        </li>
        <li className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-indigo" aria-hidden="true" /> Answered
        </li>
        <li className="flex items-center gap-1">
          <span className="text-rose" aria-hidden="true">
            ▮
          </span>{" "}
          For review
        </li>
      </ul>
      <div className="grid grid-cols-7 gap-2 sm:grid-cols-9">
        {questions.map((q, i) => {
          const a = answers[q.id];
          const answered = !!a?.response;
          return (
            <button
              key={q.id}
              onClick={() => onPick(i)}
              aria-label={`Question ${i + 1}: ${answered ? "answered" : "unanswered"}${a?.flagged ? ", marked for review" : ""}${i === current ? ", current" : ""}`}
              className={`relative h-9 rounded-md text-sm font-medium tabular-nums ${
                answered ? "bg-indigo text-white dark:text-bg" : "border border-dashed border-muted"
              } ${i === current ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : ""}`}
            >
              {i + 1}
              {a?.flagged && <span className="absolute -top-1 -right-1 h-3 w-2 rounded-sm bg-rose" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ReviewGrid({
  title,
  questions,
  answers,
  onPick,
  confirm,
  setConfirm,
  onSubmit,
  submitting,
  isLastModule,
}: {
  title: string;
  questions: PlayerQuestion[];
  answers: Record<string, Ans>;
  onPick: (i: number) => void;
  confirm: boolean;
  setConfirm: (v: boolean) => void;
  onSubmit: () => void;
  submitting: boolean;
  isLastModule: boolean;
}) {
  const unanswered = questions.filter((q) => !answers[q.id]?.response).length;
  const flagged = questions.filter((q) => answers[q.id]?.flagged).length;
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Check your work</h1>
        <p className="text-muted">{title}</p>
        <p className="mt-1 text-sm text-muted">
          On test day you can review and change answers until you submit or time runs out. {unanswered > 0 && <strong className="text-rose">{unanswered} unanswered.</strong>}{" "}
          {flagged > 0 && <span>{flagged} marked for review.</span>}
        </p>
      </div>
      <div className="rounded-2xl border border-line bg-surface p-5">
        <NavGrid questions={questions} answers={answers} current={-1} onPick={onPick} />
      </div>
      {!confirm ? (
        <button onClick={() => setConfirm(true)} className="mx-auto rounded-xl bg-accent px-6 py-3 font-semibold text-accent-ink">
          {isLastModule ? "Submit and see results" : "Submit module"}
        </button>
      ) : (
        <div className="mx-auto flex flex-col items-center gap-3 rounded-2xl border border-rose bg-rose-soft p-4 text-center" role="alertdialog" aria-label="Confirm submit">
          <p className="font-medium">Submit this module? You won’t be able to come back to it.</p>
          <div className="flex gap-3">
            <button onClick={onSubmit} disabled={submitting} className="rounded-xl bg-rose px-5 py-2 font-semibold text-white disabled:opacity-60 dark:text-bg">
              {submitting ? "Submitting…" : "Yes, submit"}
            </button>
            <button onClick={() => setConfirm(false)} className="rounded-xl border border-line bg-surface px-5 py-2">
              Keep working
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Passage with highlighting (CSS Custom Highlight API) ---------- */

type HighlightRegistry = { set: (name: string, h: unknown) => void; delete: (name: string) => void };
type HighlightCtor = new (...ranges: globalThis.Range[]) => unknown;

function highlightSupport(): { registry: HighlightRegistry; Ctor: HighlightCtor } | null {
  if (typeof window === "undefined") return null;
  const css = (window as unknown as { CSS?: { highlights?: HighlightRegistry } }).CSS;
  const Ctor = (window as unknown as { Highlight?: HighlightCtor }).Highlight;
  return css?.highlights && Ctor ? { registry: css.highlights, Ctor } : null;
}

/** Text offset of a DOM position, measured over the container's text. */
function offsetOf(container: Node, node: Node, offset: number): number {
  const r = document.createRange();
  r.setStart(container, 0);
  r.setEnd(node, offset);
  return r.toString().length;
}

/** Build a DOM range from text offsets. */
function rangeFrom(container: Node, start: number, end: number): globalThis.Range | null {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let pos = 0;
  let startNode: Node | null = null;
  let startOff = 0;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const len = (n.nodeValue ?? "").length;
    if (!startNode && start <= pos + len) {
      startNode = n;
      startOff = start - pos;
    }
    if (startNode && end <= pos + len) {
      const r = document.createRange();
      r.setStart(startNode, startOff);
      r.setEnd(n, end - pos);
      return r;
    }
    pos += len;
  }
  return null;
}

function mergeRanges(ranges: Range[]): Range[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const out: Range[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
    else out.push({ ...r });
  }
  return out;
}

function Passage({
  md,
  highlights,
  onChange,
  noteOpen,
  setNoteOpen,
}: {
  md: string;
  highlights: Range[];
  onChange: (h: Range[]) => void;
  noteOpen: boolean;
  setNoteOpen: (v: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [supported] = useState(() => highlightSupport() !== null);
  const [msg, setMsg] = useState<string | null>(null);

  useLayoutEffect(() => {
    const hs = highlightSupport();
    if (!hs || !ref.current) return;
    // Added at runtime: the CSS toolchain doesn't parse ::highlight() yet.
    if (!document.getElementById("satori-hl-style")) {
      const st = document.createElement("style");
      st.id = "satori-hl-style";
      st.textContent = "::highlight(satori-hl){background-color:var(--hl);color:inherit}";
      document.head.appendChild(st);
    }
    const ranges = highlights.map((h) => rangeFrom(ref.current!, h.start, h.end)).filter((r): r is globalThis.Range => !!r);
    hs.registry.set("satori-hl", new hs.Ctor(...ranges));
    return () => hs.registry.delete("satori-hl");
  }, [highlights, md]);

  const addHighlight = () => {
    const sel = window.getSelection();
    const el = ref.current;
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed || !el) {
      setMsg("Select some passage text first.");
      return;
    }
    const r = sel.getRangeAt(0);
    if (!el.contains(r.commonAncestorContainer)) {
      setMsg("Select text inside the passage.");
      return;
    }
    const start = offsetOf(el, r.startContainer, r.startOffset);
    const end = offsetOf(el, r.endContainer, r.endOffset);
    if (end > start) onChange(mergeRanges([...highlights, { start, end }]));
    sel.removeAllRanges();
    setMsg(null);
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-line pb-2 text-sm">
        {supported ? (
          <>
            <button onMouseDown={(e) => e.preventDefault()} onClick={addHighlight} className="rounded-md border border-line px-2 py-1 hover:bg-surface-2">
              <span className="rounded bg-[var(--hl)] px-1">Highlight</span> selection
            </button>
            {highlights.length > 0 && (
              <button onClick={() => onChange([])} className="rounded-md px-2 py-1 text-muted hover:bg-surface-2">
                Clear highlights
              </button>
            )}
          </>
        ) : (
          <span className="text-xs text-muted">Highlighting needs a newer browser.</span>
        )}
        <button onClick={() => setNoteOpen(!noteOpen)} aria-expanded={noteOpen} className="ml-auto rounded-md border border-line px-2 py-1 hover:bg-surface-2">
          {noteOpen ? "Hide notes" : "Notes"}
        </button>
      </div>
      {msg && (
        <p role="status" className="mb-2 text-xs text-muted">
          {msg}
        </p>
      )}
      <div ref={ref} className="reading">
        <Md>{md}</Md>
      </div>
    </div>
  );
}
