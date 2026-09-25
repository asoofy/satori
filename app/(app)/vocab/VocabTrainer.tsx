"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { reviewVocabAction } from "@/app/content-actions";
import type { DrillQuestion, VocabCard } from "@/lib/vocab";

const RATINGS = [
  { q: 1, label: "Again", key: "1", cls: "border-rose text-rose" },
  { q: 3, label: "Hard", key: "2", cls: "border-gold text-gold" },
  { q: 4, label: "Good", key: "3", cls: "border-jade text-jade" },
  { q: 5, label: "Easy", key: "4", cls: "border-indigo text-indigo" },
];

export function VocabTrainer({ cards, drill }: { cards: VocabCard[]; drill: DrillQuestion[] }) {
  const [tab, setTab] = useState<"cards" | "drill">(cards.length ? "cards" : "drill");
  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Practice mode" className="flex gap-2">
        {(
          [
            ["cards", `Flashcards (${cards.length} due)`],
            ["drill", "Words in context"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`rounded-full border px-4 py-1.5 text-sm ${tab === id ? "border-accent bg-accent-soft font-semibold text-accent" : "border-line hover:bg-surface-2"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "cards" ? <Flashcards cards={cards} /> : <Drill questions={drill} />}
    </div>
  );
}

function Flashcards({ cards }: { cards: VocabCard[] }) {
  const router = useRouter();
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [pending, start] = useTransition();
  const [again, setAgain] = useState<VocabCard[]>([]);
  const queue = [...cards, ...again];
  const card = queue[i];

  const rate = (q: number) => {
    if (!card || pending) return;
    start(async () => {
      await reviewVocabAction(card.id, q);
      if (q < 3) setAgain((a) => [...a, card]); // see it again this session
      setFlipped(false);
      setI((n) => n + 1);
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT") return;
      // A focused button handles Space/Enter itself.
      if ((e.key === " " || e.key === "Enter") && tag !== "BUTTON") {
        e.preventDefault();
        setFlipped(true);
      } else if (flipped) {
        const r = RATINGS.find((x) => x.key === e.key);
        if (r) rate(r.q);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!card) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-8 text-center">
        <p className="text-lg font-semibold">All caught up for today 🎉</p>
        <p className="mt-1 text-muted">Come back tomorrow for the next review, or try the words-in-context drill.</p>
        <button onClick={() => router.refresh()} className="mt-4 rounded-lg border border-line px-4 py-2 text-sm hover:bg-surface-2">
          Check for more
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-muted">
        Card {Math.min(i + 1, queue.length)} of {queue.length}
        {card.isNew && <span className="ml-2 rounded-full bg-indigo-soft px-2 py-0.5 text-xs text-indigo">New</span>}
      </p>
      <button
        onClick={() => setFlipped((f) => !f)}
        aria-label={flipped ? "Hide the definition" : "Show the definition"}
        className="flex min-h-64 w-full max-w-xl flex-col items-center justify-center gap-3 rounded-3xl border border-line bg-surface p-8 text-center shadow-sm"
      >
        <span className="font-serif text-4xl font-bold">{card.word}</span>
        <span className="text-sm text-muted italic">{card.pos}</span>
        {flipped ? (
          <>
            <span className="text-lg">{card.definition}</span>
            <span className="reading text-muted">“{card.example}”</span>
          </>
        ) : (
          <span className="text-sm text-muted">Think of the meaning, then tap (or press Space) to check.</span>
        )}
      </button>
      {flipped && (
        <div className="grid w-full max-w-xl grid-cols-4 gap-2" role="group" aria-label="How well did you know it?">
          {RATINGS.map((r) => (
            <button key={r.q} onClick={() => rate(r.q)} disabled={pending} className={`rounded-xl border-2 bg-surface py-2.5 font-semibold ${r.cls} disabled:opacity-50`}>
              {r.label}
              <span className="block text-xs font-normal text-muted">key {r.key}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Drill({ questions }: { questions: DrillQuestion[] }) {
  const router = useRouter();
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [, start] = useTransition();
  const q = questions[i];

  const choose = (idx: number) => {
    if (picked !== null || !q) return;
    setPicked(idx);
    const right = idx === q.answer;
    if (right) setScore((s) => s + 1);
    start(() => reviewVocabAction(q.wordId, right ? 4 : 1).then(() => undefined));
  };

  if (!q) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-8 text-center">
        <p className="text-lg font-semibold">
          {score} of {questions.length} correct
        </p>
        <button onClick={() => router.refresh()} className="mt-4 rounded-xl bg-accent px-5 py-2.5 font-semibold text-accent-ink">
          New drill
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 rounded-2xl border border-line bg-surface p-6 shadow-sm">
      <p className="text-sm text-muted">
        {i + 1} of {questions.length} · Choose the word that best completes the sentence.
      </p>
      <p className="reading text-xl">{q.sentence}</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {q.choices.map((c, idx) => {
          const state = picked === null ? "" : idx === q.answer ? "right" : idx === picked ? "wrong" : "";
          return (
            <li key={c}>
              <button
                onClick={() => choose(idx)}
                disabled={picked !== null}
                className={`w-full rounded-xl border-2 px-4 py-2.5 text-left font-medium ${
                  state === "right" ? "border-jade bg-jade-soft" : state === "wrong" ? "border-rose bg-rose-soft" : "border-line hover:border-muted"
                }`}
              >
                {c}
              </button>
            </li>
          );
        })}
      </ul>
      {picked !== null && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm">
            <span className="font-semibold">{q.choices[q.answer]}</span>: {q.definition}
          </p>
          <button
            onClick={() => {
              setPicked(null);
              setI((n) => n + 1);
            }}
            className="rounded-xl bg-ink px-4 py-2 font-semibold text-bg"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
