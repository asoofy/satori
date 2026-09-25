import type { DB } from "@/lib/db";

export interface ChecklistItem {
  id: string;
  label: string;
  hint: string;
  href: string;
  done: boolean;
}

/** The getting-started checklist. Every item is computed from real data. */
export function gettingStarted(db: DB, profileId: number): ChecklistItem[] {
  const one = (sql: string, ...p: (string | number)[]) => (db.prepare(sql).get(...p) as { n: number }).n;
  const settings = db.prepare("SELECT test_date, onboarded FROM settings WHERE profile_id = ?").get(profileId) as {
    test_date: string | null;
    onboarded: number;
  };
  const attempts = one("SELECT COUNT(*) AS n FROM attempts WHERE profile_id = ?", profileId);
  const planned = one("SELECT COUNT(*) AS n FROM plan_days WHERE profile_id = ?", profileId);
  const saved = one("SELECT COUNT(*) AS n FROM saved WHERE profile_id = ?", profileId);
  // A question answered wrong and later answered right.
  const fixed = one(
    `SELECT COUNT(*) AS n FROM attempts good
     WHERE good.profile_id = ? AND good.correct = 1 AND EXISTS (
       SELECT 1 FROM attempts bad WHERE bad.profile_id = good.profile_id AND bad.question_id = good.question_id
       AND bad.correct = 0 AND bad.id < good.id)`,
    profileId,
  );
  return [
    { id: "goals", label: "Set your test date and goal", hint: "Tell Satori when your test is.", href: "/onboarding", done: !!settings.onboarded && !!settings.test_date },
    { id: "answer10", label: "Answer 10 questions", hint: `${Math.min(attempts, 10)}/10 so far.`, href: "/", done: attempts >= 10 },
    { id: "plan", label: "Build your study plan", hint: "Pick your study days and get a daily plan.", href: "/plan", done: planned > 0 },
    { id: "save", label: "Save a question to revisit", hint: "Use the Save button while practicing.", href: "/questions", done: saved > 0 },
    { id: "fix", label: "Fix a mistake", hint: "Redo a question you missed and get it right.", href: "/saved?tab=mistakes", done: fixed > 0 },
  ];
}
