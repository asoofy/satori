import { currentProfile } from "@/lib/current";
import { today } from "@/lib/dates";
import { getDb } from "@/lib/db";
import { drillQuestions, dueCards, NEW_PER_DAY, vocabStats } from "@/lib/vocab";
import { VocabTrainer } from "./VocabTrainer";

export const metadata = { title: "Vocab" };

export default async function VocabPage() {
  const { profile } = await currentProfile();
  const db = getDb();
  const t = today();
  const stats = vocabStats(db, profile.id, t);
  const cards = dueCards(db, profile.id, t);
  const drill = drillQuestions(db, profile.id, 10);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Vocab</h1>
        <p className="text-muted">
          {stats.total} words chosen for the SAT, with flashcards scheduled by spaced repetition (SM-2) and words-in-context drills. Up to {NEW_PER_DAY} new words a day.
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Due today" value={cards.length} />
        <Stat label="Learning" value={stats.learning} />
        <Stat label="Mastered (3+ weeks)" value={stats.mature} />
        <Stat label="Not started" value={stats.total - stats.learning} />
      </dl>
      <VocabTrainer key={`${t}-${cards.length}`} cards={cards} drill={drill} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-2xl font-bold tabular-nums">{value}</dd>
    </div>
  );
}
